import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
  type QueryCtx,
} from "./_generated/server";

const conditionValidator = v.union(v.literal("N"), v.literal("U"));
const guideTypeValidator = v.union(v.literal("stock"), v.literal("sold"));

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
  args: { itemId: v.id("items"), condition: conditionValidator },
  handler: async (ctx, { itemId, condition }) => {
    await requireUser(ctx);
    const stock = await ctx.db
      .query("marketSnapshots")
      .withIndex("by_item_type_cond_date", (q) =>
        q.eq("itemId", itemId).eq("guideType", "stock").eq("condition", condition),
      )
      .order("desc")
      .first();
    const sold = await ctx.db
      .query("marketSnapshots")
      .withIndex("by_item_type_cond_date", (q) =>
        q.eq("itemId", itemId).eq("guideType", "sold").eq("condition", condition),
      )
      .order("desc")
      .first();
    return { stock, sold };
  },
});

export const historyForChart = query({
  args: {
    itemId: v.id("items"),
    condition: conditionValidator,
    days: v.optional(v.number()),
  },
  handler: async (ctx, { itemId, condition, days }) => {
    await requireUser(ctx);
    const windowMs = (days ?? 30) * 24 * 60 * 60 * 1000;
    const since = Date.now() - windowMs;

    const [stockSnaps, soldSnaps] = await Promise.all([
      ctx.db
        .query("marketSnapshots")
        .withIndex("by_item_type_cond_date", (q) =>
          q
            .eq("itemId", itemId)
            .eq("guideType", "stock")
            .eq("condition", condition)
            .gte("date", since),
        )
        .collect(),
      ctx.db
        .query("marketSnapshots")
        .withIndex("by_item_type_cond_date", (q) =>
          q
            .eq("itemId", itemId)
            .eq("guideType", "sold")
            .eq("condition", condition)
            .gte("date", since),
        )
        .collect(),
    ]);

    type Row = {
      date: number;
      stock?: number;
      sold?: number;
      listingCount?: number;
    };
    const byDate = new Map<number, Row>();
    for (const s of stockSnaps) {
      const row = byDate.get(s.date) ?? { date: s.date };
      row.stock = s.qtyAvgPriceCents / 100;
      row.listingCount = s.activeListingCount;
      byDate.set(s.date, row);
    }
    for (const s of soldSnaps) {
      const row = byDate.get(s.date) ?? { date: s.date };
      row.sold = s.qtyAvgPriceCents / 100;
      byDate.set(s.date, row);
    }

    return [...byDate.values()].sort((a, b) => a.date - b.date);
  },
});

export const _insert = internalMutation({
  args: {
    itemId: v.id("items"),
    source: v.literal("bricklink"),
    guideType: guideTypeValidator,
    condition: conditionValidator,
    region: v.string(),
    currency: v.string(),
    date: v.number(),
    activeListingCount: v.optional(v.number()),
    totalQuantity: v.optional(v.number()),
    minPriceCents: v.number(),
    maxPriceCents: v.number(),
    avgPriceCents: v.number(),
    qtyAvgPriceCents: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("marketSnapshots")
      .withIndex("by_item_type_cond_date", (q) =>
        q
          .eq("itemId", args.itemId)
          .eq("guideType", args.guideType)
          .eq("condition", args.condition)
          .eq("date", args.date),
      )
      .filter((q) => q.eq(q.field("region"), args.region))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        currency: args.currency,
        activeListingCount: args.activeListingCount,
        totalQuantity: args.totalQuantity,
        minPriceCents: args.minPriceCents,
        maxPriceCents: args.maxPriceCents,
        avgPriceCents: args.avgPriceCents,
        qtyAvgPriceCents: args.qtyAvgPriceCents,
      });
      return existing._id;
    }
    return await ctx.db.insert("marketSnapshots", args);
  },
});

export const _allTrackedItems = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tracked = await ctx.db.query("trackedItems").collect();
    const uniqueIds = [...new Set(tracked.map((t) => t.itemId))];
    const items = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
    return items.filter((x): x is NonNullable<typeof x> => x !== null);
  },
});

export const _latestForItem = internalQuery({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    return await ctx.db
      .query("marketSnapshots")
      .withIndex("by_item_date", (q) => q.eq("itemId", itemId))
      .order("desc")
      .first();
  },
});
