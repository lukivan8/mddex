import { itemSeo as generateSeo } from "../../src/features/catalog-details/catalog-detail.seo";
import { catalogItems, type CatalogItem } from "./item-links";
export function itemSeo(item: CatalogItem) {
  return generateSeo(item, catalogItems);
}
