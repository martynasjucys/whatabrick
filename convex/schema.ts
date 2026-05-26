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
  }).index("by_rebrickable", ["rebrickableType", "rebrickableId"]),

  trackedItems: defineTable({
    radarId: v.id("radars"),
    itemId: v.id("items"),
    userId: v.id("users"),
    addedAt: v.number(),
    targetPriceCents: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_radar", ["radarId"])
    .index("by_item", ["itemId"])
    .index("by_radar_item", ["radarId", "itemId"]),
});
