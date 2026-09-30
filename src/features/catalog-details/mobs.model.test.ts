import { expect, it } from "vitest";
import type { CatalogItem } from "../catalog/catalog.types";
import { mobsCatalog } from "./mobs.model";
it("groups mob kinds and resolves area, encounter and location membership", () => {
  const mob = (
    kind: string,
    game_data: CatalogItem["game_data"] = {},
  ): CatalogItem => ({
    slug: kind,
    category: "mob",
    type: "mob",
    variation: kind,
    image: null,
    game_data: { mobKind: kind, ...game_data },
  });
  const catalog = mobsCatalog([
    mob("boss", { areas: [{ name: "Woods", catalog_slug: "woods" }] }),
    mob("miniboss", {
      fights: [{ regions: [{ name: "Woods", catalog_slug: "woods" }] }],
    }),
    mob("hostile"),
    mob("soul-corrupted"),
    mob("passive"),
    mob("companion"),
    {
      slug: "woods",
      category: "location",
      type: "location",
      variation: "Woods",
      image: null,
      game_data: { mobs: [{ name: "hostile", catalog_slug: "hostile" }] },
    },
  ]);
  expect(catalog.items.map((item) => item.kind)).toEqual([
    "boss",
    "boss",
    "hostile",
    "hostile",
    "neutral",
    "companion",
  ]);
  expect(catalog.items.map((item) => item.locations)).toEqual([
    ["woods"],
    ["woods"],
    ["woods"],
    [],
    [],
    [],
  ]);
  expect(catalog.locations).toEqual([{ id: "woods", name: "Woods" }]);
});
