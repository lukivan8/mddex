# Changelog

## 2.4.0 — 2026-10-14

- Split daily active browsers into mutually exclusive new, returning and unknown cohorts while preserving total unique-browser DAU and Asia/Almaty day boundaries.
- Keep newly established browser IDs new throughout their first tracked day, including repeat sessions and tabs. Preserve existing IDs; classify their initial baseline day and historical activity as unknown instead of inventing first-seen history.
- Add stacked cohort counts, total line, tooltips and an accessible table to the existing DAU report. Preserve DNT/GPC, blocked-storage fallback, offline capture times, legacy events and report history. No additional requests/events, dependencies, bindings or D1 migrations.
- Cohorts do not correlate R2 missing-object errors to visitors; that would require separate failure telemetry.

### Release validation

`npm run doctor`, `npm run check` (319 unit tests in 52 files), `CI=true npm run test:e2e -- --workers=1` (155/155 Chromium tests), `npm run build`, and `git diff --check` pass. Production preview verifies Build, Catalog, complete Axe detail content, quests and plain-text missing-asset 404s; local v4 ingestion returns 204. The live read-only DAU query succeeds and preserves historical totals as unknown. The initial release unit run caught equal-timestamp ordering in the new outbox fixture; distinct fixture timestamps resolve that test assumption, its isolated rerun passes 8/8, and the complete checks pass. Initial scoped browser startup was blocked by sandbox networking; the permitted local-server rerun passes. No production migration is required.

## 2.3.1 — 2026-10-12

- Reuse prepared catalog-detail data and canonical-path lookups for each immutable catalog snapshot, keeping concurrent requests and refreshed releases separate.
- Send the current dossier once and limit related cards to their rendered names, artwork, links, descriptions, effect tiers and armor set/slot metadata. Keep reverse mob-drop references for SEO and remove unused quest/drop-calculation payloads from details.
- Preserve full raw catalog data for builder eligibility and quest resources. No dependencies, D1 migrations, catalog exports or Worker configuration change.

### Release validation

`npm run doctor`, `npm run check` (306 unit tests in 50 files), `npm run build`, and `git diff --check` pass. The complete Chromium suite passes 149/149 tests with one worker against the final source in an isolated production-Worker harness with local D1, catalog fixtures and external network blocked; no test assertions changed. Fourteen representative detail pages retain identical rendered text, links, artwork and SEO, and hydrated power changes, related navigation and quests pass. The normal production preview verifies Build, Catalog, artifact/location/melee details, quests and plain-text missing-asset 404s.

Three alternating local workerd profile pairs, with all relevant shards primed and zero fetches during warm measurements, reduce Howling Woods sampled active CPU from a median 12.51 to 8.30 ms/request and HTML from 427,157 to 179,095 bytes compared with the initial prepared-catalog patch. Its loader payload falls from 351,734 to 74,476 bytes. Warm artifact/melee samples also improve. Local samples are not billed edge CPU: the cold artifact remains about 68 ms because release/index/source-artwork data still needs parsing, so this release does not claim to eliminate cold-request CPU failures.

## 2.3.0 — 2026-10-10

- Add an automatic farming planner for saved builds, shared build links and individual variants, with compact item toggles and selected effect icons.
- Find overlapping location and quest stops, collapse previously covered items, and default collected one-time unlocks to disabled using the local tracker.
- Add optional boss farming with recommended bosses and owner-selected Unique conversion estimates; show published artifact pool shares in catalog details and planner routes.
- Preserve local builds, tracker records and shared snapshot formats. No dependencies or D1 migrations change.

### Release validation

`npm run doctor`, `npm run check` (282 unit tests), `CI=true npm run test:e2e -- --workers=1` (149/149 browser tests), `npm run build`, and `git diff --check` pass. Production preview verifies the rendered planner, builder, catalog and complete Axe detail content, plus plain-text 404s for missing assets. The initial preview check expected “Collection” instead of the actual “Catalog” heading; correcting the check confirmed the rendered catalog. No dependencies or D1 migrations change.

## 2.2.0 — 2026-10-09

- Add a catalog-backed quest resource with searchable prerequisites, a pan/zoom Metro graph, minimap, and a vertical layout on mobile.
- Switch between graph and quest details with a floating control. Show numbered objectives in a panel contained within the details block, visual reward pools with catalog artwork, quest type icons, levels, repeatability, and lore-styled completion journals.
- Link item quest rewards directly to the matching quest details and hide the redundant Deep Dark dungeons acquisition entry.
- Load one pinned location shard for the complete quest graph; preserve local builds and tracker data. No dependencies or D1 migrations change.

### Release validation

`npm run doctor`, `npm run check` (265 unit tests), `npm run build`, and `git diff --check` pass. `CI=true npm run test:e2e -- --workers=1` passes 143/144 tests; the analytics queue test encounters a navigation-context race. Its isolated rerun, `CI=true npm run test:e2e -- e2e/analytics.spec.ts --grep 'queues several real UI events' --workers=1`, passes 1/1. Quest desktop/mobile and retry browser coverage passes in the full suite.

Production preview verifies complete direct Axe HTML and its quest link, all 42 catalog quests, mobile vertical Metro, reward pool grouping/artwork, contained objectives, and plain-text 404s for missing assets. No dependencies or D1 migrations change.

## 2.1.3 — 2026-10-09

- Show average published drop rates below matching acquisition locations, omitting unsupported or conflicting catalog odds. Unique items identify the base drop and explain source-specific unique chances once below the locations.
- Remove repeated acquisition prose and unique-variant notes, and use published Town Merchant reference artwork.
- Keep the requested drop-rate footer hidden and preserve source-specific acquisition conditions.

