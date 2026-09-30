import type { CatalogItem } from "../catalog/catalog.types";
import { isCatalogItem } from "../catalog/catalog.helpers";
import { normalizeDetailItem } from "../catalog-details/catalog-detail.loader";
import { itemPath } from "../catalog-details/catalog-detail.model";
import { SITE_URL } from "./metadata";

const mainPaths = ["/build", "/collection", "/mobs"];

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
      isCatalogItem(item) ||
      item.category === "mob" ||
      item.category === "location"
    )
      paths.add(itemPath(normalizeDetailItem(item)));
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...paths].sort().map((path) =>
      `  <url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></url>`,
    ),
    "</urlset>",
  ].join("\n");
}
