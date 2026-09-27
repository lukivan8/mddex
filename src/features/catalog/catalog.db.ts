import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import { z } from "zod";
import { catalogSchema } from "./catalog.schema";

export const CATALOG_STORAGE_KEY = "mddex.catalog.v1";
const snapshotSchema = z.object({
  source: z.string().url(),
  version: z.string().min(1),
  releaseUrl: z.string().url(),
  items: catalogSchema,
});
export type CatalogSnapshot = z.infer<typeof snapshotSchema>;
export interface CatalogCache {
  read(source: string): Promise<CatalogSnapshot | undefined>;
  write(snapshot: CatalogSnapshot): Promise<void>;
}

// A replaceable cache of external definitions, never user-owned game content.
// Version and items live in one record so a failed update cannot mismatch them.
export function createCatalogCache(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): CatalogCache {
  const saved = storage.getItem(CATALOG_STORAGE_KEY);
  if (saved !== null) {
    try {
      z.record(
        z.string(),
        z.object({
          versionKey: z.string(),
          data: snapshotSchema,
        }),
      ).parse(JSON.parse(saved));
    } catch {
      // Only disposable catalog data is cleared; completion/builds are untouched.
      storage.removeItem(CATALOG_STORAGE_KEY);
    }
  }
  const collection = createCollection(
    localStorageCollectionOptions({
      id: "mddex-catalog-cache",
      storageKey: CATALOG_STORAGE_KEY,
      storage,
      schema: snapshotSchema,
      getKey: (snapshot) => snapshot.source,
    }),
  );
  return {
    async read(source) {
      await collection.preload();
      return collection.get(source);
    },
    async write(snapshot) {
      await collection.preload();
      const transaction = collection.has(snapshot.source)
        ? collection.update(snapshot.source, (draft) => {
            draft.version = snapshot.version;
            draft.releaseUrl = snapshot.releaseUrl;
            draft.items = snapshot.items;
          })
        : collection.insert(snapshot);
      await transaction.isPersisted.promise;
    },
  };
}
let browserCache: CatalogCache | undefined;
export function getCatalogCache() {
  return (browserCache ??= createCatalogCache(window.localStorage));
}
