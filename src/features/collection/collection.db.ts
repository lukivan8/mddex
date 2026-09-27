import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import {
  prepareCompletionStorage,
  COLLECTION_STORAGE_KEY,
} from "./collection.migration";
export { COLLECTION_STORAGE_KEY } from "./collection.migration";
import { completionSchema } from "./collection.types";

// The only persistence boundary. No catalog objects or identity information live here.
export function createCompletionCollection(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  prepareCompletionStorage(storage);
  return createCollection(
    localStorageCollectionOptions({
      id: "mddex-collection",
      storageKey: COLLECTION_STORAGE_KEY,
      storage,
      schema: completionSchema,
      getKey: (record) => record.itemSlug,
    }),
  );
}
export type CompletionCollection = ReturnType<
  typeof createCompletionCollection
>;
let browserCollection: CompletionCollection | undefined;
export function getCompletionCollection() {
  if (typeof window === "undefined")
    throw new Error("Completion is only available in the browser");
  return (browserCollection ??= createCompletionCollection(
    window.localStorage,
  ));
}
