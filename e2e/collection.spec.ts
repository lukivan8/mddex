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
async function showCatalog(page: Page) {
  await page
    .locator("header")
    .getByRole("button", { name: "Show all items", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Show all items", exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await mockCatalog(page);
});
test("instant ownership, URL search, reload, cross-tab sync and filtered removal", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await showCatalog(page);
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.getByRole("checkbox")).toHaveCount(4);
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.getByRole("searchbox").fill("HAMmer");
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  await expect(page).toHaveURL(/q=HAMmer/);
  await page
    .locator(".item-name")
    .filter({ hasText: /^Battle Hammer$/ })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Overall collection", exact: true }),
  ).toHaveAttribute("aria-valuenow", "1");
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Battle Hammer", exact: true }),
  ).toBeChecked();
  const other = await context.newPage();
  await mockCatalog(other);
  await other.goto("/collection");
  await expect(
    other.getByRole("checkbox", { name: "Battle Hammer", exact: true }),
  ).toBeChecked();
  await other
    .locator(".item-name")
    .filter({ hasText: /^Battle Hammer$/ })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Battle Hammer", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("radio", { name: "Missing", exact: true }).click();
  await page
    .locator(".item-name")
    .filter({ hasText: /^Battle Hammer$/ })
    .click();
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: "War Hammer", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("category and type filters combine; mobile has no overflow and images fail gracefully", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/collection");
  await showCatalog(page);
  await expect(page.getByRole("checkbox")).toHaveCount(4);
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
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await expect(page).toHaveURL(/category=armor/);
  await expect(page).toHaveURL(/type=head/);
  const item = page.getByRole("checkbox", {
    name: "Beekeeper Helmet",
    exact: true,
  });
  await item.focus();
  await page.keyboard.press("Space");
  await expect(item).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("catalog failure and retry preserve previously saved ownership", async ({
  page,
}) => {
  await page.goto("/collection");
  await showCatalog(page);
  await page
    .locator(".item-name")
    .filter({ hasText: /^Battle Hammer$/ })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("mddex.collection.v2"),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Collection unavailable" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("mddex.collection.v2")),
  ).toBe(before);
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Battle Hammer", exact: true }),
  ).toBeChecked();
});

test("new collection masks names and artwork, explains discovery, and rejects partial searches", async ({
  page,
}) => {
  const images: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/images/")) images.push(request.url());
  });
  await page.goto("/collection");
  await expect(page.locator(".item-name")).toHaveText([
    "?????",
    "?????",
    "?????",
    "?????",
  ]);
  const html = await page
    .locator(".item-grid")
    .evaluate((node) => node.outerHTML);
  for (const item of catalog) {
    expect(html).not.toContain(item.variation);
    expect(html).not.toContain(item.slug);
  }
  expect(html).not.toContain("images/broken");
  await expect.poll(() => images.length).toBe(1);
  await expect(
    page.getByRole("button", { name: "Show all items", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.locator(".item-content").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Discover items as you find them",
  );
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Overall collection", exact: true }),
  ).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("searchbox").fill("battle ham");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Battle Hammer");
  await page.getByRole("searchbox").fill("hammers");
  await expect(page.locator(".item-name")).toHaveText(["?????", "?????"]);
  expect(images).toHaveLength(1);
});

test("exact discovery is global, persists, and never recollects a known item", async ({
  page,
}) => {
  await page.goto("/collection?category=armor&type=head");
  await expect(page.locator(".item-name")).toHaveText(["?????"]);
  await page.getByRole("searchbox").fill("BATTLE   HAMMER");
  await expect(
    page.getByText("Battle Hammer discovered and collected.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Overall collection", exact: true }),
  ).toHaveAttribute("aria-valuenow", "1");
  await expect(page).toHaveURL(/category=armor/);
  await expect(page.getByRole("searchbox")).toHaveValue("BATTLE   HAMMER");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.goto("/collection?q=hammer");
  const hammer = page.getByRole("checkbox", {
    name: "Battle Hammer",
    exact: true,
  });
  await expect(hammer).toBeChecked();
  await hammer.focus();
  await page.keyboard.press("Space");
  await expect(hammer).not.toBeChecked();
  await page.getByRole("searchbox").fill("Battle Hammer");
  await expect(hammer).not.toBeChecked();
  await page.reload();
  await expect(hammer).not.toBeChecked();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("radio", { name: "Missing", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(4);
  await expect(page.locator(".item-name")).toHaveText([
    "Battle Hammer",
    "?????",
    "?????",
    "?????",
  ]);
  await page.getByRole("radio", { name: "Collected", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("show-all requires confirmation, persists, and never discovers by itself", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/collection");
  const control = page.locator("header").getByRole("button", {
    name: "Show all items",
    exact: true,
  });
  await control.click();
  await expect(page.getByRole("dialog")).toContainText("Show every item?");
  await page.getByRole("button", { name: "Keep spoiler-free" }).click();
  await expect(page.locator(".item-name")).toHaveText([
    "?????",
    "?????",
    "?????",
    "?????",
  ]);
  await showCatalog(page);
  await expect(
    page.getByRole("checkbox", { name: "Battle Hammer", exact: true }),
  ).not.toBeChecked();
  expect(
    await page.evaluate(() => localStorage.getItem("mddex.collection.v2")),
  ).toBeNull();
  await page.reload();
  await expect(control).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("checkbox", { name: "Battle Hammer", exact: true }),
  ).toBeVisible();
  await control.click();
  await expect(page.locator(".item-name")).toHaveText([
    "?????",
    "?????",
    "?????",
    "?????",
  ]);
  await page.reload();
  await expect(control).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("legacy collected items migrate visibly and remain discovered after unchecking", async ({
  page,
}) => {
  const legacy = JSON.stringify({
    "s:melee_weapon-battle-hammer": {
      versionKey: "legacy-1",
      data: { itemSlug: "melee_weapon-battle-hammer", owned: true },
    },
    "s:removed": {
      versionKey: "legacy-2",
      data: { itemSlug: "removed", owned: true },
    },
  });
  await page.addInitScript((value) => {
    if (!localStorage.getItem("mddb.collection.v1"))
      localStorage.setItem("mddb.collection.v1", value);
  }, legacy);
  await page.goto("/collection");
  const hammer = page.getByRole("checkbox", {
    name: "Battle Hammer",
    exact: true,
  });
  await expect(hammer).toBeChecked();
  await expect(
    page.getByRole("progressbar", { name: "Overall collection", exact: true }),
  ).toHaveAttribute("aria-valuenow", "1");
  await page
    .locator(".item-name")
    .filter({ hasText: /^Battle Hammer$/ })
    .click();
  await page.reload();
  await expect(hammer).not.toBeChecked();
  expect(
    await page.evaluate(() => localStorage.getItem("mddb.collection.v1")),
  ).toBe(legacy);
  expect(
    await page.evaluate(() => localStorage.getItem("mddex.collection.v2")),
  ).toContain("removed");
});
