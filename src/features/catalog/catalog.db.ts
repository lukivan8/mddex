import { z } from "zod";
import { catalogSchema, catalogItemSchema } from "./catalog.schema";
import type { CatalogItem } from "./catalog.types";

export const CATALOG_DATABASE = "mddex-catalog-v2";
const snapshotSchema = z.object({
  source: z.string().url(),
  version: z.string().min(1),
  releaseUrl: z.string().url(),
  catalogUrl: z.string().url().optional(),
  items: catalogSchema,
});
export type CatalogSnapshot = z.infer<typeof snapshotSchema>;
export interface CatalogCache {
  read(source: string): Promise<CatalogSnapshot | undefined>;
  write(snapshot: CatalogSnapshot): Promise<void>;
  readDetail?(url: string): Promise<CatalogItem | undefined>;
  writeDetail?(url: string, item: CatalogItem): Promise<void>;
}

// Disposable external definitions; user loadouts remain in their existing store.
export function createCatalogCache(factory: IDBFactory): CatalogCache {
  async function operation(
    store: string,
    key: string,
    value?: unknown,
  ): Promise<unknown> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(CATALOG_DATABASE, 1);
      let expired = false;
      const fail = (error = new Error("Catalog storage unavailable")) => {
        expired = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(() => fail(), 1500);
      request.onblocked = () => fail();
      request.onerror = () => fail(request.error ?? undefined);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("snapshots");
        request.result.createObjectStore("details");
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (expired) request.result.close();
        else resolve(request.result);
      };
    });
    db.onversionchange = () => db.close();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(
          store,
          value === undefined ? "readonly" : "readwrite",
        );
        const records = transaction.objectStore(store);
        const request =
          value === undefined ? records.get(key) : records.put(value, key);
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("Catalog transaction aborted"));
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Catalog transaction failed"));
      });
    } finally {
      db.close();
    }
  }
  return {
    async read(source) {
      const parsed = snapshotSchema.safeParse(
        await operation("snapshots", source),
      );
      return parsed.success && parsed.data.source === source
        ? parsed.data
        : undefined;
    },
    async write(snapshot) {
      await operation(
        "snapshots",
        snapshot.source,
        snapshotSchema.parse(snapshot),
      );
    },
    async readDetail(url) {
      const parsed = catalogItemSchema.safeParse(
        await operation("details", url),
      );
      return parsed.success ? parsed.data : undefined;
    },
    async writeDetail(url, item) {
      await operation("details", url, catalogItemSchema.parse(item));
    },
  };
}
let browserCache: CatalogCache | undefined;
export function getCatalogCache() {
  return (browserCache ??= createCatalogCache(window.indexedDB));
}
