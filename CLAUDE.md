# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Whatabrick — an AI LEGO collectible radar (early scaffold stage). Product brief is in `docs/whatabrick-core-plan.md`; intended stack per `docs/whatabrick-tech-stack.md` is **Next.js + Convex + Clerk**. Convex is not yet installed; current code is the create-next-app baseline plus Clerk and shadcn.

## Commands

Package manager is **pnpm** (see `pnpm-workspace.yaml`, `pnpm-lock.yaml`).

- `pnpm dev` — start dev server on http://localhost:3000
- `pnpm build` — production build
- `pnpm start` — run the built app
- `pnpm lint` — ESLint (uses `eslint-config-next` flat config in `eslint.config.mjs`)

There is no test setup yet.

## Architecture notes (non-obvious)

- **This is Next.js 16 with React 19 and the React Compiler enabled** (`next.config.ts` → `reactCompiler: true`). APIs, conventions, and file names differ from older Next.js. Before writing code, consult `node_modules/next/dist/docs/` (per `AGENTS.md`) — your training data is likely wrong.
- **Middleware lives at `src/proxy.ts`, not `middleware.ts`.** It is the Clerk middleware entry point and includes a matcher that also routes `/__clerk/(.*)` for Clerk's auto-proxy. Don't rename it back to `middleware.ts`.
- **Path alias:** `@/*` → `src/*` (see `tsconfig.json`).
- **App Router** under `src/app/`. Root layout (`src/app/layout.tsx`) wires three Google fonts (`Geist`, `Geist_Mono`, `Figtree`) as CSS variables, with Figtree as `--font-sans`.
- **Styling:** Tailwind v4 (`@tailwindcss/postcss`), tokens defined in `src/app/globals.css` via `@theme inline`, with shadcn's stylesheet imported via `@import "shadcn/tailwind.css"` and animations via `tw-animate-css`.
- **shadcn config** (`components.json`): style `base-maia`, icon library `lucide` (`lucide-react`), RSC enabled. Components go under `src/components/ui`, utils at `src/lib/utils.ts` (`cn` helper). Use the shadcn CLI to add components rather than hand-rolling them.
- **`pnpm-workspace.yaml`** currently only declares `ignoredBuiltDependencies` (sharp, unrs-resolver) — there are no actual workspaces.

## Conventions

- Don't pre-build features outside the MVP scope laid out in `docs/whatabrick-core-plan.md` §12 ("MVP feature cut"). The product explicitly avoids becoming a full collection manager, mobile app, or prediction engine in v1.
- Price data must come from structured sources, never from AI. AI is for summaries, item resolution, scoring explanations, and digests — not for inventing prices (see plan §10).
