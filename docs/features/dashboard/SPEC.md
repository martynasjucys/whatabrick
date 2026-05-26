# Dashboard — SPEC

**Purpose:** The signed-in home page. Single glanceable view that answers "what's happening with my collection radar this week?" Pulls signals from every prior feature.

**Depends on:** `radars`, `catalog-items`, `market-tracking`, `item-verdicts`, `alerts`. Last in the build order.

## User stories
1. As a returning user, I open `/` and immediately see: which items I should look at today, which radars changed this week, and unread alerts.
2. As a user with no data yet, I get an onboarding state that nudges me to create a radar.
3. As a user, I can click any card and drill into the underlying item / radar / alert.

## Scope

**In:**
- Authenticated landing page at `/(app)`.
- Four primary sections matching plan §11 / §14:
  1. **Top cards**: 4 KPI tiles — Items to watch, Price drops this week, Scarcity alerts, Possible hype.
  2. **Radar cards**: one per radar, with weekly delta counts.
  3. **Items needing attention**: items with verdicts in `{STRONG_SIGNAL, GOOD_BELOW_TARGET, AVOID_HYPE}` updated this week. Top 6.
  4. **This week's digest preview**: collapsed card linking to `/(app)/digest`.
- Empty state when no radars: hero with "Create your first radar" CTA.

**Out:**
- Real-time WebSocket updates beyond what Convex live queries give us for free.
- Customizable dashboard layout.
- Cross-radar analytics (theme breakdown, total tracked value).

## Convex function surface (read-only)

- `dashboard.summary` — query: returns
  ```ts
  {
    counts: { itemsToWatch, priceDropsThisWeek, scarcityAlerts, possibleHype, unreadAlerts },
    radars: Array<{ id, title, niche, trackedCount, weeklyPriceChanges, weeklyScarcityWarnings, lastUpdated }>,
    attentionItems: Array<{ itemId, name, imageUrl, verdict, priceCents, currency, deltaPct }>,
    latestDigestId: Id<"weeklyDigests"> | null,
  }
  ```
- This is a *composed* query — it joins data computed by other features but writes no new tables.

## UI / pages

`src/app/(app)/page.tsx`:

Layout, top to bottom on a max-1280px frame:

1. **Greeting strip** — `eyebrow` "Today" + `display-md` "Your radar" + last-updated timestamp on the right.
2. **KPI row** — 4 `feature-card` tiles in a 4-up grid. Each: a 32px lucide icon (lavender), `card-title` value, `body-sm` label, optional `caption` delta. 2-up on tablet, 1-up on mobile (per breakpoints in design.md).
3. **Radars** — section eyebrow "Your radars" + `display-md` heading + horizontal "+ New radar" button (`button-secondary`). Grid of `RadarCard`s 3-up → 2-up → 1-up.
4. **Items to watch** — `display-md` heading. Horizontal scroll on mobile, 3-up grid on desktop. Each card has the verdict badge, item thumbnail, name (`card-title`), and delta line (`body-sm`).
5. **This week's digest** — `cta-banner` token (surface-1, 48px padding, headline type). "Your weekly recap is ready — open it." → `/(app)/digest`.

Empty state (no radars): full-bleed canvas with display-lg "Create your first radar", body-lg subhead, lavender primary CTA → `/(app)/radars/new`. Mirror the design.md hero spec.

## Performance

- `dashboard.summary` should resolve in <300ms even at 100 tracked items. The composed query reads:
  - `radars by_user` (≤ N radars)
  - `trackedItems by_radar` × N
  - `signalScores latest` for each tracked item (use a composite index `by_item_date` reading just the top row)
  - `alerts` count by `by_user_unread`
  - `marketSnapshots by_item_date` last 7 days for delta calc
- All of these can run in parallel inside the query handler. Use `Promise.all`.

## Success criteria
- A signed-in user with 3 radars + 15 tracked items sees a populated dashboard in <500ms after sign-in.
- A new user lands on the empty state, not on a broken/skeleton page.
- KPI tile counts match what's surfaced on the `/alerts` page and `/digest` page.
- Lighthouse "Largest Contentful Paint" under 1.5s on a clean cache.

## Open questions
- Should KPI tiles be clickable to filter views? Plan §14 implies yes but doesn't specify filters. **MVP: tiles link to existing pages** (Alerts tile → `/alerts`, Price drops → `/alerts?type=PRICE_BELOW_TARGET`, etc.). Filter UI on alerts page can come later.
- Should we ship a public dashboard preview (for marketing)? Out of scope for MVP — `/` already serves as marketing.
