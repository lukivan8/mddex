import { describe, expect, it } from "vitest";
import {
  compareMeleeWeapons,
  filterMeleeWeapons,
  meleeWeapons,
} from "./melee-weapons";

describe("melee weapon chart", () => {
  it("imports every base and unique weapon once with consistent damage totals", () => {
    expect(meleeWeapons).toHaveLength(58);
    expect(new Set(meleeWeapons.map((weapon) => weapon.name)).size).toBe(58);
    expect(
      meleeWeapons.filter((weapon) => weapon.edition === "Base"),
    ).toHaveLength(29);
    for (const weapon of meleeWeapons) {
      const total = weapon.breakdown.split("+").reduce(
        (sum, term) =>
          sum +
          term
            .trim()
            .split("×")
            .map(Number)
            .reduce((product, value) => product * value, 1),
        0,
      );
      expect(total, weapon.name).toBe(weapon.damage);
      expect(weapon.comboDuration).toBeGreaterThan(0);
      expect(weapon.stages.length).toBeGreaterThan(0);
    }
  });
  it("uses corrected visible-sheet spear timings and variant-relative hits", () => {
    const spear = meleeWeapons.find(
      (weapon) => weapon.name === "Spectral Spear",
    )!;
    expect(spear.damage).toBe(58);
    expect(spear.comboDuration).toBe(1.117);
    expect(spear.dps).toBeCloseTo(51.9248);
    expect(spear.stages[1].hits).toEqual([0.23, 0.42, 0.53]);
    expect(spear.stages[2].duration).toBe(0.23);
    expect(
      meleeWeapons.find((weapon) => weapon.name === "Short Spear")!
        .comboDuration,
    ).toBe(1.229);
  });
  it("imports pure jump DPS consistently and sorts and compares jump attacks", () => {
    for (const weapon of meleeWeapons) {
      expect(weapon.jumpInterval).toBe(0.74);
      expect(weapon.jumpDps).toBeCloseTo(
        weapon.jumpDamage / weapon.jumpInterval,
        8,
      );
      expect(weapon.stages.reduce((sum, stage) => sum + stage.damage, 0)).toBe(
        weapon.damage,
      );
      for (const stage of weapon.stages) {
        expect(stage.damage).toBe(stage.damagePerHit * stage.hits.length);
        expect(
          stage.hits.every((hit) => hit >= 0 && hit <= stage.duration),
        ).toBe(true);
      }
    }
    const hammer = meleeWeapons.find((weapon) => weapon.name === "War Hammer")!;
    const claws = meleeWeapons.find((weapon) => weapon.name === "Wolf Claws")!;
    expect(hammer.jumpDamage).toBe(40);
    expect(hammer.jumpDps).toBeCloseTo(54.0541);
    expect(compareMeleeWeapons(claws, hammer).jumpDps).toBeCloseTo(28 / 0.74);
    const sorted = filterMeleeWeapons("", "", "jumpDps");
    expect(sorted[0].jumpDamage).toBe(40);
    expect(
      sorted.every(
        (weapon, i) => i === 0 || weapon.jumpDps <= sorted[i - 1].jumpDps,
      ),
    ).toBe(true);
  });
  it("searches families, filters editions, and sorts by effective combo duration", () => {
    expect(
      filterMeleeWeapons("short spear", "Unique", "dps").map(
        (weapon) => weapon.name,
      ),
    ).toEqual(["Spectral Spear"]);
    const sorted = filterMeleeWeapons("", "Base", "time");
    expect(sorted[0].name).toBe("Twilight Dagger");
    expect(
      sorted.every(
        (weapon, index) =>
          index === 0 ||
          weapon.comboDuration >= sorted[index - 1].comboDuration,
      ),
    ).toBe(true);
  });
});
