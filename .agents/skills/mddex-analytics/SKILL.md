---
name: mddex-analytics
description: Read MDDEX production analytics or regenerate local reports with the existing reporting scripts and privacy/sampling definitions.
---

# mddex-analytics

Read `src/features/analytics/README.md` and choose the existing report command:

```sh
npm run analytics:report -- 7
npm run analytics:dashboard -- 7
npm run analytics:dau
```

Use an available Account Analytics Read token in `CLOUDFLARE_ANALYTICS_API_TOKEN`, or the supported Wrangler login for dashboard/DAU. Never print credential values, put them under `VITE_`, or commit them. Missing access means a specific access blocker, not permission to query an unrelated account.

Run the selected bounded report once. Report failure with status/message; retry once only for a transient transport failure. Reports are written under ignored `.analytics-reports`; keep its history for retention, and do not stage it.

Use observed browser IDs, not people; event totals adjust sampling but distinct counts may undercount. Use captured v3 event time for Almaty daily reporting, historical ingestion time for older rows, and mark partial/missing days accurately. Retry delivery can duplicate events. Never include loadouts, email, share tokens or free-form search in telemetry.

This is read-only reporting plus local output. Do not modify bindings, send analytics events, add a beacon, publish reports externally or create/update a schedule without that explicit request.
