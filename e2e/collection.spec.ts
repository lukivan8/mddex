import { test, expect, type Page } from "@playwright/test";
const catalog = [
  {
    slug: "melee_weapon-battle-hammer",
    category: "melee_weapon",
    type: "hammers",
    variation: "Battle Hammer",
    image: null,
  },
  {
    slug: "melee_weapon-war-hammer",
    category: "melee_weapon",
    type: "hammers",
    variation: "War Hammer",
    image: null,
  },
  {
    slug: "armor-beekeeper-helmet",
    category: "armor",
    type: "head",
    variation: "Beekeeper Helmet",
    image: "images/broken",
  },
  {
    slug: "armor-beekeeper-boots",
    category: "armor",
    type: "feet",
    variation: "Beekeeper Boots",
    image: null,
  },
];
async function mockCatalog(page: Page) {
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: { catalogVersion: "test", manifest: "releases/test/manifest.json" },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.route("**/images/broken", (route) =>
    route.fulfill({ status: 404 }),
  );
}
test.beforeEach(async ({ page }) => {
  await mockCatalog(page);
});
test("Build is the main screen and brand destination", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/build$/);
  await expect(
    page.getByRole("button", { name: "Equip Battle Hammer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Owned", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Catalog", exact: true }).click();
  await page.getByRole("link", { name: "MDDEX builds", exact: true }).click();
  await expect(page).toHaveURL(/\/build$/);
});
test("catalog search and filters persist in the URL without ownership controls or writes", async ({
  page,
}) => {
  await page.goto("/collection?status=collected&sort=missing");
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.locator(".ownership-label")).toHaveCount(0);
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.getByRole("searchbox").fill("HAMmer");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page).toHaveURL(/q=HAMmer/);
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Battle Hammer", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(
    await page.evaluate(() => localStorage.getItem("mddex.collection.v2")),
  ).toBeNull();
});

test("mobile catalog filters and artwork fallback", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/collection");
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.locator(".art-placeholder")).toHaveCount(4);
  await page
    .getByRole("button", { name: "All categories Category", exact: true })
    .click();
  await page.getByRole("option", { name: "Armor", exact: true }).click();
  await page
    .getByRole("button", { name: "All types Type", exact: true })
    .click();
  await page.getByRole("option", { name: "Head (1)", exact: true }).click();
  await page.getByRole("searchbox").fill("beekeeper");
  await expect(
    page.getByRole("article", { name: "Beekeeper Helmet", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page).toHaveURL(/category=armor/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("catalog retry recovers from release failure", async ({ page }) => {
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/collection");
  await expect(
    page.getByRole("heading", { name: "Catalog unavailable" }),
  ).toBeVisible();
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
});

test("legacy and damaged ownership data are ignored without migration or writes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("mddex.collection.v2", "broken");
    localStorage.setItem("mddb.collection.v1", "legacy");
  });
  await page.goto("/collection");
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("searchbox").fill("hammer");
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(
    await page.evaluate(() => [
      localStorage.getItem("mddex.collection.v2"),
      localStorage.getItem("mddb.collection.v1"),
    ]),
  ).toEqual(["broken", "legacy"]);
});
test("old picker preferences and damaged collection do not restrict builds", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("mddex.collection.v2", "broken");
    localStorage.setItem(
      "mddex.build-preferences.v1",
      JSON.stringify({
        "s:workspace": {
          versionKey: "1",
          data: { id: "workspace", activeId: null, availability: "owned" },
        },
      }),
    );
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Equip Battle Hammer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Clear Melee weapon", exact: true }),
  ).toBeVisible();
});

test("top category bar filters and toggles off", async ({ page }) => {
  await page.goto("/collection");
  const categories = page.getByRole("group", {
    name: "Catalog categories",
    exact: true,
  });
  const armor = categories.getByRole("button", { name: /Armor/ });
  await armor.click();
  await expect(armor).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page).toHaveURL(/category=armor/);
  await armor.click();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});

test("expanded releases show only supported categories in order and warm displayed artwork", async ({
  page,
}) => {
  const categories = [
    ["melee_weapon", "Melee Weapons"],
    ["ranged_weapon", "Ranged Weapons"],
    ["armor", "Armor"],
    ["artifact", "Artifacts"],
    ["talisman", "Talismans"],
    ["enchantment", "Enchantments"],
    ["gear_effect", "Gear Effects"],
  ];
  const entries = [
    ...categories.map(([category]) => category).reverse(),
    "location",
    "mob",
    "pet",
    "cape",
    "status",
  ].map((category) => ({
    slug: category,
    category,
    type: category,
    variation: category,
    image: `images/${category}`,
  }));
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: entries }),
  );
  const artwork: string[] = [];
  await page.route("**/images/*", (route) => {
    artwork.push(new URL(route.request().url()).pathname.split("/").at(-1)!);
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    });
  });
  await page.goto("/collection?sort=category");
  const buttons = page
    .getByRole("group", { name: "Catalog categories", exact: true })
    .getByRole("button");
  await expect(buttons).toHaveCount(7);
  for (const [index, [, label]] of categories.entries()) {
    await expect(buttons.nth(index)).toContainText(label);
  }
  await expect(page.getByRole("article")).toHaveCount(7);
  await expect(page.locator(".item-name")).toHaveText(
    categories.map(([category]) => category),
  );
  await expect
    .poll(() => [...new Set(artwork)].sort())
    .toEqual(categories.map(([category]) => category).sort());
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(7);
  await page.getByRole("searchbox").fill("location");
  await expect(
    page.getByRole("heading", { name: "No items found" }),
  ).toBeVisible();
});

for (const mobile of [false, true]) {
  test(`catalog unique effects show artwork and fixed-value tooltip (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/catalog.json", (route) =>
      route.fulfill({
        json: [
          ...catalog,
          {
            ...catalog[0],
            slug: "awesomeaxe",
            variation: "Awesomeaxe",
            game_data: {
              unique: true,
              effects: [
                {
                  catalog_slug: "fire",
                  tier: "unique",
                  text: "Burns enemies for 40 damage.",
                },
              ],
            },
          },
          {
            slug: "fire",
            variation: "Fire",
            category: "gear_effect",
            type: "attack",
            image: "images/unique-effect",
            description: "Burns enemies for 10 damage.",
          },
        ],
      }),
    );
    await page.route("**/images/unique-effect", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><rect width="26" height="26" fill="orange"/></svg>',
      }),
    );
    await page.goto("/collection");
    const card = page.getByRole("article", { name: "Awesomeaxe", exact: true });
    const icon = card.locator(".item-unique-effect");
    await expect(
      icon.getByRole("img", { name: "Fire", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("article", { name: "Battle Hammer", exact: true })
        .locator(".item-unique-effect"),
    ).toHaveCount(0);
    const cardBox = await card.boundingBox();
    const iconBox = await icon.boundingBox();
    expect(iconBox!.x + iconBox!.width).toBeLessThan(
      cardBox!.x + cardBox!.width,
    );
    await page.mouse.move(0, 0);
    await icon.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Fire: Burns enemies for 40 damage.",
    );
    await page.mouse.move(0, 0);
    await icon.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("tooltip")).toHaveText(
      "Fire: Burns enemies for 40 damage.",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
