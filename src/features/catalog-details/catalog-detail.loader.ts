import { notFound } from "@tanstack/react-router";
import { loadSessionCatalog } from "../catalog/catalog.session";
import type { CatalogItem as PublishedItem } from "../catalog/catalog.types";
import {
  dropSources,
  itemPath,
  type CatalogItem,
} from "./catalog-detail.model";
export function normalizeDetailItem(item: PublishedItem): CatalogItem {
  const data = item.game_data ?? {};
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
  const catalog = (await loadSessionCatalog()).map(normalizeDetailItem);
  const path = `/catalog/${category}/${slug}`;
  const item = catalog.find((item) => itemPath(item) === path);
  if (!item) throw notFound();
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
  return {
    item,
    catalog: catalog.filter((entry) => needed.has(entry.slug)),
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
