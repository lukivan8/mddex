import type { CatalogItem } from "../catalog/catalog.types";
import { modifierTierSchema, type ModifierTier } from "./build.types";

export function talismanLevels(item: CatalogItem) {
  if (item.category !== "talisman" || !Array.isArray(item.game_data?.levels))
    return [];
  return item.game_data.levels.flatMap((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      !("level" in entry)
    )
      return [];
    const tier = modifierTierSchema.safeParse(
      (
        { "1": "I", "2": "II", "3": "III", "4": "IV" } as Record<string, string>
      )[String(entry.level)],
    );
    if (!tier.success) return [];
    const effects =
      "effects" in entry && Array.isArray(entry.effects)
        ? entry.effects.filter(
            (effect): effect is Record<string, unknown> =>
              !!effect && typeof effect === "object" && !Array.isArray(effect),
          )
        : [];
    return [{ tier: tier.data, effects }];
  });
}

export function availableTiers(item: CatalogItem, gearCategory?: string) {
  if (item.category === "talisman")
    return talismanLevels(item)
      .map((level) => ({
        tier: level.tier,
        text:
          level.effects
            .flatMap((effect) =>
              typeof effect.text === "string" ? [effect.text] : [],
            )
            .join(" ") ||
          item.description ||
          "",
      }))
      .sort(
        (a, b) =>
          modifierTierSchema.options.indexOf(a.tier) -
          modifierTierSchema.options.indexOf(b.tier),
      );
  if (!Array.isArray(item.game_data?.tiers)) return [];
  return item.game_data.tiers
    .flatMap((entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry))
        return [];
      const tier =
        "tier" in entry ? modifierTierSchema.safeParse(entry.tier) : undefined;
      return tier?.success &&
        "text" in entry &&
        typeof entry.text === "string" &&
        ("talisman" in entry && entry.talisman === true) ===
          (gearCategory === "talisman")
        ? [{ tier: tier.data, text: entry.text }]
        : [];
    })
    .sort(
      (a, b) =>
        modifierTierSchema.options.indexOf(a.tier) -
        modifierTierSchema.options.indexOf(b.tier),
    );
}

export function selectedTier(
  item: CatalogItem,
  tier?: ModifierTier | null,
  gearCategory?: string,
) {
  const tiers = availableTiers(item, gearCategory);
  return tiers.find((entry) => entry.tier === tier) ?? tiers.at(-1);
}
export function tierDescription(
  item: CatalogItem,
  tier?: ModifierTier | null,
  gearCategory?: string,
) {
  return (
    selectedTier(item, tier, gearCategory)?.text ??
    (Array.isArray(item.game_data?.tiers) ? undefined : item.description)
  );
}
