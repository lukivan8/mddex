import { test, expect } from "@playwright/test";
import { emptyBuild } from "../src/features/builds/build.service";
import { encodeBuildLink } from "../src/features/builds/build.link";
const initial = emptyBuild("Overlapping loot", "planner-test");
initial.slots.melee = {
  itemSlug: "axe",
  enchantments: ["one-time-book"],
  effects: ["hunt-burn", "hunt-frost"],
};
initial.slots.talisman1 = {
  itemSlug: "one-time-talisman",
  enchantments: [],
  effects: [],
};
initial.slots.ranged = { itemSlug: "bow", enchantments: [], effects: [] };
initial.variants = [
  {
    id: "quest-only",
    name: "Quest reward build",
    slots: {
      ...emptyBuild("Quest").slots,
      talisman1: { itemSlug: "quest-amulet", enchantments: [], effects: [] },
    },
  },
  {
    id: "route",
    name: "Multi-stop route",
    slots: {
      ...initial.slots,
      torso: { itemSlug: "robe", enchantments: [], effects: [] },
    },
  },
  {
    id: "unknown",
    name: "Unknown items",
    slots: {
      ...emptyBuild("Variant").slots,
      melee: { itemSlug: "lost-item", enchantments: [], effects: [] },
    },
  },
];
const catalog = [
  ...["burn", "frost"].map((name) => ({
    slug: `hunt-${name}`,
    category: "gear_effect",
    type: "attack",
    variation: `Hunt ${name}`,
    image: `https://cdn.mddex.net/planner-effects/${name}.svg`,
    game_data: { slug: `hunt-${name}` },
  })),
  {
    slug: "quest-amulet",
    variation: "Quest Amulet",
    category: "talisman",
    type: "talisman",
    image: null,
    game_data: {
      slug: "quest-amulet",
      sources: [
        {
          type: "quest",
          name: "Illegal Illager Trials",
          href: "https://wikily.gg/minecraft-dungeons-2/quests/illegal-illager-trials",
        },
      ],
    },
  },
  ...["book", "talisman"].map((kind) => ({
    slug: `one-time-${kind}`,
    category: kind === "book" ? "enchantment" : "talisman",
    type: kind,
    variation: `One-time ${kind}`,
    image: null,
    game_data: {
      slug: `one-time-${kind}`,
      sources: [
        ...["Zone X", "Zone Y", "Zone Z"].map((name) => ({
          type: "area",
          name,
        })),
        { type: "area", name: "Woods", catalog_slug: "location-woods" },
      ],
    },
  })),
  {
    slug: "robe",
    category: "armor",
    type: "chest",
    variation: "Robe",
    image: null,
    detail_path: "details/robe.json",
    game_data: { slug: "robe" },
  },
  {
    slug: "axe",
    category: "melee_weapon",
    type: "axe",
    variation: "Axe",
    image: null,
    detail_path: "details/axe.json",
    game_data: { slug: "axe" },
  },
  {
    slug: "bow",
    category: "ranged_weapon",
    type: "bow",
    variation: "Bow",
    image: null,
    detail_path: "details/bow.json",
    game_data: { slug: "bow" },
  },
  {
    slug: "location-woods",
    category: "location",
    type: "location",
    variation: "Woods",
    image: null,
    game_data: { slug: "woods" },
  },
  {
    slug: "location-plains",
    category: "location",
    type: "location",
    variation: "Plains",
    image: null,
    game_data: { slug: "plains" },
  },
];
for (const mobile of [false, true])
  test(`planner finds overlapping stops without changing saves on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/planner-effects/*.svg", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="cyan"/></svg>',
      }),
    );
    const shards: string[] = [];
    await page.route("**/latest.json", (route) =>
      route.fulfill({
        json: {
          catalogVersion: "planner-v1",
          manifest: "releases/planner-v1/manifest.json",
          catalogIndex: "releases/planner-v1/catalog-index.json",
        },
      }),
    );
    await page.route("**/releases/planner-v1/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("catalog-index.json"))
        return route.fulfill({ json: catalog });
      shards.push(url);
      const item = catalog.find((item) =>
        url.endsWith(`details/${item.slug}.json`),
      );
      if (!item) return route.abort();
      return route.fulfill({
        json: {
          ...item,
          game_data: {
            ...item.game_data,
            sources: [
              ...(item.slug !== "robe"
                ? ["Zone X", "Zone Y", "Zone Z"].map((name) => ({
                    type: "area",
                    name,
                  }))
                : []),
              ...(item.slug !== "robe"
                ? [
                    {
                      type: "area",
                      name: "Woods",
                      catalog_slug: "location-woods",
                    },
                  ]
                : []),
              ...(item.slug !== "axe"
                ? [
                    {
                      type: "area",
                      name: "Plains",
                      catalog_slug: "location-plains",
                    },
                  ]
                : []),
            ],
            acquisition: {
              sources: [
                { type: "merchant", name: "Town Merchant" },
                ...(item.slug === "axe"
                  ? [
                      {
                        type: "quest",
                        name: "Help the town",
                        href: "https://wikily.gg/minecraft-dungeons-2/quests/help-the-town",
                        trigger: "first_completion",
                      },
                    ]
                  : []),
              ],
            },
          },
        },
      });
    });
    const saved = JSON.stringify({
      ["s:" + initial.id]: { versionKey: "planner", data: initial },
    });
    await page.addInitScript((value) => {
      if (!localStorage.getItem("mddex.builds.v3"))
        localStorage.setItem("mddex.builds.v3", value);
    }, saved);
    await page.goto("/resources");
    await page.getByRole("link", { name: /Farming planner/ }).click();
    await page.getByRole("button", { name: "Saved build" }).click();
    await page.getByRole("option", { name: "Overlapping loot" }).click();
    await expect(page.locator(".planner-stop")).toHaveCount(1);
    await expect(page.locator(".planner-stop")).toContainText("Woods");
    await expect(page.locator(".planner-stop .planner-loot > div")).toHaveCount(
      4,
    );
    const effectRow = page.locator(".planner-stop .planner-item-effects");
    await expect(effectRow).toHaveCount(1);
    await expect(effectRow.locator(".planner-effect-icon")).toHaveCount(2);
    await expect(effectRow.locator("img")).toHaveCount(2);
    await expect(
      effectRow.getByLabel("Hunt burn", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".planner-route")).toHaveCount(0);
    const tiles = page.locator(".planner-import .planner-target");
    await expect(tiles).toHaveCount(4);
    await expect(page.locator("aside.planner-targets")).toHaveCount(0);
    const tileLayout = await tiles.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height, top: rect.top };
      }),
    );
    expect(
      tileLayout.every((tile) => tile.width >= 48 && tile.height >= 48),
    ).toBe(true);
    await expect(tiles.nth(0)).toHaveAccessibleName(/^Axe /);
    await expect(tiles.nth(1)).toHaveAccessibleName(/^One-time book /);
    await expect(tiles.nth(2)).toHaveAccessibleName(/^Bow /);
    await expect(tiles.nth(3)).toHaveAccessibleName(/^One-time talisman /);
    await tiles.first().focus();
    await expect(page.getByRole("tooltip")).toContainText("Axe");
    await page.getByRole("checkbox", { name: /Bow/ }).uncheck();
    await expect(page.locator(".planner-stop .planner-loot > div")).toHaveCount(
      3,
    );
    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await page
      .getByRole("button", { name: "Deselect one-time unlocks", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: /One-time book/ }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /One-time talisman/ }),
    ).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Axe / })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Bow / })).toBeChecked();
    await expect(page.locator(".planner-stop .planner-loot > div")).toHaveCount(
      2,
    );
    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await expect(page.locator(".planner-stop")).toHaveCount(0);
    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await expect(
      page.getByText("All ways to get your items", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Unique rarity chances", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Alternative farming routes", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("radio", { name: "Variant IV: Unknown items", exact: true })
      .click();
    await expect(page.locator(".planner-other")).toContainText(
      "not in the current catalog",
    );
    const token = await encodeBuildLink(initial);
    await page
      .getByRole("textbox", { name: "Or paste a build link" })
      .fill(`https://mddex.net/build#build=${token}`);
    await page.getByRole("button", { name: "Use build", exact: true }).click();
    await expect(page.locator(".planner-stop .planner-loot > div")).toHaveCount(
      4,
    );
    await expect(
      page.getByRole("button", { name: "Use build", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("textbox", { name: "Or paste a build link" })
      .fill("https://mddex.net/build?share=ABCDEFGHIJKLMNOPQRSTUV");
    await page.route("**/api/build-links/ABCDEFGHIJKLMNOPQRSTUV", (route) =>
      route.fulfill({ json: { token } }),
    );
    await page.getByRole("button", { name: "Use build", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Use build", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".planner-stop")).toHaveCount(1);
    await page
      .getByRole("textbox", { name: "Or paste a build link" })
      .fill("https://example.com/not-a-build");
    await page.getByRole("button", { name: "Use build", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Paste a shared MDDEX build link",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("mddex.builds.v3")),
    ).toBe(saved);
    await page
      .getByRole("radio", {
        name: "Variant III: Multi-stop route",
        exact: true,
      })
      .click();
    const stops = page.locator(".planner-stop");
    await expect(stops).toHaveCount(2);
    await expect(
      stops.nth(1).locator(":scope > .planner-loot > div"),
    ).toHaveCount(1);
    const acquired = stops.nth(1).locator(".planner-acquired-before");
    await expect(acquired).not.toHaveAttribute("open");
    await expect(acquired.locator(".planner-loot")).toBeHidden();
    await acquired.getByText("Acquired before (1)", { exact: true }).click();
    await expect(
      acquired.getByRole("link", { name: "Bow", exact: true }),
    ).toBeVisible();
    await page.getByRole("checkbox", { name: /Robe/ }).uncheck();
    await expect(stops).toHaveCount(1);
    await expect(page.locator(".planner-acquired-before")).toHaveCount(0);
    await expect(
      page.locator(".planner-target-icons").getByRole("checkbox"),
    ).toHaveCount(5);
    if (mobile) {
      await page.setViewportSize({ width: 320, height: 844 });
      const firstTile = await tiles.first().boundingBox();
      const lastTile = await tiles.last().boundingBox();
      expect(lastTile!.y).toBeGreaterThan(firstTile!.y);
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await expect(
      page.locator('.planner-target[data-one-time="true"]'),
    ).toHaveCount(2);
    await expect(
      page.locator(
        ".planner-stop .planner-one-time, .planner-route .planner-one-time",
      ),
    ).toHaveCount(0);
    await page
      .getByRole("radio", {
        name: "Variant II: Quest reward build",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Quest reward build", exact: true }),
    ).toBeVisible();
    await expect(stops).toHaveCount(1);
    await expect(stops.first()).toContainText("Quest reward");
    await expect(stops.first()).toContainText("Quest Amulet");
    await expect(
      page.locator(".planner-stop .planner-item-effects"),
    ).toHaveCount(0);
    await expect(
      stops.first().getByRole("link", { name: "Illegal Illager Trials" }),
    ).toHaveAttribute(
      "href",
      "/resources/quests?quest=illegal-illager-trials#quest-details",
    );
    await expect(
      page.getByText("Other acquisition", { exact: true }),
    ).toHaveCount(0);
    expect(shards).toHaveLength(3);
    const trackerTab = await page.context().newPage();
    await trackerTab.goto("/resources/planner");
    const trackedBook = JSON.stringify({
      version: 2,
      collected: [
        "one-time-book:collected",
        "axe:rare",
        "unknown-slug:collected",
      ],
    });
    await trackerTab.evaluate(
      (raw) => localStorage.setItem("mddex-item-tracker-v1", raw),
      trackedBook,
    );
    await page.reload();
    await page.getByRole("button", { name: "Saved build" }).click();
    await page.getByRole("option", { name: "Overlapping loot" }).click();
    const book = page.getByRole("checkbox", { name: /One-time book/ });
    const talisman = page.getByRole("checkbox", { name: /One-time talisman/ });
    await expect(book).not.toBeChecked();
    await expect(talisman).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Axe / })).toBeChecked();
    const trackedBoth = JSON.stringify({
      version: 2,
      collected: [
        "one-time-book:collected",
        "one-time-talisman:collected",
        "axe:rare",
        "unknown-slug:collected",
      ],
    });
    await trackerTab.evaluate(
      (raw) => localStorage.setItem("mddex-item-tracker-v1", raw),
      trackedBoth,
    );
    await page.bringToFront();
    await expect(talisman).not.toBeChecked();
    await expect(page.locator(".planner-stop .planner-loot > div")).toHaveCount(
      2,
    );
    await book.check();
    await expect(book).toBeChecked();
    await expect(page.locator(".planner-stop .planner-loot > div")).toHaveCount(
      3,
    );
    expect(
      await page.evaluate(() => localStorage.getItem("mddex-item-tracker-v1")),
    ).toBe(trackedBoth);
    await page
      .getByRole("radio", {
        name: "Variant III: Multi-stop route",
        exact: true,
      })
      .click();
    await expect(book).not.toBeChecked();
    await expect(talisman).not.toBeChecked();
    const trackedTalisman = JSON.stringify({
      version: 2,
      collected: ["one-time-talisman:collected"],
    });
    await trackerTab.evaluate(
      (raw) => localStorage.setItem("mddex-item-tracker-v1", raw),
      trackedTalisman,
    );
    await expect(book).toBeChecked();
    await expect(talisman).not.toBeChecked();
    await trackerTab.evaluate(() =>
      localStorage.setItem("mddex-item-tracker-v1", "unreadable tracker"),
    );
    await expect(
      page.getByText(
        "Could not read tracker progress. Item selection remains manual.",
      ),
    ).toBeVisible();
    await expect(talisman).toBeChecked();
    expect(
      await page.evaluate(() => localStorage.getItem("mddex-item-tracker-v1")),
    ).toBe("unreadable tracker");
    expect(
      await page.evaluate(() => localStorage.getItem("mddex.builds.v3")),
    ).toBe(saved);
    await trackerTab.close();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/mddex-planner-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
  });

test("planner resolves dungeon artwork from its published entrance location", async ({
  page,
}) => {
  const build = emptyBuild("Dungeon farming");
  build.slots.melee = {
    itemSlug: "dungeon-axe",
    enchantments: [],
    effects: [],
  };
  const image = "https://cdn.mddex.net/images/planner-dungeon.png";
  const sourceUrl =
    "https://wikily.gg/minecraft-dungeons-2/dungeons/frozen-highlands";
  const item = {
    slug: "dungeon-axe",
    category: "melee_weapon",
    type: "axe",
    variation: "Dungeon Axe",
    image: null,
    game_data: {
      slug: "dungeon-axe",
      acquisition: {
        sources: [
          {
            type: "dungeon",
            name: "Frozen Highlands Dungeons",
            href: sourceUrl,
          },
        ],
      },
    },
  };
  const location = {
    slug: "location-frozen-highlands",
    category: "location",
    type: "location",
    variation: "Frozen Highlands",
    image: null,
    detail_path: "details/frozen-highlands.json",
    game_data: { slug: "frozen-highlands" },
  };
  let locationRequests = 0;
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "artwork-v1",
        manifest: "releases/artwork-v1/manifest.json",
        catalogIndex: "releases/artwork-v1/catalog-index.json",
      },
    }),
  );
  await page.route("**/releases/artwork-v1/**", (route) => {
    if (route.request().url().endsWith("catalog-index.json"))
      return route.fulfill({ json: [item, location] });
    locationRequests++;
    return route.fulfill({
      json: {
        ...location,
        artwork: { "instances.dungeon.icon": image },
        game_data: {
          ...location.game_data,
          location_context: {
            instances: [
              {
                source_url: sourceUrl,
                icon: { artwork_key: "instances.dungeon.icon" },
              },
            ],
          },
        },
      },
    });
  });
  await page.route(image, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="gold"/></svg>',
    }),
  );
  await page.goto("/resources/planner");
  await expect(page.getByRole("button", { name: "Saved build" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Or paste a build link" })
    .fill(`https://mddex.net/build#build=${await encodeBuildLink(build)}`);
  await page.getByRole("button", { name: "Use build", exact: true }).click();
  await expect(page.locator(".planner-stop header img")).toHaveAttribute(
    "src",
    image,
  );
  await expect(page.locator(".planner-stop")).toContainText(
    "Frozen Highlands Dungeons",
  );
  expect(locationRequests).toBe(1);
});
