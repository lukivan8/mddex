# Catalog details schema review

Inspected all 591 records in release `1a08178c2e7671d1` on 2026-09-29. The seven visible categories contain 404 records; locations remain available for drop-source artwork.

## Runtime boundary

The client validates `slug`, `category`, `type`, `variation`, nullable `image`, optional `description`, optional `applicable_categories`, and optional open-ended `game_data`. Category-specific metadata is retained in `game_data`, but nested fields are not structurally validated yet. The raw release additionally has `artwork`, `source_url`, evidence, and provenance; the current loader strips those top-level fields. Resolve related effects and locations through `catalog_slug` and their canonical images. A future production detail view should validate each category section and omit null values rather than invent missing stats.

## Coverage by category

| Category      | Records | Present, nonempty game-data fields (record count)                                                                                                                                                        |
| ------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| armor         |     152 | `archetype` 152, `base` 76, `baseSet` 76, `effects` 76, `element` 28, `pair` 152, `rarities` 152, `set` 152, `slot` 152, `sources` 152, `unique` 152, `uniqueVariant` 76, `weight` 104                   |
| artifact      |      40 | `archetype` 40, `artifact` 40, `element` 18, `rarities` 40, `sources` 40, `unique` 40, `weight` 4                                                                                                        |
| cape          |       7 | `unique` 7                                                                                                                                                                                               |
| enchantment   |      32 | `book` 32, `category` 32, `data_quality` 3, `slots` 32, `summary` 19, `tiers` 32                                                                                                                         |
| gear_effect   |      76 | `carriers` 72, `category` 76, `data_quality` 8, `gear` 59, `tiers` 76                                                                                                                                    |
| location      |      13 | `arena` 7, `level` 10, `loot` 11, `minibosses` 9, `mobs` 10, `subAreas` 10                                                                                                                               |
| melee_weapon  |      58 | `archetype` 58, `base` 29, `data_quality` 2, `effects` 29, `melee` 58, `pair` 58, `rarities` 58, `sources` 58, `unique` 58, `uniqueVariant` 29, `weight` 32                                              |
| mob           |     133 | `affixes` 38, `areas` 83, `attacks` 100, `baseMob` 53, `drops` 3, `fights` 16, `forms` 36, `health` 131, `minions` 12, `mobKind` 133, `poise` 105, `resist` 99, `souls` 101, `speed` 133, `summonedBy` 6 |
| pet           |       3 | `unique` 3                                                                                                                                                                                               |
| ranged_weapon |      22 | `archetype` 20, `base` 11, `effects` 11, `family` 22, `pair` 22, `ranged` 22, `rarities` 22, `sources` 22, `unique` 22, `uniqueVariant` 11, `weight` 22                                                  |
| status        |      31 | `alignment` 31                                                                                                                                                                                           |
| talisman      |      24 | `levels` 24, `sources` 24, `summons` 5, `unique` 24                                                                                                                                                      |

## Nested structures across the full release

### armor

- `base`: `catalog_slug`, `href`, `name`
- `effects[]`: `catalog_slug`, `href`, `icon`, `name`, `text`, `tier`
- `effects[].icon`: `artwork_key`
- `icon`: `artwork_key`
- `pair[]`: `catalog_slug`, `hit`, `href`, `icon`, `kind`, `name`, `slot`, `unique`
- `pair[].icon`: `artwork_key`
- `sources[]`: `catalog_slug`, `href`, `name`, `type`, `via`
- `uniqueVariant`: `catalog_slug`, `href`, `name`

### artifact

- `artifact`: `category`, `cooldown`, `input`, `soul_cost`
- `icon`: `artwork_key`
- `sources[]`: `catalog_slug`, `href`, `name`, `type`, `via`

### cape

- `icon`: `artwork_key`

### enchantment

- `book`: `icon`, `name`, `sources`
- `book.icon`: `artwork_key`
- `book.sources[]`: `href`, `name`, `type`, `via`
- `icon`: `artwork_key`
- `tiers[]`: `cooldown`, `name`, `text`, `tier`

### gear_effect

