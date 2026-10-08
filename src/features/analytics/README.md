# Analytics

## Cloudflare products

[Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/) provides visits, page views, referrers, browser/device breakdowns, and performance. Its visits metric is not unique people, and [custom events are unsupported](https://developers.cloudflare.com/web-analytics/faq/).

[Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/get-started/) collects our custom product events through a same-origin `/api/analytics` Worker handler and the `PRODUCT_ANALYTICS` binding. The `mddex_events` dataset is created on the first deployed write. No API token is shipped to the browser.

## Visitor and session definitions

- A visitor is a random UUID stored in localStorage, shared across tabs. It identifies a browser on this origin, not a person across devices. No fingerprinting, IP address, search text, item names, loadout names, or collection contents are written to Analytics Engine.
- A session expires after 30 minutes without a tracked action. Navigating or reloading during that interval retains the session. A returning visitor is an existing browser ID starting a subsequent session. New and returning are session labels, so one browser can occur in both segments in a reporting window.
- With storage blocked, identity exists in memory until reload. Clearing storage or using another browser creates a new visitor.
- DNT and Global Privacy Control disable custom tracking. Development is disabled unless `VITE_ANALYTICS_DEBUG=true`. Browser tests enable that flag and use local bindings or intercepted requests.
- Events enter a browser-local IndexedDB outbox (`mddex-analytics-v1`) before upload. It survives reloads, tab closure, and offline use. Capture does not wait for a network request or delay local build persistence. If storage is unavailable, delivery falls back to an in-memory queue for the current page.
- Delivery flushes every 60 seconds, at 50 queued events, on `online`, and on page hide/visibility loss. Each request carries at most 100 individual events and 48 KiB of JSON, below keepalive and Analytics Engine limits. It does not combine, sample, or discard repetitive action types. Empty/offline queues send no requests. Failed uploads retry with exponential backoff up to five minutes, retaining the original event IDs and times. Only a 204 acknowledgment removes the submitted IDs, preserving newer events captured during upload.
- IndexedDB transactions lease batches across tabs for 60 seconds; leases expire after a tab crashes. The local bucket holds at most 5,000 events and expires events after seven days, so extended offline activity cannot grow storage indefinitely. Overflow drops the oldest events. DNT/GPC suppress capture and purge the bucket when the queue next runs.
- Delivery remains best effort: clearing browser storage, storage failures, retention/overflow, blocked requests, and unavailable networks affect measurements. A response lost after server acceptance can cause replay; stable event IDs are stored in `blob8` for replay investigation. Analytics Engine has no atomic deduplication/upsert facility, so standard sampling-adjusted action totals can include rare retry duplicates. Origin checks and payload validation reduce invalid submissions but cannot authenticate human visitors.

## Events

| Area | Events |
| --- | --- |
| Traffic | `session_started`, `page_view` for Build, Catalog, Mobs, and loaded item pages (query/hash changes excluded) |
| Catalog | `catalog_search_used` (once per session), `catalog_category_selected` (allowlisted category or all), `catalog_filter_used` (type or applicability), `catalog_sort_changed` |
| Mobs | `mobs_search_used` (once per session), `mob_kind_selected` (allowlisted kind), `mob_location_selected`, `mob_sort_changed` |
| Build | `build_navigation`, `build_create_attempt`, `build_created`, `build_slot_selected`, `build_equip_attempt`, `build_equipped`, `build_save_failed`, `build_slot_cleared`, `build_switched`, `build_deleted`, `build_summary_viewed`, `build_shared`, `shared_build_opened`, `shared_build_saved` |

Successful build/collection mutations are counted after local persistence succeeds. Opening Build is measured by `page_view` on `/build`. Trying to build means creating a loadout, selecting a slot, or trying to equip; an automatically created first loadout is not treated as user engagement.

## Read reports

Create a Cloudflare API token with **Account Analytics Read** permission for this account and make it available in `CLOUDFLARE_ANALYTICS_API_TOKEN` in your shell. Do not commit it or use a `VITE_` variable for it.

```sh
npm run analytics:report -- 7
npm run analytics:report -- 30
npm run analytics:dashboard -- 7
npm run analytics:dau
```

`analytics:dau` makes one production query and prints yesterday's observed daily active browsers, the change from the previous day, and an inline graph reference. It counts distinct browser IDs with **any tracked activity**, grouped by Almaty calendar day (UTC+5), from the September 28, 2026 release through today. Release day and today are partial. Sampled counts may undercount; missing days are gaps, not zero. It uses the same read-only token or existing Wrangler login as the dashboard command. The graph and daily history are saved in ignored `.analytics-reports/`; preserve that directory for history beyond Cloudflare's three-month retention. Each run refreshes the available recent window. The daily Codex report runs at 09:00 Asia/Almaty and displays the script's compact output without recalculating metrics in the model.

The CLI report shows site and returning browsers, page visits by route, the most viewed item pages, category and mob-kind choices, search/filter use, build attempts, successful shares, and a detailed event table. The dashboard command uses the existing Wrangler login (or the read-only token) and writes a self-contained HTML snapshot to `.analytics-reports/mddex-product-7d.html`. It links to the Cloudflare traffic dashboard filtered to the primary site tag. Regenerate it to refresh the product metrics. Distinct browsers are counted separately from action totals. A browser that performs several build actions appears once in the build-attempt summary. Cloudflare Web Analytics remains the source for referrers, geography, device/browser breakdowns, and Core Web Vitals; the custom report describes in-app behavior.

Analytics Engine [retains data for three months](https://developers.cloudflare.com/analytics/analytics-engine/limits/). Queries use `SUM(_sample_interval)` for event totals, as [Cloudflare recommends](https://developers.cloudflare.com/analytics/analytics-engine/sampling/). Distinct browser counts are exact for received, unsampled rows; when `max_sample_interval > 1`, they may undercount and must not be presented as exact totals. Export reports regularly for longer history.

### Stored schema (v3, compatible with historical v1/v2)

| Field | Meaning |
| --- | --- |
| index1 | Visitor UUID (sampling key) |
| blob1 | Event name |
| blob2 | Visitor UUID |
| blob3 | Session UUID |
| blob4 | Allowlisted pathname (`/collection`, `/build`, `/mobs`, or a canonical catalog item path) |
| blob5 | Session visitor type (`new` or `returning`) |
| blob6 | Schema version (`v3` for batches; legacy single-event requests retain `v2`) |
| blob7 | Allowlisted category/filter label, or empty string |
| blob8 | Stable event UUID (v3 only; preserved on retries) |
| double1 | Event count (1) |
| double2 | Capture time in Unix milliseconds (v3 only; future clock times clamped to receipt time) |
| timestamp | Cloudflare ingestion time |

Reports use `if(blob6 = 'v3', toDateTime(double2 / 1000), timestamp)` for filtering and calendar-day grouping. Offline activity therefore stays on the day it happened, while historical rows remain compatible. Browser-clock accuracy still affects v3 event time, and late delivery can revise earlier daily totals. Each original event keeps its session/visitor identity, canonical path, allowlisted label, millisecond timestamp, and count of one.

### Storage choice

We reviewed the installed TanStack DB `localStorageCollectionOptions` and its mutation/transaction utilities, already used for loadouts and preferences. That adapter stores a collection under one JSON key and synchronizes via storage events; it does not provide an atomic cross-tab claim/delete operation for a delivery outbox. Using it here would require additional coordination and rewrite the bucket on frequent analytics actions. IndexedDB, already used for the catalog, gives transactional append, batch leasing, and deletion of acknowledged IDs without a new dependency or a reactive UI subscription. Analytics remains independent of user-data collections.

## Web Analytics beacon and deployment

The production hostname uses Cloudflare's automatic RUM injection on the original `mddex.net` Web Analytics site (site tag `87114214626c41a9a4c082e1272300e9`, with EU visitors excluded by the account setting). Do not add a manual beacon to the app: a second `mddex.net` site was created for manual installation and already split traffic between two site tags. Cloudflare's beacon tracks SPA navigation; it is separate from product-event storage and identity. The custom dashboard should filter to the original site tag so historical duplicate measurements are not summed.

Search terms, filter query strings, build names, and share tokens are never included in custom events. A detail-page path is sent only after the catalog resolves it to a known item. Event labels are restricted to public category and mob-kind IDs. Navigation to an arbitrary or missing URL does not report a catalog item view.

Deploy through the project's existing release workflow. The Analytics Engine binding is included in `wrangler.jsonc`; regenerate types with `npm run cf:types` after binding changes. Production ingestion and reports require a deployed version and live traffic; local Analytics Engine simulation does not populate the remote dataset.
