---
name: mddex-catalog-diagnose
description: Diagnose MDDEX catalog discovery, caching, detail loading or artwork issues without changing CMS data or user saves.
---

# mddex-catalog-diagnose

Read `docs/architecture.md` content and cache sections. Inspect `catalog.loader.ts`, `catalog.session.ts`, `catalog.db.ts` and the relevant route loader.

Use a fresh test context or inspect without clearing the user's storage. Establish content source, active pinned release, cache state and requested URLs. For a network check read the pointer, its supplied index and at most one affected detail shard initially. Resolve paths from the manifest directory; do not infer directories from version strings or download every shard.

Cold Build should acquire the compact index without shard fanout. Cached session should render without waiting for revalidation. New snapshots stage for a later full load. In-app detail should show core content before uncached enrichment; direct SSR should include full rendered content. Schema/path mismatch or failed persistence must preserve the last valid content and user loadouts.

Run relevant catalog/session/shard tests and inspect HTTP caching/compression/CORS when delivery is suspect. Treat 128-entry memory eviction as insertion order and disposable IndexedDB details as currently unbounded. Do not misdiagnose them as user-data storage.

Return cause, evidence and a scoped fix if requested. Content corrections/publication belong to the separate `mddb-cdn` runbook and require that task's scope; no CMS edits, release uploads, global cache purge or build-save deletion belongs here.
