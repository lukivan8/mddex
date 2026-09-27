import type { CatalogItem } from "../catalog/catalog.types";
import { categoryLabel } from "../catalog/catalog.helpers";
import type { CollectionFilters, CompletionRecord } from "./collection.types";
import { normalizeDiscoveryName } from "./collection.discovery";
export type CatalogItemView = {
  slug: string;
  category: string;
  type: string;
  displayName: string;
  image: string | null;
  discovered: boolean;
  hidden: boolean;
};
export const isDiscovered = (entry?: CompletionRecord) =>
  entry?.discovered ?? false;
export const isCollected = (entry?: CompletionRecord) => entry?.owned ?? false;
export function getCatalogItemView(
  item: CatalogItem,
  entry: CompletionRecord | undefined,
  showAllItems: boolean,
): CatalogItemView {
  const discovered = isDiscovered(entry);
  const hidden = !showAllItems && !discovered;
  // Deliberately enumerate fields: never spread canonical data into presentation.
  return {
    slug: item.slug,
    category: item.category,
    type: item.type,
    displayName: hidden ? "?????" : item.variation,
    image: hidden ? null : item.image,
    discovered,
    hidden,
  };
}
export function getVisibleItemViews(
  items: CatalogItemView[],
  owned: ReadonlySet<string>,
  filters: CollectionFilters,
) {
  const tokens = normalizeDiscoveryName(filters.q || "")
    .split(/\s+/)
    .filter(Boolean);
  const bySafeName = (a: CatalogItemView, b: CatalogItemView) => {
    if (a.hidden && b.hidden) return 0; // Stable catalog order; never compare secret names or slugs.
    if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
    return a.displayName.localeCompare(b.displayName);
  };
  return items
    .filter((item) => {
      const publicText = `${categoryLabel(item.category)} ${item.category} ${item.type}`;
      const searchable = normalizeDiscoveryName(
        item.hidden
          ? publicText
          : `${publicText} ${item.displayName} ${item.slug}`,
      );
      return (
        (!filters.category || item.category === filters.category) &&
        (!filters.type || item.type === filters.type) &&
        (filters.status !== "missing" || !owned.has(item.slug)) &&
        (filters.status !== "collected" || owned.has(item.slug)) &&
        tokens.every((token) => searchable.includes(token))
      );
    })
    .sort((a, b) => {
      if (filters.sort === "category")
        return a.category.localeCompare(b.category) || bySafeName(a, b);
      if (filters.sort === "missing" || filters.sort === "collected")
        return (
          (Number(owned.has(a.slug)) - Number(owned.has(b.slug))) *
            (filters.sort === "missing" ? 1 : -1) || bySafeName(a, b)
        );
      return bySafeName(a, b);
    });
}
