"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  priceGuide,
  resolveBrickLinkId,
  regionToCountryCode,
  TYPE_MAP,
  startOfUtcDay,
  toCents,
} from "./lib/bricklink";

const MANUAL_REFRESH_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h

export const refreshItem = internalAction({
  args: { itemId: v.id("items"), region: v.optional(v.string()) },
  handler: async (ctx, { itemId, region }) => {
    const item = await ctx.runQuery(internal.items._get, { itemId });
    if (!item) return;

    // Resolve BrickLink id (lazily cached on the item row).
    // If the item is currently "unpriced", clear the cache and re-resolve —
    // the cached id might be stale (e.g. wrong format from an earlier bug).
    let brickLinkId =
      item.bricklinkStatus === "unpriced" ? null : (item.brickLinkId ?? null);
    if (!brickLinkId) {
      brickLinkId = await resolveBrickLinkId({
        rebrickableType: item.rebrickableType,
        rebrickableId: item.rebrickableId,
      });
      if (brickLinkId) {
        await ctx.runMutation(internal.items._patchMetadata, {
          itemId,
          fields: { brickLinkId },
        });
      }
    }
    if (!brickLinkId) {
      await ctx.runMutation(internal.items._patchMetadata, {
        itemId,
        fields: {
          bricklinkStatus: "unpriced",
          bricklinkLastError:
            "This catalog item has no BrickLink cross-reference (often the case for magazine inserts and L-prefixed Rebrickable entries).",
          lastBrickLinkSyncAt: Date.now(),
        },
      });
      return;
    }

    const type = TYPE_MAP[item.rebrickableType];
    const today = startOfUtcDay(Date.now());
    const radarRegion = region ?? "EU";
    const countryCode = regionToCountryCode(radarRegion);

    let successes = 0;
    let lastError: string | undefined;

    for (const guideType of ["stock", "sold"] as const) {
      for (const cond of ["N", "U"] as const) {
        try {
          const data = await priceGuide({
            type,
            no: brickLinkId,
            guideType,
            newOrUsed: cond,
            countryCode,
          });

          // Skip empty market segments (no quantity / no price).
          if (
            !data.qty_avg_price ||
            parseFloat(data.qty_avg_price) === 0
          ) {
            continue;
          }

          await ctx.runMutation(internal.marketSnapshots._insert, {
            itemId,
            source: "bricklink",
            guideType,
            condition: cond,
            region: radarRegion,
            date: today,
            currency: data.currency_code,
            activeListingCount: data.unit_quantity,
            totalQuantity: data.total_quantity,
            minPriceCents: toCents(data.min_price),
            maxPriceCents: toCents(data.max_price),
            avgPriceCents: toCents(data.avg_price),
            qtyAvgPriceCents: toCents(data.qty_avg_price),
          });
          successes += 1;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          console.warn(
            `BrickLink ${guideType}/${cond} miss for ${type}/${brickLinkId}: ${lastError}`,
          );
        }
      }
    }

    await ctx.runMutation(internal.items._patchMetadata, {
      itemId,
      fields: {
        bricklinkStatus: successes > 0 ? "priced" : "unpriced",
        bricklinkLastError: successes > 0 ? undefined : lastError,
        lastBrickLinkSyncAt: Date.now(),
      },
    });

    // Chain verdict refresh — it's a cheap query + maybe one Claude call.
    // We do this unconditionally so even "unpriced" items get a WATCH/LOW
    // verdict row, which the UI can read.
    await ctx.scheduler.runAfter(
      0,
      internal.signalScoresActions.refreshItem,
      { itemId },
    );
  },
});

export const refreshAllTracked = internalAction({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.runQuery(internal.marketSnapshots._allTrackedItems);
    let offset = 0;
    for (const item of items) {
      await ctx.scheduler.runAfter(
        offset,
        internal.marketSnapshotsActions.refreshItem,
        { itemId: item._id },
      );
      // Pace at ~1.3 req/s aggregate (each item is up to 4 BrickLink calls,
      // so spacing by 3000ms keeps us well under the 5000/day quota even
      // at hundreds of tracked items).
      offset += 3000;
    }
  },
});

export const requestManualRefresh = action({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const latest = await ctx.runQuery(internal.marketSnapshots._latestForItem, {
      itemId,
    });
    if (
      latest &&
      Date.now() - latest._creationTime < MANUAL_REFRESH_COOLDOWN_MS
    ) {
      const minutesLeft = Math.ceil(
        (MANUAL_REFRESH_COOLDOWN_MS -
          (Date.now() - latest._creationTime)) /
          60_000,
      );
      throw new Error(
        `Already refreshed recently. Try again in ${minutesLeft} minutes.`,
      );
    }

    await ctx.scheduler.runAfter(
      0,
      internal.marketSnapshotsActions.refreshItem,
      { itemId },
    );
  },
});
