/**
 * Pure deterministic scoring for items. No Convex deps — easy to reason about
 * and to unit-test later. All scores are 0..100; higher = stronger signal.
 *
 * Input shapes intentionally match what we can derive directly from
 * marketSnapshots + item metadata so callers don't need joins beyond that.
 */

export type SnapshotPoint = {
  date: number; // start-of-day UTC ms
  qtyAvgPriceCents: number;
  minPriceCents?: number;
  listingCount?: number;
  totalQuantity?: number;
};

export type ItemMeta = {
  uniqueParts?: string[];
  reissueRisk?: "low" | "medium" | "high";
};

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export type Scores = {
  scarcityScore: number;
  demandScore: number;
  exclusivityScore: number;
  momentumScore: number;
  riskScore: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n: number, lo = 0, hi = 100): number {
  if (!isFinite(n)) return lo;
  return Math.round(Math.max(lo, Math.min(hi, n)));
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

/**
 * Ordinary least-squares slope of (x, y) pairs. Returns 0 when the series is
 * degenerate or undefined.
 */
function slope(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  let sx = 0,
    sy = 0,
    sxy = 0,
    sxx = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxy += p.x * p.y;
    sxx += p.x * p.x;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

export function confidenceFromHistory(
  stock: SnapshotPoint[],
  sold: SnapshotPoint[],
): Confidence {
  const stockDays = stock.length;
  const soldRecords = sold.filter((s) => (s.totalQuantity ?? 0) > 0).length;
  if (stockDays >= 30 && soldRecords >= 5) return "HIGH";
  if (stockDays >= 7) return "MEDIUM";
  return "LOW";
}

/**
 * Scarcity: blend of low recent listings vs the series max and a falling
 * trend in listing count. No regional spread signal yet — we only track one
 * BrickLink region per radar in MVP.
 */
export function scarcityScore(stock: SnapshotPoint[]): number {
  if (stock.length < 2) return 0;
  const counts = stock
    .map((s) => s.listingCount ?? 0)
    .filter((n) => n > 0);
  if (counts.length === 0) return 0;
  const latest = counts[counts.length - 1];
  const max = Math.max(...counts);
  const inverseLevel = max > 0 ? 1 - latest / max : 0; // 0..1

  // Slope of listing count over the window in units/day. Negative slope =
  // shrinking supply = scarcer. We saturate at -1 listing/day -> full credit.
  const t0 = stock[0].date;
  const pts = stock.map((s) => ({
    x: (s.date - t0) / DAY_MS,
    y: s.listingCount ?? 0,
  }));
  const slp = slope(pts);
  const slopeNorm = clamp(-slp * 100, 0, 100) / 100;

  return clamp(inverseLevel * 60 + slopeNorm * 40);
}

/**
 * Momentum: positive slope of qty-avg ask price over time means prices are
 * trending up. Saturates at ~+5% per day -> 100.
 */
export function momentumScore(stock: SnapshotPoint[]): number {
  const series = lastN(stock, 30);
  if (series.length < 3) return 50; // neutral when uncertain
  const t0 = series[0].date;
  const baseline = series[0].qtyAvgPriceCents || 1;
  const pts = series.map((s) => ({
    x: (s.date - t0) / DAY_MS,
    y: s.qtyAvgPriceCents,
  }));
  const slp = slope(pts);
  const dailyPct = (slp / baseline) * 100; // % per day
  // Map -5%/day .. +5%/day -> 0..100, neutral at 50.
  return clamp(50 + dailyPct * 10);
}

/**
 * Demand: log-normalized sold transaction count over the window. We use
 * totalQuantity from the BrickLink sold guide as a proxy for liquidity.
 */
export function demandScore(sold: SnapshotPoint[]): number {
  const totals = lastN(sold, 30).map((s) => s.totalQuantity ?? 0);
  const sum = totals.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 0;
  // log scale: 1 sale -> ~0, 10 -> ~50, 100 -> ~100.
  return clamp(Math.log10(sum) * 50);
}

/**
 * Exclusivity is mostly static metadata. Without unique-parts data we return
 * a 50 neutral baseline and adjust by reissue risk.
 */
export function exclusivityScore(meta: ItemMeta): number {
  let base = 50;
  if (meta.uniqueParts && meta.uniqueParts.length > 0) {
    base += Math.min(30, meta.uniqueParts.length * 5);
  }
  if (meta.reissueRisk === "high") base -= 25;
  else if (meta.reissueRisk === "low") base += 10;
  return clamp(base);
}

/**
 * Risk: amplified by low sold volume + wide spread between min and max ask.
 * Reissue risk drives it up.
 */
export function riskScore(
  stock: SnapshotPoint[],
  sold: SnapshotPoint[],
  meta: ItemMeta,
): number {
  const latestStock = stock[stock.length - 1];
  const spreadRatio =
    latestStock && latestStock.qtyAvgPriceCents > 0 && latestStock.minPriceCents
      ? (latestStock.qtyAvgPriceCents - latestStock.minPriceCents) /
        latestStock.qtyAvgPriceCents
      : 0;
  const soldTotal = lastN(sold, 30).reduce(
    (a, s) => a + (s.totalQuantity ?? 0),
    0,
  );
  const lowVolume = soldTotal < 5 ? 1 : soldTotal < 20 ? 0.6 : 0;
  const reissueBoost =
    meta.reissueRisk === "high" ? 1 : meta.reissueRisk === "medium" ? 0.5 : 0;

  return clamp(
    lowVolume * 35 + spreadRatio * 100 * 0.35 + reissueBoost * 30,
  );
}

/**
 * Fair-buy target = 85% of the rolling median of sold qty-avg over the last
 * 30 days. Returns null when we have no sold data to anchor against.
 */
export function targetPriceCents(sold: SnapshotPoint[]): number | null {
  const prices = lastN(sold, 30)
    .map((s) => s.qtyAvgPriceCents)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid];
  return Math.round(median * 0.85);
}

export function computeAllScores(
  stock: SnapshotPoint[],
  sold: SnapshotPoint[],
  meta: ItemMeta,
): Scores {
  return {
    scarcityScore: scarcityScore(stock),
    demandScore: demandScore(sold),
    exclusivityScore: exclusivityScore(meta),
    momentumScore: momentumScore(stock),
    riskScore: riskScore(stock, sold, meta),
  };
}
