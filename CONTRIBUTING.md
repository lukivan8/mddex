# Working on MDDEX

## Start from a fresh checkout

Install Git, Node.js 22.22.3 (see `.nvmrc`), and npm. On macOS, install Apple's command-line tools if Git/native packages require them. nvm is optional; Windows/Linux can use another Node manager. Access to the private GitHub repository is required.

```sh
git clone https://github.com/lukivan8/mddex.git
cd mddex
nvm install
nvm use
npm ci
npx playwright install chromium
npm run doctor
npm run setup
npm run dev
```

Without nvm, install the pinned Node version directly and skip its two commands. On Linux, browser dependencies may require `npx playwright install --with-deps chromium`. Vite normally uses http://localhost:3000. Keep its origin/port stable because local saves belong to that origin. The private content editor also defaults to 3000; select another application port when both run.

`npm run doctor` checks Node, dependencies, version agreement, workspace files and Chromium without modifying anything or reading secret values. `npm run setup` applies all local D1 migrations; it is repeatable. Missing remote credentials do not block local development. Fresh clones do not contain local browser saves or production data.

## Configuration

The public CDN works without an env file. Copy `.env.example` to `.env.local` only for a public content-source override or local analytics debug. `VITE_CONTENT_BASE_URL` is the root containing `latest.json`, not a release directory. It is public, resolved at build time, and requires a rebuild when changed.

Local real email delivery needs a sending-only Resend key in ignored `.dev.vars`. Normal tests mock delivery and require no key. Production secrets, Cloudflare login, GitHub access, private CMS backups and analytics tokens are separate capabilities; request only the capability needed for the task. Never commit them.

## Daily checks

```sh
npm run check
CI=true npm run test:e2e -- --workers=1
npm run build
npm run preview -- --port 3200 --strictPort
```

`check` runs TypeScript, ESLint and Vitest. Playwright starts a local server on 3100 after migrating local D1. `CI=true` prevents silent reuse of an unrelated server; stop your own server on that port before running. Local release checks and CI both use one browser worker to reduce modal/animation contention. CI also runs the workspace doctor after installing Chromium; use its actual result rather than assuming local success means remote success.

For narrow changes, run the relevant unit/browser file first, then the required release checks when preparing a release. The suite covers real local persistence and API contracts using controlled catalog/API fixtures. It does not benchmark the real CDN or send real verification emails.

## Where to work

See [architecture](docs/architecture.md) for the source map. Equipment rules and mutations live in `src/features/builds`; release discovery/cache in `catalog`; dossiers in `catalog-details`; public posting/authorization in `community`; reference tools in `resources`. Create route source files under `src/routes`; Vite regenerates the route tree. Binding changes require `npm run cf:types`.

Keep checked-in source snapshots/credits when changing resource references. Regenerate UI assets using the asset skill rather than replacing logos ad hoc. Catalog content errors belong to the independent publishing project; client changes should not republish its data.

## Agents and releases

Read [AGENTS.md](AGENTS.md) and [the handoff](docs/handoff.md). Claude reads [CLAUDE.md](CLAUDE.md) and discovers repository skills; other agents use `.agents/skills`. The Markdown skills are usable without any proprietary connector. On checkouts without symlink support, load their canonical paths explicitly.

With Claude Code installed, launch `claude` from the repository root and invoke `/mddex-setup` for onboarding or `/mddex-verify` for checks. The entry point and skill directory follow Claude's documented [project memory](https://code.claude.com/docs/en/memory) and [project skill](https://code.claude.com/docs/en/skills) conventions.

Use feature branches for ordinary development (`codex/` is the default for Codex-created branches). Do not push an incomplete change to `main`: that branch is configured to deploy. [The release runbook](docs/release.md) covers versioning, migrations, checks, commits, tags, push and verification.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Node engine warning or SQLite test API unavailable | Activate `.nvmrc` Node, then rerun `npm ci` |
| Missing D1 table | Run `npm run setup` locally; remote migrations are a separate release action |
| Catalog appears unavailable | Check the public source root and run catalog diagnosis; do not clear user saves |
| Catalog storage blocked or full | Memory fallback should work; investigate only disposable catalog stores |
| Saved loadout unreadable | Preserve the original key and legacy backups; repair/import a validated copy before enabling edits |
| Browser executable missing | `npx playwright install chromium` (Linux may need `--with-deps`) |
| Port 3100 occupied | Stop the server you own or resolve the port conflict; do not kill arbitrary processes |
| Old tab cannot import a route after deployment | Stale-asset recovery permits one reload per 30 seconds; inspect module responses and storage availability |
| Email unavailable locally | Expected without a Resend key; tests use mocks and publishing must fail closed |
| Analytics report unauthorized | Supply Account Analytics Read token or the supported Wrangler login; never print tokens |

A full sitemap SEO audit crawls every entry. Run it deliberately against a production preview using `python3 scripts/seo-audit.py http://localhost:3200 --report /tmp/mddex-seo.json`; do not use it as the default smoke test.
