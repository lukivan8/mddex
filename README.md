# MDDEX · Builds

A local-first Minecraft Dungeons 2 build maker and equipment catalog built with TanStack Start, React, TypeScript, TanStack Router, TanStack DB, HeroUI v3, and Tailwind CSS v4. The Cloudflare Vite plugin builds the application for Workers. Anonymous identity and permanent build-link resolution use Cloudflare D1. Build editing and collection tracking remain local.

## Fresh Mac setup · version 2.0.0

Install Apple's command line tools (`xcode-select --install`) and Node.js 22.22.3. If you use nvm, the checked-in `.nvmrc` selects the tested version. Authenticate GitHub with an account that can access the private repository, then:

```sh
git clone https://github.com/lukivan8/mddex.git
cd mddex
nvm install # if using nvm; otherwise install Node.js 22.22.3 directly
nvm use     # if using nvm
npm ci
npm run setup
npm run dev
```

`setup` applies all checked-in D1 migrations to the local Cloudflare database. Run it again after pulling new migrations; it is safe to repeat. Local development uses simulated Cloudflare bindings and requires no Cloudflare login or production credentials. The default public catalog works without an environment file. Optional overrides are documented in `.env.example`.

To resume this exact snapshot, use `git checkout -b work-from-v2 v2.0.0` after cloning. To continue the latest work, stay on `main` and pull updates. Dependencies, migrations, source, and generated brand assets are checked in; `npm ci` restores dependencies from the lockfile. Build output, local databases, credentials, and browser storage are intentionally excluded. Local loadouts stay in the original browser and do not transfer through Git.

Email verification needs your own Resend key in ignored `.dev.vars`; see [community setup](docs/community-builds.md). Production deployment and analytics reporting require your authorized Cloudflare account. Never commit `.env.local`, `.dev.vars`, or API tokens.

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

The private source repository is `lukivan8/mddex`; `main` is the production branch. GitHub Actions runs type checking, linting, unit tests, Chromium browser tests, and the production build on pushes and pull requests. Cloudflare Workers Builds automatically deploys pushes to `main` to the `mddex` Worker. The build command `npm run ci:build` runs type checking, linting, unit tests, and the production build before `npx wrangler deploy` can run. GitHub Actions independently runs the full suite including browser tests. Cloudflare manages the approved build token within its Git integration; no application runtime secrets or GitHub deployment secrets are needed. Preview deployments are disabled.

`wrangler.jsonc` declares the custom domain and runtime configuration. Catalog configuration is a public build-time setting; collection data never reaches the Worker. Local development and production have separate browser storage because they use different origins.

## Content configuration

The supplied public development content origin works without configuration. Copy `.env.example` to `.env.local` to change it:

```dotenv
VITE_CONTENT_BASE_URL=https://cdn.mddex.net
```

The base URL is the **public content root containing `latest.json`**, not a release directory. Each browser session pins one validated release. IndexedDB persists catalog snapshots in `mddex-catalog-v1`, keyed by content source, with the release version, resolved release directory and index URL. A saved snapshot renders immediately while `latest.json` revalidates in the background; a complete new snapshot is staged for the next full page load. Failed refreshes leave cached browsing available. Cold sessions fetch the optional `catalogIndex` pointer, falling back to `catalog.json` for older publishers. Selected detail shards use IndexedDB and a bounded in-memory request cache. Server isolates share index requests for 60 seconds and retain up to 128 immutable detail requests. Router links preserve in-memory data, filters and return paths, and preload destinations on intent. Relative artwork paths resolve against the release directory; absolute or root-relative image URLs also support shared CDN artwork. User loadouts remain in their existing storage.

The manifest path is authoritative; the loader does not construct paths from the version string or fetch the manifest's unused file inventory. Release assets retain normal CDN caching.

In-app item navigation reads full details from memory or IndexedDB first. Uncached items open from the pinned catalog index while their detail shard loads in the background, with a skeleton for additional details. Stored details are promoted to memory and work when the content network is unavailable. Failed shard requests keep the item usable and offer retry. Direct server-rendered arrivals retain complete item content and metadata.

The default content origin is `https://cdn.mddex.net`, with browser CORS and compressed JSON. Content-hashed artwork URLs are shared across releases and retain browser caching; the client does not append release versions or cache-busting query parameters. Vite variables are public and resolved at build time. Rebuild after changing the content origin; publishing a new release requires no application rebuild. The former `VITE_CATALOG_URL` override has been removed so all loads discover the current release.

`features/catalog` owns release discovery, validation, image URL resolution, display labels, and the search index. It fetches directly from the browser to the content CDN, with no Start-server proxy. `loadCatalog()` keeps discovery separate from UI and build data. Discovery/catalog failures use the existing retry state without changing saved builds or the last valid cached release. Corrupt disposable catalog cache data is refetched; blocked/full storage falls back to the in-memory session. The catalog cache contains externally owned definitions, separate from mutable user data. Artwork remains separately cached by the browser.

