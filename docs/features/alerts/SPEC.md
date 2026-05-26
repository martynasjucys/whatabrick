# Alerts — SPEC

**Purpose:** Notify users (in-app and via email) when a tracked item crosses a threshold they care about — primarily target price, but also scarcity drops and verdict transitions.

**Depends on:** `market-tracking`, `item-verdicts`.

## User stories
1. As a user tracking a Minecraft creeper figure, I set a target price of €7 and get an email the morning a listing drops below it.
2. As a user, I see a notifications bell in the top nav with a count of unread alerts.
3. As a user, I can mute alerts on a specific item or radar without removing the tracking.

## Scope

**In:**
- Per-tracked-item target price (already on `trackedItems.targetPriceCents` from `catalog-items`).
- Server-side evaluation after every market snapshot batch.
- Alert types: `PRICE_BELOW_TARGET`, `LISTING_COUNT_DROP`, `VERDICT_TRANSITION`, `NEW_LISTING_SPIKE` (count went up suddenly — possible reissue/availability shift).
- In-app inbox + per-alert email (subject to user `alertChannel` setting).
- Mute / dismiss / mark-as-read.

**Out:**
- SMS / push notifications.
- Per-source granularity (sealed vs loose alerts split). Default: alert on sealed-new, mention loose in the body.
- AI-summarized alerts (the weekly digest handles batch summarization).

## Data model

```ts
alerts: defineTable({
  userId: v.id("users"),
  itemId: v.id("items"),
  trackedItemId: v.id("trackedItems"),
  type: v.union(
    v.literal("PRICE_BELOW_TARGET"),
    v.literal("LISTING_COUNT_DROP"),
    v.literal("VERDICT_TRANSITION"),
    v.literal("NEW_LISTING_SPIKE"),
  ),
  payload: v.object({
    // type-specific fields, e.g. priceCents, listingsBefore, listingsAfter, verdictFrom, verdictTo
  }),
  triggeredAt: v.number(),
  readAt: v.optional(v.number()),
  emailedAt: v.optional(v.number()),
  dismissed: v.boolean(),
}).index("by_user_unread", ["userId", "readAt"])
  .index("by_user_time", ["userId", "triggeredAt"])
  .index("by_tracked_item", ["trackedItemId"]),

alertMutes: defineTable({
  userId: v.id("users"),
  scope: v.union(v.literal("item"), v.literal("radar"), v.literal("all")),
  itemId: v.optional(v.id("items")),
  radarId: v.optional(v.id("radars")),
  until: v.optional(v.number()),  // null = forever
}),
```

## Evaluation logic

A single `alerts.evaluateForItem` internal action runs after each snapshot batch (chained from `marketSnapshotsActions.refreshItem`). For the item:

1. **PRICE_BELOW_TARGET**: latest stock-N (or stock-U if user prefers loose) `qty_avg_price` ≤ `trackedItem.targetPriceCents`. Cooldown: don't re-fire within 7 days unless price comes back up first.
2. **LISTING_COUNT_DROP**: 7-day rolling avg vs prior 7-day avg, drop ≥ 40%. Cooldown: 14 days.
3. **VERDICT_TRANSITION**: previous `signalScores.verdict` differs from new one AND new verdict is in `{STRONG_SIGNAL, GOOD_BELOW_TARGET, AVOID_HYPE, SCARCE_OVERPRICED}`. No cooldown — verdict shifts are deliberate.
4. **NEW_LISTING_SPIKE**: 7-day rolling avg ≥ 2× prior 7-day. Often signals a reissue arrived. Cooldown: 14 days.

Mutes are checked at write time: don't insert the alert if a matching mute exists.

## Convex function surface

- `alerts.list` — query: paginated alert list for the signed-in user, with optional `unreadOnly`.
- `alerts.unreadCount` — query: count for the nav badge.
- `alerts.markRead` — mutation.
- `alerts.dismiss` — mutation.
- `alerts.mute` / `alerts.unmute` — mutations.
- `alerts.evaluateForItem` — internal action.
- `alerts.dispatchEmails` — internal action: runs hourly via cron; finds alerts where `emailedAt == null` AND user's `alertChannel == "email"`, sends individual emails (digest is separate feature).

## Email template

Single-alert email (one per alert). Subject example: `Whatabrick: price drop on Minecraft Creeper magazine figure`.

Body:
- `display-md` headline with the alert type + item name.
- Body paragraph: human-readable description ("Lowest active price dropped to €6.50 — below your target of €7. There are now 4 active sealed listings in the EU, down from 11 a week ago.").
- Lavender CTA "Open in Whatabrick" → deep link to item page.

Use the design tokens in HTML email by inlining them. Use Resend's React Email integration for ergonomic templating.

## UI

- Top nav gets a `<NotificationBell />` showing `useQuery(api.alerts.unreadCount)`.
- `/(app)/alerts` page — list of alerts. Each row is a `feature-card` (surface-1, 12px radius) with the verdict-style icon on the left, alert text in `body`, timestamp in `caption`, "Open item" link.
- On the item detail page, a small "Set target price" inline form (number input + save) bound to `trackedItems.targetPriceCents`.

## Success criteria
- Setting a target above the current price on a fresh item → no alert.
- Manually inserting a snapshot below target → alert fires once → email sent within 1 hour.
- Setting the same item again the next day → no duplicate alert (cooldown).
- Muting the item → next snapshot below target produces no alert.

## Open questions
- Should we batch same-day alerts per user into a single email? **MVP: no** — but the next feature (`weekly-digest`) effectively does this, so keep individual emails minimal/transactional.
- Per-alert sound or browser notification? Out of scope for MVP.
