import type { CatalogItem } from "../catalog/catalog.types";
import { isCompatible } from "./build.compatibility";
import { BUILD_SLOTS, type Build, type BuildTarget } from "./build.types";
export const filledSlots = (build: Build) =>
  BUILD_SLOTS.filter((s) => build.slots[s]).length;
export const resolveItem = (
  slug: string | undefined,
  catalog: ReadonlyMap<string, CatalogItem>,
) => (slug ? catalog.get(slug) : undefined);
export function pickerItems(
  catalog: CatalogItem[],
  target: BuildTarget,
  query: string,
  index: ReadonlyMap<string, string>,
  type = "",
  equipment?: CatalogItem,
) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return catalog
    .filter((item) => {
      if (
        !isCompatible(item, target, equipment) ||
        (type && item.type !== type)
      )
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
