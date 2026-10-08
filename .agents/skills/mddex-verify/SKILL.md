---
name: mddex-verify
description: Verify MDDEX changes or a release with scoped unit/browser coverage and the Cloudflare production build.
---

# mddex-verify

Read `CONTRIBUTING.md` and select checks matching the changed behavior. For a release, run the complete sequence:

```sh
npm run doctor
npm run check
CI=true npm run test:e2e -- --workers=1
npm run build
git diff --check
```

Playwright manages local D1/server on 3100 and uses fixtures. Resolve a port conflict without killing unrelated processes. Do not connect mutation tests to production or send email. If a test fails, inspect its saved error context and rerun that test once with one worker; distinguish the initial failure from the rerun and fix reproducible product defects. Do not bypass failed assertions.

After runtime/SSR changes start `npm run preview -- --port 3200 --strictPort`, inspect affected HTML or interact with the relevant flow, then stop only the server you started. Direct detail pages need actual rendered content, not just a successful status. Missing assets should return text/plain 404. A full SEO audit is optional only for an SEO task.

Report exact commands/totals and limitations. Passing fixtures does not establish CDN speed, live mail, CI or production deployment. This skill does not commit or publish.
