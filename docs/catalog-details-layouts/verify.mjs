import { chromium, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(new URL("./previews/", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const results = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1050 },
    });
    page.on("pageerror", (error) => errors.push(error.message));
    for (const id of ["dossier", "dialog", "inspector", "sheet", "combat"]) {
      const paths = {
        dossier: "",
        dialog: "/tabbed",
        inspector: "/inspector",
        sheet: "/accordion",
        combat: "/combat",
      };
      await page.goto(
        `http://127.0.0.1:3101/catalog/melee-weapons/the-prospectors-pick${paths[id]}`,
      );
      await expect(
        page.getByRole("heading", {
          name: "The Prospector's Pick",
          exact: true,
          level: 1,
        }),
      ).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator(".preview-stage")).toHaveCount(0);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://mddex.net/catalog/melee-weapons/the-prospectors-pick",
      );
      await expect(page).toHaveTitle(/Prospector.*Minecraft Dungeons 2/);
      await expect(page.locator(".unique-box").first()).toContainText("20%");
      if (id === "dialog" || id === "inspector") {
        await page.getByRole("tab", { name: "Drops", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "The Deep Dark", exact: true }),
        ).toBeVisible();
        await page.getByRole("tab", { name: "Combat", exact: true }).click();
        await expect(
          page.getByRole("table", { name: "Attack values", exact: true }),
        ).toBeVisible();
        await page.getByRole("tab", { name: "Overview", exact: true }).click();
      }
      if (id === "sheet") {
        await page.getByRole("button", { name: /Moveset/ }).click();
        await expect(
          page.getByRole("table", { name: "Attack values", exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: /Moveset/ }).click();
      }
      if (id === "combat") {
        await page.getByRole("tab", { name: /Hit 3/ }).click();
        await expect(page.locator(".damage-value")).toContainText("24");
        await page.getByRole("tab", { name: /Jump/ }).click();
        await expect(page.locator(".damage-value")).toContainText("28");
        await page.getByRole("tab", { name: /Hit 1/ }).click();
      }
      await page.locator("img").evaluateAll((images) =>
        images.forEach((image) => {
          image.loading = "eager";
        }),
      );
      const loaded = await page
        .locator("img")
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        );
      if (!loaded) {
        await page.waitForFunction(
          () =>
            Array.from(document.images).every(
              (image) => image.complete && image.naturalWidth > 0,
            ),
          { timeout: 15000 },
        );
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (overflow)
        throw new Error(
          `${id}: horizontal overflow on ${mobile ? "mobile" : "desktop"}`,
        );
      await page.screenshot({
        path: `${output}${id}-${mobile ? "mobile" : "desktop"}.png`,
        fullPage: true,
        animations: "disabled",
      });
      results.push(`${id} ${mobile ? "mobile" : "desktop"}`);
    }
    await page.close();
  }
  const staticPage = await browser.newPage({ javaScriptEnabled: false });
  for (const suffix of ["", "/tabbed", "/inspector", "/accordion", "/combat"]) {
    await staticPage.goto(
      `http://127.0.0.1:3101/catalog/melee-weapons/the-prospectors-pick${suffix}`,
    );
    await expect(staticPage.locator("h1")).toHaveText("The Prospector's Pick");
    await expect(staticPage.locator(".item-guide")).toContainText(
      "The Deep Dark",
    );
    await expect(staticPage.locator(".item-guide")).toContainText(
      "16 → 16 → 24",
    );
    const graph = JSON.parse(
      await staticPage
        .locator('script[type="application/ld+json"]')
        .textContent(),
    );
    if (graph["@graph"].length !== 2)
      throw new Error("Missing structured data");
  }
  const records = JSON.parse(
    await readFile(new URL("./item-links.json", import.meta.url), "utf8"),
  );
  const categoryPaths = {
    melee_weapon: "melee-weapons",
    ranged_weapon: "ranged-weapons",
    artifact: "artifacts",
    talisman: "talismans",
    enchantment: "enchantments",
    gear_effect: "gear-effects",
    mob: "mobs",
    location: "locations",
  };
  for (const category of [
    "melee_weapon",
    "ranged_weapon",
    "armor",
    "artifact",
    "talisman",
    "enchantment",
    "gear_effect",
    "location",
    "mob",
  ]) {
    const item =
      category === "melee_weapon"
        ? records.find((item) => item.name === "Pickaxe")
        : records.find((item) => item.category === category);
    await staticPage.goto(
      `http://127.0.0.1:3101/catalog/${categoryPaths[category] ?? category}/${item.game_data.slug ?? item.slug}`,
    );
    await expect(staticPage.locator("h1")).toHaveText(item.name);
    await expect(staticPage.locator(".item-guide > p")).toContainText(
      item.name,
    );
    await expect(staticPage.locator(".item-guide > p")).toContainText(
      "Minecraft Dungeons 2 (MCD2)",
    );
    await expect(staticPage).toHaveTitle(
      new RegExp(item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    const description = await staticPage
      .locator('meta[name="description"]')
      .getAttribute("content");
    if (description.length > 160 || !description.includes(item.name))
      throw new Error(`Invalid metadata for ${item.name}`);
    const guideText = await staticPage.locator(".item-guide").textContent();
    if (/undefined|NaN|\[object Object\]/.test(guideText))
      throw new Error(`Invalid generated data for ${item.name}`);
  }
  await staticPage.close();
  const navigation = await browser.newPage();
  await navigation.goto("http://127.0.0.1:3101/?option=dialog");
  await expect(navigation).toHaveURL(/the-prospectors-pick\/tabbed$/);
  const filteredCatalog =
    "https://mddex.net/collection?q=pickaxe&category=melee_weapon&type=pickaxes&sort=category";
  await navigation.goto(
    `http://127.0.0.1:3101/catalog/melee-weapons/the-prospectors-pick?returnTo=${encodeURIComponent(filteredCatalog)}`,
  );
  await expect(
    navigation.getByRole("link", { name: "Back to catalog", exact: true }),
  ).toHaveAttribute("href", filteredCatalog);
  await navigation.reload();
  await expect(
    navigation.getByRole("link", { name: "Back to catalog", exact: true }),
  ).toHaveAttribute("href", filteredCatalog);
  await navigation.goto(
    "http://127.0.0.1:3101/catalog/melee-weapons/the-prospectors-pick/accordion",
  );
  await expect(
    navigation.getByRole("link", { name: "Back to catalog", exact: true }),
  ).toHaveAttribute("href", filteredCatalog);
  await navigation.goto(
    "http://127.0.0.1:3101/catalog/melee-weapons/the-prospectors-pick?returnTo=https://example.com/collection",
  );
  await expect(
    navigation.getByRole("link", { name: "Back to catalog", exact: true }),
  ).toHaveAttribute("href", filteredCatalog);
  await expect(navigation.locator("blockquote.flavor")).toBeVisible();
  await expect(
    navigation.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(navigation.locator(".footer-brand")).toContainText(
    "Not affiliated with Mojang or Microsoft",
  );
  await navigation.goto(
    "http://127.0.0.1:3101/catalog/melee-weapons/the-prospectors-pick",
  );
  const titleIsAboveColumns = await navigation
    .locator(".page-title h1")
    .evaluate(
      (title) =>
        title.getBoundingClientRect().bottom <
        document.querySelector(".dossier").getBoundingClientRect().top,
    );
  if (!titleIsAboveColumns)
    throw new Error("Title should span above dossier columns");
  await navigation
    .locator(".item-reference-card")
    .filter({ hasText: "Base weapon" })
    .click();
  await expect(navigation).toHaveURL(/catalog\/melee-weapons\/pickaxe$/);
  await expect(navigation.locator("h1")).toHaveText("Pickaxe");
  await expect(navigation.locator(".item-guide")).toContainText("16 → 16 → 24");
  await expect(
    navigation.getByRole("table", { name: "Attack values", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Back to catalog", exact: true }),
  ).toHaveAttribute("href", filteredCatalog);
  await navigation
    .locator(".item-reference-card")
    .filter({ hasText: "Unique variant" })
    .click();
  await expect(navigation.locator("h1")).toHaveText("The Prospector's Pick");
  await expect(navigation.locator(".source-card")).toHaveCount(4);
  await expect(navigation.locator(".source-card")).not.toContainText([
    "Mob drop",
    "Mob drop",
    "Mob drop",
    "Mob drop",
  ]);
  await navigation.goto("http://127.0.0.1:3101/catalog/artifacts/witch-brew");
  await expect(navigation.locator("h1")).toHaveText("Witch Brew");
  await expect(navigation.locator(".item-guide")).toContainText("Witch");
  await expect(navigation.locator(".source-card")).toHaveCount(3);
  await navigation
    .getByRole("link", { name: "Witch Mob drop", exact: true })
    .click();
  await expect(navigation.locator("h1")).toHaveText("Witch");
  await navigation
    .locator(".item-reference-card")
    .filter({ hasText: "Witch Brew" })
    .click();
  await expect(navigation.locator("h1")).toHaveText("Witch Brew");
  await expect(navigation.locator(".item-guide")).toContainText("Witch");
  const missing = await navigation.goto(
    "http://127.0.0.1:3101/catalog/melee-weapons/missing",
  );
  if (missing.status() !== 404)
    throw new Error("Missing item should return 404");
  await navigation.close();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ verified: results, pageErrors: errors }));
} finally {
  await browser.close();
}
