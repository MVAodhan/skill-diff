import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const MAX_NAME_LENGTH = 80;

/**
 /** Append a finished generation to its skill's history. Called by the
 * `generateDiff` action after the provider returns a usable revision. */
export const save = internalMutation({
  args: {
    userId: v.id("users"),
    skillId: v.id("skills"),
    original: v.string(),
    prompt: v.string(),
    revised: v.string(),
    model: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("revisions", args);
    return null;
  },
});

/** The revisions of one of the signed-in user's skills, newest first. */
export const listForSkill = query({
  args: { skillId: v.id("skills") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const skill = await ctx.db.get(args.skillId);
    if (skill === null || skill.userId !== userId) {
      return [];
    }
    return await ctx.db
      .query("revisions")
      .withIndex("by_skillId", (q) => q.eq("skillId", args.skillId))
      .order("desc")
      .take(50);
  },
});

/** One of the signed-in user's revisions, or null when it doesn't exist or
 * belongs to someone else. */
export const get = query({
  args: { id: v.id("revisions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const revision = await ctx.db.get(args.id);
    if (revision === null || revision.userId !== userId) {
      return null;
    }
    return revision;
  },
});

/**
 * Set (or clear, with an empty name) the display name of one of the signed-in
 * user's revisions.
 */
export const rename = mutation({
  args: {
    id: v.id("revisions"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("You must be signed in.");
    }
    const revision = await ctx.db.get(args.id);
    if (revision === null || revision.userId !== userId) {
      throw new ConvexError("Revision not found.");
    }
    const trimmed = args.name.trim();
    await ctx.db.patch(args.id, {
      name: trimmed === "" ? undefined : trimmed.slice(0, MAX_NAME_LENGTH),
    });
    return null;
  },
});
