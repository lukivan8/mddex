import type { CatalogItem } from "../catalog/catalog.types";
import type { BuildSlot, BuildTarget } from "./build.types";
export const slotRules: Record<
  BuildSlot,
  { category: string; type?: string; label: string }
> = {
  melee: { category: "melee_weapon", label: "Melee weapon" },
  ranged: { category: "ranged_weapon", label: "Ranged weapon" },
  head: { category: "armor", type: "head", label: "Head armor" },
  torso: { category: "armor", type: "torso", label: "Torso armor" },
  legs: { category: "armor", type: "legs", label: "Leg armor" },
  feet: { category: "armor", type: "feet", label: "Feet armor" },
  artifact1: { category: "artifact", label: "Artifact 1" },
  artifact2: { category: "artifact", label: "Artifact 2" },
  artifact3: { category: "artifact", label: "Artifact 3" },
  talisman1: { category: "talisman", label: "Talisman 1" },
  talisman2: { category: "talisman", label: "Talisman 2" },
  talisman3: { category: "talisman", label: "Talisman 3" },
};
export function isCompatible(item: CatalogItem, target: BuildTarget) {
  if (target.kind === "enchantment") return item.category === "enchantment";
  const rule = slotRules[target.slot];
  return (
    item.category === rule.category && (!rule.type || item.type === rule.type)
  );
}
