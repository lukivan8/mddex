import { expect, it } from "vitest";
import { normalizeDetailItem } from "./catalog-detail.loader";
import { dropSources } from "./catalog-detail.model";

// Published Sorcerer Hat/Alchemist Top Hat odds for Ravines.
const outcomes = [
  { drop_source: "regular_enemy", unique: 0.05 },
  { drop_source: "wooden_chest", unique: 0.067 },
  { drop_source: "fancy_chest", unique: 0.1 },
  { drop_source: "miniboss", unique: 0.1 },
];
function gear(unique: boolean, changes: Record<string, unknown> = {}) {
  const slug = unique ? "armor-head-alchemist-hat" : "armor-sorcerer-hat";
  return normalizeDetailItem({
    slug,
    category: "armor",
    type: "head",
    variation: unique ? "Alchemist Top Hat" : "Sorcerer Hat",
    image: null,
    game_data: {
      sources: [
        { type: "area", name: "Ravines", catalog_slug: "location-ravines" },
      ],
      acquisition: {
        sources: [
          {
            type: "dungeon",
            name: "Unknown Dungeon",
            condition: unique
              ? "When Sorcerer Hat drops with Unique rarity"
              : undefined,
          },
          { type: "merchant", name: "Town Merchant" },
        ],
      },
      drop_chances: {
        schema_version: 1,
        item_catalog_slug: slug,
        variant: unique ? "unique" : "base_non_unique",
        sources: [
          {
            type: "area",
            name: "Ravines",
            catalog_slug: "location-ravines",
            base_item: { name: "Sorcerer Hat" },
            pool_share: { probability: 0.01 },
            source_url:
              "https://metabot.gg/en/minecraft-dungeons-2/uniques/drop-calculator",
            outcomes: outcomes.map(({ drop_source, unique: chance }) => ({
              drop_source,
              rarity: unique ? "unique" : "any_non_unique",
              probability: 0.01 * (unique ? chance : 1 - chance),
              rarity_given_base: unique ? chance : 1 - chance,
              easy_probability: 0,
              denominator:
                "One gear/item drop from this source, not one kill or one chest opening.",
              conditions: {
                difficulty: ["normal", "hard"],
                threat_level: null,
              },
            })),
          },
        ],
        // These ratios are not verified final item odds and must never be composed.
        rarity_rules: {
          wikily: {
            threat_weights: [
              { threat_level: 20, normalized_weight_share: { unique: 1 / 3 } },
            ],
          },
        },
        ...changes,
      },
    },
  });
}
it("shows an arithmetic average of the known source odds", () => {
  const sources = dropSources(gear(false), []);
  expect(sources[0].dropChance?.text).toBe("≈0.92% average");
  expect(sources[0].dropChance?.sourceUrl).toContain("metabot.gg");
  expect(sources[1]).not.toHaveProperty("dropChance");
  expect(sources[2]).not.toHaveProperty("dropChance");
});
it("distinguishes base-pool chance from unique conversion without stacking threat weights", () => {
  expect(dropSources(gear(true), [])[0].dropChance?.text).toBe(
    "As Sorcerer Hat (≈1%)",
  );
});
it("keeps unique source chances for one shared explanation", () => {
  expect(dropSources(gear(true), [])[0].dropChance?.uniqueRolls).toEqual([
    "regular enemies: 5%",
    "wooden chests: 6.7%",
    "fancy chests: 10%",
    "minibosses: 10%",
  ]);
});
it("removes only the duplicate base-variant note and preserves other conditions", () => {
  const item = gear(true);
  item.game_data.sources[0].description =
    "Unique rarity variant of Sorcerer Hat During a storm";
  expect(dropSources(item, [])[0].description).toBe("During a storm");
  expect(dropSources(item, [])[1].description).toBeUndefined();
});
it("does not use another item's rates or conflicting source claims", () => {
  for (const changes of [
    { item_catalog_slug: "other" },
    { source_conflicts: [{ message: "Conflicting odds" }] },
    { schema_version: 2 },
  ])
    expect(
      dropSources(gear(true, changes), []).every(
        (source) => !source.dropChance,
      ),
    ).toBe(true);
});
it("leaves rates absent when source probabilities or their basis are unavailable", () => {
  for (const outcome of [
    { probability: null },
    { probability: -1 },
    { probability: 2 },
    { probability: 0.01, denominator: "Per kill" },
    {
      probability: 0.01,
      denominator: "One gear/item drop",
      conditions: { difficulty: ["easy"] },
    },
  ]) {
    const item = gear(false, {
      sources: [
        { type: "area", catalog_slug: "location-ravines", outcomes: [outcome] },
      ],
    });
    expect(dropSources(item, [])[0]).not.toHaveProperty("dropChance");
  }
});
