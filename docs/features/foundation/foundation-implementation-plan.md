# Foundation — Implementation Plan

Goal: a signed-in user lands on a Linear-styled dashboard shell with a working Convex+Clerk+Anthropic spine, no product features yet.

## Step 1 — Install deps

```bash
pnpm add convex @anthropic-ai/sdk
pnpm dlx convex@latest dev   # interactive: creates Convex project, writes CONVEX_DEPLOYMENT to .env.local
```

The `convex dev` command leaves a long-running watcher; keep it running in a second terminal during development.

**Read first** (training data is stale on these):
- `node_modules/next/dist/docs/01-app/03-getting-started/02-fonts.mdx` — Next 16 font API
- `node_modules/convex/dist/clerk/README.md` if present, else the file under `node_modules/convex/dist/cli/` referenced from the package README
- `node_modules/@anthropic-ai/sdk/README.md` — for prompt caching parameters

## Step 2 — Environment variables (.env.local)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CONVEX_URL=...        # from `convex dev`
CONVEX_DEPLOYMENT=...
ANTHROPIC_API_KEY=...
REBRICKABLE_API_KEY=...            # used later, set now
BRICKLINK_CONSUMER_KEY=...         # used later, set now
BRICKLINK_CONSUMER_SECRET=...
BRICKLINK_TOKEN_VALUE=...
BRICKLINK_TOKEN_SECRET=...
```

The existing `.env` is committed and likely only has Clerk keys. Put new keys in `.env.local` (gitignored).

## Step 3 — Convex schema (foundation tables only)

Create `convex/schema.ts` with just `users`. Other features will extend.

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    region: v.union(v.literal("EU"), v.literal("UK"), v.literal("US"), v.literal("OTHER")),
    currency: v.union(v.literal("EUR"), v.literal("GBP"), v.literal("USD")),
    alertChannel: v.union(v.literal("email"), v.literal("none")),
  }).index("by_clerk_id", ["clerkId"]),
});
```

## Step 4 — Convex auth config

Create `convex/auth.config.ts`:

```ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
```

In Clerk dashboard → JWT Templates → create a "convex" template (issuer becomes `CLERK_JWT_ISSUER_DOMAIN`).

## Step 5 — User sync (lazy)

Create `convex/users.ts`:
- `getOrCreateMe` mutation: reads `ctx.auth.getUserIdentity()`, upserts a row in `users` keyed on `clerkId`. Defaults region=EU, currency=EUR, alertChannel=email.
- `me` query: returns the current user row or null.

Run `getOrCreateMe` from the authenticated layout on first render.

## Step 6 — Providers

Edit `src/app/layout.tsx`:
- Wrap body in `<ClerkProvider>` then `<ConvexProviderWithClerk client={convex} useAuth={useAuth}>`.
- Add `className="dark"` to `<html>`.
- Keep the Figtree font wiring already there.

Create `src/lib/convex.ts` exporting `new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)`.

## Step 7 — Design tokens

Rewrite `src/app/globals.css` `@theme inline` block. Map shadcn variables to Linear palette (see SPEC §3). Add raw tokens for the surface ladder so feature code can use `bg-[var(--surface-1)]` if a shadcn token doesn't fit.

Delete the existing light-mode color block — design.md is dark-only.

## Step 8 — Replace boilerplate

- `src/app/page.tsx` → marketing hero: `display-xl` headline ("Track LEGO collectibles, spot scarcity signals."), `body-lg` subhead, lavender primary CTA "Get started" → `/sign-up`, secondary `button-secondary` "Sign in".
- Create `src/app/(app)/layout.tsx` with `<TopNav />` + `<main className="mx-auto max-w-[1280px] px-6 py-12">`.
- Create `src/app/(app)/page.tsx` as a stub dashboard ("Your radars" empty state).
- Create `src/app/sign-in/[[...sign-in]]/page.tsx` and `src/app/sign-up/[[...sign-up]]/page.tsx` rendering Clerk components.
- Create `src/components/top-nav.tsx`.

## Step 9 — Anthropic factory

Create `convex/lib/anthropic.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
export const anthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
export const MODEL = "claude-sonnet-4-6";   // confirm exact id per CLAUDE.md
```

Per project CLAUDE.md the latest Sonnet id is `claude-sonnet-4-6`. Default to Sonnet for radar expansion / verdicts; use Haiku 4.5 (`claude-haiku-4-5-20251001`) for cheaper jobs (item resolver disambiguation).

## Step 10 — Validation

1. `pnpm dev` → `/` renders the Linear-styled hero.
2. Click "Get started" → Clerk sign-up flow.
3. Land on `/(app)` → top nav visible, "Your radars" empty state, no console errors.
4. In Convex dashboard, confirm `users` table has one row with the signed-in user.
5. Run `pnpm lint` and `pnpm build` clean.

## Gotchas
- **`src/proxy.ts` not `middleware.ts`** — Next 16. Already correct; don't rename.
- **React Compiler is on.** Don't write manual `useMemo`/`useCallback` unless the compiler bails out — read its emitted output if perf bugs appear.
- **shadcn `base-maia` style.** Already configured; `pnpm dlx shadcn@latest add button input card` will install with the right variants.
- **Convex actions, not queries, do network I/O.** AI calls and BrickLink/Rebrickable fetches must live in `convex/*Action.ts` files using `"use node"` if a Node-only lib is needed.
