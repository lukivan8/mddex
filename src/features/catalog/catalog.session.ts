import { getCatalogCache, type CatalogCache } from "./catalog.db";
import { loadCatalog } from "./catalog.loader";
import type { CatalogItem } from "./catalog.types";

// Browser-session cache: route changes share a request and validated definitions.
// A full reload discovers the latest published release; failures remain retryable.
let pending: Promise<CatalogItem[]> | undefined;
export function loadSessionCatalog() {
  if (typeof window === "undefined") return loadCatalog();
  let cache: CatalogCache | undefined;
  try {
    cache = getCatalogCache();
  } catch {
    // Storage can be blocked; the in-memory session still works.
  }
  return (pending ??= loadCatalog(undefined, undefined, cache).catch(
    (error: unknown) => {
      pending = undefined;
      throw error;
    },
  ));
}
