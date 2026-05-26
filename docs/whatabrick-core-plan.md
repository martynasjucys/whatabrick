Whatabrick - AI LEGO Collectible Radar — Product Plan

1. Core idea

A web app that helps beginner and mid-level LEGO collectors automatically track collectible opportunities.

Not a generic collection manager. Not a “guaranteed investment predictor.”

The product promise should be:

“Track LEGO collectibles, spot scarcity signals, and understand market changes without manually checking BrickLink, eBay, Reddit, LEGO.com, magazines, and collector sites every day.”

The app should act like a research assistant + market radar, not a financial advisor.

2. Target users
   Primary user

A beginner collector who buys mixed LEGO lots, magazine figures, minifigures, retired sets, animals, rare parts, and small collectibles.

They need help answering:

Is this part/figure interesting?
Is this price normal?
Is this item becoming harder to find?
Is this actually rare, or just overpriced?
Should I buy now, wait, or ignore it?
What exactly should I search for on BrickLink/eBay?
Secondary user

A more serious collector who already knows BrickLink/eBay but wants automation.

They need:

Watchlists
Price alerts
Sold-price tracking
Scarcity monitoring
Early market signals
Weekly digest
Cross-market comparison
3. MVP positioning

The MVP should be narrow.

Do not start with “track all LEGO.”

Start with one strong niche:

Best MVP niche

Magazine-only LEGO minifigures and foil-pack collectibles

Especially:

LEGO Minecraft magazine gifts
Ninjago magazine figures
City magazine figures
Star Wars foil packs if available in your region
Rare animals or accessories from magazines
Regional magazine exclusives

Why this is a good niche:

Small enough to track.
Beginner-friendly.
Often overlooked.
Prices can move quickly.
Items are distributed unevenly by country.
Many people do not know what they have.
Current tools are weaker here than for big boxed sets.

The app can expand later into:

Retiring sets
Gift-with-purchase sets
Polybags
Seasonal sets
Rare animals
Star Wars clones
Castle/Pirates figures
Technic discontinued/cancelled sets
Misprints/oddities/manuals/boxes
4. Main user flows
   Flow 1: Create a radar

User enters:

“Minecraft magazine minifigures”

AI turns this into a structured watchlist:

Theme: Minecraft
Product type: magazine foil packs / minifigures
Region: EU / UK / Germany / Lithuania / global
Sources to track: BrickLink, eBay, BrickSet-like catalog sources, Reddit, official LEGO, magazine publishers where possible
Alert type: price movement, scarcity, new listing, discontinued availability, unusual chatter

The user does not need to know exact part IDs at the beginning.

Flow 2: Track a specific item

User enters:

“Minecraft skeleton horseman magazine figure”

App resolves possible matches:

Figure name
BrickLink minifigure ID if available
Included parts
Related magazine issue
Known packaging
Theme
Release year
Whether parts are unique or reused

Then it creates an item page.

Flow 3: Item radar page

Each tracked item gets a page with:

Current market snapshot
Lowest active price
Average active listing price
Recent sold price
30-day price range
90-day price trend
Number of active listings
Region comparison: EU / UK / US
Sealed vs loose comparison
Complete figure vs individual parts
AI explanation

Example:

“This figure looks mildly interesting, but not urgent. Active listings are low in the EU, but sold-price volume is weak. The torso appears reused, so long-term exclusivity risk is medium. Buy only below €5–7 loose or €8–10 sealed.”

Signal cards
Scarcity: Medium
Demand: Medium
Exclusivity: Low
Price momentum: Rising slowly
Reissue risk: Medium
Liquidity: Low
Beginner confidence: Watch, not buy aggressively
Flow 4: Weekly collector brief

Every week the user gets:

“3 items became harder to find”
“2 watched items dropped below target price”
“1 item has suspicious hype but weak sold-price data”
“New Minecraft magazine figure detected”
“This older foil-pack figure is now below normal EU price”

This is where the product becomes habit-forming.

5. Main features
   MVP features
1. Watchlists / Radars

User can create radars like:

Minecraft magazine figures
LEGO animals
Retiring Technic sets
Star Wars clone troopers
Castle minifigs
Gift-with-purchase sets
Polybags under €20
Discontinued/cancelled sets

Each radar contains many tracked items.

2. Item resolver

AI helps identify what the user means.

User types:

“Chicken guy minifig”
“Minecraft magazine creeper figure”
“Technic cancelled plane”
“white dog from old city set”

The app suggests possible catalog matches.

This is important because beginners often do not know exact BrickLink names or IDs.

3. Price tracker

Track:

Active listing price
Sold price
Listing count
Price history
Condition: new/used/sealed/loose
Completeness: complete minifig vs parts
Region
Shipping-aware estimated cost where possible

