import type { CatalogItem } from "../catalog/catalog.types";
import { selectedTier } from "./build.tiers";
import { GEAR_SLOTS, type Build, type ModifierTier } from "./build.types";

export const ENCHANTMENT_POINT_LIMIT = 99;

const COSTS = {
  common: [1, 2, 3],
  rare: [1, 3, 5],
  special: [2, 4, 6],
  unique: [3, 5, 7],
} as const;

const TIER_LEVEL: Partial<Record<ModifierTier, number>> = {
  I: 1,
  II: 2,
  III: 3,
};

export function buildEnchantmentCost(
  build: Build,
  catalog: ReadonlyMap<string, CatalogItem>,
) {
  let points = 0;
  let shards = 0;

  for (const slot of GEAR_SLOTS) {
    const gear = build.slots[slot];
    if (!gear) continue;
    const equipment = catalog.get(gear.itemSlug);
    const effectCount = gear.effects.filter(Boolean).length;
    const costs =
      equipment?.game_data?.unique === true
        ? COSTS.unique
        : effectCount >= 2
          ? COSTS.special
          : effectCount === 1
            ? COSTS.rare
            : COSTS.common;

    for (const slug of gear.enchantments) {
      if (!slug) continue;
      const enchantment = catalog.get(slug);
      const tier =
        (enchantment
          ? selectedTier(enchantment, gear.enchantmentTier)?.tier
          : gear.enchantmentTier) ?? "III";
      const level = TIER_LEVEL[tier];
      if (!level) continue;
      points += costs.slice(0, level).reduce((sum, cost) => sum + cost, 0);
      shards += level;
    }
  }

  return { points, shards, overLimit: points > ENCHANTMENT_POINT_LIMIT };
}
