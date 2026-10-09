import { test, expect } from "@playwright/test";
const items = [
  {
    slug: "armor-alchemist-hat",
    category: "armor",
    type: "head",
    variation: "Alchemist Hat",
    image: null,
    game_data: { slug: "alchemist-hat", slot: "helmet", set: "Alchemist" },
  },
  {
    slug: "armor-alchemist-trousers",
    category: "armor",
    type: "legs",
    variation: "Alchemist Trousers",
    image: null,
    game_data: {
      slug: "alchemist-trousers",
      slot: "leggings",
      set: "Alchemist",
      baseSet: "Sorcerer",
    },
  },
  {
    slug: "artifact-witch-brew",
    category: "artifact",
    type: "utility",
    variation: "Witch Brew",
    image: null,
    game_data: {
      slug: "witch-brew",
      artifact: { cooldown: 30, soul_cost: 0 },
      sources: [{ type: "mob", name: "Witch", catalog_slug: "mob-witch" }],
    },
  },
  {
    slug: "talisman-amethyst-lens",
    category: "talisman",
    type: "talisman",
    variation: "Amethyst Lens",
    image: null,
    game_data: {
      slug: "amethyst-lens",
      levels: [
        {
          level: "1",
          xp: 100,
          effects: [
            {
              name: "Acrobat",
              text: "Reduces rolling cooldown by 10%.",
              catalog_slug: "gear_effect-acrobat",
            },
          ],
        },
      ],
    },
  },
  {
    slug: "enchantment-ancient-alchemy",
    category: "enchantment",
    type: "utility",
    variation: "Ancient Alchemy",
    image: null,
    game_data: {
      slug: "ancient-alchemy",
      slots: ["Helmet", "Boots"],
      category: "utility",
      tiers: [
        { tier: "I", text: "Potion usage grants 30 souls." },
        { tier: "II", text: "Potion usage grants 45 souls." },
      ],
    },
  },
  {
    slug: "gear_effect-acrobat",
    category: "gear_effect",
    type: "utility",
    variation: "Acrobat",
    image: null,
    game_data: {
      slug: "acrobat",
      gear: ["armor"],
      tiers: [
        {
          tier: "I",
          talisman: false,
          text: "Reduces rolling cooldown by 10%.",
        },
        {
          tier: "IV",
          talisman: false,
          text: "Reduces rolling cooldown by 35%.",
        },
        {
          tier: "unique",
          talisman: false,
          text: "Reduces rolling cooldown by 40%.",
        },
        { tier: "I", talisman: true, text: "Reduces rolling cooldown by 20%." },
      ],
      carriers: [
        {
          name: "Alchemist Trousers",
          catalog_slug: "armor-alchemist-trousers",
        },
      ],
    },
  },
  {
    slug: "mob-witch",
    category: "mob",
    type: "hostile",
    variation: "Witch",
    image: null,
    game_data: {
      slug: "witch",
      health: 33,
      speed: 300,
      poise: 50,
      souls: 0,
      areas: [
        { name: "Howling Woods", catalog_slug: "location-howling-woods" },
      ],
      drops: [{ name: "Witch Brew", catalog_slug: "artifact-witch-brew" }],
      attacks: [{ attack: "Potion throw", damage: 8, cooldown: 1.5 }],
    },
  },
  {
    slug: "location-howling-woods",
    category: "location",
    type: "location",
    variation: "Howling Woods",
    image: null,
    artwork: {
      "instances.dungeons.howling-woods.icon": "../../images/dungeon.png",
      "instances.rifts.howling-woods.icon": "../../images/rift.png",
    },
    game_data: {
      slug: "howling-woods",
      level: 6,
      location_context: {
        instances: [
          {
            name: "Howling Woods Dungeons",
            icon: { artwork_key: "instances.dungeons.howling-woods.icon" },
          },
          {
            name: "Howling Woods Rifts",
            icon: { artwork_key: "instances.rifts.howling-woods.icon" },
          },
          { name: "Entrance without artwork" },
        ],
      },
      mobs: [{ name: "Witch", catalog_slug: "mob-witch" }],
      loot: [
        { name: "Witch Brew", catalog_slug: "artifact-witch-brew" },
        {
          name: "Alchemist Trousers",
          catalog_slug: "armor-alchemist-trousers",
        },
      ],
    },
  },
];
test.beforeEach(async ({ page }) => {
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "category-test",
        manifest: "releases/category-test/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: items }),
  );
});
const cases = [
  ["armor", "Alchemist Trousers", "Armor details", "Sorcerer"],
  ["artifact", "Witch Brew", "Artifact stats", "30"],
  ["talisman", "Amethyst Lens", "Talisman levels", "XP: 100"],
  ["enchantment", "Ancient Alchemy", "Enchantment tiers", "45 souls"],
  ["gear_effect", "Acrobat", "Gear tiers", "35%"],
];
test("armor details link to other pieces of the same set", async ({ page }) => {
  await page.goto("/collection?category=armor&q=Alchemist");
  await page
    .getByRole("article", { name: "Alchemist Trousers", exact: true })
    .locator("a.item-content")
    .click();
  const related = page.locator("aside section").filter({
    has: page.getByRole("heading", { name: "Related equipment", exact: true }),
  });
  await expect(related.getByRole("link")).toHaveCount(1);
  await expect(
    related.getByRole("link", { name: "Alchemist set Alchemist Hat" }),
  ).toHaveAttribute(
    "href",
    "/catalog/armor/alchemist-hat?returnTo=%2Fcollection%3Fcategory%3Darmor%26q%3DAlchemist",
  );
  await page
    .getByRole("link", { name: "Back to catalog", exact: true })
    .click();
  await expect(page).toHaveURL(/category=armor&q=Alchemist/);
});
for (const [category, name, heading, value] of cases)
  test(`${category} cards show their own detail sections`, async ({ page }) => {
    await page.goto(`/collection?category=${category}`);
    await page
      .getByRole("article", { name, exact: true })
      .locator("a.item-content")
      .click();
    await expect(page.locator("h1")).toHaveText(name);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".detail-dossier")).toContainText(value);
    await expect(page.locator(".detail-guide")).toContainText(name);
    await expect(page).toHaveTitle(new RegExp(`${name}.*Minecraft Dungeons 2`));
    if (category === "gear_effect") {
      await expect(
        page.getByRole("table", { name: "Tier values", exact: true }),
      ).toContainText("IV");
      await expect(
        page.getByRole("table", { name: "Talisman tier values", exact: true }),
      ).toContainText("20%");
      await expect(
        page.getByRole("table", { name: "Tier values", exact: true }),
      ).not.toContainText("20%");
    }
    await page
      .getByRole("link", { name: "Back to catalog", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`category=${category}`));
  });
