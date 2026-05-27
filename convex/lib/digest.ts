/**
 * Pure builders for weekly-digest sections. Each function takes the data it
 * needs and returns either a section (with non-empty items) or null.
 *
 * Convex deps are kept out of here so the logic stays testable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type ItemLite = {
  _id: string;
  name: string;
  imageUrl?: string;
  theme?: string;
};

export type SnapshotLite = {
  date: number;
  guideType: "stock" | "sold";
  condition: "N" | "U";
  activeListingCount?: number;
  qtyAvgPriceCents: number;
};

export type ScoreLite = {
  _creationTime: number;
  date: number;
  verdict: string;
  currentPriceCents?: number;
  targetPriceCents?: number;
  currency?: string;
};

export type TrackedLite = {
  _id: string;
  itemId: string;
  addedAt: number;
  targetPriceCents?: number;
  preferredCondition?: "N" | "U";
};

export type AlertLite = {
  type:
    | "PRICE_BELOW_TARGET"
    | "PRICE_ABOVE_SELL_TARGET"
    | "LISTING_COUNT_DROP"
    | "VERDICT_TRANSITION"
    | "NEW_LISTING_SPIKE";
  itemId: string;
  triggeredAt: number;
  payload: {
    priceCents?: number;
    currency?: string;
    targetPriceCents?: number;
    listingsBefore?: number;
    listingsAfter?: number;
    changePct?: number;
    verdictFrom?: string;
    verdictTo?: string;
  };
};

export type Section = {
  title: string;
  items: Array<{
    itemId: string;
    headline: string;
    bodySm: string;
    verdict?: string;
    imageUrl?: string;
  }>;
};

function fmt(cents?: number, currency = "EUR") {
  if (cents === undefined) return "n/a";
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function itemLookup(items: ItemLite[]): Map<string, ItemLite> {
  return new Map(items.map((i) => [i._id, i]));
}

/** Items where 7-day rolling avg listing count dropped ≥30% vs prior 7 days. */
export function bucketHarderToFind(
  snapshots: SnapshotLite[],
  trackedByItem: Map<string, TrackedLite[]>,
  items: ItemLite[],
  now: number,
): Section | null {
  const lookup = itemLookup(items);
  const recentCutoff = now - 7 * DAY_MS;
  const priorCutoff = now - 14 * DAY_MS;

  const byItem = new Map<string, SnapshotLite[]>();
  for (const s of snapshots) {
    if (s.guideType !== "stock") continue;
    const list = byItem.get((s as SnapshotLite & { itemId: string }).itemId) ?? [];
    list.push(s);
    byItem.set((s as SnapshotLite & { itemId: string }).itemId, list);
  }

  type Row = Section["items"][number] & { pctChange: number };
  const rows: Row[] = [];

  for (const [itemId] of trackedByItem) {
    const series = (byItem.get(itemId) ?? []).filter(
      (s) => s.guideType === "stock",
    );
    const recent = series.filter((s) => s.date >= recentCutoff);
    const prior = series.filter(
      (s) => s.date >= priorCutoff && s.date < recentCutoff,
    );
    if (recent.length === 0 || prior.length === 0) continue;
    const recentAvg = avg(recent.map((s) => s.activeListingCount ?? 0));
    const priorAvg = avg(prior.map((s) => s.activeListingCount ?? 0));
    if (priorAvg === 0) continue;
    const ratio = recentAvg / priorAvg;
    if (ratio > 0.7) continue;
    const item = lookup.get(itemId);
    if (!item) continue;
    rows.push({
      itemId,
      headline: item.name,
      bodySm: `Active listings ${Math.round(priorAvg)} → ${Math.round(recentAvg)}`,
      imageUrl: item.imageUrl,
      pctChange: ratio - 1,
    });
  }

  rows.sort((a, b) => a.pctChange - b.pctChange);
  const top = rows.slice(0, 3);
  if (top.length === 0) return null;
  return {
    title: "Becoming harder to find",
    items: top.map(({ pctChange: _pctChange, ...rest }) => {
      void _pctChange;
      return rest;
    }),
  };
}

