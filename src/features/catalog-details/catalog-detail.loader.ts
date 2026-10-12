import {
  applicableEffects,
  locationMetadata,
} from "./catalog-detail.enrichment";
import { notFound } from "@tanstack/react-router";
import {
  loadSessionCatalog,
  loadSessionCatalogDetail,
  readSessionCatalogDetail,
} from "../catalog/catalog.session";
import type { CatalogItem as PublishedItem } from "../catalog/catalog.types";
import { resolveSourceArtwork, sourceArtworkLocation } from "./source-artwork";
import { isSecretTalisman } from "../catalog/catalog.helpers";
import {
  dropSources,
  itemPath,
  type CatalogCard,
  type CatalogItem,
} from "./catalog-detail.model";
const unusedDetailFields = new Set([
  "reference_context",
  "map_context",
  "gear_rules",
  "wikily_cards",
  "enchantment_options",
  "spawn_conditions",
  "drop_conditions",
  "soul_enchantment_rules",
  "quest_graph",
  "drop_chance_context",
]);
function pickFields(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => keys.includes(key)),
  );
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function statusReferences(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((value) => {
    const entry = record(value);
    const name = typeof entry.name === "string" ? entry.name : entry.title;
    return typeof name === "string" && name.trim()
      ? [
          {
            name,
            ...(typeof entry.catalog_slug === "string"
              ? { catalog_slug: entry.catalog_slug }
              : {}),
          },
        ]
      : [];
  });
}
// Keep the SSR and router payload limited to information the detail page renders.
function detailGameData(item: PublishedItem) {
  const data = Object.fromEntries(
    Object.entries(item.game_data ?? {}).filter(
      ([key]) => !unusedDetailFields.has(key),
    ),
  );
  if (data.drop_chances) {
    data.drop_chances = pickFields(data.drop_chances, [
      "schema_version",
      "item_catalog_slug",
      "variant",
      "sources",
      "source_conflicts",
    ]);
  }
  if (item.category === "status") {
    const wiki = record(item.game_data?.wikily);
    const alignment = data.alignment ?? wiki.alignment;
    data.status = {
      ...(typeof alignment === "string" ? { alignment } : {}),
      gear: statusReferences(wiki.gear),
      mobs: statusReferences(wiki.mobs),
      immune: statusReferences(wiki.immune),
    };
  }
  if (isSecretTalisman(item)) {
    const wiki = record(item.game_data?.wikily);
    const pages = record(item.game_data?.reference_context).pages;
    const secretPage = Array.isArray(pages)
      ? pages.map(record).find((page) => page.kind === "secret-talismans")
      : undefined;
    const cards = secretPage?.cards;
    const card = Array.isArray(cards)
      ? cards.map(record).find((card) => card.name === item.variation)
      : undefined;
    const location =
      card?.text ?? record(data.acquisition).source_text ?? wiki.where;
    data.talismanAcquisition = {
      secret: true,
      ...(typeof location === "string" && location.trim()
        ? { location: location.trim() }
        : {}),
    };
  }
  if (item.category === "cape" || item.category === "pet") {
    const pages = record(item.game_data?.reference_context).pages;
    if (Array.isArray(pages)) {
      const cards = pages.flatMap((page) => {
        const cards = record(page).cards;
        return Array.isArray(cards) ? cards : [];
      });
      const card = cards
        .map(record)
        .find(
          (card) =>
            card.name === item.variation && typeof card.text === "string",
        );
      if (card && typeof card.text === "string") {
        const unlock = card.text.replace(item.description ?? "", "").trim();
        if (unlock) data.cosmeticUnlock = unlock;
      }
    }
  }
  if (item.category === "location") {
    data.wikily = pickFields(data.wikily, [
      "lead",
      "region",
      "nDungeon",
      "nRift",
      "nStations",
      "gear",
      "books",
      "mobs",
      "bosses",
      "entries",
      "places",
      "merchants",
      "stations",
    ]);
    data.location_context = pickFields(data.location_context, [
      "source_details",
      "instances",
    ]);
    if (data.location_context && typeof data.location_context === "object") {
      const context = data.location_context as Record<string, unknown>;
      if (Array.isArray(context.instances))
        context.instances = context.instances.map((instance) =>
          pickFields(instance, ["name", "lead", "levels", "icon"]),
        );
    }
  } else {
    delete data.wikily;
    delete data.location_context;
  }
  if (Array.isArray(data.quest_context))
    data.quest_context = data.quest_context.map((quest) =>
      pickFields(quest, ["source_key", "name", "rewards"]),
    );
  return data;
}
export function normalizeDetailItem(item: PublishedItem): CatalogItem {
  const data = detailGameData(item);
  const book = data.book as { sources?: unknown } | null | undefined;
  return {
    slug: item.slug,
    category: item.category,
    type: item.type,
    name: item.variation,
    image: item.image,
    ...(item.artwork
      ? {
          artwork: Object.fromEntries(
            Object.entries(item.artwork).filter(
              ([key]) =>
                key.startsWith("references.") ||
                (item.category === "location" && key.startsWith("instances.")),
            ),
          ),
        }
      : {}),
    description: item.description ?? null,
    game_data: {
      ...data,
      sources: [
        ...(Array.isArray(data.sources) ? data.sources : []),
        ...(Array.isArray(book?.sources) ? book.sources : []),
      ],
      drops: Array.isArray(data.drops) ? data.drops : [],
      base: data.base ?? null,
      uniqueVariant: data.uniqueVariant ?? null,
      melee: data.melee ?? null,
    } as CatalogItem["game_data"],
  };
}

