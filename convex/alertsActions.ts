"use node";

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;

const COOLDOWN_MS: Record<AlertType, number> = {
  PRICE_BELOW_TARGET: 7 * DAY_MS,
  PRICE_ABOVE_SELL_TARGET: 7 * DAY_MS,
  LISTING_COUNT_DROP: 14 * DAY_MS,
  NEW_LISTING_SPIKE: 14 * DAY_MS,
  VERDICT_TRANSITION: 0, // already structurally rate-limited (only fires on change)
};

const NOTABLE_VERDICTS = new Set([
  "STRONG_SIGNAL",
  "GOOD_BELOW_TARGET",
  "AVOID_HYPE",
  "SCARCE_OVERPRICED",
]);

type AlertType =
  | "PRICE_BELOW_TARGET"
  | "PRICE_ABOVE_SELL_TARGET"
  | "LISTING_COUNT_DROP"
  | "VERDICT_TRANSITION"
  | "NEW_LISTING_SPIKE";

export const evaluateForItem = internalAction({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.runQuery(internal.items._get, { itemId });
    if (!item) return;

    const trackedRows = await ctx.runQuery(internal.alerts._trackedForItem, {
      itemId,
    });
    if (trackedRows.length === 0) return;

    // Pull 30 days of snapshots once; reuse across all tracking rows.
    const sinceMs = Date.now() - 30 * DAY_MS;
    const snapshots = await ctx.runQuery(
      internal.signalScores._snapshotsForItem,
      { itemId, sinceMs },
    );

    // Latest two signalScore rows for VERDICT_TRANSITION.
    const latestScore = await ctx.runQuery(
      internal.signalScores._latestInternal,
      { itemId },
    );
    const prevScore = latestScore
      ? await ctx.runQuery(internal.signalScores._previousScore, {
          itemId,
          beforeMs: latestScore.date,
        })
      : null;

    for (const { tracked: t, muted } of trackedRows) {
      if (muted) continue;
      const preferredCondition = t.preferredCondition ?? "N";

      const latestStock = snapshots
        .filter(
          (s) =>
            s.guideType === "stock" && s.condition === preferredCondition,
        )
        .sort((a, b) => b.date - a.date)[0];

      // PRICE_BELOW_TARGET — anchored on the LOWEST available listing
      // (minPriceCents). That's the price the user could actually buy at,
      // matching the "Lowest" stat on the item page.
      if (
        t.targetPriceCents !== undefined &&
        latestStock &&
        latestStock.minPriceCents > 0 &&
        latestStock.minPriceCents <= t.targetPriceCents &&
        (await passesCooldown(ctx, t._id, "PRICE_BELOW_TARGET"))
      ) {
        await ctx.runMutation(internal.alerts._insert, {
          userId: t.userId,
          itemId,
          trackedItemId: t._id,
          type: "PRICE_BELOW_TARGET",
          payload: {
            priceCents: latestStock.minPriceCents,
            targetPriceCents: t.targetPriceCents,
            currency: latestStock.currency,
          },
        });
      }

      // PRICE_ABOVE_SELL_TARGET — anchored on the qty-avg ask, which is
      // the "going rate" the user could realistically sell at.
      if (
        t.sellTargetPriceCents !== undefined &&
        latestStock &&
        latestStock.qtyAvgPriceCents > 0 &&
        latestStock.qtyAvgPriceCents >= t.sellTargetPriceCents &&
        (await passesCooldown(ctx, t._id, "PRICE_ABOVE_SELL_TARGET"))
      ) {
        await ctx.runMutation(internal.alerts._insert, {
          userId: t.userId,
          itemId,
          trackedItemId: t._id,
          type: "PRICE_ABOVE_SELL_TARGET",
          payload: {
            priceCents: latestStock.qtyAvgPriceCents,
            targetPriceCents: t.sellTargetPriceCents,
            currency: latestStock.currency,
          },
        });
      }

      // LISTING_COUNT_DROP / NEW_LISTING_SPIKE — need ≥14 days of stock data
      const stockSeries = snapshots
        .filter((s) => s.guideType === "stock" && s.condition === preferredCondition)
        .sort((a, b) => a.date - b.date);
      if (stockSeries.length >= 14) {
        const recent = stockSeries.slice(-7);
        const prior = stockSeries.slice(-14, -7);
        const recentAvg = avgListing(recent);
        const priorAvg = avgListing(prior);
        if (priorAvg > 0) {
          const ratio = recentAvg / priorAvg;
          if (
            ratio <= 0.6 &&
            (await passesCooldown(ctx, t._id, "LISTING_COUNT_DROP"))
          ) {
            await ctx.runMutation(internal.alerts._insert, {
              userId: t.userId,
              itemId,
              trackedItemId: t._id,
              type: "LISTING_COUNT_DROP",
              payload: {
                listingsBefore: Math.round(priorAvg),
                listingsAfter: Math.round(recentAvg),
                changePct: Math.round((ratio - 1) * 100),
              },
            });
          }
          if (
            ratio >= 2 &&
            (await passesCooldown(ctx, t._id, "NEW_LISTING_SPIKE"))
          ) {
            await ctx.runMutation(internal.alerts._insert, {
              userId: t.userId,
              itemId,
              trackedItemId: t._id,
              type: "NEW_LISTING_SPIKE",
              payload: {
                listingsBefore: Math.round(priorAvg),
                listingsAfter: Math.round(recentAvg),
                changePct: Math.round((ratio - 1) * 100),
              },
            });
          }
        }
      }

      // VERDICT_TRANSITION
      if (
        latestScore &&
        prevScore &&
        latestScore.verdict !== prevScore.verdict &&
        NOTABLE_VERDICTS.has(latestScore.verdict)
      ) {
        const last = await ctx.runQuery(internal.alerts._lastAlertOf, {
          trackedItemId: t._id,
          type: "VERDICT_TRANSITION",
        });
        // Only fire once per (from, to) transition.
        const alreadyFiredSame =
          last &&
          last.payload.verdictFrom === prevScore.verdict &&
          last.payload.verdictTo === latestScore.verdict;
        if (!alreadyFiredSame) {
          await ctx.runMutation(internal.alerts._insert, {
            userId: t.userId,
            itemId,
            trackedItemId: t._id,
            type: "VERDICT_TRANSITION",
            payload: {
              verdictFrom: prevScore.verdict,
              verdictTo: latestScore.verdict,
            },
          });
        }
      }
    }
  },
});

