import { expect, it } from "vitest";
import type { CatalogItem } from "../catalog/catalog.types";
import { buildEnchantmentCost } from "./build.cost";
import { emptyBuild } from "./build.service";
import { GEAR_SLOTS, type ModifierTier } from "./build.types";

const special: CatalogItem = {
  slug: "special",
  category: "armor",
  type: "chest",
  variation: "Special armor",
  image: null,
};
const unique: CatalogItem = {
  ...special,
  slug: "unique",
  variation: "Unique armor",
  game_data: { unique: true },
};
const enchantment: CatalogItem = {
  slug: "enchant",
  category: "enchantment",
  type: "defense",
  variation: "Enchantment",
  image: null,
  game_data: {
    tiers: ["I", "II", "III"].map((tier) => ({
      tier,
      text: `Tier ${tier}`,
      talisman: false,
    })),
  },
};
const catalog = new Map(
  [special, unique, enchantment].map((item) => [item.slug, item]),
);

function withEnchantment(
  slot: (typeof GEAR_SLOTS)[number],
  itemSlug: string,
  tier?: ModifierTier,
) {
  const build = emptyBuild();
  build.slots[slot] = {
    itemSlug,
    enchantments: [enchantment.slug],
    effects: [],
    enchantmentTier: tier,
  };
  return build;
}

it("adds cumulative point costs and one shard per level for each rarity", () => {
  const build = withEnchantment("melee", unique.slug, "III");
  build.slots.torso = withEnchantment("torso", special.slug, "II").slots.torso;
  build.slots.torso!.effects = ["effect-one", "effect-two"];
  expect(buildEnchantmentCost(build, catalog)).toEqual({
    points: 21, // Unique 3+5+7; Special 2+4
    shards: 5,
    overLimit: false,
  });
});

it("infers Common, Rare, and Special costs from selected effects", () => {
  const build = withEnchantment("feet", special.slug);
  expect(buildEnchantmentCost(build, catalog)).toEqual({
    points: 6,
    shards: 3,
    overLimit: false,
  });
  build.slots.feet!.effects = ["effect-one"];
  expect(buildEnchantmentCost(build, catalog).points).toBe(9);
  build.slots.feet!.effects.push("effect-two");
  expect(buildEnchantmentCost(build, catalog).points).toBe(12);
  build.slots.feet!.enchantments = [null];
  expect(buildEnchantmentCost(build, catalog).points).toBe(0);
});

it("flags costs above 99 points without capping the shard count", () => {
  const build = emptyBuild();
  for (const slot of GEAR_SLOTS)
    build.slots[slot] = withEnchantment(slot, unique.slug, "III").slots[slot];
  expect(buildEnchantmentCost(build, catalog)).toEqual({
    points: 90,
    shards: 18,
    overLimit: false,
  });
  // An extra selection represents future loadouts with more enchantable slots.
  build.slots.melee!.enchantments.push(enchantment.slug);
  expect(buildEnchantmentCost(build, catalog)).toEqual({
    points: 105,
    shards: 21,
    overLimit: true,
  });
});
