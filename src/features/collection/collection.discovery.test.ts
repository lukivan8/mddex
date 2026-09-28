import { describe, expect, it } from "vitest";
import {
  createCompletionCollection,
  COLLECTION_STORAGE_KEY,
} from "./collection.db";
import { LEGACY_COLLECTION_STORAGE_KEY } from "./collection.migration";
import {
  createPreferencesCollection,
  setShowAllItems,
} from "./collection.preferences";
import { buildDiscoveryIndex, tryDiscoverByName } from "./collection.discovery";
import {
  getCatalogItemView,
  getVisibleItemViews,
} from "./collection.presentation";
import { toggleOwnership } from "./collection.service";
import type { CatalogItem } from "../catalog/catalog.types";
const items: CatalogItem[] = [
  {
    slug: "secret-z",
    category: "melee_weapon",
    type: "hammers",
    variation: "Zeta Hammer",
    image: "https://example.com/secret.png",
  },
  {
    slug: "secret-b",
    category: "melee_weapon",
    type: "hammers",
    variation: "Battle Hammer",
    image: null,
  },
  {
    slug: "secret-o",
    category: "talisman",
    type: "talisman",
    variation: "Ocelot’s Paw",
    image: null,
  },
];
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}
describe("spoiler-free discovery", () => {
  it("starts Sword and Bow discovered but uncollected", async () => {
    const db = createCompletionCollection(storage());
    await db.preload();
    const defaults: CatalogItem[] = [
      {
        slug: "melee_weapon-sword",
        category: "melee_weapon",
        type: "swords",
        variation: "Sword",
        image: null,
      },
      {
        slug: "ranged_weapon-bow",
        category: "ranged_weapon",
        type: "bows",
        variation: "Bow",
        image: null,
      },
    ];
    for (const item of defaults) {
      expect(getCatalogItemView(item, undefined, false)).toMatchObject({
        displayName: item.variation,
        discovered: true,
        hidden: false,
      });
      expect(db.get(item.slug)).toBeUndefined();
      expect(
        tryDiscoverByName(db, buildDiscoveryIndex(defaults), item.variation),
      ).toBeUndefined();
    }
    await toggleOwnership(db, defaults[0].slug)!.isPersisted.promise;
    expect(db.get(defaults[0].slug)).toMatchObject({
      owned: true,
      discovered: true,
    });
    await toggleOwnership(db, defaults[0].slug)!.isPersisted.promise;
    expect(db.get(defaults[0].slug)?.owned).toBe(false);
    await db.cleanup();
  });
  it("defaults to protection and passes only safe presentation data", async () => {
    const prefs = createPreferencesCollection(storage());
    await prefs.preload();
    expect(prefs.get("spoilers")?.showAllItems ?? false).toBe(false);
    const view = getCatalogItemView(items[0], undefined, false);
    expect(view).toEqual({
      slug: "secret-z",
      category: "melee_weapon",
      type: "hammers",
      displayName: "?????",
      image: null,
      discovered: false,
      hidden: true,
    });
    expect(JSON.stringify(view)).not.toContain("Zeta Hammer");
    expect(JSON.stringify(view)).not.toContain("secret.png");
    await prefs.cleanup();
  });
  it("accepts conservative normalized exact matches, auto-collects, and preserves discovery on uncheck", async () => {
    const local = storage();
    const db = createCompletionCollection(local);
    await db.preload();
    const index = buildDiscoveryIndex(items);
    expect(tryDiscoverByName(db, index, "battle ham")).toBeUndefined();
    expect(tryDiscoverByName(db, index, "great")).toBeUndefined();
    expect(toggleOwnership(db, items[1].slug)).toBeUndefined();
    expect(db.size).toBe(0);
    const result = tryDiscoverByName(db, index, "  BATTLE   HAMMER  ")!;
    expect(db.get(items[1].slug)).toMatchObject({
      discovered: true,
      owned: true,
    });
    await result.transaction.isPersisted.promise;
    await toggleOwnership(db, items[1].slug)!.isPersisted.promise;
    expect(db.get(items[1].slug)).toMatchObject({
      discovered: true,
      owned: false,
    });
    expect(tryDiscoverByName(db, index, "Battle Hammer")).toBeUndefined();
    expect(db.get(items[1].slug)?.owned).toBe(false);
    const apostrophe = tryDiscoverByName(db, index, "  OCELOTS PAW ")!;
    await apostrophe.transaction.isPersisted.promise;
    expect(db.get(items[2].slug)?.discovered).toBe(true);
    expect(
      getCatalogItemView(items[1], db.get(items[1].slug), false),
    ).toMatchObject({
      displayName: "Battle Hammer",
      image: null,
      hidden: false,
    });
    await db.cleanup();
    const restored = createCompletionCollection(local);
    await restored.preload();
    expect(restored.get(items[1].slug)).toMatchObject({
      discovered: true,
      owned: false,
    });
    await restored.cleanup();
  });
  it("rejects ambiguous full names even if one duplicate was already discovered", async () => {
    const db = createCompletionCollection(storage());
    await db.preload();
    const duplicate = { ...items[2], slug: "other", variation: "Ocelot's Paw" };
    const index = buildDiscoveryIndex([...items, duplicate]);
    expect(tryDiscoverByName(db, index, "ocelots paw")).toBeUndefined();
    await toggleOwnership(db, "other", true)!.isPersisted.promise;
    expect(tryDiscoverByName(db, index, "ocelots paw")).toBeUndefined();
    await db.cleanup();
  });
  it("show-all persists separately, reveals without discovery, and re-hides when disabled", async () => {
    const local = storage();
    const db = createCompletionCollection(local);
    await db.preload();
    const prefs = createPreferencesCollection(local);
    await prefs.preload();
    await setShowAllItems(prefs, true).isPersisted.promise;
    expect(
      getCatalogItemView(items[0], db.get(items[0].slug), true),
    ).toMatchObject({
      displayName: "Zeta Hammer",
      discovered: false,
      image: items[0].image,
    });
    expect(db.size).toBe(0);
    await prefs.cleanup();
    const restored = createPreferencesCollection(local);
    await restored.preload();
    expect(restored.get("spoilers")?.showAllItems).toBe(true);
    await setShowAllItems(restored, false).isPersisted.promise;
    expect(getCatalogItemView(items[0], undefined, false).hidden).toBe(true);
    expect(local.getItem(COLLECTION_STORAGE_KEY)).toBeNull();
    await restored.cleanup();
    await db.cleanup();
  });
  it("filters public metadata, never partial secret names/slugs, and sorts hidden entries neutrally", () => {
    const views = items.map((item) =>
      getCatalogItemView(item, undefined, false),
    );
    expect(
      getVisibleItemViews(views, new Set(), {
        status: "missing",
        category: "melee_weapon",
        type: "hammers",
      }),
    ).toEqual(views.slice(0, 2));
    expect(
      getVisibleItemViews(views, new Set(), { status: "collected" }),
    ).toEqual([]);
    expect(getVisibleItemViews(views, new Set(), { q: "battle" })).toEqual([]);
    expect(getVisibleItemViews(views, new Set(), { q: "secret-b" })).toEqual(
      [],
    );
    expect(getVisibleItemViews(views, new Set(), { q: "hammer" })).toEqual(
      views.slice(0, 2),
    );
    for (const sort of ["name", "category", "missing", "collected"] as const)
      expect(
        getVisibleItemViews(views.slice(0, 2), new Set(), { sort }),
      ).toEqual(views.slice(0, 2));
    const shown = items.map((item) =>
      getCatalogItemView(item, undefined, true),
    );
    expect(
      getVisibleItemViews(shown, new Set(), { sort: "name" })[0].displayName,
    ).toBe("Battle Hammer");
  });
  it("discovers globally despite conflicting filters", async () => {
    const db = createCompletionCollection(storage());
    await db.preload();
    const discovered = tryDiscoverByName(
      db,
      buildDiscoveryIndex(items),
      "Battle Hammer",
    )!;
    await discovered.transaction.isPersisted.promise;
    const views = items.map((item) =>
      getCatalogItemView(item, db.get(item.slug), false),
    );
    expect(
      getVisibleItemViews(views, new Set([items[1].slug]), {
        category: "armor",
        type: "head",
      }),
    ).toEqual([]);
    expect(db.get(items[1].slug)).toMatchObject({
      discovered: true,
      owned: true,
    });
    await db.cleanup();
  });
  it("migrates legacy ownership without losing unknown records or overwriting v1", async () => {
    const local = storage();
    // Generate the adapter's real envelope using a collection, then remove discovery as in v1.
    const seed = createCompletionCollection(local);
    await seed.preload();
    await toggleOwnership(seed, items[1].slug, true)!.isPersisted.promise;
    await toggleOwnership(seed, "removed-item", true)!.isPersisted.promise;
    await toggleOwnership(seed, "missing-item", true)!.isPersisted.promise;
    await toggleOwnership(seed, "missing-item")!.isPersisted.promise;
    await seed.cleanup();
    const envelope = JSON.parse(local.getItem(COLLECTION_STORAGE_KEY)!);
    for (const record of Object.values(envelope) as {
      data: { discovered?: boolean };
    }[])
      delete record.data.discovered;
    const legacy = JSON.stringify(envelope);
    local.setItem(LEGACY_COLLECTION_STORAGE_KEY, legacy);
    local.removeItem(COLLECTION_STORAGE_KEY);
    const db = createCompletionCollection(local);
    await db.preload();
    expect(db.get(items[1].slug)).toMatchObject({
      owned: true,
      discovered: true,
    });
    expect(db.get("removed-item")).toMatchObject({
      owned: true,
      discovered: true,
    });
    expect(db.get("missing-item")).toMatchObject({
      owned: false,
      discovered: false,
    });
    expect(local.getItem(LEGACY_COLLECTION_STORAGE_KEY)).toBe(legacy);
    await toggleOwnership(db, items[1].slug)!.isPersisted.promise;
    await db.cleanup();
    const restored = createCompletionCollection(local);
    await restored.preload();
    expect(restored.get(items[1].slug)).toMatchObject({
      owned: false,
      discovered: true,
    });
    await restored.cleanup();
  });
  it("migrates the previous brand storage without losing discovery or preferences", async () => {
    const local = storage();
    const original = JSON.stringify({
      "s:secret-z": {
        versionKey: "1",
        data: { itemSlug: "secret-z", owned: false, discovered: true },
      },
    });
    local.setItem("mddb.collection.v2", original);
    local.setItem(
      "mddb.preferences.v1",
      JSON.stringify({
        "s:spoilers": {
          versionKey: "1",
          data: { id: "spoilers", showAllItems: true },
        },
      }),
    );
    const db = createCompletionCollection(local);
    const prefs = createPreferencesCollection(local);
    await db.preload();
    await prefs.preload();
    expect(db.get("secret-z")).toMatchObject({
      owned: false,
      discovered: true,
    });
    expect(prefs.get("spoilers")?.showAllItems).toBe(true);
    expect(local.getItem("mddb.collection.v2")).toBe(original);
    await db.cleanup();
    await prefs.cleanup();
  });
  it("preserves corrupt legacy data and does not write a partial migration", () => {
    const local = storage();
    local.setItem(LEGACY_COLLECTION_STORAGE_KEY, "invalid");
    expect(() => createCompletionCollection(local)).toThrow("preserved");
    expect(local.getItem(COLLECTION_STORAGE_KEY)).toBeNull();
    expect(local.getItem(LEGACY_COLLECTION_STORAGE_KEY)).toBe("invalid");
  });
});
