import { describe, expect, it } from "vitest";
import { catalogItemSchema } from "./catalog.schema";
import { isCompatible } from "../builds/build.compatibility";
import {
  getCatalogItemView,
  getVisibleItemViews,
} from "../collection/collection.presentation";
import type { CatalogItem } from "./catalog.types";
import { buildSearchIndex } from "./catalog.helpers";
import { pickerItems } from "../builds/build.selectors";
const enchantment: CatalogItem = {
  slug: "test-enchantment",
  variation: "Test Enchantment",
  category: "enchantment",
  type: "enchantment",
  image: null,
};

describe("enchantment metadata", () => {
  it("parses known categories and accepts missing or unknown metadata", () => {
    for (const applicable_categories of [
      undefined,
      null,
      [],
      ["melee_weapon", "armor"],
    ]) {
      expect(
        catalogItemSchema.parse({ ...enchantment, applicable_categories })
          .applicable_categories,
      ).toEqual(applicable_categories);
    }
    expect(
      catalogItemSchema.safeParse({
        ...enchantment,
        applicable_categories: ["talisman"],
      }).success,
    ).toBe(false);
  });
  it("treats unverified compatibility as unknown rather than incompatible", () => {
    for (const applicable_categories of [undefined, null, []]) {
      for (const slot of [
        "melee",
        "ranged",
        "head",
        "torso",
        "legs",
        "feet",
      ] as const) {
        expect(
          isCompatible(
            { ...enchantment, applicable_categories },
            { kind: "enchantment", slot, index: 0 },
          ),
        ).toBe(true);
      }
    }
  });
  it("filters the picker by target equipment, including all armor positions", () => {
    const items: CatalogItem[] = [
      { ...enchantment, slug: "armor", applicable_categories: ["armor"] },
      {
        ...enchantment,
        slug: "weapons",
        applicable_categories: ["melee_weapon", "ranged_weapon"],
      },
      enchantment,
    ];
    for (const slot of [
      "head",
      "torso",
      "legs",
      "feet",
      "melee",
      "ranged",
    ] as const) {
      expect(
        pickerItems(
          items,
          { kind: "enchantment", slot, index: 0 },
          "",
          buildSearchIndex(items),
        )
          .map((entry) => entry.slug)
          .sort(),
      ).toEqual(
        [
          slot === "melee" || slot === "ranged" ? "weapons" : "armor",
          enchantment.slug,
        ].sort(),
      );
    }
  });
  it("shows and filters enchantment applicability", () => {
    const known = {
      ...enchantment,
      applicable_categories: [
        "melee_weapon",
        "armor",
      ] as CatalogItem["applicable_categories"],
    };
    const shown = getCatalogItemView(known);
    const unknown = getCatalogItemView({ ...enchantment, slug: "unknown" });
    expect(shown.applicability).toBe("To Melee, Armor");
    expect(unknown.applicability).toBe("Compatibility unknown");
    const views = [shown, unknown];
    expect(getVisibleItemViews(views, { q: "armor" })).toEqual([shown]);
    expect(getVisibleItemViews(views, { appliesTo: "melee_weapon" })).toEqual([
      shown,
    ]);
    expect(getVisibleItemViews(views, { appliesTo: "ranged_weapon" })).toEqual(
      [],
    );
    expect(getVisibleItemViews(views, { appliesTo: "unknown" })).toEqual([
      unknown,
    ]);
  });
});
