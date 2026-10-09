# Changelog

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
