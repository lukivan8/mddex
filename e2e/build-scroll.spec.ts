import { expect, test } from "@playwright/test";
import {
  BUILD_SLOTS,
  isGearSlot,
  supportsEffects,
} from "../src/features/builds/build.types";
import { emptyBuild } from "../src/features/builds/build.service";
import type { CatalogItem } from "../src/features/catalog/catalog.types";

const build = emptyBuild("Long summary");
const catalog: CatalogItem[] = [];
for (const slot of BUILD_SLOTS) {
  const category =
    slot === "melee"
      ? "melee_weapon"
      : slot === "ranged"
        ? "ranged_weapon"
        : slot.startsWith("artifact")
          ? "artifact"
          : slot.startsWith("talisman")
            ? "talisman"
            : "armor";
  catalog.push({
    slug: slot,
    variation: `Equipment ${slot}`,
    category,
    type: category === "armor" ? slot : category,
    image: null,
  });
  const effects = supportsEffects(slot)
    ? Array.from({ length: 3 }, (_, index) => `${slot}-effect-${index}`)
    : [];
  const enchantments = isGearSlot(slot) ? [`${slot}-enchantment`] : [];
  build.slots[slot] = { itemSlug: slot, effects, enchantments };
  for (const slug of [...effects, ...enchantments])
    catalog.push({
      slug,
      variation: slug,
      category: effects.includes(slug) ? "gear_effect" : "enchantment",
      type: effects.includes(slug) ? "attack" : "enchantment",
      image: null,
      description:
        "A long description of this modifier and its effect on the equipment. ".repeat(
          4,
        ),
    });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((saved) => {
    localStorage.setItem(
      "mddex.builds.v3",
      JSON.stringify({
        ["s:" + saved.id]: { versionKey: "scroll", data: saved },
      }),
    );
  }, build);
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "scroll",
        manifest: "releases/scroll/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.goto("/build");
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Long summary",
  );
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
});

for (const height of [600, 900]) {
  test(`only the right column scrolls independently at ${height}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height });
    const loadout = page.getByRole("region", { name: "Active loadout" });
    const summary = page.getByRole("region", { name: "Build summary" });
    await expect(loadout).toHaveCSS("overflow-y", "visible");
    await expect(loadout).toHaveCSS("position", "static");
    await expect(summary).toHaveCSS("overflow-y", "auto");
    await expect(summary).toHaveCSS("position", "sticky");
    await page
      .locator(".build-workspace")
      .evaluate((workspace) =>
        window.scrollTo(
          0,
          workspace.getBoundingClientRect().top + scrollY - 20,
        ),
      );
    const before = await page.evaluate(() => scrollY);
    const rightBounds = await summary.boundingBox();
    await page.mouse.move(rightBounds!.x + rightBounds!.width / 2, 100);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(() => summary.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    expect(await loadout.evaluate((element) => element.scrollTop)).toBe(0);
    await summary.focus();
    await page.keyboard.press("End");
    await expect
      .poll(() =>
        summary.evaluate(
          (element) =>
            element.scrollTop + element.clientHeight >=
            element.scrollHeight - 1,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: test.info().outputPath("summary-scrollbar.png"),
    });
    const rightScroll = await summary.evaluate((element) => element.scrollTop);
    await page.mouse.wheel(0, 500);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    const talisman = page.getByRole("button", {
      name: "Choose Talisman 3",
      exact: true,
    });
    const bounds = await loadout.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, 100);
    const target = await talisman.boundingBox();
    const delta = Math.max(100, target!.y + target!.height - height + 40);
    await page.mouse.wheel(0, delta);
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeGreaterThanOrEqual(before + delta - 1);
    const visible = await talisman.boundingBox();
    expect(visible!.y).toBeGreaterThanOrEqual(0);
    expect(visible!.y + visible!.height).toBeLessThanOrEqual(height);
    expect(await loadout.evaluate((element) => element.scrollTop)).toBe(0);
    expect(await summary.evaluate((element) => element.scrollTop)).toBe(
      rightScroll,
    );
    await page
      .getByRole("button", { name: "Choose Talisman 3", exact: true })
      .click();
    const picker = page.getByRole("region", { name: "Equipment picker" });
    await expect(picker).toHaveCSS("overflow-y", "auto");
    await expect(picker).toHaveCSS("position", "sticky");
    await page.screenshot({ path: test.info().outputPath("build-bottom.png") });
  });
}

test("mobile keeps normal page scrolling to the build bottom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const loadout = page.getByRole("region", { name: "Active loadout" });
  await expect(loadout).toHaveCSS("overflow-y", "visible");
  await expect(loadout).toHaveCSS("position", "static");
  await expect(page.getByRole("region", { name: "Build summary" })).toHaveCSS(
    "overflow-y",
    "visible",
  );
  await page
    .getByRole("button", { name: "Choose Talisman 3", exact: true })
    .scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(await loadout.evaluate((element) => element.scrollTop)).toBe(0);
});

for (const mobile of [false, true]) {
  test(`selecting a different modifier slot resets the picker scroll on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1200, height: 600 });
    await page.getByRole("button", { name: /^Melee weapon effect 1:/ }).click();
    const scrollArea = mobile
      ? page.locator(".build-picker-sheet .modal__body")
      : page.getByRole("region", { name: "Equipment picker" });
    await expect
      .poll(() =>
        scrollArea.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      )
      .toBe(true);
    await scrollArea.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => scrollArea.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    if (mobile) {
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await page
      .getByRole("button", { name: /^Ranged weapon effect 1:/ })
      .click();
    await expect
      .poll(() => scrollArea.evaluate((element) => element.scrollTop))
      .toBe(0);
    await expect(mobile ? page.getByRole("dialog") : scrollArea).toContainText(
      "Equipment ranged",
    );
  });
}
