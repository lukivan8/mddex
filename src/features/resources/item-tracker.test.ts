import { expect, it } from "vitest";
import type { CatalogItem } from "../catalog/catalog.types";
import {
  familyKeys,
  cycleTrackerItem,
  markKey,
  parseTrackerSave,
  trackerFamilies,
  trackerMarks,
  trackerProgress,
  setTrackerMark,
  trackerPreviewMarks,
  upgradeTrackerSave,
} from "./item-tracker";
const base: CatalogItem = {
  slug: "sword",
  variation: "Sword",
  category: "melee_weapon",
  type: "swords",
  image: null,
  game_data: {
    rarities: ["common", "rare", "special", "unique"],
    uniqueVariant: { catalog_slug: "unique-sword" },
  },
};
const unique: CatalogItem = {
  ...base,
  slug: "unique-sword",
  variation: "Burning Blade",
  game_data: {
    unique: true,
    rarities: ["unique"],
    base: { catalog_slug: "sword" },
  },
};
it("pairs base gear with uniques without tracking the base's unique rarity twice", () => {
  const families = trackerFamilies([unique, base], "melee_weapon");
  expect(families).toEqual([{ id: "sword", base, unique }]);
  expect(trackerMarks(base)).toEqual([
    "common",
    "rare",
    "special",
    "soul_special",
  ]);
  expect(trackerMarks(unique)).toEqual(["unique", "soul_unique"]);
  expect(familyKeys(families[0])).toHaveLength(6);
});
it("keeps unpaired uniques and excludes unavailable items and reference definitions", () => {
  const hidden = {
    ...base,
    slug: "hidden",
    game_data: { availability: "unavailable" },
  };
  const effect = { ...base, slug: "fire", category: "gear_effect" };
  expect(trackerFamilies([unique, hidden, effect], "melee_weapon")).toEqual([
    { id: unique.slug, base: undefined, unique },
  ]);
});
it("tracks artifact rarities and talisman collection separately from soul variants", () => {
  expect(
    trackerMarks({
      ...base,
      category: "artifact",
      game_data: { rarities: ["rare", "special"] },
    }),
  ).toEqual(["rare", "special"]);
  expect(trackerMarks({ ...base, category: "talisman" })).toEqual([
    "collected",
  ]);
});
it("counts independent marks once and validates persisted progress", () => {
  const key = markKey(base, "soul");
  const collected = parseTrackerSave(
    JSON.stringify({ version: 1, collected: [key, key, "other:soul"] }),
  );
  expect(trackerProgress([key, key, markKey(base, "rare")], collected)).toEqual(
    { count: 1, total: 2 },
  );
  expect(parseTrackerSave(null).size).toBe(0);
  expect(() => parseTrackerSave('{"version":1,"collected":[4]}')).toThrow();
  expect(() => parseTrackerSave('{"version":3,"collected":[]}')).toThrow();
});

it("selects lower rarities and deselects only the chosen rarity", () => {
  const initial = new Set([markKey(base, "soul"), markKey(unique, "unique")]);
  const selected = setTrackerMark(initial, base, "special", true);
  expect(
    ["common", "rare", "special"].every((mark) =>
      selected.has(`${base.slug}:${mark}`),
    ),
  ).toBe(true);
  const removed = setTrackerMark(selected, base, "rare", false);
  expect([...removed].sort()).toEqual(
    [
      markKey(base, "common"),
      markKey(base, "special"),
      markKey(base, "soul"),
      markKey(unique, "unique"),
    ].sort(),
  );
  expect(trackerPreviewMarks(base, "special")).toEqual([
    "common",
    "rare",
    "special",
  ]);
  expect(trackerPreviewMarks(base, "soul")).toEqual([]);
  expect(
    parseTrackerSave(
      JSON.stringify({ version: 1, collected: ["sword:special"] }),
    ),
  ).toEqual(new Set(["sword:common", "sword:rare", "sword:special"]));
});

