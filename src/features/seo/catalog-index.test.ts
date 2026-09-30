import { expect, it } from "vitest";
import type { CatalogItem } from "../catalog/catalog.types";
import { catalogIndex } from "./catalog-index";

it("groups canonical item links in catalog category order", () => {
  const items = [
    {
      slug: "armor-beekeeper-suit",
      category: "armor",
      type: "torso",
      variation: "Beekeeper Suit",
      image: null,
      game_data: { slug: "beekeeper-suit" },
    },
    {
      slug: "melee_weapon-diamond-pickaxe",
      category: "melee_weapon",
      type: "pickaxes",
      variation: "The Prospector's Pick",
      image: null,
      game_data: { slug: "the-prospectors-pick" },
    },
  ] satisfies CatalogItem[];
  expect(catalogIndex(items)).toEqual([
    {
      category: "melee_weapon",
      label: "Melee Weapons",
      items: [
        {
          name: "The Prospector's Pick",
          path: "/catalog/melee-weapons/the-prospectors-pick",
        },
      ],
    },
    {
      category: "armor",
      label: "Armor",
      items: [
        { name: "Beekeeper Suit", path: "/catalog/armor/beekeeper-suit" },
      ],
    },
  ]);
});

it("lists all location pages separately from equipment", () => {
  const location = {
    slug: "location-honeycomb-fields",
    category: "location",
    type: "location",
    variation: "Honeycomb Fields",
    image: null,
    game_data: { slug: "honeycomb-fields" },
  } satisfies CatalogItem;
  expect(catalogIndex([location])).toEqual([]);
  expect(catalogIndex([location], ["location"])).toEqual([
    {
      category: "location",
      label: "Locations",
      items: [
        {
          name: "Honeycomb Fields",
          path: "/catalog/locations/honeycomb-fields",
        },
      ],
    },
  ]);
});
