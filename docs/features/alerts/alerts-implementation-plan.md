# Alerts — Implementation Plan

## Step 1 — Schema

Add `alerts` and `alertMutes` to `convex/schema.ts`.

Also: on `trackedItems` add `preferredCondition: v.optional(v.union(v.literal("N"), v.literal("U")))` for the "alert me on sealed vs loose" preference.

## Step 2 — Evaluation action

`convex/alertsActions.ts` (no node deps required → leave V8 runtime; faster):

```ts
export const evaluateForItem = internalAction({
  args: { itemId: v.id("items"), region: v.string() },
  handler: async (ctx, args) => {
    const trackedItems = await ctx.runQuery(internal.items._listTrackedFor, { itemId: args.itemId });
    for (const ti of trackedItems) {
      // load snapshots, scores, mutes for ti.userId / args.itemId
      // for each alert type, run the rule + cooldown check
      // collect alerts to insert
      await ctx.runMutation(internal.alerts._insertMany, { alerts });
    }
  },
});
```

Chain from `marketSnapshotsActions.refreshItem`: after writing snapshots, `await ctx.scheduler.runAfter(0, internal.alertsActions.evaluateForItem, {itemId, region})`. And again after `signalScoresActions.refreshItem` so VERDICT_TRANSITION fires once scores are up to date.

## Step 3 — Resend integration

```bash
pnpm add resend react-email @react-email/components
```

Create `convex/lib/resend.ts`:

```ts
import { Resend } from "resend";
export const resend = new Resend(process.env.RESEND_API_KEY!);
```

`RESEND_API_KEY` → `.env.local`. Verify a sender domain in the Resend dashboard before going live; for local dev use `onboarding@resend.dev`.

Create `emails/AlertEmail.tsx` using React Email components. Use a single dark-themed template matching design.md tokens (canvas bg, ink text, lavender CTA button). React Email lets us render to HTML string at action time.

## Step 4 — Dispatch cron

```ts
crons.hourly("dispatch-alert-emails", { minuteUTC: 15 }, internal.alertsActions.dispatchEmails);
```

`dispatchEmails`:
1. Query alerts with `emailedAt == null`, joined with users where `alertChannel == "email"`.
2. For each, render the React Email template → HTML string.
3. `resend.emails.send({ from, to, subject, html })`.
4. Set `emailedAt = Date.now()` on success.

## Step 5 — UI

`pnpm dlx shadcn@latest add dropdown-menu`

- `src/components/notification-bell.tsx`: dropdown trigger with unread count, lists last 5 alerts inline.
- `src/app/(app)/alerts/page.tsx`: full inbox.
- `src/app/(app)/items/[id]/_components/target-price-form.tsx`: number input, submits on blur.
- `src/app/(app)/items/[id]/_components/mute-button.tsx`: toggles a mute record.

## Step 6 — Validation

1. Add target price €10 on an item with current price €8 → alert fires immediately on next snapshot.
2. Verify email arrives within 1 hour.
3. Run snapshot again same day → no duplicate alert.
4. Mute the item → run snapshot → no alert.
5. Verdict shifts from WATCH to STRONG_SIGNAL → alert fires once.

## Gotchas

- **Cooldown calculation**: use the last alert of the same type for the same trackedItem. The `by_tracked_item` index makes this efficient.
- **Email rendering in Convex**: React Email renders synchronously to a string via `@react-email/render`. No browser required, but it does need React in the action — which works fine in the V8 runtime.
- **Sender deliverability**: don't try to send from a non-verified domain in production. The dev-mode `onboarding@resend.dev` only sends to the Resend account owner.
- **Alert spam**: VERDICT_TRANSITION can fire daily during noisy stretches. The decision tree in `item-verdicts` only commits to a verdict when it changes from the *previous day's* row, which naturally damps oscillation; do not add additional ad-hoc damping here without measuring first.
