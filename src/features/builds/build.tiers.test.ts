import { expect, it } from "vitest";
import type { CatalogItem } from "../catalog/catalog.types";
import { compose, emptyBuild } from "./build.service";
import { composeSelection } from "./build.selection";
import { availableTiers, selectedTier } from "./build.tiers";
import { buildSummary } from "./build.summary";
import { uniqueEffectCatalog, withUniqueEffects } from "./build.unique";
import { encodeBuildLink, decodeBuildLink } from "./build.link";
import { createBuildCollections } from "./build.db";

const effect: CatalogItem = {
  slug: "acrobat",
  category: "gear_effect",
  type: "utility",
  variation: "Acrobat",
  image: null,
  description: "Reduces rolling cooldown by 10%.",
  game_data: {
    tiers: [
      {
        tier: "III",
        text: "Reduces rolling cooldown by 25%.",
        talisman: false,
      },
      { tier: "I", text: "Reduces rolling cooldown by 10%.", talisman: false },
      { tier: "II", text: "Reduces rolling cooldown by 15%.", talisman: false },
      {
        tier: "unique",
        text: "Reduces rolling cooldown by 40%.",
        talisman: false,
      },
      { tier: "III", text: "Reduces rolling cooldown by 45%.", talisman: true },
    ],
  },
};
const weapon: CatalogItem = {
  slug: "weapon",
  category: "melee_weapon",
  type: "swords",
  variation: "Sword",
  image: null,
};
const unique: CatalogItem = {
  ...weapon,
  slug: "unique-weapon",
  game_data: {
    unique: true,
    effects: [
      {
        catalog_slug: effect.slug,
        tier: "unique",
        text: "Reduces rolling cooldown by 40%.",
      },
    ],
  },
};
const enchantment: CatalogItem = {
  ...effect,
  slug: "enchantment",
  category: "enchantment",
};
const catalog = uniqueEffectCatalog([weapon, unique, effect, enchantment]);
const target = { kind: "effect", slot: "melee", index: 0 } as const;
const equipWeapon = () =>
  compose(emptyBuild(), { kind: "item", slot: "melee" }, weapon, catalog);

it("offers only published equipment tiers, sorted numerically, and defaults to the maximum", () => {
  expect(availableTiers(effect).map((entry) => entry.tier)).toEqual([
    "I",
    "II",
    "III",
  ]);
  expect(selectedTier(effect)?.text).toContain("25%");
  expect(
    availableTiers({
      ...effect,
      game_data: {
        tiers: [null, {}, { tier: "V", text: "bad" }, { tier: "I", text: 1 }],
      },
    }),
  ).toEqual([]);
});

it("selects the max tier from the row and updates explicit tiers without toggling or consuming another slot", () => {
  let build = composeSelection(equipWeapon(), target, effect, catalog);
  expect(build.slots.melee?.effectTiers).toEqual(["III", null, null]);
  build = composeSelection(build, target, effect, catalog, "I");
  expect(build.slots.melee?.effects).toEqual([effect.slug, null, null]);
  expect(build.slots.melee?.effectTiers).toEqual(["I", null, null]);
  build = composeSelection(build, target, effect, catalog, "II");
  expect(
    buildSummary(build, catalog)[0].entries[0].contributions[0].description,
  ).toContain("15%");
  build = composeSelection(build, target, effect, catalog);
  expect(build.slots.melee?.effects).toEqual([null, null, null]);
  expect(build.slots.melee?.effectTiers).toEqual([null, null, null]);
  expect(() =>
    compose(
      equipWeapon(),
      target,
      { ...effect, game_data: { tiers: [] } },
      catalog,
      "III",
    ),
  ).toThrow("tier is not available");
});

it("preserves tiers through unique normalization, equipment replacement, and locked unique summaries", () => {
  const old = emptyBuild();
  const other = { ...effect, slug: "other" };
  const lookup = new Map(catalog).set(other.slug, other);
  old.slots.melee = {
    itemSlug: unique.slug,
    enchantments: [],
    effects: [other.slug, effect.slug],
    effectTiers: ["II", "I"],
  };
  const fixed = withUniqueEffects(old, lookup);
  expect(fixed.slots.melee?.effects).toEqual([effect.slug, other.slug, null]);
  expect(fixed.slots.melee?.effectTiers).toEqual([null, "II", null]);
  const groups = buildSummary(fixed, lookup);
  expect(groups[0].entries[0].contributions[0]).toMatchObject({
    description: "Reduces rolling cooldown by 40%.",
    tier: "unique",
    unique: true,
  });
  expect(groups[0].entries[1].contributions[0].description).toContain("15%");
  expect(() => composeSelection(fixed, target, effect, lookup, "I")).toThrow(
    "locked",
  );
  const ordinary = compose(
    fixed,
    { kind: "item", slot: "melee" },
    weapon,
    lookup,
  );
  expect(ordinary.slots.melee?.effectTiers).toEqual([null, "II", null]);
});

it("renders different tiers as separate contributions and resolves legacy choices to max", () => {
  const build = equipWeapon();
  build.slots.melee!.effects = [effect.slug, effect.slug];
  build.slots.melee!.effectTiers = ["I", "III"];
  const entry = buildSummary(build, catalog)[0].entries[0];
  expect(
    entry.contributions.map((contribution) => contribution.description),
  ).toEqual([
    "Reduces rolling cooldown by 10%.",
    "Reduces rolling cooldown by 25%.",
  ]);
  delete build.slots.melee!.effectTiers;
  expect(
    buildSummary(build, catalog)[0].entries[0].contributions[0].description,
  ).toContain("25%");
});

