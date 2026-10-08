import { referenceArtwork } from "../catalog/catalog.reference-artwork";
import type { CatalogItem } from "../catalog/catalog.types";

export const EFFECT_GEAR_CATEGORIES = [
  "melee_weapon",
  "ranged_weapon",
  "armor",
  "artifact",
];

export function gearEffects(
  item: CatalogItem,
  catalog: ReadonlyMap<string, CatalogItem>,
): CatalogItem[] {
  if (!EFFECT_GEAR_CATEGORIES.includes(item.category)) return [];
  const data = item.game_data;
  const references: unknown[] = Array.isArray(data?.effects)
    ? [...data.effects]
    : [];
  const pool = data?.rollable_effects;
  if (
    pool &&
    typeof pool === "object" &&
    "effects" in pool &&
    Array.isArray(pool.effects)
  )
    references.push(...pool.effects);
  const effects = new Map<string, CatalogItem>();
  for (const reference of references) {
    if (!reference || typeof reference !== "object") continue;
    const entry = reference as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const linked =
      typeof entry.catalog_slug === "string"
        ? catalog.get(entry.catalog_slug)
        : undefined;
    const canonical =
      linked ??
      (name
        ? [...catalog.values()].find(
            (effect) =>
              effect.category === "gear_effect" &&
              effect.variation.toLowerCase() === name.toLowerCase(),
          )
        : undefined);
    if (canonical)
      effects.set(canonical.slug, {
        ...canonical,
        image: canonical.image ?? referenceArtwork(item, entry),
      });
    else if (name || typeof entry.text === "string") {
      const label = name || String(entry.text);
      const slug =
        typeof entry.catalog_slug === "string"
          ? entry.catalog_slug
          : `built-in-effect:${label.toLowerCase()}`;
      effects.set(slug, {
        slug,
        variation: label,
        category: "gear_effect",
        type: "unique",
        image: referenceArtwork(item, entry),
        description: typeof entry.text === "string" ? entry.text : null,
      });
    }
  }
  return [...effects.values()];
}
