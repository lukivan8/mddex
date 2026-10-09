import { expect, it } from "vitest";
import { groupQuestRewards } from "./quest-rewards";

it("separates a two-of-four pool from rewards before and after it", () => {
  const items = ["Antenna", "Carapace", "Greaves", "Tarsi"].map((title) => ({
    title,
  }));
  expect(
    groupQuestRewards([
      { title: "Emerald Hammer" },
      {
        title: "2 drops from a list of 4",
        subtitle: "Repeated candidate names",
      },
      ...items,
      { title: "Golem Kit" },
    ]),
  ).toEqual([
    { items: [{ title: "Emerald Hammer" }] },
    { dropCount: 2, items },
    { items: [{ title: "Golem Kit" }] },
  ]);
});

it("keeps incomplete or invalid pool data readable without inventing candidates", () => {
  const rows = [{ title: "2 drops from a list of 4" }, { title: "Antenna" }];
  expect(groupQuestRewards(rows)).toEqual([{ items: rows }]);
  const invalid = [{ title: "3 drops from a list of 1" }, { title: "Antenna" }];
  expect(groupQuestRewards(invalid)).toEqual([{ items: invalid }]);
});