## Catalog

`/collection` is labeled Catalog in navigation. It contains only Melee Weapons, Ranged Weapons, Armor, Artifacts, Talismans, Enchantments, and Gear Effects, in that category order. Other release definitions remain cached for reference; artwork is retained and warmed only for these seven categories and locations. Published `game_data`, including item drop sources and location loot links, remains available for a future drop-location display. Every catalog item name and artwork is visible, with search, a top category filter bar, category/type dropdowns, enchantment applicability, and name/category sorting. The catalog is read-only; it does not track item ownership or load legacy collection records.

`/` redirects to `/build`, and the brand link opens Build. `/` or Cmd/Ctrl+K focuses catalog search. Missing artwork uses a placeholder and catalog failures offer retry. Artwork warms through a bounded low-priority queue for the first 24 filtered collection results and equipped loadout items, with completed URLs deduplicated per session. Detail hero artwork loads eagerly at high priority.

## Scope and limitations

Once the catalog is loaded, browsing requires no network. Short-link preparation and first-time resolution require the server; self-contained links remain local. A fresh page load still needs the app and catalog to be reachable; this slice does not install a service worker or provide a fully offline launch. Artwork availability and catalog correctness depend on the published content. Community build publishing and email verification use server storage; see [community builds](docs/community-builds.md). The local build editor is described below.

## Local build editor

`/build` is one loadout workspace, linked from the shared app header. Desktop uses a compact 12-slot board and contextual catalog pane; narrow screens use the same picker inside a full-height HeroUI modal sheet. A first empty loadout is created automatically when none exist. Rename inline, create another immediately, or switch/delete through Saved loadouts. Deletion asks for confirmation; deleting the active loadout switches to another, and deleting the last creates an empty replacement. Every composition change autosaves without a Save button.

The Catalog / Summary toggle replaces the catalog visibility control. Summary groups selected effects under Defense, Attack, and Utility, with a separate enchantment group. Equipment flavor descriptions are excluded from the summary. Effect rows show descriptions without names; source equipment text is omitted. Repeated gear effects combine into one description with additive totals from the selected tiers. Effect tier labels are omitted, and numbers are bold amber. Timing conditions remain intact. Enchantments retain separate tier-specific contributions. Effect stacking is treated as additive by design. Selecting a board slot returns to Catalog. Summary appears beside the board on desktop and below it on narrow screens.

Share build sits beside Catalog / Summary and shows Link copied after copying. Encoding and anonymous identity are prepared in advance, but snapshots are stored only when Share is clicked. First-time short-link sharing waits for committed D1 storage; subsequent shares reuse a confirmed URL immediately. Confirmed links use `/build?share=<id>`; failed or offline requests fall back to the existing self-contained `/build#build=1.…` format. Legacy links remain supported. Shared builds open in the normal editable workspace with Save locally replacing Share. Anonymous identity uses a server-issued HttpOnly cookie and a public local ID for future account migration. See [sharing architecture and rollout](docs/sharing.md).

`features/builds` separates schema, local TanStack DB collections, mutation services, selectors, compatibility, and presentation. Each build has an ID, name, creation/update timestamps, and exactly 12 named positions: melee, ranged, head, torso, legs, feet, three artifacts, and three talismans. Equipped records reference canonical `itemSlug` values; gear stores one nullable enchantment slug and up to two nullable gear-effect slugs. No catalog metadata, owned copies, rolls, or stats are persisted.

Inline I / II / III buttons beside each modifier name select or update its tier in one click; clicking the rest of the row selects the highest available equipment tier or deselects an already selected effect. Tier badges appear on the board, and the summary uses the selected tier text. Unique effects retain the published innate tier and text. Tier choices survive reloads and both kinds of sharing links; older builds without tier choices use the highest available tier.

Builds live in browser localStorage under `mddex.builds.v3`; the active loadout lives separately under `mddex.build-preferences.v1`. This has the same origin-local, cross-tab, optimistic-write and rollback behavior as collection storage. Unreadable storage is preserved and editing is blocked. Unknown catalog references remain in their slots as clearable placeholders.

`build.compatibility.ts` centralizes category/type compatibility. The picker offers every compatible catalog item. Neither the catalog nor the builder loads legacy collection storage.