### Release validation

`npm run doctor`, `npm run check` (253 unit tests), `CI=true npm run test:e2e -- --workers=1` (141/141 tests), `npm run build`, and `git diff --check` pass. Production preview confirms live catalog drop-rate averages, the shared unique-chance explanation, Town Merchant artwork loading, and the removed footer. No dependencies or D1 migrations change.

## 2.1.2 — 2026-10-09

- Show published dungeon/rift artwork in item details' “Where to find it” rows as well as location entrance cards.
- Resolve acquisition source URLs against matching instances in the pinned location shards, load each referenced location once, and reuse the existing detail cache. Keep in-app core content immediate, builder loading index-only, and missing/failed artwork sources usable.

### Release validation

`npm run doctor`, `npm run check` (245 unit tests), and `npm run build` pass. Production preview renders all three dungeon source images on Witch Brew from the live catalog. The new lazy-acquisition browser test passes after correcting its initial catalog-loading wait; the initial scoped run passed 13/14 with that test setup failure, and its isolated rerun passed 1/1. No dependencies or D1 migrations change.

The final `CI=true npm run test:e2e -- --workers=1` run passes **139/139 tests** (4.5 minutes).

## 2.1.1 — 2026-10-09

- Display published dungeon and rift artwork on location entrance cards. Preserve instance icon references through detail projection and resolve them against the pinned catalog's CDN artwork.
- Keep entrance descriptions and entries without artwork intact, with the existing fallback for failed images.

### Release validation

`npm run doctor`, `npm run check` (242 unit tests), and `npm run build` pass. Production preview renders both dungeon and rift images from the live catalog on the Frozen Highlands detail page. No dependency or D1 migration changes.

`CI=true npm run test:e2e -- --workers=1` passes 137/138 tests; the mobile compatible-picker test times out during a page reload. Its isolated rerun, `CI=true npm run test:e2e -- e2e/build.spec.ts --grep 'mobile uses the same compatible picker inside a sheet' --workers=1`, passes 1/1. Dungeon/rift artwork coverage passes in both the earlier scoped category run (9/9) and the full suite.

## 2.1.0 — 2026-10-08

- Add independent build variants, loadout duplication, variant sharing/community snapshots, and improved desktop/mobile picker behavior.
- Add random-effect catalog filters, richer acquisition/reference relationships, and refreshed catalog presentation.
- Add resource pages for Soul Storm forecasts/routes, credited melee timing references, and locally saved item tracker views with sharing/export.
- Add structured community video presentation and retain verified creator ownership and idempotent publication.
- Queue product analytics in IndexedDB with bounded batches, cross-tab leases, retry/capture timestamps, compatible reports, and Almaty daily history.
- Recover stale lazy assets after deployments with plain missing-asset responses and a bounded browser reload.
- Package targeted HeroUI styles, small UI WebP assets, and credited reference assets/data.
- Add shared agent instructions, Claude entry point, continuation handoff, engineer setup guide, architecture/performance plan, release runbook, six repository skills, and a read-only workspace doctor checked by CI.
- Align outdated browser fixtures with catalog database v2 and current category controls; reserve variant-control space in the loading layout to prevent a mobile workspace shift. Gate layout-test responses explicitly and defer shared tracker fragments until hydration to preserve initial server/client HTML.

### Release validation

Type checking, linting and 241 unit tests pass. A clean source copy installs with `npm ci`, applies all five local D1 migrations, passes the workspace doctor and the same checks, and builds production output without copied credentials or database state. Production preview returns rendered Build, Catalog, Resources and item-detail HTML; missing assets return a plain-text 404 with `no-store`. All six skills validate and documentation links resolve in the two-project workspace.

The final full browser suite passes **138/138 tests with one worker** (3.9 minutes). The first run passed 133/138; outdated fixtures/selectors and a mobile loading shift were corrected. Two later parallel runs passed 137/138, with remaining timeout/modal failures passing in isolation. Layout responses now use an explicit gate, and shared tracker hydration is checked on desktop/mobile. Release commands and CI use one worker for a stable baseline.

Clean installation reports six high-severity npm audit entries in the development dependency graph. They remain for a separate reviewed dependency update; automatic major/downgrade fixes were not applied. Browser fixtures and local preview do not establish production deployment, live mail delivery, or performance targets. No new D1 migration is required by this release.

## 2.0.0 — 2026-09-30

Snapshot of the current MDDEX workspace, including:

- Catalog detail pages, mobs, locations, search, and weapon comparison.
- Build tiers, unique effects, summaries, cost display, and permanent sharing links.
- Community builds, verified creator profiles, publishing, editing, and deletion.
- Analytics, server-rendered metadata, sitemap, and branded assets.
- All five D1 migrations and architecture/setup documentation.
- Fresh Mac setup instructions, pinned Node.js 22.22.3, and reproducible npm lockfile.

Local browser data and credentials are excluded from the snapshot. Email delivery requires a separately configured Resend key.

### Snapshot validation

A clean source copy on macOS with Node.js 22.22.3 passed `npm ci`, all five local migrations, type checking, linting, 134 unit tests, and the production build. The initial browser run passed 83/88 tests. Unique-effect tooltip and sharing tests passed when retried with one worker. Mobile Mobs navigation, Build loading layout stability, and fourth-tier summary navigation require follow-up; this snapshot preserves the current implementation.
