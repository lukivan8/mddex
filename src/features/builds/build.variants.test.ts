import { expect, it } from "vitest";
import { createBuildCollections } from "./build.db";
import { composeItemPower, duplicateBuild, emptyBuild } from "./build.service";
import { buildSchema, MAX_BUILD_VARIANTS } from "./build.types";
import {
  addBuildVariant,
  removeBuildVariant,
  selectBuildVariant,
  updateBuildVariant,
} from "./build.variants";
import { decodeBuildLink, encodeBuildLink } from "./build.link";

function seeded() {
  const build = emptyBuild("Grinding");
  build.slots.melee = {
    itemSlug: "hammer",
    power: 100,
    enchantments: ["fire"],
    effects: ["attack", null, null],
    effectTiers: ["III"],
    enchantmentTier: "II",
  };
  return build;
}

it("copies current equipment with a blank name and isolates equipment, power and name edits", () => {
  const base = seeded();
  const { build, variant } = addBuildVariant(base);
  expect(variant.name).toBe("");
  expect(variant.slots).toEqual(base.slots);
  expect(variant.slots.melee).not.toBe(base.slots.melee);
  const edited = updateBuildVariant(build, variant.id, (selected) => ({
    ...composeItemPower(selected, "melee", 154),
    name: "Boss fights",
  }));
  expect(edited.name).toBe("Grinding");
  expect(edited.slots.melee?.power).toBe(100);
  expect(selectBuildVariant(edited, variant.id).name).toBe("Boss fights");
  expect(selectBuildVariant(edited, variant.id).slots.melee?.power).toBe(154);
  const another = addBuildVariant(edited, variant.id);
  expect(another.variant.slots.melee?.power).toBe(154);
  expect(removeBuildVariant(another.build, variant.id).variants).toEqual([
    another.variant,
  ]);
  expect(base.variants).toBeUndefined();
});

it("persists all variants and duplicates them independently", async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  const db = createBuildCollections(storage);
  await db.builds.preload();
  const { build, variant } = addBuildVariant(seeded());
  await db.builds.insert(build).isPersisted.promise;
  const { build: copy, transaction } = duplicateBuild(db, build.id);
  await transaction.isPersisted.promise;
  expect(copy.variants).toEqual(build.variants);
  copy.variants![0].slots.melee!.power = 120;
  expect(db.builds.get(build.id)?.variants?.[0].slots.melee?.power).toBe(100);
  const reloaded = createBuildCollections(storage);
  await reloaded.builds.preload();
  expect(
    selectBuildVariant(reloaded.builds.get(build.id)!, variant.id).slots.melee
      ?.power,
  ).toBe(100);
});

it("shares every variant with names, powers and modifier tiers, including unnamed variants", async () => {
  const { build, variant } = addBuildVariant(seeded());
  const edited = updateBuildVariant(build, variant.id, (selected) => ({
    ...selected,
    name: "Boss fights 🔥",
  }));
  const all = addBuildVariant(edited).build;
  const token = await encodeBuildLink(all);
  expect(token).toMatch(/^2\./);
  const decoded = await decodeBuildLink(token);
  expect(decoded.name).toBe(all.name);
  expect(decoded.slots).toEqual(all.slots);
  expect(decoded.variants?.map(({ name, slots }) => ({ name, slots }))).toEqual(
    all.variants?.map(({ name, slots }) => ({ name, slots })),
  );
  expect(decoded.variants?.[0].id).not.toBe(variant.id);
  expect(buildSchema.parse(decoded)).toEqual(decoded);
});

it("bounds variant counts and still accepts existing saved builds", () => {
  expect(buildSchema.parse(seeded()).variants).toBeUndefined();
  let build = seeded();
  for (let index = 1; index < MAX_BUILD_VARIANTS; index++)
    build = addBuildVariant(build).build;
  expect(() => addBuildVariant(build)).toThrow("up to 8");
  expect(
    buildSchema.safeParse({
      ...build,
      variants: [...build.variants!, build.variants![0]],
    }).success,
  ).toBe(false);
});

it("rejects duplicate or reserved variant IDs", () => {
  const { build, variant } = addBuildVariant(seeded());
  expect(
    buildSchema.safeParse({ ...build, variants: [variant, variant] }).success,
  ).toBe(false);
  expect(
    buildSchema.safeParse({ ...build, variants: [{ ...variant, id: "base" }] })
      .success,
  ).toBe(false);
});
