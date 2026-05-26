# Market Tracking — Implementation Plan

## Step 1 — Schema + indexes

Add `marketSnapshots` to `convex/schema.ts`. Both indexes in SPEC are required: `by_item_date` for the chart query, `by_item_type_cond` for "latest per (guide_type, condition)".

## Step 2 — BrickLink OAuth client

Install `pnpm add oauth-1.0a crypto-js` (Node-only — these run in Convex actions with `"use node"`).

Create `convex/lib/bricklink.ts`:

```ts
"use node";
import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";

const oauth = new OAuth({
  consumer: {
    key: process.env.BRICKLINK_CONSUMER_KEY!,
    secret: process.env.BRICKLINK_CONSUMER_SECRET!,
  },
  signature_method: "HMAC-SHA1",
  hash_function: (base, key) => CryptoJS.HmacSHA1(base, key).toString(CryptoJS.enc.Base64),
});

const token = {
  key: process.env.BRICKLINK_TOKEN_VALUE!,
  secret: process.env.BRICKLINK_TOKEN_SECRET!,
};

export async function priceGuide(opts: {
  type: "MINIFIG" | "PART" | "SET";
  no: string;
  guideType: "stock" | "sold";
  newOrUsed: "N" | "U";
  countryCode?: string;
}) {
  const url = `https://api.bricklink.com/api/store/v1/items/${opts.type}/${opts.no}/price`;
  const params = new URLSearchParams({
    guide_type: opts.guideType,
    new_or_used: opts.newOrUsed,
    ...(opts.countryCode ? { country_code: opts.countryCode } : {}),
  });
  const full = `${url}?${params}`;
  const headers = oauth.toHeader(oauth.authorize({ url: full, method: "GET" }, token));
  const res = await fetch(full, { headers });
  if (!res.ok) throw new Error(`BrickLink ${res.status} on ${opts.type}/${opts.no}`);
  return (await res.json()).data;
}
```

Map our `rebrickableType` ↔ BrickLink type: `minifig → MINIFIG`, `part → PART`, `set → SET`. The id used is `brickLinkId` if known else `rebrickableId` (BrickLink and Rebrickable use the same set numbers for sets but different ids for minifigs — when ingesting from Rebrickable, also pull the `bricklink_id` cross-ref and store it on `items`).

## Step 3 — refreshItem action

`convex/marketSnapshotsActions.ts` (with `"use node"`):

```ts
export const refreshItem = internalAction({
  args: { itemId: v.id("items"), region: v.optional(v.string()) },
  handler: async (ctx, { itemId, region }) => {
    const item = await ctx.runQuery(internal.items._get, { itemId });
    if (!item?.brickLinkId) return; // skip items we can't price
    const today = startOfUtcDay(Date.now());
    for (const guideType of ["stock", "sold"] as const) {
      for (const cond of ["N", "U"] as const) {
        const data = await priceGuide({
          type: typeMap[item.rebrickableType],
          no: item.brickLinkId,
          guideType,
          newOrUsed: cond,
          countryCode: region,
        });
        await ctx.runMutation(internal.marketSnapshots._insert, {
          itemId, source: "bricklink", guideType, condition: cond,
          region: region ?? "GLOBAL", date: today,
          currency: data.currency_code,
          activeListingCount: data.unit_quantity,
          totalQuantity: data.total_quantity,
          minPriceCents: toCents(data.min_price),
          maxPriceCents: toCents(data.max_price),
          avgPriceCents: toCents(data.avg_price),
          qtyAvgPriceCents: toCents(data.qty_avg_price),
        });
      }
    }
  },
});
```

`_insert` is an internal mutation that upserts on `(itemId, source, guideType, condition, region, date)` — re-running the same day overwrites instead of appending.

## Step 4 — Cron

`convex/crons.ts`:

```ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.daily("daily-market-refresh", { hourUTC: 6, minuteUTC: 0 }, internal.marketSnapshotsActions.refreshAllTracked);
export default crons;
```

`refreshAllTracked` action: list distinct `itemId`s from `trackedItems`, then loop with `await sleep(750)` between items to stay under 1.5 req/s.

## Step 5 — On-add hook

In `items.addTrackedItem` mutation, after inserting `trackedItems`, schedule `refreshItem` immediately:
```ts
await ctx.scheduler.runAfter(0, internal.marketSnapshotsActions.refreshItem, { itemId, region: radar.region });
```

Also schedule a one-time `backfillItem` action that pulls `guide_type=sold` `price_detail` and synthesizes weekly snapshots for the last 6 months.

## Step 6 — Manual refresh

`requestManualRefresh` action: check `marketSnapshots.latest` for the item — if any snapshot newer than 6 hours, throw. Else schedule `refreshItem`.

## Step 7 — UI

```bash
pnpm add recharts
pnpm dlx shadcn@latest add chart tabs
```

On `/(app)/items/[id]/page.tsx`:
- Top: `MarketHeader` showing latest sealed-new prices.
- Tabs (`pricing-tab` styled): Sealed / Loose.
- Below: `<LineChart>` (Recharts) with stock vs sold lines.
- `<RefreshButton>` calls `requestManualRefresh`.

Chart colors: stock = `var(--muted-foreground)` (#8a8f98 ink-subtle), sold = `var(--primary)` (#5e6ad2). Stroke width 1.5, no fill, no dots except on hover.

## Step 8 — Validation

1. Add a known item (e.g. minifig `mc001` Steve from Minecraft) → check Convex logs show 4 BrickLink calls within 30s → 4 snapshot rows appear.
2. Wait a day, run the daily cron manually via Convex dashboard → second snapshot per variant.
3. Open item page → chart renders with at least 2 points.
4. Click refresh → first call works; second within 6h is blocked with a friendly error toast.

## Gotchas

- **OAuth 1.0a signing** is fragile — the URL passed to `oauth.authorize` must include the query string sorted alphabetically by key. The `oauth-1.0a` library does this if you pass `data` separately from `url`. Test with one known request via curl first to confirm signatures match.
- **BrickLink quota** resets at 00:00 UTC. The cron at 06:00 UTC gives plenty of headroom for retries.
- **`price_detail`** on the `sold` guide is the only way to backfill — it returns individual sale records with timestamps. Bucket into weekly avg before inserting.
- **Convex action runtime memory**: each action call is independent. Don't try to hold state between item refreshes in module scope — use the scheduler.
