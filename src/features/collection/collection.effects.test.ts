import { expect, it } from "vitest";
import type { CatalogItem } from "../catalog/catalog.types";
import { gearEffects } from "./collection.effects";
import {
  getCatalogItemView,
  getVisibleItemViews,
} from "./collection.presentation";

const fire: CatalogItem = {
  slug: "fire",
  variation: "Fire",
  category: "gear_effect",
  type: "attack",
  image: null,
};
const ice: CatalogItem = { ...fire, slug: "ice", variation: "Ice" };
const base: CatalogItem = {
  slug: "both",
  variation: "Both",
  category: "melee_weapon",
  type: "swords",
  image: null,
  game_data: {
    unique: true,
    effects: [{ name: "Fire", catalog_slug: "fire" }],
    rollable_effects: { effects: [{ name: "Ice", catalog_slug: "ice" }] },
  },
};
const onlyFire: CatalogItem = {
  ...base,
  slug: "only-fire",
  variation: "Only Fire",
  game_data: { effects: [{ name: "Fire" }] },
};
const unknown: CatalogItem = {
  ...base,
  slug: "unknown",
  variation: "Unknown",
  game_data: { effects: [{ text: "Unlisted innate effect." }] },
};
const catalog = new Map(
  [fire, ice, base, onlyFire, unknown].map((item) => [item.slug, item]),
);

it("resolves built-in, possible rolled and named legacy effects and tolerates unknown data", () => {
  expect(gearEffects(base, catalog).map((item) => item.slug)).toEqual([
    "fire",
    "ice",
  ]);
  expect(gearEffects(onlyFire, catalog).map((item) => item.slug)).toEqual([
    "fire",
  ]);
  expect(gearEffects(unknown, catalog)[0].variation).toBe(
    "Unlisted innate effect.",
  );
  expect(
    gearEffects(
      { ...base, game_data: { effects: [null, {}], rollable_effects: {} } },
      catalog,
    ),
  ).toEqual([]);
  expect(gearEffects(fire, catalog)).toEqual([]);
});
it("excludes talisman effects from gear filtering", () => {
  const talisman = {
    ...base,
    category: "talisman",
    game_data: {
      levels: [
        { effects: [{ name: "Fire", catalog_slug: "fire" }] },
        { effects: [{ name: "Fire", catalog_slug: "fire" }] },
      ],
    },
  };
  expect(gearEffects(talisman, catalog)).toEqual([]);
});
it("combines all or any effects with the other catalog filters", () => {
  const views = [base, onlyFire, unknown].map((item) =>
    getCatalogItemView(item, catalog),
  );
  expect(
    getVisibleItemViews(views, {
      effects: ["fire", "ice"],
      effectMatch: "all",
    }).map((item) => item.slug),
  ).toEqual(["both"]);
  expect(
    getVisibleItemViews(views, {
      effects: ["fire", "ice"],
      effectMatch: "any",
    }).map((item) => item.slug),
  ).toEqual(["both", "only-fire"]);
  expect(
    getVisibleItemViews(views, {
      effects: ["fire"],
      q: "only",
      category: "melee_weapon",
      type: "swords",
    }).map((item) => item.slug),
  ).toEqual(["only-fire"]);
  expect(getVisibleItemViews(views, { effects: [] })).toHaveLength(3);
  expect(getVisibleItemViews(views, { effects: ["missing"] })).toEqual([]);
});

it("limits URL effect selections to ten unique effects without discarding valid selections", async () => {
  const { filtersSchema } = await import("./collection.types");
  const effects = Array.from({ length: 12 }, (_, index) => `effect-${index}`);
  expect(
    filtersSchema.parse({ effects: [effects[0], ...effects] }).effects,
  ).toEqual(effects.slice(0, 10));
});

it("uses mapped CDN artwork for unnamed and canonical effects without images", () => {
  const image = "https://cdn.mddex.net/images/effect.png";
  const item = {
    ...base,
    artwork: { "effects.0.icon": image },
    game_data: {
      effects: [
        {
          name: "Fire",
          catalog_slug: "fire",
          icon: { artwork_key: "effects.0.icon" },
        },
      ],
    },
  };
  expect(gearEffects(item, catalog)[0].image).toBe(image);
  expect(gearEffects(item, new Map())[0].image).toBe(image);
});
