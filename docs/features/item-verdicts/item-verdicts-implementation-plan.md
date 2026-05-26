# Item Verdicts — Implementation Plan

## Step 1 — Schema

Add `signalScores` to `convex/schema.ts` per SPEC.

## Step 2 — Pure scoring lib

Create `convex/lib/scoring.ts`:

```ts
export type SnapshotSeries = { date: number; qtyAvgCents: number; listingCount: number; soldCount: number }[];

export function scarcity(series: SnapshotSeries, regionsObserved: number): number { /* ... */ }
export function momentum(series: SnapshotSeries): number { /* ... */ }
export function demand(series: SnapshotSeries, themeMedianSoldFreq: number): number { /* ... */ }
export function exclusivity(item: { uniqueParts?: string[]; reissueRisk?: "low"|"medium"|"high" }): number { /* ... */ }
export function risk(scores: { scarcity: number; demand: number }, series: SnapshotSeries, item: any): number { /* ... */ }

export function pickVerdict(args: { scores, currentPriceCents, targetPriceCents, confidence }): Verdict { /* ... */ }
```

Each function is pure → easy unit tests. Use simple linear regression for slope (no extra deps).

Add `convex/lib/scoring.test.ts` if you set up a test runner (otherwise validate via the Convex dashboard). For MVP it's acceptable to skip a runner if you `console.assert` from a one-off `convex/lib/scoring.scratch.ts` action.

## Step 3 — refreshItem action

`convex/signalScoresActions.ts` (`"use node"`):

1. Read last 90 days of snapshots for the item via `marketSnapshots.history`.
2. If <7 snapshots → write a `WATCH`/`LOW` row with a templated explanation ("Not enough data yet — check back in a week."). No Claude call.
3. Else compute scores via `lib/scoring`.
4. Compute targetPrice = `median(soldQtyAvg, last 30d) * 0.85`.
5. Pick verdict via decision tree.
6. Call Claude Sonnet with the compact JSON + verdict → get explanation.
7. Insert/upsert `signalScores` row keyed on `(itemId, date)`.

## Step 4 — Cron

Add to `convex/crons.ts`:

```ts
crons.daily("daily-verdict-refresh", { hourUTC: 6, minuteUTC: 30 }, internal.signalScoresActions.refreshAllTracked);
```

30 minutes after the market cron — gives BrickLink calls time to complete.

## Step 5 — Trigger on initial item add

In `items.addTrackedItem`, after the snapshot scheduler, also schedule `signalScores.refreshItem` with `runAfter(30_000)` (30s — gives the first BrickLink fetch time to complete and write).

## Step 6 — UI

`pnpm dlx shadcn@latest add badge accordion progress`

- `src/components/verdict-card.tsx`: takes `signalScores` + `items` row, renders the verdict label, target price, confidence pill, explanation accordion, and the five-score bars.
- Use design tokens — never hardcode hex. The verdict→color map lives in `src/lib/verdict.ts`:
  - `STRONG_SIGNAL` → `primary` (#5e6ad2)
  - `GOOD_BELOW_TARGET` → `semantic-success` (#27a644)
  - `INTERESTING_RISKY` → `brand-secure` (#7a7fad)
  - `SCARCE_OVERPRICED`, `AVOID_HYPE` → `ink-muted` (#d0d6e0) on `surface-2`
  - `WATCH`, `IGNORE` → `ink-subtle` (#8a8f98)

## Step 7 — Validation

1. Add a well-supplied common minifig (e.g. Star Wars Stormtrooper) → after first verdict run, expect `IGNORE` or `WATCH`.
2. Add a low-listing magazine figure → expect `WATCH` initially, then potentially `STRONG_SIGNAL` after listing count drops.
3. Manually edit a snapshot row to simulate a price spike → re-run `refreshItem` → verdict shifts and explanation reflects the change.
4. Confirm a new item without history gets `WATCH`/`LOW` without burning a Claude call.

## Gotchas

- **Linear regression for slope** — implement, don't import. 2 lines of code; an extra dependency for this is overkill.
- **Prompt cache hit** depends on the system prompt being byte-stable. Define it as a `const SYSTEM_PROMPT` and never interpolate per-request data into it.
- **Explanation drift** — Claude will sometimes contradict the verdict ("buy now!" when verdict is `WATCH`). Lock the explanation by passing the verdict label *into the prompt* and instructing: "Justify the chosen verdict. Do not recommend a different action."
- **Theme median sold freq** — for demand normalization, computing this from the full DB on every refresh is expensive. Cache a per-theme median in a `themeStats` table updated weekly. **Defer to first follow-up** — for MVP, hardcode a global median.
