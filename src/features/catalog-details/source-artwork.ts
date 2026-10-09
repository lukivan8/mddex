import type { CatalogItem } from "../catalog/catalog.types";
import { loadSessionCatalogDetail } from "../catalog/catalog.session";
import { referenceArtwork } from "../catalog/catalog.reference-artwork";
import type { ItemSource } from "./catalog-detail.model";

/** Match published source identities, never display names or inferred destinations. */
export function sourceArtworkLocation(
  source: ItemSource,
  catalog: CatalogItem[],
) {
  if (!["dungeon", "rift"].includes(source.type) || !source.source_url)
    return undefined;
  let url: URL;
  try {
    url = new URL(source.source_url);
  } catch {
    return undefined;
  }
  const lane = source.type === "dungeon" ? "dungeons" : "rifts";
  const match = url.pathname.match(
    new RegExp(`^/minecraft-dungeons-2/${lane}/([^/]+)/?$`),
  );
  if (url.origin !== "https://wikily.gg" || !match) return undefined;
  return catalog.find(
    (item) => item.category === "location" && item.game_data?.slug === match[1],
  );
}

export async function resolveSourceArtwork(
  sources: ItemSource[],
  catalog: CatalogItem[],
  loadDetail = loadSessionCatalogDetail,
): Promise<ItemSource[]> {
  const locations = new Map<string, CatalogItem>();
  for (const source of sources) {
    const location = sourceArtworkLocation(source, catalog);
    if (location) locations.set(location.slug, location);
  }
  const loaded = new Map<string, CatalogItem>();
  await Promise.allSettled(
    [...locations.values()].map(async (location) => {
      loaded.set(location.slug, await loadDetail(location));
    }),
  );
  return sources.map((source) => {
    const location = sourceArtworkLocation(source, catalog);
    const detail = location && loaded.get(location.slug);
    const context = detail?.game_data?.location_context as
      { instances?: Record<string, unknown>[] } | undefined;
    const instance = Array.isArray(context?.instances)
      ? context.instances.find(
          (entry) => entry && entry.source_url === source.source_url,
        )
      : undefined;
    const image = detail && instance && referenceArtwork(detail, instance);
    return image ? { ...source, image } : source;
  });
}
