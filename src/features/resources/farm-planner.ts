import { BUILD_SLOTS, type Build } from "../builds/build.types";
import { formatDropPercent } from "../catalog-details/drop-chance";
import { uniqueEffectCatalog } from "../builds/build.unique";
import type { CatalogItem as PublishedItem } from "../catalog/catalog.types";
import { normalizeDetailItem } from "../catalog-details/catalog-detail.loader";
import {
  dropSources,
  itemPath,
  talismanAcquisitionNotes,
  type ItemSource,
} from "../catalog-details/catalog-detail.model";
import { questRewardTargets } from "../catalog-details/catalog-detail.enrichment";

export type RecommendedBoss = {
  name: string;
  slug: string;
  image?: string;
  path?: string;
};
// Farming recommendations supplied by the site owner.
export const recommendedBosses = [
  {
    location: "rainy-plains",
    name: "Copper Monstrosity",
    slug: "mob-copper-monstrosity",
  },
  {
    location: "lullaby-hills",
    name: "Redstone Monstrosity",
    slug: "mob-redstone-monstrosity",
  },
  {
    location: "howling-woods",
    name: "Soul Corrupted Witch",
    slug: "mob-soul-corrupted-witch",
  },
  {
    location: "frozen-highlands",
    name: "Prime Enchanter",
    slug: "mob-the-prime-enchanter",
  },
  { location: "deep-dark", name: "Twisted Warden", slug: "mob-twisted-warden" },
  {
    location: "singers-meadow",
    name: "Sculk Monstrosity",
    slug: "mob-sculk-monstrosity",
  },
] as const;
export function recommendedBoss(
  source: Pick<ItemSource, "type" | "name" | "catalog_slug">,
  catalog: readonly PublishedItem[] = [],
): RecommendedBoss | undefined {
  if (source.type !== "area") return undefined;
  const location = (source.catalog_slug ?? source.name)
    .toLowerCase()
    .replace(/^location-/, "")
    .replace(/^the[ -]/, "")
    .replace(/'/g, "")
    .replace(/\s+/g, "-");
  const recommendation = recommendedBosses.find(
    (entry) => entry.location === location,
  );
  if (!recommendation) return undefined;
  const item = catalog.find((item) => item.slug === recommendation.slug);
  return {
    name: recommendation.name,
    slug: recommendation.slug,
    image: item?.image ?? undefined,
    path: item ? itemPath(normalizeDetailItem(item)) : undefined,
  };
}
export type FarmOption = ItemSource & {
  key: string;
  path?: string;
  quest?: string;
  recommendedBoss?: RecommendedBoss;
  bossEligible?: boolean;
  bossFarm?: boolean;
};
export type FarmTarget = {
  slug: string;
  name: string;
  image: string | null;
  path?: string;
  slots: string[];
  options: FarmOption[];
  notes: string[];
  error?: string;
  oneTime?: boolean;
  effectSets?: {
    slot: string;
    effects: { slug: string; name: string; image: string | null }[];
  }[];
};
export type FarmStop = {
  key: string;
  name: string;
  type: string;
  image?: string;
  path?: string;
  quest?: string;
  recommendedBoss?: RecommendedBoss;
  bossFarm?: boolean;
  targets: { target: FarmTarget; source: FarmOption }[];
};
export const farmTypes = new Set(["area", "mob", "dungeon", "rift", "quest"]);
export function buildFarmItems(slots: Build["slots"]) {
  const items = new Map<string, string[]>();
  for (const slot of BUILD_SLOTS) {
    const gear = slots[slot];
    if (!gear) continue;
    const add = (slug: string, label: string) =>
      items.set(slug, [...(items.get(slug) ?? []), label]);
    add(gear.itemSlug, slot.replace(/(artifact|talisman)(\d)/, "$1 $2"));
    for (const slug of gear.enchantments)
      if (slug) add(slug, `${slot} enchantment`);
  }
  return [...items].map(([slug, slots]) => ({
    slug,
    slots,
    oneTime: slots.every(
      (slot) => slot.startsWith("talisman") || slot.endsWith(" enchantment"),
    ),
  }));
}
export function buildFarmEffects(
  slug: string,
  slots: Build["slots"],
  catalog: readonly PublishedItem[],
): NonNullable<FarmTarget["effectSets"]> {
  const lookup = uniqueEffectCatalog([...catalog]);
  return BUILD_SLOTS.flatMap((slot) => {
    const gear = slots[slot];
    if (gear?.itemSlug !== slug) return [];
    const effects = gear.effects.flatMap((effectSlug) => {
      if (!effectSlug) return [];
      const effect = lookup.get(effectSlug);
      return [
        {
          slug: effectSlug,
          name: effect?.variation ?? effectSlug,
          image: effect?.image ?? null,
        },
      ];
    });
    return effects.length ? [{ slot, effects }] : [];
  });
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function projectFarmTarget(
  detail: PublishedItem,
  slots: string[],
  catalog: readonly PublishedItem[],
): FarmTarget {
  const item = normalizeDetailItem(detail);
  const index = catalog.map(normalizeDetailItem);
  const sources = dropSources(item, index);
  // Some book/chest acquisition sources have no location identity. Show their
  // evidence without treating a generic chest or merchant as a farmable area.
  for (const source of item.game_data.sources) {
    if (
      source.type === "chest" ||
      (source.type === "merchant" &&
        !sources.some((entry) => entry.type === "merchant"))
    )
      sources.push(source);
  }
  const options = new Map<string, FarmOption>();
  for (const source of sources) {
    const linked = source.catalog_slug
      ? index.find((entry) => entry.slug === source.catalog_slug)
      : undefined;
    const key =
      source.catalog_slug ??
      `${source.type}:${source.name.trim().toLowerCase()}`;
    if (!options.has(key))
      options.set(key, {
        ...source,
        key,
        recommendedBoss: recommendedBoss(source, catalog),
        bossEligible: [
          "melee_weapon",
          "ranged_weapon",
          "armor",
          "artifact",
        ].includes(item.category),
        image: source.image ?? linked?.image ?? undefined,
        path: linked ? itemPath(linked) : undefined,
      });
  }
  const acquisition = record(detail.game_data?.acquisition);
  const questSources = Array.isArray(acquisition.sources)
    ? acquisition.sources.map(record)
    : [];
  for (const quest of questRewardTargets(item)) {
    const matches = questSources.filter(
      (source) => source.type === "quest" && source.name === quest.name,
    );
    const documented = matches.filter(
      (source) => typeof source.trigger === "string",
    );
    const entries = documented.length ? documented : [matches[0]];
    for (const source of entries) {
      const notes = [
        source?.trigger === "first_completion"
          ? "First completion reward"
          : source?.trigger === "repeat_completion"
            ? "Repeat completion reward"
            : "Quest reward",
        typeof source?.condition === "string" ? source.condition : undefined,
        ...(Array.isArray(source?.selection_context)
          ? source.selection_context.flatMap((context) => {
              const title =
                typeof context === "string" ? context : record(context).title;
              return typeof title === "string" ? [title] : [];
            })
          : []),
        typeof record(source?.reward).subtitle === "string"
          ? String(record(source?.reward).subtitle)
          : undefined,
      ];
      const key = `quest:${quest.quest ?? quest.name}:${String(source?.trigger ?? "reward")}`;
      options.set(key, {
        key,
        name: quest.name,
        type: "quest",
        quest: quest.quest,
        description: notes.filter(Boolean).join(" · "),
      });
    }
  }
  return {
    slug: item.slug,
    name: item.name,
    image: item.image,
    path: itemPath(item),
    slots,
    options: [...options.values()],
    notes: talismanAcquisitionNotes(item),
  };
}
export function farmingStops(targets: readonly FarmTarget[]): FarmStop[] {
  const stops = new Map<string, FarmStop>();
  for (const target of targets)
    for (const source of target.options) {
      if (!farmTypes.has(source.type)) continue;
      let stop = stops.get(source.key);
      if (!stop) {
        stop = {
          key: source.key,
          name: source.name,
          type: source.type,
          image: source.image,
          path: source.path,
          quest: source.quest,
          recommendedBoss: source.recommendedBoss,
          bossFarm: source.bossFarm,
          targets: [],
        };
        stops.set(source.key, stop);
      }
      stop.targets.push({ target, source });
    }
  return [...stops.values()].sort(
    (a, b) =>
      b.targets.length - a.targets.length || a.name.localeCompare(b.name),
  );
}
/** Exact minimum set cover for at most 12 equipment + 6 enchantment targets.
 * Stops have equal cost: catalog data does not establish travel/clear times.
 * Quest completion and repeat reward conditions remain attached to each item.
 */
function minimumStopPlan(
  targets: readonly FarmTarget[],
  excluded: ReadonlySet<string> = new Set(),
): (FarmStop & { acquiredBefore: FarmStop["targets"] })[] {
  const allStops = farmingStops(targets);
  const stops = allStops.filter((stop) => !excluded.has(stop.key));
  const farmable = targets.filter((target) =>
    allStops.some((stop) =>
      stop.targets.some((row) => row.target.slug === target.slug),
    ),
  );
  if (!farmable.length) return [];
  if (farmable.length > 18)
    throw new Error(
      "A build can contain at most 18 different farming targets.",
    );
  const masks = stops.map((stop) =>
    stop.targets.reduce(
      (mask, row) =>
        mask |
        (1 << farmable.findIndex((target) => target.slug === row.target.slug)),
      0,
    ),
  );
  const size = 1 << farmable.length;
  if (masks.reduce((union, mask) => union | mask, 0) !== size - 1) return [];
  // Compare known rates within each target, so common items do not swamp
  // rarer targets. Missing rates add no preference, never invented odds.
  const bestRates = farmable.map((target) =>
    Math.max(
      0,
      ...target.options.map(
        (source) => source.dropChance?.averageProbability ?? 0,
      ),
    ),
  );
  const rates = stops.map((stop) =>
    farmable.map((target, index) => {
      const value = stop.targets.find((row) => row.target.slug === target.slug)
        ?.source.dropChance?.averageProbability;
      return value !== undefined && bestRates[index] > 0
        ? value / bestRates[index]
        : 0;
    }),
  );
  const scores = new Float64Array(size).fill(-Infinity);
  const costs = new Uint8Array(size).fill(255);
  const previous = new Int32Array(size).fill(-1);
  const choices = new Int32Array(size).fill(-1);
  costs[0] = 0;
  scores[0] = 0;
  for (let mask = 0; mask < size; mask++) {
    if (costs[mask] === 255) continue;
    for (let i = 0; i < stops.length; i++) {
      const next = mask | masks[i];
      if (next === mask) continue;
      let gain = 0;
      for (let bits = next ^ mask; bits; bits &= bits - 1) {
        gain += rates[i][31 - Math.clz32(bits & -bits)];
      }
      const score = scores[mask] + gain;
      if (
        costs[next] > costs[mask] + 1 ||
        (costs[next] === costs[mask] + 1 && score > scores[next] + 1e-12)
      ) {
        costs[next] = costs[mask] + 1;
        scores[next] = score;
        previous[next] = mask;
        choices[next] = i;
      }
    }
  }
  const plan: FarmStop[] = [];
  for (let mask = size - 1; mask > 0; mask = previous[mask])
    plan.push(stops[choices[mask]]);
  const acquired = new Set<string>();
  return plan
    .sort(
      (a, b) =>
        b.targets.length - a.targets.length || a.name.localeCompare(b.name),
    )
    .map((stop) => {
      const targets = stop.targets.filter(
        (row) => !acquired.has(row.target.slug),
      );
      const acquiredBefore = stop.targets.filter((row) =>
        acquired.has(row.target.slug),
      );
      for (const row of targets) acquired.add(row.target.slug);
      return { ...stop, targets, acquiredBefore };
    });
}

/** Owner-selected planner assumptions, separate from published catalog odds. */
export function plannerUniqueChance(
  source: FarmOption,
  boss = false,
): ItemSource["dropChance"] {
  const pool = source.dropChance?.basePoolProbability;
  if (pool === undefined || !Number.isFinite(pool) || pool < 0 || pool > 1)
    return undefined;
  const averageProbability = pool * (boss ? 0.1 : 0.05);
  return {
    ...source.dropChance,
    text: `≈${formatDropPercent(averageProbability)} unique`,
    averageProbability,
  };
}

export function minimumFarmPlan(
  targets: readonly FarmTarget[],
  excluded: ReadonlySet<string> = new Set(),
  farmBosses = false,
): ReturnType<typeof minimumStopPlan> {
  const regularTargets = targets.map((target) => ({
    ...target,
    options: target.options.map((source) => ({
      ...source,
      dropChance: plannerUniqueChance(source) ?? source.dropChance,
    })),
  }));
  if (!farmBosses) return minimumStopPlan(regularTargets, excluded);
  const bossTargets = regularTargets
    .map((target) => ({
      ...target,
      options: target.options
        .filter((source) => source.recommendedBoss && source.bossEligible)
        .map((source) => ({
          ...source,
          key: `boss:${source.key}`,
          bossFarm: true,
          // Only uniques have an owner-selected boss conversion; do not label
          // published area averages as per-boss odds for other items.
          dropChance: plannerUniqueChance(source, true),
        })),
    }))
    .filter((target) => target.options.length);
  const bossPlan = minimumStopPlan(bossTargets, excluded);
  if (bossTargets.length && !bossPlan.length) return [];
  const covered = new Set(
    bossPlan.flatMap((stop) => stop.targets.map((row) => row.target.slug)),
  );
  const remaining = regularTargets.filter(
    (target) => !covered.has(target.slug),
  );
  const rest = minimumStopPlan(remaining, excluded);
  if (farmingStops(remaining).length && !rest.length) return [];
  const acquired = new Set<string>();
  return [...bossPlan, ...rest].map((stop) => {
    const all = [...stop.targets, ...stop.acquiredBefore];
    const fresh = all.filter((row) => !acquired.has(row.target.slug));
    const acquiredBefore = all.filter((row) => acquired.has(row.target.slug));
    fresh.forEach((row) => acquired.add(row.target.slug));
    return { ...stop, targets: fresh, acquiredBefore };
  });
}
