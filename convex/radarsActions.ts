"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { anthropic, MODEL } from "./lib/anthropic";

const NICHE_SLUGS = [
  "magazine_minifigures",
  "polybags",
  "gift_with_purchase",
  "retired_sets",
  "rare_animals",
  "discontinued",
  "regional_exclusives",
  "other",
] as const;

const SYSTEM_PROMPT = `You are a LEGO collectibles research assistant working inside the Whatabrick app.

Whatabrick helps beginner-to-mid LEGO collectors track scarcity and price signals on small, niche LEGO items: magazine minifigures, polybags, gift-with-purchase sets, retiring sets, rare animals or accessories, and regional exclusives. It is not a generic collection manager and not an investment predictor — it is a research assistant + market radar.

Your job: given a freeform niche description from a user, classify it into a known niche category and produce a structured radar definition that the rest of the app can use to track items on BrickLink and Rebrickable.

You MUST classify niche into exactly ONE of these slugs:
- magazine_minifigures — figures distributed in monthly LEGO magazines (Minecraft, Ninjago, City, Star Wars, etc.).
- polybags — small sealed polybag promotional sets.
- gift_with_purchase — exclusive sets handed out with qualifying LEGO.com purchases (GWP).
- retired_sets — sets recently discontinued, especially Modular, Star Wars UCS, Technic flagships.
- rare_animals — uncommon animal/accessory parts (white dog, dragon, snake, parrot, etc.).
- discontinued — cancelled or pulled sets, prototypes, never-released variants.
- regional_exclusives — sets released in only one region or market.
- other — does not fit any of the above; describe in title and seedQueries instead.

REGION RULES:
- If the user explicitly mentions a region (EU, UK, US, Europe, America, Lithuania, Germany, etc.), use the closest match: EU | UK | US | GLOBAL.
- Otherwise fall back to the user's profile region provided in the user message.
- "Worldwide", "global", "any region" -> GLOBAL.

SEED QUERIES (3 to 6 of them):
- Strings a collector could paste into BrickLink or Rebrickable search.
- Include the theme name and the figure/set descriptor.
- Cover obvious type variants: e.g. "Minecraft magazine minifig", "Minecraft polybag", "LEGO Minecraft creeper figure".
- Prefer specific over generic. Avoid duplicates.

TITLE:
- Short, human-friendly label for the radar (3 to 7 words). Capitalize naturally. No surrounding quotes.

You MUST respond by calling the \`emit_radar_definition\` tool exactly once. Do not add any other prose, explanations, or tool calls.`;

export const expandWithAi = internalAction({
  args: { radarId: v.id("radars") },
  handler: async (ctx, { radarId }) => {
    const radar = await ctx.runQuery(internal.radars._getInternal, { radarId });
    if (!radar) return;

    try {
      const client = anthropic();
      const response = await client.messages.create({
        model: MODEL.sonnet,
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            name: "emit_radar_definition",
            description:
              "Emit the structured radar definition derived from the user's freeform niche description.",
            input_schema: {
              type: "object",
              required: ["title", "niche", "region", "seedQueries"],
              properties: {
                title: {
                  type: "string",
                  description: "Short human-friendly radar title (3 to 7 words).",
                },
                niche: { type: "string", enum: [...NICHE_SLUGS] },
                theme: {
                  type: "string",
                  description:
                    "LEGO theme if applicable (Minecraft, Ninjago, Star Wars, City, Technic, Castle, etc.). Omit if none.",
                },
                productType: {
                  type: "string",
                  description:
                    "Product format slug (e.g. magazine_foil_pack, polybag, set, minifig_pack). Omit if unclear.",
                },
                region: {
                  type: "string",
                  enum: ["EU", "UK", "US", "GLOBAL"],
                },
                seedQueries: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 6,
                },
              },
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_radar_definition" },
        messages: [
          {
            role: "user",
            content: `User profile region: ${radar.region}\n\nFreeform niche description:\n${radar.freeformQuery}`,
          },
        ],
      });

      const toolUse = response.content.find(
        (block): block is Extract<typeof block, { type: "tool_use" }> =>
          block.type === "tool_use",
      );
      if (!toolUse) throw new Error("Model did not emit a tool call");

      const input = toolUse.input as {
        title: string;
        niche: string;
        theme?: string;
        productType?: string;
        region: "EU" | "UK" | "US" | "GLOBAL";
        seedQueries: string[];
      };

      if (!NICHE_SLUGS.includes(input.niche as (typeof NICHE_SLUGS)[number])) {
        throw new Error(`Model returned unknown niche slug: ${input.niche}`);
      }

      await ctx.runMutation(internal.radars._applyExpansion, {
        radarId,
        fields: {
          title: input.title,
          niche: input.niche,
          theme: input.theme || undefined,
          productType: input.productType || undefined,
          region: input.region,
          seedQueries: input.seedQueries,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.radars._markFailed, {
        radarId,
        error: message,
      });
    }
  },
});
