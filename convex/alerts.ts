import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";

const alertTypeValidator = v.union(
  v.literal("PRICE_BELOW_TARGET"),
  v.literal("PRICE_ABOVE_SELL_TARGET"),
  v.literal("LISTING_COUNT_DROP"),
  v.literal("VERDICT_TRANSITION"),
  v.literal("NEW_LISTING_SPIKE"),
);

const alertPayloadValidator = v.object({
  priceCents: v.optional(v.number()),
  currency: v.optional(v.string()),
  targetPriceCents: v.optional(v.number()),
  listingsBefore: v.optional(v.number()),
  listingsAfter: v.optional(v.number()),
  changePct: v.optional(v.number()),
  verdictFrom: v.optional(v.string()),
  verdictTo: v.optional(v.string()),
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
  args: { unreadOnly: v.optional(v.boolean()) },
  handler: async (ctx, { unreadOnly }) => {
    const user = await requireUser(ctx);
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_user_time", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
    const filtered = unreadOnly
      ? alerts.filter((a) => !a.readAt && !a.dismissed)
      : alerts.filter((a) => !a.dismissed);
    return await Promise.all(
      filtered.map(async (a) => {
        const item = await ctx.db.get(a.itemId);
        return { alert: a, item };
      }),
    );
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return 0;
    const unread = await ctx.db
      .query("alerts")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("readAt", undefined),
      )
      .collect();
    return unread.filter((a) => !a.dismissed).length;
  },
});

export const markRead = mutation({
  args: { id: v.id("alerts") },
  handler: async (ctx, { id }) => {
    const alert = await ctx.db.get(id);
    if (!alert) return;
    const user = await requireUser(ctx);
    if (alert.userId !== user._id) throw new Error("Forbidden");
    if (!alert.readAt) {
      await ctx.db.patch(id, { readAt: Date.now() });
    }
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const unread = await ctx.db
      .query("alerts")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("readAt", undefined),
      )
      .collect();
    const now = Date.now();
    for (const a of unread) {
      if (!a.dismissed) await ctx.db.patch(a._id, { readAt: now });
    }
  },
});

export const dismiss = mutation({
  args: { id: v.id("alerts") },
  handler: async (ctx, { id }) => {
    const alert = await ctx.db.get(id);
    if (!alert) return;
    const user = await requireUser(ctx);
    if (alert.userId !== user._id) throw new Error("Forbidden");
    await ctx.db.patch(id, { dismissed: true, readAt: alert.readAt ?? Date.now() });
  },
});

export const setTargetPrice = mutation({
  args: {
    itemId: v.id("items"),
    targetPriceCents: v.optional(v.number()),
  },
  handler: async (ctx, { itemId, targetPriceCents }) => {
    const user = await requireUser(ctx);
    const tracked = await ctx.db
      .query("trackedItems")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", user._id).eq("itemId", itemId),
      )
      .collect();
    for (const t of tracked) {
      await ctx.db.patch(t._id, { targetPriceCents });
    }
    // Re-evaluate immediately so the user sees an alert appear (or not) based
    // on the latest cached snapshots, without waiting for a BrickLink refresh.
    if (tracked.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.alertsActions.evaluateForItem,
        { itemId },
      );
    }
  },
});

export const setSellTargetPrice = mutation({
  args: {
    itemId: v.id("items"),
    sellTargetPriceCents: v.optional(v.number()),
  },
  handler: async (ctx, { itemId, sellTargetPriceCents }) => {
    const user = await requireUser(ctx);
    const tracked = await ctx.db
      .query("trackedItems")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", user._id).eq("itemId", itemId),
      )
      .collect();
    for (const t of tracked) {
      await ctx.db.patch(t._id, { sellTargetPriceCents });
    }
    if (tracked.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.alertsActions.evaluateForItem,
        { itemId },
      );
    }
  },
});

export const muteItem = mutation({
  args: { itemId: v.id("items"), muted: v.boolean() },
  handler: async (ctx, { itemId, muted }) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("alertMutes")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", user._id).eq("itemId", itemId),
      )
      .unique();
    if (muted) {
      if (!existing) {
        await ctx.db.insert("alertMutes", { userId: user._id, itemId });
      }
    } else if (existing) {
      await ctx.db.delete(existing._id);
      // Re-evaluate on unmute so any pending conditions fire.
      await ctx.scheduler.runAfter(
        0,
        internal.alertsActions.evaluateForItem,
        { itemId },
      );
    }
  },
});

export const myTrackedItem = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;
    const tracked = await ctx.db
      .query("trackedItems")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", user._id).eq("itemId", itemId),
      )
      .first();
    const mute = await ctx.db
      .query("alertMutes")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", user._id).eq("itemId", itemId),
      )
      .unique();
    return { tracked, muted: !!mute };
  },
});

// --- Internal helpers used by the evaluator action ---

export const _trackedForItem = internalQuery({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const tracked = await ctx.db
      .query("trackedItems")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .collect();
    return await Promise.all(
      tracked.map(async (t) => {
        const mute = await ctx.db
          .query("alertMutes")
          .withIndex("by_user_item", (q) =>
            q.eq("userId", t.userId).eq("itemId", itemId),
          )
          .unique();
        return { tracked: t, muted: !!mute };
      }),
    );
  },
});

export const _lastAlertOf = internalQuery({
  args: { trackedItemId: v.id("trackedItems"), type: alertTypeValidator },
  handler: async (ctx, { trackedItemId, type }) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_tracked_type_time", (q) =>
        q.eq("trackedItemId", trackedItemId).eq("type", type),
      )
      .order("desc")
      .first();
  },
});

export const _insert = internalMutation({
  args: {
    userId: v.id("users"),
    itemId: v.id("items"),
    trackedItemId: v.id("trackedItems"),
    type: alertTypeValidator,
    payload: alertPayloadValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      ...args,
      triggeredAt: Date.now(),
      dismissed: false,
    });
  },
});

export const _markEmailed = internalMutation({
  args: { id: v.id("alerts") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { emailedAt: Date.now() });
  },
});

export const _pendingEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_emailed", (q) => q.eq("emailedAt", undefined))
      .order("desc")
      .take(100);
    return await Promise.all(
      alerts
        .filter((a) => !a.dismissed)
        .map(async (a) => {
          const user = await ctx.db.get(a.userId);
          const item = await ctx.db.get(a.itemId);
          return { alert: a, user, item };
        }),
    );
  },
});