export function projectDetailCard(item: CatalogItem): CatalogCard {
  const data = item.game_data;
  return {
    slug: item.slug,
    category: item.category,
    type: item.type,
    name: item.name,
    image: item.image,
    description: item.description,
    game_data: {
      slug: data.slug,
      set: data.set,
      slot: data.slot,
      tiers:
        data.tiers?.map(({ tier, text, talisman }) => ({
          tier,
          text,
          talisman,
        })) ?? data.tiers,
      drops:
        item.category === "mob"
          ? data.drops.map(({ catalog_slug }) => ({ catalog_slug }))
          : [],
    },
  };
}

type PreparedDetailCatalog = {
  readonly catalog: readonly CatalogItem[];
  readonly cards: readonly CatalogCard[];
  readonly positions: ReadonlyMap<string, number>;
};
// Session catalogs are immutable snapshots: a new release (or refreshed server
// snapshot) has a new array identity, including its release-scoped shard URLs.
// Weak keys retain only snapshots still held by a session/in-flight request.
const preparedCatalogs = new WeakMap<PublishedItem[], PreparedDetailCatalog>();
export function prepareDetailCatalog(
  published: PublishedItem[],
): PreparedDetailCatalog {
  const saved = preparedCatalogs.get(published);
  if (saved) return saved;
  const catalog = published.map(normalizeDetailItem);
  const positions = new Map<string, number>();
  catalog.forEach((item, position) => {
    const path = itemPath(item);
    // Preserve findIndex's first match if a publisher supplies duplicate paths.
    if (!positions.has(path)) positions.set(path, position);
  });
  const prepared = {
    catalog,
    cards: catalog.map(projectDetailCard),
    positions,
  };
  preparedCatalogs.set(published, prepared);
  return prepared;
}
export async function loadDetailPage(category: string, slug: string) {
  const published = await loadSessionCatalog();
  const position = detailPosition(published, category, slug);
  const detail = await loadSessionCatalogDetail(published[position]);
  return enrichedDetailPageData(published, position, detail);
}

async function enrichedDetailPageData(
  published: PublishedItem[],
  position: number,
  detail: PublishedItem,
) {
  const data = detailPageData(published, position, detail);
  return {
    ...data,
    sources: await resolveSourceArtwork(data.sources, published),
  };
}

function detailPosition(
  published: PublishedItem[],
  category: string,
  slug: string,
) {
  const path = `/catalog/${category}/${slug}`;
  const position = prepareDetailCatalog(published).positions.get(path);
  if (position === undefined) throw notFound();
  return position;
}

