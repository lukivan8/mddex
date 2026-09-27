# MDDEX · Collection

A local-first Minecraft Dungeons 2 completion logger built with TanStack Start, React, TypeScript, TanStack Router, TanStack DB, HeroUI v3, and Tailwind CSS v4. The Cloudflare Vite plugin builds the application for Workers. There is no application database, authentication, or collection API.

## Run

Use Node.js 22.12+ (tested with 22.22.3).

```sh
npm ci
npm run dev
```

Open the URL Vite prints (port 3000 by default; it selects another free port when occupied). Browser storage is scoped to the origin, including the port, so use a consistent URL to keep the same collection.

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Browser tests launch an isolated dev server on port 3100 and intercept catalog requests with a small test fixture; they do not repeatedly fetch the rate-limited R2 development origin. The real 64-entry catalog was also visually verified in desktop and mobile browsers.

`npm run build` produces `dist/client` and `dist/server` with a generated Workers configuration. `npm run preview` serves the production output in the Cloudflare runtime locally. Production runs at **https://mddex.net** on the `mddex` Cloudflare Worker. For a manual deployment with your authorized Cloudflare account, run `npm run deploy`.

## Release and deployment

The private source repository is `lukivan8/mddex`; `main` is the production branch. GitHub Actions runs type checking, linting, unit tests, Chromium browser tests, and the production build on pushes and pull requests. To enable automatic deployments, connect this repository to the `mddex` Worker using Cloudflare Workers Builds with build command `npm run ci:build` and deploy command `npx wrangler deploy`. GitHub app authorization is currently awaiting account passkey confirmation. Once connected, Cloudflare manages the build credential within its Git integration; no application runtime secrets or GitHub deployment secrets are needed.

`wrangler.jsonc` declares the custom domain and runtime configuration. Catalog configuration is a public build-time setting; collection data never reaches the Worker. Local development and production have separate browser storage because they use different origins.

## Content configuration

The supplied public development content origin works without configuration. Copy `.env.example` to `.env.local` to change it:

```dotenv
VITE_CONTENT_BASE_URL=https://content.example.com
```

The base URL is the **public content root containing `latest.json`**, not a release directory. Each catalog load revalidates `latest.json`, validates its `{ catalogVersion, manifest }` pointer, and resolves `catalog.json` alongside the referenced manifest. Relative artwork paths resolve against that same release directory. The manifest path is authoritative; the loader does not construct paths from the version string or fetch the manifest's unused file inventory. Release assets retain normal CDN caching.

Use an R2 custom domain with browser CORS access for production; the supplied `r2.dev` URL is rate limited. Vite variables are public and resolved at build time. Rebuild after changing the content origin; publishing a new release requires no application rebuild. The former `VITE_CATALOG_URL` override has been removed so all loads discover the current release.

`features/catalog` owns release discovery, validation, image URL resolution, display labels, and the search index. It fetches directly from the browser to the content CDN, with no Start-server proxy. `loadCatalog()` keeps discovery separate from UI and completion data. Discovery/catalog failures use the existing retry state without changing local progress.

## Local completion

TanStack DB's `localStorageCollectionOptions` persists normalized `{ itemSlug, owned, discovered }` records under **`mddex.collection.v2`** in browser localStorage. It supplies reactive queries, optimistic mutations, rollback on write failure, and storage-event synchronization between tabs. No full catalog records are copied into user data. `owned` remains the collection flag; `discovered` is permanent when ownership is unchecked. The validated v1 → v2 migration marks existing owned items discovered, preserves unknown slugs, and retains `mddb.collection.v1` untouched as a backup. The rename also migrates the previous `mddb.collection.v2` and `mddb.preferences.v1` keys without removing their backups. Reload older open tabs after upgrading so all tabs use the new keys.

The small `collection.db.ts` / `collection.service.ts` boundary owns persistence and writes. UI components never read or write localStorage directly. A future asynchronous synchronization/identity-claiming layer can attach here without coupling catalog data or UI components to authentication.

Progress selectors count only slugs present in the current catalog. Removed/unknown slugs remain stored so a temporary content change does not erase ownership. Unreadable saved data is preserved and blocks writes instead of being replaced silently. Failed writes are rolled back and reported inline.

Clearing browser site data deletes the collection. There is deliberately no cloud backup, cross-device synchronization, export UI, or account recovery in this slice. Cross-tab sync supports ordinary edits, but does not provide a conflict-free guarantee for simultaneous writes from separate tabs.

## Interaction and accessibility

- `/` redirects to `/collection`.
- Search, category, type, status, and sorting use typed Router search parameters. Ownership never enters the URL.
- Search matches all query words against normalized name, slug, category, and type. It makes no semantic guesses.
- `/` or Cmd/Ctrl+K focuses search. HeroUI supplies the search field, clear button, selects, status controls, checkboxes, progress bars, chips, buttons, and skeletons.
- Revealed item cards toggle ownership; keyboard users can focus a checkbox and press Space. Hidden cards explain how discovery works.
- Item components are memoized; toggling a record preserves the other cards. Default order stays stable. Status-filtered removal has a short transition, with reduced-motion support.
- Category progress cards also filter the catalog; on mobile they form a horizontal swipeable strip.
- Missing/broken artwork uses the same-size placeholder. Catalog failures offer retry without clearing local state.

## Spoiler-free discovery

New collections hide names and artwork by default. Cards still show category/type and the full catalog contributes to progress. Type filter options include totals. `collection.presentation.ts` creates safe view models before cards render: hidden names are exactly `?????`, artwork is null, and hidden search/sort use only public metadata and stable catalog order. Canonical slugs are internal keys, never DOM attributes.

Entering an exact, unambiguous full name in search reveals and collects that item, regardless of active filters. Case, surrounding/repeated whitespace, punctuation, and apostrophe variants are normalized without fuzzy matching. Partial names do not discover items. Already discovered items are never automatically recollected. Discovery is triggered by editing search, not by opening someone else’s bookmarked query.

The header’s **Show all items** control requires confirmation before revealing the full catalog. Its preference is separately persisted by TanStack DB under `mddex.preferences.v1`. Changing it never mutates collection records. Turning it off hides items that were merely viewed; collecting an item while show-all is enabled also marks it discovered. Success and error feedback use HeroUI toasts, and the discovery explanation and spoiler confirmation use HeroUI modals.

Focused tests cover masking, hidden search/sort, exact and ambiguous discovery, persistence, legacy migration, preference isolation, filtered discovery, and absence of hidden names/artwork in rendered card markup. Background preloading is allowed to request undiscovered artwork; it never reveals cards or changes discovery state.

Artwork is warmed in the browser cache after the catalog renders, starting during an idle period (with a short fallback). The queue uses three low-priority image requests at a time, skips null/duplicate URLs, moves past failures/timeouts, and stops on unmount. Images are never appended to the DOM. This intentionally downloads hidden artwork for faster discovery; spoiler protection covers presentation, not DevTools/network inspection. Requests use ordinary browser/CDN caching, with no extra localStorage copies. The first discovery can still wait for an image that has not finished preloading.

## Scope and limitations

Once the catalog is loaded, browsing and collection writes require no network. A fresh page load still needs the app and catalog to be reachable; this slice does not install a service worker or provide a fully offline launch. Artwork availability and catalog correctness depend on the published content. No builds, guides, social features, accounts, CMS, or server persistence are implemented.