it("keeps effect and enchantment tiers in local saves and shared links", async () => {
  let build = composeSelection(equipWeapon(), target, effect, catalog, "II");
  build = compose(
    build,
    { kind: "enchantment", slot: "melee", index: 0 },
    enchantment,
    catalog,
    "I",
  );
  expect((await decodeBuildLink(await encodeBuildLink(build))).slots).toEqual(
    build.slots,
  );
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const db = createBuildCollections(storage);
  await db.builds.preload();
  await db.builds.insert(build).isPersisted.promise;
  await db.builds.cleanup();
  await db.preferences.cleanup();
  const reopened = createBuildCollections(storage);
  await reopened.builds.preload();
  expect(reopened.builds.get(build.id)?.slots).toEqual(build.slots);
  await reopened.builds.cleanup();
  await reopened.preferences.cleanup();
});

it("resolves equipment and talisman variants by gear type with plain tier names", async () => {
  const variants: CatalogItem = {
    ...effect,
    game_data: {
      tiers: [
        { tier: "I", talisman: false, text: "Increases Soul capacity by 25%." },
        {
          tier: "III",
          talisman: false,
          text: "Increases Soul capacity by 35%.",
        },
        { tier: "I", talisman: true, text: "Increases Soul capacity by 15%." },
        {
          tier: "III",
          talisman: true,
          text: "Increases Soul capacity by 35%.",
        },
      ],
    },
  };
  const talisman: CatalogItem = {
    ...weapon,
    slug: "soul-chip",
    category: "talisman",
    game_data: {
      levels: [
        {
          level: "1",
          effects: [
            {
              catalog_slug: variants.slug,
              text: "Increases Soul capacity by 15%.",
            },
          ],
        },
        {
          level: "3",
          effects: [
            {
              catalog_slug: variants.slug,
              text: "Increases Soul capacity by 35%.",
            },
          ],
        },
      ],
    },
  };
  expect(selectedTier(variants, "I", "artifact")?.text).toContain("25%");
  expect(selectedTier(variants, "I", "talisman")?.text).toContain("15%");
  expect(
    availableTiers(variants, "talisman").map((entry) => entry.tier),
  ).toEqual(["I", "III"]);
  const lookup = new Map(catalog)
    .set(variants.slug, variants)
    .set(talisman.slug, talisman);
  let build = composeSelection(
    emptyBuild(),
    { kind: "item", slot: "talisman1" },
    talisman,
    lookup,
  );
  expect(build.slots.talisman1?.itemTier).toBe("III");
  build = composeSelection(
    build,
    { kind: "item", slot: "talisman1" },
    talisman,
    lookup,
    "I",
  );
  expect(build.slots.talisman1?.itemTier).toBe("I");
  expect(
    buildSummary(build, lookup)[0].entries[0].contributions[0].description,
  ).toContain("15%");
  expect(
    (await decodeBuildLink(await encodeBuildLink(build))).slots.talisman1
      ?.itemTier,
  ).toBe("I");
});

it("supports a fourth published tier through selection, summary, and shared links", async () => {
  const recovery: CatalogItem = {
    ...effect,
    slug: "recovery",
    game_data: {
      tiers: [
        {
          tier: "IV",
          talisman: false,
          text: "Increases all healing received by 40%.",
        },
        {
          tier: "I",
          talisman: false,
          text: "Increases all healing received by 10%.",
        },
        {
          tier: "II",
          talisman: false,
          text: "Increases all healing received by 20%.",
        },
        {
          tier: "III",
          talisman: false,
          text: "Increases all healing received by 30%.",
        },
        {
          tier: "unique",
          talisman: false,
          text: "Increases all healing received by 50%.",
        },
      ],
    },
  };
  const lookup = new Map(catalog).set(recovery.slug, recovery);
  expect(availableTiers(recovery).map((entry) => entry.tier)).toEqual([
    "I",
    "II",
    "III",
    "IV",
  ]);
  let build = composeSelection(equipWeapon(), target, recovery, lookup);
  expect(build.slots.melee?.effectTiers).toEqual(["IV", null, null]);
  expect(
    buildSummary(build, lookup)[0].entries[0].contributions[0].description,
  ).toContain("40%");
  build = composeSelection(build, target, recovery, lookup, "I");
  build = composeSelection(build, target, recovery, lookup, "IV");
  expect(build.slots.melee?.effects).toEqual([recovery.slug, null, null]);
  expect((await decodeBuildLink(await encodeBuildLink(build))).slots).toEqual(
    build.slots,
  );
});

it("keeps both manual effect tiers when adding or repairing an innate effect", () => {
  const second = { ...effect, slug: "second" };
  const third = { ...effect, slug: "third" };
  const lookup = new Map(catalog)
    .set(second.slug, second)
    .set(third.slug, third);
  const build = equipWeapon();
  build.slots.melee!.effects = [second.slug, null, third.slug];
  build.slots.melee!.effectTiers = ["II", null, "III"];
  const changed = compose(
    build,
    { kind: "item", slot: "melee" },
    unique,
    lookup,
  );
  expect(changed.slots.melee?.effects).toEqual([
    effect.slug,
    second.slug,
    third.slug,
  ]);
  expect(changed.slots.melee?.effectTiers).toEqual([null, "II", "III"]);
  build.slots.melee!.itemSlug = unique.slug;
  const repaired = withUniqueEffects(build, lookup);
  expect(repaired.slots.melee?.effects).toEqual(changed.slots.melee?.effects);
  expect(repaired.slots.melee?.effectTiers).toEqual(
    changed.slots.melee?.effectTiers,
  );
});
