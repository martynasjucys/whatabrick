# Weekly Digest — Implementation Plan

## Step 1 — Schema

Add `weeklyDigests` to `convex/schema.ts` and `weeklyDigestEnabled: v.boolean()` to `users` (with a one-shot mutation to backfill existing users to `true`).

## Step 2 — Aggregation helpers

Create `convex/lib/digest.ts` — pure functions over arrays:

```ts
export function bucketHarderToFind(snapshots, trackedItems) { ... }
export function bucketUnderTarget(alerts) { ... }
export function bucketHype(scores) { ... }
export function bucketNewlyTracked(trackedItems, weekStart) { ... }
export function bucketVerdictUpgrades(scores) { ... }
```

Each returns `{ title, items: [{itemId, headline, bodySm, verdict?}] }` or `null` if empty.

## Step 3 — generateForUser action

`convex/weeklyDigestActions.ts` (`"use node"` for Resend + React Email render):

1. Load the user's tracked items, snapshots (last 14 days), scores (last 14 days), alerts (last 7 days).
2. Compute the 5 buckets via `lib/digest`.
3. Build a compact summary of section counts + user's top theme.
4. Call Claude Sonnet → get intro string.
5. Write `weeklyDigests` row.
6. If `user.weeklyDigestEnabled` and `user.alertChannel != "none"`: render `emails/WeeklyDigest.tsx` → HTML → `resend.emails.send`.

## Step 4 — Cron

```ts
crons.weekly("weekly-digest", { dayOfWeek: "monday", hourUTC: 7, minuteUTC: 0 }, internal.weeklyDigestActions.runWeekly);
```

`runWeekly`: enumerate users with `weeklyDigestEnabled = true`, schedule `generateForUser` with `runAfter(i * 1000)` to spread send rate (Resend has a per-second cap on the free tier).

## Step 5 — Unsubscribe endpoint

Convex doesn't expose HTTP routes directly — but it does via `httpAction`. Create `convex/http.ts`:

```ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
const http = httpRouter();
http.route({
  path: "/unsubscribe",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    // verify HMAC: token = base64(userId + ":" + hmac_sha256(userId, SECRET))
    // if valid, toggle weeklyDigestEnabled on the user row
    return new Response("Unsubscribed", { status: 200 });
  }),
});
export default http;
```

`UNSUBSCRIBE_SIGNING_SECRET` → `.env.local`. The signed token is generated when rendering the email.

The public Convex HTTP URL is `<deployment>.convex.site/unsubscribe?t=...`.

## Step 6 — UI

- `src/app/(app)/digest/page.tsx` — renders the same `<WeeklyDigest />` React Email component for in-app preview. React Email exports render-to-DOM components for this.
- `src/app/(app)/settings/page.tsx` — settings form including the digest toggle, region, currency.

`pnpm dlx shadcn@latest add switch label`

## Step 7 — Validation

1. Create a user, add 5 tracked items, fake-trigger some alerts and verdict transitions in the past 7 days.
2. Call `weeklyDigestActions.generateForUser` from the Convex dashboard for that user → email arrives within 30s.
3. Click the unsubscribe link → user's `weeklyDigestEnabled` flips to false.
4. Re-run `runWeekly` cron manually → that user is skipped, no email.
5. Visit `/(app)/digest` → see the same content.

## Gotchas

- **React Email + Convex**: render-to-string works in Convex's V8 runtime only if you import from `@react-email/render` server-only build. If it fails to bundle, mark the file `"use node"` and the Node runtime will handle it.
- **HMAC in Convex**: use the Web Crypto API (`crypto.subtle.sign`) — available in both Convex runtimes. Avoid `crypto.createHmac` unless you're in node runtime.
- **Send throttling**: Resend's free tier is ~10 req/s. With 1s spacing per user via `scheduler.runAfter(i * 1000)`, we're safe up to thousands of users.
- **Time zone honesty**: until per-user TZ ships, label the digest "Sent every Monday morning UTC" in settings so users know what to expect.
- **Quiet weeks**: when all 5 buckets are empty, intro should say so and the email should still send (it's a retention surface). Bail only if the user has zero tracked items.
