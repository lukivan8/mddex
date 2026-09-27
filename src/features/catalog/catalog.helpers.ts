import type { CatalogItem } from "./catalog.types";
const labels: Record<string, string> = {
  armor: "Armor",
  artifact: "Artifacts",
  enchantment: "Enchantments",
  melee_weapon: "Melee Weapons",
  ranged_weapon: "Ranged Weapons",
  talisman: "Talismans",
};
export const humanize = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const categoryLabel = (value: string) =>
  labels[value] || humanize(value);
export const getCategories = (items: CatalogItem[]) =>
  [...new Set(items.map((i) => i.category))].sort((a, b) =>
    categoryLabel(a).localeCompare(categoryLabel(b)),
  );
export const getTypes = (items: CatalogItem[], category?: string) =>
  [
    ...new Set(
      items
        .filter((i) => !category || i.category === category)
        .map((i) => i.type),
    ),
  ].sort();
export function buildSearchIndex(items: CatalogItem[]) {
  return new Map(
    items.map((i) => [
      i.slug,
      `${i.variation} ${i.slug} ${categoryLabel(i.category)} ${i.category} ${i.type}`.toLowerCase(),
    ]),
  );
}
