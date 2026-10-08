# MDDEX continuation handoff

## Start here

This repository is the public MDDEX application at `mddex.net`, with source remote `https://github.com/lukivan8/mddex.git`. The 2.1.0 release packages the current local-first builder, public catalog/reference features and engineering handoff. Read [CONTRIBUTING.md](../CONTRIBUTING.md), run `npm ci`, `npm run doctor` and `npm run setup`, then start Vite. No old conversation, personal plugin, cloud credential or private CMS snapshot is needed to develop the app.

Claude reads [CLAUDE.md](../CLAUDE.md), which imports shared [AGENTS.md](../AGENTS.md). Six skills live under `.agents/skills`, with `.claude/skills` pointing there. They cover setup, verification, releases, catalog diagnosis, asset regeneration and analytics reporting. Invoke `/mddex-<action>` in Claude or read the matching skill directly in another agent.

## Product and current capabilities

- `/build` is a local autosaved 12-position workspace with saved loadouts, duplication, up to eight variants, powers, modifier tiers, compatibility/unique-effect rules, summary and cost display. Desktop uses independent picker scrolling; mobile uses its responsive selection flow.
- `/collection` is read-only catalog search/filtering, including random-effect filters. `/mobs`, canonical detail routes and `/compare` expose reference data and relationships.
- `/resources` contains Soul Storm forecast/routes, the melee weapon reference with source snapshot/credits, and item-tracker views with local collection state and sharing/export.
- Sharing uses compressed self-contained snapshots or committed immutable short links. Community publishes independent snapshots behind verified email ownership, with variants, structured descriptions, supported video links and soft deletion.
- Analytics uses a bounded IndexedDB outbox with capture timestamps, cross-tab leases, retries and historical schema-compatible reports. Daily reports use Asia/Almaty calendar days; the schedule is external machine/chat state, not installed by cloning this repo.
- Stale lazy assets after deployment return plain 404s and trigger a browser reload with a 30-second cooldown when sessionStorage is usable. Recovery wiring lives in `src/lib/stale-assets.ts`, router and server entry.

## Data and service boundaries

Ordinary build mutations never upload loadouts. TanStack DB uses `mddex.builds.v3` and separate preferences in localStorage; legacy v1/v2 data remains backup. Resource tracker data is another user store. Catalog definitions are disposable IndexedDB `mddex-catalog-v2` snapshots/details, pinned per document, with background refresh staged for a later full load.

Browsers load `latest.json`, the compact index and selected shards directly from `cdn.mddex.net`. Direct SSR details wait for full rendered content; browser navigation opens core content before enrichment. Keep builder eligibility in the compact index. Hash-based artwork URLs remain stable across data releases.

The Worker dispatches sharing, community, analytics and sitemap before TanStack Start rendering. D1 `mddex-builds` holds identities, links, public posts, email challenges/sessions and profile ownership. Resend sends verification mail. Production runtime secrets and cloud configuration are outside Git. See [architecture.md](architecture.md), [sharing.md](sharing.md), [community-builds.md](community-builds.md) and [analytics documentation](../src/features/analytics/README.md).

The private `mddb-cdn` sibling project owns Directus authoring, evidence/provenance and verified R2 publication. It is not required locally. Do not implement content corrections by changing stable client slugs, reseeding that CMS or republishing without a content task. Its restored private state and owner scope are required for content work.

## Continuation priorities

The architecture document contains an ordered proposed performance plan, not a list of already measured regressions. Begin with a specific user task; do not execute all proposals automatically.

Two concrete remaining opportunities are artwork warming completion deduplication (`warmed` is checked but not populated) and sitemap reuse of the shared server catalog promise (currently it calls `loadCatalog()` directly). Profile before changing whole-catalog normalization/filter rendering or storage architecture. The detail memory map is bounded insertion order, not LRU; persisted detail storage has no eviction budget.

Community lists currently return full snapshots/descriptions, use substring/JSON tag scans and offset pagination, and are `no-store`. Smaller gallery projections, cursor paging or public caching require explicit response/deletion semantics. Keep primary-session authorization freshness and durable success.

Summary stacking is intentionally additive and parses description numbers with timing exceptions. It is not a general combat simulator. Melee timing references are source-backed data; preserve their snapshot, corrections and attribution.

## Release state and verification

Version 2.1.0 is a compatible feature release from 2.0.0. It adds no D1 migration beyond the five existing SQL files; variants use optional saved/snapshot fields and retain old token support. Package metadata and lockfile carry the same version. [CHANGELOG.md](../CHANGELOG.md) records validation; [release.md](release.md) defines the repeatable workflow.

Use `git log -1`, `git status`, `git describe --tags --always` and remote checks to establish the actual state when you resume. The handoff cannot prove a later CI/deployment outcome. Pushing `main` triggers the configured production build. A clone does not contain browser saves, local D1 contents, Resend keys, Cloudflare auth, analytics history, private transfer archives or Codex schedules.

## Practical checks and known limits

Browser tests use fixture catalogs on port 3100. Run them with one worker and `CI=true` to avoid a silently reused server. Unit tests use Node's experimental SQLite API in community tests; its warning is expected on pinned Node. Production preview and direct HTML checks verify runtime behavior that fixtures cannot establish.

The clean install currently reports six high-severity npm audit entries in the development toolchain/dependency graph (`@cloudflare/vite-plugin`, Miniflare, Sharp, `source-map-js`, Undici and Wrangler). Review `npm audit` against the current lockfile before dependency maintenance; its suggested fixes include major/downgrade changes, so do not apply `npm audit fix --force` blindly. Setup and test success do not resolve those advisories.

A fresh load is not guaranteed offline: no service worker supplies the application shell. Catalog caching helps an already loaded app. Analytics delivery is best effort and may replay after a lost acknowledgment. Unsupported/missing saved references remain clearable. A failed local persistence transaction must not be reported as saved.

If a test, build or production request fails, record the exact command and result, preserve user data, isolate the failure and fix within scope. Do not clear all site storage, bypass email verification, recreate cloud resources or force a Git history rewrite to make a check pass.
