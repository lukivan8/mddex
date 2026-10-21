import { test, expect } from "@playwright/test";
const hit = {
  damage: 16,
  stagger: 30,
  range: 275,
  weight: "Medium",
  speed: 0.9,
  cone: 80,
  knockback: 500,
  splash: 0.3,
};
const catalog = [
  {
    slug: "melee_weapon-pickaxe",
    category: "melee_weapon",
    type: "pickaxes",
    variation: "Pickaxe",
    image: null,
    description: "The iconic tool of adventurers.",
    game_data: {
      slug: "pickaxe",
      uniqueVariant: {
        name: "The Prospector's Pick",
        catalog_slug: "melee_weapon-diamond-pickaxe",
      },
      sources: [],
      melee: {
        combo: [hit, hit, { ...hit, damage: 24 }],
        jump: { ...hit, damage: 28 },
        combo_reset: 1.15,
      },
    },
  },
  {
    slug: "melee_weapon-diamond-pickaxe",
    category: "melee_weapon",
    type: "pickaxes",
    variation: "The Prospector's Pick",
    image: null,
    description: "For those who miss emerald mining.",
    game_data: {
      slug: "the-prospectors-pick",
      unique: true,
      base: { name: "Pickaxe", catalog_slug: "melee_weapon-pickaxe" },
      sources: [
        {
          type: "area",
          name: "Howling Woods",
          catalog_slug: "location-howling-woods",
        },
      ],
      melee: {
        combo: [hit, hit, { ...hit, damage: 24 }],
        jump: { ...hit, damage: 28 },
        combo_reset: 1.15,
      },
    },
  },
  {
    slug: "ranged_weapon-bow",
    category: "ranged_weapon",
    type: "bows",
    variation: "Bow",
    image: null,
    game_data: {
      slug: "bow",
      sources: [],
      ranged: {
        range: 750,
        ammo: 20,
        reload: 1.2,
        charge_damage: 3,
        projectiles: [{ damage: 18 }],
      },
    },
  },
  {
    slug: "melee_weapon-battle-hammer",
    category: "melee_weapon",
    type: "hammers",
    variation: "Battle Hammer",
    image: null,
    game_data: {
      slug: "battle-hammer",
      sources: [],
      melee: {
        combo: [{ ...hit, damage: 30, stagger: 50, range: 240, speed: 1.5 }],
        jump: { ...hit, damage: 20 },
      },
    },
  },
  {
    slug: "melee_weapon-double-daggers",
    category: "melee_weapon",
    type: "daggers",
    variation: "Double Daggers",
    image: null,
    description: "When one dagger just isn't fast enough.",
    game_data: {
      slug: "double-daggers",
      sources: [],
      melee: {
        combo: [
          { ...hit, damage: 6, hit_count: 2 },
          { ...hit, damage: 6, hit_count: 2 },
          { ...hit, damage: 9, hit_count: 2 },
        ],
        jump: { ...hit, damage: 14 },
        combo_reset: 1.15,
      },
    },
  },
  {
    slug: "ranged_weapon-crossbow",
    category: "ranged_weapon",
    type: "crossbows",
    variation: "Crossbow",
    image: null,
    game_data: {
      slug: "crossbow",
      sources: [],
      ranged: {
        range: 800,
        ammo: 10,
        reload: 0.9,
        projectiles: [{ damage: 24 }],
      },
    },
  },
  {
    slug: "ranged_weapon-shortbow",
    category: "ranged_weapon",
    type: "bows",
    variation: "Shortbow",
    image: null,
    game_data: {
      slug: "shortbow",
      sources: [],
      ranged: {
        range: 750,
        ammo: 18,
        charge_damage: 3,
        projectiles: [{ damage: 11 }],
      },
    },
  },
  {
    slug: "ranged_weapon-shooting-star",
    category: "ranged_weapon",
    type: "bows",
    variation: "Shooting Star",
    image: null,
    game_data: {
      slug: "shooting-star",
      base: { name: "Shortbow", catalog_slug: "ranged_weapon-shortbow" },
      sources: [],
      ranged: {
        range: 750,
        ammo: 18,
        charge_damage: 3,
        projectiles: [{ damage: 11 }],
      },
    },
  },
  {
    slug: "location-howling-woods",
    category: "location",
    type: "location",
    variation: "Howling Woods",
    image: null,
    game_data: { slug: "howling-woods", sources: [] },
  },
];
test.beforeEach(async ({ page }) => {
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "detail-test",
        manifest: "releases/detail-test/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
});
for (const mobile of [false, true])
  test(`weapon cards open details and preserve filtered catalog (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const original =
      "/collection?q=Pick&category=melee_weapon&type=pickaxes&sort=category";
    await page.goto(original);
    const card = page.getByRole("article", {
      name: "The Prospector's Pick",
      exact: true,
    });
    const link = card.locator("a.item-content");
    await expect(link).toHaveAttribute(
      "href",
      /\/catalog\/melee-weapons\/the-prospectors-pick\?returnTo=/,
    );
    await link.click();
    await expect(page.locator("h1")).toHaveText("The Prospector's Pick");
    await expect(
      page.getByRole("table", { name: "Attack values", exact: true }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://mddex.net/catalog/melee-weapons/the-prospectors-pick",
    );
    await page
      .locator(".detail-reference")
      .filter({ hasText: "Base weapon" })
      .click();
    await expect(page.locator("h1")).toHaveText("Pickaxe");
    await page
      .getByRole("link", { name: "Back to catalog", exact: true })
      .click();
    const url = new URL(page.url());
    expect(Object.fromEntries(url.searchParams)).toEqual(
      Object.fromEntries(new URL(original, url.origin).searchParams),
    );
    await expect(page.getByRole("searchbox")).toHaveValue("Pick");
    await expect(page.getByRole("article")).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
test("ranged weapons link to their own stats and metadata", async ({
  page,
}) => {
  await page.goto("/collection?category=ranged_weapon");
  await page
    .getByRole("article", { name: "Bow", exact: true })
    .locator("a.item-content")
    .click();
  await expect(page).toHaveURL(/\/catalog\/ranged-weapons\/bow/);
  await expect(page.locator("h1")).toHaveText("Bow");
  await expect(page.locator(".detail-stats")).toContainText(
    "18 → 54 (fully charged)",
  );
  await expect(page.locator(".detail-stats")).not.toContainText("Range");
  await expect(page).toHaveTitle(/Bow.*Minecraft Dungeons 2/);
});
test("Shortbow and its unique variant use the corrected two-times charge", async ({
  page,
}) => {
  await page.goto("/collection?category=ranged_weapon");
  await page
    .getByRole("article", { name: "Shortbow", exact: true })
    .locator("a.item-content")
    .click();
  await expect(page.locator(".detail-stats")).toContainText(
    "11 → 22 (fully charged)",
  );
  await page.goto("/collection?category=ranged_weapon");
  await page
    .getByRole("article", { name: "Shooting Star", exact: true })
    .locator("a.item-content")
    .click();
  await expect(page.locator(".detail-stats")).toContainText(
    "11 → 22 (fully charged)",
  );
});
test("published melee hit counts render alongside powered per-hit damage", async ({
  page,
}) => {
  await page.goto("/collection?q=Double+Daggers");
  await page
    .getByRole("article", { name: "Double Daggers", exact: true })
    .locator("a.item-content")
    .click();
  await page.getByRole("spinbutton", { name: "Power" }).fill("29");
  await expect(page.locator(".detail-stats")).toContainText("3 attacks");
  await expect(page.locator(".detail-stats")).toContainText(
    "14 × 2 → 14 × 2 → 22 × 2",
  );
  await expect(page.locator(".detail-combo-total")).toContainText("100");
  await expect(
    page.getByRole("table", { name: "Attack values" }),
  ).toContainText("14 × 2");
});
test("Power stays on item details and comparison, not the catalog list", async ({
  page,
}) => {
  await page.goto("/collection?category=melee_weapon&power=10");
  await expect(page.getByRole("spinbutton", { name: "Power" })).toHaveCount(0);
  await page
    .getByRole("article", { name: "Pickaxe", exact: true })
    .locator("a.item-content")
    .click();
  await expect(page.getByRole("spinbutton", { name: "Power" })).toHaveValue(
    "1",
  );
  await expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/collection?category=melee_weapon",
  );
  await page.getByRole("spinbutton", { name: "Power" }).fill("10");
  await expect(page.getByRole("spinbutton", { name: "Power" })).toHaveValue(
    "10",
  );
  await expect(page.locator(".detail-stats")).toContainText("23 → 23 → 35");
  await expect(page.locator(".detail-combo-total")).toContainText("81");
  await expect(page.locator(".detail-stats")).toContainText("41");
  await expect(page.getByRole("link", { name: "Compare weapon" })).toHaveCount(
    0,
  );
  await page.goto(
    "/compare?mode=melee&left=melee_weapon-pickaxe&power=10&returnTo=%2Fcollection%3Fcategory%3Dmelee_weapon",
  );
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("spinbutton", { name: "Power" })).toHaveValue(
    "10",
  );
  await page
    .getByRole("button", { name: "Select Battle Hammer for comparison" })
    .click();
  const combo = page
    .getByRole("table", { name: "Moveset overview" })
    .getByRole("row", { name: /Full combo damage/ });
  await expect(combo).toContainText("81");
  await page.getByRole("link", { name: /Back to Pickaxe/ }).click();
  await page.getByRole("link", { name: "Back to catalog" }).click();
  await expect(page).toHaveURL(/\/collection\?category=melee_weapon$/);
  await expect(page.getByRole("spinbutton", { name: "Power" })).toHaveCount(0);
  await page
    .getByRole("article", { name: "Pickaxe", exact: true })
    .locator("a.item-content")
    .click();
  await expect(page.getByRole("spinbutton", { name: "Power" })).toHaveValue(
    "1",
  );
  await page.getByRole("spinbutton", { name: "Power" }).fill("11");
  await expect(page).toHaveURL(/power=11/);
  await expect(page.locator(".detail-stats")).toContainText("24 → 24 → 36");
});

test("Power rounds full charge from the unscaled bow damage", async ({
  page,
}) => {
  await page.goto("/collection?category=ranged_weapon");
  await page
    .getByRole("article", { name: "Shortbow", exact: true })
    .locator("a.item-content")
    .click();
  await page.getByRole("spinbutton", { name: "Power" }).fill("2");
  await expect(page.locator(".detail-stats")).toContainText(
    "12 → 23 (fully charged)",
  );
  await page.getByRole("spinbutton", { name: "Power" }).fill("10");
  await expect(page).toHaveURL(/power=10/);
  await expect(page.locator(".detail-stats")).toContainText(
    "16 → 32 (fully charged)",
  );
});

test("Power can return to 1 without being restored from the catalog return URL", async ({
  page,
}) => {
  await page.goto(
    "/catalog/melee-weapons/pickaxe?returnTo=%2Fcollection%3Fq%3Dpick%26power%3D149&power=149",
  );
  await page.waitForLoadState("networkidle");
  await page.getByRole("spinbutton", { name: "Power" }).fill("1");
  await expect(page.getByRole("spinbutton", { name: "Power" })).toHaveValue(
    "1",
  );
  await expect(page.locator(".detail-stats")).toContainText("16 → 16 → 24");
  const url = new URL(page.url());
  expect(url.searchParams.has("power")).toBe(false);
  expect(url.searchParams.get("returnTo")).toBe("/collection?q=pick");
  await page.getByRole("link", { name: "Back to catalog" }).click();
  await expect(page).toHaveURL(/\/collection\?q=pick$/);
});

test("comparison Power can also return to 1", async ({ page }) => {
  await page.goto(
    "/compare?mode=melee&left=melee_weapon-pickaxe&returnTo=%2Fcollection%3Fpower%3D149&power=149",
  );
  await page.waitForLoadState("networkidle");
  await page.getByRole("spinbutton", { name: "Power" }).fill("1");
  await expect(page.getByRole("spinbutton", { name: "Power" })).toHaveValue(
    "1",
  );
  const url = new URL(page.url());
  expect(url.searchParams.has("power")).toBe(false);
  expect(url.searchParams.get("returnTo")).toBe("/collection");
});
test("published weapon detail is rendered for direct arrivals and rejects external return URLs", async ({
  request,
  page,
}) => {
  const response = await request.get(
    "/catalog/melee-weapons/the-prospectors-pick",
  );
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain("The Prospector&#x27;s Pick");
  expect(html).toContain("detail-dossier");
  expect(html).not.toContain("detail-guide");
  expect(html).toContain("application/ld+json");
  await page.goto(
    "/catalog/melee-weapons/the-prospectors-pick?returnTo=https://example.com/collection",
  );
  await expect(
    page.getByRole("link", { name: "Back to catalog", exact: true }),
  ).toHaveAttribute("href", "/collection");
});
test("hidden comparison remains available by URL with a selected weapon", async ({
  page,
}) => {
  const original = "/collection?q=Pick&category=melee_weapon&type=pickaxes";
  await page.goto(original);
  await page
    .getByRole("article", { name: "The Prospector's Pick" })
    .locator("a.item-content")
    .click();
  await expect(page.getByRole("link", { name: "Compare weapon" })).toHaveCount(
    0,
  );
  await page.goto(
    `/compare?mode=melee&left=melee_weapon-diamond-pickaxe&returnTo=${encodeURIComponent(original)}`,
  );
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(
    /\/compare\?mode=melee&left=melee_weapon-diamond-pickaxe/,
  );
  await expect(
    page.getByRole("button", { name: "Choose first weapon" }),
  ).toContainText("The Prospector's Pick");
  await page
    .getByRole("button", { name: "Select Battle Hammer for comparison" })
    .click();
  await expect(
    page.getByRole("table", { name: "Moveset overview" }),
  ).toBeVisible();
  const combo = page
    .getByRole("table", { name: "Moveset overview" })
    .getByRole("row", { name: /Full combo damage/ });
  await expect(combo.locator("td").first()).toHaveClass(
    /compare-value--better/,
  );
  await expect(combo.locator("td").last()).toHaveClass(/compare-value--worse/);
  const rate = page
    .getByRole("table", { name: "Moveset overview" })
    .getByRole("row", { name: /Spam damage rate/ });
  await expect(rate.locator("td")).toHaveCount(2);
  const jump = page
    .getByRole("table", { name: "Moveset overview" })
    .getByRole("row", { name: /Jump damage/ });
  await expect(jump.locator("td")).toHaveCount(2);
  const speed = page
    .getByRole("table", { name: "Hit 1" })
    .getByRole("row", { name: /Speed/ });
  await expect(speed.locator("td")).toHaveCount(2);
  await page
    .getByRole("link", { name: /Back to The Prospector's Pick/ })
    .click();
  await expect(page.locator("h1")).toHaveText("The Prospector's Pick");
  await page.getByRole("link", { name: "Back to catalog" }).click();
  const url = new URL(page.url());
  expect(Object.fromEntries(url.searchParams)).toEqual(
    Object.fromEntries(new URL(original, url.origin).searchParams),
  );
});
test("hidden ranged comparison remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/collection?category=ranged_weapon");
  await page
    .getByRole("article", { name: "Bow", exact: true })
    .locator("a.item-content")
    .click();
  await expect(page.getByRole("link", { name: "Compare weapon" })).toHaveCount(
    0,
  );
  await page.goto(
    "/compare?mode=ranged&left=ranged_weapon-bow&returnTo=%2Fcollection%3Fcategory%3Dranged_weapon",
  );
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("radio", { name: "Ranged weapons" }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Select Crossbow for comparison" })
    .click();
  const table = page.getByRole("table", { name: "Ranged stats" });
  await expect(table.getByRole("row", { name: /Range/ })).toHaveCount(0);
  await expect(
    table.getByRole("row", { name: /Fully charged damage/ }),
  ).toBeVisible();
  const ammo = table.getByRole("row", { name: /Ammo/ });
  await expect(ammo.locator("td")).toHaveCount(2);
  const reload = table.getByRole("row", { name: /Reload time/ });
  await expect(reload.locator("td")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("radio", { name: "Melee weapons" }).click();
  await expect(
    page.getByRole("button", { name: "Choose first weapon" }),
  ).toContainText("Choose weapon");
});
