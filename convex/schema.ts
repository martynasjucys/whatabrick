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
});
