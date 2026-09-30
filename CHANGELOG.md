# Changelog

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
