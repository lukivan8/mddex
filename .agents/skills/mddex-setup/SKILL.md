---
name: mddex-setup
description: Set up or diagnose a fresh MDDEX development checkout using pinned Node, local D1 and fixture browser tests.
---

# mddex-setup

Read `CONTRIBUTING.md`. Work from the repo root, record Node/npm versions and inspect Git state.

1. Activate `.nvmrc` Node; install locked dependencies with `npm ci`. Do not upgrade packages or use a production credential to solve local setup.
2. Run `npm run doctor`. Missing Chromium is resolved with `npx playwright install chromium`; Linux may need `--with-deps`. If symlinks are unsupported, load canonical `.agents/skills` directly and explain that discovery limitation.
3. Run `npm run setup` to apply local D1 migrations. Never substitute `db:migrate:remote`.
4. Start `npm run dev` on a consistent available origin. If 3000 conflicts with the private editor, pass `-- --port <chosen-port>`. Do not kill another engineer's process.
5. Verify Build shell and local workspace load. Use a separate browser context for mutation checks so existing user loadouts are preserved.

Stop dependency/setup retries after a second identical failure and report the failed command plus remediation; continue independent diagnosis. Completion means a usable local app, not a production deployment. No real email, CMS restore, remote migration or schedule is part of this skill.
