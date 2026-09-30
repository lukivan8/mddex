import { describe, expect, it, vi } from "vitest";
import {
  getCatalogItemView,
  getVisibleItemViews,
} from "./collection.presentation";
import { filtersSchema } from "./collection.types";
import { loadCatalog, resolveImage } from "../catalog/catalog.loader";
import { catalogSchema } from "../catalog/catalog.schema";
import type { CatalogItem } from "../catalog/catalog.types";
import { buildSearchIndex } from "../catalog/catalog.helpers";
import { pickerItems } from "../builds/build.selectors";
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
describe("catalog browsing", () => {
  it("finds unique gear by its built-in effect name in catalog and build picker", () => {
    const awesomeaxe: CatalogItem = {
      slug: "melee_weapon-awesomeaxe",
      variation: "Awesomeaxe",
      category: "melee_weapon",
      type: "axes",
      image: null,
      game_data: {
        unique: true,
        effects: [{ tier: "unique", name: "Strengthening Hit" }],
      },
    };
    const ordinaryAxe: CatalogItem = {
      ...awesomeaxe,
      slug: "melee_weapon-axe",
      variation: "Axe",
      game_data: { unique: false, effects: [{ name: "Strengthening Hit" }] },
    };
    const catalog = [awesomeaxe, ordinaryAxe];
    expect(
      pickerItems(
        catalog,
        { kind: "item", slot: "melee" },
        "strengthening",
        buildSearchIndex(catalog),
      ).map((item) => item.slug),
    ).toEqual([awesomeaxe.slug]);
    expect(
      getVisibleItemViews(
        catalog.map((item) => getCatalogItemView(item)),
        {
          q: "strengthening",
        },
      ).map((item) => item.slug),
    ).toEqual([awesomeaxe.slug]);
  });
  it("searches all catalog items and combines category and type filters", () => {
    const views = items.map((item) => getCatalogItemView(item));
    expect(
      getVisibleItemViews(views, {
        q: "BEEkeep",
        category: "armor",
        type: "head",
      }).map((i) => i.slug),
    ).toEqual([items[2].slug]);
    expect(
      getVisibleItemViews(views, { q: "hammer" }).map((i) => i.slug),
    ).toEqual([items[0].slug]);
    expect(
      filtersSchema.parse({ status: "collected", sort: "missing" }),
    ).toEqual({ sort: "name" });
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
