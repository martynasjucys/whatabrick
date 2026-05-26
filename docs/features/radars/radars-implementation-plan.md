# Radars — Implementation Plan

## Step 1 — Schema

Add the `radars` table to `convex/schema.ts` per SPEC. Run `npx convex dev` — Convex regenerates `_generated/` automatically.

## Step 2 — Convex queries + mutations

Create `convex/radars.ts`:

- `list` query — filter by `ctx.auth` user id (via `users` lookup).
- `get` query — assert ownership.
- `create` mutation — insert row with `expansionStatus: "pending"`, then `ctx.scheduler.runAfter(0, internal.radars.expandWithAi, { radarId })`.
- `update`, `remove` mutations — straightforward.

## Step 3 — AI expansion action

Create `convex/radarsActions.ts` with `"use node"` at the top.

```ts
"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { anthropic, MODEL } from "./lib/anthropic";

export const expandWithAi = internalAction({
  args: { radarId: v.id("radars") },
  handler: async (ctx, { radarId }) => {
    const radar = await ctx.runQuery(internal.radars._getInternal, { radarId });
    // build prompt, call anthropic.messages.create with tools=[radarSchemaTool]
    // parse tool_use response into the structured fields
    // ctx.runMutation(internal.radars._applyExpansion, { radarId, fields, status: "ready" })
  },
});
```

Use Anthropic's **tool use** to force structured output (define one tool `emit_radar_definition` with the JSON schema; instruct the model to call it exactly once). This is more reliable than asking for raw JSON.

Cache the system prompt with `cache_control: { type: "ephemeral" }` — the rubric prompt will be reused on every radar creation.

## Step 4 — UI

`pnpm dlx shadcn@latest add button card input textarea badge skeleton`

Files to create:
- `src/app/(app)/radars/new/page.tsx` — server component with a client `<RadarCreateForm />` using Convex `useMutation(api.radars.create)` then `router.push(/radars/${id})`.
- `src/app/(app)/radars/[id]/page.tsx` — uses `useQuery(api.radars.get, { id })`. While `expansionStatus === "pending"` render skeleton chips.
- `src/app/(app)/radars/[id]/_components/radar-chips.tsx` — renders the structured fields.
- `src/components/radar-card.tsx` — used on the dashboard.

Apply design tokens via Tailwind classes mapped to globals.css variables (e.g. `bg-card` = surface-1).

## Step 5 — Validation

1. Type "Minecraft magazine minifigures, EU region" → submit → land on detail page → skeleton resolves to chips within ~3s.
2. Edit region from EU to UK → save → reload page → persisted.
3. Delete radar → returns to list, row removed.
4. Manually break ANTHROPIC_API_KEY → create radar → expansion fails after retry → "Retry expansion" button appears and works once key is restored.

## Gotchas

- **Reading `node_modules/next/dist/docs/`** before writing the `[id]` route — Next 16 changed `params` to be a Promise. Server components must `await params`.
- **`"use node"` directive** is required for Anthropic SDK in Convex actions (uses Node Buffer). Without it, the action runs in the Convex V8 runtime which rejects the SDK.
- **Prompt caching** requires the system prompt to be at least ~1024 tokens to be worth caching. The rubric prompt in SPEC §AI prompt should be detailed enough — pad with niche examples and edge-case guidance if short.
- **Convex scheduler** vs running the action inline: schedule it. Inline action calls block the mutation and add latency; users want the radar id back immediately.
