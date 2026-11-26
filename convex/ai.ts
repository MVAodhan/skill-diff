import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { GenericDataModel, GenericQueryCtx } from "convex/server";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";

const MODEL = "z-ai/glm-5.3-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You revise AI agent skill documents written in Markdown.

You will receive the current skill inside <current_skill> tags (it may be empty, in which case you create a new skill from scratch) and the requested changes inside <requested_changes> tags.

Rules:
- Return the COMPLETE revised skill markdown: the full document, never a patch or a snippet.
- Apply only the requested changes; preserve everything else, including wording the user didn't ask to change.
- Keep valid Markdown structure (headings, lists, code fences).
- Output ONLY the revised markdown. No explanations, no preamble, and do not wrap the whole document in a code fence.`;

/** Models like to wrap the whole document in a fence; strip exactly that. */
const stripOuterCodeFence = (markdown: string): string =>
  markdown.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n?```\s*$/i, "$1");

export const generateDiff = action({
  args: {
    skillId: v.id("skills"),
    markdown: v.string(),
    prompt: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // `getAuthUserId` works in actions at runtime, but its type only accepts
    // the query/mutation `runQuery` shape (the action ctx's `runQuery` gained
    // an options parameter its type doesn't mention), so adapt it explicitly.
    const userId = await getAuthUserId({
      auth: ctx.auth,
      runQuery: ctx.runQuery as GenericQueryCtx<GenericDataModel>["runQuery"],
    });
    if (userId === null) {
      throw new ConvexError("You must be signed in to generate revisions.");
    }

    const skill = await ctx.runQuery(api.skills.get, { id: args.skillId });
    if (skill === null) {
      throw new ConvexError("Skill not found.");
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ConvexError("The AI provider is not configured (missing OPENROUTER_API_KEY).");
    }

    // Charge the credit up front: the atomic spend doubles as the concurrency
    // cap, so parallel requests can never put more provider calls in flight
    // than the balance allows. Failed generations refund below, so they stay
    // free.
    await ctx.runMutation(internal.users.spendCredit, { userId });

    let revised: string;
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `<current_skill>\n${args.markdown}\n</current_skill>\n\n<requested_changes>\n${args.prompt}\n</requested_changes>`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`OpenRouter error ${response.status}:`, body.slice(0, 500));
        throw new ConvexError(
          `The AI provider returned an error (${response.status}). Try again in a moment.`,
        );
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") {
        throw new ConvexError("The AI returned an empty revision. Try rephrasing your prompt.");
      }
      revised = stripOuterCodeFence(content);
    } catch (error) {
      // Failed generations are free: give the charged credit back.
      await ctx.runMutation(internal.users.refundCredit, { userId });
      throw error;
    }

    await ctx.runMutation(internal.revisions.save, {
      userId,
      skillId: args.skillId,
      original: args.markdown,
      prompt: args.prompt,
      revised,
      model: MODEL,
    });
    return revised;
  },
});