- `carriers[]`: `catalog_slug`, `href`, `icon`, `kind`, `name`
- `carriers[].icon`: `artwork_key`
- `icon`: `artwork_key`
- `tiers[]`: `source_tier`, `talisman`, `text`, `tier`

### location

- `arena[]`: `catalog_slug`, `href`, `icon`, `name`
- `arena[].icon`: `artwork_key`
- `icon`: `artwork_key`
- `loot[]`: `catalog_slug`, `href`, `icon`, `kind`, `name`
- `loot[].icon`: `artwork_key`
- `minibosses[]`: `catalog_slug`, `href`, `icon`, `name`
- `minibosses[].icon`: `artwork_key`
- `mobs[]`: `catalog_slug`, `href`, `name`, `share`

### melee_weapon

- `base`: `catalog_slug`, `href`, `name`
- `effects[]`: `catalog_slug`, `href`, `icon`, `name`, `text`, `tier`
- `effects[].icon`: `artwork_key`, `source_image_url`, `unavailable`
- `icon`: `artwork_key`
- `melee`: `combo`, `combo_reset`, `jump`
- `melee.combo[]`: `cone`, `cooldown`, `damage`, `damage_type`, `kind`, `knockback`, `range`, `repeat`, `speed`, `splash`, `stagger`, `weight`
- `melee.jump`: `damage`, `range`, `splash`, `stagger`, `weight`
- `pair[]`: `catalog_slug`, `hit`, `href`, `icon`, `kind`, `name`, `slot`, `unique`
- `pair[].icon`: `artwork_key`
- `sources[]`: `catalog_slug`, `href`, `name`, `type`, `via`
- `uniqueVariant`: `catalog_slug`, `href`, `name`

### mob

- `areas[]`: `catalog_slug`, `href`, `icon`, `name`
- `areas[].icon`: `artwork_key`
- `attacks[]`: `attack`, `cooldown`, `damage`, `element`, `splash`
- `baseMob`: `catalog_slug`, `href`, `name`
- `drops[]`: `catalog_slug`, `href`, `icon`, `name`
- `drops[].icon`: `artwork_key`
- `fights[]`: `catalog_slug`, `href`, `kind`, `place`, `quest`, `questId`, `regions`, `step`
- `fights[].regions[]`: `catalog_slug`, `href`, `name`
- `forms[]`: `damage`, `health`, `label`, `poise`, `render`, `resist`, `souls`, `speed`
- `forms[].render`: `artwork_key`
- `forms[].resist[]`: `multiplier`, `type`
- `icon`: `artwork_key`
- `minions[]`: `catalog_slug`, `href`, `icon`, `name`
- `minions[].icon`: `artwork_key`
- `render`: `artwork_key`
- `resist[]`: `multiplier`, `type`
- `summonedBy`: `catalog_slug`, `href`, `name`

### pet

- `icon`: `artwork_key`

### ranged_weapon

- `base`: `catalog_slug`, `href`, `name`
- `effects[]`: `catalog_slug`, `href`, `icon`, `name`, `text`, `tier`
- `effects[].icon`: `artwork_key`
- `icon`: `artwork_key`
- `pair[]`: `catalog_slug`, `hit`, `href`, `icon`, `kind`, `name`, `slot`, `unique`
- `pair[].icon`: `artwork_key`
- `ranged`: `ammo`, `charge_damage`, `charge_required`, `charge_time`, `damage_factor`, `fire_rate`, `projectiles`, `range`, `reload`, `volleys`
- `ranged.projectiles[]`: `count`, `damage`, `pierce`, `speed`, `spread`, `stagger`
- `sources[]`: `catalog_slug`, `href`, `name`, `type`, `via`
- `uniqueVariant`: `catalog_slug`, `href`, `name`

### status

- `icon`: `artwork_key`

### talisman

- `icon`: `artwork_key`
- `levels[]`: `effects`, `icon`, `level`, `xp`
- `levels[].effects[]`: `catalog_slug`, `href`, `name`, `text`
- `levels[].icon`: `artwork_key`
- `sources[]`: `catalog_slug`, `href`, `name`, `type`, `via`
- `summons`: `catalog_slug`, `href`, `icon`, `name`
- `summons.icon`: `artwork_key`