/** Items where PRICE_BELOW_TARGET alert fired in the past 7 days. */
export function bucketUnderTarget(
  alerts: AlertLite[],
  items: ItemLite[],
  now: number,
): Section | null {
  const lookup = itemLookup(items);
  const since = now - WEEK_MS;
  const rows = alerts
    .filter((a) => a.type === "PRICE_BELOW_TARGET" && a.triggeredAt >= since)
    .slice(0, 3)
    .map((a) => {
      const item = lookup.get(a.itemId);
      if (!item) return null;
      return {
        itemId: a.itemId,
        headline: item.name,
        bodySm: `Lowest dropped to ${fmt(a.payload.priceCents, a.payload.currency)} (target ${fmt(a.payload.targetPriceCents, a.payload.currency)})`,
        imageUrl: item.imageUrl,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (rows.length === 0) return null;
  return { title: "Watched items dropped below target", items: rows };
}

/** Verdicts assigned AVOID_HYPE this week. */
export function bucketHype(
  scoresByItem: Map<string, ScoreLite[]>,
  items: ItemLite[],
  now: number,
): Section | null {
  const lookup = itemLookup(items);
  const since = now - WEEK_MS;
  const rows: Section["items"] = [];
  for (const [itemId, scores] of scoresByItem) {
    const recent = scores.find(
      (s) => s.verdict === "AVOID_HYPE" && s._creationTime >= since,
    );
    if (!recent) continue;
    const item = lookup.get(itemId);
    if (!item) continue;
    rows.push({
      itemId,
      headline: item.name,
      bodySm: "Prices rising but sold-volume looks thin — possible hype.",
      verdict: "AVOID_HYPE",
      imageUrl: item.imageUrl,
    });
    if (rows.length === 2) break;
  }
  if (rows.length === 0) return null;
  return { title: "Suspicious hype this week", items: rows };
}

/** trackedItems added in the past 7 days. */
export function bucketNewlyTracked(
  tracked: TrackedLite[],
  items: ItemLite[],
  now: number,
): Section | null {
  const lookup = itemLookup(items);
  const since = now - WEEK_MS;
  const recent = tracked
    .filter((t) => t.addedAt >= since)
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, 5);
  if (recent.length === 0) return null;
  return {
    title: "New items you started tracking",
    items: recent
      .map((t) => {
        const item = lookup.get(t.itemId);
        if (!item) return null;
        return {
          itemId: t.itemId,
          headline: item.name,
          bodySm:
            t.targetPriceCents !== undefined
              ? `Target ${fmt(t.targetPriceCents)}`
              : "No buy target set",
          imageUrl: item.imageUrl,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

/** Verdicts that moved from WATCH/IGNORE to STRONG_SIGNAL/GOOD_BELOW_TARGET. */
export function bucketVerdictUpgrades(
  scoresByItem: Map<string, ScoreLite[]>,
  items: ItemLite[],
  now: number,
): Section | null {
  const lookup = itemLookup(items);
  const since = now - WEEK_MS;
  const rows: Section["items"] = [];
  const POSITIVE = new Set(["STRONG_SIGNAL", "GOOD_BELOW_TARGET"]);
  const SOFT = new Set(["WATCH", "IGNORE"]);
  for (const [itemId, scores] of scoresByItem) {
    const sorted = [...scores].sort((a, b) => a.date - b.date);
    let upgraded = false;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]._creationTime < since) continue;
      if (
        POSITIVE.has(sorted[i].verdict) &&
        SOFT.has(sorted[i - 1].verdict)
      ) {
        upgraded = true;
        const item = lookup.get(itemId);
        if (item) {
          rows.push({
            itemId,
            headline: item.name,
            bodySm: `Verdict ${sorted[i - 1].verdict} → ${sorted[i].verdict}`,
            verdict: sorted[i].verdict,
            imageUrl: item.imageUrl,
          });
        }
        break;
      }
    }
    if (upgraded && rows.length === 2) break;
  }
  if (rows.length === 0) return null;
  return { title: "Verdict upgrades", items: rows };
}

function avg(arr: number[]): number {
  const filtered = arr.filter((n) => n > 0);
  if (filtered.length === 0) return 0;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

export function startOfUtcWeek(ms: number): number {
  const d = new Date(ms);
  // Monday-anchored week. JS getUTCDay: Sun=0, Mon=1, ...
  const day = d.getUTCDay();
  const offset = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - offset);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}
