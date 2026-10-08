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
export const CATALOG_REFERENCE_CATEGORIES = ["status", "cape", "pet"] as const;
export const CATALOG_DETAIL_CATEGORIES = [
  ...CATALOG_CATEGORIES,
  "mob",
  "location",
  ...CATALOG_REFERENCE_CATEGORIES,
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
  status: "Status Effects",
  cape: "Capes",
  pet: "Pets",
};
export const humanize = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const categoryLabel = (value: string) =>
  labels[value] || humanize(value);
export function isSecretTalisman(item: {
  category: string;
  game_data?: Record<string, unknown> | null;
}) {
  if (item.category !== "talisman") return false;
  const data = item.game_data;
  const acquisition = data?.talismanAcquisition as
    { secret?: boolean } | undefined;
  if (typeof acquisition?.secret === "boolean") return acquisition.secret;
  const wiki = data?.wikily as { kind?: string } | undefined;
  if (typeof wiki?.kind === "string")
    return wiki.kind.toLowerCase() === "secret talisman";
  return (
    Array.isArray(data?.sources) &&
    data.sources.some(
      (source) =>
        source && typeof source === "object" && source.type === "chest",
    )
  );
}
export const getCategories = (items: CatalogItem[]) =>
  CATALOG_CATEGORIES.filter((category) =>
    items.some((item) => item.category === category),
  );
export function matchesCatalogType(
  item: {
    category: string;
    type: string;
    game_data?: Record<string, unknown> | null;
    secretTalisman?: boolean;
  },
  type: string,
) {
  return type === "secret_talismans"
    ? item.secretTalisman === true || isSecretTalisman(item)
    : item.type === type;
}
export const getTypes = (items: CatalogItem[], category?: string) =>
  [
    ...new Set(
      items
        .filter(
          (i) => isCatalogItem(i) && (!category || i.category === category),
        )
        .flatMap((i) =>
          isSecretTalisman(i) ? [i.type, "secret_talismans"] : [i.type],
        ),
    ),
  ].sort();
export function buildSearchIndex(items: CatalogItem[]) {
  return new Map(
    items.map((i) => [
      i.slug,
      `${i.variation} ${i.slug} ${categoryLabel(i.category)} ${i.category} ${i.type} ${isSecretTalisman(i) ? "secret talisman" : ""} ${enchantmentApplicability(i) ?? ""} ${i.description ?? ""} ${uniqueEffectNames(i)}`.toLowerCase(),
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
