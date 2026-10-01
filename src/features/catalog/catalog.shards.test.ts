import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { createCatalogCache } from "./catalog.db";
import { loadCatalog, loadCatalogDetail } from "./catalog.loader";

const source = { latestUrl: "https://example.com/latest.json" };
const item = {
  slug: "hammer",
  category: "melee_weapon",
  type: "hammer",
  variation: "Hammer",
  image: "images/hammer",
  detail_path: "details/hammer.json",
  game_data: { melee: { combo: [{ damage: 4 }] } },
};
const pointer = (version = "v1") =>
  new Response(
    JSON.stringify({
      catalogVersion: version,
      manifest: `releases/${version}/manifest.json`,
      catalogIndex: `releases/${version}/catalog-index.json`,
    }),
  );
afterEach(() => vi.restoreAllMocks());
it("loads only the index for browsing and independently caches a requested detail in its release", async () => {
  const factory = new IDBFactory();
  const cache = createCatalogCache(factory);
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(pointer())
    .mockResolvedValueOnce(new Response(JSON.stringify([item])));
  const [entry] = await loadCatalog(source, undefined, cache);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][0]).toBe(
    "https://example.com/releases/v1/catalog-index.json",
  );
  expect(entry.image).toBe("https://example.com/releases/v1/images/hammer");
  const full = {
    ...item,
    game_data: {
      ...item.game_data,
      quest_context: { steps: ["first", "second"] },
    },
  };
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify(full)));
  const detail = await loadCatalogDetail(entry, cache);
  expect(detail.game_data).toEqual(full.game_data);
  expect(fetcher.mock.calls[2][0]).toBe(
    "https://example.com/releases/v1/details/hammer.json",
  );
  expect(await loadCatalogDetail(entry, createCatalogCache(factory))).toEqual(
    detail,
  );
  expect(fetcher).toHaveBeenCalledTimes(3);
  fetcher
    .mockResolvedValueOnce(pointer("v2"))
    .mockResolvedValueOnce(new Response(JSON.stringify([item])));
  const [next] = await loadCatalog(source, undefined, cache);
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify(full)));
  await loadCatalogDetail(next, cache);
  expect(fetcher.mock.calls[5][0]).toBe(
    "https://example.com/releases/v2/details/hammer.json",
  );
});
it("rejects mismatched details without persisting them and permits retry", async () => {
  const cache = createCatalogCache(new IDBFactory());
  const entry = {
    ...item,
    detail_path: "https://example.com/releases/v1/details/hammer.json",
  };
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...item, slug: "other" })),
    );
  await expect(loadCatalogDetail(entry, cache)).rejects.toThrow(
    "does not match",
  );
  expect(await cache.readDetail!(entry.detail_path)).toBeUndefined();
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify(item)));
  expect((await loadCatalogDetail(entry, cache)).slug).toBe("hammer");
});
it("rejects index and shard paths outside the pinned release", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        catalogVersion: "v1",
        manifest: "releases/v1/manifest.json",
        catalogIndex: "releases/v2/catalog-index.json",
      }),
    ),
  );
  await expect(loadCatalog(source)).rejects.toThrow("outside its release");
  fetcher
    .mockResolvedValueOnce(pointer())
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ ...item, detail_path: "../v2/details/hammer.json" }]),
      ),
    );
  await expect(loadCatalog(source)).rejects.toThrow("outside its release");
});
it("uses valid network content when IndexedDB cannot open", async () => {
  const factory = {
    open: () => {
      throw new Error("blocked");
    },
  } as unknown as IDBFactory;
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(pointer())
    .mockResolvedValueOnce(new Response(JSON.stringify([item])));
  expect(
    await loadCatalog(source, undefined, createCatalogCache(factory)),
  ).toHaveLength(1);
});

it("keeps shared content-hashed image URLs identical across catalog releases", async () => {
  const shared = { ...item, image: "../../images/" + "a".repeat(64) + ".png" };
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(pointer("v1"))
    .mockResolvedValueOnce(new Response(JSON.stringify([shared])))
    .mockResolvedValueOnce(pointer("v2"))
    .mockResolvedValueOnce(new Response(JSON.stringify([shared])));
  const [first] = await loadCatalog(source);
  const [second] = await loadCatalog(source);
  expect(first.image).toBe(
    "https://example.com/images/" + "a".repeat(64) + ".png",
  );
  expect(second.image).toBe(first.image);
  expect(second.detail_path).not.toBe(first.detail_path);
  expect(fetcher).toHaveBeenCalledTimes(4);
});
