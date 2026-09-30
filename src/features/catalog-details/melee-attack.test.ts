import { describe, expect, it } from "vitest";
import {
  attackDamage,
  formatAttackDamage,
  hitsPerAttack,
} from "./melee-attack";

describe("published melee hit counts", () => {
  it("shows rounded damage per hit and the catalog hit count", () => {
    const doubleHit = {
      damage: 6,
      hit_count: 2,
      stagger: 12.5,
      range: 235,
      weight: "Light",
    };
    expect(formatAttackDamage(doubleHit, 29)).toBe("14 × 2");
    expect(attackDamage(doubleHit, 29)).toBe(28);
    expect(hitsPerAttack(doubleHit)).toBe(2);
  });

  it("distinguishes a published single hit from an unknown count", () => {
    const attack = { damage: 28, stagger: 10, range: 200, weight: "Medium" };
    expect(formatAttackDamage({ ...attack, hit_count: 1 }, 1)).toBe("28 × 1");
    expect(formatAttackDamage({ ...attack, hit_count: null }, 1)).toBe("28");
    expect(hitsPerAttack({ ...attack, hit_count: null })).toBe(1);
  });
});
