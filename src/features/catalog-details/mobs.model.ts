import type { CatalogItem } from "../catalog/catalog.types";
import {
  getCatalogItemView,
  type CatalogItemView,
} from "../collection/collection.presentation";
import { normalizeDetailItem } from "./catalog-detail.loader";
export type MobFilters = {
  q?: string;
  kind?: "boss" | "neutral" | "hostile" | "companion";
  location?: string;
  sort?: "name" | "name_desc" | "kind";
};
export function mobsCatalog(catalog: CatalogItem[]) {
  const entries = catalog.map(normalizeDetailItem);
  const locations = entries.filter((item) => item.category === "location");
  const items = catalog
    .filter((item) => item.category === "mob")
    .map((item) => {
      const data = normalizeDetailItem(item).game_data;
      const kind = (data.mobKind ?? item.type).toLowerCase();
      const displayKind: NonNullable<CatalogItemView["kind"]> = [
        "boss",
        "miniboss",
      ].includes(kind)
        ? "boss"
        : ["hostile", "soul-corrupted"].includes(kind)
          ? "hostile"
          : kind === "passive" || kind === "neutral"
            ? "neutral"
            : kind === "companion"
              ? "companion"
              : "other";
      const references = [
        ...(data.areas ?? []),
        ...(data.fights?.flatMap((fight) => [
          { name: fight.place ?? "", catalog_slug: fight.catalog_slug },
          ...(fight.regions ?? []),
        ]) ?? []),
      ];
      const locationSlugs = locations
        .filter(
          (location) =>
            references.some(
              (ref) =>
                ref.catalog_slug === location.slug ||
                ref.name === location.name,
            ) ||
            [
              ...(location.game_data.mobs ?? []),
              ...(location.game_data.minibosses ?? []),
              ...(location.game_data.arena ?? []),
            ].some((ref) => ref.catalog_slug === item.slug),
        )
        .map((location) => location.slug);
      return {
        ...getCatalogItemView(item),
        kind: displayKind,
        locations: locationSlugs,
      };
    });
  return {
    items,
    locations: locations
      .filter((location) =>
        items.some((item) => item.locations.includes(location.slug)),
      )
      .map((location) => ({ id: location.slug, name: location.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
