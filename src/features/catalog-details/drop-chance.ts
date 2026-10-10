import type { CatalogItem, ItemSource } from "./catalog-detail.model";

type Data = Record<string, unknown>;
function record(value: unknown): Data {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : {};
}
function rows(value: unknown): Data[] {
  return Array.isArray(value) ? value.map(record) : [];
}
function probability(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}
export function formatDropPercent(value: number) {
  const scaled = value * 100;
  return `${scaled > 0 && scaled < 0.0001 ? "<0.0001" : scaled.toLocaleString("en", { maximumFractionDigits: scaled < 0.01 ? 4 : 2 })}%`;
}

/** Keep source baseline odds separate from unverified threat-weight composition. */
export function sourceDropChance(item: CatalogItem, source: ItemSource) {
  const data = record((item.game_data as Data).drop_chances);
  if (
    data.schema_version !== 1 ||
    data.item_catalog_slug !== item.slug ||
    rows(data.source_conflicts).length
  )
    return undefined;
  const entry = rows(data.sources).find(
    (entry) =>
      entry.type === source.type &&
      (source.catalog_slug
        ? entry.catalog_slug === source.catalog_slug
        : source.source_url && entry.href === source.source_url),
  );
  if (!entry) return undefined;
  const unique = data.variant === "unique";
  const artifact = data.variant === "artifact" && item.category === "artifact";
  if (!unique && !artifact && data.variant !== "base_non_unique")
    return undefined;
  const pool = record(entry.pool_share).probability;
  if (artifact && (entry.type !== "area" || !probability(pool)))
    return undefined;
  const outcomes = rows(entry.outcomes).filter((outcome) => {
    const conditions = record(outcome.conditions);
    const difficulties = conditions.difficulty;
    return (
      ["regular_enemy", "wooden_chest", "fancy_chest", "miniboss"].includes(
        String(outcome.drop_source),
      ) &&
      outcome.rarity ===
        (artifact ? "any" : unique ? "unique" : "any_non_unique") &&
      probability(outcome.probability) &&
      typeof outcome.denominator === "string" &&
      (artifact
        ? outcome.denominator.startsWith(
            "One item selected from this area pool,",
          ) &&
          outcome.probability === pool &&
          difficulties == null
        : outcome.denominator.startsWith("One gear/item drop") &&
          Array.isArray(difficulties) &&
          difficulties.includes("normal") &&
          difficulties.includes("hard")) &&
      conditions.threat_level == null
    );
  });
  if (!outcomes.length) return undefined;
  const values = outcomes.map((outcome) => outcome.probability as number);
  const base = record(entry.base_item).name;
  const conversions = outcomes.map((outcome) => outcome.rarity_given_base);
  const averageProbability =
    values.reduce((sum, value) => sum + value, 0) / values.length;
  let text = `≈${formatDropPercent(averageProbability)} ${artifact ? "pool share" : "average"}`;
  let baseItem: string | undefined;
  let uniqueRolls: string[] | undefined;
  if (
    unique &&
    typeof base === "string" &&
    base.trim() &&
    probability(pool) &&
    conversions.every(probability)
  ) {
    baseItem = base;
    text = `As ${base} (≈${formatDropPercent(pool)})`;
    const labels: Record<string, string> = {
      regular_enemy: "regular enemies",
      wooden_chest: "wooden chests",
      fancy_chest: "fancy chests",
      miniboss: "minibosses",
    };
    uniqueRolls = outcomes.map(
      (outcome) =>
        `${labels[String(outcome.drop_source)]}: ${formatDropPercent(outcome.rarity_given_base as number)}`,
    );
  }
  const url = entry.source_url;
  return {
    text,
    averageProbability,
    ...(baseItem
      ? { baseItem, basePoolProbability: pool as number, uniqueRolls }
      : {}),
    ...(typeof url === "string" && url.startsWith("https://metabot.gg/")
      ? { sourceUrl: url }
      : {}),
  };
}
