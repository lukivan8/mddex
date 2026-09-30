import type { CatalogItem } from "../catalog/catalog.types";
import { compose } from "./build.service";
import {
  EFFECT_COUNT,
  type Build,
  type BuildTarget,
  type ModifierTier,
} from "./build.types";
import { uniqueEffect, withUniqueEffects } from "./build.unique";

/** Keep filled positions visible, with only two placeholders until all three are selected. */
export function visibleEffectIndices(effects: readonly (string | null)[] = []) {
  const indices = Array.from({ length: EFFECT_COUNT }, (_, index) => index);
  const selected = indices.filter((index) => effects[index]);
  const empty = indices.filter((index) => !effects[index]);
  return [
    ...selected,
    ...empty.slice(0, Math.max(0, 2 - selected.length)),
  ].sort((a, b) => a - b);
}

export function selectionTargets(target: BuildTarget): BuildTarget[] {
  if (target.kind === "effect") {
    return Array.from({ length: EFFECT_COUNT }, (_, offset) => ({
      ...target,
      index: (target.index + offset) % EFFECT_COUNT,
    }));
  }
  const group = target.slot.startsWith("artifact")
    ? (["artifact1", "artifact2", "artifact3"] as const)
    : target.slot.startsWith("talisman")
      ? (["talisman1", "talisman2", "talisman3"] as const)
      : null;
  if (!group) return [target];
  const start = group.findIndex((slot) => slot === target.slot);
  return Array.from({ length: group.length }, (_, offset) => ({
    kind: "item",
    slot: group[(start + offset) % group.length],
  }));
}

export function selectedSlug(build: Build, target: BuildTarget) {
  const equipped = build.slots[target.slot];
  return target.kind === "item"
    ? equipped?.itemSlug
    : target.kind === "effect"
      ? equipped?.effects[target.index]
      : equipped?.enchantments[target.index];
}

export function composeSelection(
  build: Build,
  target: BuildTarget,
  item: CatalogItem | null,
  catalog: ReadonlyMap<string, CatalogItem> = new Map(),
  tier?: ModifierTier,
): Build {
  build = withUniqueEffects(build, catalog);
  const gear = build.slots[target.slot];
  const fixed = gear ? uniqueEffect(catalog.get(gear.itemSlug)) : undefined;
  if (target.kind === "effect" && fixed && item?.slug === fixed.slug)
    throw new Error("The unique effect is locked to this equipment.");
  const targets = selectionTargets(target).filter(
    (position) =>
      !(position.kind === "effect" && position.index === 0 && fixed),
  );
  if (targets.length === 1 && target.kind !== "effect")
    return compose(build, target, item, catalog, tier);
  const selected = targets.filter((position) =>
    item
      ? selectedSlug(build, position) === item.slug
      : selectedSlug(build, position),
  );
  if (selected.length) {
    if (item && tier)
      return selected.reduce(
        (next, position) => compose(next, position, item, catalog, tier),
        build,
      );
    return selected.reduce(
      (next, position) => compose(next, position, null, catalog),
      build,
    );
  }
  if (!item) return build;
  const empty = targets.find((position) => !selectedSlug(build, position));
  if (!empty)
    throw new Error(
      `All ${targets.length} slots are filled. Deselect an item first.`,
    );
  return compose(build, empty, item, catalog, tier);
}
