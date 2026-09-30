import { expect, test } from "@playwright/test";
import { emptyBuild } from "../src/features/builds/build.service";

const catalogCategories = [
  "melee_weapon",
  "ranged_weapon",
  "armor",
  "artifact",
  "talisman",
  "enchantment",
  "gear_effect",
];
const catalogShapes = [
  ".catalog-heading",
  ".category-grid",
  ".category-card",
  ".toolbar",
  ".filter-row",
  ".results-toolbar",
  ".item-grid",
  ".item-card",
];
const buildShapes = [
  ".build-view-controls",
  ".build-workspace",
  ".build-heading",
  ".build-board",
  ".gear-slot",
  ".picker-pane",
  ".picker-title",
  ".catalog-picker",
];

for (const width of [1365, 390]) {
  for (const path of ["/build", "/collection"]) {
    test(`${path} keeps its loading layout stable at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
      await page.addInitScript(() => {
        (window as Window & { layoutShiftScore?: number }).layoutShiftScore = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            };
            if (!shift.hadRecentInput)
              (
                window as Window & { layoutShiftScore: number }
              ).layoutShiftScore += shift.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.route("**/latest.json", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await route.fulfill({
          json: {
            catalogVersion: "layout-test",
            manifest: "releases/layout-test/manifest.json",
          },
        });
      });
      await page.route("**/catalog.json", (route) =>
        route.fulfill({
          json: catalogCategories.map((category) => ({
            slug: `${category}-sample`,
            category,
            type: "sample",
            variation: `Sample ${category}`,
            image: null,
          })),
        }),
      );
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const measureCatalog = () =>
        page.evaluate(
          (selectors) =>
            selectors.map((selector) => {
              const rect = document
                .querySelector(selector)
                ?.getBoundingClientRect();
              return rect
                ? {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                  }
                : null;
            }),
          catalogShapes,
        );
      const measureBuild = () =>
        page.evaluate(
          (selectors) =>
            selectors.map((selector) => {
              const rect = document
                .querySelector(selector)
                ?.getBoundingClientRect();
              return rect
                ? { x: rect.x, y: rect.y, width: rect.width }
                : null;
            }),
          buildShapes,
        );
      let skeletonShapes;
      let buildSkeletonShapes;
      if (path === "/collection") {
        await expect(
          page.locator(".collection-skeleton .category-card"),
        ).toHaveCount(7);
        await page.waitForFunction(() => {
          const grid = document.querySelector(
            ".collection-skeleton .category-grid",
          );
          return grid && getComputedStyle(grid).display !== "block";
        });
        await page.evaluate(() => document.fonts.ready);
        skeletonShapes = await measureCatalog();
      } else {
        await expect(page.locator(".build-loading .gear-slot")).toHaveCount(12);
        await page.evaluate(() => document.fonts.ready);
        buildSkeletonShapes = await measureBuild();
      }
      await expect(
        path === "/build"
          ? page.getByRole("textbox", { name: "Loadout name" })
          : page.locator(".catalog-body > div:not(.collection-skeleton) h1"),
      ).toBeVisible();
      if (skeletonShapes) {
        const loadedShapes = await measureCatalog();
        for (const [index, before] of skeletonShapes.entries()) {
          const after = loadedShapes[index];
          expect(before).not.toBeNull();
          expect(after).not.toBeNull();
          const keys =
            catalogShapes[index] === ".item-grid"
              ? (["x", "y", "width"] as const)
              : (["x", "y", "width", "height"] as const);
          for (const key of keys)
            expect(Math.abs(before![key] - after![key])).toBeLessThan(1);
        }
      }
      if (buildSkeletonShapes) {
        const loadedShapes = await measureBuild();
        for (const [index, before] of buildSkeletonShapes.entries()) {
          const after = loadedShapes[index];
          if (width <= 900 && buildShapes[index].includes("picker")) continue;
          expect(before).not.toBeNull();
          expect(after).not.toBeNull();
          for (const key of ["x", "y", "width"] as const)
            expect(
              Math.abs(before![key] - after![key]),
              `${buildShapes[index]} ${key}: ${before![key]} → ${after![key]}`,
            ).toBeLessThan(2);
        }
      }
      await page.waitForTimeout(300);
      const score = await page.evaluate(
        () =>
          (window as Window & { layoutShiftScore: number }).layoutShiftScore,
      );
      expect(score).toBeLessThan(0.01);
    });
  }
}

test("saved loadout appears while the equipment catalog is pending", async ({
  page,
}) => {
  const build = emptyBuild("My saved loadout");
  build.slots.melee = {
    itemSlug: "sample-sword",
    enchantments: [null],
    effects: [null, null, null],
  };
  await page.addInitScript((saved) => {
    localStorage.setItem("mddex.builds.v3", saved);
  }, JSON.stringify({ ["s:" + build.id]: { versionKey: "1", data: build } }));
  await page.route("**/latest.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.fulfill({
      json: { catalogVersion: "test", manifest: "releases/test/manifest.json" },
    });
  });
  await page.goto("/build", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".build-loading .build-name")).toHaveValue(
    "My saved loadout",
  );
  await expect(page.locator(".build-loading .gear-slot")).toHaveCount(12);
  await expect(
    page.locator(".build-loading .build-loading-item-name"),
  ).toHaveCount(1);
});
