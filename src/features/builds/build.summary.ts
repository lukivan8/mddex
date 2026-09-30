import type { CatalogItem } from "../catalog/catalog.types";
import { BUILD_SLOTS, type Build } from "./build.types";
import { slotRules } from "./build.compatibility";
import {
  availableTiers,
  selectedTier,
  tierDescription,
  talismanLevels,
} from "./build.tiers";
import { uniqueEffect } from "./build.unique";

export type SummaryEntry = {
  slug: string;
  item?: CatalogItem;
  sources: string[];
  contributions: {
    source: string;
    description?: string | null;
    tier?: string;
    unique?: boolean;
  }[];
};
export type SummaryGroup = { label: string; entries: SummaryEntry[] };
const effectGroup = (type?: string) =>
  type === "defense"
    ? "Defense"
    : type === "attack"
      ? "Attack"
      : type === "utility"
        ? "Utility"
        : "Other effects";

export function buildSummary(
  build: Build,
  catalog: ReadonlyMap<string, CatalogItem>,
): SummaryGroup[] {
  const groups = new Map<string, Map<string, SummaryEntry>>();
  const add = (
    group: string,
    slug: string,
    contribution: SummaryEntry["contributions"][number],
  ) => {
    let entries = groups.get(group);
    if (!entries) groups.set(group, (entries = new Map()));
    const existing = entries.get(slug);
    if (existing) {
      existing.sources.push(contribution.source);
      existing.contributions.push(contribution);
    } else
      entries.set(slug, {
        slug,
        item: catalog.get(slug),
        sources: [contribution.source],
        contributions: [contribution],
      });
  };
  for (const slot of BUILD_SLOTS) {
    const gear = build.slots[slot];
    if (!gear) continue;
    const equipment = catalog.get(gear.itemSlug);
    const source = `${slotRules[slot].label} · ${equipment?.variation ?? "Unavailable item"}`;
    const fixed = uniqueEffect(equipment);
    if (equipment?.category === "talisman") {
      const tier = selectedTier(equipment, gear.itemTier, "talisman")?.tier;
      const level = talismanLevels(equipment).find(
        (entry) => entry.tier === tier,
      );
      for (const [index, effect] of (level?.effects ?? []).entries()) {
        const slug =
          typeof effect.catalog_slug === "string"
            ? effect.catalog_slug
            : `talisman-effect:${equipment.slug}:${index}`;
        const item = catalog.get(slug);
        add(effectGroup(item?.type), slug, {
          source,
          tier,
          description: item
            ? (availableTiers(item, "talisman").find(
                (entry) => entry.tier === tier,
              )?.text ??
              (typeof effect.text === "string" ? effect.text : undefined))
            : typeof effect.text === "string"
              ? effect.text
              : undefined,
        });
      }
    }
    for (const [index, slug] of gear.effects.entries()) {
      if (!slug) continue;
      const type = catalog.get(slug)?.type;
      const group = effectGroup(type);
      const item = catalog.get(slug);
      const innate = index === 0 && fixed?.slug === slug ? fixed : undefined;
      add(group, slug, {
        source,
        description:
          innate?.description ??
          (item
            ? tierDescription(
                item,
                gear.effectTiers?.[index],
                equipment?.category,
              )
            : undefined),
        tier: innate
          ? typeof innate.game_data?.fixed_tier === "string"
            ? innate.game_data.fixed_tier
            : "unique"
          : item
            ? selectedTier(item, gear.effectTiers?.[index], equipment?.category)
                ?.tier
            : undefined,
        unique: !!innate,
      });
    }
    for (const slug of gear.enchantments)
      if (slug) {
        const item = catalog.get(slug);
        add("Enchantments", slug, {
          source,
          description: item
            ? tierDescription(item, gear.enchantmentTier)
            : undefined,
          tier: item
            ? selectedTier(item, gear.enchantmentTier)?.tier
            : undefined,
        });
      }
  }
  return [
    "Defense",
    "Attack",
    "Utility",
    "Other effects",
    "Enchantments",
  ].flatMap((label) => {
    const entries = groups.get(label);
    return entries ? [{ label, entries: [...entries.values()] }] : [];
  });
}
