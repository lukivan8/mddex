import { expect, it } from "vitest";
import { compose, composeItemPower, emptyBuild } from "./build.service";
import { equippedSchema } from "./build.types";
const equipment = { itemSlug: "hammer", enchantments: [], effects: [] };
it("sets power independently, preserves it on gear replacement, and leaves the source build untouched", () => {
  const build = emptyBuild();
  build.slots.melee = equipment;
  const next = composeItemPower(build, "melee", 154);
  expect(next.slots.melee?.power).toBe(154);
  expect(build.slots.melee?.power).toBeUndefined();
  expect(next.slots.ranged).toBeNull();
  const replaced = compose(
    next,
    { kind: "item", slot: "melee" },
    {
      slug: "sword",
      category: "melee_weapon",
      type: "swords",
      variation: "Sword",
      image: null,
    },
  );
  expect(replaced.slots.melee?.power).toBe(154);
});
it("rejects powers outside 1–154, fractional values and empty slots", () => {
  const build = emptyBuild();
  build.slots.melee = equipment;
  for (const power of [0, 155, -1, 1.5, NaN, Infinity]) {
    expect(() => composeItemPower(build, "melee", power)).toThrow();
    expect(equippedSchema.safeParse({ ...equipment, power }).success).toBe(
      false,
    );
  }
  expect(() => composeItemPower(build, "ranged", 1)).toThrow("Choose an item");
  expect(equippedSchema.parse(equipment).power).toBeUndefined();
});

it("rejects item power for talismans", () => {
  const build = emptyBuild();
  for (const slot of ["talisman1", "talisman2", "talisman3"] as const) {
    build.slots[slot] = { itemSlug: "talisman", enchantments: [], effects: [] };
    expect(() => composeItemPower(build, slot, 154)).toThrow(
      "Talismans do not have item power",
    );
    expect(build.slots[slot]?.power).toBeUndefined();
  }
});
