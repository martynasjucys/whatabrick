import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    region: v.union(
      v.literal("EU"),
      v.literal("UK"),
      v.literal("US"),
      v.literal("OTHER"),
    ),
    currency: v.union(v.literal("EUR"), v.literal("GBP"), v.literal("USD")),
    alertChannel: v.union(v.literal("email"), v.literal("none")),
    // undefined === enabled (preserves opt-in default for users created before
    // this field existed).
    weeklyDigestEnabled: v.optional(v.boolean()),
  }).index("by_clerk_id", ["clerkId"]),

  radars: defineTable({
    userId: v.id("users"),
    title: v.string(),
    freeformQuery: v.string(),
    niche: v.string(),
    theme: v.optional(v.string()),
    productType: v.optional(v.string()),
    region: v.union(
      v.literal("EU"),
      v.literal("UK"),
      v.literal("US"),
      v.literal("GLOBAL"),
    ),
    seedQueries: v.array(v.string()),
    alertPrefs: v.object({
      priceMovement: v.boolean(),
      scarcity: v.boolean(),
      newListing: v.boolean(),
    }),
    expansionStatus: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    expansionError: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  items: defineTable({
    rebrickableType: v.union(
      v.literal("minifig"),
      v.literal("part"),
      v.literal("set"),
    ),
    rebrickableId: v.string(),
    brickLinkId: v.optional(v.string()),
    name: v.string(),
    theme: v.optional(v.string()),
    releaseYear: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    uniqueParts: v.optional(v.array(v.string())),
    reissueRisk: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
    notes: v.optional(v.string()),
    // BrickLink integration status: set after the first refreshItem attempt.
    // "unpriced" means BrickLink either rejected every variant (catalog miss)
    // or we couldn't resolve a BrickLink id at all.
    bricklinkStatus: v.optional(
      v.union(v.literal("priced"), v.literal("unpriced")),
    ),
    bricklinkLastError: v.optional(v.string()),
    lastBrickLinkSyncAt: v.optional(v.number()),
  }).index("by_rebrickable", ["rebrickableType", "rebrickableId"]),

  trackedItems: defineTable({
    radarId: v.id("radars"),
    itemId: v.id("items"),
    userId: v.id("users"),
    addedAt: v.number(),
    // Buy target: alert when lowest listing drops to or below this price.
    targetPriceCents: v.optional(v.number()),
    // Sell target: alert when the going rate (qty-avg ask) rises to or
    // above this price — useful when the user already owns the item.
    sellTargetPriceCents: v.optional(v.number()),
    preferredCondition: v.optional(v.union(v.literal("N"), v.literal("U"))),
    notes: v.optional(v.string()),
  })
    .index("by_radar", ["radarId"])
    .index("by_item", ["itemId"])
    .index("by_user", ["userId"])
    .index("by_user_item", ["userId", "itemId"])
    .index("by_radar_item", ["radarId", "itemId"]),

  alerts: defineTable({
    userId: v.id("users"),
    itemId: v.id("items"),
    trackedItemId: v.id("trackedItems"),
    type: v.union(
      v.literal("PRICE_BELOW_TARGET"),
      v.literal("PRICE_ABOVE_SELL_TARGET"),
      v.literal("LISTING_COUNT_DROP"),
      v.literal("VERDICT_TRANSITION"),
      v.literal("NEW_LISTING_SPIKE"),
    ),
    payload: v.object({
      priceCents: v.optional(v.number()),
      currency: v.optional(v.string()),
      targetPriceCents: v.optional(v.number()),
      listingsBefore: v.optional(v.number()),
      listingsAfter: v.optional(v.number()),
      changePct: v.optional(v.number()),
      verdictFrom: v.optional(v.string()),
      verdictTo: v.optional(v.string()),
    }),
    triggeredAt: v.number(),
    readAt: v.optional(v.number()),
    emailedAt: v.optional(v.number()),
    dismissed: v.boolean(),
  })
    .index("by_user_time", ["userId", "triggeredAt"])
    .index("by_user_read", ["userId", "readAt"])
    .index("by_tracked_type_time", ["trackedItemId", "type", "triggeredAt"])
    .index("by_emailed", ["emailedAt"]),

  alertMutes: defineTable({
    userId: v.id("users"),
    itemId: v.optional(v.id("items")),
    radarId: v.optional(v.id("radars")),
    until: v.optional(v.number()),
  })
    .index("by_user_item", ["userId", "itemId"])
    .index("by_user_radar", ["userId", "radarId"]),

  signalScores: defineTable({
    itemId: v.id("items"),
    region: v.string(),
    date: v.number(),
    scarcityScore: v.number(),
    demandScore: v.number(),
    exclusivityScore: v.number(),
    momentumScore: v.number(),
    riskScore: v.number(),
    confidence: v.union(
      v.literal("LOW"),
      v.literal("MEDIUM"),
      v.literal("HIGH"),
    ),
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
    currentPriceCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    explanation: v.string(),
  }).index("by_item_date", ["itemId", "date"]),

  marketSnapshots: defineTable({
    itemId: v.id("items"),
    source: v.literal("bricklink"),
    guideType: v.union(v.literal("stock"), v.literal("sold")),
    condition: v.union(v.literal("N"), v.literal("U")),
    region: v.string(),
    currency: v.string(),
    date: v.number(),
    activeListingCount: v.optional(v.number()),
    totalQuantity: v.optional(v.number()),
    minPriceCents: v.number(),
    maxPriceCents: v.number(),
    avgPriceCents: v.number(),
    qtyAvgPriceCents: v.number(),
  })
    .index("by_item_date", ["itemId", "date"])
    .index("by_item_type_cond_date", [
      "itemId",
      "guideType",
      "condition",
      "date",
    ]),

  weeklyDigests: defineTable({
    userId: v.id("users"),
    weekStart: v.number(),
    content: v.object({
      intro: v.string(),
      sections: v.array(
        v.object({
          title: v.string(),
          items: v.array(
            v.object({
              itemId: v.id("items"),
              headline: v.string(),
              bodySm: v.string(),
              verdict: v.optional(v.string()),
              imageUrl: v.optional(v.string()),
            }),
          ),
        }),
      ),
    }),
    sentAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
  }).index("by_user_week", ["userId", "weekStart"]),
});
