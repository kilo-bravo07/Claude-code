# ECR Monitor — Multi-Property GA4 Shopping + Checkout ECR Dashboard

One interactive ECR (Event Completion Rate) dashboard covering **four independent GA4 properties** —
FlowerAura Web, FlowerAura App, Bakingo Web, and Bakingo App — each with its own funnel shape, event names, and
metrics, selected from a single "Property" dropdown at the top of the app. There are not four dashboards; there is
one dashboard driven by four property configurations.

## What this is

- **Frontend + backend**: Next.js 15 (App Router) + TypeScript, Tailwind CSS, Recharts. API routes under `app/api/*`
  serve JSON to client components — there is no separate backend process to run.
- **4 dashboard pages** (`/overview`, `/shopping`, `/checkout`, `/definitions`) that render dynamically according to
  whichever property is selected, plus a **`/setup`** page showing connection status for all four properties.
- **Property configuration system**: `lib/properties/*.ts` — one file per property, each declaring its brand,
  platform, GA4 property ID env var, shopping funnel, checkout funnel, any additional metrics (e.g. FlowerAura App's
  "New ECR"), and which filters are meaningful for it. Nothing about a specific property's funnel is hardcoded
  anywhere else in the app — components render whatever a `PropertyConfig` describes.
- **Data provider abstraction**: `lib/data-providers/` — a `DataProvider` interface with a `MockDataProvider`
  (synthetic, clearly badged "Demo Data") and a `Ga4DataProvider` (real GA4 Data API). Every method takes the full
  `PropertyConfig`, so one provider instance serves all four properties; provider selection (mock vs. GA4) happens
  **per property**, so one property can be live on GA4 while another still runs on demo data.
- **Centralized, generic metrics engine**: `lib/metrics.ts` walks whatever funnel shape a property declares — it
  never assumes a fixed 4-stage shopping / 5-stage checkout layout, and it never caps a conversion rate at 100% (see
  "Conversion rates above 100%" below).

## Running it locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. With no `.env` file, every property runs on the **mock provider** — the whole app is
fully interactive against clearly-synthetic, per-property demo data (an amber "Demo Data" badge is shown in the
filter bar). Switch properties from the "Property" dropdown at the top; each one has its own funnel shape, KPI
labels, and available filters.

```bash
npm test          # runs the unit test suite (vitest) — 82 tests, including exact fixture validation for all 4 properties
npm run build      # production build + typecheck
```

## Where you enter the four GA4 Property IDs

In `.env` (copy from `.env.example`):

```
FLOWERAURA_WEB_GA4_PROPERTY_ID=123456789
FLOWERAURA_APP_GA4_PROPERTY_ID=234567890
BAKINGO_WEB_GA4_PROPERTY_ID=345678901
BAKINGO_APP_GA4_PROPERTY_ID=456789012
```

You don't need all four at once — set as many as you have, and the rest keep running on demo data. The **`/setup`**
page in the app shows each property's masked ID and Connected/Not Connected status, with a "Test Connection" button
per property (no secrets are ever displayed).

## GA4 setup guide (step by step)

**STEP 1.** Open [Google Analytics](https://analytics.google.com).

**STEP 2.** Use the property switcher (top left) to select the property you want to connect — e.g. FlowerAura Web.

**STEP 3.** Click **Admin** (gear icon, bottom left) → under the "Property" column, click **Property Settings**.

**STEP 4.** Copy the **Property ID** — the plain number near the top (e.g. `123456789`). This is *not* the same as
the "Measurement ID" (which looks like `G-ABC123XYZ`) — you want the numeric Property ID.

**STEP 5.** Paste it into `.env` as the matching variable (e.g. `FLOWERAURA_WEB_GA4_PROPERTY_ID=123456789`).

**Repeat STEP 2–5** for FlowerAura App, Bakingo Web, and Bakingo App — each has its own Property ID in the same
place (switch properties in the GA4 property switcher each time).

### Is your current GA4 VIEW access enough?

**Yes, for everything this dashboard does.** The GA4 Data API (which this app uses to read funnel/event data) only
requires **Viewer** access on a property — reading reports, running the equivalent of a funnel exploration, and
reading standard/custom dimensions all work fine with Viewer access. You do **not** need Editor or Admin access on
any of the four properties to make this dashboard work.

The one thing Viewer access can't do is change GA4 *configuration* (create new custom dimensions, add users, edit
events) — this dashboard never asks you to do that. If a property is missing a dimension the dashboard expects
(e.g. no GA4 City data), that filter is simply unavailable for that property — see "Filter availability" below —
rather than the app failing.

### Setting up authentication (once, shared by all four properties)

