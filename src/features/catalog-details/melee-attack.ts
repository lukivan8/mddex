import { scaleDamage } from "../catalog/power";
import type { Attack } from "./catalog-detail.model";

export function knownHitCount(attack: Attack): number | null {
  const count = attack.hit_count;
  return count != null && Number.isInteger(count) && count > 0 ? count : null;
}

export function hitsPerAttack(attack: Attack): number {
  return knownHitCount(attack) ?? 1;
}

export function attackDamage(attack: Attack, power: number): number {
  return scaleDamage(attack.damage, power) * hitsPerAttack(attack);
}

export function formatAttackDamage(attack: Attack, power: number): string {
  const damage = scaleDamage(attack.damage, power);
  const count = knownHitCount(attack);
  return count == null ? String(damage) : `${damage} × ${count}`;
}
