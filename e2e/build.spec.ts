import { test, expect } from "@playwright/test";
const catalog = [
  {
    slug: "hammer",
    variation: "Battle Hammer",
    category: "melee_weapon",
    type: "hammers",
    image: null,
  },
  {
    slug: "sword",
    variation: "Test Sword",
    category: "melee_weapon",
    type: "swords",
    image: null,
  },
  {
    slug: "bow",
    variation: "Test Bow",
    category: "ranged_weapon",
    type: "bows",
    image: null,
  },
  {
    slug: "head",
    variation: "Test Helmet",
    category: "armor",
    type: "head",
    image: null,
  },
  {
    slug: "fire",
    variation: "Fire Aspect",
    category: "enchantment",
    type: "enchantment",
    image: null,
  },
];
async function enableAll(page: import("@playwright/test").Page) {
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
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: { catalogVersion: "test", manifest: "releases/test/manifest.json" },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
});
test("loadout assembly, inline enchantments, scope isolation, switching and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/build");
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  await expect(page.getByRole("button", { name: /^Choose / })).toHaveCount(12);
  await expect(
    page.getByRole("button", { name: "Equip Battle Hammer" }),
  ).toHaveCount(0);
  await enableAll(page);
  await page.getByRole("radio", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Equip Battle Hammer" }).click();
  await expect(page.getByText("1 / 12 equipped")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 2: Empty enchantment",
    })
    .click();
  await page.getByRole("button", { name: "Equip Fire Aspect" }).click();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon enchantment 2: Fire Aspect",
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Loadout name" })
    .fill("Hammer build");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Hammer build",
  );
  await expect(
    page.getByRole("button", {
      name: "Melee weapon enchantment 2: Fire Aspect",
    }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Discovered", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Equip Battle Hammer" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Melee weapon enchantment 2: Fire Aspect",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("mddex.collection.v2")),
  ).toBeNull();
  await page.getByRole("button", { name: "New loadout", exact: true }).click();
  await expect(page.getByText("0 / 12 equipped")).toBeVisible();
  await page
    .getByRole("button", { name: "Saved loadouts", exact: true })
    .click();
  await page.getByRole("button", { name: /^Hammer build/ }).click();
  await expect(page.getByText("1 / 12 equipped")).toBeVisible();
  await page
    .getByRole("button", { name: "Melee weapon enchantment 2: Fire Aspect" })
    .click();
  await page.getByRole("button", { name: "Clear selected slot" }).click();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon enchantment 2: Empty enchantment",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear Melee weapon", exact: true })
    .click();
  await expect(page.getByText("0 / 12 equipped")).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile uses the same compatible picker inside a sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/build");
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  await enableAll(page);
  await page
    .getByRole("button", { name: "Choose Head armor", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "All", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Equip Battle Hammer" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Equip Test Helmet" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Head armor enchantment 1: Empty enchantment",
    })
    .click();
  await dialog.getByRole("button", { name: "Equip Fire Aspect" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Head armor enchantment 1: Fire Aspect" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("collection discovery is reused while collection show-all does not reveal the builder", async ({
  page,
}) => {
  await page.goto("/collection");
  await page
    .getByRole("searchbox", { name: "Search collection" })
    .fill("Battle Hammer");
  await expect(
    page.getByRole("checkbox", { name: "Battle Hammer", exact: true }),
  ).toBeChecked();
  await page
    .locator("header")
    .getByRole("button", { name: "Show all items", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Show all items", exact: true })
    .click();
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  await expect(
    page.getByRole("radio", { name: "Discovered", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Equip Battle Hammer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Equip Test Sword" }),
  ).toHaveCount(0);
  await page.getByRole("radio", { name: "Owned", exact: true }).click();
  await page.getByRole("button", { name: "Equip Battle Hammer" }).click();
  await page.getByRole("link", { name: "Collection", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Battle Hammer", exact: true })
    .press("Space");
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page.getByText("1 / 12 equipped")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Equip Battle Hammer" }),
  ).toHaveCount(0);
  await page.getByRole("radio", { name: "Discovered", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Equip Battle Hammer" }),
  ).toBeVisible();
});
test("removed catalog references remain saved and clearable", async ({
  page,
}) => {
  await page.goto("/build");
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  await enableAll(page);
  await page.getByRole("radio", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Equip Battle Hammer" }).click();
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog.filter((i) => i.slug !== "hammer") }),
  );
  await page.reload();
  await expect(
    page.getByText("Unavailable item", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 / 12 equipped")).toBeVisible();
  await page
    .getByRole("button", { name: "Clear Melee weapon", exact: true })
    .click();
  await expect(page.getByText("0 / 12 equipped")).toBeVisible();
});
test("shared spoiler switch gates All and empty gear keeps enchantment positions", async ({
  page,
}) => {
  await page.goto("/build");
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  await expect(
    page.getByRole("button", { name: /enchantment [123]: Empty enchantment/ }),
  ).toHaveCount(18);
  await expect(
    page.getByRole("radio", { name: "All", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Head armor enchantment 1: Empty enchantment",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose Head armor" }),
  ).toBeVisible();
  await enableAll(page);
  await page.getByRole("radio", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Equip Test Helmet" }).click();
  await page
    .locator("header")
    .getByRole("button", { name: "Show all items", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "All", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("radio", { name: "Discovered", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Equip Test Helmet" }),
  ).toHaveCount(0);
  await expect(page.getByText("Test Helmet", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "All", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Collection", exact: true }).click();
  await expect(
    page
      .locator("header")
      .getByRole("button", { name: "Show all items", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("delete loadouts with cancellation, active switching and last-loadout replacement", async ({
  page,
}) => {
  await page.goto("/build");
  await page.getByRole("textbox", { name: "Loadout name" }).fill("First build");
  await page.getByRole("button", { name: "New loadout", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Loadout name" })
    .fill("Second build");
  await page
    .getByRole("button", { name: "Saved loadouts", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Delete First build", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Delete First build", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Delete Second build", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete loadout", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Delete Second build", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "First build",
  );
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "First build",
  );
  await page
    .getByRole("button", { name: "Saved loadouts", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Delete First build", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete loadout", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  await expect(page.getByText("0 / 12 equipped")).toBeVisible();
});
