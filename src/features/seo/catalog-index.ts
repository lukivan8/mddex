import type { CatalogItem } from "../catalog/catalog.types";
import { CATALOG_CATEGORIES, categoryLabel } from "../catalog/catalog.helpers";
import { normalizeDetailItem } from "../catalog-details/catalog-detail.loader";
import { itemPath } from "../catalog-details/catalog-detail.model";

export type CatalogIndexGroup = {
  category: string;
  label: string;
  items: { name: string; path: string }[];
};

export function catalogIndex(
  items: CatalogItem[],
  categories: readonly string[] = CATALOG_CATEGORIES,
): CatalogIndexGroup[] {
  return categories
    .map((category) => ({
      category,
      label: categoryLabel(category),
      items: items
        .filter((item) => item.category === category)
        .map((item) => ({
          name: item.variation,
          path: itemPath(normalizeDetailItem(item)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.items.length > 0);
}
