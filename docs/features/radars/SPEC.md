# Radars — SPEC

**Purpose:** Let users create named watchlists ("radars") that describe a collectible niche in plain language. AI expands the description into a structured search definition the rest of the app uses to discover and track items.

**Depends on:** `foundation`

## User stories

1. As a beginner collector, I type "Minecraft magazine minifigures" and get a structured radar with a theme, item type, region, and a list of seed search queries — without knowing BrickLink IDs.
2. As a returning user, I see all my radars on the dashboard, each with a count of tracked items and recent changes.
3. As a user, I can edit a radar's region/currency or delete it.

## Scope

**In:**
- Create / list / edit / delete radars.
- AI expansion of a freeform niche into a structured query (theme, product type, region, sources, alert preferences) using Claude Sonnet.
- Manual editing of the structured form after AI fills it.
- A radar detail page that lists tracked items (items added in the `catalog-items` and `market-tracking` features).

**Out:**
- Automatic discovery of new items matching a radar (that's a Phase 3 feature; MVP only tracks items the user manually adds to a radar).
- Sharing radars between users.
- Radar templates.

## Data model addition

```ts
radars: defineTable({
  userId: v.id("users"),
  title: v.string(),
  freeformQuery: v.string(),         // original user text
  niche: v.string(),                  // AI-classified short slug e.g. "magazine_minifigures"
  theme: v.optional(v.string()),      // "Minecraft", "Ninjago", ...
  productType: v.optional(v.string()),// "magazine_foil_pack", "polybag", "retired_set", ...
  region: v.union(v.literal("EU"), v.literal("UK"), v.literal("US"), v.literal("GLOBAL")),
  seedQueries: v.array(v.string()),   // AI-suggested search strings
  alertPrefs: v.object({
    priceMovement: v.boolean(),
    scarcity: v.boolean(),
    newListing: v.boolean(),
  }),
}).index("by_user", ["userId"]),
```

## Convex function surface

- `radars.list` — query, returns radars for the signed-in user.
- `radars.get` — query by id (auth-checked).
- `radars.create` — mutation: takes `{ freeformQuery: string }`, schedules `radars.expandWithAi` action, returns the new id immediately with `expansionStatus: "pending"`.
- `radars.expandWithAi` — action: calls Claude with the rubric prompt, writes the structured fields, flips status to "ready".
- `radars.update` — mutation: partial update of structured fields.
- `radars.remove` — mutation.

`expansionStatus` is a field on the radar row (`"pending" | "ready" | "failed"`).

## AI prompt

System prompt (cached):
> You are a LEGO collectibles research assistant. Given a freeform niche description, output a JSON object with the schema below. Classify into one of these niches: `magazine_minifigures`, `polybags`, `gift_with_purchase`, `retired_sets`, `rare_animals`, `discontinued`, `regional_exclusives`, `other`. Suggest 3–6 seed search queries that would match items on BrickLink and Rebrickable. Pick the most likely region from the user text; default to the user's profile region if ambiguous.

User prompt: the freeform text plus `userRegion` from `users`.

Response is parsed with Anthropic's tool-use / structured-output to enforce the schema.

## UI / pages

- `/(app)` — radar list (dashboard takes over this in the `dashboard` feature; until then this lives here).
- `/(app)/radars/new` — single textarea + create button.
- `/(app)/radars/[id]` — radar detail. Header shows title + structured chips (theme, type, region). Below: tracked items list (empty in this feature; populated by `catalog-items`).
- Loading state on `expansionStatus === "pending"` — skeleton on the structured chips, polled via Convex live query.

Use the `feature-card` token for radar tiles: surface-1 bg, 12px radius, 24px padding, 1px hairline border.

## Success criteria
- Creating a radar with "Minecraft magazine minifigures" produces structured output within ~3s and shows: niche=`magazine_minifigures`, theme=`Minecraft`, productType=`magazine_foil_pack`, ≥3 seed queries.
- AI failures gracefully flip `expansionStatus` to `failed` and surface a "Retry expansion" button.
- Deleting a radar removes it from the list and cascades to its tracked-item references (handled in `market-tracking`).

## Open questions
- How many radars per user? Plan §15 implies free=1, paid=5+. Don't enforce limits in MVP — surface on the pricing page only.
- Should AI re-expansion be allowed on edit? Default: yes, button-triggered.
