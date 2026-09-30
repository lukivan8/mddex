import type { CatalogItem } from "./catalog-detail.model";
import { scaleDamage } from "../catalog/power";
import { attackDamage, hitsPerAttack } from "./melee-attack";

export type MetricDirection = "higher" | "lower";
export type MetricRank = "better" | "worse" | "equal" | "unrated";
export type WeaponCompareSearch = {
  mode: "melee" | "ranged";
  left?: string;
  right?: string;
  returnTo: string;
  power?: number;
};

export function metricRank(
  value: unknown,
  counterpart: unknown,
  direction?: MetricDirection,
): MetricRank {
  if (
    !direction ||
    typeof value !== "number" ||
    typeof counterpart !== "number" ||
    !Number.isFinite(value) ||
    !Number.isFinite(counterpart)
  )
    return "unrated";
  if (value === counterpart) return "equal";
  return (direction === "higher" ? value > counterpart : value < counterpart)
    ? "better"
    : "worse";
}

export function fullComboDamage(item?: CatalogItem, power = 1) {
  const hits = item?.game_data.melee?.combo;
  if (!hits?.length) return null;
  let damage = 0;
  for (const hit of hits) {
    const repeats = hit.repeat ?? 1;
    if (
      !Number.isFinite(hit.damage) ||
      !Number.isInteger(repeats) ||
      repeats < 1
    )
      return null;
    damage += attackDamage(hit, power) * repeats;
  }
  return damage;
}

export function comboHitCount(item?: CatalogItem): number | null {
  const hits = item?.game_data.melee?.combo;
  if (!hits?.length) return null;
  let count = 0;
  for (const hit of hits) {
    const repeats = hit.repeat ?? 1;
    if (!Number.isInteger(repeats) || repeats < 1) return null;
    count += hitsPerAttack(hit) * repeats;
  }
  return count;
}

export function normalizedComboLength(item?: CatalogItem): number | null {
  const hits = item?.game_data.melee?.combo;
  if (!hits?.length) return null;
  let length = 0;
  for (const hit of hits) {
    const repeats = hit.repeat ?? 1;
    const cooldown = hit.cooldown ?? 0;
    if (
      hit.speed == null ||
      !Number.isFinite(hit.speed) ||
      hit.speed <= 0 ||
      !Number.isInteger(repeats) ||
      repeats < 1 ||
      !Number.isFinite(cooldown) ||
      cooldown < 0
    )
      return null;
    // One attack step at speed ×1 is one normalized time unit. Repeated
    // impacts share that step and add their listed cooldown between impacts
    // and before the next step in a continuously repeated combo.
    length += 1 / hit.speed + repeats * cooldown;
  }
  return length;
}

export function spamDamageRate(item?: CatalogItem, power = 1): number | null {
  const damage = fullComboDamage(item, power);
  const length = normalizedComboLength(item);
  return damage == null || length == null || length <= 0
    ? null
    : damage / length;
}

export function potentialVolleyDamage(item?: CatalogItem, power = 1) {
  const projectiles = item?.game_data.ranged?.projectiles;
  if (!projectiles?.length || projectiles.some((shot) => shot.damage == null))
    return null;
  return projectiles.reduce(
    (total, shot) =>
      total + (shot.count ?? 1) * scaleDamage(shot.damage!, power),
    0,
  );
}

export function bowChargeMultiplier(item?: CatalogItem): number | null {
  if (item?.category !== "ranged_weapon" || item.type !== "bows") return null;
  const family = item.game_data.base?.name ?? item.name;
  // A few crossbow variants are labeled as bows in the published catalog.
  if (/crossbow/i.test(family)) return null;
  if (/^powerbow$/i.test(family)) return 4;
  if (/^shortbow$/i.test(family)) return 2;
  return 3;
}

export function fullChargeDamage(item?: CatalogItem, power = 1): number | null {
  const multiplier = bowChargeMultiplier(item);
  const base = potentialVolleyDamage(item);
  return multiplier == null || base == null
    ? null
    : scaleDamage(base * multiplier, power);
}
