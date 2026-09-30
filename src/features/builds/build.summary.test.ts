import { expect, it } from "vitest";
import { emptyBuild } from "./build.service";
import { buildSummary } from "./build.summary";
import type { CatalogItem } from "../catalog/catalog.types";
const item = (slug: string, type: string): CatalogItem => ({
  slug,
  type,
  category: "gear_effect",
  variation: slug,
  image: null,
  description: "Grants X% more damage.",
});
it("groups modifiers and retains original sources and descriptions for aggregation", () => {
  const build = emptyBuild();
  build.slots.melee = {
    itemSlug: "sword",
    effects: ["damage", "damage"],
    enchantments: ["fire"],
  };
  build.slots.artifact1 = {
    itemSlug: "totem",
    effects: ["damage", "unknown"],
    enchantments: [],
  };
  build.slots.talisman1 = { itemSlug: "heart", effects: [], enchantments: [] };
  const catalog = new Map(
    [
      item("damage", "attack"),
      item("fire", "enchantment"),
      item("heart", "talisman"),
    ].map((i) => [i.slug, i]),
  );
  const groups = buildSummary(build, catalog);
  expect(groups.map((g) => g.label)).toEqual([
    "Attack",
    "Other effects",
    "Enchantments",
  ]);
  expect(groups[0].entries).toHaveLength(1);
  expect(groups[0].entries[0].sources).toHaveLength(3);
  expect(groups[0].entries[0].item?.description).toBe("Grants X% more damage.");
  expect(groups[1].entries[0]).toMatchObject({
    slug: "unknown",
    item: undefined,
  });
  build.slots.melee = null;
  expect(buildSummary(build, catalog)[0].entries[0].sources).toHaveLength(1);
});
it("empty builds have no summary entries", () => {
  expect(buildSummary(emptyBuild(), new Map())).toEqual([]);
});
it("equipment descriptions do not create summary effects", () => {
  const build = emptyBuild();
  build.slots.melee = {
    itemSlug: "sword",
    effects: [],
    enchantments: [null],
  };
  const sword = {
    ...item("sword", "swords"),
    category: "melee_weapon",
    description: "A finely crafted sword.",
  };
  expect(buildSummary(build, new Map([[sword.slug, sword]]))).toEqual([]);
});
