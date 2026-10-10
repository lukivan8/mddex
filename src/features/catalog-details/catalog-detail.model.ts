import { acquisitionSources } from "./catalog-detail.enrichment";
import { isSecretTalisman } from "../catalog/catalog.helpers";
import { sourceDropChance } from "./drop-chance";
export interface ItemSource {
  description?: string;
  image?: string;
  source_url?: string;
  dropChance?: {
    text: string;
    averageProbability?: number;
    basePoolProbability?: number;
    sourceUrl?: string;
    baseItem?: string;
    uniqueRolls?: string[];
  };
  name: string;
  type: string;
  catalog_slug?: string;
}
export interface Reference {
  description?: string;
  image?: string;
  name: string;
  catalog_slug?: string;
}
export interface Attack {
  damage: number;
  hit_count?: number | null;
  stagger: number;
  range: number;
  speed?: number | null;
  cooldown?: number | null;
  repeat?: number | null;
  weight: string;
}
export interface CatalogItem {
  slug: string;
  category: string;
  type?: string;
  name: string;
  image: string | null;
  artwork?: Record<string, string>;
  description: string | null;
  game_data: {
    talismanAcquisition?: { secret: boolean; location?: string };
    status?: {
      alignment?: string;
      gear: Reference[];
      mobs: Reference[];
      immune: Reference[];
    };
    cosmeticUnlock?: string;
    slug?: string;
    unique?: boolean | null;
    effects?:
      | {
          name: string;
          catalog_slug?: string;
          text?: string | null;
          tier?: string | null;
        }[]
      | null;
    ranged?: {
      ammo?: number | null;
      range?: number | null;
      reload?: number | null;
      fire_rate?: number | null;
      charge_time?: number | null;
      charge_damage?: number | null;
      volleys?: number | null;
      projectiles?: {
        count?: number | null;
        damage?: number | null;
        stagger?: number | null;
        spread?: number | null;
        speed?: number | null;
        pierce?: boolean | null;
      }[];
    } | null;
    artifact?: { cooldown?: number | null; soul_cost?: number | null } | null;
    levels?:
      | {
          level: string;
          xp?: number | null;
          effects?: {
            name: string;
            catalog_slug?: string;
            text?: string | null;
          }[];
        }[]
      | null;
    tiers?: { tier: string; text?: string | null; talisman?: boolean }[] | null;
    slot?: string | null;
    set?: string | null;
    baseSet?: string | null;
    health?: number | null;
    speed?: number | null;
    poise?: number | null;
    mobKind?: string | null;
    attacks?:
      | {
          attack: string;
          damage?: number | null;
          cooldown?: number | null;
          splash?: number | null;
          element?: string | null;
        }[]
      | null;
    resist?: { type: string; multiplier: number }[] | null;
    forms?:
      | {
          label: string;
          health?: number | null;
          speed?: number | null;
          damage?: number | null;
          poise?: number | null;
          souls?: number | null;
        }[]
      | null;
    areas?: Reference[] | null;
    fights?:
      | {
          kind: string;
          quest?: string | null;
          place?: string | null;
          catalog_slug?: string;
          regions?: Reference[];
        }[]
      | null;
    minions?: Reference[] | null;
    baseMob?: Reference | null;
    summonedBy?: Reference | null;
    summons?: Reference | null;
    carriers?: Reference[] | null;
    gear?: string[] | null;
    slots?: string[] | null;
    category?: string | null;
    level?: number | null;
    subAreas?: string[] | null;
    minibosses?: Reference[] | null;
    arena?: Reference[] | null;
    souls?: number | null;
    mobs?: Reference[] | null;
    loot?: Reference[] | null;
    sources: ItemSource[];
    drops: Reference[];
    base: Reference | null;
    uniqueVariant: Reference | null;
    melee: { combo: Attack[]; jump: Attack | null; combo_reset: number } | null;
  };
}
const categories: Record<string, string> = {
  melee_weapon: "melee-weapons",
  ranged_weapon: "ranged-weapons",
  gear_effect: "gear-effects",
  mob: "mobs",
  location: "locations",
  talisman: "talismans",
  enchantment: "enchantments",
  artifact: "artifacts",
};
export function itemPath(item: CatalogItem): string {
  return `/catalog/${categories[item.category] ?? item.category}/${item.game_data.slug ?? item.slug}`;
}
export function dropSources(
  item: CatalogItem,
  catalog: readonly CatalogItem[],
): ItemSource[] {
  const listed = item.game_data.sources.filter(
    (source) => source.type === "area" || source.type === "mob",
  );
  const mobDrops: ItemSource[] = catalog
    .filter(
      (mob) =>
        mob.category === "mob" &&
        mob.game_data.drops.some((drop) => drop.catalog_slug === item.slug),
    )
    .map((mob) => ({ name: mob.name, type: "mob", catalog_slug: mob.slug }));
  const unique = new Map<string, ItemSource>();
  for (const source of [...listed, ...acquisitionSources(item), ...mobDrops]) {
    if (/^(?:the )?deep dark dungeons$/i.test(source.name.trim())) continue;
    const key = source.catalog_slug ?? `${source.type}:${source.name}`;
    const old = unique.get(key);
    const description = [
      ...new Set([old?.description, source.description].filter(Boolean)),
    ].join(" ");
    unique.set(key, {
      ...old,
      ...source,
      ...(description ? { description } : {}),
    });
  }
  const sources = [...unique.values()].map((source) => {
    const dropChance = sourceDropChance(item, source);
    return dropChance ? { ...source, dropChance } : source;
  });
  const baseItem =
    sources.find((source) => source.dropChance?.baseItem)?.dropChance
      ?.baseItem ?? item.game_data.base?.name;
  return sources.map((source) => {
    const repeated = baseItem && `Unique rarity variant of ${baseItem}`;
    const description = repeated
      ? source.description?.replace(repeated, "").trim() || undefined
      : source.description;
    return { ...source, description };
  });
}

export function isChestTalisman(item: CatalogItem): boolean {
  return (
    item.category === "talisman" &&
    item.game_data.sources.some((source) => source.type === "chest")
  );
}

export function talismanAcquisitionNotes(item: CatalogItem): string[] {
  if (!isSecretTalisman(item)) return [];
  const instructions = item.game_data.sources
    .filter(
      (source) =>
        source.type === "chest" &&
        !/^(?:talisman )?chest$/i.test(source.name.trim()),
    )
    .map((source) => source.name.trim());
  return [
    ...new Set(
      [item.game_data.talismanAcquisition?.location, ...instructions].filter(
        (note): note is string => Boolean(note),
      ),
    ),
  ];
}

export function detailCategory(category: string) {
  return categories[category] ?? category;
}
