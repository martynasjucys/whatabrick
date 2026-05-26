# Dashboard — Implementation Plan

## Step 1 — Composed query

Create `convex/dashboard.ts` with a single `summary` query. No new schema — this feature is purely a read layer over existing tables.

```ts
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);          // helper from `users.ts`
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;

    const [radars, unreadAlerts, attentionScores, latestDigest] = await Promise.all([
      ctx.db.query("radars").withIndex("by_user", q => q.eq("userId", user._id)).collect(),
      ctx.db.query("alerts").withIndex("by_user_unread", q => q.eq("userId", user._id).eq("readAt", undefined)).collect(),
      // for each tracked item, latest signalScore — implemented via a denormalized "latestVerdict" field on trackedItems, see Step 2
      ctx.db.query("trackedItems").withIndex("by_user", q => q.eq("userId", user._id))
        .filter(q => q.gte(q.field("latestVerdictUpdatedAt"), weekAgo))
        .collect(),
      ctx.db.query("weeklyDigests").withIndex("by_user_week", q => q.eq("userId", user._id))
        .order("desc").first(),
    ]);

    // compose counts + radar deltas + attention items
    return { counts, radars: radarSummaries, attentionItems, latestDigestId: latestDigest?._id ?? null };
  },
});
```

## Step 2 — Denormalization

Joining `signalScores` per item per page load won't scale. Add denormalized fields on `trackedItems`:

```ts
latestVerdict: v.optional(v.string()),
latestVerdictUpdatedAt: v.optional(v.number()),
latestPriceCents: v.optional(v.number()),
latestCurrency: v.optional(v.string()),
priceCents7dAgo: v.optional(v.number()),
```

Maintain these inside `marketSnapshotsActions.refreshItem` and `signalScoresActions.refreshItem`: after writing the new snapshot/score, also call a `trackedItems._syncDenorm` internal mutation that fans out to all `trackedItems` for that `itemId`.

This trades write cost for read cost — the dashboard reads thousands of times more often than items refresh.

## Step 3 — UI

```bash
pnpm dlx shadcn@latest add card separator
```

Files:
- `src/app/(app)/page.tsx` — server component that prefetches `api.dashboard.summary` via SSR (Convex supports this with `preloadQuery`) and hydrates a client `<DashboardClient />` that uses the live query.
- `src/components/dashboard/kpi-tile.tsx` — `feature-card` styled with lucide icon (lavender stroke), big value (`card-title`), label (`body-sm ink-subtle`).
- `src/components/dashboard/radar-card.tsx` — title + niche chip + 3-line delta summary + verdict-icon strip.
- `src/components/dashboard/attention-item-card.tsx` — thumbnail + name + verdict badge + delta %.
- `src/components/dashboard/digest-banner.tsx` — `cta-banner` token, "Your weekly recap is ready" + lavender CTA.
- `src/components/dashboard/empty-state.tsx` — full-bleed hero, only rendered when `radars.length === 0`.

All cards use design tokens; never hardcode colors. Tile icons from `lucide-react`: `Eye` (Items to watch), `TrendingDown` (Price drops), `AlertTriangle` (Scarcity), `Flame` (Possible hype).

## Step 4 — Validation

1. New user signs up → lands on `/(app)` → sees empty state with "Create your first radar".
2. Create a radar + add 3 items → reload → KPI tiles count nonzero, radar card shows the radar.
3. Run market + verdict crons → after sync, attention items section populates.
4. Open `/alerts` → unread count matches the KPI tile.
5. Click a KPI tile → lands on the filtered alerts/items view.

## Gotchas

- **Convex preload + hydration**: server-rendering the dashboard with `preloadQuery` + `Preloaded<Query>` types is the path. Don't try to call `fetchQuery` directly from a server component — it bypasses the realtime subscription on the client.
- **Denormalization correctness**: any place that writes a snapshot or score must also call `_syncDenorm`. Easiest enforcement: do it inside the `_insert` internal mutations, not at the action level — that way it's a single point of truth.
- **Empty week handling**: KPI counts can legitimately be zero. Show "0" not "—" so the user can verify the system is working.
- **Mobile horizontal scroll** for the attention strip: use `overflow-x-auto snap-x snap-mandatory` with each card `snap-start`. Don't reach for a carousel library.