Two options — pick whichever your organization allows. Either way, this is a **one-time setup** that then works for
all four properties (only the Property ID differs per property).

**Option A — your own Google account via OAuth (works with Viewer-only access, no admin needed):**

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or pick a project, then enable the
   **Google Analytics Data API** (APIs & Services → Library → search for it → Enable).
2. APIs & Services → Credentials → **Create Credentials → OAuth client ID** → Application type **Desktop app**.
   Download the client ID and client secret.
3. Get a refresh token for scope `https://www.googleapis.com/auth/analytics.readonly`, authorizing with the same
   Google account that has Viewer access to your GA4 properties. The quickest way is Google's
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/):
   - Gear icon (top right) → check "Use your own OAuth credentials" → paste your client ID/secret.
   - Step 1: paste the scope above (or find "Google Analytics Data API v1") → Authorize.
   - Sign in with your Viewer-access Google account.
   - Step 2: **Exchange authorization code for tokens** → copy the **Refresh token**.
4. Put all three values in `.env`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   GOOGLE_OAUTH_REFRESH_TOKEN=...
   ```

**Option B — service account (requires an org admin, but simpler long-term — no token expiry):**

1. Create a service account + JSON key in Google Cloud Console, enable the Google Analytics Data API on that project.
2. Have an admin add the service account's email as a **Viewer** on **each** GA4 property you want connected
   (Admin → Property Access Management → add).
3. Set:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
   ```

### How to test each connection

1. Restart the dev server after editing `.env`.
2. Open `/setup` in the app.
3. Click **Test Connection** next to each property. You'll see either:
   - **"Connected to \<property\>."** — that property is now live.
   - An error naming the exact problem (missing Property ID, missing auth, or a GA4 API error) — see "Error
     handling" below.
4. On any dashboard page, the filter bar shows a **"GA4 Live"** (green) badge instead of **"Demo Data"** (amber)
   once the currently-selected property is connected — that's always your at-a-glance signal for which data source
   you're looking at.

## GA4 event names — the part specific to each property

GA4's standard ecommerce events (`session_start`, `view_item`, `add_to_cart`, `begin_checkout`, `purchase`) cover
FlowerAura Web, Bakingo Web, and Bakingo App's shopping funnels out of the box. **FlowerAura App and every property's
custom checkout-progress steps are not standard GA4 events** — they're whatever your GTM/gtag implementation
actually fires. Every event name is defined once, per property, in its own config file:

```
lib/properties/floweraura-web.ts
lib/properties/floweraura-app.ts
lib/properties/bakingo-web.ts
lib/properties/bakingo-app.ts
```

If your real GA4 event names differ from what's in one of these files (e.g. your checkout step events are named
differently), edit the `ga4EventName` fields in that property's file directly — there's no environment variable for
this, since the funnel *shape* (which events exist, in what order, with what labels) is inherently part of each
property's definition, not a runtime setting.

### Reproducing an existing GA4 segment (excluding traffic/pages/campaigns)

If your current GA4 reporting isn't just "count these events" but applies extra conditions — excluding blog/content
landing pages, certain ad campaigns, a specific traffic source, etc. — declare those as `baseFilters` on the
relevant funnel in that property's config, e.g. (FlowerAura Web's shopping funnel):

```ts
shopping: {
  // ...root, stages, ecr...
  baseFilters: [
    { dimension: "landingPage", match: "partial_regexp", value: "blog|/p/|quote|shayari", negate: true },
    { dimension: "sessionCampaignName", match: "partial_regexp", value: "Branding|display|demand|video", negate: true },
    { dimension: "sessionSourceMedium", match: "partial_regexp", value: "criteo", negate: true },
  ],
},
```

