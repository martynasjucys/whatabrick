# Weekly Digest — SPEC

**Purpose:** Send one email per user every Monday morning summarizing the week — what got scarcer, what dropped under target, what's possibly hype, what's new. This is the habit-forming surface (plan §4 Flow 4).

**Depends on:** `alerts`, `item-verdicts`.

## User stories
1. As a user, on Monday at 09:00 local time I get an email with 3–7 bullet-style cards: "3 items became harder to find", "2 watched items dropped below target", "1 item has suspicious hype but weak sold-price data", "New Minecraft magazine figure detected".
2. As a user, I can unsubscribe from the digest without losing transactional alerts.
3. As a user, I can preview the current week's digest in-app at any time.

## Scope

**In:**
- One scheduled job per user per week.
- AI-written intro paragraph (1–2 sentences) summarizing the week in plain language.
- Categorized highlights pulled from the past 7 days of `signalScores`, `marketSnapshots`, and `alerts`.
- "New item discovered" placeholder: surfaces items the user added that week (no automatic discovery in MVP).
- Unsubscribe link → toggles a `user.weeklyDigestEnabled` flag.

**Out:**
- Per-user time-zone-localized send time. **MVP: send all digests at 07:00 UTC Monday.** Localization is a follow-up.
- Per-radar separate digests. **MVP: one combined email.**
- Web-only digest view that *isn't* an email rendering of the same content — render once, reuse.

## Data model

```ts
weeklyDigests: defineTable({
  userId: v.id("users"),
  weekStart: v.number(),                  // start-of-week UTC ms
  content: v.object({
    intro: v.string(),                    // AI-generated
    sections: v.array(v.object({
      title: v.string(),                  // e.g. "Becoming harder to find"
      items: v.array(v.object({
        itemId: v.id("items"),
        headline: v.string(),
        bodySm: v.string(),               // one-line context
        verdict: v.optional(v.string()),
      })),
    })),
  }),
  sentAt: v.optional(v.number()),
  openedAt: v.optional(v.number()),
}).index("by_user_week", ["userId", "weekStart"]),
```

Also add to `users`: `weeklyDigestEnabled: v.boolean()`, default `true`.

## Aggregation logic

For each user, gather over the past 7 days:

1. **Becoming harder to find**: tracked items where 7-day listing-count avg dropped ≥30% vs prior 7-day. Top 3 by % drop.
2. **Under target price**: items with active alerts of type `PRICE_BELOW_TARGET` triggered this week. Top 3 by % below target.
3. **Suspicious hype**: items where `verdict == AVOID_HYPE` was assigned this week. Top 2.
4. **New items added**: items where `trackedItems.addedAt` falls in the week. Top 5.
5. **Verdict upgrades**: items whose verdict moved from {WATCH/IGNORE} to {STRONG_SIGNAL/GOOD_BELOW_TARGET}. Top 2.

Cap total at 7 sections × ≤3 items each. Skip empty sections.

## AI intro

Claude Sonnet writes the 1–2 sentence intro after aggregation. Prompt includes the section counts and the user's top theme (most-tracked radar theme). Tool: `emit_intro(text: string)`.

Cap at ~40 words. Cache the system prompt across all users.

## Email template

`emails/WeeklyDigest.tsx`:
- Header: "Your Whatabrick week" + week range.
- Intro paragraph (AI).
- One section per non-empty category, with a small icon (use lucide).
- Each item row: thumbnail (40px), name (body), one-line context (body-sm ink-subtle), verdict badge.
- Footer: unsubscribe link + manage preferences link.

## Convex function surface

- `weeklyDigest.preview` — query: returns this-week's digest content (computed on the fly if not yet stored).
- `weeklyDigest.generateForUser` — internal action: computes content, writes `weeklyDigests` row, sends email via Resend.
- `weeklyDigest.runWeekly` — internal action: scheduled to enumerate users with `weeklyDigestEnabled` and fan out to `generateForUser`.
- `weeklyDigest.unsubscribe` — mutation: takes a signed token (verifies via HMAC on user id + secret), toggles the flag. Reachable from email link without sign-in.

The unsubscribe endpoint is the only public function that doesn't require auth — it uses a token.

## UI

- `/(app)/digest` page: renders the latest digest using the same React Email components (React Email components also render fine in the browser).
- Settings: toggle for weekly digest, surfaced in `/(app)/settings`.

## Success criteria
- Monday morning, every user with ≥1 tracked item gets a digest within a 30-minute window.
- Empty-week users (no activity) get a "Quiet week — your 12 items are stable" minimal digest, not a blank one.
- Unsubscribe link works without sign-in via signed token.
- Preview at `/(app)/digest` matches the sent email byte-for-byte (same component).

## Open questions
- Send time localization is the biggest UX gap. Defer but track.
- Should free-tier limit digests to once per month? Plan §15 implies digest is paid-tier. **MVP: digest is on for everyone — it's the retention hook. Add gating in pricing rollout.**
