import { test, expect } from "@playwright/test";

test("mobile navigation expands, closes with Escape, navigates, and stays out of the title", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "nav-test",
        manifest: "releases/nav-test/manifest.json",
      },
    }),
  );
  await page.route("**/releases/nav-test/catalog.json", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/build");
  await expect(
    page.getByRole("textbox", { name: "Loadout name" }),
  ).toBeVisible();
  const toggle = page.locator(".mobile-menu-toggle");
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(toggle).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeHidden();
  await toggle.click();
  await expect(mobileNav).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close navigation menu" }),
  ).toHaveAttribute("aria-expanded", "true");
  for (const name of ["Build", "Catalog", "Mobs", "Community builds"]) {
    await expect(
      mobileNav.getByRole("link", { name, exact: true }),
    ).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(mobileNav).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await mobileNav.getByRole("link", { name: "Catalog", exact: true }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(mobileNav).toBeHidden();
  await expect(page.getByRole("heading", { name: "Catalog." })).toBeVisible();
  const header = await page.locator(".app-header").boundingBox();
  const title = await page
    .getByRole("heading", { name: "Catalog." })
    .boundingBox();
  expect(title!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
  await toggle.click();
  await expect(
    mobileNav.getByRole("link", { name: "Catalog", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 1100, height: 812 });
  await expect(toggle).toBeHidden();
  await expect(mobileNav).toBeHidden();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".header-inner")
      .getByRole("link", { name: "Community builds", exact: true }),
  ).toBeVisible();
});
