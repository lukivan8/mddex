import { test, expect } from "@playwright/test";
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
