import { test, expect } from "@playwright/test";
import { emptyBuild } from "../src/features/builds/build.service";

for (const mobile of [false, true]) {
  test(`duplicate loadout opens an independent saved copy on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const original = emptyBuild("Original", "original");
    original.slots.melee = {
      itemSlug: "hammer",
      power: 100,
      enchantments: [],
      effects: [],
    };
    await page.addInitScript((build) => {
      if (!localStorage.getItem("mddex.builds.v3")) {
        localStorage.setItem(
          "mddex.builds.v3",
          JSON.stringify({
            ["s:" + build.id]: { versionKey: "seed", data: build },
          }),
        );
      }
    }, original);
    await page.route("**/latest.json", (route) =>
      route.fulfill({
        json: {
          catalogVersion: "test",
          manifest: "releases/test/manifest.json",
        },
      }),
    );
    await page.route("**/catalog.json", (route) =>
      route.fulfill({
        json: [
          {
            slug: "hammer",
            variation: "Battle Hammer",
            category: "melee_weapon",
            type: "hammers",
            image: null,
          },
        ],
      }),
    );
    await page.goto("/build");
    await page
      .getByRole("button", { name: "Saved loadouts", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Delete Original", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Duplicate Original", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Loadout name" }),
    ).toHaveValue("Original (copy)");
    await expect(
      page.getByRole("button", { name: "Choose Melee weapon", exact: true }),
    ).toContainText("Battle Hammer");
    await page
      .getByRole("button", { name: "Clear Melee weapon", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Loadout name" }),
    ).toHaveValue("Original (copy)");
    await expect(
      page.getByRole("button", { name: "Choose Melee weapon", exact: true }),
    ).toContainText("Choose item");
    await page
      .getByRole("button", { name: "Saved loadouts", exact: true })
      .click();
    await page
      .locator(".loadout-option")
        .filter({ has: page.getByText("Original", { exact: true }) })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Loadout name" }),
    ).toHaveValue("Original");
    await expect(
      page.getByRole("button", { name: "Choose Melee weapon", exact: true }),
    ).toContainText("Battle Hammer");
  });
}
