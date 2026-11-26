import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_NAME_LENGTH = 80;

/** Create an empty skill owned by the signed-in user; returns its id. */
export const create = mutation({
  args: { name: v.string() },
  returns: v.id("skills"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("You must be signed in.");
    }
    const name = args.name.trim().slice(0, MAX_NAME_LENGTH);
    if (name === "") {
      throw new ConvexError("Skill name can't be empty.");
    }
    return await ctx.db.insert("skills", { userId, name, content: "" });
  },
});

/** One of the signed-in user's skills, or null when it doesn't exist or
 * belongs to someone else. */
export const get = query({
  args: { id: v.id("skills") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const skill = await ctx.db.get(args.id);
    if (skill === null || skill.userId !== userId) {
      return null;
    }
    return skill;
  },
});

/** The signed-in user's skills, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return await ctx.db
      .query("skills")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
  },
});

/** Persist the skill's working copy (the diff workspace's original pane). */
export const updateContent = mutation({
  args: {
    id: v.id("skills"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("You must be signed in.");
    }
    const skill = await ctx.db.get(args.id);
    if (skill === null || skill.userId !== userId) {
      throw new ConvexError("Skill not found.");
    }
    await ctx.db.patch(args.id, { content: args.content });
    return null;
  },
});
