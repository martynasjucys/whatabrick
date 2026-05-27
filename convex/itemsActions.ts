"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { anthropic, MODEL } from "./lib/anthropic";
import {
  searchByType,
  type RebrickableHit,
  type RebrickableType,
} from "./lib/rebrickable";
import {
  catalogItem,
  normalizeBrickLinkImageUrl,
  type BrickLinkType,
} from "./lib/bricklink";

// BrickLink item-id patterns. We try these BEFORE the AI-driven path so that
// users who paste a BrickLink id (e.g. `sh0272`, `mc001`, `10261-1`) get an
// immediate authoritative match — Rebrickable's `?search=` doesn't query the
// external_ids field, so those ids would otherwise come up empty.
const BL_MINIFIG_ID = /^[a-z]{2,6}\d{2,6}$/i;
const BL_SET_ID = /^\d{3,7}(-\d+)?$/;
const BL_TYPE_MAP: Record<"minifig" | "set", BrickLinkType> = {
  minifig: "MINIFIG",
  set: "SET",
};

const SYSTEM_PROMPT = `You are a LEGO catalog query generator working inside the Whatabrick app.

Given a fuzzy item description (and optional radar context — theme, product type, niche), output 3 to 5 search queries that would surface the intended item on Rebrickable, plus a best guess at the item type.

Rebrickable accepts substring search on item names and id numbers. Useful query shapes:
- "<theme> <descriptor>"        e.g. "minecraft creeper"
- "<descriptor> <accessory>"    e.g. "skeleton horseman"
- A canonical name              e.g. "Stormtrooper (Plain Helmet)"
- An id if the user supplied one

You MUST classify itemTypeGuess as exactly ONE of:
- "minifig"  — a minifigure (most common for collectible niches)
- "part"     — an individual part (animals, accessories, signature pieces)
- "set"      — a complete set, polybag, or magazine foil-pack

When radar context provides a theme, bias your queries toward that theme. Use 3 to 5 distinct queries; avoid near-duplicates. Do not add prose — call the \`emit_search_queries\` tool exactly once.`;

