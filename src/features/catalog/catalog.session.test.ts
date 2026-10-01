import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { createCatalogCache } from "./catalog.db";
import { getContentSource } from "./catalog.loader";

const item = {
  slug: "hammer",
  variation: "Hammer",
  category: "melee_weapon",
  type: "hammers",
  image: null,
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("shows the saved release before network discovery and stages updates without mixing releases", async () => {
  vi.resetModules();
  const factory = new IDBFactory();
  const cache = createCatalogCache(factory);
  const source = getContentSource();
  const releaseUrl = new URL("releases/v1/", source.latestUrl).href;
  await cache.write({
    source: source.latestUrl,
    version: "v1",
    releaseUrl,
    catalogUrl: releaseUrl + "catalog-index.json",
    items: [item],
  });
  vi.stubGlobal("window", { indexedDB: factory });
  let discover!: (response: Response) => void;
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          discover = resolve;
        }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify([{ ...item, variation: "Updated Hammer" }])),
    );
  const { loadSessionCatalog } = await import("./catalog.session");
  expect(await loadSessionCatalog()).toEqual([item]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  discover(
    new Response(
      JSON.stringify({
        catalogVersion: "v2",
        manifest: "releases/v2/manifest.json",
        catalogIndex: "releases/v2/catalog-index.json",
      }),
    ),
  );
  await vi.waitFor(async () =>
    expect((await cache.read(source.latestUrl))?.version).toBe("v2"),
  );
  expect((await loadSessionCatalog())[0].variation).toBe("Hammer");
  expect((await cache.read(source.latestUrl))?.items[0].variation).toBe(
    "Updated Hammer",
  );
});

it("keeps cached browsing available when revalidation fails", async () => {
  vi.resetModules();
  const factory = new IDBFactory();
  const source = getContentSource();
  await createCatalogCache(factory).write({
    source: source.latestUrl,
    version: "v1",
    releaseUrl: new URL("releases/v1/", source.latestUrl).href,
    items: [item],
  });
  vi.stubGlobal("window", { indexedDB: factory });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline"));
  const { loadSessionCatalog } = await import("./catalog.session");
  expect(await loadSessionCatalog()).toEqual([item]);
  expect(await loadSessionCatalog()).toEqual([item]);
});

it("deduplicates server indexes and immutable detail shards, and retries failed discovery", async () => {
  vi.resetModules();
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValueOnce(new Error("Temporary failure"))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          catalogVersion: "v1",
          manifest: "releases/v1/manifest.json",
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify([item])))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...item, description: "Full details" })),
    );
  const { loadSessionCatalog, loadSessionCatalogDetail } =
    await import("./catalog.session");
  await expect(loadSessionCatalog()).rejects.toThrow("Temporary failure");
  const [first, second] = await Promise.all([
    loadSessionCatalog(),
    loadSessionCatalog(),
  ]);
  expect(first).toEqual(second);
  await loadSessionCatalog();
  expect(fetcher).toHaveBeenCalledTimes(3);
  const sharded = {
    ...item,
    detail_path: "https://example.com/releases/v1/details/hammer.json",
  };
  const details = await Promise.all([
    loadSessionCatalogDetail(sharded),
    loadSessionCatalogDetail(sharded),
  ]);
  expect(details[0].description).toBe("Full details");
  expect(details[1]).toEqual(details[0]);
  expect(fetcher).toHaveBeenCalledTimes(4);
});
