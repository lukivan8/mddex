import { describe, expect, it } from "vitest";
import {
  parsePower,
  powerFactor,
  powerFromReturnPath,
  returnPathAtPower,
  scaleDamage,
} from "./power";

describe("catalog power scaling", () => {
  it("uses Power 1 for published base damage and rounds at each power", () => {
    expect(scaleDamage(16, 1)).toBe(16);
    expect(scaleDamage(16, 10)).toBe(23);
    expect(scaleDamage(10, 4)).toBe(12);
    expect(powerFactor(10)).toBeCloseTo(1.45);
  });

  it("keeps Power in filtered catalog return paths", () => {
    expect(parsePower("2")).toBe(2);
    expect(parsePower("2.5")).toBe(1);
    expect(parsePower("bad")).toBe(1);
    expect(returnPathAtPower("/collection?category=melee_weapon", 2)).toBe(
      "/collection?category=melee_weapon&power=2",
    );
    expect(
      returnPathAtPower("/collection?category=melee_weapon&power=2", 1),
    ).toBe("/collection?category=melee_weapon");
    expect(powerFromReturnPath("/collection?power=3")).toBe(3);
  });
});
