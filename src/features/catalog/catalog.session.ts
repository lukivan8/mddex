import { getCatalogCache, type CatalogCache } from "./catalog.db";
import {
  getContentSource,
  loadCatalog,
  loadCatalogDetail,
} from "./catalog.loader";
import type { CatalogItem } from "./catalog.types";

// A browser session pins one release, so builder definitions and route data never mix.
// Revalidation persists the next complete snapshot for the next full page load.
let pending: Promise<CatalogItem[]> | undefined;
const serverCatalogs = new Map<
  string,
  { request: Promise<CatalogItem[]>; expires: number }
>();
export function loadSessionCatalog() {
  const source = getContentSource();
  if (typeof window === "undefined") {
    const saved = serverCatalogs.get(source.latestUrl);
    if (saved && saved.expires > Date.now()) return saved.request;
    const request = loadCatalog(source).catch((error: unknown) => {
      serverCatalogs.delete(source.latestUrl);
      throw error;
    });
    serverCatalogs.set(source.latestUrl, {
      request,
      expires: Date.now() + 60_000,
    });
    return request;
  }
  return (pending ??= (async () => {
    let cache: CatalogCache | undefined;
    try {
      if (typeof window !== "undefined") cache = getCatalogCache();
    } catch {
      /* Memory-only browsing works. */
    }
    const saved = await cache?.read(source.latestUrl).catch(() => undefined);
    if (saved) {
      // Do not make a cached visitor wait for the mutable pointer or a new index.
      void loadCatalog(source, undefined, cache).catch(() => {});
      return saved.items;
    }
    return loadCatalog(source, undefined, cache);
  })().catch((error: unknown) => {
    pending = undefined;
    throw error;
  }));
}

const details = new Map<
  string,
  { request: Promise<CatalogItem>; item?: CatalogItem }
>();
function trimDetails() {
  // Bound the long-lived server isolate and browser session memory.
  if (details.size > 128) details.delete(details.keys().next().value!);
}

/** Read a pinned release's details without waiting for the network. */
export async function readSessionCatalogDetail(item: CatalogItem) {
  if (!item.detail_path) return item;
  const saved = details.get(item.detail_path)?.item;
  if (saved) return saved;
  if (typeof window === "undefined") return undefined;
  try {
    const cached = await getCatalogCache().readDetail?.(item.detail_path);
    if (cached?.slug === item.slug && cached.category === item.category) {
      if (!details.has(item.detail_path)) {
        details.set(item.detail_path, {
          request: Promise.resolve(cached),
          item: cached,
        });
        trimDetails();
      }
      return cached;
    }
  } catch {
    /* An uncached item can still open from the session index. */
  }
  return undefined;
}

export function loadSessionCatalogDetail(item: CatalogItem) {
  if (!item.detail_path) return Promise.resolve(item);
  const key = item.detail_path;
  let entry = details.get(key);
  if (!entry) {
    let cache: CatalogCache | undefined;
    try {
      if (typeof window !== "undefined") cache = getCatalogCache();
    } catch {
      /* Memory-only browsing remains available. */
    }
    const created: { request: Promise<CatalogItem>; item?: CatalogItem } = {
      request: loadCatalogDetail(item, cache)
        .then((detail) => {
          created.item = detail;
          return detail;
        })
        .catch((error: unknown) => {
          details.delete(key);
          throw error;
        }),
    };
    entry = created;
    details.set(key, entry);
    trimDetails();
  }
  return entry.request;
}
