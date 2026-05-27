import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";

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
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;
    return await ctx.db
      .query("weeklyDigests")
      .withIndex("by_user_week", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
  },
});

export const updateMe = mutation({
  args: {
    weeklyDigestEnabled: v.optional(v.boolean()),
    alertChannel: v.optional(v.union(v.literal("email"), v.literal("none"))),
    region: v.optional(
      v.union(
        v.literal("EU"),
        v.literal("UK"),
        v.literal("US"),
        v.literal("OTHER"),
      ),
    ),
    currency: v.optional(
      v.union(v.literal("EUR"), v.literal("GBP"), v.literal("USD")),
    ),
  },
  handler: async (ctx, patch) => {
    const user = await requireUser(ctx);
    const cleaned: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) cleaned[k] = val;
    }
    if (Object.keys(cleaned).length > 0) {
      await ctx.db.patch(user._id, cleaned);
    }
  },
});

// --- Internal helpers used by the action ---

export const _allEnabledUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    // undefined === enabled
    return users.filter((u) => u.weeklyDigestEnabled !== false);
  },
});

export const _userById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const _trackedForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("trackedItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const _snapshotsForItems = internalQuery({
  args: { itemIds: v.array(v.id("items")), sinceMs: v.number() },
  handler: async (ctx, { itemIds, sinceMs }) => {
    const lists = await Promise.all(
      itemIds.map((itemId) =>
        ctx.db
          .query("marketSnapshots")
          .withIndex("by_item_date", (q) =>
            q.eq("itemId", itemId).gte("date", sinceMs),
          )
          .collect()
          .then((rows) =>
            rows.map((r) => ({ ...r, itemId: r.itemId as typeof itemId })),
          ),
      ),
    );
    return lists.flat();
  },
});

export const _scoresForItems = internalQuery({
  args: { itemIds: v.array(v.id("items")), sinceMs: v.number() },
  handler: async (ctx, { itemIds, sinceMs }) => {
    const lists = await Promise.all(
      itemIds.map((itemId) =>
        ctx.db
          .query("signalScores")
          .withIndex("by_item_date", (q) =>
            q.eq("itemId", itemId).gte("date", sinceMs),
          )
          .collect(),
      ),
    );
    return lists.flat();
  },
});

export const _itemsByIds = internalQuery({
  args: { itemIds: v.array(v.id("items")) },
  handler: async (ctx, { itemIds }) => {
    const items = await Promise.all(itemIds.map((id) => ctx.db.get(id)));
    return items.filter((x): x is NonNullable<typeof x> => x !== null);
  },
});

export const _alertsForUser = internalQuery({
  args: { userId: v.id("users"), sinceMs: v.number() },
  handler: async (ctx, { userId, sinceMs }) => {
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_user_time", (q) =>
        q.eq("userId", userId).gte("triggeredAt", sinceMs),
      )
      .collect();
    return alerts;
  },
});

export const _upsertDigest = internalMutation({
  args: {
    userId: v.id("users"),
    weekStart: v.number(),
    content: v.object({
      intro: v.string(),
      sections: v.array(
        v.object({
          title: v.string(),
          items: v.array(
            v.object({
              itemId: v.id("items"),
              headline: v.string(),
              bodySm: v.string(),
              verdict: v.optional(v.string()),
              imageUrl: v.optional(v.string()),
            }),
          ),
        }),
      ),
    }),
    sentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weeklyDigests")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", args.userId).eq("weekStart", args.weekStart),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        sentAt: args.sentAt ?? existing.sentAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("weeklyDigests", args);
  },
});

export const _toggleDigest = internalMutation({
  args: { userId: v.id("users"), enabled: v.boolean() },
  handler: async (ctx, { userId, enabled }) => {
    await ctx.db.patch(userId, { weeklyDigestEnabled: enabled });
  },
});
