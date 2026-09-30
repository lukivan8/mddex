import { describe, expect, it } from "vitest";
import { compose, emptyBuild, equip, createBuild } from "./build.service";
import { composeSelection } from "./build.selection";
import {
  createBuildCollections,
  BUILDS_STORAGE_KEY,
  LEGACY_BUILDS_STORAGE_KEY,
  PREVIOUS_BUILDS_STORAGE_KEY,
} from "./build.db";
import { isCompatible } from "./build.compatibility";
import { buildSchema } from "./build.types";
import type { CatalogItem } from "../catalog/catalog.types";
const weapon: CatalogItem = {
  slug: "weapon",
  category: "melee_weapon",
  type: "swords",
  variation: "Weapon",
  image: null,
};
const effect = (
  slug: string,
  categories?: CatalogItem["applicable_categories"],
): CatalogItem => ({
  slug,
  category: "gear_effect",
  type: "attack",
  variation: slug,
  image: null,
  applicable_categories: categories,
  description: "All critical hits deal X% more damage.",
});
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
}
describe("gear modifiers", () => {
  it("migrates three-effect saves without changing other build data and keeps the v2 backup", async () => {
    const local = storage();
    const old = emptyBuild("Existing build");
    old.slots.melee = {
      itemSlug: "weapon",
      enchantments: ["enchant"],
      effects: ["first", null, "third"],
    };
    old.slots.artifact1 = {
      itemSlug: "artifact",
      enchantments: [],
      effects: ["one", "two", "three"],
    };
    const original = JSON.stringify({
      ["s:" + old.id]: { versionKey: "previous", data: old },
    });
    local.setItem(PREVIOUS_BUILDS_STORAGE_KEY, original);
    const db = createBuildCollections(local);
    await db.builds.preload();
    const migrated = buildSchema.parse(db.builds.get(old.id));
    expect(migrated).toEqual(old);
    expect(local.getItem(PREVIOUS_BUILDS_STORAGE_KEY)).toBe(original);
    await db.builds.cleanup();
    await db.preferences.cleanup();
    const reloaded = createBuildCollections(local);
    await reloaded.builds.preload();
    expect(buildSchema.parse(reloaded.builds.get(old.id))).toEqual(migrated);
    await reloaded.builds.cleanup();
    await reloaded.preferences.cleanup();
  });
  it("preserves unreadable v2 saves without falling back to older data", () => {
    const local = storage();
    local.setItem(PREVIOUS_BUILDS_STORAGE_KEY, "broken");
    local.setItem(LEGACY_BUILDS_STORAGE_KEY, "{}");
    expect(() => createBuildCollections(local)).toThrow("preserved");
    expect(local.getItem(PREVIOUS_BUILDS_STORAGE_KEY)).toBe("broken");
    expect(local.getItem(BUILDS_STORAGE_KEY)).toBeNull();
  });
  it("allows one enchantment and three effects independently; clears with the item", () => {
    let build = compose(emptyBuild(), { kind: "item", slot: "melee" }, weapon);
    const enchantment = { ...effect("enchant"), category: "enchantment" };
    build = compose(
      build,
      { kind: "enchantment", slot: "melee", index: 0 },
      enchantment,
    );
    for (const slug of ["a", "b", "c"])
      build = composeSelection(
        build,
        { kind: "effect", slot: "melee", index: 0 },
        effect(slug),
      );
    expect(build.slots.melee?.effects).toEqual(["a", "b", "c"]);
    expect(build.slots.melee?.enchantments).toEqual(["enchant"]);
    expect(() =>
      compose(
        build,
        { kind: "enchantment", slot: "melee", index: 1 },
        enchantment,
      ),
    ).toThrow();
    expect(() =>
      compose(build, { kind: "effect", slot: "melee", index: 3 }, effect("d")),
    ).toThrow();
    expect(() =>
      composeSelection(
        build,
        { kind: "effect", slot: "melee", index: 0 },
        effect("d"),
      ),
    ).toThrow("All 3 slots");
    expect(
      compose(build, { kind: "item", slot: "melee" }, null).slots.melee,
    ).toBeNull();
  });
  it("supports artifact effects, excludes talismans and respects known compatibility without inferring from groups", () => {
    let build = compose(
      emptyBuild(),
      { kind: "item", slot: "artifact1" },
      { ...weapon, category: "artifact" },
    );
    build = compose(
      build,
      { kind: "effect", slot: "artifact1", index: 0 },
      effect("artifact", ["artifact"]),
    );
    expect(build.slots.artifact1?.effects[0]).toBe("artifact");
    expect(build.slots.artifact1?.enchantments).toEqual([]);
    expect(
      isCompatible(effect("unknown"), {
        kind: "effect",
        slot: "head",
        index: 0,
      }),
    ).toBe(true);
    expect(
      isCompatible(effect("weapon-only", ["melee_weapon"]), {
        kind: "effect",
        slot: "head",
        index: 0,
      }),
    ).toBe(false);
    expect(
      isCompatible(effect("unknown"), {
        kind: "effect",
        slot: "talisman1",
        index: 0,
      }),
    ).toBe(false);
    expect(
      isCompatible(effect("unknown"), {
        kind: "enchantment",
        slot: "melee",
        index: 0,
      }),
    ).toBe(false);
  });
  it("migrates old loadouts to the first selected enchantment and preserves original data", async () => {
    const local = storage();
    const build = emptyBuild();
    const legacyBuild = {
      ...build,
      slots: {
        ...build.slots,
        melee: { itemSlug: "weapon", enchantments: [null, "second", "third"] },
      },
    };
    const original = JSON.stringify({
      ["s:" + build.id]: { versionKey: "legacy", data: legacyBuild },
    });
    local.setItem(LEGACY_BUILDS_STORAGE_KEY, original);
    const db = createBuildCollections(local);
    await db.builds.preload();
    expect(db.builds.get(build.id)?.slots.melee).toEqual({
      itemSlug: "weapon",
      enchantments: ["second"],
      effects: [null, null, null],
    });
    expect(local.getItem(LEGACY_BUILDS_STORAGE_KEY)).toBe(original);
    expect(local.getItem(BUILDS_STORAGE_KEY)).not.toBeNull();
    await db.builds.cleanup();
    await db.preferences.cleanup();
  });
  it("persists effect references across reload without storing definitions", async () => {
    const local = storage();
    let db = createBuildCollections(local);
    await db.builds.preload();
    const created = createBuild(db);
    await created.transaction.isPersisted.promise;
    await equip(db, created.build.id, { kind: "item", slot: "melee" }, weapon)
      .isPersisted.promise;
    await equip(
      db,
      created.build.id,
      { kind: "effect", slot: "melee", index: 0 },
      effect("crit"),
    ).isPersisted.promise;
    await db.builds.cleanup();
    await db.preferences.cleanup();
    db = createBuildCollections(local);
    await db.builds.preload();
    expect(db.builds.get(created.build.id)?.slots.melee?.effects[0]).toBe(
      "crit",
    );
    expect(local.getItem(BUILDS_STORAGE_KEY)).not.toContain("description");
    await db.builds.cleanup();
    await db.preferences.cleanup();
  });
  it("preserves corrupt legacy data without creating a partial migration", () => {
    const local = storage();
    local.setItem(LEGACY_BUILDS_STORAGE_KEY, "broken");
    expect(() => createBuildCollections(local)).toThrow("preserved");
    expect(local.getItem(BUILDS_STORAGE_KEY)).toBeNull();
    expect(local.getItem(LEGACY_BUILDS_STORAGE_KEY)).toBe("broken");
  });
});
