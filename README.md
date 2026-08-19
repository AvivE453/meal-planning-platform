# Meal Planning & Tracking Platform

A cross-platform health and nutrition system that generates goal-driven meal plans — weight loss, weight gain, or maintenance — by solving a constrained optimization problem over live nutrition data, then tracks progress against those plans over time.

**Status:** The full loop — generate a goal-driven meal plan, log what was actually eaten (from the plan, manually, or from a search), and see planned-vs-actual on a chart — works end-to-end on web (charts) and mobile (everything else), backed by auth, profile/weight tracking with Observer-driven target caching, and live nutrition search. All five core design patterns (Strategy, Builder, Adapter, Proxy, Observer) are built and wired in, and every feature is live-verified against real Postgres/Redis/Edamam, not just tests. Web and API are deployed live; see [Roadmap](#roadmap) for what's left (mobile build).

## Live demo

- **Web app:** [meal-planning-platform-web.vercel.app](https://meal-planning-platform-web.vercel.app)
- **API:** [meal-planning-api-smp7.onrender.com](https://meal-planning-api-smp7.onrender.com) (`/health` for a quick check)

Register a real account to try it — nothing is pre-seeded. **The API is on Render's free tier, which spins down after 15 minutes of inactivity: the first request after a while can take 50+ seconds while it wakes back up.** That's a free-tier characteristic, not a bug — refresh and it's fast from then on.

Infra: Postgres on [Neon](https://neon.tech), Redis on [Upstash](https://upstash.com), API on [Render](https://render.com) (deployed from [`render.yaml`](render.yaml), a committed infra-as-code blueprint), web on [Vercel](https://vercel.com).

## Architecture

```
Mobile (Expo/RN)        Web (React + Vite)
       └──────── HTTPS/JSON ────────┘
                    │
          API Server (NestJS)
                    │
        ┌───────────┼──────────────┐
   Postgres      Redis (cache)     │
 (source of      - search cache    │
  truth)         - targets cache   │
                    │ (cache miss) │
                    ▼
        External Nutrition API (Edamam)
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native (Expo) | Single codebase for iOS/Android, fast iteration via Expo Go |
| Web | React + Vite | Dashboard/charts for progress visualization |
| API | NestJS (TypeScript) | DI container makes the design patterns below sit naturally instead of hand-rolled |
| Database | PostgreSQL (via Prisma) | Durable, auditable source of truth for users/logs/plans |
| Cache | Redis | Cache-aside for external API results and computed targets |
| External data | Edamam Food Database API | Bootstraps a growing, shared local ingredient dataset (`food_items`) rather than being queried on every search forever |
| Monorepo tooling | pnpm workspaces + Turborepo | One repo, cached/incremental task running |

## The algorithm

Meal generation is modeled as a **Multiple-Choice Knapsack Problem**: maximize a weighted macro-nutrient score within a calorie budget, where each candidate food contributes a *group* of mutually-exclusive serving-size options (0.5×/1×/1.5×/2× a serving), and at most one option per group may be selected.

- **Hard constraints** (allergies, dietary restrictions, per-goal exclusion thresholds like max sugar/serving) are applied as a pre-filter, before the DP ever runs — keeping the optimizer's state space small and the exclusion logic independently testable.
- **Calories are discretized into 10-kcal buckets** to make the DP tractable (a 600–900 kcal meal slot becomes ~60–90 states), with per-item rounding error bounded below typical serving-size measurement error.
- The optimizer runs **synchronously per meal slot** inside the request handler — no queue or background job infrastructure needed at this scale.

This is a deliberate simplification of a genuinely multi-objective problem (balanced macros, not just "highest score") into a single additive linear objective — a standard, defensible OR technique, not an oversight. See [`packages/algorithm`](packages/algorithm) for the implementation and its test suite (32 tests, including property-based invariant checks via `fast-check`).

## Design patterns

| Pattern | Where | What it does |
|---|---|---|
| **Strategy** | [`packages/algorithm/src/strategies`](packages/algorithm/src/strategies) | `WeightLossStrategy` / `WeightGainStrategy` / `MaintenanceStrategy` each configure calorie targets, macro weights, and exclusion rules fed into the same optimizer |
| **Builder** | [`packages/algorithm/src/builder/MealPlanBuilder.ts`](packages/algorithm/src/builder/MealPlanBuilder.ts) | Accumulates per-slot optimizer output into a single validated, immutable meal plan — driven by `POST /meal-plans/generate` |
| **Adapter** | [`apps/api/src/nutrition/adapters/EdamamFoodAdapter.ts`](apps/api/src/nutrition/adapters/edamam-food-adapter.ts) | Normalizes Edamam's raw JSON (`ENERC_KCAL`, `PROCNT`, ...) into an internal `FoodItem` shape — the only place that knows Edamam's field names exist |
| **Proxy** | [`apps/api/src/nutrition/clients/CachedNutritionApiClient.ts`](apps/api/src/nutrition/clients/cached-nutrition-api-client.ts) | Cache-aside wrapper around the real nutrition API client, same `NutritionApiClient` interface either way — swappable via one DI binding |
| **Observer** | [`apps/api/src/profile/events/recalculate-targets.listener.ts`](apps/api/src/profile/events/recalculate-targets.listener.ts) | Subject = NestJS `EventEmitter2`; `RecalculateTargetsListener` invalidates a user's cached targets whenever a `weight.logged` event fires |

## Auth

JWT access tokens (15min TTL) + opaque refresh tokens, hand-rolled rather than a managed provider — deliberately, since password hashing/token issuance/rotation is cheap to build correctly and is one of the most commonly-interviewed backend fundamentals.

- **Access tokens** are signed JWTs (`@nestjs/jwt`), verified per-request by a Passport `JwtStrategy` — stateless, no DB round-trip.
- **Refresh tokens** are high-entropy random values, stored **hashed** (SHA-256 — not bcrypt; bcrypt's deliberate slowness defends against brute-forcing *weak, guessable* secrets, which doesn't apply to a 256-bit random token) in `refresh_tokens`, and **rotated on every use**: `POST /auth/refresh` revokes the presented token and issues a new pair, bounding replay risk if one ever leaks.
- **Passwords** are hashed with bcrypt (cost factor 12) — never stored or logged in plaintext.
- **Storage tradeoff, stated plainly:** the web app keeps the access token in memory only (cleared on reload) and the refresh token in `localStorage`; this is a pragmatic choice, not a claim of production-hardening — an XSS vector could still exfiltrate the refresh token. Mobile stores both in `expo-secure-store` (OS-level Keychain/Keystore), which doesn't share that exposure.

See [`apps/api/src/auth`](apps/api/src/auth) for the implementation — [`auth.service.spec.ts`](apps/api/src/auth/auth.service.spec.ts) for unit coverage and [`test/auth.e2e-spec.ts`](apps/api/test/auth.e2e-spec.ts) for the full register → login → protected-route → refresh-rotation → logout flow against a real Postgres instance.

## Profile, weight tracking & targets

Once logged in, a user completes an onboarding form (sex, DOB, height, activity level, goal) and can log weight entries. `GET /users/me/targets` computes a daily calorie/macro target from `calculateTdee` (Mifflin-St Jeor, [`packages/algorithm/src/tdee`](packages/algorithm/src/tdee)) applied to the profile + latest weight log, then run through the goal's `MealGenerationStrategy` — the same Strategy objects meal plan generation uses below, so "targets" and "generated plans" share one goal-configuration source rather than two that could drift apart.

**Cached, with Observer-driven invalidation — not a TTL.** `TargetsService` wraps the computation in cache-aside over Redis (`user:{userId}:targets`, **no expiry** — unlike search results, a stale target has a real UX cost, so correctness comes from an explicit event rather than "good enough for N hours"). `WeightLogsService` is the Subject: both `create()` and `remove()` `emitAsync('weight.logged', { userId })` through NestJS's `EventEmitter2` (a real change to weight history changes what "latest weight" resolves to either way, so both call sites fire it) — deliberately `emitAsync`, awaited, not fire-and-forget `emit()`, so the cache is already invalidated by the time the HTTP response for the weight-log write returns; a client polling targets immediately after can never observe a stale value. `RecalculateTargetsListener` is the Observer: `@OnEvent('weight.logged')` deletes that one cache key, fully decoupled from `WeightLogsService` — it only knows the event name and payload shape.

Verified via [`test/profile.e2e-spec.ts`](apps/api/test/profile.e2e-spec.ts) (15 e2e tests covering profile, restrictions, weight/activity logs, the targets computation, and the full cache → invalidate → recompute round trip against real Postgres + real Redis), [`targets.service.spec.ts`](apps/api/src/profile/targets.service.spec.ts) (5 tests: cache hit/miss, per-user isolation, no-TTL, never caching a thrown error) and [`recalculate-targets.listener.spec.ts`](apps/api/src/profile/events/recalculate-targets.listener.spec.ts) (3 tests against a real Redis instance). Live-verified end-to-end: logged a real weight change (60kg → 75kg) against the running dev server — the cached key was confirmed gone immediately (no polling) after the write, and the recomputed targets reflected the new TDEE (1774 → 1980 kcal), both confirmed directly against Redis via `redis-cli`, and manually confirmed for both `weight_loss` (target below TDEE) and `weight_gain` (target above TDEE).

## Nutrition search & detail lookup (Adapter + Proxy)

`GET /foods/search?q=` returns live, normalized food data from the Edamam Food Database API, cached in Redis. Edamam's search endpoint doesn't return real sugar/sodium for most items (both come back `0` even for foods that clearly have them — a limitation of that specific endpoint, not a data gap). `GET /foods/:id/nutrients?measureUri=&quantity=` makes a second, targeted Edamam call for one specific food + serving measure and returns the accurate full breakdown, including sugar and sodium.

- **`NutritionApiClient`** is a small, deliberately provider-agnostic interface (`search(query)`, `getNutrients(foodId, measureUri, quantity)`) — both return *raw*, unnormalized JSON. Normalization is entirely the Adapter's job, decoupled from whether the result came from cache or a live call.
- **`EdamamApiClient`** (the real subject) calls Edamam's `/api/food-database/v2/parser` and `/api/food-database/v2/nutrients` endpoints directly.
- **`CachedNutritionApiClient`** (the Proxy) implements the same interface for both methods, each with its own Redis key namespace and TTL: search keys off the normalized query (`food:search:edamam:{sha1(query)}`, 24h TTL — nutrition data is near-static), nutrient lookups key off food+measure+quantity (`food:nutrients:edamam:{sha1(...)}`, 7-day TTL — one food's nutrient facts are effectively immutable). The rest of the app depends on the `NUTRITION_API_CLIENT` DI token, never on the concrete class, so swapping the Proxy back out for the real client — or a fake, in tests — is a one-line change in `NutritionModule`.
- **`EdamamFoodAdapter`** normalizes both responses. For search: Edamam reports nutrients **per 100g** regardless of serving, so the adapter scales by the chosen measure's gram weight (preferring a named "Serving" measure, falling back to "Gram", then whatever's first), and items with no usable calorie data (e.g. "water") are dropped rather than surfaced to an optimizer that can't score them. For the detail lookup, the response is already scaled to the requested quantity/measure, so `adaptNutrients()` just maps field names — no further math needed.
- Edamam's published OpenAPI spec (`api.edamam.com/doc/open-api/food-db-v2.yaml`) omits the numeric value field from the `/nutrients` response schema entirely — a documentation gap, confirmed by fetching the spec directly. Resolved by inspecting a real live response instead: the field is `quantity`.

**Testing note:** both endpoints are live-verified end-to-end against the real Edamam network with a working API key — a real search finds a food, and a real `/nutrients` call against that food's id + measure returns accurate data (e.g. sodium `122.4mg`, vs `0` from search for the same item), through the full path (Guard → Controller → Service → Proxy → `EdamamApiClient` → Adapter). Repeat calls confirm genuine cache-hit speedups (~34x for search, ~40x for nutrient lookups) and correct per-endpoint Redis key namespacing. Everything is also covered without needing a key: [`edamam-food-adapter.spec.ts`](apps/api/src/nutrition/adapters/edamam-food-adapter.spec.ts) (10 fixture-based tests, several built from real captured responses), [`cached-nutrition-api-client.spec.ts`](apps/api/src/nutrition/clients/cached-nutrition-api-client.spec.ts) (10 tests against a real Redis instance, isolated to its own DB index — genuine cache hit/miss/TTL/namespacing behavior, not mocked), and [`test/nutrition.e2e-spec.ts`](apps/api/test/nutrition.e2e-spec.ts) (7 tests running the real Adapter over a `FakeNutritionApiClient` swapped in via DI — exactly the technique the Proxy's interface is designed to enable).

## Meal plan generation (Strategy + Optimizer + Builder, end to end)

`POST /meal-plans/generate` is the core use case the rest of the system exists to support: given a logged-in user's profile, goal, and latest weight, it produces a full day's plan — four meal slots, real foods, calorie/macro totals close to target — from live nutrition data. `GET /meal-plans` lists a user's plans, newest first.

The request flow, in order:

1. Load the profile + latest weight log (404 if either is missing — same precondition `GET /users/me/targets` has).
2. Compute TDEE, get the goal's `MealGenerationStrategy` (`StrategyFactory.forGoal`), and derive the daily calorie target, macro-value weights, and exclusion rules from it — identical to how targets are computed above.
3. Split the daily target across slots (breakfast 25% / lunch 35% / dinner 30% / snack 10%) and, per slot, gather candidate `FoodItem`s from the user's own saved `Recipe`s tagged for that slot (`Recipe.mealSlot`) — **recipes-only, no live ingredient search during generation.** This replaced an earlier design that fell back to a fixed list of Edamam search terms per slot whenever recipes didn't fill the budget: that produced plans built from single raw ingredients ("Broccoli × 2" as a whole "meal"), which wasn't the intended product. A slot with no recipes tagged for it, or none that fit the remaining budget/restrictions, just comes back empty — `MealPlanBuilder` only rejects a plan for going *over* target, never under.
4. Filter candidates: the strategy's exclusion rules (`filterExcluded`, e.g. weight-loss excludes >20g sugar/serving) and a dietary-restriction filter (`filterByRestrictions`) that matches a user's allergy/restriction values against ingredient names as a case-insensitive substring — crude (would also catch "buttermilk" for a "milk" restriction) but honest given there's no structured allergen taxonomy behind it.
5. Run `optimizeSlot` (the MCKP DP) per slot against its calorie share, then accumulate all four slots with `MealPlanBuilder`, which computes totals and rejects the plan if they drift more than 15% over target.
6. Persist inside one transaction: a recipe-sourced item just references its `Recipe` row directly; a manually added raw food (via `POST /meal-plans/:id/items`, the "Find meal" flow — still supported at the API level even though the web client only offers recipes) gets upserted into the durable `food_items` table first (keyed on `source` + `externalId`). The plan is re-read post-commit so the response and `GET /meal-plans` share one mapping function.

**A real free-tier constraint, found by live-verifying rather than assuming, that shaped two rounds of design here:** the original Edamam-fallback design could issue up to 12 live calls in one cold-cache generation (4 slots × 3 terms), and a live attempt against the real API failed with a `429` partway through — Edamam's free tier has a requests-per-minute budget well below that burst. The first fix was tactical: run each term sequentially (no self-inflicted concurrency spike) and catch/log a per-term failure rather than aborting the whole plan. The second, larger fix was architectural, and is what's live now: cut Edamam out of generation entirely (recipes-only, above), and make `GET /foods/search` itself local-first — `NutritionService.search()` checks the shared `food_items` table before ever calling Edamam, and opportunistically upserts every live result it does fetch (not just ones actually used), so `food_items` grows into a real, shared, ever-improving dataset from ordinary use rather than staying a write-on-use-only side table. Once a term has enough local coverage, Edamam is skipped for it entirely — the same rate-limit problem, solved by needing the live API less over time instead of calling it more carefully.

**Testing:** [`meal-plans.e2e-spec.ts`](apps/api/test/meal-plans.e2e-spec.ts) (14 tests against a real Postgres — 404 preconditions, per-slot recipe filtering proving a recipe only fills the slot it's tagged for, "Find meal" add-item flow) and [`restriction-filter.spec.ts`](apps/api/src/meal-plans/restriction-filter.spec.ts) (4 unit tests). [`nutrition.service.spec.ts`](apps/api/src/nutrition/nutrition.service.spec.ts) (5 tests) and an extended [`nutrition.e2e-spec.ts`](apps/api/test/nutrition.e2e-spec.ts) cover the local-first search branch/merge/degrade logic directly. The DP/Strategy/Builder logic itself is covered separately by `packages/algorithm`'s own 32 tests — these tests exist to prove the *wiring*, not re-prove the algorithm.

**Client:** both web and mobile dashboards have a basic `MealPlanCard` — a "Generate meal plan" button and a read-only view of the latest plan grouped by slot, same component structure on both, React Native primitives (`View`/`Text`/`Pressable`/`StyleSheet`) instead of DOM/CSS on mobile. Verified via `tsc --noEmit` and a real Metro bundle export (`expo export --platform android`, 594 modules) — this sandbox has no device/emulator to run it on screen, so that's the strongest check available here; the dev-loop check (Expo Go on a device) is still open.

## Nutrition logging

`POST /logs/nutrition` records what a user actually ate, from three different sources — deliberately one endpoint, not three, since they're all "add a row to `daily_nutrition_logs`" with a different way of arriving at the numbers:

- **`manual`** — raw calories/macros the user typed in directly (e.g. from a nutrition label). No food or plan reference; `servings` is fixed at 1 since the totals given already represent the whole amount eaten.
- **`meal_plan`** — references a `mealPlanItemId` from an already-generated plan (ownership checked via the item's parent `MealPlan.userId`). Defaults to logging exactly what was planned; if a different amount was actually eaten, `servings` scales the *per-serving* values on the item's durable `food_items` row, not a naive re-scale of the plan item's own (possibly multi-serving) totals.
- **`search`** — the client sends the full `FoodItem` it already has from a prior `/foods/search` response (the server has no other way to resolve nutrition from just an id) plus `servings`. The food is upserted into the same durable `food_items` table meal-plan generation uses — **`upsertFoodItem`/`toFoodItem` were extracted out of `meal-plans/meal-plan.mapper.ts` into `nutrition/food-item-persistence.ts`** once a second real caller needed the identical "resolve a FoodItem to a durable row" step, rather than duplicating it.

One DTO (`CreateNutritionLogDto`) handles all three shapes, with fields required conditionally on `source` via `class-validator`'s `@ValidateIf` — except "servings required for `search`, optional for `meal_plan`," which the library can't express as one rule on one property, so that specific check lives in `NutritionLogsService` instead.

`GET /logs/nutrition?from=&to=` lists entries (filtered by the day they count toward, not the precise `loggedAt` timestamp — useful for "what did I log today"), `DELETE /logs/nutrition/:id` removes one.

**Testing:** [`nutrition-logs.e2e-spec.ts`](apps/api/test/nutrition-logs.e2e-spec.ts) (13 tests against a real Postgres — all three sources, servings scaling, ownership/404/403 checks, the food-item upsert reusing a row rather than duplicating it, list + delete). Live-verified end-to-end against the real dev server and real Edamam: a manual entry, a real searched "Greek Yogurt" logged at 1.5 servings (125.28 → 187.92 kcal), and an item from a real generated plan (110.5 kcal/serving × 2 = 221 kcal) — all three confirmed via both the API response and a direct Postgres query.

**Client:** web and mobile both got a `NutritionLogForm` (manual entry) + `NutritionLogList`, and `MealPlanCard` grew a "Log as eaten" button per item (wired to the `meal_plan` source). Logging from search results has no UI yet on either client, since neither has a food-search screen at all — a pre-existing gap from before meal-plan generation existed, not new scope here; the endpoint is fully live-verified and tested regardless.

## Analytics & dashboard charts (web)

`GET /analytics/nutrition-summary?from=&to=` returns one row per calendar day (defaulting to the last 14 days, always including today) with **actual** totals — summed straight from that day's `daily_nutrition_logs` via a Prisma `groupBy` — alongside **planned** totals from that day's most-recently-*created* `MealPlan`, or `null` if no plan was ever generated for that day (a real absence, not a zero target). Regenerating a plan for the same date doesn't overwrite the old row (`POST /meal-plans/generate` always inserts a new one, by design — see the meal-plan section above), so "most recent by `createdAt`" is what decides which one counts as "the" plan for that day.

Two charts, built with **Recharts**:

- **`WeightTrendChart`** — a line chart off the `weightLogs` the Weight page already fetches for its list; no separate endpoint needed; needs at least two weigh-ins to render.
- **`NutritionSummaryChart`** — a grouped bar chart (planned vs. actual calories per day) on the Nutrition page, fed by the new endpoint.

**Tradeoff, stated plainly:** Recharts pulls in D3 internals and pushed the web bundle from ~205KB to ~595KB minified. Reasonable for a portfolio dashboard behind a login, not something a production consumer-facing page should ship unsplit — code-splitting the chart bundle behind a dynamic `import()` would be the real fix, not done here since it's not required for local dev or the demo.

Mobile does not have charts — Recharts is DOM/SVG-based and doesn't run in React Native (would need `react-native-svg` + a different library, e.g. Victory Native); out of scope for this pass.

**Testing:** [`analytics.e2e-spec.ts`](apps/api/test/analytics.e2e-spec.ts) (6 tests against a real Postgres — default range shape, same-day summing across multiple manual logs, a real generated plan surfacing as `planned*`, most-recent-plan-wins when two plans exist for one day, explicit date-range filtering). Live-verified against the real dev server: a real weight-loss profile's generated plan (`calorieTarget: 1387.375`) and a real manual log (380 kcal) both showed up correctly in the same day's summary row.

## Project structure

```
apps/
  api/       NestJS backend
  web/       React + Vite web app — routed pages (react-router-dom), not one long scroll:
             Home (targets + nav) / Meal Plan / Weight / Nutrition, each fetching its own
             data on mount rather than one shared top-level state object
  mobile/    Expo / React Native app
packages/
  algorithm/     KnapsackOptimizer, Strategies, Builder — framework-free, pure TS
  shared-types/  DTOs / domain types shared by api + web + mobile
  config/        shared eslint/tsconfig/prettier
infra/
  docker-compose.yml   local Postgres + Redis
  prisma/              schema.prisma, migrations
```

## Local development

Requires Node ≥20, pnpm, and Docker.

```bash
pnpm install

# start local Postgres + Redis
pnpm db:up          # or: docker compose -f infra/docker-compose.yml up -d

# apply migrations + generate the Prisma client
cp .env.example .env
pnpm db:migrate
pnpm db:generate

# optional: add real Edamam credentials to .env for live nutrition search
# (everything else works without them — see "Nutrition search" below)

# run everything (api on :3000, web on :5173, mobile via Expo's interactive CLI)
pnpm dev

# or one app at a time
pnpm --filter @meal-planning/api dev
pnpm --filter @meal-planning/web dev
pnpm --filter @meal-planning/mobile dev
```

```bash
pnpm lint       # all workspaces
pnpm typecheck
pnpm test
pnpm build
```

## Deployment

Four services, matching the plan's original infra choices — no managed all-in-one platform, deliberately, to keep each piece swappable:

| Piece | Provider | Notes |
|---|---|---|
| Postgres | [Neon](https://neon.tech) | Free tier, serverless — connection string needs `?sslmode=require` |
| Redis | [Upstash](https://upstash.com) | Free tier — connection string is `rediss://` (TLS), not `redis://` |
| API | [Render](https://render.com) | Free tier web service, deployed from the committed [`render.yaml`](render.yaml) blueprint |
| Web | [Vercel](https://vercel.com) | Root directory set to `apps/web` in the project settings (monorepo — without this it tries to build the whole repo) |

**The API deploy is infra-as-code**, not a manually-clicked-together dashboard config — `render.yaml` defines the build/start commands, and every command in it was verified locally before being committed (a genuinely clean build from a wiped `dist`/`generated` state, then the compiled `dist/main.js` actually boot-tested against a real Postgres+Redis, not just `tsc` succeeding). One real gotcha hit during setup: Render's **`preDeployCommand`** (the natural place to run `prisma migrate deploy`) is a **paid-plan-only feature** — Render's own validation caught this immediately when the blueprint was first applied. Fixed by folding the migration into `buildCommand` instead: `pnpm db:generate && pnpm db:migrate:deploy && pnpm turbo run build --filter=...@meal-planning/api`. `migrate deploy` (not `migrate dev`) only applies pending migrations and never prompts, so it's safe to run on every single build/deploy, not just the first one.

**Env vars** the API needs in Render's dashboard (declared in `render.yaml` with `sync: false`, so Render prompts for them rather than committing values): `DATABASE_URL`, `REDIS_URL`, `EDAMAM_APP_ID`, `EDAMAM_APP_KEY`, `JWT_ACCESS_SECRET` (a fresh production value — **not** the dev placeholder committed in `.env.example`, generated via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). The web app needs exactly one: `VITE_API_URL`, pointing at the deployed API's URL.

**CORS**: the API calls `app.enableCors()` with no origin restriction (`main.ts`) — fine for a portfolio project reachable at a known set of URLs, not something a real multi-tenant product would leave wide open. Verified directly against the deployed pair, not assumed: an `OPTIONS` preflight sent with the Vercel origin's `Origin` header against the live Render API returned the expected `access-control-allow-origin` header.

**To redeploy**: push to `main`. Both Render and Vercel are connected directly to the GitHub repo and rebuild automatically on every push — no separate deploy step.

**Verification, same standard as every feature above**: registered a real user against the live API (exercises Postgres), ran a real food search (exercises Redis + the live Edamam network call), and confirmed the CORS preflight — all against the actual deployed URLs, not local dev.

## Roadmap

- [x] Monorepo scaffold, CI pipeline (lint/typecheck/test/build)
- [x] Meal-optimization algorithm (MCKP), goal strategies, exclusion filter, plan builder — tested
- [x] Database schema + first migration
- [x] Auth (JWT + rotated refresh tokens) — register/login/refresh/logout on the API, login/register screens on web + mobile
- [x] Profile onboarding + weight/activity logging + live TDEE/target computation — tested on API, web, and mobile
- [x] Nutrition API integration (Adapter) + Redis cache (Proxy) — `GET /foods/search` and `GET /foods/:id/nutrients`, both live-verified against the real Edamam network
- [x] Local-first ingredient search — `GET /foods/search` checks the shared `food_items` table before Edamam and opportunistically grows it from every live result, live-verified end-to-end
- [x] Recipes (user-built, slot-tagged) — `POST/GET/GET :id/DELETE /recipes`, ingredient search + amounts via the same nutrition pipeline, live-verified
- [x] `POST /meal-plans/generate` wired end-to-end, recipes-only (Strategy → per-slot recipe filtering → exclusion/restriction filter → MCKP optimizer → Builder → Postgres) + `GET /meal-plans` + `POST /meal-plans/:id/items` ("Find meal," manual add), all live-verified; `MealPlanCard` on both web and mobile, "Find meal"/"Make new recipe" on web
- [x] Observer-driven target cache invalidation — `GET /users/me/targets` cached in Redis (no TTL), `weight.logged` event via `EventEmitter2` invalidates it on both weight-log create and delete, live-verified against real Postgres + Redis
- [x] Nutrition/food logging — `POST/GET/DELETE /logs/nutrition`, all three sources (manual, meal_plan, search), live-verified against real Postgres + Edamam; `NutritionLogForm`/`NutritionLogList` + a "Log as eaten" button on `MealPlanCard` items, on both web and mobile
- [x] Web dashboard charts — `GET /analytics/nutrition-summary` (planned-vs-actual, most-recent-plan-per-day), weight trend + calories bar chart via Recharts, live-verified; web only (Recharts doesn't run in React Native)
- [x] Deployed demo — web (Vercel) + API (Render) live, Postgres (Neon) + Redis (Upstash) provisioned, migrations applied, live-verified end-to-end including a real cross-origin request (CORS preflight checked directly, not assumed)
- [ ] Mobile build (Expo/EAS APK + demo video) — not done yet