export const dispatchEmails = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log(
        "Skipping alert email dispatch — RESEND_API_KEY not set on the Convex deployment.",
      );
      return;
    }
    const pending = await ctx.runQuery(internal.alerts._pendingEmails);
    const fromAddress = process.env.RESEND_FROM ?? "Whatabrick <onboarding@resend.dev>";
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    for (const { alert, user, item } of pending) {
      if (!user || !item) continue;
      if (user.alertChannel !== "email") {
        // Mark as "emailed" so we don't keep re-querying it.
        await ctx.runMutation(internal.alerts._markEmailed, { id: alert._id });
        continue;
      }
      try {
        const { subject, html } = renderAlertEmail({
          alert,
          item,
          deepLink: `${appUrl}/items/${item._id}`,
        });
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: user.email,
            subject,
            html,
          }),
        });
        if (!res.ok) {
          console.warn(
            `Resend ${res.status} for alert ${alert._id}: ${await res.text()}`,
          );
          continue;
        }
        await ctx.runMutation(internal.alerts._markEmailed, { id: alert._id });
      } catch (err) {
        console.warn(
          "Alert email failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  },
});

async function passesCooldown(
  ctx: ActionCtx,
  trackedItemId: Id<"trackedItems">,
  type: AlertType,
): Promise<boolean> {
  const cooldown = COOLDOWN_MS[type];
  if (cooldown === 0) return true;
  const last = await ctx.runQuery(internal.alerts._lastAlertOf, {
    trackedItemId,
    type,
  });
  if (!last) return true;
  return Date.now() - last.triggeredAt >= cooldown;
}

