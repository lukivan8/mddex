# MDDEX agent instructions

MDDEX is a local-first Minecraft Dungeons 2 build maker. Start with [docs/handoff.md](docs/handoff.md); use [CONTRIBUTING.md](CONTRIBUTING.md) for setup and [docs/architecture.md](docs/architecture.md) for flows. Commands run from the repository root.

## Working boundaries

- Preserve existing user changes. Inspect Git status before editing and keep commits scoped to the requested work. Other agents may be editing the same checkout.
- Build edits, variants, calculations and autosave stay local. User records in `mddex.builds.v3` and tracker storage are not disposable catalog caches. Preserve legacy backups and unknown slug references.
- The compact catalog index must supply builder eligibility without detail requests. Pin index/shards to one release per document; background refresh stages the next snapshot. Keep direct detail HTML complete and in-app detail enrichment lazy.
- Content comes from `cdn.mddex.net`; private Directus/publishing belongs to the separate `mddb-cdn` project. Do not invent missing game rules or treat scraped prose as a combat simulator. Preserve attribution for checked-in resource data.
- Sharing stores a snapshot only on Share; copy short links only after a committed response. Community changes retain email authorization, idempotency and soft deletion. Analytics must not delay edits or include private names, tokens, search text or email.
- `main` is production: pushing it triggers the configured Cloudflare build. Commit, push, remote migrations, email delivery and deployment must stay within the user's request. Existing authorization is sufficient; do not ask again merely because a skill describes a release step.
- Keep credentials in ignored local files/environment or provider secrets. Do not read/print private transfer archives or secret values for onboarding. `VITE_` settings are public and build-time.

## Implementation and verification

- Source owns behavior; generated `src/routeTree.gen.ts` and `src/worker-configuration.d.ts` come from Vite/`npm run cf:types`. Add routes in `src/routes`, not by manually patching the generated tree.
- Add HeroUI component CSS and its internal dependencies to `src/heroui.css` in library import order. Keep route styles scoped and image dimensions stable.
- Run checks appropriate to the change. A release uses typecheck, lint, unit tests, Chromium browser tests and production build. Tests use fixtures; never turn them into production writes or real email sends.
- Browser tests use port 3100 and local D1. Use `CI=true npm run test:e2e -- --workers=1` for a fresh managed test server; report failures and exact reruns rather than hiding them.
- Use Node from `.nvmrc`, `npm ci`, and `npm run setup` for fresh checkouts. No Cloudflare login is needed for ordinary development.

## Repository skills

Skills are checked in under `.agents/skills`; `.claude/skills` points to the same directory. Claude invokes `/mddex-setup`, `/mddex-verify`, `/mddex-release`, `/mddex-catalog-diagnose`, `/mddex-assets`, or `/mddex-analytics`. Other agents can load the corresponding `SKILL.md` directly. These workflows do not expand authorization or create schedules.