`dimension` is any GA4 API dimension name (e.g. `landingPage`, `sessionCampaignName`, `sessionSourceMedium`); `match`
is `"full_regexp"`, `"partial_regexp"`, or `"contains"` (matching GA4's own filter match types); `negate: true` means
"exclude rows matching this" (a NOT condition), matching is case-insensitive. **Shopping and checkout can declare
different `baseFilters`** — the two funnels are always fetched as separate GA4 requests specifically so this is
possible, so a property's checkout-side count for a shared event (e.g. `begin_checkout`) is never assumed to equal
its shopping-side count once they apply different filters. Because of this, whenever a funnel's root or a stage
event is shared with the other funnel AND either funnel declares `baseFilters`, give the two a distinct raw-counts
`key` (see how `checkoutRoot` / `checkoutPurchase` are named separately from `beginCheckout` / `purchase` in
FlowerAura Web's config) so one funnel's count is never silently overwritten by the other's.

## What's using mock data vs. real data today

- **Everything, for every property, until you set that property's GA4 env vars** — this is by design so the whole
  app (property switching, filters, comparisons, drop detection, breakdowns, charts, the >100% conversion warning)
  is fully demonstrable with zero configuration.
- Once a property's GA4 vars are set, **that property switches to `Ga4DataProvider` automatically** — independently
  of the other three. No code changes, no global "GA4 mode" flag (unless you explicitly set `DATA_PROVIDER=ga4`/`mock`
  to force one mode for all properties, e.g. for screenshots).
- The synthetic data generator (`lib/data-providers/synthetic.ts`) is property-aware: it walks each property's own
  `mockProfile` (baseline volume + per-stage conversion rates derived from the validation fixtures below) rather
  than one universal shape, and injects a mild, deterministic "recent 14-day dip" so drop-detection has something
  real to surface in demo mode. Bakingo Web's demo data deliberately reproduces its real >100% checkout-step
  reporting quirk, so you can see the data-quality warning fire even without live GA4 access.

## Validating your first real GA4 numbers

The exact fixture numbers you supplied are baked into `__tests__/properties.test.ts` and verified to reproduce the
stated percentages exactly (run `npm test`). To validate against your *live* GA4 data:

1. Set that property's `*_GA4_PROPERTY_ID` plus GA4 authentication, then `npm run dev`.
2. Open `/overview`, select the property, set the date to a single recent day, comparison to "vs D-7".
3. Cross-check the Shopping numbers against GA4's own UI: Explore → Funnel exploration, using the same event
   sequence as that property's `lib/properties/*.ts` file, same date, same filters. They should match — both use
   `activeUsers` scoped to each event, summed the same way.
4. Check the **Data Quality** panel — if it flags an event as unavailable, that almost certainly means an event name
   in that property's config doesn't match your real GA4 event; fix it there before trusting the numbers.
5. If a live number doesn't match what you expect: per spec, this dashboard never silently "corrects" a value to
   look more sensible. Investigate via Data Quality first (missing event, coverage gap, abnormal drop) — a
   discrepancy against a manually-supplied fixture number is a signal to check the funnel definition or the GA4
   configuration, not something the app will paper over.

## Conversion rates above 100%

Some properties' current GA4 reporting methodology produces a step with **more** users than the step before it —
notably Bakingo Web's checkout Step 1 (`checkout_step_1` / `checkout_step_0` = ~108%). This is preserved exactly:

- `lib/metrics.ts`'s `rate()` function never clamps its result to 100.
- The Data Quality panel flags it instead: **"Step conversion >100% — investigate event/user counting
  methodology."** (exact wording, configured once in `lib/config.ts` as `OVER_100_PERCENT_WARNING`).
- This applies uniformly to all four properties — it isn't special-cased to Bakingo Web, it just happens to trigger
  there given the real numbers.

## City model — GA4 City vs. Delivery City

GA4 only ever gives you **GA4 City**: a geo-IP-derived city for the visitor/session, not the delivery destination.
This dashboard labels it explicitly as "GA4 City" everywhere rather than implying it's the shipping address. Not
every property exposes it — see "Filter availability" below. A future non-GA4 order-data source could add a
separate "Delivery City" dimension without restructuring the dashboard; nothing here conflates the two.

## Filter availability

Not every filter is meaningful for every property — each property's config declares `availableFilters`, and the
filter bar only ever renders controls a property actually supports (a missing filter is hidden, never shown
disabled/broken):

| Property | GA4 City | Country | Device | Source | Medium |
|---|---|---|---|---|---|
| FlowerAura Web | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bakingo Web | ✓ | ✓ | ✓ | ✓ | ✓ |
| FlowerAura App | | ✓ | ✓ | ✓ | ✓ |
| Bakingo App | | ✓ | ✓ | ✓ | ✓ |

(App properties omit GA4 City by default, since app installs don't reliably carry a usable GA4 city dimension —
edit `availableFilters` in that property's config file if yours does.)

## "All Properties" / combined views (not built — a documented future extension)

The spec for this phase explicitly frames a combined "FlowerAura — All Platforms" / "All Properties" view as
something you *may* want later, not now, and this dashboard doesn't build it. The data model supports adding it
without restructuring: `lib/properties/index.ts` already exposes every property's config in one registry, and the
generic `RawCounts` engine sums raw counts before computing any rate — so a future combined view should sum
`RawCounts` across selected properties' *comparable* keys and compute one rate from the totals, exactly like
today's D-7/D-365 comparisons do, rather than averaging each property's ECR%. Properties whose funnels aren't
comparable (e.g. FlowerAura App's shopping funnel vs. Bakingo Web's) should not be silently combined — that
constraint should be enforced explicitly if/when this view is built.

## Architecture reference

```
lib/
  properties/
    types.ts               PropertyConfig / FunnelDefinition / MetricDefinition / FilterKey types
    floweraura-web.ts        one config file per property — event names, funnel shape, labels, mock baseline rates
    floweraura-app.ts
    bakingo-web.ts
    bakingo-app.ts
    index.ts                registry: PROPERTIES, PROPERTY_KEYS, getProperty(key)
  types.ts                  RawCounts (dynamic bag) + shared dashboard types — no fixed funnel shape here anymore
  config.ts                 ALL tunable thresholds (severity pp cutoffs, cache TTL, >100% warning text, etc.)
  date-utils.ts              D-7 / D-365 / range comparison-period math
  metrics.ts                 the ONLY place funnel %, ECR, pp/relative change, severity are computed — generic
                              over whatever FunnelDefinition/MetricDefinition it's given
  data-quality.ts            modular data-quality checks, generic over whatever event list a property declares
  view-model.ts               wires current/D-7/D-365 counts into per-card view models
  cache.ts                    in-memory TTL cache, keyed per-property, so repeated filter changes don't re-hit GA4
  data-providers/
    types.ts                  the DataProvider interface — every method takes the full PropertyConfig
    mock-provider.ts           synthetic demo data, property-aware
    ga4-provider.ts            real GA4 Data API calls, built dynamically from a property's event names
    ga4-config.ts              shared auth + per-property GA4_PROPERTY_ID env resolution
    synthetic.ts               deterministic mock-data generator, walks any property's funnel shape
    index.ts                   provider factory — selects mock/GA4 PER PROPERTY
app/
  api/
    funnel-counts/, daily-trend/, breakdown/, data-quality/, filter-options/   all take a `property` query param
    properties/route.ts                       lists all 4 properties + connection status (no secrets)
    properties/[key]/test-connection/route.ts  tests one property's GA4 connection
  overview/, shopping/, checkout/, definitions/, setup/   pages — render dynamically per selected property
components/                 presentational + data-fetching UI components — all generic over PropertyConfig
hooks/                       useDashboardFilters (URL-backed, includes the selected property key), useApiData, etc.
__tests__/
  properties.test.ts          registry + exact fixture validation for all 4 properties
  metrics.test.ts              generic calculation-engine tests
  data-quality.test.ts          modular data-quality checks, incl. the >100% warning
  mock-provider.test.ts         property-aware mock provider behaviour
  date-utils.test.ts            D-7/D-365/range math
```

### Adding a fifth property, or changing a funnel step

1. Copy the closest existing file in `lib/properties/` (e.g. `bakingo-app.ts` for another app property) and edit
   `key`, `displayName`, `brand`, `platform`, `ga4PropertyIdEnvVar`, `shopping`/`checkout` funnel stages and event
   names, `additionalMetrics`, `availableFilters`, and `mockProfile`.
2. Register it in `lib/properties/index.ts`'s `PROPERTIES` map and `PropertyKey` union in `lib/properties/types.ts`.
3. Add its Property ID env var to `.env.example`.
4. No UI changes needed — every page, KPI card, funnel diagram, breakdown table, and the Definitions page all
   render from the property's config automatically.

### Changing drop-severity thresholds

Edit `SEVERITY_THRESHOLDS` in `lib/config.ts`. Every severity badge, cell highlight, and "Where did ECR drop?"
ranking across all four properties reads from this one object.

## Known limitations / what's left

- The GA4 provider (`lib/data-providers/ga4-provider.ts`) is implemented against the documented Google Analytics
  Data API (`runReport`, event-scoped `activeUsers`) and generalized to build its requests from each property's own
  config, but has not been exercised against a live GA4 property in this environment (no GA4 credentials were
  available here) — validate it against your properties using the steps above before relying on it for daily
  reporting.
- Purchase revenue tracking (`purchase_revenue availability` in Data Quality) is optional and currently unused by any
  of the four properties' fixtures — wire it up per property by adding a `revenue`/`transactions` extra metric if you
  need it.
- "All Properties" / combined-brand views are intentionally not built — see that section above for how the data
  model supports adding it later without misleading aggregation.
- `npm audit` reports a handful of moderate-severity advisories in transitive dependencies of
  `@google-analytics/data` (an old `uuid` version pulled in via `google-gax`/`gaxios`) and in Next.js's own bundled
  `postcss`. None are exploitable through this app's own code paths (no user-controlled input reaches those
  packages), but re-run `npm audit` periodically and upgrade when fixed versions land.
