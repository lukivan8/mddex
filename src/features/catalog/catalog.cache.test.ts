import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCatalogCache, CATALOG_DATABASE } from "./catalog.db";
import { loadCatalog } from "./catalog.loader";

const source = { latestUrl: "https://example.com/latest.json" };
const items = [
  {
    slug: "hammer",
    variation: "Hammer",
    category: "melee_weapon",
    type: "hammers",
    image: null,
  },
];
function memoryStorage() {
  return new IDBFactory();
}
function pointer(version = "v1", directory = version) {
  return new Response(
    JSON.stringify({
      catalogVersion: version,
      manifest: `releases/${directory}/manifest.json`,
    }),
  );
}
afterEach(() => vi.restoreAllMocks());
describe("persistent catalog cache", () => {
  it("retains applicability on fetch and subsequent cache reads", async () => {
    const catalog = [
      {
        ...items[0],
        category: "enchantment",
        applicable_categories: ["melee_weapon", "armor"],
      },
    ];
    const storage = memoryStorage();
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(pointer())
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog)));
    expect(
      await loadCatalog(source, undefined, createCatalogCache(storage)),
    ).toEqual(catalog);
    fetcher.mockClear().mockResolvedValueOnce(pointer());
    expect(
      await loadCatalog(source, undefined, createCatalogCache(storage)),
    ).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("persists definitions and version together and skips the catalog after reopening", async () => {
    const storage = memoryStorage();
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(pointer())
      .mockResolvedValueOnce(new Response(JSON.stringify(items)));
    expect(
      await loadCatalog(source, undefined, createCatalogCache(storage)),
    ).toEqual(items);
    expect(
      (await createCatalogCache(storage).read(source.latestUrl))?.version,
    ).toBe("v1");
    fetcher.mockClear().mockResolvedValueOnce(pointer());
    expect(
      await loadCatalog(source, undefined, createCatalogCache(storage)),
    ).toEqual(items);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(source.latestUrl, expect.any(Object));
  });
  it("replaces a snapshot when its release changes, resolving artwork from the new directory", async () => {
    const cache = createCatalogCache(memoryStorage());
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(pointer())
      .mockResolvedValueOnce(new Response(JSON.stringify(items)));
    await loadCatalog(source, undefined, cache);
    fetcher
      .mockResolvedValueOnce(pointer("v2", "published"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ ...items[0], image: "images/hammer" }])),
      );
    const next = await loadCatalog(source, undefined, cache);
    expect(next[0].image).toBe(
      "https://example.com/releases/published/images/hammer",
    );
    expect((await cache.read(source.latestUrl))?.version).toBe("v2");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("does not replace the last valid snapshot with a failed or invalid release", async () => {
    const cache = createCatalogCache(memoryStorage());
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(pointer())
      .mockResolvedValueOnce(new Response(JSON.stringify(items)));
    await loadCatalog(source, undefined, cache);
    for (const response of [
      new Response("bad", { status: 503 }),
      new Response("{}"),
    ]) {
      fetcher
        .mockResolvedValueOnce(pointer("v2"))
        .mockResolvedValueOnce(response);
      await expect(loadCatalog(source, undefined, cache)).rejects.toThrow();
      expect((await cache.read(source.latestUrl))?.version).toBe("v1");
    }
  });
  it("refetches if the manifest location changes even with the same version", async () => {
    const cache = createCatalogCache(memoryStorage());
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(pointer())
      .mockResolvedValueOnce(new Response(JSON.stringify(items)))
      .mockResolvedValueOnce(pointer("v1", "moved"))
      .mockResolvedValueOnce(new Response("[]"));
    await loadCatalog(source, undefined, cache);
    expect(await loadCatalog(source, undefined, cache)).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("repairs corrupt cache data without touching user state", async () => {
    const storage = memoryStorage();
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = storage.open(CATALOG_DATABASE, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("snapshots");
        request.result.createObjectStore("details");
      };
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").put("corrupt", source.latestUrl);
      tx.oncomplete = () => resolve();
    });
    db.close();
    const cache = createCatalogCache(storage);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(pointer())
      .mockResolvedValueOnce(new Response(JSON.stringify(items)));
    expect(await loadCatalog(source, undefined, cache)).toEqual(items);
    expect((await cache.read(source.latestUrl))?.items).toEqual(items);
  });
  it("still returns valid content when persistence is unavailable", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(pointer())
      .mockResolvedValueOnce(new Response(JSON.stringify(items)));
    expect(
      await loadCatalog(source, undefined, {
        read: async () => {
          throw new Error("Storage blocked");
        },
        write: async () => {
          throw new Error("Quota exceeded");
        },
      }),
    ).toEqual(items);
  });
});
