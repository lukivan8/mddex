import { describe, expect, it } from "vitest";
import type { CatalogItem } from "./catalog-detail.model";
import {
  bowChargeMultiplier,
  comboHitCount,
  fullChargeDamage,
  fullComboDamage,
  metricRank,
  normalizedComboLength,
  potentialVolleyDamage,
  spamDamageRate,
} from "./weapon-compare.model";

describe("weapon comparison", () => {
  it("ranks only directly comparable values in the correct direction", () => {
    expect(metricRank(24, 16, "higher")).toBe("better");
    expect(metricRank(16, 24, "higher")).toBe("worse");
    expect(metricRank(0.9, 1.2, "lower")).toBe("better");
    expect(metricRank(1.2, 0.9, "lower")).toBe("worse");
    expect(metricRank(16, 16, "higher")).toBe("equal");
    expect(metricRank(null, 16, "higher")).toBe("unrated");
    expect(metricRank(16, 24)).toBe("unrated");
  });

  it("totals the listed melee combo and potential ranged volley", () => {
    const melee = {
      game_data: {
        melee: {
          combo: [{ damage: 16 }, { damage: 16 }, { damage: 24 }],
        },
      },
    } as CatalogItem;
    const ranged = {
      game_data: {
        ranged: {
          projectiles: [
            { count: 3, damage: 12 },
            { count: 1, damage: 8 },
          ],
        },
      },
    } as CatalogItem;
    expect(fullComboDamage(melee)).toBe(56);
    expect(potentialVolleyDamage(ranged)).toBe(44);
    expect(potentialVolleyDamage()).toBeNull();
  });

  it("rounds each hit and projectile at the selected Power before totaling", () => {
    const melee = {
      game_data: {
        melee: {
          combo: [
            { damage: 11, speed: 1 },
            { damage: 11, speed: 1 },
          ],
        },
      },
    } as CatalogItem;
    const ranged = {
      category: "ranged_weapon",
      type: "bows",
      name: "Shortbow",
      game_data: {
        ranged: { projectiles: [{ damage: 11, count: 2 }] },
      },
    } as CatalogItem;
    expect(fullComboDamage(melee, 2)).toBe(24);
    expect(spamDamageRate(melee, 2)).toBe(12);
    expect(potentialVolleyDamage(ranged, 2)).toBe(24);
    expect(fullChargeDamage(ranged, 2)).toBe(46);
  });

  it("counts multiple impacts in each catalog combo attack", () => {
    const melee = {
      game_data: {
        melee: {
          combo: [
            { damage: 6, hit_count: 3, speed: 1.75 },
            { damage: 8, hit_count: 3, speed: 1.75 },
            { damage: 28, hit_count: 1, speed: 1.5 },
          ],
        },
      },
    } as CatalogItem;
    expect(comboHitCount(melee)).toBe(7);
    expect(fullComboDamage(melee)).toBe(70);
    expect(fullComboDamage(melee, 2)).toBe(71);
    expect(normalizedComboLength(melee)).toBeCloseTo(2 / 1.75 + 1 / 1.5);
  });

  it("compares continuous combos using speed, repeats, and cooldown", () => {
    const melee = (combo: Record<string, number>[], comboReset = 1.15) =>
      ({
        slug: "test",
        category: "melee_weapon",
        name: "Test",
        image: null,
        description: null,
        game_data: {
          melee: { combo, combo_reset: comboReset, jump: null },
          sources: [],
          drops: [],
          base: null,
          uniqueVariant: null,
        },
      }) as unknown as CatalogItem;
    const axe = melee([
      { damage: 14, speed: 1 },
      { damage: 16, speed: 1 },
      { damage: 22, speed: 1 },
    ]);
    const sculkersBane = melee([{ damage: 25, speed: 1.3, cooldown: 0.25 }]);
    const mobMallet = melee([
      { damage: 18, speed: 1, repeat: 5, cooldown: 0.2 },
      { damage: 24, speed: 1, cooldown: 0.9 },
    ]);
    expect(comboHitCount(axe)).toBe(3);
    expect(fullComboDamage(axe)).toBe(52);
    expect(normalizedComboLength(axe)).toBe(3);
    expect(spamDamageRate(axe)).toBeCloseTo(52 / 3);
    expect(normalizedComboLength(sculkersBane)).toBeCloseTo(1 / 1.3 + 0.25);
    expect(spamDamageRate(sculkersBane)).toBeGreaterThan(spamDamageRate(axe)!);
    expect(comboHitCount(mobMallet)).toBe(6);
    expect(fullComboDamage(mobMallet)).toBe(114);
    expect(normalizedComboLength(mobMallet)).toBeCloseTo(3.9);
    expect(spamDamageRate(mobMallet)).toBeCloseTo(114 / 3.9);
    expect(normalizedComboLength(melee([{ damage: 14, speed: 1 }], 3))).toBe(1);
    expect(spamDamageRate(melee([{ damage: 14 }]))).toBeNull();
  });

  it("derives full-charge damage by bow family, including unique variants", () => {
    const bow = (name: string, base?: string) =>
      ({
        category: "ranged_weapon",
        type: "bows",
        name,
        game_data: {
          base: base ? { name: base } : null,
          ranged: { projectiles: [{ damage: 11, count: 1 }] },
        },
      }) as CatalogItem;
    expect(fullChargeDamage(bow("Bow"))).toBe(33);
    expect(fullChargeDamage(bow("Longbow"))).toBe(33);
    expect(fullChargeDamage(bow("Powerbow"))).toBe(44);
    expect(fullChargeDamage(bow("Shortbow"))).toBe(22);
    expect(fullChargeDamage(bow("Shooting Star", "Shortbow"))).toBe(22);
    expect(fullChargeDamage(bow("Trickbow"))).toBe(33);
    expect(fullChargeDamage(bow("Greatbow"))).toBe(33);
    expect(
      bowChargeMultiplier(bow("The Close Ranger", "Heavy Crossbow")),
    ).toBeNull();
    expect(
      fullChargeDamage({ ...bow("Crossbow"), type: "crossbows" }),
    ).toBeNull();
  });
});