Important: never rely only on asking prices.

The app should always separate:

Listed price
Sold price
Realistic buy price
Hype price
Low-liquidity warning
4. Scarcity tracker

Track signs like:

Active listings decreasing
No cheap sellers left
Item only available in one region
Set/magazine no longer sold
Magazine issue replaced by newer issue
Official LEGO availability changed
BrickLink inventory count decreasing
Sealed copies disappearing faster than loose copies
5. AI research summaries

AI should summarize changes in plain language.

Example:

“The item is not necessarily rare, but sealed copies are becoming less common. Loose parts are still cheap, which means the current sealed price premium may be collector-driven rather than true part scarcity.”

This is the real value.

6. Alerts

Alert examples:

“Price dropped below €8”
“EU listing count fell by 40%”
“New eBay sold price above normal range”
“BrickLink supply is drying up”
“New magazine issue detected”
“Possible reissue risk detected”
“This item is being discussed more often on Reddit/YouTube”
7. Beginner buy guidance

Instead of saying “buy” or “don’t buy,” use safer labels:

Ignore
Watch
Good below target price
Interesting but risky
Scarce but overpriced
Strong collectible signal
Avoid hype price

This keeps the app honest.

6. AI scoring model

Each item can have a score, but the score should be explainable.

Suggested signals
Scarcity score

Factors:

Number of active listings
Number of sellers
Region spread
Availability in sealed condition
Availability of individual parts
Magazine/retail distribution window
Recent listing count change
Demand score

Factors:

Theme popularity
Character popularity
Search volume if available
Reddit/forum mentions
YouTube/social chatter
Number of users watching the item
Sold-price frequency
Exclusivity score

Factors:

Unique minifigure
Unique print
Unique head/torso/legs/accessory
Only appeared in magazine
Only appeared in one set
Region-only release
Cancelled/discontinued item
Momentum score

Factors:

Sold price rising
Active listings falling
Time-to-sale decreasing
Cheapest available price increasing
More watchers/searches
New social mentions
Risk score

Factors:

Low sold volume
Only asking prices increased
Reissue likely
Parts are common
Seller manipulation possible
Too much hype from one source
High shipping makes pricing noisy
Item is incomplete/misidentified often
7. Example item verdict

The app should produce clear verdicts like this:

Example

Minecraft Magazine Zombie Villager

Status: Watch
Confidence: Medium
Target buy price: €4–6 loose, €7–9 sealed
Current market: Slightly overpriced
Main reason: Low sealed availability, but parts are not unique enough to justify aggressive buying.
Risk: Could be reissued or included in another magazine/set later.
Action: Add alert below €7 sealed. Avoid listings above €12 unless sealed and regionally hard to find.

This type of explanation is much more useful than a raw score.

8. Data sources
   Public/catalog data

Possible sources to research:

BrickLink catalog
BrickLink price guide
BrickSet
Rebrickable
LEGO.com
BrickEconomy
Brickfact
PriceCharting
eBay sold listings
Google Shopping-style results
Reddit
YouTube
Facebook groups/manual input
Magazine publisher sites
Local marketplaces, depending on region

Important: some sources may not allow scraping or may have API limits. The product needs careful source/legal review.

For MVP, you can start with:

Rebrickable API for part/set/minifig metadata
BrickLink API if accessible
eBay API for listings/sold-like marketplace signals
Manual price entry fallback
User-submitted sightings
AI-assisted web research summaries
9. Data model

Basic entities:

User
id
email
region
currency
preferred marketplaces
alert preferences
Radar
id
user_id
title
niche
query
region
tracked_item_ids
created_at

Example:

{
title: "Minecraft magazine figures",
niche: "magazine_minifigures",
region: "EU",
query: "LEGO Minecraft magazine foil pack minifigures"
}
CollectibleItem
id
title
theme
type
catalog_ids
image_url
release_year
known_sources
unique_parts
rarity_notes
reissue_risk
created_at
MarketSnapshot
item_id
source
date
active_listing_count
lowest_price
median_price
average_price
sold_price_low
sold_price_median
sold_price_high
currency
region
condition
SignalScore
item_id
date
scarcity_score
demand_score
exclusivity_score
momentum_score
risk_score
confidence
verdict
Alert
user_id
item_id
type
threshold
active
last_triggered_at
10. Recommended tech stack

Since this is close to your usual product style:

Web
Next.js
TypeScript
Tailwind
Shadcn UI
Recharts for market charts
Backend

Option A, simpler:

Next.js API routes / server actions
Supabase Postgres
Supabase Auth
Supabase Storage

Option B, more scalable:

Next.js web
Hono API service
Supabase/Postgres
Inngest for scheduled tracking jobs
Playwright workers only where legally/technically acceptable
Separate AI research worker
AI

