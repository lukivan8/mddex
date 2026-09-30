import type { CatalogItem } from "../catalog/catalog.types";
import { availableTiers } from "./build.tiers";
import {
  supportsEffects,
  type BuildSlot,
  type BuildTarget,
} from "./build.types";
export const slotRules: Record<
  BuildSlot,
  { category: string; type?: string; label: string }
> = {
  melee: { category: "melee_weapon", label: "Melee weapon" },
  ranged: { category: "ranged_weapon", label: "Ranged weapon" },
  head: { category: "armor", type: "head", label: "Helmet" },
  torso: { category: "armor", type: "torso", label: "Chest" },
  legs: { category: "armor", type: "legs", label: "Leggings" },
  feet: { category: "armor", type: "feet", label: "Boots" },
  artifact1: { category: "artifact", label: "Artifact 1" },
  artifact2: { category: "artifact", label: "Artifact 2" },
  artifact3: { category: "artifact", label: "Artifact 3" },
  talisman1: { category: "talisman", label: "Talisman 1" },
  talisman2: { category: "talisman", label: "Talisman 2" },
  talisman3: { category: "talisman", label: "Talisman 3" },
};
export function isCompatible(item: CatalogItem, target: BuildTarget) {
  if (target.kind !== "item") {
    if (target.kind === "effect" && !supportsEffects(target.slot)) return false;
    if (
      item.category !==
      (target.kind === "effect" ? "gear_effect" : "enchantment")
    )
      return false;
    if (
      target.kind === "effect" &&
      Array.isArray(item.game_data?.tiers) &&
      item.game_data.tiers.length &&
      !availableTiers(item, slotRules[target.slot].category).length
    )
      return false;
    const categories = item.applicable_categories;
    // Missing metadata is unknown, not evidence of incompatibility.
    return (
      !categories?.length ||
      categories.some(
        (category) => category === slotRules[target.slot].category,
      )
    );
  }
  const rule = slotRules[target.slot];
  return (
    item.category === rule.category && (!rule.type || item.type === rule.type)
  );
}
