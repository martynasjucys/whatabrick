# Market Tracking — SPEC

**Purpose:** Pull active-listing and sold-price data from BrickLink on a schedule, store immutable daily snapshots, and surface listing-count + price trends on the item detail page.

**Depends on:** `catalog-items`.

## User stories
1. As a user, the item detail page shows me the current lowest price, median price, listing count, and a 30-day trend line — without me lifting a finger after adding the item.
2. As a user, I can manually trigger a refresh on a single item (subject to a per-user cooldown).
3. As a user, I see the most recent sold prices distinct from active asking prices, because asking prices lie.

## Scope

**In:**
- Daily snapshot cron via Convex `crons` for every tracked item.
- BrickLink Price Guide endpoint integration (OAuth 1.0a).
- Storage of `MarketSnapshot` rows (one per item per source per day per condition).
- A `priceTrend` query that returns the last 30/90 days of snapshots in chart-ready form.
- Listing count delta detection (used downstream by `alerts` for scarcity signals).
- Manual refresh endpoint (rate-limited).

**Out:**
- eBay (not in scope per user decision).
- Cross-region price comparison beyond what BrickLink returns natively (BrickLink Price Guide accepts a `country_code` parameter — we use the radar's region).
- Shipping-aware pricing.
- Real-time WebSocket updates (Convex live queries handle reactivity once snapshot is written).

## Data model

```ts
marketSnapshots: defineTable({
  itemId: v.id("items"),
  source: v.literal("bricklink"),
  guideType: v.union(v.literal("stock"), v.literal("sold")),  // BrickLink terminology
  condition: v.union(v.literal("N"), v.literal("U")),          // new / used
  region: v.string(),                                          // BrickLink country code
  currency: v.string(),
  date: v.number(),                                            // start-of-day UTC ms
  // BrickLink price_detail aggregates:
  activeListingCount: v.optional(v.number()),
  totalQuantity: v.optional(v.number()),
  minPriceCents: v.number(),
  maxPriceCents: v.number(),
  avgPriceCents: v.number(),
  qtyAvgPriceCents: v.number(),
}).index("by_item_date", ["itemId", "date"])
  .index("by_item_type_cond", ["itemId", "guideType", "condition", "date"]),
```

One item produces up to 4 snapshots per day (stock×N, stock×U, sold×N, sold×U). We keep all four — beginners want sealed-vs-loose comparisons.

## Convex function surface

- `marketSnapshots.latest` — query: returns the most recent snapshot per (guideType, condition) for an item.
- `marketSnapshots.history` — query: returns snapshots in a date range for a chart.
- `marketSnapshots.refreshItem` — internal action: fetches all 4 BrickLink price-guide variants and writes snapshots.
- `marketSnapshots.requestManualRefresh` — public action: rate-limited per user (1 per item per 6h), calls `refreshItem`.
- `crons.ts` → schedules `marketSnapshots.refreshAllTrackedItems` daily at 06:00 UTC.
- `marketSnapshots.refreshAllTrackedItems` — internal action: iterates distinct `items` referenced by any `trackedItems`, fans out to `refreshItem` with rate-limited concurrency (e.g. 1 per second).

## BrickLink Price Guide

BrickLink uses OAuth 1.0a (signed request, not bearer). Endpoint:

```
GET /api/store/v1/items/{type}/{no}/price?guide_type={stock|sold}&new_or_used={N|U}&country_code={EU member or US/GB}
```

`type` ∈ `MINIFIG | PART | SET`. Map our `rebrickableType` to BrickLink's vocabulary.

Response is `{ data: { unit_quantity, total_quantity, min_price, max_price, avg_price, qty_avg_price, currency_code, price_detail: [...] } }`. Convert to cents (string → number × 100 → round).

Daily rate limit: **5,000 requests/day** per consumer key. With 4 variants × N items, that's ~1,250 items/day — fine for MVP.

## UI / pages

`src/app/(app)/items/[id]/page.tsx` gains:
- A "Market" card with the latest sealed-new lowest price (display-md) and a `body-sm` meta row ("12 active listings · qty-avg €8.40 · sold-median €7.10").
- A condition toggle (`pricing-tab` style — sealed / loose).
- A 30-day Recharts line chart of `qty_avg_price`. Two lines: stock (asking) and sold.
- A "Refresh now" button using `requestManualRefresh`. Disabled state shows cooldown remaining.
- A "Listing count" sparkline (count over the same window) — drops in count are the scarcity signal.

Recharts must be added: `pnpm add recharts`. Style: lavender stroke for sold, ink-subtle for stock. No gridlines, no axis labels beyond month tick. Match Linear's dense product-screenshot aesthetic.

## Success criteria
- Adding a tracked item triggers an immediate first snapshot within ~30s (scheduled action, not blocking).
- The chart appears the day after adding for items that already exist in BrickLink — for new adds the chart shows a single point initially.
- Manual refresh button respects a 6h cooldown per item per user.
- Cron runs nightly without exhausting the BrickLink quota — log total requests issued.

## Open questions
- Backfill: should we attempt to backfill historical prices via BrickLink's `price_detail` (which contains individual sale records up to ~6 months back for sold guide)? **Default: yes for sold guide, no for stock.** Implement in a separate `marketSnapshots.backfillItem` action invoked once at first tracking.
- Currency normalization: snapshots store native BrickLink currency. UI converts to user-preferred currency at read time using a daily FX snapshot. **Defer FX to a follow-up** — show native currency in MVP and label clearly.
