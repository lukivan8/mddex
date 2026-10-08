import { expect, it } from "vitest";
import type { CatalogItem } from "../catalog/catalog.types";
import { compose, emptyBuild } from "./build.service";
import { composeSelection } from "./build.selection";
import {
  uniqueEffect,
  uniqueEffectCatalog,
  withUniqueEffects,
} from "./build.unique";
import { buildSummary } from "./build.summary";

const weapon: CatalogItem = {
  slug: "unique-sword",
  category: "melee_weapon",
  type: "swords",
  variation: "Unique Sword",
  image: null,
  game_data: {
    unique: true,
    effects: [
      {
        name: "Fire",
        text: "Burns enemies.",
        tier: "unique",
        catalog_slug: "fire",
      },
    ],
  },
};
const effect: CatalogItem = {
  slug: "fire",
  category: "gear_effect",
  type: "attack",
  variation: "Fire",
  image: null,
};
const manual = { ...effect, slug: "damage" };
const ordinary = { ...weapon, slug: "ordinary", game_data: { unique: false } };
const catalog = uniqueEffectCatalog([weapon, ordinary, effect, manual]);
const target = { kind: "item", slot: "melee" } as const;
const effectTarget = { kind: "effect", slot: "melee", index: 0 } as const;

it("automatically equips the unique effect and prevents replacing, removing or duplicating it", () => {
  const build = compose(emptyBuild(), target, weapon, catalog);
  expect(build.slots.melee?.effects).toEqual(["fire", null, null]);
  for (const replacement of [null, manual])
    expect(() => compose(build, effectTarget, replacement, catalog)).toThrow(
      "locked",
    );
  expect(() => composeSelection(build, effectTarget, effect, catalog)).toThrow(
    "locked",
  );
  expect(() =>
    compose(build, { ...effectTarget, index: 1 }, effect, catalog),
  ).toThrow("locked");
  const selected = composeSelection(build, effectTarget, manual, catalog);
  expect(selected.slots.melee?.effects).toEqual(["fire", "damage", null]);
  expect(
    composeSelection(selected, effectTarget, null, catalog).slots.melee
      ?.effects,
  ).toEqual(["fire", null, null]);
  expect(
    composeSelection(selected, effectTarget, manual, catalog).slots.melee
      ?.effects,
  ).toEqual(["fire", null, null]);
});

it("replaces only the innate effect when changing unique equipment and removes it on ordinary equipment", () => {
  const other = {
    ...weapon,
    slug: "other-unique",
    game_data: { unique: true, effects: [{ catalog_slug: "ice" }] },
  };
  let build = compose(emptyBuild(), target, weapon, catalog);
  build = composeSelection(build, effectTarget, manual, catalog);
  build = compose(build, target, other, catalog);
  expect(build.slots.melee?.effects).toEqual(["ice", "damage", null]);
  const expanded = new Map(catalog).set(other.slug, other);
  build = compose(build, target, ordinary, expanded);
  expect(build.slots.melee?.effects).toEqual([null, "damage", null]);
  expect(
    compose(build, effectTarget, effect, expanded).slots.melee?.effects,
  ).toEqual(["fire", "damage", null]);
  expect(compose(build, target, null, expanded).slots.melee).toBeNull();
});

it("repairs saved and shared builds, retaining a selected effect without mutating the source", () => {
  const original = emptyBuild();
  original.slots.melee = {
    itemSlug: weapon.slug,
    enchantments: ["enchant"],
    effects: ["damage", "fire"],
  };
  const normalized = withUniqueEffects(original, catalog);
  expect(normalized.slots.melee?.effects).toEqual(["fire", "damage", null]);
  expect(normalized.slots.melee?.enchantments).toEqual(["enchant"]);
  expect(original.slots.melee?.effects).toEqual(["damage", "fire"]);
  expect(withUniqueEffects(normalized, catalog)).toBe(normalized);
});

it("uses innate effects on unique equipment even with a numbered tier, without guessing from its name", () => {
  expect(
    uniqueEffect({
      ...weapon,
      game_data: {
        unique: true,
        effects: [{ tier: "III", catalog_slug: "fire" }],
      },
    })?.slug,
  ).toBe("fire");
  expect(uniqueEffect(ordinary)).toBeUndefined();
  expect(uniqueEffect({ ...weapon, game_data: undefined })).toBeUndefined();
  expect(
    uniqueEffect({ ...weapon, game_data: { unique: true, effects: [] } }),
  ).toBeUndefined();
});

it("retains published unique effects without a canonical catalog link in the board and summary", () => {
  const unlinked = {
    ...weapon,
    game_data: {
      unique: true,
      effects: [
        { name: "Shadowclaw", text: "Grants Shadowcloaking.", tier: "unique" },
      ],
    },
  };
  const lookup = uniqueEffectCatalog([unlinked]);
  const build = compose(emptyBuild(), target, unlinked, lookup);
  const slug = "unique-effect:unique-sword";
  expect(build.slots.melee?.effects).toEqual([slug, null, null]);
  expect(lookup.get(slug)?.variation).toBe("Shadowclaw");
  expect(buildSummary(build, lookup)[0].entries[0].item?.description).toBe(
    "Grants Shadowcloaking.",
  );
});

it("resolves innate effect artwork and fills a canonical definition's missing icon", () => {
  const image = "https://cdn.mddex.net/images/fire.png";
  const item = {
    ...weapon,
    artwork: { "effects.0.icon": image },
    game_data: {
      ...weapon.game_data,
      effects: [
        {
          name: "Fire",
          catalog_slug: "fire",
          tier: "unique",
          icon: { artwork_key: "effects.0.icon" },
        },
      ],
    },
  };
  expect(uniqueEffect(item)?.image).toBe(image);
  expect(uniqueEffectCatalog([item, effect]).get("fire")?.image).toBe(image);
});
