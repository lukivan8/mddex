import {
  applicableEffects,
  locationMetadata,
} from "./catalog-detail.enrichment";
import { notFound } from "@tanstack/react-router";
import {
  loadSessionCatalog,
  loadSessionCatalogDetail,
} from "../catalog/catalog.session";
import type { CatalogItem as PublishedItem } from "../catalog/catalog.types";
import {
  dropSources,
  itemPath,
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
          pickFields(instance, ["name", "lead", "levels"]),
        );
    }
  } else {
    delete data.wikily;
    delete data.location_context;
  }
  if (Array.isArray(data.quest_context))
    data.quest_context = data.quest_context.map((quest) =>
      pickFields(quest, ["name", "rewards"]),
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
export async function loadDetailPage(category: string, slug: string) {
  const published = await loadSessionCatalog();
  const catalog = published.map(normalizeDetailItem);
  const path = `/catalog/${category}/${slug}`;
  const position = catalog.findIndex((entry) => itemPath(entry) === path);
  if (position < 0) throw notFound();
  const item = normalizeDetailItem(
    await loadSessionCatalogDetail(published[position]),
  );
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
    item.slug,
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
  const enrichment = new Set([
    "wikily",
    "rollable_effects",
    "enchantment_options",
    "acquisition",
    "quest_context",
    "spawn_conditions",
    "drop_conditions",
    "soul_enchantment_rules",
    "map_context",
    "location_context",
    "reference_context",
    "gear_rules",
    "wikily_cards",
  ]);
  return {
    item,
    catalog: catalog
      .filter((entry) => needed.has(entry.slug))
      .map((entry) => ({
        ...entry,
        game_data: Object.fromEntries(
          Object.entries(entry.game_data).filter(
            ([key]) => !enrichment.has(key),
          ),
        ) as CatalogItem["game_data"],
      })),
    sources,
  };
}
export function catalogReturnPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return "/collection";
  const url = new URL(value, "https://mddex.net");
  return url.origin === "https://mddex.net" &&
    ["/collection", "/mobs"].includes(url.pathname)
    ? `${url.pathname}${url.search}${url.hash}`
    : "/collection";
}
