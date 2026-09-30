import type { CatalogItem } from "./catalog.types";
export const CATALOG_CATEGORIES = [
  "melee_weapon",
  "ranged_weapon",
  "armor",
  "artifact",
  "talisman",
  "enchantment",
  "gear_effect",
] as const;
export const isCatalogItem = (item: Pick<CatalogItem, "category">) =>
  CATALOG_CATEGORIES.some((category) => category === item.category);
export const hasCatalogArtwork = (item: Pick<CatalogItem, "category">) =>
  isCatalogItem(item) ||
  item.category === "location" ||
  item.category === "mob";

const labels: Record<string, string> = {
  mob: "Mobs",
  location: "Locations",
  armor: "Armor",
  artifact: "Artifacts",
  enchantment: "Enchantments",
  melee_weapon: "Melee Weapons",
  ranged_weapon: "Ranged Weapons",
  talisman: "Talismans",
  gear_effect: "Gear Effects",
};
export const humanize = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const categoryLabel = (value: string) =>
  labels[value] || humanize(value);
export const getCategories = (items: CatalogItem[]) =>
  CATALOG_CATEGORIES.filter((category) =>
    items.some((item) => item.category === category),
  );
export const getTypes = (items: CatalogItem[], category?: string) =>
  [
    ...new Set(
      items
        .filter(
          (i) => isCatalogItem(i) && (!category || i.category === category),
        )
        .map((i) => i.type),
    ),
  ].sort();
export function buildSearchIndex(items: CatalogItem[]) {
  return new Map(
    items.map((i) => [
      i.slug,
      `${i.variation} ${i.slug} ${categoryLabel(i.category)} ${i.category} ${i.type} ${enchantmentApplicability(i) ?? ""} ${i.description ?? ""} ${uniqueEffectNames(i)}`.toLowerCase(),
    ]),
  );
}

function uniqueEffectNames(item: CatalogItem) {
  if (item.game_data?.unique !== true || !Array.isArray(item.game_data.effects))
    return "";
  const effects = item.game_data.effects.filter(
    (effect): effect is Record<string, unknown> =>
      !!effect && typeof effect === "object" && !Array.isArray(effect),
  );
  const effect = effects.find((entry) => entry.tier === "unique") ?? effects[0];
  return typeof effect?.name === "string" ? effect.name : "";
}

export function enchantmentApplicability(
  item: Pick<CatalogItem, "category" | "applicable_categories">,
) {
  if (item.category !== "enchantment") return undefined;
  return item.applicable_categories?.length
    ? `To ${item.applicable_categories.map((category) => humanize(category.replace("_weapon", ""))).join(", ")}`
    : "Compatibility unknown";
}
