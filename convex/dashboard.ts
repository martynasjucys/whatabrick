import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NOTABLE_VERDICTS = new Set([
  "STRONG_SIGNAL",
  "GOOD_BELOW_TARGET",
  "AVOID_HYPE",
]);

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const now = Date.now();
    const weekAgo = now - WEEK_MS;

    const [radars, tracked, alertsRecent, alertsUnread, latestDigest] =
      await Promise.all([
        ctx.db
          .query("radars")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .order("desc")
          .collect(),
        ctx.db
          .query("trackedItems")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect(),
        ctx.db
          .query("alerts")
          .withIndex("by_user_time", (q) =>
            q.eq("userId", user._id).gte("triggeredAt", weekAgo),
          )
          .collect(),
        ctx.db
          .query("alerts")
          .withIndex("by_user_read", (q) =>
            q.eq("userId", user._id).eq("readAt", undefined),
          )
          .collect(),
        ctx.db
          .query("weeklyDigests")
          .withIndex("by_user_week", (q) => q.eq("userId", user._id))
          .order("desc")
          .first(),
      ]);

    // Latest signalScore per tracked item (parallel point reads).
    const uniqueItemIds = [
      ...new Set(tracked.map((t) => t.itemId as Id<"items">)),
    ];
    const [latestScores, items] = await Promise.all([
      Promise.all(
        uniqueItemIds.map((id) =>
          ctx.db
            .query("signalScores")
            .withIndex("by_item_date", (q) => q.eq("itemId", id))
            .order("desc")
            .first(),
        ),
      ),
      Promise.all(uniqueItemIds.map((id) => ctx.db.get(id))),
    ]);

    const scoreByItem = new Map<string, (typeof latestScores)[number]>();
    const itemById = new Map<string, (typeof items)[number]>();
    uniqueItemIds.forEach((id, i) => {
      scoreByItem.set(id as string, latestScores[i]);
      itemById.set(id as string, items[i]);
    });

    // KPI counts
    const itemsToWatchCount = tracked.filter(
      (t) =>
        t.targetPriceCents !== undefined ||
        t.sellTargetPriceCents !== undefined,
    ).length;
    const priceDropsThisWeek = alertsRecent.filter(
      (a) => a.type === "PRICE_BELOW_TARGET" && !a.dismissed,
    ).length;
    const scarcityAlertsThisWeek = alertsRecent.filter(
      (a) => a.type === "LISTING_COUNT_DROP" && !a.dismissed,
    ).length;
    const hypeThisWeek = [...scoreByItem.values()].filter(
      (s) => s && s.verdict === "AVOID_HYPE" && s._creationTime >= weekAgo,
    ).length;
    const unreadAlertsCount = alertsUnread.filter((a) => !a.dismissed).length;

    // Attention items: latest signalScore in notable verdicts AND updated this week.
    const attentionItems = uniqueItemIds
      .map((id) => {
        const score = scoreByItem.get(id as string);
        const item = itemById.get(id as string);
        if (!score || !item) return null;
        if (!NOTABLE_VERDICTS.has(score.verdict)) return null;
        if (score._creationTime < weekAgo) return null;
        return {
          itemId: item._id,
          name: item.name,
          imageUrl: item.imageUrl,
          verdict: score.verdict,
          currentPriceCents: score.currentPriceCents,
          targetPriceCents: score.targetPriceCents,
          currency: score.currency,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 6);

    // Per-radar weekly deltas.
    const trackedByRadar = new Map<string, typeof tracked>();
    for (const t of tracked) {
      const id = t.radarId as string;
      const list = trackedByRadar.get(id) ?? [];
      list.push(t);
      trackedByRadar.set(id, list);
    }
    const radarSummaries = radars.map((r) => {
      const radarItems = trackedByRadar.get(r._id as string) ?? [];
      const newThisWeek = radarItems.filter((t) => t.addedAt >= weekAgo).length;
      const radarItemIds = new Set(radarItems.map((t) => t.itemId as string));
      const radarPriceDrops = alertsRecent.filter(
        (a) =>
          a.type === "PRICE_BELOW_TARGET" &&
          radarItemIds.has(a.itemId as string),
      ).length;
      const radarScarcity = alertsRecent.filter(
        (a) =>
          a.type === "LISTING_COUNT_DROP" &&
          radarItemIds.has(a.itemId as string),
      ).length;
      return {
        _id: r._id,
        title: r.title,
        niche: r.niche,
        theme: r.theme,
        region: r.region,
        expansionStatus: r.expansionStatus,
        trackedCount: radarItems.length,
        newThisWeek,
        priceDropsThisWeek: radarPriceDrops,
        scarcityThisWeek: radarScarcity,
      };
    });

    return {
      counts: {
        itemsToWatch: itemsToWatchCount,
        priceDropsThisWeek,
        scarcityAlertsThisWeek,
        hypeThisWeek,
        unreadAlerts: unreadAlertsCount,
      },
      radars: radarSummaries,
      attentionItems,
      latestDigestId: latestDigest?._id ?? null,
      latestDigestSentAt: latestDigest?.sentAt ?? null,
    };
  },
});
