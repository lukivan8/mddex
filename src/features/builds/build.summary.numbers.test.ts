import { expect, it } from "vitest";
import {
  additiveEffectDescriptions,
  summaryNumberParts,
} from "./build.summary.numbers";

const descriptions = (...values: string[]) =>
  additiveEffectDescriptions(
    values.map((description, index) => ({
      description,
      source: `Equipment ${index}`,
    })),
  );

it("adds bonuses from different tiers into one description", () => {
  expect(
    descriptions(
      "Restores 5% of max health for each soul gathered.",
      "Restores 1% of max health for each soul gathered.",
    ),
  ).toEqual([
    {
      description: "Restores 6% of max health for each soul gathered.",
      source: "Equipment 0\nEquipment 1",
    },
  ]);
  expect(
    descriptions(
      "Deal 25% more damage.",
      "Deal 40% more damage.",
      "Deal 15% more damage.",
    )[0].description,
  ).toBe("Deal 80% more damage.");
});

it("adds decimal values, durations, and flat amounts without floating-point artifacts", () => {
  expect(
    descriptions("Grants 0.1% more damage.", "Grants 0.2% more damage.")[0]
      .description,
  ).toBe("Grants 0.3% more damage.");
  expect(
    descriptions("Lasts 7.5 seconds.", "Lasts 6 seconds.")[0].description,
  ).toBe("Lasts 13.5 seconds.");
  expect(
    descriptions("Grants 30 souls.", "Grants 45 souls.")[0].description,
  ).toBe("Grants 75 souls.");
});

it("keeps timing conditions intact while adding the bonuses", () => {
  expect(
    descriptions(
      "Restores health by 10% per second after 5 seconds out of combat.",
      "Restores health by 20% per second after 5 seconds out of combat.",
    )[0].description,
  ).toBe("Restores health by 30% per second after 5 seconds out of combat.");
  expect(
    descriptions(
      "Deal 10% more damage after 5 seconds.",
      "Deal 20% more damage after 10 seconds.",
    ),
  ).toHaveLength(2);
});

it("preserves nonnumeric, missing, and differently worded descriptions", () => {
  expect(descriptions("Hits explode!", "Hits explode!")[0].description).toBe(
    "Hits explode!",
  );
  expect(
    descriptions("Deal 10% more damage.", "Take 10% less damage."),
  ).toHaveLength(2);
  expect(additiveEffectDescriptions([{ source: "Missing equipment" }])).toEqual(
    [{ source: "Missing equipment" }],
  );
});

it("splits numbers and their percentages for safe inline emphasis", () => {
  expect(summaryNumberParts("Grants 6% healing over 1.5 seconds.")).toEqual([
    "Grants ",
    "6%",
    " healing over ",
    "1.5",
    " seconds.",
  ]);
});
