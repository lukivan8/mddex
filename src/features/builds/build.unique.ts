import { referenceArtwork } from "../catalog/catalog.reference-artwork";
import type { CatalogItem } from "../catalog/catalog.types";
import {
  BUILD_SLOTS,
  EFFECT_COUNT,
  supportsEffects,
  type Build,
} from "./build.types";

/** The published innate effect belongs to the unique equipment, regardless of tier. */
export function uniqueEffect(item?: CatalogItem): CatalogItem | undefined {
  if (
    item?.game_data?.unique !== true ||
    !Array.isArray(item.game_data.effects)
  )
    return undefined;
  const effects = item.game_data.effects.filter(
    (effect): effect is Record<string, unknown> =>
      !!effect && typeof effect === "object" && !Array.isArray(effect),
  );
  const effect = effects.find((entry) => entry.tier === "unique") ?? effects[0];
  if (!effect) return undefined;
  const slug =
    typeof effect.catalog_slug === "string" && effect.catalog_slug
      ? effect.catalog_slug
      : `unique-effect:${item.slug}`;
  return {
    slug,
    category: "gear_effect",
    type: "unique",
    variation: typeof effect.name === "string" ? effect.name : "Unique effect",
    description: typeof effect.text === "string" ? effect.text : null,
    image: referenceArtwork(item, effect),
    game_data: { fixed_tier: effect.tier },
  };
}

export function uniqueEffectCatalog(items: CatalogItem[]) {
  const catalog = new Map(items.map((item) => [item.slug, item]));
  for (const item of items) {
    const effect = uniqueEffect(item);
    if (effect) {
      const canonical = catalog.get(effect.slug);
      if (!canonical) catalog.set(effect.slug, effect);
      else if (!canonical.image && effect.image)
        catalog.set(effect.slug, { ...canonical, image: effect.image });
    }
  }
  return catalog;
}

/** Repair older saves and shared links without mutating their original records. */
export function withUniqueEffects(
  build: Build,
  catalog: ReadonlyMap<string, CatalogItem>,
): Build {
  let next = build;
  for (const slot of BUILD_SLOTS) {
    const gear = build.slots[slot];
    if (!gear || !supportsEffects(slot)) continue;
    const fixed = uniqueEffect(catalog.get(gear.itemSlug));
    if (!fixed || gear.effects[0] === fixed.slug) continue;
    if (next === build) next = structuredClone(build);
    next.slots[slot]!.effects = [
      fixed.slug,
      ...gear.effects.filter((slug) => slug && slug !== fixed.slug),
      ...Array(EFFECT_COUNT).fill(null),
    ].slice(0, EFFECT_COUNT);
    if (gear.effectTiers) {
      const keptIndices = gear.effects.flatMap((slug, index) =>
        slug && slug !== fixed.slug ? [index] : [],
      );
      next.slots[slot]!.effectTiers = [
        null,
        ...keptIndices.map((index) => gear.effectTiers![index] ?? null),
        ...Array(EFFECT_COUNT).fill(null),
      ].slice(0, EFFECT_COUNT);
    }
  }
  return next;
}
