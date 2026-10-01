import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { createCatalogCache } from "./catalog.db";
import { getCategories, getTypes, isCatalogItem } from "./catalog.helpers";
import { loadCatalog } from "./catalog.loader";
import type { CatalogItem } from "./catalog.types";
import {
  getCatalogItemView,
  getVisibleItemViews,
} from "../collection/collection.presentation";

const categories = [
  "melee_weapon",
  "ranged_weapon",
  "armor",
  "artifact",
  "talisman",
  "enchantment",
  "gear_effect",
];
const definitions: CatalogItem[] = [
  "location",
  "mob",
  "pet",
  "cape",
  "status",
  ...[...categories].reverse(),
].map((category) => ({
  slug: category,
  category,
  variation: category,
  type: category,
  image: `images/${category}`,
  ...(category === "melee_weapon"
    ? { game_data: { sources: [{ catalog_slug: "location" }] } }
    : category === "location"
      ? { game_data: { loot: [{ catalog_slug: "melee_weapon" }] } }
      : {}),
}));

afterEach(() => vi.restoreAllMocks());

it("limits catalog filters and category sorting to the requested categories in order", () => {
  expect(getCategories(definitions)).toEqual(categories);
  expect(getTypes(definitions)).toEqual([...categories].sort());
  const views = definitions.map((item) => getCatalogItemView(item));
  expect(
    getVisibleItemViews(views, { sort: "category" }).map(
      (item) => item.category,
    ),
  ).toEqual(categories);
  expect(getVisibleItemViews(views, { q: "location" })).toEqual([]);
  expect(getVisibleItemViews(views, { category: "mob" })).toEqual([]);
});

it("keeps other definitions and drop links but only equipment, location and mob artwork across reloads", async () => {
  const storage = new IDBFactory();
  const source = { latestUrl: "https://example.com/latest.json" };
  const pointer = () =>
    new Response(
      JSON.stringify({
        catalogVersion: "v1",
        manifest: "releases/v1/manifest.json",
      }),
    );
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(pointer())
    .mockResolvedValueOnce(new Response(JSON.stringify(definitions)));
  const loaded = await loadCatalog(
    source,
    undefined,
    createCatalogCache(storage),
  );
  expect(loaded).toHaveLength(definitions.length);
  for (const item of loaded) {
    expect(item.image).toBe(
      isCatalogItem(item) || ["location", "mob"].includes(item.category)
        ? `https://example.com/releases/v1/images/${item.category}`
        : null,
    );
    expect(item.game_data).toEqual(
      definitions.find((entry) => entry.slug === item.slug)?.game_data,
    );
  }
  fetcher.mockClear().mockResolvedValueOnce(pointer());
  expect(
    await loadCatalog(source, undefined, createCatalogCache(storage)),
  ).toEqual(loaded);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
