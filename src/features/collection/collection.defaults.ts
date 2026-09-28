import type { CompletionRecord } from "./collection.types";

const defaultDiscovered = new Set([
  "melee_weapon-sword",
  "ranged_weapon-bow",
]);

export const isDiscovered = (
  itemSlug: string,
  entry?: CompletionRecord,
) => defaultDiscovered.has(itemSlug) || (entry?.discovered ?? false);
