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
});
