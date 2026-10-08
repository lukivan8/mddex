# MDDEX release workflow

## Scope and version

The npm package is private; versioning identifies application snapshots, not an npm publication. `main` is the configured production branch at `lukivan8/mddex`. A push to it starts Cloudflare Workers Builds. GitHub Actions independently validates the source including browser tests.

Inspect `git status`, branch, remote and the current diff. Preserve unrelated work. For an explicitly authorized full-workspace release, include reviewed existing changes; otherwise stage only the requested files. Fetch the remote before selecting the base. Do not force-push or silently reset work to resolve divergence.

Choose patch for compatible fixes/docs, minor for compatible features, major for intentionally incompatible persisted/link/API contracts. Keep `package.json`, root/package entries in `package-lock.json`, README release setup and `CHANGELOG.md` consistent. Prefer `npm version <version> --no-git-tag-version` so the release commit includes all reviewed files. Do not use `npm publish`.

## Validate before committing

```sh
npm run doctor
npm run check
CI=true npm run test:e2e -- --workers=1
npm run build
git diff --check
```

After a dependency/setup change, verify a clean copy with `npm ci` and `npm run setup`. After runtime changes, use `npm run preview -- --port 3200 --strictPort` and inspect representative HTML/assets/API errors. For catalog/SEO changes include direct detail HTML; status 200 alone is insufficient. For mutations use fixtures/local D1, not live posts or email.

Record exact totals, failures, fixes and reruns in release notes. Retry a failed test once in isolation to establish whether it is contention or a product defect; persistent failures block a clean release claim. Do not weaken assertions merely to make a release green. Remote CI is separate evidence.

If there are new migrations, review their ordering and apply them through `npm run db:migrate:remote` within an authorized production release **before** deploying dependent code. Local setup never proves remote migration. No new migration is required merely because build variants add optional JSON fields.

## Commit and publish

Review staged filenames and diff for secrets, private state, accidental generated output and unrelated changes. Use explicit path staging or an audited path list; never force-add ignored credentials/backups. Generated route source output can be committed; `dist`, `.wrangler`, test results and analytics reports stay ignored.

Commit the complete release with a descriptive message. Create an annotated `v<version>` tag at that commit for an authorized versioned release; never move an existing published tag. Push the selected branch and that tag by exact name. When the user authorized a main release, no second permission request is needed. Otherwise preparation stops before an unrequested production push.

On a failed push, inspect divergence/authentication and preserve the commit. Do not retry blindly or force. On successful push, record the commit SHA and remote branch/tag. Check GitHub Actions and Cloudflare build/deployment status when accessible. A Git push is not deployment success. A successful CI run is not proof of a Cloudflare deployment either.

## Production checks and recovery

Check `/build`, `/collection`, one canonical detail, a resource page and a missing `/assets/*.js` response without creating public records. Expect complete direct item HTML and a plain-text 404 for missing assets. Check the Cloudflare dashboard/build logs for the exact source commit. Verify community/sharing through existing read-only data or a separately authorized write test.

Stale lazy imports recover with a rate-limited page reload; avoid claiming old assets are retained. If a release fails, retain logs and the tag, then use a reviewed fix or an authorized rollback in the existing Cloudflare workflow. Database rollback is separate: never drop user tables or reverse data migrations casually. There is no automatic catalog publication in this application release.
