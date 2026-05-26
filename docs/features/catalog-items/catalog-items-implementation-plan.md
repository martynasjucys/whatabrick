# Catalog Items — Implementation Plan

## Step 1 — Schema

Add `items` and `trackedItems` to `convex/schema.ts` per SPEC. The `by_rebrickable` index is the dedupe key — never insert without checking it first.

## Step 2 — Rebrickable client

Create `convex/lib/rebrickable.ts`:

```ts
const BASE = "https://rebrickable.com/api/v3/lego";
const headers = () => ({ Authorization: `key ${process.env.REBRICKABLE_API_KEY}` });

export async function searchMinifigs(q: string) {
  const url = `${BASE}/minifigs/?search=${encodeURIComponent(q)}&page_size=10`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Rebrickable ${res.status}`);
  return res.json() as Promise<{ results: RebrickableMinifig[] }>;
}
```

Add equivalent `searchParts`, `searchSets`. Also `getMinifig(setNum)` for ingestion.

Keep this file pure-fetch — no Convex deps — so it's reusable from any action.

## Step 3 — Resolver action

Create `convex/itemsActions.ts` (with `"use node"`):

1. `searchByDescription` action:
   - Call Claude Haiku with the resolver system prompt + user query + radar context.
   - Parse the `emit_search_queries` tool result.
   - For each query, hit the matching Rebrickable endpoint based on `itemTypeGuess`.
   - Merge results, dedupe by `(type, id)`, score by: (a) appearance count across queries, (b) Rebrickable result rank, (c) string similarity to the original user input.
   - Return top 8.

2. `searchByBrickLinkId` action: direct Rebrickable lookup, no AI.

## Step 4 — Mutations

`convex/items.ts`:
- `addTrackedItem`: check ownership of the radar, upsert into `items` (by `rebrickable_id+type`), insert `trackedItems`.
- `removeTrackedItem`.
- `listForRadar`: join `trackedItems` → `items`, return enriched rows.

## Step 5 — UI

`pnpm dlx shadcn@latest add command popover` (for the search combobox).

- `src/app/(app)/radars/[id]/_components/item-search.tsx`: client component with debounced input → `useAction(api.itemsActions.searchByDescription)` → results list. Each result has thumbnail, name (text-ink), meta (text-ink-subtle, body-sm), "Add" button (button-secondary).
- `src/app/(app)/radars/[id]/_components/tracked-items.tsx`: uses `useQuery(api.items.listForRadar)`.
- `src/app/(app)/items/[id]/page.tsx`: server component, `params.id` is `Promise<{id}>` in Next 16 — `await params`.

## Step 6 — Validation

1. On a radar detail page, type "creeper" → results show creeper minifigs from Minecraft theme.
2. Click "Add" → item appears in tracked list, button switches to "Added".
3. Open item detail → thumbnail + metadata visible, notes textarea persists on blur.
4. Paste `mc001` into a separate "By BrickLink ID" input → resolves to the corresponding minifig.

## Gotchas

- **Rebrickable thumbnails** can 404 or return placeholder gifs for older entries. Store the URL but use a `next/image` `onError` fallback.
- **`page_size` cap** is 1000 but per-search 10 is plenty and keeps latency under ~300ms.
- **Search debounce** at 300ms client-side. AI call is the expensive part — don't fire it on every keystroke.
- **Tool use parsing**: Anthropic returns `content` as a list of blocks; the tool call is `{ type: "tool_use", name, input }`. Find that block, don't assume position 0.