function avgListing(snaps: { activeListingCount?: number }[]): number {
  const counts = snaps
    .map((s) => s.activeListingCount ?? 0)
    .filter((n) => n > 0);
  if (counts.length === 0) return 0;
  return counts.reduce((a, b) => a + b, 0) / counts.length;
}

function renderAlertEmail({
  alert,
  item,
  deepLink,
}: {
  alert: { type: AlertType; payload: AlertPayload };
  item: { name: string; imageUrl?: string };
  deepLink: string;
}): { subject: string; html: string } {
  const subjectPrefix = "Whatabrick:";
  const subject = (() => {
    switch (alert.type) {
      case "PRICE_BELOW_TARGET":
        return `${subjectPrefix} price drop on ${item.name}`;
      case "PRICE_ABOVE_SELL_TARGET":
        return `${subjectPrefix} ${item.name} hit your sell target`;
      case "LISTING_COUNT_DROP":
        return `${subjectPrefix} ${item.name} is getting harder to find`;
      case "NEW_LISTING_SPIKE":
        return `${subjectPrefix} more listings appeared for ${item.name}`;
      case "VERDICT_TRANSITION":
        return `${subjectPrefix} verdict changed for ${item.name}`;
    }
  })();

  const body = renderAlertBody(alert);
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#010102;color:#f7f8f8;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#010102;padding:32px 16px;">
      <tr><td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#0f1011;border:1px solid #23252a;border-radius:12px;padding:24px;">
          <tr><td>
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.4px;text-transform:uppercase;color:#8a8f98;">${labelFor(alert.type)}</p>
            <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-0.4px;color:#f7f8f8;">${escapeHtml(item.name)}</h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#d0d6e0;">${body}</p>
            <a href="${deepLink}" style="display:inline-block;background:#5e6ad2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:8px;">Open in Whatabrick</a>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#62666d;">You're receiving this because you tracked this item on Whatabrick.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

function renderAlertBody(alert: { type: AlertType; payload: AlertPayload }) {
  const p = alert.payload;
  const fmt = (cents?: number, currency = "EUR") =>
    cents !== undefined ? `${currency} ${(cents / 100).toFixed(2)}` : "n/a";
  switch (alert.type) {
    case "PRICE_BELOW_TARGET":
      return `Lowest asking price dropped to <strong>${fmt(p.priceCents, p.currency)}</strong> — below your target of ${fmt(p.targetPriceCents, p.currency)}.`;
    case "PRICE_ABOVE_SELL_TARGET":
      return `The going rate climbed to <strong>${fmt(p.priceCents, p.currency)}</strong> — at or above your sell target of ${fmt(p.targetPriceCents, p.currency)}.`;
    case "LISTING_COUNT_DROP":
      return `Active listings fell from <strong>${p.listingsBefore ?? 0}</strong> to <strong>${p.listingsAfter ?? 0}</strong> (${p.changePct ?? 0}%) over the past two weeks. Supply is tightening.`;
    case "NEW_LISTING_SPIKE":
      return `Active listings jumped from <strong>${p.listingsBefore ?? 0}</strong> to <strong>${p.listingsAfter ?? 0}</strong> (+${p.changePct ?? 0}%). Possible reissue or new availability.`;
    case "VERDICT_TRANSITION":
      return `Verdict shifted from <strong>${escapeHtml(p.verdictFrom ?? "?")}</strong> to <strong>${escapeHtml(p.verdictTo ?? "?")}</strong>.`;
  }
}

function labelFor(type: AlertType): string {
  switch (type) {
    case "PRICE_BELOW_TARGET":
      return "Price drop";
    case "PRICE_ABOVE_SELL_TARGET":
      return "Sell target hit";
    case "LISTING_COUNT_DROP":
      return "Becoming harder to find";
    case "NEW_LISTING_SPIKE":
      return "New listings appeared";
    case "VERDICT_TRANSITION":
      return "Verdict changed";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type AlertPayload = {
  priceCents?: number;
  currency?: string;
  targetPriceCents?: number;
  listingsBefore?: number;
  listingsAfter?: number;
  changePct?: number;
  verdictFrom?: string;
  verdictTo?: string;
};
