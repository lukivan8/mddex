import type { CatalogCache } from "./catalog.db";
import { hasCatalogArtwork } from "./catalog.helpers";
import { catalogSchema, latestReleaseSchema } from "./catalog.schema";
import type { CatalogItem } from "./catalog.types";
const defaultBase = "https://pub-35f269a579604af2ac5c2103db21e213.r2.dev/";
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
  // Both the publisher version and resolved release location must match.
  const cached = await cache?.read(source.latestUrl).catch(() => undefined);
  if (
    cached?.version === latest.data.catalogVersion &&
    cached.releaseUrl === releaseUrl.href
  )
    return cached.items.map((item) => ({
      ...item,
      image: hasCatalogArtwork(item) ? item.image : null,
    }));

  const response = await fetch(new URL("catalog.json", releaseUrl).href, {
    signal: requestSignal,
  });
  if (!response.ok)
    throw new Error(`Catalog request failed (${response.status})`);
  const parsed = catalogSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("The published catalog has an unexpected format.");
  const items = parsed.data.map((item) => ({
    ...item,
    image: hasCatalogArtwork(item)
      ? resolveImage(item.image, releaseUrl.href)
      : null,
  }));
  // Cache failures must not prevent using successfully fetched content.
  await cache
    ?.write({
      source: source.latestUrl,
      version: latest.data.catalogVersion,
      releaseUrl: releaseUrl.href,
      items,
    })
    .catch(() => undefined);
  return items;
}
