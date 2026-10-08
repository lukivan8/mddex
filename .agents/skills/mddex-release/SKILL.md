---
name: mddex-release
description: Prepare a versioned MDDEX release, validate it, and commit or push only the scope authorized by the user.
---

# mddex-release

Read `docs/release.md` and the current changelog. Resolve the requested scope from user authorization; inspect existing changes and remote divergence before staging. Preparation can proceed without publication permission. Existing authorization to release/commit/push is sufficient for the corresponding action; do not ask repeatedly.

Update package/lock versions with `npm version <version> --no-git-tag-version`, README setup version and changelog. Use compatible SemVer; never publish this private package to npm. Run the complete checks in `mddex-verify` by reading its sibling skill, and verify clean bootstrap when setup/dependencies change.

Review staged paths/diff for private files, generated build output and unrelated edits. Commit the reviewed scope. For an authorized versioned release, create annotated `v<version>` at that commit, never moving a published tag. Push the explicit branch/tag only if requested; `main` triggers production. Remote migration is only needed for a new schema and must precede dependent deployment within authorized scope.

After a rejection/failure inspect once, preserve work and report the blocker; do not force-push, silently reset, or blindly repeat. Verify remote commit/tag and accessible CI/deployment status. Report Git publication separately from deployment. Do not run a second manual deploy merely because auto deployment is pending.