for (const mobile of [false, true])
  test(`mob browser, detail stats and search return (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/collection");
    await expect(page.getByRole("article")).toHaveCount(6);
    if (mobile)
      await page
        .getByRole("button", { name: "Open navigation menu", exact: true })
        .click();
    await page.getByRole("link", { name: "Mobs", exact: true }).click();
    await expect(
      page.getByRole("group", { name: "Mob type" }).getByRole("button"),
    ).toHaveCount(4);
    await page.keyboard.press("/");
    await expect(
      page.getByRole("searchbox", { name: "Search mobs", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Neutral", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(0);
    await page.getByRole("button", { name: "Hostile", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(1);
    const mobCard = page.getByRole("article", { name: "Witch", exact: true });
    await expect(mobCard.locator(".item-top")).toHaveText("Hostile");
    await expect(mobCard.locator(".item-bottom")).toHaveCount(0);
    await page
      .getByRole("button", { name: "All locations Location", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Howling Woods", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Search mobs", exact: true })
      .fill("Witch");
    await page
      .getByRole("button", { name: "Name A–Z Sort mobs", exact: true })
      .click();
    await page.getByRole("option", { name: "Name Z–A", exact: true }).click();
    await expect(page).toHaveURL(/sort=name_desc/);
    await page
      .getByRole("article", { name: "Witch", exact: true })
      .locator("a.item-content")
      .click();
    await expect(page.locator("h1")).toHaveText("Witch");
    await expect(
      page.getByRole("heading", { name: "Mob stats", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".detail-stats")).toContainText("33");
    await expect(
      page.getByRole("table", { name: "Mob attacks", exact: true }),
    ).toContainText("Potion throw");
    await expect(page.locator(".detail-guide")).toContainText("Witch Brew");
    await page.getByRole("link", { name: "Back to mobs", exact: true }).click();
    await expect(
      page.getByRole("searchbox", { name: "Search mobs", exact: true }),
    ).toHaveValue("Witch");
    await expect(
      page.getByRole("button", { name: "Hostile", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/location=location-howling-woods/);
    await expect(page).toHaveURL(/sort=name_desc/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
test("location links to mob stats and loot without inferring drops", async ({
  page,
}) => {
  await page.route("**/images/*.png", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/collection?category=artifact");
  await page
    .getByRole("article", { name: "Witch Brew", exact: true })
    .locator("a.item-content")
    .click();
  await page.locator(".detail-source").filter({ hasText: "Witch" }).click();
  await expect(page.locator("h1")).toHaveText("Witch");
  await expect(
    page.getByRole("heading", { name: "Drops", exact: true }),
  ).toBeVisible();
  await page
    .locator(".detail-reference")
    .filter({ hasText: "Howling Woods" })
    .first()
    .click();
  await expect(page.locator("h1")).toHaveText("Howling Woods");
  await expect(
    page.getByRole("heading", { name: "Mobs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Loot", exact: true }),
  ).toBeVisible();
  const lootGroups = await page
    .locator(".detail-loot-group > h3")
    .allTextContents();
  expect(lootGroups).toEqual(
    ["Melee Weapons", "Ranged Weapons", "Armor", "Artifacts"].filter((group) =>
      lootGroups.includes(group),
    ),
  );
  expect(lootGroups).toContain("Armor");
  expect(lootGroups).toContain("Artifacts");
  for (const [name, file] of [
    ["Howling Woods Dungeons", "dungeon"],
    ["Howling Woods Rifts", "rift"],
  ]) {
    const image = page.getByRole("img", { name, exact: true });
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute(
      "src",
      new RegExp(`/images/${file}\\.png$`),
    );
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(1);
  }
  await expect(
    page.getByRole("heading", { name: "Entrance without artwork" }),
  ).toBeVisible();
});
