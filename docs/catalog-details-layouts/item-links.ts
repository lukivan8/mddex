import records from "./item-links.json";
import {
  dropSources as resolveSources,
  type CatalogItem,
} from "../../src/features/catalog-details/catalog-detail.model";
export * from "../../src/features/catalog-details/catalog-detail.model";
export const catalogItems = records as unknown as CatalogItem[];
export const itemsBySlug = new Map(
  catalogItems.map((item) => [item.slug, item]),
);
export function dropSources(item: CatalogItem) {
  return resolveSources(item, catalogItems);
}