it("soul variants satisfy Special or Unique and migrate older soul saves", () => {
  const selected = setTrackerMark(new Set(), base, "soul_special", true);
  expect(selected).toEqual(
    new Set(
      ["common", "rare", "special", "soul_special"].map(
        (mark) => `${base.slug}:${mark}`,
      ),
    ),
  );
  expect(setTrackerMark(selected, base, "rare", false)).toEqual(
    new Set([
      markKey(base, "common"),
      markKey(base, "special"),
      markKey(base, "soul_special"),
    ]),
  );
  expect(trackerPreviewMarks(base, "soul_special")).toEqual([
    "common",
    "rare",
    "special",
    "soul_special",
  ]);
  const uniqueSelected = setTrackerMark(new Set(), unique, "soul_unique", true);
  expect(uniqueSelected).toEqual(
    new Set([markKey(unique, "unique"), markKey(unique, "soul_unique")]),
  );
  expect(setTrackerMark(uniqueSelected, unique, "unique", false)).toEqual(
    new Set([markKey(unique, "soul_unique")]),
  );
  const migrated = upgradeTrackerSave(
    new Set([markKey(base, "soul"), markKey(unique, "soul")]),
    [base, unique],
  );
  expect(migrated).toEqual(new Set([...selected, ...uniqueSelected]));
  expect(
    parseTrackerSave(
      JSON.stringify({ version: 2, collected: [markKey(base, "soul_rare")] }),
    ),
  ).toEqual(selected);
});

it("cycles cards through cumulative rarities then clears only that item", () => {
  let saved = new Set([markKey(unique, "unique")]);
  for (const mark of ["common", "rare", "special", "soul_special"] as const) {
    saved = cycleTrackerItem(saved, base);
    expect(saved.has(markKey(base, mark))).toBe(true);
    expect(saved.has(markKey(unique, "unique"))).toBe(true);
  }
  saved = cycleTrackerItem(saved, base);
  expect(
    trackerMarks(base).every((mark) => !saved.has(markKey(base, mark))),
  ).toBe(true);
  saved = cycleTrackerItem(saved, unique);
  expect(saved.has(markKey(unique, "soul_unique"))).toBe(true);
  saved = cycleTrackerItem(saved, unique);
  expect(saved.size).toBe(0);
});

it("tracks enchantments individually with one collected mark", () => {
  const enchant = {
    ...base,
    category: "enchantment",
    game_data: { unique: true },
  };
  expect(trackerMarks(enchant)).toEqual(["collected"]);
  expect(trackerFamilies([enchant], "enchantment")).toEqual([
    { id: enchant.slug, base: enchant },
  ]);
  const checked = cycleTrackerItem(new Set(), enchant);
  expect(checked.has(markKey(enchant, "collected"))).toBe(true);
  expect(
    parseTrackerSave(JSON.stringify({ version: 2, collected: [...checked] })),
  ).toEqual(checked);
  expect(cycleTrackerItem(checked, enchant).size).toBe(0);
});

it("preserves individually unchecked tiers in saves and soul upgrades", () => {
  let checked = setTrackerMark(new Set(), base, "soul_special", true);
  checked = setTrackerMark(checked, base, "common", false);
  checked = setTrackerMark(checked, base, "rare", false);
  expect(checked).toEqual(
    new Set([markKey(base, "special"), markKey(base, "soul_special")]),
  );
  const restored = parseTrackerSave(
    JSON.stringify({ version: 2, collected: [...checked] }),
  );
  expect(restored).toEqual(checked);
  expect(upgradeTrackerSave(restored, [base])).toEqual(checked);
});

it("auto-selects earlier tiers only for an empty item, then changes individual checks", () => {
  const commonOnly = setTrackerMark(new Set(), base, "common", true);
  expect(setTrackerMark(commonOnly, base, "special", true)).toEqual(
    new Set([markKey(base, "common"), markKey(base, "special")]),
  );
  const initial = setTrackerMark(
    new Set([markKey(unique, "unique")]),
    base,
    "special",
    true,
  );
  expect(initial.has(markKey(base, "common"))).toBe(true);
  expect(initial.has(markKey(base, "rare"))).toBe(true);
  let dirty = setTrackerMark(initial, base, "common", false);
  dirty = setTrackerMark(dirty, base, "rare", false);
  dirty = setTrackerMark(dirty, base, "soul_special", true);
  expect(dirty).toEqual(
    new Set([
      markKey(unique, "unique"),
      markKey(base, "special"),
      markKey(base, "soul_special"),
    ]),
  );
  expect(trackerPreviewMarks(base, "soul_special", dirty)).toEqual([
    "soul_special",
  ]);
  dirty = setTrackerMark(dirty, base, "rare", true);
  expect(dirty.has(markKey(base, "rare"))).toBe(true);
  expect(dirty.has(markKey(base, "common"))).toBe(false);
  expect(
    parseTrackerSave(JSON.stringify({ version: 2, collected: [...dirty] })),
  ).toEqual(dirty);
});
