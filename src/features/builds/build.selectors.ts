import type { CatalogItem } from "../catalog/catalog.types";
import type { CompletionRecord } from "../collection/collection.types";
import { isDiscovered } from "../collection/collection.defaults";
import { isCollected } from "../collection/collection.presentation";
import { isCompatible } from "./build.compatibility";
import {
  BUILD_SLOTS,
  type Availability,
  type Build,
  type BuildTarget,
} from "./build.types";
export const filledSlots = (build: Build) =>
  BUILD_SLOTS.filter((s) => build.slots[s]).length;
export const resolveItem = (
  slug: string | undefined,
  catalog: ReadonlyMap<string, CatalogItem>,
) => (slug ? catalog.get(slug) : undefined);
export function pickerItems(
  catalog: CatalogItem[],
  records: ReadonlyMap<string, CompletionRecord>,
  target: BuildTarget,
  availability: Availability,
  query: string,
  index: ReadonlyMap<string, string>,
  type = "",
) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return catalog
    .filter((item) => {
      if (!isCompatible(item, target) || (type && item.type !== type))
        return false;
      const record = records.get(item.slug);
      if (availability === "owned" && !isCollected(record)) return false;
      if (availability !== "all" && !isDiscovered(item.slug, record))
        return false;
      const text =
        target.kind === "enchantment"
          ? item.variation.toLowerCase()
          : (index.get(item.slug) ?? "");
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => a.variation.localeCompare(b.variation));
}
export const activeBuild = (builds: Build[], id?: string | null) =>
  builds.find((b) => b.id === id) ?? builds[0];
