import { describe, expect, it } from "vitest";
import { buildSearchIndex } from "../catalog/catalog.helpers";
import type { CatalogItem } from "../catalog/catalog.types";
import { createBuildCollections, BUILDS_STORAGE_KEY } from "./build.db";
import {
  activeBuild,
  filledSlots,
  pickerItems,
  resolveItem,
} from "./build.selectors";
import {
  compose,
  createBuild,
  emptyBuild,
  equip,
  renameBuild,
  setWorkspace,
} from "./build.service";
import { BUILD_SLOTS, type BuildSlot } from "./build.types";
import { isCompatible } from "./build.compatibility";
const item = (
  slug: string,
  category: string,
  type = category,
): CatalogItem => ({ slug, category, type, variation: slug, image: null });
const catalog = [
  item("Hammer", "melee_weapon", "hammers"),
  item("Sword", "melee_weapon", "swords"),
  item("Bow", "ranged_weapon", "bows"),
  ...["head", "torso", "legs", "feet"].map((t) => item(t, "armor", t)),
  item("Totem", "artifact"),
  item("Charm", "talisman"),
  item("Fire", "enchantment"),
  item("Ice", "enchantment"),
];
const storage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
};
describe("local builds", () => {
  it("creates exactly 12 empty positions without catalog metadata", () => {
    const b = emptyBuild();
    expect(Object.keys(b.slots)).toEqual([...BUILD_SLOTS]);
    expect(filledSlots(b)).toBe(0);
    expect(b.name).toBe("Untitled loadout");
  });
  it.each<[BuildSlot, string]>([
    ["melee", "Hammer"],
    ["ranged", "Bow"],
    ["head", "head"],
    ["torso", "torso"],
    ["legs", "legs"],
    ["feet", "feet"],
    ["artifact1", "Totem"],
    ["artifact2", "Totem"],
    ["artifact3", "Totem"],
    ["talisman1", "Charm"],
    ["talisman2", "Charm"],
    ["talisman3", "Charm"],
  ])("filters %s by canonical category/type", (slot, slug) => {
    const matches = catalog
      .filter((i) => isCompatible(i, { kind: "item", slot }))
      .map((i) => i.slug);
    expect(matches).toContain(slug);
    expect(matches).toEqual(slot === "melee" ? ["Hammer", "Sword"] : [slug]);
  });
  it("equips, replaces, clears, and keeps enchantments attached to exact positions", () => {
    let b = compose(emptyBuild(), { kind: "item", slot: "melee" }, catalog[0]);
    b = compose(b, { kind: "item", slot: "head" }, catalog[3]);
    b = compose(b, { kind: "enchantment", slot: "head", index: 1 }, catalog[9]);
    expect(b.slots.head?.enchantments).toEqual([null, "Fire", null]);
    expect(b.slots.melee?.enchantments).toEqual([null, null, null]);
    b = compose(
      b,
      { kind: "enchantment", slot: "head", index: 1 },
      catalog[10],
    );
    expect(b.slots.head?.enchantments[1]).toBe("Ice");
    b = compose(b, { kind: "enchantment", slot: "head", index: 1 }, null);
    expect(b.slots.head?.enchantments[1]).toBeNull();
    b = compose(b, { kind: "item", slot: "melee" }, catalog[1]);
    expect(b.slots.melee?.itemSlug).toBe("Sword");
    b = compose(b, { kind: "item", slot: "melee" }, null);
    expect(b.slots.melee).toBeNull();
    expect(() =>
      compose(b, { kind: "item", slot: "head" }, catalog[0]),
    ).toThrow();
    expect(() =>
      compose(b, { kind: "enchantment", slot: "melee", index: 0 }, catalog[9]),
    ).toThrow();
    expect(() =>
      compose(b, { kind: "enchantment", slot: "head", index: 3 }, catalog[9]),
    ).toThrow();
  });
  it("uses collection availability independently of spoiler preference; never changes equipped state", () => {
    const records = new Map([
      ["Hammer", { itemSlug: "Hammer", owned: false, discovered: true }],
      ["Sword", { itemSlug: "Sword", owned: true, discovered: true }],
    ]);
    const target = { kind: "item", slot: "melee" } as const;
    const index = buildSearchIndex(catalog);
    expect(
      pickerItems(catalog, records, target, "owned", "", index).map(
        (i) => i.slug,
      ),
    ).toEqual(["Sword"]);
    expect(
      pickerItems(catalog, records, target, "discovered", "", index).map(
        (i) => i.slug,
      ),
    ).toEqual(["Hammer", "Sword"]);
    expect(
      pickerItems(catalog, new Map(), target, "all", "HAM", index).map(
        (i) => i.slug,
      ),
    ).toEqual(["Hammer"]);
    expect(
      pickerItems(catalog, new Map(), target, "discovered", "Hammer", index),
    ).toEqual([]);
    expect(
      pickerItems(
        catalog,
        records,
        target,
        "discovered",
        "",
        index,
        "swords",
      ).map((i) => i.slug),
    ).toEqual(["Sword"]);
    const b = compose(emptyBuild(), target, catalog[0]);
    records.clear();
    expect(b.slots.melee?.itemSlug).toBe("Hammer");
    expect(
      pickerItems(
        catalog,
        records,
        { kind: "enchantment", slot: "melee", index: 0 },
        "all",
        "enchantment",
        index,
      ),
    ).toEqual([]);
    expect(
      pickerItems(
        catalog,
        records,
        { kind: "enchantment", slot: "melee", index: 0 },
        "all",
        "fi",
        index,
      ).map((i) => i.slug),
    ).toEqual(["Fire"]);
  });
  it("autosaves creation, switching, preferences, renaming and gear across reload", async () => {
    const local = storage();
    let db = createBuildCollections(local);
    await Promise.all([db.builds.preload(), db.preferences.preload()]);
    const a = createBuild(db, "First");
    await a.transaction.isPersisted.promise;
    const b = createBuild(db, "Second");
    await b.transaction.isPersisted.promise;
    await setWorkspace(db, { activeId: a.build.id, availability: "all" })
      .isPersisted.promise;
    await equip(db, a.build.id, { kind: "item", slot: "melee" }, catalog[0])
      .isPersisted.promise;
    await equip(
      db,
      a.build.id,
      { kind: "enchantment", slot: "melee", index: 2 },
      catalog[9],
    ).isPersisted.promise;
    await renameBuild(db, a.build.id, "Renamed").isPersisted.promise;
    await db.builds.cleanup();
    await db.preferences.cleanup();
    db = createBuildCollections(local);
    await Promise.all([db.builds.preload(), db.preferences.preload()]);
    const saved = activeBuild(
      [...db.builds.values()],
      db.preferences.get("workspace")?.activeId,
    )!;
    expect(saved.name).toBe("Renamed");
    expect(saved.slots.melee?.enchantments[2]).toBe("Fire");
    expect(db.preferences.get("workspace")?.availability).toBe("all");
    await setWorkspace(db, { activeId: b.build.id }).isPersisted.promise;
    expect(
      activeBuild(
        [...db.builds.values()],
        db.preferences.get("workspace")?.activeId,
      )?.name,
    ).toBe("Second");
    expect(resolveItem(saved.slots.melee!.itemSlug, new Map())).toBeUndefined();
    expect(filledSlots(saved)).toBe(1);
    expect(local.getItem(BUILDS_STORAGE_KEY)).not.toContain("variation");
    await db.builds.cleanup();
    await db.preferences.cleanup();
  });
  it("preserves corrupt saved data rather than replacing it", () => {
    const local = storage();
    local.setItem(BUILDS_STORAGE_KEY, "broken");
    expect(() => createBuildCollections(local)).toThrow("preserved");
    expect(local.getItem(BUILDS_STORAGE_KEY)).toBe("broken");
  });
});
