import { z } from "zod";
import { completionSchema } from "./collection.types";
export const LEGACY_COLLECTION_STORAGE_KEY = "mddb.collection.v1";
export const COLLECTION_STORAGE_KEY = "mddex.collection.v2";
export type LocalStorageAdapter = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;
const legacySchema = z.record(
  z.string(),
  z.object({
    versionKey: z.string(),
    data: z.object({ itemSlug: z.string().min(1), owned: z.boolean() }),
  }),
);
const savedSchema = z.record(
  z.string(),
  z.object({ versionKey: z.string(), data: completionSchema }),
);
export function prepareCompletionStorage(storage: LocalStorageAdapter) {
  const current = storage.getItem(COLLECTION_STORAGE_KEY);
  const legacy = storage.getItem(LEGACY_COLLECTION_STORAGE_KEY);
  const previous = storage.getItem("mddb.collection.v2");
  let migrated: string | undefined;
  try {
    if (current !== null) savedSchema.parse(JSON.parse(current));
    else if (previous !== null) {
      migrated = JSON.stringify(savedSchema.parse(JSON.parse(previous)));
    } else if (legacy !== null) {
      const saved = legacySchema.parse(JSON.parse(legacy));
      const entries = Object.fromEntries(
        Object.entries(saved).map(([key, record]) => [
          key,
          {
            ...record,
            data: { ...record.data, discovered: record.data.owned },
          },
        ]),
      );
      migrated = JSON.stringify(savedSchema.parse(entries));
    }
  } catch {
    throw new Error(
      "Saved collection data is unreadable. It has been preserved; restore a valid browser backup before making changes.",
    );
  }
  // Write only after validating the entire source. Keep v1 untouched as a migration backup.
  if (migrated !== undefined) storage.setItem(COLLECTION_STORAGE_KEY, migrated);
}
