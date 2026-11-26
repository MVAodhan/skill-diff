import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";

/** Credits granted to a brand-new account; one generation costs one credit. */
export const DEFAULT_SIGNUP_CREDITS = 20;

/**
 * Copy the user's username from the auth username component into their row.
 * Idempotent: a no-op when the component has no username for the user or the
 * row is already up to date.
 */
const syncUsernameForUser = async (ctx: MutationCtx, userId: Id<"users">) => {
  const username = await ctx.runQuery(components.authUsername.public.getUsername, { userId });
  if (username === null) {
    return;
  }
  const user = await ctx.db.get(userId);
  if (user === null || user.username === username) {
    return;
  }
  await ctx.db.patch(userId, { username });
};

/**
 * Create the user row for a new password account and return its id.
 *
 * The sign-in method passes its profile here, but the username-password recipe
 * sends an empty one — it stores the username in the auth component only after
 * this row exists. The row therefore starts without a username; `onSignIn` and
 * `syncUsername` fill it in. The optional field keeps this callback ready if a
 * method ever passes the username in the profile.
 */
export const createUser = internalMutation({
  args: {
    method: v.object({
      name: v.literal("usernamePassword"),
      profile: v.object({
        username: v.optional(v.string()),
      }),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      username: args.method.profile.username,
      credits: DEFAULT_SIGNUP_CREDITS,
    });
  },
});

/**
 * Runs on every sign-in, right after `createUser` on the first one. Syncs the
 * username into the row once the auth component has it — which is *not* yet
 * true during the sign-up itself, so the sign-up page also calls
 * `syncUsername` right after account creation.
 */
export const onSignIn = internalMutation({
  args: {
    method: v.object({
      name: v.literal("usernamePassword"),
      profile: v.object({
        username: v.optional(v.string()),
      }),
    }),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await syncUsernameForUser(ctx, args.userId);
    return null;
  },
});

/**
 * Sync the signed-in user's username into their row. Called by the sign-up
 * page right after account creation; derives everything from the auth
 * context, trusting no client input.
 */
export const syncUsername = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    await syncUsernameForUser(ctx, userId);
    return null;
  },
});

/** The signed-in user's display info, or null when signed out. Credits are
 * normalized here so the frontend never needs the default constant. */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      username: v.optional(v.string()),
      credits: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      return null;
    }
    return {
      username: user.username,
      credits: user.credits ?? DEFAULT_SIGNUP_CREDITS,
    };
  },
});

/**
 * Charge one credit for a generation. Called up front, before the provider
 * call: the atomic check-and-decrement also caps how many generations can be
 * in flight at once, and failed generations get the credit back via
 * `refundCredit`.
 */
export const spendCredit = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (user === null) {
      throw new ConvexError("User not found.");
    }
    const credits = user.credits ?? DEFAULT_SIGNUP_CREDITS;
    if (credits < 1) {
      throw new ConvexError("You're out of credits.");
    }
    await ctx.db.patch(args.userId, { credits: credits - 1 });
    return null;
  },
});

/** Give back a credit after a failed generation (it was charged up front). */
export const refundCredit = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (user === null) {
      return null;
    }
    await ctx.db.patch(args.userId, {
      credits: (user.credits ?? DEFAULT_SIGNUP_CREDITS) + 1,
    });
    return null;
  },
});
