import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    // Denormalized copy of the username; the source of truth lives in the
    // auth username component until `syncUsername`/`onSignIn` copies it here.
    username: v.optional(v.string()),
    // Remaining AI generations. Optional so rows created before credits
    // existed stay valid; they're grandfathered the default grant on read.
    credits: v.optional(v.number()),
  }),
  skills: defineTable({
    userId: v.id("users"),
    name: v.string(),
    // The working copy shown in the skill's diff workspace.
    content: v.string(),
  }).index("by_userId", ["userId"]),
  revisions: defineTable({
    userId: v.id("users"),
    // The skill this revision belongs to. Optional so rows created before
    // skills existed remain valid; every new revision sets it.
    skillId: v.optional(v.id("skills")),
    // Optional display name; revisions are unnamed until the user titles them.
    name: v.optional(v.string()),
    original: v.string(),
    revised: v.string(),
    prompt: v.string(),
    model: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_skillId", ["skillId"]),
});
