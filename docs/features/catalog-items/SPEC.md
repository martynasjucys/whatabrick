# Catalog Items — SPEC

**Purpose:** Resolve fuzzy user descriptions ("chicken guy minifig", "white dog from old city set") into concrete LEGO catalog entries (minifigs, parts, sets) using Rebrickable as the source of truth. Provide an item detail page that other features (market tracking, verdicts) attach data to.

**Depends on:** `foundation`. Can be built in parallel with `radars`.

## User stories
1. As a user, I type a fuzzy description into a search box on my radar page and get a ranked list of catalog matches with thumbnails.
2. As a user, I click a match → it becomes a tracked item on the radar and gets its own detail page.
3. As a user, I can also paste a BrickLink minifig id (e.g. `mc001`) and add it directly.

## Scope

**In:**
- Item resolver: Claude generates candidate Rebrickable search queries; Rebrickable API returns hits; results merged and ranked.
- Item ingestion: when a user picks a candidate, we upsert it into our `items` table with catalog metadata.
- Item detail page (shell only — market data and verdict come from later features).
- Linking items to radars via `trackedItems` join table.

**Out:**
- Auto-discovery of new items inside a radar's niche (Phase 3).
- Image recognition / barcode scanning (Phase 4).
- Custom user-uploaded items.

## Data model

```ts
items: defineTable({
  rebrickableType: v.union(v.literal("minifig"), v.literal("part"), v.literal("set")),
  rebrickableId: v.string(),       // e.g. "fig-001234", "3001", "10211-1"
  brickLinkId: v.optional(v.string()),
  name: v.string(),
  theme: v.optional(v.string()),
  releaseYear: v.optional(v.number()),
  imageUrl: v.optional(v.string()),
  uniqueParts: v.optional(v.array(v.string())),
  reissueRisk: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
  notes: v.optional(v.string()),
}).index("by_rebrickable", ["rebrickableType", "rebrickableId"]),

trackedItems: defineTable({
  radarId: v.id("radars"),
  itemId: v.id("items"),
  userId: v.id("users"),
  addedAt: v.number(),
  targetPriceCents: v.optional(v.number()),    // for alerts feature
  notes: v.optional(v.string()),
}).index("by_radar", ["radarId"]).index("by_item", ["itemId"]),
```

`items` is global (deduped across users); `trackedItems` is per-user-per-radar.

## Convex function surface

- `items.searchByDescription` — action: takes `{ query: string, radarContext?: { theme?, productType? } }`. Calls Claude Haiku to generate 3–5 Rebrickable query strings, fans out to Rebrickable, returns merged candidates with relevance scores. No DB write.
- `items.searchByBrickLinkId` — action: looks up the BrickLink id in Rebrickable's cross-reference (`/api/v3/lego/minifigs/?search=...`), returns at most one candidate.
- `items.addTrackedItem` — mutation: takes `{ radarId, candidate }`. Upserts into `items` (dedupe by `(rebrickableType, rebrickableId)`), creates `trackedItems` row.
- `items.removeTrackedItem` — mutation.
- `items.listForRadar` — query: returns the joined items for a radar.
- `items.get` — query: single item + its trackedItem context for the current user.

## Rebrickable API

Base: `https://rebrickable.com/api/v3/lego/`
Auth: `Authorization: key {REBRICKABLE_API_KEY}` header.
Endpoints used:
- `minifigs/?search={q}` — minifig search
- `parts/?search={q}`
- `sets/?search={q}` (mostly for "rare animals from set" disambiguation)
- `minifigs/{set_num}/` — full detail when ingesting

Rate limit is generous (10k/day default) — no per-request caching required, but cache resolver results in the action's response so the UI can stream them.

## AI prompt (resolver)

System (cached):
> You are a LEGO catalog query generator. Given a fuzzy item description and optional radar context (theme, product type), output 3–5 Rebrickable search queries that would surface the intended item. Prefer queries that include the theme name, the figure descriptor, and any signature accessories. Output as a `emit_search_queries` tool call.

Tool: `emit_search_queries(queries: string[], itemTypeGuess: "minifig" | "part" | "set")`.

Model: Claude Haiku 4.5 — disambiguation is cheap and we want it fast.

## UI / pages

- `/(app)/radars/[id]` — adds an "Add item" section: search input + results list.
  - Each result card shows thumbnail, name, theme, year, "Add" button.
- `/(app)/items/[id]` — item detail shell. For this feature, just metadata + thumbnail + "Remove from radar" + notes textarea. Market chart and verdict are placeholder cards (filled by later features).

## Success criteria
- "creeper figure from minecraft magazine" returns at least one creeper minifig in top 3 results.
- "white dog from old city set" returns minifigs that include a white dog accessory.
- Adding an item to a radar persists and shows up in the radar's tracked-items list.
- Re-adding the same item to the same radar is a no-op (dedupe).

## Open questions
- Should we store full Rebrickable response or just our subset? Default: subset. Re-fetch on demand if we need more.
- How long to retain item rows when no radar tracks them? MVP: never delete (global catalog).
