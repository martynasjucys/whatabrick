# Item Verdicts — SPEC

**Purpose:** Turn raw market snapshots into beginner-friendly verdicts ("Watch", "Good below €6", "Avoid hype price") plus a plain-language explanation. This is the *intelligence layer* that differentiates Whatabrick from BrickEconomy/BrickLink.

**Depends on:** `market-tracking`.

## User stories
1. As a beginner, I see a single clear label per tracked item — not a number — telling me roughly what to do.
2. As a curious user, I can expand the verdict and read 2–4 sentences of AI-generated reasoning grounded in *my* data (recent prices, listing count trend, sold-vs-stock spread).
3. As a serious collector, I see five lightweight scores (scarcity, demand, exclusivity, momentum, risk) on a 0–100 scale to skim a long list quickly.

## Scope

**In:**
- Computed signal scores from market snapshots (deterministic formulas, no AI).
- AI verdict + explanation written by Claude Sonnet using the scores + recent snapshots as input.
- Daily verdict refresh after the market cron completes.
- "Confidence" label: HIGH if ≥30 days of snapshots and ≥5 sold data points; MEDIUM if ≥7 days; LOW otherwise.

**Out:**
- Cross-item portfolio scoring.
- Price prediction.
- Sentiment scraping (Reddit/YouTube chatter — plan §6 "demand factors" — defer to Phase 3).

## Data model

```ts
signalScores: defineTable({
  itemId: v.id("items"),
  region: v.string(),
  date: v.number(),                       // start-of-day UTC
  scarcityScore: v.number(),              // 0..100
  demandScore: v.number(),
  exclusivityScore: v.number(),
  momentumScore: v.number(),
  riskScore: v.number(),
  confidence: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH")),
  verdict: v.union(
    v.literal("IGNORE"),
    v.literal("WATCH"),
    v.literal("GOOD_BELOW_TARGET"),
    v.literal("INTERESTING_RISKY"),
    v.literal("SCARCE_OVERPRICED"),
    v.literal("STRONG_SIGNAL"),
    v.literal("AVOID_HYPE"),
  ),
  targetPriceCents: v.optional(v.number()),
  explanation: v.string(),                // AI-generated, 2–4 sentences
}).index("by_item_date", ["itemId", "date"]),
```

## Scoring formulas (deterministic — no AI)

All scores 0–100, computed from snapshot history.

- **scarcityScore**: weighted blend of
  - `1 - normalized(activeListingCount over 30 days)` × 60
  - `slope(activeListingCount, last 14 days)` (negative slope = scarcer) × 30
  - presence in only one region × 10
- **momentumScore**: `slope(qty_avg_price stock, last 30 days)` normalized to 0–100. Positive slope = positive momentum.
- **demandScore**: `count(sold price_detail records, last 30 days)` log-normalized vs theme median. Higher sold-frequency = higher demand.
- **exclusivityScore**: from item metadata (`uniqueParts.length`, `reissueRisk`, magazine/region-only flags). Static-ish — recompute when item metadata changes.
- **riskScore**: high when sold-volume is low AND price spread (max-min) is wide AND `reissueRisk` is high. Penalizes hype.

Implement each as a pure function in `convex/lib/scoring.ts`. Unit-test with synthetic snapshots.

## Verdict picker

Decision tree (after scores computed):

```
if confidence == LOW → WATCH
elif scarcityScore > 70 and momentumScore > 60 and riskScore < 50 → STRONG_SIGNAL
elif scarcityScore > 70 and momentumScore > 60 and riskScore >= 50 → INTERESTING_RISKY
elif scarcityScore > 60 and currentPrice > targetPrice * 1.4 → SCARCE_OVERPRICED
elif momentumScore > 70 and demandScore < 30 → AVOID_HYPE
elif currentPrice < targetPrice → GOOD_BELOW_TARGET
elif scarcityScore < 30 and momentumScore < 30 → IGNORE
else → WATCH
```

`targetPrice` is computed as 30-day rolling median of `sold qty_avg` minus 15% (i.e. the "fair buy" price).

## AI explanation

After scores + verdict computed, call Claude Sonnet:

System (cached): the full rubric of what each verdict means, the five scores' meanings, and the "explain in 2–4 sentences for a beginner collector" guidance.

User input: a compact JSON of the latest stats and the chosen verdict.

Tool: `emit_explanation(text: string, targetPriceCents: number | null)`.

Why AI for explanation but not scoring? Scoring must be deterministic and explainable; the explanation is the human-readable layer where Claude is genuinely better than templated copy.

## Convex function surface

- `signalScores.latest` — query: latest row for an item.
- `signalScores.refreshItem` — internal action: pulls last 90 days of snapshots, computes scores, picks verdict, calls Claude for explanation, writes row.
- `signalScores.refreshAllTracked` — internal action: scheduled to run via cron 30 minutes after the market-tracking cron.

## UI

On the item detail page, add a `VerdictCard` above the market chart:
- Big verdict label as `headline` (28px) — color-coded badge based on verdict (lavender for STRONG_SIGNAL, ink-subtle for WATCH/IGNORE, brand-secure muted lavender for risky, success-green for GOOD_BELOW_TARGET).
- Below the label: target price ("Fair buy ≤ €6.40").
- Confidence pill (`status-badge` token).
- Expandable explanation (`subhead` 20px).
- Five score bars (slim, 4px tall, ink-subtle track, lavender fill).

On the radar detail page, each tracked-item card shows just the verdict badge + price.

## Success criteria
- For an item with 30+ days of snapshots, the verdict refreshes daily and reads coherently.
- Items with <7 days of data show "WATCH" with confidence=LOW and an explanation that mentions insufficient data.
- Re-running `refreshItem` on the same day overwrites instead of appending.

## Open questions
- Should the verdict change trigger an alert? Default: yes for transitions into `STRONG_SIGNAL`, `GOOD_BELOW_TARGET`, `AVOID_HYPE`. Implemented in `alerts` feature.
- Score weighting will need tuning. Ship defaults; add a flag to log all inputs for retrospective tuning.
