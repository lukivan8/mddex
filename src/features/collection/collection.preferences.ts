import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import { z } from "zod";
import type { LocalStorageAdapter } from "./collection.migration";
export const PREFERENCES_STORAGE_KEY = "mddex.preferences.v1";
export function createPreferencesCollection(storage: LocalStorageAdapter) {
  if (storage.getItem(PREFERENCES_STORAGE_KEY) === null) {
    const previous = storage.getItem("mddb.preferences.v1");
    if (previous !== null) storage.setItem(PREFERENCES_STORAGE_KEY, previous);
  }
  return createCollection(
    localStorageCollectionOptions({
      id: "mddex-preferences",
      storageKey: PREFERENCES_STORAGE_KEY,
      storage,
      schema: z.object({
        id: z.literal("spoilers"),
        showAllItems: z.boolean(),
      }),
      getKey: (record) => record.id,
    }),
  );
}
export type PreferencesCollection = ReturnType<
  typeof createPreferencesCollection
>;
let browserPreferences: PreferencesCollection | undefined;
export function getPreferencesCollection() {
  return (browserPreferences ??= createPreferencesCollection(
    window.localStorage,
  ));
}
export function setShowAllItems(
  collection: PreferencesCollection,
  showAllItems: boolean,
) {
  return collection.has("spoilers")
    ? collection.update("spoilers", (draft) => {
        draft.showAllItems = showAllItems;
      })
    : collection.insert({ id: "spoilers", showAllItems });
}
