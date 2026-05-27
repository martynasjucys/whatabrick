"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { anthropic, MODEL } from "./lib/anthropic";
import {
  bucketHarderToFind,
  bucketHype,
  bucketNewlyTracked,
  bucketUnderTarget,
  bucketVerdictUpgrades,
  startOfUtcWeek,
  type ItemLite,
  type ScoreLite,
  type Section,
  type SnapshotLite,
  type TrackedLite,
} from "./lib/digest";

const SYSTEM_PROMPT = `You are the weekly-digest opener inside Whatabrick — an AI LEGO collectible radar.

Each Monday Whatabrick sends every active user a short summary of what happened across their tracked items in the last 7 days. Buckets sometimes shown:
- Becoming harder to find
- Watched items dropped below target
- Suspicious hype this week
- New items you started tracking
- Verdict upgrades

Your job: open the email with a 1-2 sentence intro (≤ 40 words total) that previews what's in this user's digest. Be specific where possible — reference the dominant theme or the biggest single signal — but never invent numbers. If the week was quiet, say so plainly.

You MUST respond by calling \`emit_intro\` exactly once. No prose outside the tool call.`;

export const generateForUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(internal.weeklyDigest._userById, { userId });
    if (!user) return;

    const now = Date.now();
    const weekStart = startOfUtcWeek(now);
    const sinceMs = now - 14 * 24 * 60 * 60 * 1000; // 14d window for "harder to find"

    const tracked = await ctx.runQuery(internal.weeklyDigest._trackedForUser, {
      userId,
    });
    if (tracked.length === 0) return;

    const itemIds = [...new Set(tracked.map((t) => t.itemId))] as Id<"items">[];
    const [items, snapshots, scores, alerts] = await Promise.all([
      ctx.runQuery(internal.weeklyDigest._itemsByIds, { itemIds }),
      ctx.runQuery(internal.weeklyDigest._snapshotsForItems, {
        itemIds,
        sinceMs,
      }),
      ctx.runQuery(internal.weeklyDigest._scoresForItems, {
        itemIds,
        sinceMs,
      }),
      ctx.runQuery(internal.weeklyDigest._alertsForUser, {
        userId,
        sinceMs: now - 7 * 24 * 60 * 60 * 1000,
      }),
    ]);

    // Group helpers
    const trackedByItem = new Map<string, TrackedLite[]>();
    for (const t of tracked) {
      const id = t.itemId as string;
      const list = trackedByItem.get(id) ?? [];
      list.push({
        _id: t._id as string,
        itemId: id,
        addedAt: t.addedAt,
        targetPriceCents: t.targetPriceCents,
        preferredCondition: t.preferredCondition,
      });
      trackedByItem.set(id, list);
    }

    const scoresByItem = new Map<string, ScoreLite[]>();
    for (const s of scores) {
      const id = s.itemId as string;
      const list = scoresByItem.get(id) ?? [];
      list.push({
        _creationTime: s._creationTime,
        date: s.date,
        verdict: s.verdict,
        currentPriceCents: s.currentPriceCents,
        targetPriceCents: s.targetPriceCents,
        currency: s.currency,
      });
      scoresByItem.set(id, list);
    }

    const itemsLite: ItemLite[] = items.map((i) => ({
      _id: i._id as string,
      name: i.name,
      imageUrl: i.imageUrl,
      theme: i.theme,
    }));
    const snapshotsLite: (SnapshotLite & { itemId: string })[] = snapshots.map(
      (s) => ({
        itemId: s.itemId as string,
        date: s.date,
        guideType: s.guideType,
        condition: s.condition,
        activeListingCount: s.activeListingCount,
        qtyAvgPriceCents: s.qtyAvgPriceCents,
      }),
    );

    const sections: Section[] = [];
    const harder = bucketHarderToFind(
      snapshotsLite,
      trackedByItem,
      itemsLite,
      now,
    );
    if (harder) sections.push(harder);
    const underTarget = bucketUnderTarget(
      alerts.map((a) => ({
        type: a.type,
        itemId: a.itemId as string,
        triggeredAt: a.triggeredAt,
        payload: a.payload,
      })),
      itemsLite,
      now,
    );
    if (underTarget) sections.push(underTarget);
    const hype = bucketHype(scoresByItem, itemsLite, now);
    if (hype) sections.push(hype);
    const upgrades = bucketVerdictUpgrades(scoresByItem, itemsLite, now);
    if (upgrades) sections.push(upgrades);
    const newlyTracked = bucketNewlyTracked(
      tracked.map((t) => ({
        _id: t._id as string,
        itemId: t.itemId as string,
        addedAt: t.addedAt,
        targetPriceCents: t.targetPriceCents,
        preferredCondition: t.preferredCondition,
      })),
      itemsLite,
      now,
    );
    if (newlyTracked) sections.push(newlyTracked);

    // Top theme = most-tracked theme across the user's items
    const themeCounts = new Map<string, number>();
    for (const it of itemsLite) {
      const theme = it.theme;
      if (theme) themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }
    const topTheme =
      [...themeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const intro = await composeIntro({
      sectionTitlesAndCounts: sections.map((s) => ({
        title: s.title,
        count: s.items.length,
      })),
      trackedCount: itemIds.length,
      topTheme,
    });

    // Persist with the right item ids (typed as Id<"items">)
    const persistedSections = sections.map((s) => ({
      title: s.title,
      items: s.items.map((i) => ({
        ...i,
        itemId: i.itemId as unknown as Id<"items">,
      })),
    }));

    const sentAt = await sendDigestEmail({
      to: user.email,
      userId,
      intro,
      sections,
    });

    await ctx.runMutation(internal.weeklyDigest._upsertDigest, {
      userId,
      weekStart,
      content: { intro, sections: persistedSections },
      sentAt: sentAt ?? undefined,
    });
  },
});

