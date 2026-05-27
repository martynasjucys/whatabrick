import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";

const rebrickableTypeValidator = v.union(
  v.literal("minifig"),
  v.literal("part"),
  v.literal("set"),
);

const candidateValidator = v.object({
  rebrickableType: rebrickableTypeValidator,
  rebrickableId: v.string(),
  brickLinkId: v.optional(v.string()),
  name: v.string(),
  imageUrl: v.optional(v.string()),
  releaseYear: v.optional(v.number()),
});

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

export const listForRadar = query({
  args: { radarId: v.id("radars") },
  handler: async (ctx, { radarId }) => {
    const radar = await ctx.db.get(radarId);
    if (!radar) return [];
    const user = await requireUser(ctx);
    if (radar.userId !== user._id) throw new Error("Forbidden");

    const tracked = await ctx.db
      .query("trackedItems")
      .withIndex("by_radar", (q) => q.eq("radarId", radarId))
      .order("desc")
      .collect();

    return await Promise.all(
      tracked.map(async (t) => {
        const item = await ctx.db.get(t.itemId);
        return { tracked: t, item };
      }),
    );
  },
});

export const get = query({
  args: { id: v.id("items") },
  handler: async (ctx, { id }) => {
    const item = await ctx.db.get(id);
    if (!item) return null;
    await requireUser(ctx);
    const tracked = await ctx.db
      .query("trackedItems")
      .withIndex("by_item", (q) => q.eq("itemId", id))
      .collect();
    return { item, trackedCount: tracked.length };
  },
});

export const addTrackedItem = mutation({
  args: {
    radarId: v.id("radars"),
    candidate: candidateValidator,
  },
  handler: async (ctx, { radarId, candidate }) => {
    const radar = await ctx.db.get(radarId);
    if (!radar) throw new Error("Radar not found");
    const user = await requireUser(ctx);
    if (radar.userId !== user._id) throw new Error("Forbidden");

    const existingItem = await ctx.db
      .query("items")
      .withIndex("by_rebrickable", (q) =>
        q
          .eq("rebrickableType", candidate.rebrickableType)
          .eq("rebrickableId", candidate.rebrickableId),
      )
      .unique();

    let itemId;
    if (existingItem) {
      itemId = existingItem._id;
      // If we now know a brickLinkId and the existing row doesn't, fill it in.
      if (candidate.brickLinkId && !existingItem.brickLinkId) {
        await ctx.db.patch(itemId, { brickLinkId: candidate.brickLinkId });
      }
    } else {
      itemId = await ctx.db.insert("items", {
        rebrickableType: candidate.rebrickableType,
        rebrickableId: candidate.rebrickableId,
        brickLinkId: candidate.brickLinkId,
        name: candidate.name,
        imageUrl: candidate.imageUrl,
        releaseYear: candidate.releaseYear,
      });
    }

    const existingTracked = await ctx.db
      .query("trackedItems")
      .withIndex("by_radar_item", (q) =>
        q.eq("radarId", radarId).eq("itemId", itemId),
      )
      .unique();
    if (existingTracked) return existingTracked._id;

    const trackedId = await ctx.db.insert("trackedItems", {
      radarId,
      itemId,
      userId: user._id,
      addedAt: Date.now(),
    });

    // Kick off the first BrickLink snapshot so the chart has a starting point.
    await ctx.scheduler.runAfter(
      0,
      internal.marketSnapshotsActions.refreshItem,
      { itemId, region: radar.region },
    );

    return trackedId;
  },
});

export const removeTrackedItem = mutation({
  args: { id: v.id("trackedItems") },
  handler: async (ctx, { id }) => {
    const tracked = await ctx.db.get(id);
    if (!tracked) return;
    const user = await requireUser(ctx);
    if (tracked.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.delete(id);
  },
});

export const updateNotes = mutation({
  args: { id: v.id("trackedItems"), notes: v.string() },
  handler: async (ctx, { id, notes }) => {
    const tracked = await ctx.db.get(id);
    if (!tracked) throw new Error("Not found");
    const user = await requireUser(ctx);
    if (tracked.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.patch(id, { notes });
  },
});

// Internal helpers used by future features (market tracking, verdicts).
export const _get = internalQuery({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    return await ctx.db.get(itemId);
  },
});

export const _listTrackedFor = internalQuery({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    return await ctx.db
      .query("trackedItems")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .collect();
  },
});

export const _patchMetadata = internalMutation({
  args: {
    itemId: v.id("items"),
    fields: v.object({
      brickLinkId: v.optional(v.string()),
      theme: v.optional(v.string()),
      releaseYear: v.optional(v.number()),
      uniqueParts: v.optional(v.array(v.string())),
      reissueRisk: v.optional(
        v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      ),
      bricklinkStatus: v.optional(
        v.union(v.literal("priced"), v.literal("unpriced")),
      ),
      bricklinkLastError: v.optional(v.string()),
      lastBrickLinkSyncAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { itemId, fields }) => {
    const cleaned: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) cleaned[k] = val;
    }
    if (Object.keys(cleaned).length > 0) {
      await ctx.db.patch(itemId, cleaned);
    }
  },
});
