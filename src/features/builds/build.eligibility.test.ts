import { describe, expect, it } from "vitest";
import { isCompatible, incompatibleModifiers } from "./build.compatibility";
import { compose, emptyBuild } from "./build.service";
import { pickerItems } from "./build.selectors";
import { buildSearchIndex } from "../catalog/catalog.helpers";
import type { CatalogItem } from "../catalog/catalog.types";
const definition = (
  slug: string,
  category: string,
  game_data: Record<string, unknown> = {},
): CatalogItem => ({
  slug,
  category,
  type: category === "armor" ? "torso" : "attack",
  variation: slug,
  image: null,
  game_data,
});
const effect = definition("allowed", "gear_effect");
const excluded = definition("excluded", "gear_effect");
const enchantment = definition("chest-only", "enchantment", {
  slots: ["Chest"],
});
const gear = definition("chest", "armor", {
  rollable_effects: { effects: [{ catalog_slug: effect.slug }] },
  enchantment_options: { enchantments: [{ catalog_slug: enchantment.slug }] },
});
const target = { kind: "effect", slot: "torso", index: 0 } as const;
describe("published gear eligibility", () => {
  it("filters per-item pools and rejects programmatic ineligible selections", () => {
    const catalog = [gear, effect, excluded, enchantment];
    expect(
      pickerItems(catalog, target, "", buildSearchIndex(catalog), "", gear).map(
        (item) => item.slug,
      ),
    ).toEqual([effect.slug]);
    const map = new Map(catalog.map((item) => [item.slug, item]));
    const build = compose(
      emptyBuild(),
      { kind: "item", slot: "torso" },
      gear,
      map,
    );
    expect(() => compose(build, target, excluded, map)).toThrow("does not fit");
    expect(compose(build, target, effect, map).slots.torso?.effects[0]).toBe(
      effect.slug,
    );
  });
  it("honors a positive item-specific pool over coarse category restrictions", () => {
    const rangedEffect = {
      ...effect,
      applicable_categories: [
        "ranged_weapon",
      ] as CatalogItem["applicable_categories"],
    };
    const quiver = definition("quiver", "artifact", {
      rollable_effects: { effects: [{ catalog_slug: effect.slug }] },
    });
    expect(
      isCompatible(
        rangedEffect,
        { kind: "effect", slot: "artifact1", index: 0 },
        quiver,
      ),
    ).toBe(true);
    expect(
      isCompatible(rangedEffect, {
        kind: "effect",
        slot: "artifact1",
        index: 0,
      }),
    ).toBe(false);
  });
  it("enforces Chest-only enchantments even without item-specific lists", () => {
    expect(
      isCompatible(enchantment, {
        kind: "enchantment",
        slot: "torso",
        index: 0,
      }),
    ).toBe(true);
    for (const slot of ["head", "legs", "feet", "melee", "ranged"] as const)
      expect(
        isCompatible(enchantment, { kind: "enchantment", slot, index: 0 }),
      ).toBe(false);
  });
  it("distinguishes an explicit empty pool from missing, malformed and unresolved evidence", () => {
    expect(
      isCompatible(
        effect,
        target,
        definition("none", "armor", { rollable_effects: { effects: [] } }),
      ),
    ).toBe(false);
    for (const game_data of [
      {},
      { rollable_effects: { effects: "bad" } },
      { rollable_effects: { effects: [{ name: "Unknown" }] } },
    ])
      expect(
        isCompatible(effect, target, definition("unknown", "armor", game_data)),
      ).toBe(true);
  });
  it("keeps saved choices intact, reports incompatibility, and clears rejected tiers on gear replacement", () => {
    const map = new Map(
      [gear, effect, excluded, enchantment].map((item) => [item.slug, item]),
    );
    const build = emptyBuild();
    build.slots.torso = {
      itemSlug: gear.slug,
      effects: [excluded.slug, effect.slug],
      effectTiers: ["III", "II"],
      enchantments: [enchantment.slug],
      enchantmentTier: "II",
    };
    expect(incompatibleModifiers(build, map)).toEqual([
      "excluded does not fit chest.",
    ]);
    expect(build.slots.torso.effects[0]).toBe(excluded.slug);
    const replacement = definition("replacement", "armor", {
      rollable_effects: { effects: [{ catalog_slug: effect.slug }] },
      enchantment_options: { enchantments: [] },
    });
    const next = compose(
      build,
      { kind: "item", slot: "torso" },
      replacement,
      map,
    );
    expect(next.slots.torso?.effects).toEqual([null, effect.slug]);
    expect(next.slots.torso?.effectTiers).toEqual([null, "II"]);
    expect(next.slots.torso?.enchantments).toEqual([null]);
    expect(next.slots.torso?.enchantmentTier).toBeNull();
  });
  it("preserves fixed unique effects outside the random pool", () => {
    const unique = definition("unique", "armor", {
      ...gear.game_data,
      unique: true,
      effects: [{ catalog_slug: excluded.slug, tier: "unique", name: "Fixed" }],
    });
    const map = new Map(
      [unique, effect, excluded].map((item) => [item.slug, item]),
    );
    const build = compose(
      emptyBuild(),
      { kind: "item", slot: "torso" },
      unique,
      map,
    );
    expect(build.slots.torso?.effects[0]).toBe(excluded.slug);
    expect(incompatibleModifiers(build, map)).toEqual([]);
    expect(() => compose(build, target, null, map)).toThrow("locked");
  });
});