export const runWeekly = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.weeklyDigest._allEnabledUsers);
    let offset = 0;
    for (const u of users) {
      await ctx.scheduler.runAfter(
        offset,
        internal.weeklyDigestActions.generateForUser,
        { userId: u._id },
      );
      offset += 1000; // 1 req/s spacing across users (Resend free-tier safe)
    }
  },
});

async function composeIntro(input: {
  sectionTitlesAndCounts: { title: string; count: number }[];
  trackedCount: number;
  topTheme: string | null;
}): Promise<string> {
  // Skip the Claude call when there's nothing of substance to summarize.
  if (input.sectionTitlesAndCounts.length === 0) {
    return `Quiet week — your ${input.trackedCount} tracked ${input.trackedCount === 1 ? "item" : "items"} ${input.trackedCount === 1 ? "is" : "are"} stable.`;
  }
  try {
    const client = anthropic();
    const response = await client.messages.create({
      model: MODEL.sonnet,
      max_tokens: 200,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: "emit_intro",
          description: "Emit the 1-2 sentence weekly-digest intro.",
          input_schema: {
            type: "object",
            required: ["text"],
            properties: { text: { type: "string" } },
          },
        },
      ],
      tool_choice: { type: "tool", name: "emit_intro" },
      messages: [
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    });
    const toolUse = response.content.find(
      (block): block is Extract<typeof block, { type: "tool_use" }> =>
        block.type === "tool_use",
    );
    if (toolUse) {
      const text = (toolUse.input as { text: string }).text?.trim();
      if (text) return text;
    }
  } catch (err) {
    console.warn(
      "Digest intro Claude call failed, falling back:",
      err instanceof Error ? err.message : err,
    );
  }
  const counts = input.sectionTitlesAndCounts
    .map((s) => `${s.count} ${s.title.toLowerCase()}`)
    .join(", ");
  return `This week across your ${input.trackedCount} tracked items: ${counts}.`;
}

