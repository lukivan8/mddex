import { expect, it, vi } from "vitest";
import { resolveSourceArtwork } from "./source-artwork";
import type { CatalogItem } from "../catalog/catalog.types";
import type { ItemSource } from "./catalog-detail.model";

const location: CatalogItem = {
  slug: "location-woods",
  category: "location",
  type: "location",
  variation: "Woods",
  image: null,
  game_data: { slug: "woods" },
};
const dungeon = "https://wikily.gg/minecraft-dungeons-2/dungeons/woods";
const rift = "https://wikily.gg/minecraft-dungeons-2/rifts/woods";
const sources: ItemSource[] = [
  {
    name: "Woods Dungeons",
    type: "dungeon",
    source_url: dungeon,
    description: "Boss drop",
  },
  { name: "Woods Rifts", type: "rift", source_url: rift },
  { name: "Woods", type: "area", catalog_slug: location.slug },
];
it("loads a referenced location once and resolves distinct dungeon/rift artwork by published identity", async () => {
  const load = vi.fn().mockResolvedValue({
    ...location,
    artwork: {
      dungeon: "https://cdn.mddex.net/images/dungeon.png",
      rift: "https://cdn.mddex.net/images/rift.png",
    },
    game_data: {
      location_context: {
        instances: [
          { source_url: dungeon, icon: { artwork_key: "dungeon" } },
          { source_url: rift, icon: { artwork_key: "rift" } },
        ],
      },
    },
  });
  const result = await resolveSourceArtwork(sources, [location], load);
  expect(load).toHaveBeenCalledExactlyOnceWith(location);
  expect(result[0]).toEqual({
    ...sources[0],
    image: "https://cdn.mddex.net/images/dungeon.png",
  });
  expect(result[1]).toEqual({
    ...sources[1],
    image: "https://cdn.mddex.net/images/rift.png",
  });
  expect(result[2]).toEqual(sources[2]);
});
it("preserves acquisition rows when artwork is missing or the location shard fails", async () => {
  expect(
    await resolveSourceArtwork(
      sources,
      [location],
      vi.fn().mockRejectedValue(new Error("Offline")),
    ),
  ).toEqual(sources);
  expect(
    await resolveSourceArtwork(
      sources,
      [location],
      vi.fn().mockResolvedValue(location),
    ),
  ).toEqual(sources);
});
it("does not guess identities from names or fetch unrecognized source URLs", async () => {
  const unknown: ItemSource[] = [
    { name: "Woods Dungeons", type: "dungeon" },
    {
      name: "Woods Dungeons",
      type: "dungeon",
      source_url: "https://example.com/minecraft-dungeons-2/dungeons/woods",
    },
    { name: "Woods Dungeons", type: "dungeon", source_url: rift },
    {
      name: "Other Dungeons",
      type: "dungeon",
      source_url: dungeon.replace("woods", "other"),
    },
  ];
  const load = vi.fn();
  expect(await resolveSourceArtwork(unknown, [location], load)).toEqual(
    unknown,
  );
  expect(load).not.toHaveBeenCalled();
});