## Example: The Prospector's Pick

Uses real published data: Support archetype, unique rarity, Prospector at 20%, three combo hits (16, 16, 24 damage), jump attack (28 damage), combo reset 1.15, a Pickaxe base variant, four area sources via Pickaxe, and one quest reward. Range, splash, speed, reset, and knockback are shown as raw source values; no unsupported unit conversions, drop probabilities, DPS, power scaling, or acquisition requirements are fabricated. The quest source has no location image.

## Five layout options

1. **Split dossier** — persistent identity and unique effect on the left; combat and sources on the right. Best all-around desktop detail page; everything is immediately visible.
2. **Tabbed page** — compact overview with Combat, Drops, and Family tabs. A dedicated page with a compact tabbed layout; secondary data takes a tab click.
3. **Catalog inspector** — keep nearby item cards visible beside a scrollable inspector. Best browsing multiple items; narrower space for combat tables.
4. **Accordion page** — essential identity and unique effect first, expandable category sections below. Best small screens and long mixed-category metadata; more sections need opening.
5. **Combat workbench** — selectable attacks and per-hit stats first, with drops and related gear below. Best detailed weapon comparison; too specialized as the universal default.

Recommendation: option 1 for a dedicated desktop detail page, or option 3 if preserving catalog context is more important; use option 4 on mobile. Shared category sections can render melee combos, ranged projectiles, armor identity/set, artifact cooldown/soul cost/summons, talisman level/XP effects, enchantment applicability/tiers, effect gear/talisman tiers/carriers, and location loot/encounters without changing the surrounding layout.

## Run the preview

From repository root: `npx vite --config docs/catalog-details-layouts/vite.config.ts --port 3101`. Open http://localhost:3101. This is an isolated prototype, outside production routes. All controls use the installed HeroUI package; the snapshot avoids live catalog changes during comparison.

## Standalone pages and SEO

Each option is now a full page with its own URL (no comparison stage, embedded modal, or drawer):

- `/catalog/melee-weapons/the-prospectors-pick` — split dossier
- `/catalog/melee-weapons/the-prospectors-pick/tabbed` — tabbed page
- `/catalog/melee-weapons/the-prospectors-pick/inspector` — catalog inspector
- `/catalog/melee-weapons/the-prospectors-pick/accordion` — accordion page
- `/catalog/melee-weapons/the-prospectors-pick/combat` — combat workbench

The old `/?option=…` links redirect to the matching page. Unknown catalog URLs return 404 in development. The production prototype build emits one HTML document per route, ready for static hosting with directory-index routing; it does not add these routes to the deployed application.

All five share an intended canonical item URL: `https://mddex.net/catalog/melee-weapons/the-prospectors-pick`. Once a layout is chosen for production, publish one canonical item page and keep design alternatives out of the production sitemap. The canonical URL is a planned production route, not a claim that it is already live.

The server-rendered initial HTML contains the weapon heading, Minecraft Dungeons 2 / MCD2 context, emerald effect, combo and jump damage, and drop locations. Inactive detail tabs remain mounted in the HTML. Search wording includes “Prospector Pick” and “Prospector Pickaxe” naturally as search aliases; the catalog name remains “The Prospector’s Pick”. Every page has a title, meta description, canonical link, Open Graph/Twitter metadata, and WebPage/Thing JSON-LD. This is descriptive item schema, without fabricated prices, reviews, ratings, or unsupported rich-result promises.

This follows Google Search Central guidance on [pre-rendered content](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) and [consolidating duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls). These changes prepare the pages for indexing; local prototypes cannot rank until published and crawled.

Verify with `node docs/catalog-details-layouts/verify.mjs`; it checks all five desktop/mobile layouts, interactions, navigation, initial content without JavaScript, metadata, structured data, redirects, missing routes, and overflow.

## Selected direction: simplified split dossier

