import type { CatalogItem } from "../catalog/catalog.types";
import { buildSearchIndex } from "../catalog/catalog.helpers";
import type { CollectionFilters, Progress } from "./collection.types";
export const isOwned = (owned: ReadonlySet<string>, slug: string) =>
  owned.has(slug);
export function getOverallProgress(
  items: CatalogItem[],
  owned: ReadonlySet<string>,
): Progress {
  const count = items.reduce(
    (sum, i) => sum + Number(isOwned(owned, i.slug)),
    0,
  );
  return {
    owned: count,
    total: items.length,
    percent: items.length ? Math.round((count / items.length) * 100) : 0,
  };
}
export const getCategoryProgress = (
  items: CatalogItem[],
  owned: ReadonlySet<string>,
  category: string,
) =>
  getOverallProgress(
    items.filter((i) => i.category === category),
    owned,
  );
export function getVisibleItems(
  items: CatalogItem[],
  owned: ReadonlySet<string>,
  filters: CollectionFilters,
  index = buildSearchIndex(items),
) {
  const tokens = (filters.q || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return items
    .filter(
      (i) =>
        (!filters.category || i.category === filters.category) &&
        (!filters.type || i.type === filters.type) &&
        (filters.status !== "missing" || !owned.has(i.slug)) &&
        (filters.status !== "collected" || owned.has(i.slug)) &&
        tokens.every((t) => index.get(i.slug)?.includes(t)),
    )
    .sort((a, b) => {
      if (filters.sort === "category")
        return (
          a.category.localeCompare(b.category) ||
          a.variation.localeCompare(b.variation)
        );
      if (filters.sort === "missing" || filters.sort === "collected")
        return (
          (Number(owned.has(a.slug)) - Number(owned.has(b.slug))) *
            (filters.sort === "missing" ? 1 : -1) ||
          a.variation.localeCompare(b.variation)
        );
      return a.variation.localeCompare(b.variation);
    });
}
