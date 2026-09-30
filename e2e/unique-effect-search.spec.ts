import { expect, test } from "@playwright/test";

const catalog = [
  {
    slug: "melee_weapon-awesomeaxe",
    category: "melee_weapon",
    type: "axes",
    variation: "Awesomeaxe",
    image: null,
    game_data: {
      unique: true,
      effects: [{ tier: "unique", name: "Strengthening Hit" }],
    },
  },
  {
    slug: "melee_weapon-axe",
    category: "melee_weapon",
    type: "axes",
    variation: "Axe",
    image: null,
    game_data: { unique: false },
  },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "unique-search-test",
        manifest: "releases/unique-search-test/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
});

test("built-in effect name finds its unique weapon in the build picker", async ({
  page,
}) => {
  await page.goto("/build");
  await page
    .getByRole("searchbox", { name: "Search compatible items" })
    .fill("Strengthening");
  await expect(
    page.getByRole("button", { name: "Equip Awesomeaxe" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Equip Axe", exact: true }),
  ).toHaveCount(0);
});