Split dossier is the selected base. The identity area now has the weapon category/name and a styled flavor blockquote. It omits the archetype badge, rarity badge, repeated game subtitle and repeated base-weapon label. Related equipment shows the base name and image only. Drop cards show location names and artwork, with no repeated “via Pickaxe” labels, empty quest row, or explanatory source note. Source buttons are removed pending future Minecraft Wiki links. The normal Build/Catalog header styling and shared production AppFooter replace the layout chooser and prototype footer. Alternative URLs remain available for comparison.

Back to catalog preserves the entire URL query using an explicit `returnTo` value, a catalog referrer, or the last catalog URL stored in the current tab. For example, an eventual catalog card can link to `.../the-prospectors-pick?returnTo=` plus `encodeURIComponent(location.href)`. Reloading or moving between detail pages retains the return URL. Direct arrivals default to the catalog. Only `/collection` URLs on this origin or `https://mddex.net` are accepted. This prototype prepares the return behavior; production catalog cards have not yet been wired to these isolated pages.

## Linked item pages and mob sources

The weapon heading now sits above the dossier columns at full page width. Related equipment uses keyboard-accessible item cards linked to catalog detail URLs, including a working Pickaxe page and reciprocal unique-variant link. Unique effects and location cards also link to their catalog entries.

`item-links.json` contains a compact snapshot of the same published release for linked pages and source resolution. The source list combines explicit area/mob entries with reverse links from mob `drops`, then deduplicates by catalog slug. It never infers a drop from a location’s resident mobs. Witch Brew demonstrates a Witch mob source alongside its locations; the Witch page links back to Witch Brew in its drops. The Prospector’s Pick has four location entries and no mob entry. Mob sources use published mob artwork, with a generic icon when artwork is unavailable.

Linked detail pages have server-rendered names, descriptions, source cards, related equipment, and melee attack data where present. Other category-specific sections can use the full catalog schema when these prototypes are integrated into the application.

## Automatic item SEO

`item-seo.ts` generates the lower page guide, page title, meta description, canonical URL, and structured-data introduction from each item’s name, category, and available published data. All linked pages now include the guide; there is no hand-written Prospector-only section. Category-specific sections cover effects, explicit area/mob drops, melee or ranged stats, artifact cooldown/soul cost, armor slot/set, talisman levels, enchantment/effect tiers, related gear, mob drops/health, and location loot/encounters when those fields exist. Missing fields create no speculative sections. Numerical facts in guide answers retain the bold yellow styling.

Metadata descriptions are kept within 160 characters. Generic structured data uses an item identity instead of calling every entity a weapon. The source snapshot now retains the fields needed by the generator. Verification checks representative categories without JavaScript and generated guide HTML for all 591 catalog records, in addition to desktop/mobile interactions.

## Application integration

The selected dossier now runs in the application at `/catalog/$category/$slug`, using the live catalog release. All melee and ranged catalog cards link to their canonical game-data slug and pass the current catalog URL in `returnTo`. Related equipment, effects, locations, and explicit mob sources preserve that return URL across linked pages. The detail loader sends only the selected item and referenced definitions to the page. Both the prototype and application share the path, source-resolution, and SEO generator modules under `src/features/catalog-details`.

## All equipment categories and mobs

All 404 visible equipment catalog cards now open the shared detail route. Category sections render armor slot/set, artifact cooldown/soul cost/summons, talisman levels/XP/effects, enchantment compatibility/tiers, and separate gear/talisman effect tiers and carrier cards. The same route renders location loot and mob/miniboss/arena links, plus mob health/speed/poise/souls, attacks, damage multipliers, forms, locations, encounters, minions, and explicit drops where available.

A separate `/mobs` browser lists the 133 published mob records with searchable, linked cards and a Mobs header tab. Its query is preserved when returning from detail pages. The seven equipment categories remain in their established order. Mob entries use published artwork; equipment, locations, and mobs retain their image URLs. A generic mob icon is reserved for entries without artwork. Equipment, mobs, and locations share data-generated SEO and linked references; encounter membership is never interpreted as an item drop relation.
