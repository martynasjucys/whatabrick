---
name: nurtia-product-context
description: Nurtia product and architecture guide for planning or implementing features across spaces, signals, automations, Convex, the web/native apps, and the ephemeris service. Use this skill when a task mentions Nurtia concepts, astrology-driven UX, cross-layer feature design, or choosing the right place in the monorepo for a change.
---

# Nurtia Product Context

Use this skill when the task involves Nurtia product language or when you need to decide which layer of the monorepo should own a change.

## Quick Start

1. Read `docs/project-description.md` for product language and intent.
2. Read root `CLAUDE.md` for current repo architecture. Prefer it over `README.md`, which still contains some starter-template wording.
3. Route the work to the correct layer using the table below.
4. Keep the product guardrails in this skill visible while planning and writing code.

## Product Model

- `Space`: primary product unit; a user-defined intention or life domain
- `Page`: a surface inside a space, usually `Overview`, `Calendar`, or `Oracle`
- `Widget`: a modular UI block rendered inside a page
- `Signal`: a timestamped input with `strength`, `polarity`, and `category`
- `AI layer`: interprets signals and suggests actions; it does not replace deterministic system logic
- `Automation`: a proactive alert, report, or reminder driven by signals, configuration, and preferences

## Product Guardrails

- Design around `intent -> interpretation -> action`, not around raw astrology jargon.
- Present signals as guidance and timing, not certainty or guaranteed outcomes.
- Preserve user-specific context: birth data, timezone, and active intentions.
- Keep each space independent and contextual; avoid global behavior that ignores space configuration.
- Do not move business or product logic into the ephemeris service.

## Architecture Routing

| If the task is about                                | Start here                                                            | Notes                                         |
| --------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| web flows, auth screens, marketing, onboarding      | `apps/web`                                                            | Next.js 16, React 19, shared UI/i18n packages |
| mobile flows or native navigation                   | `apps/native`                                                         | Expo 55, React Native 0.83, Expo Router       |
| auth, persistence, user logic, automations          | `packages/backend/convex`                                             | Read Convex guidance before editing           |
| non-Convex server orchestration or third-party APIs | `packages/api`                                                        | tRPC layer used by web and native             |
| astro calculations or deterministic chart math      | `apps/nurtia-ephemeris`                                               | Fastify service, no product/business logic    |
| service integration types and calls                 | `packages/ephemeris-client`                                           | Keep client/server contracts aligned          |
| cross-app styling, icons, locales, env              | `packages/ui`, `packages/astro-icon`, `packages/i18n`, `packages/env` | Prefer shared packages over duplication       |

## Mandatory Reads

- For any Convex change: `packages/backend/AGENTS.md`, then `packages/backend/convex/_generated/ai/guidelines.md`
- For any ephemeris change: `apps/nurtia-ephemeris/CLAUDE.md`
- For repo-wide decisions: root `CLAUDE.md`

## Working Heuristics

- If a feature spans web, native, backend, and service layers, define the contract and ownership first.
- Keep timestamps in UTC across service boundaries; convert or present user timezone context in product layers.
- Favor shared components, types, and helpers before copying logic between apps.
- Use product terms from `docs/project-description.md` in review notes, docs, and naming when they clarify intent.
- When a request mentions `spaces`, `signals`, `widgets`, `Oracle`, or `automations`, map it to the product model before editing code.

## Example Triggers

- "Add a favorable window widget for a space."
- "Where should weekly reports live in this monorepo?"
- "Implement a new signal pipeline without leaking astrology jargon into the UI."
- "Connect a new ephemeris endpoint to Convex and surface it in web and native."
