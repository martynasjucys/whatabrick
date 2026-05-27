import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
  type QueryCtx,
} from "./_generated/server";

const verdictValidator = v.union(
  v.literal("IGNORE"),
  v.literal("WATCH"),
  v.literal("GOOD_BELOW_TARGET"),
  v.literal("INTERESTING_RISKY"),
  v.literal("SCARCE_OVERPRICED"),
  v.literal("STRONG_SIGNAL"),
  v.literal("AVOID_HYPE"),
);

const confidenceValidator = v.union(
  v.literal("LOW"),
  v.literal("MEDIUM"),
  v.literal("HIGH"),
);

async function requireUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not signed in");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) throw new Error("User row missing — sign out and back in");
  return user;
}

export const latest = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    await requireUser(ctx);
    return await ctx.db
      .query("signalScores")
      .withIndex("by_item_date", (q) => q.eq("itemId", itemId))
      .order("desc")
      .first();
  },
});

export const latestForItems = query({
  args: { itemIds: v.array(v.id("items")) },
  handler: async (ctx, { itemIds }) => {
    await requireUser(ctx);
    const results = await Promise.all(
      itemIds.map((id) =>
        ctx.db
          .query("signalScores")
          .withIndex("by_item_date", (q) => q.eq("itemId", id))
          .order("desc")
          .first(),
      ),
    );
    const map: Record<string, (typeof results)[number]> = {};
    itemIds.forEach((id, i) => {
      map[id] = results[i];
    });
    return map;
  },
});

export const _latestInternal = internalQuery({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    return await ctx.db
      .query("signalScores")
      .withIndex("by_item_date", (q) => q.eq("itemId", itemId))
      .order("desc")
      .first();
  },
});

export const _previousScore = internalQuery({
  args: { itemId: v.id("items"), beforeMs: v.number() },
  handler: async (ctx, { itemId, beforeMs }) => {
    return await ctx.db
      .query("signalScores")
      .withIndex("by_item_date", (q) =>
        q.eq("itemId", itemId).lt("date", beforeMs),
      )
      .order("desc")
      .first();
  },
});

export const _snapshotsForItem = internalQuery({
  args: { itemId: v.id("items"), sinceMs: v.number() },
  handler: async (ctx, { itemId, sinceMs }) => {
    return await ctx.db
      .query("marketSnapshots")
      .withIndex("by_item_date", (q) =>
        q.eq("itemId", itemId).gte("date", sinceMs),
      )
      .collect();
  },
});

export const _upsert = internalMutation({
  args: {
    itemId: v.id("items"),
    region: v.string(),
    date: v.number(),
    scarcityScore: v.number(),
    demandScore: v.number(),
    exclusivityScore: v.number(),
    momentumScore: v.number(),
    riskScore: v.number(),
    confidence: confidenceValidator,
    verdict: verdictValidator,
    targetPriceCents: v.optional(v.number()),
    currentPriceCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    explanation: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("signalScores")
      .withIndex("by_item_date", (q) =>
        q.eq("itemId", args.itemId).eq("date", args.date),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        region: args.region,
        scarcityScore: args.scarcityScore,
        demandScore: args.demandScore,
        exclusivityScore: args.exclusivityScore,
        momentumScore: args.momentumScore,
        riskScore: args.riskScore,
        confidence: args.confidence,
        verdict: args.verdict,
        targetPriceCents: args.targetPriceCents,
        currentPriceCents: args.currentPriceCents,
        currency: args.currency,
        explanation: args.explanation,
      });
      return existing._id;
    }
    return await ctx.db.insert("signalScores", args);
  },
});