export const searchByDescription = action({
  args: {
    query: v.string(),
    radarContext: v.optional(
      v.object({
        theme: v.optional(v.string()),
        productType: v.optional(v.string()),
        niche: v.optional(v.string()),
      }),
    ),
  },
  handler: async (_ctx, { query, radarContext }) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return { candidates: [] as ScoredCandidate[] };

    // Direct BrickLink id lookup — bypasses Rebrickable's name-only search.
    const blDirect = await tryBrickLinkIdLookup(trimmed);
    if (blDirect) {
      return {
        candidates: blDirect.candidates,
        queries: [trimmed],
        itemTypeGuess: blDirect.type,
      };
    }

    const client = anthropic();
    const response = await client.messages.create({
      model: MODEL.haiku,
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: "emit_search_queries",
          description:
            "Emit 3 to 5 Rebrickable search queries plus a best guess at the item type.",
          input_schema: {
            type: "object",
            required: ["queries", "itemTypeGuess"],
            properties: {
              queries: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 5,
              },
              itemTypeGuess: {
                type: "string",
                enum: ["minifig", "part", "set"],
              },
            },
          },
        },
      ],
      tool_choice: { type: "tool", name: "emit_search_queries" },
      messages: [
        {
          role: "user",
          content: `${
            radarContext
              ? `Radar context: theme=${radarContext.theme ?? "(none)"}, productType=${radarContext.productType ?? "(none)"}, niche=${radarContext.niche ?? "(none)"}\n\n`
              : ""
          }User query: ${trimmed}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Extract<typeof block, { type: "tool_use" }> =>
        block.type === "tool_use",
    );
    if (!toolUse) throw new Error("Model did not emit a tool call");

    const input = toolUse.input as {
      queries: string[];
      itemTypeGuess: RebrickableType;
    };

    // Always include the raw user input so we don't depend solely on the AI's
    // phrasing — Rebrickable substring search prefers short canonical names.
    const aiQueries = input.queries.filter(
      (q) => q.toLowerCase().trim() !== trimmed.toLowerCase(),
    );
    const allQueries = [trimmed, ...aiQueries];

    const settled = await Promise.allSettled(
      allQueries.map((q) => searchByType(input.itemTypeGuess, q, 10)),
    );

    const failures = settled
      .filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      )
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
    const successes = settled.filter(
      (r): r is PromiseFulfilledResult<RebrickableHit[]> =>
        r.status === "fulfilled",
    );

    if (successes.length === 0) {
      throw new Error(
        `Rebrickable search failed for every query. First error: ${failures[0] ?? "unknown"}`,
      );
    }

    // Score: count of queries the item appeared in (desc), then best rank (asc).
    const scoreMap = new Map<
      string,
      { hit: RebrickableHit; appearances: number; bestRank: number }
    >();
    successes.forEach((res) => {
      res.value.forEach((hit, rank) => {
        const key = `${hit.type}:${hit.id}`;
        const prev = scoreMap.get(key);
        if (prev) {
          prev.appearances += 1;
          prev.bestRank = Math.min(prev.bestRank, rank);
        } else {
          scoreMap.set(key, { hit, appearances: 1, bestRank: rank });
        }
      });
    });

    // If the guessed type returned nothing, fall back to the other two types
    // using the raw user input. Cheap and rescues bad type guesses.
    if (scoreMap.size === 0) {
      const otherTypes = (["minifig", "part", "set"] as const).filter(
        (t) => t !== input.itemTypeGuess,
      );
      const fallback = await Promise.allSettled(
        otherTypes.map((t) => searchByType(t, trimmed, 10)),
      );
      fallback.forEach((res) => {
        if (res.status !== "fulfilled") return;
        res.value.forEach((hit, rank) => {
          const key = `${hit.type}:${hit.id}`;
          if (!scoreMap.has(key)) {
            scoreMap.set(key, { hit, appearances: 1, bestRank: rank });
          }
        });
      });
    }

    const candidates: ScoredCandidate[] = [...scoreMap.values()]
      .sort(
        (a, b) =>
          b.appearances - a.appearances || a.bestRank - b.bestRank,
      )
      .slice(0, 8)
      .map(({ hit }) => ({
        rebrickableType: hit.type,
        rebrickableId: hit.id,
        name: hit.name,
        imageUrl: hit.imageUrl,
        releaseYear: hit.year,
      }));

    return { candidates, itemTypeGuess: input.itemTypeGuess, queries: input.queries };
  },
});

export const searchByBrickLinkId = action({
  args: { id: v.string() },
  handler: async (_ctx, { id }) => {
    const trimmed = id.trim();
    if (!trimmed) return { candidates: [] as ScoredCandidate[] };
    // BrickLink minifig ids (e.g. "mc001") are searchable on Rebrickable's
    // minifig name/number index via substring; sets use their plain set number.
    const results = await Promise.allSettled([
      searchByType("minifig", trimmed, 5),
      searchByType("set", trimmed, 5),
      searchByType("part", trimmed, 5),
    ]);
    const merged: RebrickableHit[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") merged.push(...r.value);
    }
    const candidates: ScoredCandidate[] = merged.slice(0, 8).map((hit) => ({
      rebrickableType: hit.type,
      rebrickableId: hit.id,
      name: hit.name,
      imageUrl: hit.imageUrl,
      releaseYear: hit.year,
    }));
    return { candidates };
  },
});

type ScoredCandidate = {
  rebrickableType: RebrickableType;
  rebrickableId: string;
  brickLinkId?: string;
  name: string;
  imageUrl?: string;
  releaseYear?: number;
};

/**
 * Detect when the user's query looks like a BrickLink item id (e.g. `sh0272`,
 * `mc001`, `10261-1`) and look it up directly against BrickLink's catalog.
 * Rebrickable's `?search=` doesn't query the external_ids field, so these
 * would otherwise come up empty.
 *
 * When BrickLink confirms the item, we also try a Rebrickable name search to
 * recover the canonical rebrickableId. Falls back to a synthetic record using
 * the BrickLink id as the rebrickableId for dedupe purposes.
 */
async function tryBrickLinkIdLookup(
  raw: string,
): Promise<{ type: RebrickableType; candidates: ScoredCandidate[] } | null> {
  const trimmed = raw.trim();
  let type: keyof typeof BL_TYPE_MAP | null = null;
  if (BL_MINIFIG_ID.test(trimmed)) type = "minifig";
  else if (BL_SET_ID.test(trimmed)) type = "set";
  if (!type) return null;

  let blItem;
  try {
    blItem = await catalogItem({ type: BL_TYPE_MAP[type], no: trimmed });
  } catch {
    return null;
  }

  const imageUrl = normalizeBrickLinkImageUrl(blItem.image_url);

  // Try to enrich with the Rebrickable canonical id by searching its name.
  const rbHits = await searchByType(type, blItem.name, 5).catch(() => [] as RebrickableHit[]);
  if (rbHits.length > 0) {
    const candidates: ScoredCandidate[] = rbHits.slice(0, 3).map((hit) => ({
      rebrickableType: hit.type,
      rebrickableId: hit.id,
      brickLinkId: blItem.no,
      name: hit.name,
      imageUrl: hit.imageUrl ?? imageUrl,
      releaseYear: hit.year ?? blItem.year_released,
    }));
    return { type, candidates };
  }

  // No Rebrickable match — surface the BrickLink item directly. We use the
  // BrickLink id as the synthetic rebrickableId so the dedupe index still
  // works (BrickLink ids and Rebrickable ids don't collide in practice).
  return {
    type,
    candidates: [
      {
        rebrickableType: type,
        rebrickableId: blItem.no,
        brickLinkId: blItem.no,
        name: blItem.name,
        imageUrl,
        releaseYear: blItem.year_released,
      },
    ],
  };
}
