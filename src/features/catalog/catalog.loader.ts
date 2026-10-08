import type { CatalogCache } from "./catalog.db";
import { hasCatalogArtwork } from "./catalog.helpers";
import {
  catalogSchema,
  catalogItemSchema,
  latestReleaseSchema,
} from "./catalog.schema";
import type { CatalogItem } from "./catalog.types";
const defaultBase = "https://cdn.mddex.net/";
export function getContentSource() {
  const baseUrl = (
    import.meta.env.VITE_CONTENT_BASE_URL || defaultBase
  ).replace(/\/?$/, "/");
  return {
    latestUrl: new URL("latest.json", baseUrl).href,
  };
}
export function resolveImage(
  path: string | null,
  baseUrl: string,
): string | null {
  if (!path) return null;
  const url = new URL(path, baseUrl);
  return ["https:", "http:"].includes(url.protocol) ? url.href : null;
}
function resolveArtwork(artwork: CatalogItem["artwork"], baseUrl: string) {
  return artwork
    ? Object.fromEntries(
        Object.entries(artwork).flatMap(([key, path]) => {
          const url = resolveImage(path, baseUrl);
          return url ? [[key, url]] : [];
        }),
      )
    : undefined;
}

export async function loadCatalog(
  source = getContentSource(),
  signal?: AbortSignal,
  cache?: CatalogCache,
): Promise<CatalogItem[]> {
  const timeout = AbortSignal.timeout(15_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  // Revalidate the mutable pointer; release assets can retain their immutable CDN caching.
  const latestResponse = await fetch(source.latestUrl, {
    signal: requestSignal,
    cache: "no-cache",
  });
  if (!latestResponse.ok)
    throw new Error(`Release discovery failed (${latestResponse.status})`);
  const latest = latestReleaseSchema.safeParse(await latestResponse.json());
  if (!latest.success)
    throw new Error("The published release pointer has an unexpected format.");

  const manifestUrl = new URL(latest.data.manifest, source.latestUrl);
  if (!["https:", "http:"].includes(manifestUrl.protocol))
    throw new Error("The published manifest URL is invalid.");
  // The manifest path is authoritative; never infer a directory from the version string.
  const releaseUrl = new URL(".", manifestUrl);
  const catalogUrl = latest.data.catalogIndex
    ? new URL(latest.data.catalogIndex, source.latestUrl)
    : new URL("catalog.json", releaseUrl);
  if (
    catalogUrl.origin !== releaseUrl.origin ||
    !catalogUrl.href.startsWith(releaseUrl.href)
  )
    throw new Error("The catalog index is outside its release.");
  // Both the publisher version and resolved release location must match.
  const cached = await cache?.read(source.latestUrl).catch(() => undefined);
  if (
    cached?.version === latest.data.catalogVersion &&
    cached.releaseUrl === releaseUrl.href &&
    (cached.catalogUrl ?? new URL("catalog.json", releaseUrl).href) ===
      catalogUrl.href
  )
    return cached.items.map((item) => ({
      ...item,
      image: hasCatalogArtwork(item) ? item.image : null,
    }));

  const response = await fetch(catalogUrl.href, {
    signal: requestSignal,
  });
  if (!response.ok)
    throw new Error(`Catalog request failed (${response.status})`);
  const parsed = catalogSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("The published catalog has an unexpected format.");
  const items = parsed.data.map((item) => ({
    ...item,
    ...(item.detail_path
      ? { detail_path: resolveDetailPath(item.detail_path, releaseUrl.href) }
      : {}),
    image: hasCatalogArtwork(item)
      ? resolveImage(item.image, releaseUrl.href)
      : null,
    ...(item.artwork
      ? { artwork: resolveArtwork(item.artwork, releaseUrl.href) }
      : {}),
  }));
  // Cache failures must not prevent using successfully fetched content.
  await cache
    ?.write({
      source: source.latestUrl,
      version: latest.data.catalogVersion,
      releaseUrl: releaseUrl.href,
      catalogUrl: catalogUrl.href,
      items,
    })
    .catch(() => undefined);
  return items;
}

function resolveDetailPath(path: string, releaseUrl: string) {
  const url = new URL(path, releaseUrl);
  if (
    url.origin !== new URL(releaseUrl).origin ||
    !url.href.startsWith(releaseUrl)
  )
    throw new Error("The detail shard is outside its release.");
  return url.href;
}

export async function loadCatalogDetail(
  item: CatalogItem,
  cache?: CatalogCache,
): Promise<CatalogItem> {
  if (!item.detail_path) return item;
  const url = item.detail_path;
  const saved = await cache?.readDetail?.(url).catch(() => undefined);
  if (saved?.slug === item.slug && saved.category === item.category)
    return saved;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok)
    throw new Error(`Detail request failed (${response.status})`);
  const parsed = catalogItemSchema.parse(await response.json());
  if (parsed.slug !== item.slug || parsed.category !== item.category)
    throw new Error("The detail shard does not match its catalog entry.");
  const detail = {
    ...item,
    game_data: parsed.game_data,
    ...(parsed.artwork
      ? { artwork: resolveArtwork(parsed.artwork, new URL("../", url).href) }
      : {}),
    description: parsed.description ?? item.description,
  };
  await cache?.writeDetail?.(url, detail).catch(() => undefined);
  return detail;
}
