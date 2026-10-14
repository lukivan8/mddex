import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const template = readFileSync("scripts/analytics-dau.html", "utf8");
const report = {
  release: "2026-10-10",
  today: "2026-10-14",
  updated: "fixture",
  cohortStart: "2026-10-12",
  days: [
    { date: "2026-10-10", dau: 15, sample: 1 }, // historical cache format
    {
      date: "2026-10-12",
      dau: 20,
      new: 5,
      returning: 12,
      unknown: 3,
      sample: 1,
    },
    {
      date: "2026-10-13",
      dau: 25,
      new: 7,
      returning: 18,
      unknown: 0,
      sample: 1,
    },
    {
      date: "2026-10-14",
      dau: 10,
      new: 2,
      returning: 8,
      unknown: 0,
      sample: 2,
    },
  ],
};
for (const width of [1000, 390])
  test(`DAU split preserves totals, historical unknowns and gaps at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.setContent(
      `<style>:root{--foreground:#eee;--background:#111;--border:#444;--viz-series-1:#fff}body{background:#111;color:#eee;font:14px system-ui}</style>` +
        template.replace("__DAU_DATA__", JSON.stringify(report)),
    );
    await expect(page.locator("[data-days] tr")).toHaveCount(4);
    await expect(page.locator("[data-note]")).toContainText(
      "Historical/blocked-storage classification is unknown",
    );
    await expect(page.locator("svg")).toHaveAttribute(
      "aria-label",
      /2026-10-10: 15 total, 0 new, 0 returning, 15 unknown/,
    );
    const counts = await page
      .locator("[data-cohort]")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          date: node.getAttribute("data-date"),
          count: Number(node.getAttribute("data-count")),
        })),
      );
    for (const day of report.days)
      expect(
        counts
          .filter((c) => c.date === day.date)
          .reduce((sum, c) => sum + c.count, 0),
      ).toBe(day.dau);
    expect(counts.some((c) => c.date === "2026-10-11")).toBe(false);
    await expect(page.locator(".dau-line")).toHaveAttribute("d", /^M[^M]+M/);
    await page.screenshot({ path: `/tmp/mddex-dau-cohorts-${width}.png` });
  });
