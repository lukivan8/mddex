import type { CatalogItem } from "../catalog/catalog.types";
import {
  categoryLabel,
  enchantmentApplicability,
  CATALOG_CATEGORIES,
  isCatalogItem,
} from "../catalog/catalog.helpers";
import type { CollectionFilters } from "./collection.types";
import { uniqueEffect } from "../builds/build.unique";
export type CatalogItemView = {
  slug: string;
  category: string;
  type: string;
  displayName: string;
  image: string | null;
  detailSlug?: string;
  kind?: "boss" | "hostile" | "companion" | "neutral" | "other";
  applicable_categories?: CatalogItem["applicable_categories"];
  applicability?: string;
  uniqueEffect?: CatalogItem;
};
export function getCatalogItemView(
  item: CatalogItem,
  catalog?: ReadonlyMap<string, CatalogItem>,
): CatalogItemView {
  const fixed = uniqueEffect(item);
  const canonical = fixed ? catalog?.get(fixed.slug) : undefined;
  return {
    slug: item.slug,
    category: item.category,
    type: item.type,
    displayName: item.variation,
    image: item.image,
    detailSlug:
      typeof item.game_data?.slug === "string"
        ? item.game_data.slug
        : item.slug,
    ...(fixed
      ? {
          uniqueEffect: {
            ...(canonical ?? fixed),
            description: fixed.description ?? canonical?.description,
          },
        }
      : {}),
    ...(item.category === "enchantment"
      ? {
          applicable_categories: item.applicable_categories,
          applicability: enchantmentApplicability(item),
        }
      : {}),
  };
}
export function getVisibleItemViews(
  items: CatalogItemView[],
  filters: CollectionFilters,
) {
  const tokens = (filters.q || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return items
    .filter((item) => {
      const text =
        `${categoryLabel(item.category)} ${item.category} ${item.type} ${item.displayName} ${item.slug} ${item.applicability ?? ""} ${item.uniqueEffect?.variation ?? ""}`.toLowerCase();
      return (
        isCatalogItem(item) &&
        (!filters.category || item.category === filters.category) &&
        (!filters.type || item.type === filters.type) &&
        (!filters.appliesTo ||
          (item.category === "enchantment" &&
            (filters.appliesTo === "unknown"
              ? !item.applicable_categories?.length
              : item.applicable_categories?.includes(filters.appliesTo)))) &&
        tokens.every((token) => text.includes(token))
      );
    })
    .sort(
      (a, b) =>
        (filters.sort === "category"
          ? CATALOG_CATEGORIES.findIndex(
              (category) => category === a.category,
            ) -
            CATALOG_CATEGORIES.findIndex((category) => category === b.category)
          : 0) || a.displayName.localeCompare(b.displayName),
    );
}
