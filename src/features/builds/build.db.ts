import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import { z } from "zod";
import {
  buildSchema,
  buildPreferenceSchema,
  equippedSchema,
  BUILD_SLOTS,
  isGearSlot,
  supportsEffects,
  EFFECT_COUNT,
} from "./build.types";
type LocalStorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const LEGACY_BUILDS_STORAGE_KEY = "mddex.builds.v1";
export const PREVIOUS_BUILDS_STORAGE_KEY = "mddex.builds.v2";
export const BUILDS_STORAGE_KEY = "mddex.builds.v3";
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
function migrateBuilds(storage: LocalStorageAdapter) {
  if (storage.getItem(BUILDS_STORAGE_KEY) !== null) return;
  const previous = storage.getItem(PREVIOUS_BUILDS_STORAGE_KEY);
  const legacy = previous ?? storage.getItem(LEGACY_BUILDS_STORAGE_KEY);
  if (legacy === null) return;
  const legacyBuildSchema = buildSchema.extend({
    slots: z.record(
      z.enum(BUILD_SLOTS),
      equippedSchema
        .extend({
          enchantments: z.array(z.string().min(1).nullable()).max(3),
          effects: z.array(z.string().min(1).nullable()).max(3).default([]),
        })
        .nullable(),
    ),
  });
  let migrated: string;
  try {
    const saved = z
      .record(
        z.string(),
        z.object({ versionKey: z.string(), data: legacyBuildSchema }),
      )
      .parse(JSON.parse(legacy));
    for (const record of Object.values(saved)) {
      for (const slot of BUILD_SLOTS) {
        const equipped = record.data.slots[slot];
        if (!equipped) continue;
        equipped.enchantments = isGearSlot(slot)
          ? [equipped.enchantments.find((slug) => slug !== null) ?? null]
          : [];
        equipped.effects = supportsEffects(slot)
          ? Array.from({ length: EFFECT_COUNT }, (_, index) =>
              previous !== null ? (equipped.effects[index] ?? null) : null,
            )
          : [];
      }
      buildSchema.parse(record.data);
    }
    migrated = JSON.stringify(saved);
  } catch {
    throw new Error(
      "Saved loadout data is unreadable. It has been preserved; restore a valid backup before editing.",
    );
  }
  storage.setItem(BUILDS_STORAGE_KEY, migrated);
}
export function createBuildCollections(storage: LocalStorageAdapter) {
  validateSaved(storage, BUILD_PREFERENCES_KEY, buildPreferenceSchema);
  migrateBuilds(storage);
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
