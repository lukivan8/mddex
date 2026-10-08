import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
const base = {
  slug: "sword",
  variation: "Sword",
  category: "melee_weapon",
  type: "swords",
  image: null,
  game_data: {
    slug: "sword",
    rarities: ["common", "rare", "special", "unique"],
    uniqueVariant: { catalog_slug: "burning-blade" },
  },
};
const catalog = [
  base,
  {
    ...base,
    slug: "burning-blade",
    variation: "Burning Blade",
    game_data: {
      slug: "burning-blade",
      unique: true,
      rarities: ["unique"],
      base: { catalog_slug: "sword" },
    },
  },
  {
    ...base,
    slug: "axe",
    variation: "Axe",
    game_data: { slug: "axe", rarities: ["common", "rare", "special"] },
  },
  {
    ...base,
    slug: "banner",
    variation: "Battle Banner",
    category: "artifact",
    game_data: { slug: "banner", rarities: ["common", "rare", "special"] },
  },
  {
    ...base,
    slug: "charm",
    variation: "Looter's Charm",
    category: "talisman",
    game_data: { slug: "charm" },
  },
  {
    ...base,
    slug: "sharpness",
    variation: "Sharpness",
    category: "enchantment",
    game_data: { slug: "sharpness" },
  },
];
for (const mobile of [false, true]) {
  test(`collection tracker saves, filters and resets on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    page.on("pageerror", (error) => {
      if (/hydrat/i.test(error.message)) hydrationErrors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error" && /hydrat/i.test(message.text()))
        hydrationErrors.push(message.text());
    });
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/latest.json", (route) =>
      route.fulfill({
        json: {
          catalogVersion: "tracker-test",
          manifest: "releases/tracker-test/manifest.json",
        },
      }),
    );
    await page.route("**/catalog.json", (route) =>
      route.fulfill({ json: catalog }),
    );
    await page.goto("/resources");
    await page.getByRole("link", { name: /Item collection tracker/ }).click();
    await expect(
      page.getByRole("heading", { name: "Item tracker." }),
    ).toBeVisible();
    await expect(page.locator(".tracker-catalog-grid .item-card")).toHaveCount(
      3,
    );
    await page.getByRole("link", { name: "Table", exact: true }).click();
    await expect(page.locator(".tracker-table tbody tr")).toHaveCount(2);
    const common = page.getByRole("checkbox", {
      name: "Sword Common",
      exact: true,
    });
    const soul = page.getByRole("checkbox", {
      name: "Sword Soul Special",
      exact: true,
    });
    await expect(
      page.getByRole("checkbox", { name: "Sword Soul Common", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: "Sword Soul Rare", exact: true }),
    ).toHaveCount(0);
    await common.locator("..").click({ position: { x: 3, y: 3 } });
    await expect(common).toBeChecked();
    await expect(soul).not.toBeChecked();
    await common.uncheck();
    await soul.locator("..").click({ position: { x: 3, y: 3 } });
    for (const rarity of ["Common", "Rare", "Special"])
      await expect(
        page.getByRole("checkbox", { name: `Sword ${rarity}`, exact: true }),
      ).toBeChecked();
    await expect(soul).toBeChecked();
    await common.locator("..").click({ position: { x: 3, y: 3 } });
    await expect(soul).toBeChecked();
    await expect(common).not.toBeChecked();
    await soul.uncheck();
    if (!mobile) {
      await soul.locator("..").hover();
      await expect(
        page.locator(".tracker-table tbody .tracker-preview"),
      ).toHaveCount(1);
    }
    await common.check();
    await soul.check();
    await page
      .getByRole("checkbox", { name: "Burning Blade Unique", exact: true })
      .check();
    await expect(
      page.getByRole("progressbar", { name: "Overall collection progress" }),
    ).toHaveAttribute("value", "5");
    await page.reload();
    await expect(soul).toBeChecked();
    await expect(common).toBeChecked();
    await page
      .getByRole("checkbox", { name: "Sword Rare", exact: true })
      .uncheck();
    await expect(soul).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Sword Special", exact: true }),
    ).toBeChecked();
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Sword Rare", exact: true }),
    ).not.toBeChecked();
    await expect(soul).toBeChecked();
    await page
      .getByRole("checkbox", { name: "Sword Rare", exact: true })
      .check();
    await expect(common).toBeChecked();
    await soul.check();
    await page
      .getByRole("checkbox", { name: "Burning Blade Soul Unique", exact: true })
      .check();
    await expect(
      page.getByRole("checkbox", { name: "Burning Blade Unique", exact: true }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Collection status" }).click();
    await page
      .getByRole("option", { name: "Missing items", exact: true })
      .click();
    await expect(page.locator(".tracker-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".tracker-table tbody tr")).toContainText("Axe");
    await page.getByRole("button", { name: "Collection status" }).click();
    await page
      .getByRole("option", { name: "Completed items", exact: true })
      .click();
    await expect(page.locator(".tracker-table tbody tr")).toContainText(
      "Sword",
    );
    await page.getByRole("button", { name: "Collection status" }).click();
    await page.getByRole("option", { name: "All items", exact: true }).click();
    await page
      .getByRole("searchbox", { name: "Search tracked items" })
      .fill("burning");
    await expect(page.locator(".tracker-table tbody tr")).toHaveCount(1);
    await page
      .getByRole("searchbox", { name: "Search tracked items" })
      .fill("");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const shareDialog = page.getByRole("dialog", { name: "Share collection" });
    await expect(
      shareDialog.getByRole("img", { name: "Collection progress share image" }),
    ).toBeVisible();
    await shareDialog
      .getByRole("button", { name: "Copy image", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Copied!", exact: true }),
    ).toBeVisible();
    const png = await page.evaluate(async () => {
      const clipboard = await navigator.clipboard.read();
      const blob = await clipboard[0].getType("image/png");
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    expect(Buffer.from(png).readUInt32BE(16)).toBe(1200);
    expect(Buffer.from(png).readUInt32BE(20)).toBe(900);
    await writeFile(
      test.info().outputPath("progress-share.png"),
      Buffer.from(png),
    );
    await shareDialog
      .getByRole("button", { name: "Copy link", exact: true })
      .click();
    await expect(
      shareDialog.getByRole("button", { name: "Link copied!", exact: true }),
    ).toBeVisible();
    const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
    const localProgress = await page.evaluate(() =>
      localStorage.getItem("mddex-item-tracker-v1"),
    );
    await page.goto(shareUrl);
    await expect(
      page.getByText("Shared collection", { exact: true }),
    ).toBeVisible();
    expect(hydrationErrors).toEqual([]);
    await expect(
      page.getByRole("checkbox", { name: "Sword Soul Special", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Sword Soul Special", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(() => localStorage.getItem("mddex-item-tracker-v1")),
    ).toBe(localProgress);
    await page.getByRole("link", { name: "Sword", exact: true }).click();
    await page
      .getByRole("link", { name: "Back to tracker", exact: true })
      .click();
    await expect(
      page.getByText("Shared collection", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Open my tracker", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Sword Soul Special", exact: true }),
    ).toBeEnabled();
    await page.getByRole("link", { name: "Table", exact: true }).click();
    await page.screenshot({
      path: test.info().outputPath("tracker.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    if (mobile)
      expect(
        await page
          .locator(".tracker-table-scroll")
          .evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true);
    if (mobile) {
      const firstColumn = page.locator(".tracker-table tbody th").first();
      const before = await firstColumn.boundingBox();
      await page.locator(".tracker-table-scroll").evaluate((el) => {
        el.scrollLeft = 100;
      });
      const after = await firstColumn.boundingBox();
      expect(before!.x - after!.x).toBeCloseTo(100, 0);
      await page.locator(".tracker-table-scroll").evaluate((el) => {
        el.scrollLeft = 0;
      });
    }
    await page.getByRole("link", { name: "Sword", exact: true }).click();
    await page
      .getByRole("link", { name: "Back to tracker", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Sword Common", exact: true }),
    ).toBeChecked();
    await page.getByRole("radio", { name: /Artifacts/ }).click();
    await page
      .getByRole("checkbox", { name: "Battle Banner Rare", exact: true })
      .check();
    await expect(
      page.getByRole("checkbox", { name: /Battle Banner Soul/ }),
    ).toHaveCount(0);
    await page.getByRole("radio", { name: /Talismans/ }).click();
    await page
      .getByRole("checkbox", { name: "Looter's Charm Collected", exact: true })
      .check();
    await page.getByRole("radio", { name: /Enchantments/ }).click();
    await page
      .getByRole("checkbox", { name: "Sharpness Collected", exact: true })
      .check();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Share", exact: true }),
    ).toBeEnabled();
    await page.getByRole("radio", { name: /Enchantments/ }).click();
    await expect(
      page.getByRole("checkbox", { name: "Sharpness Collected", exact: true }),
    ).toBeChecked();
    await page.getByRole("radio", { name: /Talismans/ }).click();
    await page
      .getByRole("button", { name: "Reset progress", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("checkbox", {
        name: "Looter's Charm Collected",
        exact: true,
      }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Reset progress", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Reset all progress", exact: true })
      .click();
    await expect(
      page.getByRole("progressbar", { name: "Overall collection progress" }),
    ).toHaveAttribute("value", "0");
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Sword Common", exact: true }),
    ).not.toBeChecked();
  });
}

for (const width of [1280, 390]) {
  test(`catalog tracker cards keep paired items and rarity checks at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/latest.json", (route) =>
      route.fulfill({
        json: {
          catalogVersion: "tracker-cards-test",
          manifest: "releases/tracker-cards-test/manifest.json",
        },
      }),
    );
    await page.route("**/catalog.json", (route) =>
      route.fulfill({
        json: [
          ...catalog,
          {
            ...catalog[3],
            slug: "extra-artifact",
            variation: "Extra Artifact",
          },
          {
            ...catalog[4],
            slug: "secret-charm",
            variation: "Secret Charm",
            game_data: {
              slug: "secret-charm",
              talismanAcquisition: { secret: true },
            },
          },
        ],
      }),
    );
    await page.goto("/resources/item-tracker-cards");
    const cards = page.locator(".tracker-catalog-grid .item-card");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toHaveAttribute("aria-label", "Axe");
    await expect(cards.nth(1)).toHaveAttribute("aria-label", "Sword");
    await expect(cards.nth(2)).toHaveAttribute("aria-label", "Burning Blade");
    await expect(cards.nth(1).getByRole("checkbox")).toHaveCount(4);
    await expect(cards.nth(2).getByRole("checkbox")).toHaveCount(2);
    await expect(page.locator(".item-unique-effect")).toHaveCount(0);
    await page
      .getByRole("checkbox", { name: "Sword Soul Special", exact: true })
      .locator("..")
      .click();
    for (const rarity of ["Common", "Rare", "Special", "Soul Special"])
      await expect(
        page.getByRole("checkbox", { name: `Sword ${rarity}`, exact: true }),
      ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Burning Blade Unique", exact: true }),
    ).not.toBeChecked();
    const baseBox = await cards.nth(1).boundingBox();
    const uniqueBox = await cards.nth(2).boundingBox();
    expect(uniqueBox!.y >= baseBox!.y).toBe(true);
    if (uniqueBox!.y === baseBox!.y)
      expect(uniqueBox!.x).toBeGreaterThan(baseBox!.x);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("checkbox", { name: "Sword Common", exact: true })
      .uncheck();
    await page
      .getByRole("checkbox", { name: "Sword Rare", exact: true })
      .uncheck();
    await page.screenshot({
      path: `/tmp/mddb-catalog-tracker-${width}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Sword Soul Special", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Sword Common", exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Sword Rare", exact: true }),
    ).not.toBeChecked();
    await page
      .getByRole("checkbox", { name: "Sword Rare", exact: true })
      .check();
    await expect(
      page.getByRole("checkbox", { name: "Sword Common", exact: true }),
    ).not.toBeChecked();
    await page
      .getByRole("checkbox", { name: "Sword Rare", exact: true })
      .uncheck();
    const cycle = page.getByRole("button", {
      name: "Cycle Sword collection rarity",
      exact: true,
    });
    await cycle.click({ position: { x: 60, y: 60 } });
    for (const rarity of ["Common", "Rare", "Special", "Soul Special"])
      await expect(
        page.getByRole("checkbox", { name: `Sword ${rarity}`, exact: true }),
      ).not.toBeChecked();
    for (const rarity of ["Common", "Rare", "Special", "Soul Special"]) {
      await cycle.click({ position: { x: 60, y: 60 } });
      await expect(
        page.getByRole("checkbox", { name: `Sword ${rarity}`, exact: true }),
      ).toBeChecked();
    }
    await expect(page).toHaveURL(/item-tracker-cards/);
    await expect(
      cards.nth(1).getByRole("link", { name: "Sword", exact: true }),
    ).toHaveAttribute("href", /catalog/);
    await page.getByRole("radio", { name: /Artifacts/ }).click();
    await expect(cards).toHaveCount(2);
    const firstArtifact = await cards.nth(0).boundingBox();
    const secondArtifact = await cards.nth(1).boundingBox();
    expect(
      secondArtifact!.x - firstArtifact!.x - firstArtifact!.width,
    ).toBeLessThanOrEqual(12);
    await page.getByRole("radio", { name: /Talismans/ }).click();
    await expect(cards).toHaveCount(2);
    await page.getByRole("checkbox", { name: "Secret talismans only" }).check();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAttribute("aria-label", "Secret Charm");
    await page
      .getByRole("checkbox", { name: "Secret talismans only" })
      .uncheck();
    await expect(cards).toHaveCount(2);
    await page.getByRole("radio", { name: /Enchantments/ }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.getByRole("checkbox")).toHaveCount(1);
    await page
      .getByRole("button", {
        name: "Cycle Sharpness collection rarity",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Sharpness Collected", exact: true }),
    ).toBeChecked();
  });
}