async function sendDigestEmail(opts: {
  to: string;
  userId: Id<"users">;
  intro: string;
  sections: Section[];
}): Promise<number | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      "Skipping digest email — RESEND_API_KEY not set on the Convex deployment.",
    );
    return null;
  }
  const fromAddress =
    process.env.RESEND_FROM ?? "Whatabrick <onboarding@resend.dev>";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  const unsubLink = convexSiteUrl
    ? `${convexSiteUrl}/unsubscribe?t=${await buildUnsubscribeToken(opts.userId)}`
    : `${appUrl}/settings`;

  const html = renderDigestHtml({
    intro: opts.intro,
    sections: opts.sections,
    appUrl,
    unsubLink,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: opts.to,
        subject: "Your Whatabrick week",
        html,
      }),
    });
    if (!res.ok) {
      console.warn(`Resend ${res.status}: ${await res.text()}`);
      return null;
    }
    return Date.now();
  } catch (err) {
    console.warn(
      "Digest email failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function buildUnsubscribeToken(userId: Id<"users">): Promise<string> {
  const secret = process.env.UNSUBSCRIBE_SIGNING_SECRET;
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(userId as string),
  );
  const sigB64 = base64UrlEncode(new Uint8Array(sig));
  return `${userId as string}.${sigB64}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function renderDigestHtml(opts: {
  intro: string;
  sections: Section[];
  appUrl: string;
  unsubLink: string;
}): string {
  const sectionsHtml = opts.sections
    .map(
      (s) => `
        <h2 style="margin:28px 0 12px;font-size:16px;font-weight:600;letter-spacing:-0.2px;color:#f7f8f8;">${escapeHtml(s.title)}</h2>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${s.items
            .map(
              (it) => `
              <tr><td style="padding:8px 0;border-bottom:1px solid #23252a;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="48" style="padding-right:12px;vertical-align:middle;">
                      ${
                        it.imageUrl
                          ? `<img src="${escapeHtml(it.imageUrl)}" alt="" width="40" height="40" style="display:block;background:#141516;border-radius:6px;" />`
                          : `<div style="width:40px;height:40px;background:#141516;border-radius:6px;"></div>`
                      }
                    </td>
                    <td style="vertical-align:middle;">
                      <a href="${opts.appUrl}/items/${it.itemId}" style="color:#f7f8f8;text-decoration:none;font-size:14px;font-weight:500;">${escapeHtml(it.headline)}</a>
                      <div style="margin-top:2px;color:#8a8f98;font-size:12px;">${escapeHtml(it.bodySm)}</div>
                    </td>
                  </tr>
                </table>
              </td></tr>`,
            )
            .join("")}
        </table>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#010102;color:#f7f8f8;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#010102;padding:32px 16px;">
      <tr><td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#0f1011;border:1px solid #23252a;border-radius:12px;padding:28px;">
          <tr><td>
            <p style="margin:0 0 6px;font-size:13px;letter-spacing:0.4px;text-transform:uppercase;color:#8a8f98;">Your Whatabrick week</p>
            <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;letter-spacing:-0.4px;color:#f7f8f8;">Weekly digest</h1>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#d0d6e0;">${escapeHtml(opts.intro)}</p>
            ${sectionsHtml || `<p style="margin:24px 0 0;color:#8a8f98;font-size:13px;">Nothing notable shifted across your tracked items this week.</p>`}
            <p style="margin:28px 0 0;">
              <a href="${opts.appUrl}/dashboard" style="display:inline-block;background:#5e6ad2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:8px;">Open Whatabrick</a>
            </p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#62666d;">
          <a href="${opts.unsubLink}" style="color:#62666d;text-decoration:underline;">Unsubscribe</a> or
          <a href="${opts.appUrl}/settings" style="color:#62666d;text-decoration:underline;">manage preferences</a>.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
