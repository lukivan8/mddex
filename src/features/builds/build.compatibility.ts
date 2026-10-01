import { uniqueEffect } from "./build.unique";
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
const enchantmentSlots: Partial<Record<BuildSlot, string>> = {
  melee: "MeleeWeapon",
  ranged: "RangedWeapon",
  head: "Helmet",
  torso: "Chest",
  legs: "Leggings",
  feet: "Boots",
};
function listedPool(
  equipment: CatalogItem | undefined,
  kind: "effect" | "enchantment",
) {
  const field =
    equipment?.game_data?.[
      kind === "effect" ? "rollable_effects" : "enchantment_options"
    ];
  if (!field || typeof field !== "object" || Array.isArray(field))
    return undefined;
  const entries = (field as Record<string, unknown>)[
    kind === "effect" ? "effects" : "enchantments"
  ];
  if (!Array.isArray(entries)) return undefined;
  // An unresolved or malformed reference is unknown, rather than an empty pool.
  if (
    entries.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        typeof entry.catalog_slug !== "string",
    )
  )
    return undefined;
  return entries.map((entry) => entry.catalog_slug as string);
}
export function isCompatible(
  item: CatalogItem,
  target: BuildTarget,
  equipment?: CatalogItem,
) {
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
    if (target.kind === "enchantment") {
      const slots = item.game_data?.slots;
      if (
        Array.isArray(slots) &&
        slots.length &&
        slots.some((slot) => Object.values(enchantmentSlots).includes(slot)) &&
        !slots.includes(enchantmentSlots[target.slot] ?? "")
      )
        return false;
    }
    const pool = listedPool(equipment, target.kind);
    // Specific published pools take precedence over older broad category labels.
    if (pool !== undefined) return pool.includes(item.slug);
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

export function incompatibleModifiers(
  build: import("./build.types").Build,
  catalog: ReadonlyMap<string, CatalogItem>,
) {
  const issues: string[] = [];
  for (const slot of Object.keys(slotRules) as BuildSlot[]) {
    const gear = build.slots[slot];
    const equipment = gear && catalog.get(gear.itemSlug);
    if (!gear || !equipment) continue;
    const fixed = uniqueEffect(equipment);
    for (const [kind, slugs] of [
      ["effect", gear.effects],
      ["enchantment", gear.enchantments],
    ] as const) {
      slugs.forEach((slug, index) => {
        const modifier = slug ? catalog.get(slug) : undefined;
        if (
          !modifier ||
          (kind === "effect" && index === 0 && slug === fixed?.slug)
        )
          return;
        const target = { kind, slot, index } as BuildTarget;
        if (!isCompatible(modifier, target, equipment))
          issues.push(
            `${modifier.variation} does not fit ${equipment.variation}.`,
          );
      });
    }
  }
  return issues;
}
