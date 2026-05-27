"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { anthropic, MODEL } from "./lib/anthropic";
import {
  computeAllScores,
  confidenceFromHistory,
  targetPriceCents as computeTargetPrice,
  type SnapshotPoint,
} from "./lib/scoring";
import {
  pickVerdict,
  VERDICT_BLURB,
  VERDICT_LABEL,
  type Verdict,
} from "./lib/verdict";

const DAY_MS = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are the verdict explainer inside the Whatabrick app — an AI LEGO collectible radar that helps beginner-to-mid collectors decide whether to buy, watch, or skip a specific LEGO item.

Whatabrick computes five deterministic scores from BrickLink price-guide history:
- scarcityScore  — supply shrinking / regional thinness (higher = scarcer)
- demandScore    — recent sold volume / liquidity (higher = busier market)
- exclusivityScore — uniqueness of parts / reissue risk (higher = more exclusive)
- momentumScore  — price slope over time (50 neutral; > 50 rising, < 50 falling)
- riskScore      — penalty for low volume, wide ask spread, reissue likely

And a final verdict from this fixed set:
- IGNORE            common, flat, skip
- WATCH             not enough signal yet
- GOOD_BELOW_TARGET asking is at or below the fair-buy target
- INTERESTING_RISKY scarce + rising but risky
- SCARCE_OVERPRICED genuinely scarce but currently overpriced
- STRONG_SIGNAL     scarce, rising, risk contained
- AVOID_HYPE        rising on weak sold volume (likely seller-driven hype)

Your job: justify the *given* verdict in 2–4 sentences for a beginner collector. Reference the actual numeric inputs the caller passes you. Do not recommend a different action than the given verdict. Do not invent prices. End with a concrete next step ("Add an alert under €X", "Wait until sold volume picks up", "Skip — not unique enough").

You MUST respond by calling \`emit_explanation\` exactly once. No prose outside the tool call.`;

export const refreshItem = internalAction({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.runQuery(internal.items._get, { itemId });
    if (!item) return;

    // Pull last 90 days of snapshots for the item.
    const since = Date.now() - 90 * DAY_MS;
    const snapshots = await ctx.runQuery(
      internal.signalScores._snapshotsForItem,
      { itemId, sinceMs: since },
    );

    // Default to the most-popular condition in the data; for MVP we anchor
    // the verdict on the SEALED/new variant since that's the buy-the-box case.
    const stockN = filterSnaps(snapshots, "stock", "N");
    const soldN = filterSnaps(snapshots, "sold", "N");

    const confidence = confidenceFromHistory(stockN, soldN);
    const scores = computeAllScores(stockN, soldN, {
      uniqueParts: item.uniqueParts,
      reissueRisk: item.reissueRisk,
    });

    const latestStockN = stockN[stockN.length - 1];
    const currentPriceCents = latestStockN?.qtyAvgPriceCents ?? null;
    const targetPriceCents = computeTargetPrice(soldN);
    const currency = latestStockN ? snapshotCurrency(snapshots) : undefined;

    const verdict: Verdict = pickVerdict({
      scores,
      confidence,
      currentPriceCents,
      targetPriceCents,
    });

    const today = startOfUtcDay(Date.now());
    const region = "GLOBAL";

    // For low-confidence verdicts skip the Claude call — the template suffices
    // and Claude can't say anything useful when there's no data yet.
    if (confidence === "LOW") {
      await ctx.runMutation(internal.signalScores._upsert, {
        itemId,
        region,
        date: today,
        ...scores,
        confidence,
        verdict,
        targetPriceCents: targetPriceCents ?? undefined,
        currentPriceCents: currentPriceCents ?? undefined,
        currency,
        explanation: `Not enough BrickLink history yet (${stockN.length} sealed-stock day${stockN.length === 1 ? "" : "s"}). Verdict will sharpen as Whatabrick collects daily snapshots.`,
      });
      return;
    }

    // Otherwise ask Claude to justify the deterministic verdict.
    let explanation = VERDICT_BLURB[verdict];
    try {
      const client = anthropic();
      const response = await client.messages.create({
        model: MODEL.sonnet,
        max_tokens: 512,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            name: "emit_explanation",
            description:
              "Emit a 2-4 sentence justification for the given verdict.",
            input_schema: {
              type: "object",
              required: ["text"],
              properties: { text: { type: "string" } },
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_explanation" },
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              item: {
                name: item.name,
                type: item.rebrickableType,
                theme: item.theme,
                year: item.releaseYear,
              },
              verdict,
              verdictLabel: VERDICT_LABEL[verdict],
              confidence,
              scores,
              currentPriceCents,
              targetPriceCents,
              currency,
              latestStock: latestStockN
                ? {
                    listingCount: latestStockN.listingCount,
                    qtyAvgPriceCents: latestStockN.qtyAvgPriceCents,
                    minPriceCents: latestStockN.minPriceCents,
                  }
                : null,
              soldDaysCount: soldN.length,
            }),
          },
        ],
      });
      const toolUse = response.content.find(
        (block): block is Extract<typeof block, { type: "tool_use" }> =>
          block.type === "tool_use",
      );
      if (toolUse) {
        const out = toolUse.input as { text: string };
        if (out.text && out.text.trim().length > 0) {
          explanation = out.text.trim();
        }
      }
    } catch (err) {
      console.warn(
        "Verdict explanation Claude call failed; falling back to template:",
        err instanceof Error ? err.message : err,
      );
    }

    await ctx.runMutation(internal.signalScores._upsert, {
      itemId,
      region,
      date: today,
      ...scores,
      confidence,
      verdict,
      targetPriceCents: targetPriceCents ?? undefined,
      currentPriceCents: currentPriceCents ?? undefined,
      currency,
      explanation,
    });

    // Chain alert evaluation now that snapshots + score are fresh.
    await ctx.scheduler.runAfter(
      0,
      internal.alertsActions.evaluateForItem,
      { itemId },
    );
  },
});

export const refreshAllTracked = internalAction({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.runQuery(internal.marketSnapshots._allTrackedItems);
    let offset = 0;
    for (const item of items) {
      await ctx.scheduler.runAfter(
        offset,
        internal.signalScoresActions.refreshItem,
        { itemId: item._id },
      );
      // Spread Claude calls — Sonnet at our usage cap is fine at ~3/s.
      offset += 500;
    }
  },
});

function filterSnaps(
  snapshots: SnapshotInput[],
  guideType: "stock" | "sold",
  condition: "N" | "U",
): SnapshotPoint[] {
  return snapshots
    .filter((s) => s.guideType === guideType && s.condition === condition)
    .sort((a, b) => a.date - b.date)
    .map((s) => ({
      date: s.date,
      qtyAvgPriceCents: s.qtyAvgPriceCents,
      minPriceCents: s.minPriceCents,
      listingCount: s.activeListingCount,
      totalQuantity: s.totalQuantity,
    }));
}

function snapshotCurrency(snapshots: SnapshotInput[]): string | undefined {
  return snapshots[snapshots.length - 1]?.currency;
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

type SnapshotInput = {
  date: number;
  guideType: "stock" | "sold";
  condition: "N" | "U";
  qtyAvgPriceCents: number;
  minPriceCents: number;
  activeListingCount?: number;
  totalQuantity?: number;
  currency: string;
};
