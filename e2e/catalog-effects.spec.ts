import { expect, test } from "@playwright/test";
const effects = [
  {
    slug: "fire",
    variation: "Fire",
    category: "gear_effect",
    type: "attack",
    image: null,
    description: "Deals fire damage.",
  },
  {
    slug: "ice",
    variation: "Ice",
    category: "gear_effect",
    type: "attack",
    image: null,
    description: "Deals frost damage.",
  },
];
const catalog = [
  ...effects,
  ...[
    { slug: "both", variation: "Both Sword", slugs: ["fire", "ice"] },
    { slug: "fire-sword", variation: "Fire Sword", slugs: ["fire"] },
    { slug: "ice-sword", variation: "Ice Sword", slugs: ["ice"] },
    { slug: "plain", variation: "Plain Sword", slugs: [] },
  ].map(({ slugs, ...item }) => ({
    ...item,
    category: "melee_weapon",
    type: "swords",
    image: null,
    game_data: {
      rollable_effects: {
        effects: slugs.map((catalog_slug) => ({
          catalog_slug,
          name: effects.find((effect) => effect.slug === catalog_slug)
            ?.variation,
        })),
      },
    },
  })),
];
for (const mobile of [false, true]) {
  test(`effect filter supports all/any, cancel, reload and clearing on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/latest.json", (route) =>
      route.fulfill({
        json: {
          catalogVersion: "effects-test",
          manifest: "releases/effects-test/manifest.json",
        },
      }),
    );
    await page.route("**/catalog.json", (route) =>
      route.fulfill({ json: catalog }),
    );
    await page.goto("/collection?category=melee_weapon");
    await expect(page.locator(".item-grid .item-name")).toHaveCount(4);
    await page
      .getByRole("button", { name: "Filter by effects", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Filter by effects" });
    const fire = dialog.getByRole("button", { name: "Fire", exact: true });
    const before = await fire.boundingBox();
    await fire.click();
    const after = await fire.boundingBox();
    expect(after!.height).toBe(before!.height);
    await dialog.getByRole("button", { name: "Ice", exact: true }).click();
    await expect(dialog.getByRole("status").first()).toContainText(
      "2 / 10 selected",
    );
    await dialog
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await expect(page.locator(".item-grid .item-name")).toHaveText([
      "Both Sword",
    ]);
    await page.reload();
    await expect(page.locator(".item-grid .item-name")).toHaveText([
      "Both Sword",
    ]);
    await page.getByRole("button", { name: /Filter by effects/ }).click();
    await dialog.getByRole("button", { name: "Fire", exact: true }).click();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".item-grid .item-name")).toHaveText([
      "Both Sword",
    ]);
    await expect(
      page.getByRole("radio", { name: "All", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("button", { name: "Remove Fire filter", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove Ice filter", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Category$/ })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: /Filter by effects/ }).click();
    await dialog
      .getByRole("searchbox", { name: "Search effects" })
      .fill("fire");
    await expect(dialog.locator(".picker-result")).toHaveCount(1);
    await dialog.getByRole("searchbox", { name: "Search effects" }).fill("");
    await page.screenshot({
      path: test.info().outputPath("effects-modal.png"),
    });
    await dialog
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await page.getByRole("radio", { name: "Any", exact: true }).click();
    await expect(page.locator(".item-grid .item-name")).toHaveText([
      "Both Sword",
      "Fire Sword",
      "Ice Sword",
    ]);
    const filteredUrl = page.url();
    await page
      .getByRole("link", { name: /Both Sword/ })
      .first()
      .click();
    await expect(page.locator(".detail-effect-icon.filter-match")).toHaveCount(
      2,
    );
    await page.getByRole("link", { name: /Back to catalog/i }).click();
    await expect(page).toHaveURL(filteredUrl);
    await expect(
      page.getByRole("button", { name: "Remove Fire filter", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Any", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".item-grid .item-name")).toHaveCount(3);
    await page.screenshot({ path: test.info().outputPath("effects-row.png") });
    await page
      .getByRole("button", { name: "Remove Ice filter", exact: true })
      .click();
    await expect(page.locator(".item-grid .item-name")).toHaveText([
      "Both Sword",
      "Fire Sword",
    ]);
    await page.getByRole("button", { name: /Filter by effects/ }).click();
    await dialog.getByRole("button", { name: "Clear", exact: true }).click();
    await dialog
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await expect(page.locator(".item-grid .item-name")).toHaveCount(4);
    await expect(page.locator(".results-toolbar")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

test("ten selected effects wrap on mobile and the modal prevents an eleventh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const manyEffects = Array.from({ length: 11 }, (_, index) => ({
    slug: `effect-${index}`,
    variation: `Effect ${index}`,
    category: "gear_effect",
    type: "attack",
    image: null,
  }));
  const many = [
    {
      slug: "many",
      variation: "Many Sword",
      category: "melee_weapon",
      type: "swords",
      image: null,
      game_data: {
        rollable_effects: {
          effects: manyEffects.map((effect) => ({ catalog_slug: effect.slug })),
        },
      },
    },
    ...manyEffects,
  ];
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "many-effects",
        manifest: "releases/many-effects/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) => route.fulfill({ json: many }));
  await page.goto("/collection?category=melee_weapon");
  await page
    .getByRole("button", { name: "Filter by effects", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Filter by effects" });
  for (let index = 0; index < 10; index++)
    await dialog
      .getByRole("button", { name: `Effect ${index}`, exact: true })
      .click();
  await expect(
    dialog.getByRole("button", { name: "Effect 10", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const icons = page.locator(".selected-effect-icon");
  await expect(icons).toHaveCount(10);
  const first = await icons.first().boundingBox();
  const last = await icons.last().boundingBox();
  expect(last!.y).toBeGreaterThan(first!.y);
  await expect(
    page.getByRole("radio", { name: "All", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".item-grid .item-name")).toHaveText([
    "Many Sword",
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({ path: test.info().outputPath("ten-effects.png") });
});
