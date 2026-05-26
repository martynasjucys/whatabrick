# Whatabrick MVP — Feature Roadmap

Build order is top-to-bottom. Each row links to its `SPEC.md` and `*-implementation-plan.md`. Update the **Status** column as work lands.

Status legend: `🟢 Done` · `🟡 In progress` · `⚪ Not started` · `🔵 Blocked`

| # | Feature | Status | Depends on | Spec | Plan |
|---|---|---|---|---|---|
| 0 | [foundation](./foundation/) | 🟢 Done | — | [SPEC](./foundation/SPEC.md) | [Plan](./foundation/foundation-implementation-plan.md) |
| 1 | [radars](./radars/) | 🟢 Done | foundation | [SPEC](./radars/SPEC.md) | [Plan](./radars/radars-implementation-plan.md) |
| 2 | [catalog-items](./catalog-items/) | 🟢 Done | foundation | [SPEC](./catalog-items/SPEC.md) | [Plan](./catalog-items/catalog-items-implementation-plan.md) |
| 3 | [market-tracking](./market-tracking/) | ⚪ Not started | catalog-items | [SPEC](./market-tracking/SPEC.md) | [Plan](./market-tracking/market-tracking-implementation-plan.md) |
| 4 | [item-verdicts](./item-verdicts/) | ⚪ Not started | market-tracking | [SPEC](./item-verdicts/SPEC.md) | [Plan](./item-verdicts/item-verdicts-implementation-plan.md) |
| 5 | [alerts](./alerts/) | ⚪ Not started | market-tracking, item-verdicts | [SPEC](./alerts/SPEC.md) | [Plan](./alerts/alerts-implementation-plan.md) |
| 6 | [weekly-digest](./weekly-digest/) | ⚪ Not started | alerts, item-verdicts | [SPEC](./weekly-digest/SPEC.md) | [Plan](./weekly-digest/weekly-digest-implementation-plan.md) |
| 7 | [dashboard](./dashboard/) | ⚪ Not started | all of the above | [SPEC](./dashboard/SPEC.md) | [Plan](./dashboard/dashboard-implementation-plan.md) |

## Dependency graph

```
foundation
   ├── radars                    (independent of catalog-items)
   ├── catalog-items
   │     └── market-tracking
   │           ├── item-verdicts
   │           └── alerts
   │                 └── weekly-digest
   └── dashboard                 (last; touches everything)
```

You can run `radars` and `catalog-items` in parallel after `foundation` lands. Everything past `market-tracking` is serial.

## Foundation — open sub-items

Foundation code is in. Status flips to 🟢 Done after:

- [🟢] `npx convex dev` linked to the existing `sleek-zebra-550` deployment and `convex/_generated/` committed.
- [🟢] Clerk JWT template **convex** created; `CLERK_JWT_ISSUER_DOMAIN` set on the Convex deployment via `npx convex env set …`.
- [🟢] `ANTHROPIC_API_KEY` set on the Convex deployment via `npx convex env set ANTHROPIC_API_KEY ...` (NOT `.env.local` — Convex actions don't read it).
- [🟢] Smoke test passes: sign up → redirected to `/dashboard` → Convex `users` table has a row → `pnpm build` clean.

## How to update this file

When a feature moves to 🟡 or 🟢, edit the **Status** cell. When sub-decisions are made (e.g. a SPEC's "Open questions" gets resolved), update the SPEC inline and link the commit/PR in the relevant feature folder if useful.