// SSR retains the complete page for search engines. In-app navigation opens from
// memory/IndexedDB, or the already-loaded index while the shard loads separately.
export async function loadDetailRoute(category: string, slug: string) {
  if (typeof window === "undefined")
    return { ...(await loadDetailPage(category, slug)), enrichment: undefined };
  const published = await loadSessionCatalog();
  const position = detailPosition(published, category, slug);
  const cached = await readSessionCatalogDetail(published[position]);
  const initial = detailPageData(
    published,
    position,
    cached ?? published[position],
  );
  return {
    ...initial,
    enrichment:
      cached &&
      !initial.sources.some((source) =>
        sourceArtworkLocation(source, published),
      )
        ? undefined
        : (cached
            ? Promise.resolve(cached)
            : loadSessionCatalogDetail(published[position])
          )
            .then((detail) =>
              enrichedDetailPageData(published, position, detail),
            )
            .then(
              (data) => ({
                data,
                failed: false,
              }),
              () => ({ data: initial, failed: true }),
            ),
  };
}

function detailPageData(
  published: PublishedItem[],
  position: number,
  detail: PublishedItem,
) {
  const prepared = prepareDetailCatalog(published);
  // Each request can overlay a different full shard without modifying the shared
  // index projection, including while another request awaits its enrichment.
  const catalog = prepared.catalog.slice();
  const item =
    detail === published[position]
      ? prepared.catalog[position]
      : normalizeDetailItem(detail);
  catalog[position] = item;
  const sources = dropSources(item, catalog);
  const setEquipment =
    item.category === "armor" && item.game_data.set
      ? catalog.filter(
          (entry) =>
            entry.category === "armor" &&
            entry.slug !== item.slug &&
            entry.game_data.set === item.game_data.set,
        )
      : [];
  const links = [
    item.game_data.base,
    item.game_data.uniqueVariant,
    ...item.game_data.drops,
    ...(item.game_data.effects ?? []),
    ...(item.game_data.loot ?? []),
    ...sources,
    ...applicableEffects(item),
    item.game_data.summons,
    item.game_data.baseMob,
    item.game_data.summonedBy,
    ...(item.game_data.carriers ?? []),
    ...(item.game_data.areas ?? []),
    ...(item.game_data.mobs ?? []),
    ...(item.game_data.minibosses ?? []),
    ...(item.game_data.arena ?? []),
    ...(item.game_data.minions ?? []),
    ...(item.game_data.levels?.flatMap((level) => level.effects ?? []) ?? []),
    ...(item.game_data.status?.gear ?? []),
    ...(item.game_data.status?.mobs ?? []),
    ...(item.game_data.status?.immune ?? []),
    ...(item.game_data.fights?.flatMap((fight) => [
      { name: fight.place ?? "", catalog_slug: fight.catalog_slug },
      ...(fight.regions ?? []),
    ]) ?? []),
  ];
  const needed = new Set([
    ...setEquipment.map((entry) => entry.slug),
    ...links.flatMap((link) =>
      link && "catalog_slug" in link && typeof link.catalog_slug === "string"
        ? [link.catalog_slug]
        : [],
    ),
  ]);
  if (item.category === "location") {
    const location = locationMetadata(item, catalog);
    for (const entries of [
      location.loot,
      location.mobs,
      location.minibosses,
      location.entrances,
      location.places,
    ]) {
      for (const entry of entries)
        if (entry.catalog_slug) needed.add(entry.catalog_slug);
    }
  }
  return {
    item,
    catalog: prepared.cards.filter(
      (entry) => entry.slug !== item.slug && needed.has(entry.slug),
    ),
    sources,
  };
}
export function catalogReturnPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return "/collection";
  const url = new URL(value, "https://mddex.net");
  return url.origin === "https://mddex.net" &&
    [
      "/collection",
      "/mobs",
      "/resources/item-tracker",
      "/resources/item-tracker-cards",
      "/resources/item-tracker-list",
      "/resources/item-tracker-rarities",
    ].includes(url.pathname)
    ? `${url.pathname}${url.search}${url.hash}`
    : "/collection";
}