Weapons and armor each have one enchantment slot. Talismans use their published built-in effects at the selected I / II / III level, defaulting to the highest level. Their picker previews talisman values and their effects join the additive summary; normal gear uses only non-talisman tiers. Talisman levels persist in local saves and sharing links. All equipment except talismans always displays three effect slots; artifacts have effects but no enchantment. Unique equipment automatically fills its first effect position with its published innate effect. That effect has an amber border and cannot be removed or replaced; the remaining two effect slots stay editable. Saved and shared builds apply the same rule when opened. Changing equipment replaces or removes the former innate effect while preserving compatible editable effects. Equipment cards keep visible artwork, slot labels, and item names. A compact icon row beneath holds the enchantment and effects, with modifier names in hover/focus tooltips and accessible button labels. Effects have a separate picker with catalog descriptions and attack/defense/utility groups. Published category compatibility is respected; missing metadata remains unknown and effect groups do not imply equipment eligibility. Tier values and innate effects use published metadata; gear-effect bonuses use the additive summary assumption. Replacing equipment retains compatible modifiers and clears incompatible selections with their tiers; clearing it clears all modifiers. Published per-item `rollable_effects.effects` pools and `enchantment_options.enchantments` lists constrain the picker and mutations. Enchantment `slots` also enforces chest-only rules. Missing or unresolved eligibility data falls back to known category/slot metadata. Saved and shared incompatible selections stay clearable and produce a warning instead of being silently erased. Hide warnings collapses that panel into an icon beside the build name with all details available on hover or focus; the local preference survives reloads. Set item power expands a grid of numeric inputs for weapons, armor and artifacts (1–154), with power badges above 1 on equipped artwork and values preserved in saves and sharing links.

Existing `mddex.builds.v1` loadouts migrate to v3 using the first non-empty old enchantment. The entire original v1 data is retained as a backup. Effect selections start empty. Existing v2 saves migrate to v3 with all three effects; the original v2 data remains as a backup. Older shared links retain all three effects when opened. New loadouts and subsequent edits use the new format.

Build sharing and public community builds use the Worker and D1. Local loadouts do not automatically sync across devices. Browser site-data deletion removes local loadouts.

## Analytics

Cloudflare Web Analytics measures traffic and Core Web Vitals. Workers Analytics Engine records page views for Build, Catalog, Mobs, and known item pages, plus search/filter use and build engagement. The read-only report shows popular pages, category choices, distinct browsers, and returning sessions. Collection and loadout contents remain local; only allowlisted analytics events and random visitor/session IDs reach the Worker. See [analytics setup, event definitions, reporting, and limitations](src/features/analytics/README.md).

## Search and social previews

Build and Catalog have server-rendered titles, descriptions, canonical URLs, Open Graph and Twitter metadata, plus a visible Build introduction above the workspace and a usage guide below it. The Build title and H1 target “Minecraft Dungeons 2 Build Maker.” WebSite and WebApplication JSON-LD describe the free tool without invented ratings. Shared query links use `noindex, follow` and canonicalize to `/build`; API responses use `X-Robots-Tag: noindex, nofollow`. Catalog filter URLs canonicalize to `/collection`. `/` permanently redirects to `/build`.

`public/robots.txt` points to `https://mddex.net/sitemap.xml`. The Worker generates that sitemap from the current published catalog, including equipment, mob, location, status, cape, and pet detail pages alongside the main pages. The 1200×630 social preview, favicon, and app icons use the existing MDDEX branding. Regenerate the favicon and app icons with `npm run assets:generate` (requires Playwright Chromium). The social preview is a checked-in image at `public/og-image.png` and is preserved by that script. The manifest describes a normal browser app; it does not promise offline installation. Metadata lives in `src/features/seo/metadata.ts`; update the production origin there and in `public/robots.txt` if the domain changes.

Catalog titles use the full “[item] in Minecraft Dungeons 2” target heading, with disambiguation for mobs and status effects. Detail pages include breadcrumb JSON-LD and a contextual link to the build maker. Status pages retain published gear, mob, and immunity relationships; cosmetic pages retain matching unlock information. Footer acquisition guides use the same resolved drop sources as the item dossier.

The server-rendered equipment, reference, and location directories expose canonical detail links even before the interactive grids load. Keep their links and the Build page's initial HTML renderable in the production Worker; a successful HTTP status alone does not mean the page content rendered.

Run `python3 scripts/seo-audit.py http://localhost:3200 --report /tmp/mddex-seo-local.json` against the production preview, or use `https://mddex.net` to audit production. It checks every sitemap URL for server-rendered titles, target headings, canonical/indexing metadata, schemas, duplicate titles, and incoming HTML links. This audits crawlability and relevance signals; it does not prove rankings.

After publishing, submit `/sitemap.xml` in Google Search Console for the verified domain and inspect a representative detail URL. Discovery and ranking still depend on search engines and external links.

## Additional effects and locations

Item pages show applicable random effects above Where to find it as a wrapping row of linked square icons, with names and effect text on hover or keyboard focus. Acquisition conditions and merchant availability enrich the existing source cards. Unique variant conditions use consistent wording; source cards omit entrance and destination lines. Location pages merge published gear and enchantment-book loot, mob conditions, entrances, subareas, merchants and station information into their existing sections. The compact publisher index must retain `rollable_effects` and `enchantment_options` so the builder does not need detail shards to enforce eligibility.
