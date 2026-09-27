import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import { z } from "zod";
import { buildSchema, buildPreferenceSchema } from "./build.types";
import type { LocalStorageAdapter } from "../collection/collection.migration";
export const BUILDS_STORAGE_KEY = "mddex.builds.v1";
export const BUILD_PREFERENCES_KEY = "mddex.build-preferences.v1";
function validateSaved(
  storage: LocalStorageAdapter,
  key: string,
  schema: z.ZodType,
) {
  const value = storage.getItem(key);
  if (value === null) return;
  try {
    z.record(
      z.string(),
      z.object({ versionKey: z.string(), data: schema }),
    ).parse(JSON.parse(value));
  } catch {
    throw new Error(
      "Saved loadout data is unreadable. It has been preserved; restore a valid backup before editing.",
    );
  }
}
export function createBuildCollections(storage: LocalStorageAdapter) {
  validateSaved(storage, BUILDS_STORAGE_KEY, buildSchema);
  validateSaved(storage, BUILD_PREFERENCES_KEY, buildPreferenceSchema);
  return {
    builds: createCollection(
      localStorageCollectionOptions({
        id: "mddex-builds",
        storageKey: BUILDS_STORAGE_KEY,
        storage,
        schema: buildSchema,
        getKey: (b) => b.id,
      }),
    ),
    preferences: createCollection(
      localStorageCollectionOptions({
        id: "mddex-build-preferences",
        storageKey: BUILD_PREFERENCES_KEY,
        storage,
        schema: buildPreferenceSchema,
        getKey: (p) => p.id,
      }),
    ),
  };
}
export type BuildCollections = ReturnType<typeof createBuildCollections>;
let browser: BuildCollections | undefined;
export const getBuildCollections = () =>
  (browser ??= createBuildCollections(window.localStorage));
