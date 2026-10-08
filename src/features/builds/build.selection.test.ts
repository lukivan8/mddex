import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../catalog/catalog.types";
import { compose, emptyBuild } from "./build.service";
import { composeSelection, selectionTargets } from "./build.selection";
import type { BuildTarget } from "./build.types";
import { decodeBuildLink, encodeBuildLink } from "./build.link";
import { composeItemPower } from "./build.service";

const item = (slug: string, category: string): CatalogItem => ({
  slug,
  category,
  type: category,
  variation: slug,
  image: null,
});

it("edits duplicate artifacts independently and preserves them in share links", async () => {
  const artifact = item("conductive-quiver", "artifact");
  let build = emptyBuild();
  for (const slot of ["artifact1", "artifact2", "artifact3"] as const) {
    const target = { kind: "item", slot } as const;
    expect(selectionTargets(target)).toEqual([target]);
    build = composeSelection(build, target, artifact);
    build = composeSelection(
      build,
      { kind: "effect", slot, index: 0 },
      item(`${slot}-effect`, "gear_effect"),
    );
    build = composeItemPower(build, slot, slot === "artifact1" ? 72 : 100);
  }
  const original = structuredClone(build);
  // Re-selecting a copy must not toggle off any of the equipped copies.
  build = composeSelection(
    build,
    { kind: "item", slot: "artifact2" },
    artifact,
  );
  expect(build.slots).toEqual(original.slots);
  expect((await decodeBuildLink(await encodeBuildLink(build))).slots).toEqual(
    original.slots,
  );
  build = composeSelection(
    build,
    { kind: "item", slot: "artifact2" },
    item("another-artifact", "artifact"),
  );
  expect(build.slots.artifact2?.itemSlug).toBe("another-artifact");
  expect(build.slots.artifact1).toEqual(original.slots.artifact1);
  expect(build.slots.artifact3).toEqual(original.slots.artifact3);
  build = composeSelection(build, { kind: "item", slot: "artifact2" }, null);
  expect(build.slots.artifact2).toBeNull();
  expect(build.slots.artifact1).toEqual(original.slots.artifact1);
  expect(build.slots.artifact3).toEqual(original.slots.artifact3);
});

describe("group selection", () => {
  it.each<BuildTarget>([
    { kind: "effect", slot: "melee", index: 1 },
    { kind: "item", slot: "talisman2" },
  ])(
    "fills empty positions and toggles without overwriting for %j",
    (target) => {
      const category =
        target.kind === "effect"
          ? "gear_effect"
          : target.slot.startsWith("artifact")
            ? "artifact"
            : "talisman";
      let build = compose(
        emptyBuild(),
        { kind: "item", slot: "melee" },
        item("weapon", "melee_weapon"),
      );
      const original = structuredClone(build);
      for (const slug of ["one", "two", "three"])
        build = composeSelection(build, target, item(slug, category));
      if (target.kind === "effect")
        expect(build.slots.melee?.effects).toEqual(["three", "one", "two"]);
      else expect(build.slots[target.slot]?.itemSlug).toBe("one");
      expect(() =>
        composeSelection(build, target, item("four", category)),
      ).toThrow("All 3 slots");
      build = composeSelection(build, target, item("two", category));
      build = composeSelection(build, target, item("four", category));
      expect(JSON.stringify(build.slots)).not.toContain('"two"');
      expect(JSON.stringify(build.slots)).toContain('"four"');
      build = composeSelection(build, target, null);
      expect(build.slots).toEqual(original.slots);
    },
  );

  it("preserves ordinary gear replacement and rejects incompatible items", () => {
    const target = { kind: "item", slot: "melee" } as const;
    let build = composeSelection(
      emptyBuild(),
      target,
      item("one", "melee_weapon"),
    );
    build = composeSelection(build, target, item("two", "melee_weapon"));
    expect(build.slots.melee?.itemSlug).toBe("two");
    expect(() =>
      composeSelection(
        build,
        { kind: "item", slot: "artifact1" },
        item("wrong", "talisman"),
      ),
    ).toThrow("does not fit");
  });
});

describe("published enchantment compatibility", () => {
  const known = {
    ...item("shared", "enchantment"),
    applicable_categories: ["melee_weapon", "ranged_weapon"] as const,
  };
  it("allows multiple equipment categories and rejects incompatible gear", () => {
    const enchantment = {
      ...known,
      applicable_categories: [...known.applicable_categories],
    };
    let build = emptyBuild();
    for (const slot of ["melee", "ranged", "head"] as const) {
      build = compose(
        build,
        { kind: "item", slot },
        {
          ...item(slot, slot === "head" ? "armor" : `${slot}_weapon`),
          type: slot === "head" ? "head" : `${slot}_weapon`,
        },
      );
    }
    for (const slot of ["melee", "ranged"] as const) {
      expect(
        composeSelection(
          build,
          { kind: "enchantment", slot, index: 0 },
          enchantment,
        ).slots[slot]?.enchantments[0],
      ).toBe("shared");
    }
    expect(() =>
      composeSelection(
        build,
        { kind: "enchantment", slot: "head", index: 0 },
        enchantment,
      ),
    ).toThrow("does not fit");
    expect(build.slots.head?.enchantments).toEqual([null]);
  });
});
