import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";

const regionValidator = v.union(
  v.literal("EU"),
  v.literal("UK"),
  v.literal("US"),
  v.literal("GLOBAL"),
);

const alertPrefsValidator = v.object({
  priceMovement: v.boolean(),
  scarcity: v.boolean(),
  newListing: v.boolean(),
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

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];
    return await ctx.db
      .query("radars")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("radars") },
  handler: async (ctx, { id }) => {
    const radar = await ctx.db.get(id);
    if (!radar) return null;
    const user = await requireUser(ctx);
    if (radar.userId !== user._id) throw new Error("Forbidden");
    return radar;
  },
});

export const create = mutation({
  args: { freeformQuery: v.string() },
  handler: async (ctx, { freeformQuery }) => {
    const trimmed = freeformQuery.trim();
    if (trimmed.length < 3) throw new Error("Describe your niche in a few words");

    const user = await requireUser(ctx);
    const fallbackTitle = trimmed.slice(0, 60);
    const fallbackRegion = user.region === "OTHER" ? "GLOBAL" : user.region;

    const id = await ctx.db.insert("radars", {
      userId: user._id,
      title: fallbackTitle || "New radar",
      freeformQuery: trimmed,
      niche: "other",
      region: fallbackRegion,
      seedQueries: [],
      alertPrefs: { priceMovement: true, scarcity: true, newListing: true },
      expansionStatus: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.radarsActions.expandWithAi, {
      radarId: id,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("radars"),
    title: v.optional(v.string()),
    region: v.optional(regionValidator),
    alertPrefs: v.optional(alertPrefsValidator),
  },
  handler: async (ctx, { id, title, region, alertPrefs }) => {
    const radar = await ctx.db.get(id);
    if (!radar) throw new Error("Not found");
    const user = await requireUser(ctx);
    if (radar.userId !== user._id) throw new Error("Forbidden");

    const patch: Partial<{
      title: string;
      region: "EU" | "UK" | "US" | "GLOBAL";
      alertPrefs: typeof radar.alertPrefs;
    }> = {};
    if (title !== undefined) patch.title = title.trim() || radar.title;
    if (region !== undefined) patch.region = region;
    if (alertPrefs !== undefined) patch.alertPrefs = alertPrefs;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("radars") },
  handler: async (ctx, { id }) => {
    const radar = await ctx.db.get(id);
    if (!radar) return;
    const user = await requireUser(ctx);
    if (radar.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.delete(id);
  },
});

export const retryExpansion = mutation({
  args: { id: v.id("radars") },
  handler: async (ctx, { id }) => {
    const radar = await ctx.db.get(id);
    if (!radar) throw new Error("Not found");
    const user = await requireUser(ctx);
    if (radar.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.patch(id, {
      expansionStatus: "pending",
      expansionError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.radarsActions.expandWithAi, {
      radarId: id,
    });
  },
});

export const _getInternal = internalQuery({
  args: { radarId: v.id("radars") },
  handler: async (ctx, { radarId }) => {
    return await ctx.db.get(radarId);
  },
});

export const _applyExpansion = internalMutation({
  args: {
    radarId: v.id("radars"),
    fields: v.object({
      title: v.string(),
      niche: v.string(),
      theme: v.optional(v.string()),
      productType: v.optional(v.string()),
      region: regionValidator,
      seedQueries: v.array(v.string()),
    }),
  },
  handler: async (ctx, { radarId, fields }) => {
    await ctx.db.patch(radarId, {
      ...fields,
      expansionStatus: "ready",
      expansionError: undefined,
    });
  },
});

export const _markFailed = internalMutation({
  args: { radarId: v.id("radars"), error: v.string() },
  handler: async (ctx, { radarId, error }) => {
    await ctx.db.patch(radarId, {
      expansionStatus: "failed",
      expansionError: error,
    });
  },
});
