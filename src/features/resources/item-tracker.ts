import type { CatalogItem } from "../catalog/catalog.types";

export const TRACKER_CATEGORIES = [
  "melee_weapon",
  "ranged_weapon",
  "armor",
  "artifact",
  "talisman",
  "enchantment",
] as const;
export type TrackerCategory = (typeof TRACKER_CATEGORIES)[number];
export type TrackerMark =
  | "common"
  | "rare"
  | "special"
  | "unique"
  | "soul"
  | "soul_common"
  | "soul_rare"
  | "soul_special"
  | "soul_unique"
  | "collected";
export type TrackerFamily = {
  id: string;
  base?: CatalogItem;
  unique?: CatalogItem;
};
export const TRACKER_STORAGE_KEY = "mddex-item-tracker-v1";
export const markKey = (item: CatalogItem, mark: TrackerMark) =>
  `${item.slug}:${mark}`;
export function trackerMarks(item: CatalogItem): TrackerMark[] {
  if (item.category === "talisman" || item.category === "enchantment")
    return ["collected"];
  const unique = item.game_data?.unique === true;
  const listed = Array.isArray(item.game_data?.rarities)
    ? item.game_data.rarities
    : [];
  const marks: TrackerMark[] = unique
    ? ["unique"]
    : (["common", "rare", "special"].filter(
        (mark) => !listed.length || listed.includes(mark),
      ) as TrackerMark[]);
  if (["melee_weapon", "ranged_weapon", "armor"].includes(item.category))
    if (unique) marks.push("soul_unique");
    else if (marks.includes("special")) marks.push("soul_special");
  return marks;
}
function linkedSlug(value: unknown): string | undefined {
  return value &&
    typeof value === "object" &&
    "catalog_slug" in value &&
    typeof value.catalog_slug === "string"
    ? value.catalog_slug
    : undefined;
}
export function trackerFamilies(
  catalog: CatalogItem[],
  category: TrackerCategory,
): TrackerFamily[] {
  const items = catalog.filter(
    (item) =>
      item.category === category &&
      item.game_data?.availability !== "unavailable",
  );
  if (category === "enchantment")
    return items
      .sort((a, b) => a.variation.localeCompare(b.variation))
      .map((item) => ({ id: item.slug, base: item }));
  const bases = items.filter((item) => item.game_data?.unique !== true);
  const uniques = items.filter((item) => item.game_data?.unique === true);
  const used = new Set<string>();
  const families: TrackerFamily[] = bases.map((base) => {
    const unique = uniques.find(
      (item) =>
        !used.has(item.slug) &&
        (linkedSlug(item.game_data?.base) === base.slug ||
          linkedSlug(base.game_data?.uniqueVariant) === item.slug),
    );
    if (unique) used.add(unique.slug);
    return { id: base.slug, base, unique };
  });
  for (const unique of uniques)
    if (!used.has(unique.slug))
      families.push({ id: unique.slug, base: undefined, unique });
  return families.sort((a, b) =>
    (a.base ?? a.unique)!.variation.localeCompare(
      (b.base ?? b.unique)!.variation,
    ),
  );
}
export function familyKeys(family: TrackerFamily): string[] {
  return [family.base, family.unique].flatMap((item) =>
    item ? trackerMarks(item).map((mark) => markKey(item, mark)) : [],
  );
}
export function parseTrackerSave(raw: string | null): Set<string> {
  if (!raw) return new Set();
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    (value.version !== 1 && value.version !== 2) ||
    !("collected" in value) ||
    !Array.isArray(value.collected) ||
    value.collected.length > 10000 ||
    !value.collected.every((key) => typeof key === "string" && key.length < 300)
  )
    throw new Error("Invalid tracker save");
  const collected = new Set<string>(value.collected);
  for (const key of value.collected) {
    const separator = key.lastIndexOf(":");
    const slug = key.slice(0, separator);
    let mark = key.slice(separator + 1) as TrackerMark;
    const legacySoul = mark === "soul_common" || mark === "soul_rare";
    if (legacySoul) {
      collected.delete(key);
      mark = "soul_special";
      collected.add(`${slug}:${mark}`);
    }
    if (value.version === 2 && !legacySoul) continue;
    const included =
      mark === "soul_special"
        ? RARITY_ORDER
        : mark === "soul_unique"
          ? ["unique"]
          : RARITY_ORDER.slice(0, Math.max(0, RARITY_ORDER.indexOf(mark)));
    for (const previous of included) collected.add(`${slug}:${previous}`);
  }
  return collected;
}
export function trackerProgress(
  keys: string[],
  collected: ReadonlySet<string>,
) {
  const unique = [...new Set(keys)];
  return {
    count: unique.filter((key) => collected.has(key)).length,
    total: unique.length,
  };
}

const RARITY_ORDER: TrackerMark[] = ["common", "rare", "special"];
export function soulMark(mark: TrackerMark): TrackerMark {
  return `soul_${mark}` as TrackerMark;
}
/** Older generic soul checks become the eligible Special or Unique soul variant. */
export function upgradeTrackerSave(
  collected: ReadonlySet<string>,
  catalog: CatalogItem[],
): Set<string> {
  let next = new Set(collected);
  for (const item of catalog) {
    const legacy = ["soul", "soul_common", "soul_rare"] as const;
    const hasLegacy = legacy.some((mark) => next.has(markKey(item, mark)));
    const soul = trackerMarks(item).find((mark) => mark.startsWith("soul_"));
    if (soul && hasLegacy) {
      for (const mark of legacy) next.delete(markKey(item, mark));
      next = setTrackerMark(next, item, soul, true);
    }
  }
  return next;
}
export function trackerPreviewMarks(
  item: CatalogItem,
  mark: TrackerMark,
  collected?: ReadonlySet<string>,
): TrackerMark[] {
  if (
    collected &&
    trackerMarks(item).some((entry) => collected.has(markKey(item, entry)))
  )
    return trackerMarks(item).includes(mark) ? [mark] : [];
  const included =
    mark === "soul_special"
      ? [...RARITY_ORDER, mark]
      : mark === "soul_unique"
        ? ["unique" as const, mark]
        : RARITY_ORDER.includes(mark)
          ? RARITY_ORDER.slice(0, RARITY_ORDER.indexOf(mark) + 1)
          : [mark];
  return included.filter((entry) => trackerMarks(item).includes(entry));
}
export function setTrackerMark(
  collected: ReadonlySet<string>,
  item: CatalogItem,
  mark: TrackerMark,
  checked: boolean,
): Set<string> {
  const next = new Set(collected);
  const affected = checked
    ? trackerPreviewMarks(item, mark, collected)
    : [mark];
  for (const entry of affected) {
    if (checked) next.add(markKey(item, entry));
    else next.delete(markKey(item, entry));
  }
  return next;
}

export function cycleTrackerItem(
  collected: ReadonlySet<string>,
  item: CatalogItem,
): Set<string> {
  const marks = trackerMarks(item);
  const highest = marks.reduce(
    (index, mark, current) =>
      collected.has(markKey(item, mark)) ? current : index,
    -1,
  );
  const next = new Set(collected);
  for (const mark of marks) next.delete(markKey(item, mark));
  return highest + 1 < marks.length
    ? setTrackerMark(next, item, marks[highest + 1], true)
    : next;
}
