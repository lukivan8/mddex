import { test, expect } from "@playwright/test";
import { emptyBuild } from "../src/features/builds/build.service";
import { encodeBuildLink } from "../src/features/builds/build.link";
const items = [false, true].map((unique) => {
  const slug = unique ? "armor-head-alchemist-hat" : "armor-sorcerer-hat";
  return {
    slug,
    category: "armor",
    type: "head",
    image: null,
    artwork: { "references.town-merchant.icon": "../../images/merchant.png" },
    variation: unique ? "Alchemist Top Hat" : "Sorcerer Hat",
    game_data: {
      slug: unique ? "alchemist-hat" : "sorcerer-hat",
      unique,
      slot: "helmet",
      sources: [
        { type: "area", name: "Ravines", catalog_slug: "location-ravines" },
      ],
      acquisition: {
        source_text: "Found in Ravines. Sold by the Town Merchant.",
        sources: [
          {
            type: "merchant",
            name: "Town Merchant",
            icon: { artwork_key: "references.town-merchant.icon" },
            condition: "Found in Ravines. Sold by the Town Merchant.",
          },
          { type: "dungeon", name: "Dungeon with unknown odds" },
        ],
      },
      drop_chances: {
        schema_version: 1,
        item_catalog_slug: slug,
        variant: unique ? "unique" : "base_non_unique",
        sources: [
          {
            type: "area",
            name: "Ravines",
            catalog_slug: "location-ravines",
            base_item: { name: "Sorcerer Hat" },
            pool_share: { probability: 0.01 },
            source_url:
              "https://metabot.gg/en/minecraft-dungeons-2/uniques/drop-calculator",
            outcomes: [
              ["regular_enemy", 0.05],
              ["fancy_chest", 0.1],
            ].map(([drop_source, chance]) => ({
              drop_source,
              rarity: unique ? "unique" : "any_non_unique",
              probability:
                0.01 * (unique ? Number(chance) : 1 - Number(chance)),
              rarity_given_base: unique ? Number(chance) : 1 - Number(chance),
              denominator:
                "One gear/item drop from this source, not one kill or one chest opening.",
              conditions: {
                difficulty: ["normal", "hard"],
                threat_level: null,
              },
            })),
          },
        ],
      },
    },
  };
});
for (const unique of [false, true]) {
  test(`location odds show only known ${unique ? "unique conversion" : "base"} rates`, async ({
    page,
  }) => {
    if (unique) await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/latest.json", (route) =>
      route.fulfill({
        json: {
          catalogVersion: "rates",
          manifest: "releases/rates/manifest.json",
        },
      }),
    );
    await page.route("**/catalog.json", (route) =>
      route.fulfill({ json: items }),
    );
    await page.route("**/images/merchant.png", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await page.goto("/collection?category=armor");
    const name = unique ? "Alchemist Top Hat" : "Sorcerer Hat";
    await page
      .getByRole("article", { name, exact: true })
      .locator("a.item-content")
      .click();
    const location = page
      .locator(".detail-source")
      .filter({ hasText: "Ravines" });
    await expect(location).toContainText(
      unique ? "As Sorcerer Hat (≈1%)" : "≈0.93% average",
    );
    if (unique) {
      await expect(
        page.getByText("Unique chance when the base item drops:", {
          exact: false,
        }),
      ).toContainText("regular enemies: 5%; fancy chests: 10%");
      await expect(location).not.toContainText("unique ≈");
      await expect(location).not.toContainText("Unique rarity variant");
    }
    await expect(
      page.locator(".detail-source").filter({ hasText: "Town Merchant" }),
    ).toHaveText("Town Merchant");
    await expect(
      page
        .locator(".detail-source")
        .filter({ hasText: "Dungeon with unknown odds" }),
    ).not.toContainText("%");
    await expect(
      page.getByText("Per item drop, not per kill or chest.", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Source: Metabot" }),
    ).toHaveCount(0);
    const merchantIcon = page.getByRole("img", {
      name: "Town Merchant",
      exact: true,
    });
    await expect(merchantIcon).toBeVisible();
    await expect(merchantIcon).toHaveAttribute(
      "src",
      "https://cdn.mddex.net/images/merchant.png",
    );
    await expect
      .poll(() =>
        merchantIcon.evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("artifact pool shares appear in catalog and planner and select the better location", async ({
  page,
}) => {
  const artifact = {
    slug: "artifact-banner",
    category: "artifact",
    type: "artifact",
    variation: "Battle Banner",
    image: null,
    game_data: {
      slug: "battle-banner",
      sources: [
        {
          type: "area",
          name: "Singer's Meadow",
          catalog_slug: "location-singers-meadow",
        },
        {
          type: "area",
          name: "Humbler Huskland",
          catalog_slug: "location-humbler-huskland",
        },
      ],
      acquisition: { sources: [{ type: "dungeon", name: "Unknown Dungeon" }] },
      drop_chances: {
        schema_version: 1,
        item_catalog_slug: "artifact-banner",
        variant: "artifact",
        sources: [
          { catalog_slug: "location-singers-meadow", probability: 0.042 },
          { catalog_slug: "location-humbler-huskland", probability: 0.026 },
        ].map(({ catalog_slug, probability }) => ({
          type: "area",
          catalog_slug,
          pool_share: { probability },
          outcomes: [
            "regular_enemy",
            "wooden_chest",
            "fancy_chest",
            "miniboss",
          ].map((drop_source) => ({
            drop_source,
            rarity: "any",
            probability,
            denominator:
              "One item selected from this area pool, conditional on this source using the area pool; not one kill or chest opening.",
            conditions: { difficulty: null, threat_level: null },
          })),
        })),
      },
    },
  };
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "artifact-rates",
        manifest: "releases/artifact-rates/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({
      json: [
        artifact,
        {
          slug: "boss-test-talisman",
          category: "talisman",
          type: "talisman",
          variation: "Meadow Amulet",
          image: null,
          game_data: {
            sources: [
              {
                type: "area",
                name: "Singer's Meadow",
                catalog_slug: "location-singers-meadow",
              },
              {
                type: "area",
                name: "Humbler Huskland",
                catalog_slug: "location-humbler-huskland",
              },
            ],
          },
        },
        {
          slug: "mob-sculk-monstrosity",
          category: "mob",
          type: "boss",
          variation: "Sculk Monstrosity",
          image: null,
          game_data: { slug: "sculk-monstrosity" },
        },
      ],
    }),
  );
  await page.goto("/collection?category=artifact");
  await page
    .getByRole("article", { name: "Battle Banner", exact: true })
    .locator("a.item-content")
    .click();
  await expect(
    page.locator(".detail-source").filter({ hasText: "Singer's Meadow" }),
  ).toContainText("≈4.2% pool share");
  await expect(
    page.locator(".detail-source").filter({ hasText: "Humbler Huskland" }),
  ).toContainText("≈2.6% pool share");
  await expect(
    page.locator(".detail-source").filter({ hasText: "Unknown Dungeon" }),
  ).not.toContainText("%");
  const build = emptyBuild("Artifact rates");
  build.slots.artifact1 = {
    itemSlug: "artifact-banner",
    enchantments: [],
    effects: [],
  };
  build.slots.talisman1 = {
    itemSlug: "boss-test-talisman",
    enchantments: [],
    effects: [],
  };
  await page.getByRole("link", { name: "Resources", exact: true }).click();
  await page.getByRole("link", { name: /Farming planner/ }).click();
  await expect(page.getByRole("button", { name: "Saved build" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Or paste a build link" })
    .fill(`https://mddex.net/build#build=${await encodeBuildLink(build)}`);
  await page.getByRole("button", { name: "Use build", exact: true }).click();
  await expect(page.locator(".planner-stop")).toHaveCount(1);
  await expect(page.locator(".planner-stop")).toContainText("Singer's Meadow");
  await expect(page.locator(".planner-stop .planner-chance")).toHaveText(
    "≈4.2% pool share",
  );
  await expect(page.locator(".planner-boss")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const farmBosses = page.getByRole("checkbox", {
    name: "Farm bosses",
    exact: true,
  });
  await farmBosses.check();
  const stops = page.locator(".planner-stop");
  await expect(stops).toHaveCount(2);
  await expect(stops.nth(0)).toHaveAttribute("data-boss-farm", "true");
  await expect(stops.nth(0)).toContainText("Farm boss: Sculk Monstrosity");
  await expect(stops.nth(0)).toContainText("Battle Banner");
  await expect(stops.nth(0)).not.toContainText("Meadow Amulet");
  await expect(stops.nth(0).locator(".planner-chance")).toHaveCount(0);
  await expect(stops.nth(1)).toContainText("Meadow Amulet");
  await expect(stops.nth(1).locator(".planner-boss")).toHaveCount(0);
  await expect(
    stops.nth(0).getByRole("link", { name: "Sculk Monstrosity" }),
  ).toHaveAttribute("href", /catalog/);
  await expect(
    page.getByRole("heading", { name: /Primary plan/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/mddex-planner-bosses-mobile.png",
    fullPage: true,
  });
  await farmBosses.uncheck();
  await expect(page.locator(".planner-boss")).toHaveCount(0);
  await expect(stops).toHaveCount(1);
  await expect(stops.first()).toContainText("Battle Banner");
  await expect(stops.first()).toContainText("Meadow Amulet");
});

test("planner unique estimate doubles from a 5% roll to 10% on recommended bosses", async ({
  page,
}) => {
  const unique = structuredClone(items[1]);
  unique.game_data.sources[0] = {
    type: "area",
    name: "Howling Woods",
    catalog_slug: "location-howling-woods",
  };
  unique.game_data.drop_chances.sources[0].name = "Howling Woods";
  unique.game_data.drop_chances.sources[0].catalog_slug =
    "location-howling-woods";
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "unique-estimates",
        manifest: "releases/unique-estimates/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: [unique] }),
  );
  const build = emptyBuild("Unique hunting");
  build.slots.head = { itemSlug: unique.slug, enchantments: [], effects: [] };
  await page.goto("/resources/planner");
  await expect(page.getByRole("button", { name: "Saved build" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Or paste a build link" })
    .fill(`https://mddex.net/build#build=${await encodeBuildLink(build)}`);
  await page.getByRole("button", { name: "Use build", exact: true }).click();
  await expect(page.locator(".planner-stop .planner-chance")).toHaveText(
    "≈0.05% unique",
  );
  await page
    .getByRole("checkbox", { name: "Farm bosses", exact: true })
    .check();
  await expect(page.locator(".planner-stop")).toContainText(
    "Farm boss: Soul Corrupted Witch",
  );
  await expect(page.locator(".planner-stop .planner-chance")).toHaveText(
    "≈0.1% unique",
  );
  await page
    .getByRole("checkbox", { name: "Farm bosses", exact: true })
    .uncheck();
  await expect(page.locator(".planner-stop .planner-chance")).toHaveText(
    "≈0.05% unique",
  );
});
