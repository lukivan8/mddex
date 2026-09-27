import { describe, expect, it, vi } from "vitest";
import {
  getCategoryProgress,
  getOverallProgress,
  getVisibleItems,
} from "./collection.selectors";
import {
  createCompletionCollection,
  COLLECTION_STORAGE_KEY,
} from "./collection.db";
import { toggleOwnership } from "./collection.service";
import { loadCatalog, resolveImage } from "../catalog/catalog.loader";
import { catalogSchema } from "../catalog/catalog.schema";
import type { CatalogItem } from "../catalog/catalog.types";
const items: CatalogItem[] = [
  {
    slug: "melee_weapon-battle-hammer",
    variation: "Battle Hammer",
    category: "melee_weapon",
    type: "hammers",
    image: null,
  },
  {
    slug: "armor-beekeeper-boots",
    variation: "Beekeeper Boots",
    category: "armor",
    type: "feet",
    image: null,
  },
  {
    slug: "armor-beekeeper-helmet",
    variation: "Beekeeper Helmet",
    category: "armor",
    type: "head",
    image: null,
  },
  {
    slug: "ranged_weapon-bow",
    variation: "Longbow",
    category: "ranged_weapon",
    type: "bows",
    image: null,
  },
];
function memoryStorage() {
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
describe("completion", () => {
  it("counts current catalog only, including per-category progress", () => {
    const owned = new Set([items[0].slug, items[1].slug, "removed-item"]);
    expect(getOverallProgress(items, owned)).toEqual({
      owned: 2,
      total: 4,
      percent: 50,
    });
    expect(getCategoryProgress(items, owned, "armor")).toEqual({
      owned: 1,
      total: 2,
      percent: 50,
    });
    expect(getOverallProgress([], owned)).toEqual({
      owned: 0,
      total: 0,
      percent: 0,
    });
    expect(
      getOverallProgress([...items, { ...items[0], slug: "new" }], owned).total,
    ).toBe(5);
  });
  it("combines partial case-insensitive search with category, type and status", () => {
    const owned = new Set([items[1].slug]);
    expect(
      getVisibleItems(items, owned, {
        q: "BEEkeep",
        category: "armor",
        type: "head",
        status: "missing",
      }),
    ).toEqual([items[2]]);
    expect(
      getVisibleItems(items, owned, { q: "armor", status: "collected" }),
    ).toEqual([items[1]]);
    expect(
      getVisibleItems(items, owned, { q: "hammer", category: "melee_weapon" }),
    ).toEqual([items[0]]);
    expect(getVisibleItems(items, owned, { q: "bow" })).toEqual([items[3]]);
    expect(getVisibleItems(items, owned, { q: "melee_weapon-battle" })).toEqual(
      [items[0]],
    );
    expect(
      getVisibleItems(items, owned, { category: "armor", type: "bows" }),
    ).toEqual([]);
  });
  it("keeps name order on toggle unless an ownership sort is explicit", () => {
    const owned = new Set([items[0].slug]);
    expect(getVisibleItems(items, owned, {}).map((i) => i.slug)).toEqual(
      getVisibleItems(items, new Set(), {}).map((i) => i.slug),
    );
    expect(getVisibleItems(items, owned, { sort: "collected" })[0]).toBe(
      items[0],
    );
    expect(getVisibleItems(items, owned, { sort: "missing" }).at(-1)).toBe(
      items[0],
    );
  });
  it("toggles synchronously and persists across collection instances without catalog objects", async () => {
    const storage = memoryStorage();
    const collection = createCompletionCollection(storage);
    await collection.preload();
    const tx = toggleOwnership(collection, items[0].slug, true)!;
    expect(collection.get(items[0].slug)?.owned).toBe(true);
    await tx.isPersisted.promise;
    await toggleOwnership(collection, "removed-item", true)!.isPersisted
      .promise;
    await collection.cleanup();
    const restored = createCompletionCollection(storage);
    await restored.preload();
    expect(restored.get(items[0].slug)).toMatchObject({
      itemSlug: items[0].slug,
      owned: true,
    });
    expect(restored.get("removed-item")?.owned).toBe(true);
    await toggleOwnership(restored, items[0].slug, true)!.isPersisted.promise;
    expect(restored.get(items[0].slug)?.owned).toBe(false);
    expect(storage.getItem(COLLECTION_STORAGE_KEY)).not.toContain("variation");
    await restored.cleanup();
  });
  it("does not replace corrupt local data", () => {
    const storage = memoryStorage();
    storage.setItem(COLLECTION_STORAGE_KEY, "broken");
    expect(() => createCompletionCollection(storage)).toThrow("preserved");
    expect(storage.getItem(COLLECTION_STORAGE_KEY)).toBe("broken");
  });
  it("rolls back a failed persistent write", async () => {
    const storage = memoryStorage();
    const collection = createCompletionCollection(storage);
    await collection.preload();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    storage.setItem = () => {
      throw new Error("Quota exceeded");
    };
    const tx = toggleOwnership(collection, "item", true)!;
    await expect(tx.isPersisted.promise).rejects.toThrow();
    expect(collection.get("item")).toBeUndefined();
    log.mockRestore();
    await collection.cleanup();
  });
});
describe("catalog boundary", () => {
  it("accepts null images and rejects malformed entries or duplicate slugs", () => {
    expect(catalogSchema.parse(items)).toEqual(items);
    expect(catalogSchema.safeParse([{ slug: "oops" }]).success).toBe(false);
    expect(catalogSchema.safeParse([items[0], items[0]]).success).toBe(false);
  });
  it("resolves release-relative images and handles absent or unsafe images", () => {
    expect(resolveImage("images/test", "https://example.com/releases/1/")).toBe(
      "https://example.com/releases/1/images/test",
    );
    expect(resolveImage(null, "https://example.com/")).toBeNull();
    expect(
      resolveImage("javascript:alert(1)", "https://example.com/"),
    ).toBeNull();
  });
  it("discovers the catalog and artwork alongside the manifest", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            catalogVersion: "v2",
            manifest: "releases/published-release/manifest.json",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ ...items[0], image: "images/hammer" }, items[1]]),
        ),
      );
    try {
      const result = await loadCatalog({
        latestUrl: "https://example.com/content/latest.json",
      });
      expect(fetcher).toHaveBeenNthCalledWith(
        1,
        "https://example.com/content/latest.json",
        expect.objectContaining({
          cache: "no-cache",
          signal: expect.any(AbortSignal),
        }),
      );
      expect(fetcher).toHaveBeenNthCalledWith(
        2,
        "https://example.com/content/releases/published-release/catalog.json",
        expect.any(Object),
      );
      expect(result[0].image).toBe(
        "https://example.com/content/releases/published-release/images/hammer",
      );
      expect(result[1].image).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      fetcher.mockRestore();
    }
  });
  it("uses the new release on the next load and supports absolute manifest URLs", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    try {
      for (const version of ["v1", "v2"]) {
        fetcher
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                catalogVersion: version,
                manifest: `https://cdn.example.com/releases/${version}/manifest.json`,
              }),
            ),
          )
          .mockResolvedValueOnce(new Response(JSON.stringify(items)));
        expect(await loadCatalog()).toEqual(items);
        expect(fetcher).toHaveBeenLastCalledWith(
          `https://cdn.example.com/releases/${version}/catalog.json`,
          expect.any(Object),
        );
      }
    } finally {
      fetcher.mockRestore();
    }
  });
  it("rejects discovery and catalog failures without falling back to a pinned release", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const pointer = () =>
      new Response(
        JSON.stringify({
          catalogVersion: "test",
          manifest: "releases/test/manifest.json",
        }),
      );
    try {
      fetcher.mockResolvedValueOnce(
        new Response("Unavailable", { status: 503 }),
      );
      await expect(loadCatalog()).rejects.toThrow(
        "Release discovery failed (503)",
      );
      fetcher.mockResolvedValueOnce(new Response("{}"));
      await expect(loadCatalog()).rejects.toThrow("unexpected format");
      fetcher.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            catalogVersion: "test",
            manifest: "javascript:alert(1)",
          }),
        ),
      );
      await expect(loadCatalog()).rejects.toThrow("manifest URL is invalid");
      fetcher
        .mockResolvedValueOnce(pointer())
        .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
      await expect(loadCatalog()).rejects.toThrow(
        "Catalog request failed (503)",
      );
      fetcher
        .mockResolvedValueOnce(pointer())
        .mockResolvedValueOnce(new Response("{}"));
      await expect(loadCatalog()).rejects.toThrow("unexpected format");
    } finally {
      fetcher.mockRestore();
    }
  });
});