Use AI for:

Search query expansion
Item matching
Catalog disambiguation
Market summary
Watchlist generation
Signal explanation
Weekly digest
Beginner-friendly guidance

Do not use AI as the source of price truth.

Prices should come from structured data, APIs, or stored snapshots.

11. Key pages
    Dashboard

Shows:

Active radars
Important alerts
Items becoming scarce
Items under target price
Weekly summary
Top watchlist changes
Radar page

Example: “Minecraft Magazine Figures”

Shows:

All tracked figures
Price movement
Scarcity movement
New detected items
Best current opportunities
Risky hype items
Filters: sealed, loose, EU, US, under €10, rising, falling
Item page

Shows:

Image
Catalog identity
Known appearances
Parts breakdown
Price chart
Active listings
Sold prices
Listing count trend
AI verdict
Alerts
Notes
Related items
Research assistant

Chat-like interface:

User asks:

“Is this Minecraft figure worth buying for €8?”

AI answers using current data:

“At €8 sealed, it is fair if shipping is low. Loose value appears closer to €4–5. I would not pay over €10 unless it is sealed and you specifically collect Minecraft magazine gifts.”

Collection import

Later feature:

Upload BrickLink wanted list
Upload CSV
Scan/identify parts
Add owned items
Track collection value over time
12. MVP feature cut

For the first real MVP, build only this:

MVP v1
User can create a radar.
AI expands radar into tracked search targets.
User can add specific items manually.
App stores daily/weekly price snapshots.
App shows listing count + price movement.
App generates AI summary.
App sends weekly email/report.
App supports target price alerts.

Do not build:

Full collection manager
Mobile app
Image recognition
Social network
Marketplace purchasing
Portfolio/profit accounting
Complex prediction model
Every LEGO theme

Start narrow and prove the radar is useful.

13. Differentiation

The app should not compete directly with BrickLink, BrickEconomy, BrickScan, or BrickSet.

It should sit above them as an intelligence layer.

Existing tools usually say:

“Here is the item and its price.”

Your app should say:

“Here is what changed, why it may matter, and what a reasonable beginner action is.”

That is the product.

14. UI concept

A clean dashboard could have these main sections:

Top cards
Items to watch
Price drops
Scarcity alerts
Possible hype
New discoveries
Radar cards

Each radar card:

Minecraft Magazine Figures
12 tracked items
3 price changes this week
2 low-supply warnings
1 possible new figure detected

Button: Open radar

Item cards

Each item card:

Image
Name
Current realistic price
Market status
Scarcity badge
Risk badge
Last changed date

Example badges:

“Supply falling”
“Overpriced”
“Good below €6”
“Low sold volume”
“Magazine-only”
“Reissue risk”
15. Monetization

Possible pricing:

Free
1 radar
10 tracked items
Manual refresh
Basic summaries
Collector

€5–8/month

5 radars
100 tracked items
Weekly digest
Price alerts
AI summaries
Pro collector

€15–20/month

More radars
Faster refresh
Advanced filters
Multi-region tracking
Export
Collection value tracking
Custom research briefs

Avoid making the app feel like crypto/trading software. Keep it collector-friendly.

16. Main risks
    Data access risk

Some marketplaces may restrict scraping or APIs. This is the biggest technical/product risk.

Mitigation:

Use official APIs where possible.
Cache responsibly.
Let users manually add listings.
Start with fewer reliable sources.
Clearly link back to original marketplace pages.
Bad price signals

LEGO prices can be weird:

Fake high listings
Low-volume items
Region differences
Incomplete minifigures
Shipping distortion
Misidentified parts
Condition differences

Mitigation:

Always show confidence.
Separate listing price from sold price.
Penalize low-volume data.
Use explanations, not just scores.
Prediction overpromise

Do not brand it as “AI will find the next rare LEGO investment.”

Better:

“Research faster. Track smarter. Avoid beginner mistakes.”

17. Suggested roadmap
    Phase 1: Manual research assistant

Build a web app where user creates watchlists and AI helps structure them.

No automation yet, just:

Item database
Notes
Manual price snapshots
AI summaries

Goal: prove UX.

Phase 2: Semi-automated market tracker

Add:

Scheduled price checks
Listing count tracking
Basic charts
Alerts
Weekly digest

Goal: prove recurring value.

Phase 3: AI radar intelligence

Add:

Scarcity score
Demand score
Risk score
Opportunity score
Reissue-risk explanation
New item discovery

Goal: turn it into a true radar.

Phase 4: Collection + scanning

Add:

Image recognition
Bulk lot assistant
Owned collection
Part-out suggestions
“Complete this minifig” flow

Goal: connect collecting, identifying, and tracking.