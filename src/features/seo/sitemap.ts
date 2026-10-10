import type { CatalogItem } from "../catalog/catalog.types";
import { CATALOG_DETAIL_CATEGORIES } from "../catalog/catalog.helpers";
import { normalizeDetailItem } from "../catalog-details/catalog-detail.loader";
import { itemPath } from "../catalog-details/catalog-detail.model";
import { SITE_URL } from "./metadata";

const mainPaths = [
  "/build",
  "/collection",
  "/mobs",
  "/resources",
  "/resources/quests",
  "/resources/planner",
  "/resources/item-tracker",
  "/resources/item-tracker-cards",
  "/resources/item-tracker-list",
  "/resources/item-tracker-rarities",
  "/resources/soul-storm",
  "/resources/melee-weapons",
  "/resources/soul-storm-routes",
];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function catalogSitemap(items: CatalogItem[]) {
  const paths = new Set(mainPaths);
  for (const item of items) {
    if (
      CATALOG_DETAIL_CATEGORIES.some((category) => category === item.category)
    )
      paths.add(itemPath(normalizeDetailItem(item)));
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...paths]
      .sort()
      .map(
        (path) => `  <url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></url>`,
      ),
    "</urlset>",
  ].join("\n");
}
