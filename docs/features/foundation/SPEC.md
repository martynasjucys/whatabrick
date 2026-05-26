# Foundation — SPEC

**Purpose:** Wire the chosen stack (Next.js 16 + Convex + Clerk + Anthropic) into the existing scaffold, install the Linear-style design system from `docs/design.md`, and produce the app shell every other feature builds on.

**Status:** Not started. Prerequisite for every other feature.

## Out of scope
- Any product feature (radars, items, alerts, digest, dashboard) — those have their own folders.
- Custom Linear fonts (proprietary). Use the open substitutes already wired: `Figtree` for sans, `Geist Mono` for mono.

## MVP build order (read this once)

```
foundation
   ├── radars                    (independent)
   ├── catalog-items             (independent)
   │     └── market-tracking
   │           ├── item-verdicts
   │           └── alerts
   │                 └── weekly-digest
   └── dashboard                 (depends on radars + alerts + item-verdicts)
```

Build top-to-bottom. `foundation` ships in one PR; later features should each be shippable in 1–3 PRs.

## What lives in this feature

### 1. Convex
- Install `convex` and run `npx convex dev` to create a deployment.
- Generate `convex/` directory (schema, functions, `_generated/`).
- Wire `ConvexProviderWithClerk` at the root so server + client components can call Convex with the Clerk JWT.
- Define the shared **base schema** that other features will extend incrementally (users, radars, items, snapshots, scores, alerts). Each downstream feature adds the fields it needs — foundation just establishes table names and core ids so cross-feature references are predictable.

### 2. Clerk
- `src/proxy.ts` is already the middleware (do **not** rename to `middleware.ts`; it's Next 16).
- Add `<ClerkProvider>` + `<ConvexProviderWithClerk>` to the root layout.
- Create `/sign-in` and `/sign-up` routes using Clerk components.
- Mirror the Clerk user into Convex `users` table on first sign-in via a Convex mutation triggered from `auth.config.ts` or a webhook.

### 3. Design system
Translate `docs/design.md` into runtime tokens:

- Rewrite `src/app/globals.css` `@theme inline` block so the shadcn tokens map to the Linear palette:
  - `--background` → `#010102` (canvas)
  - `--foreground` → `#f7f8f8` (ink)
  - `--card` → `#0f1011` (surface-1), `--popover` → `#141516` (surface-2)
  - `--primary` → `#5e6ad2`, `--primary-foreground` → `#ffffff`
  - `--border` → `#23252a` (hairline)
  - `--muted-foreground` → `#8a8f98` (ink-subtle)
  - `--radius` → `12px` (so `--radius-md` ≈ `9.6px` per the existing scale; matches Linear cards)
- Force dark mode by default — design.md is explicit that there is no light mode. Set `<html class="dark">` and remove the `dark:` toggles from `page.tsx`.
- Extend `@theme inline` with the typography tokens: `--font-display` already points at Figtree via `--font-sans`. Add `--text-display-xl` etc. as Tailwind utilities.
- Add CSS custom properties for the four-step surface ladder (`--surface-1/2/3/4`) and three hairlines.

### 4. Anthropic SDK
- Install `@anthropic-ai/sdk`.
- Add `ANTHROPIC_API_KEY` to `.env.local`.
- Create `convex/lib/anthropic.ts` factory that returns a client configured with **prompt caching** enabled (cache the long system prompts that describe LEGO collectibles + scoring rubric).
- All AI calls run in Convex **actions** (not queries/mutations), because actions can do network I/O.

### 5. App shell
- Top nav (`top-nav` token: 56px, canvas bg, ink text). Left: "Whatabrick" wordmark in `display-md` 600 weight. Right: Clerk `<UserButton />`.
- Authenticated layout at `src/app/(app)/layout.tsx` with the top nav and a max-1280px content frame.
- Marketing/landing at `src/app/page.tsx` — single hero on canvas with lavender CTA, matches design.md hero spec.
- Footer: `footer` token, dense link grid, ink-subtle text.

## Data model (foundation only)

```ts
// convex/schema.ts — base tables; downstream features extend
users: {
  clerkId: string,           // index by clerkId
  email: string,
  region: "EU" | "UK" | "US" | "OTHER",
  currency: "EUR" | "GBP" | "USD",
  alertChannel: "email" | "none",
  createdAt: number,
}
```

Downstream feature folders add their own tables. The base `users` table is the only one foundation owns end-to-end.

## Success criteria
- `pnpm dev` boots; `/` shows the marketing hero in Linear styling.
- Signing in via Clerk lands the user on `/(app)` and creates a row in Convex `users`.
- A trivial Convex query (`api.users.me`) returns the signed-in user on a protected page.
- Lighthouse contrast check on `/` passes — ink #f7f8f8 on canvas #010102.

## Open questions
- Convex hosted vs self-hosted? Default: hosted.
- Webhook vs JWT-based user sync from Clerk? Default: JWT (simpler, no webhook secret to manage in dev).
