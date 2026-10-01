import { test, expect } from "@playwright/test";
import { emptyBuild } from "../src/features/builds/build.service";
import { encodeBuildLink } from "../src/features/builds/build.link";
import type { Build } from "../src/features/builds/build.types";

test("existing three-effect local builds retain three effects and keep the backup", async ({
  page,
}) => {
  const build = emptyBuild("Previous build");
  build.slots.melee = {
    itemSlug: "hammer",
    enchantments: ["fire"],
    effects: ["gear_effect-1", "gear_effect-2", "gear_effect-3"],
  };
  const original = JSON.stringify({
    ["s:" + build.id]: { versionKey: "old", data: build },
  });
  await page.addInitScript((saved) => {
    if (!localStorage.getItem("mddex.builds.v2"))
      localStorage.setItem("mddex.builds.v2", saved);
  }, original);
  await page.goto("/build");
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Previous build",
  );
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 2: gear_effect 2",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /effect 3:/ })).toHaveCount(9);
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  const summary = page.getByRole("region", { name: "Build summary" });
  await expect(summary).toContainText("Effect 1 description");
  await expect(summary).toContainText("Effect 2 description");
  await expect(summary).toContainText("Effect 3 description");
  expect(
    await page.evaluate(() => localStorage.getItem("mddex.builds.v2")),
  ).toBe(original);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 1: gear_effect 1",
      exact: true,
    }),
  ).toBeVisible();
});
const catalog = [
  ...[
    { variation: "Armor Enchant", applicable_categories: ["armor"] },
    {
      variation: "Weapon Enchant",
      applicable_categories: ["melee_weapon", "ranged_weapon"],
    },
  ].map((entry) => ({
    ...entry,
    slug: entry.variation,
    category: "enchantment",
    type: "enchantment",
    image: null,
  })),
  ...["enchantment", "artifact", "talisman", "gear_effect"].flatMap(
    (category) =>
      [1, 2, 3, 4].map((number) => ({
        slug: `${category}-${number}`,
        variation: `${category} ${number}`,
        category,
        type:
          category === "gear_effect"
            ? ["attack", "defense", "utility", "attack"][number - 1]
            : category,
        ...(category === "gear_effect"
          ? { description: `Effect ${number} description with X% roll value.` }
          : {}),
        image: null,
      })),
  ),
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
    description: "A finely crafted sword.",
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
  ).toBeVisible();
  await page.getByRole("button", { name: "Equip Battle Hammer" }).click();
  await expect(
    page.getByRole("button", { name: "Clear Melee weapon", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
    })
    .click();
  await page.getByRole("button", { name: "Equip Fire Aspect" }).click();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon enchantment 1: Fire Aspect",
    }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  await expect(page.getByLabel("Build enchantment cost")).toBeVisible();
  await expect(page.getByLabel("Build enchantment cost")).toContainText(
    "6 / 99",
  );
  await expect(
    page.getByRole("img", { name: "Enchantment points" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Shards" })).toBeVisible();
  await expect(
    page.getByLabel("Build enchantment cost").locator(".build-cost-shards"),
  ).toContainText("3");
  await page.getByRole("radio", { name: "Catalog", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Loadout name" })
    .fill("Hammer build");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Hammer build",
  );
  await expect(
    page.getByRole("button", {
      name: "Melee weapon enchantment 1: Fire Aspect",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("mddex.collection.v2")),
  ).toBeNull();
  await page.getByRole("button", { name: "New loadout", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Clear Melee weapon", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Saved loadouts", exact: true })
    .click();
  await page.getByRole("button", { name: /^Hammer build/ }).click();
  await expect(
    page.getByRole("button", { name: "Clear Melee weapon", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Melee weapon enchantment 1: Fire Aspect" })
    .click();
  await page.getByRole("button", { name: "Clear selected slot" }).click();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear Melee weapon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Clear Melee weapon", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("summary clears slot selection and choosing a slot opens catalog", async ({
  page,
}) => {
  await page.goto("/build");
  const board = page.getByLabel("Loadout equipment", { exact: true });
  const selectedSlots = board.locator('button[aria-pressed="true"]');
  await expect(selectedSlots).toHaveCount(1);
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Equipment picker" }),
  ).toHaveCount(0);
  await expect(selectedSlots).toHaveCount(0);
  await page.getByRole("button", { name: "New loadout", exact: true }).click();
  await expect(selectedSlots).toHaveCount(0);
  await page.getByRole("radio", { name: "Catalog", exact: true }).click();
  await expect(selectedSlots).toHaveCount(1);
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  const headSlot = board.getByRole("button", {
    name: "Choose Helmet",
    exact: true,
  });
  await headSlot.click();
  await expect(
    page.getByRole("region", { name: "Equipment picker" }),
  ).toBeVisible();
  await expect(headSlot).toHaveAttribute("aria-pressed", "true");
  await expect(selectedSlots).toHaveCount(1);
});
test("mobile uses the same compatible picker inside a sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/build");
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  const summary = page.getByRole("region", { name: "Build summary" });
  await expect(summary).toBeVisible();
  await expect(page.getByRole("radio", { name: "Summary" })).toBeHidden();
  const boardBounds = await page
    .getByLabel("Loadout equipment", { exact: true })
    .boundingBox();
  const summaryBounds = await summary.boundingBox();
  expect(summaryBounds!.y).toBeGreaterThan(
    boardBounds!.y + boardBounds!.height,
  );
  const enchantmentWidth = await page
    .getByRole("button", { name: "Helmet enchantment 1: Empty enchantment" })
    .evaluate((element) => element.getBoundingClientRect().width);
  const effectWidth = await page
    .getByRole("button", { name: "Helmet effect 1: Empty effect" })
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(enchantmentWidth).toBeGreaterThan(30);
  expect(effectWidth).toBeGreaterThan(28);
  const selectedSlots = page
    .getByLabel("Loadout equipment", { exact: true })
    .locator('button[aria-pressed="true"]');
  await expect(selectedSlots).toHaveCount(0);
  await page
    .getByRole("button", { name: "Choose Helmet", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Equip Battle Hammer" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Equip Test Helmet" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(selectedSlots).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Helmet enchantment 1: Empty enchantment",
    })
    .click();
  await dialog.getByRole("button", { name: "Equip Fire Aspect" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(selectedSlots).toHaveCount(0);
  await page
    .getByRole("button", { name: "Choose Helmet", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-slot="modal-close-trigger"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(selectedSlots).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Helmet enchantment 1: Fire Aspect" }),
  ).toBeVisible();
  await expect(summary).toContainText("Fire Aspect");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("removed catalog references remain saved and clearable", async ({
  page,
}) => {
  await page.goto("/build");
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  await expect(
    page.getByRole("radio", { name: "Discovered", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Equip Battle Hammer" }).click();
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "removed-hammer",
        manifest: "releases/removed-hammer/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog.filter((i) => i.slug !== "hammer") }),
  );
  await page.reload();
  // Cached sessions stage the refreshed release for the next full page load.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string[]>((resolve, reject) => {
            const request = indexedDB.open("mddex-catalog-v1", 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction("snapshots", "readonly");
              const snapshots = transaction.objectStore("snapshots").getAll();
              transaction.oncomplete = () => {
                db.close();
                resolve(
                  snapshots.result.map(
                    (snapshot: { version: string }) => snapshot.version,
                  ),
                );
              };
              transaction.onabort = () => {
                db.close();
                reject(transaction.error);
              };
            };
          }),
      ),
    )
    .toContain("removed-hammer");
  await page.reload();
  await expect(
    page.getByText("Unavailable item", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear Melee weapon", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear Melee weapon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Clear Melee weapon", exact: true }),
  ).toHaveCount(0);
});
test("empty gear enchantments select equipment first", async ({ page }) => {
  await page.goto("/build");
  await page
    .getByRole("button", {
      name: "Helmet enchantment 1: Empty enchantment",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose Helmet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Equip Test Helmet" }).click();
  await page.reload();
  await expect(page.getByText("Test Helmet", { exact: true })).toBeVisible();
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
  await expect(
    page.getByRole("button", { name: "Clear Melee weapon", exact: true }),
  ).toHaveCount(0);
});

test("navigation reuses the loaded catalog even when content goes offline", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (request) => {
    if (/\/(latest|catalog)\.json$/.test(request.url())) requests++;
  });
  await page.goto("/collection");
  await expect(page.getByRole("heading", { name: "Catalog." })).toBeVisible();
  await page.route("**/latest.json", (route) => route.abort());
  await page.route("**/catalog.json", (route) => route.abort());
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  await page.getByRole("link", { name: "Catalog", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catalog." })).toBeVisible();
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Loadout 1",
  );
  expect(requests).toBe(2);
});

test("reload only checks latest until the published catalog version changes", async ({
  page,
}) => {
  let catalogs = 0;
  let pointers = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/latest.json")) pointers++;
    if (request.url().endsWith("/catalog.json")) catalogs++;
  });
  await page.goto("/build");
  await expect(
    page.getByRole("textbox", { name: "Loadout name" }),
  ).toBeVisible();
  expect(catalogs).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Loadout name" }),
  ).toBeVisible();
  await expect.poll(() => pointers).toBe(2);
  expect(catalogs).toBe(1);
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "next",
        manifest: "releases/next/manifest.json",
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Loadout name" }),
  ).toBeVisible();
  await expect.poll(() => pointers).toBe(3);
  await expect.poll(() => catalogs).toBe(2);
});

test("effect and equipment groups supports toggling, limits, filtering and persistence", async ({
  page,
}) => {
  await page.goto("/build");
  await page
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  const effects = page.getByRole("button", {
    name: /^Melee weapon effect \d:/,
  });
  await expect(effects).toHaveCount(3);
  for (const category of ["gear_effect", "artifact", "talisman"]) {
    await page
      .getByRole("button", {
        name:
          category === "gear_effect"
            ? "Melee weapon effect 2: Empty effect"
            : `Choose ${category === "artifact" ? "Artifact" : "Talisman"} 2`,
        exact: true,
      })
      .click();
    for (const number of [1, 2, 3]) {
      await page
        .getByRole("button", {
          name: `${category === "gear_effect" ? "Add effect" : "Equip"} ${category} ${number}`,
          exact: true,
        })
        .click();
      if (category === "gear_effect") await expect(effects).toHaveCount(3);
    }
    await expect(
      page.getByText("3 / 3 selected.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `${category === "gear_effect" ? "Add effect" : "Equip"} ${category} 4`,
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: `${category === "gear_effect" ? "Add effect" : "Equip"} ${category} 2`,
        exact: true,
      })
      .click();
    if (category === "gear_effect") await expect(effects).toHaveCount(3);
    await page
      .getByRole("button", {
        name: `${category === "gear_effect" ? "Add effect" : "Equip"} ${category} 4`,
        exact: true,
      })
      .click();
    await page
      .getByRole("searchbox", {
        name:
          category === "gear_effect"
            ? "Search effects"
            : "Search compatible items",
      })
      .fill(`${category} 1`);
    await expect(
      page.getByText("3 / 3 selected.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `${category === "gear_effect" ? "Add effect" : "Equip"} ${category} 1`,
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await page.reload();
  for (const category of ["artifact", "talisman"]) {
    await page
      .getByRole("button", {
        name: `Choose ${category === "artifact" ? "Artifact" : "Talisman"} 1`,
        exact: true,
      })
      .click();
    for (const number of [1, 3, 4]) {
      await expect(
        page.getByRole("button", {
          name: `${category === "gear_effect" ? "Add effect" : "Equip"} ${category} ${number}`,
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await page
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
    await expect(
      page.getByText("0 / 3 selected.", { exact: false }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", {
      name: "Melee weapon effect 2: gear_effect 1",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("3 / 3 selected.", { exact: false }),
  ).toBeVisible();
});

test("mobile keeps group selection open until Done and toggles catalog items", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/build");
  await page
    .getByRole("button", { name: "Choose Artifact 1", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  for (const number of [1, 2, 3]) {
    await dialog
      .getByRole("button", { name: `Equip artifact ${number}`, exact: true })
      .click();
    await expect(dialog).toBeVisible();
  }
  await dialog
    .getByRole("searchbox", { name: "Search compatible items" })
    .fill("artifact 4");
  await expect(
    dialog.getByRole("button", { name: "Equip artifact 4", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("searchbox", { name: "Search compatible items" })
    .fill("");
  await dialog
    .getByRole("button", { name: "Equip artifact 2", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Equip artifact 4", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Choose Artifact 3", exact: true })
    .click();
  await expect(
    dialog.getByText("3 / 3 selected.", { exact: false }),
  ).toBeVisible();
  for (const number of [1, 3, 4]) {
    await expect(
      dialog.getByRole("button", {
        name: `Equip artifact ${number}`,
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("published applicability filters Build and is visible and filterable in Collection", async ({
  page,
}) => {
  await page.goto("/build");
  for (const [slot, equipment, compatible, incompatible] of [
    ["Melee weapon", "Battle Hammer", "Weapon Enchant", "Armor Enchant"],
    ["Ranged weapon", "Test Bow", "Weapon Enchant", "Armor Enchant"],
    ["Helmet", "Test Helmet", "Armor Enchant", "Weapon Enchant"],
  ]) {
    await page
      .getByRole("button", { name: `Choose ${slot}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `Equip ${equipment}`, exact: true })
      .click();
    await page
      .getByRole("button", {
        name: `${slot} enchantment 1: Empty enchantment`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: `Equip ${compatible}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Equip ${incompatible}`, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Equip Fire Aspect", exact: true }),
    ).not.toContainText("Compatibility unknown");
    await page
      .getByRole("button", { name: `Equip ${compatible}`, exact: true })
      .click();
  }
  await page.getByRole("link", { name: "Catalog", exact: true }).click();
  await page
    .getByRole("article", { name: "Armor Enchant", exact: true })
    .waitFor();
  await expect(
    page.getByRole("article", { name: "Armor Enchant", exact: true }),
  ).toContainText("To Armor");
  await expect(
    page.getByRole("article", { name: "Weapon Enchant", exact: true }),
  ).toContainText("To Melee, Ranged");
  await page.goto("/collection?category=enchantment&appliesTo=armor");
  await expect(
    page.getByRole("button", { name: "Armor Applies to", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Armor Enchant", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Weapon Enchant", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "Fire Aspect", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Armor Applies to", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Compatibility unknown", exact: true })
    .click();
  await expect(page).toHaveURL(/appliesTo=unknown/);
  await expect(
    page.getByRole("article", { name: "Fire Aspect", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Armor Enchant", exact: true }),
  ).toHaveCount(0);
});

test("slot type filters appear only when there are multiple compatible types", async ({
  page,
}) => {
  await page.goto("/build");
  await page.getByRole("radio", { name: "Hammers", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Equip Battle Hammer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Equip Test Sword", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("radio", { name: "All types", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Equip Test Sword", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose Ranged weapon", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Bows", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Equip Test Bow", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose Helmet", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Head", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("radio", { name: "All types", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Equip Test Helmet", exact: true }),
  ).toBeVisible();
});

test("one enchantment and effects have separate selectors and persist", async ({
  page,
}) => {
  await page.goto("/build");
  await expect(
    page.getByRole("button", { name: /enchantment [123]: Empty enchantment/ }),
  ).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: /effect [123]: Empty effect/ }),
  ).toHaveCount(27);
  await page
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Equip Fire Aspect", exact: true })
    .click();
  await expect(page.locator(".summary-pane .build-cost")).toContainText(
    "6 / 99",
  );
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Choose up to 3 Effects for Battle Hammer",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Effect 1 description with X% roll value.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Equip Fire Aspect", exact: true }),
  ).toHaveCount(0);
  for (const [number, points] of [
    [1, 9],
    [2, 12],
    [3, 12],
  ]) {
    await page
      .getByRole("button", {
        name: `Add effect gear_effect ${number}`,
        exact: true,
      })
      .click();
    await expect(page.locator(".summary-pane .build-cost")).toContainText(
      `${points} / 99`,
    );
  }
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  await expect(page.getByLabel("Build enchantment cost")).toBeVisible();
  await page.getByRole("radio", { name: "Catalog", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add effect gear_effect 4", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Defense", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add effect gear_effect 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon enchantment 1: Fire Aspect",
      exact: true,
    }),
  ).toBeVisible();
  for (const number of [1, 2, 3])
    await expect(
      page.getByRole("button", {
        name: `Melee weapon effect ${number}: gear_effect ${number}`,
        exact: true,
      }),
    ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose Artifact 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip artifact 1", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Artifact 1 effect 1: Empty effect",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add effect gear_effect 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Artifact 1 effect 1: gear_effect 1",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Talisman.*effect/ }),
  ).toHaveCount(0);
});
test("mobile effects use the sheet and keep it open for multiple selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/build");
  await page
    .getByRole("button", { name: "Choose Melee weapon", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Add effect gear_effect 1", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 1: gear_effect 1",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("equipment cards keep visible names while modifiers show names on hover and focus", async ({
  page,
}) => {
  await page.goto("/build");
  await page
    .getByRole("button", {
      name: "Artifact 1 effect 1: Empty effect",
      exact: true,
    })
    .focus();
  await expect(page.getByRole("tooltip")).toHaveText("Choose equipment first");
  await page
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  const gear = page.getByRole("button", {
    name: "Choose Melee weapon",
    exact: true,
  });
  await expect(gear).toContainText("Battle Hammer");
  await expect(gear).toContainText("Melee weapon");
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Equip Fire Aspect", exact: true })
    .click();
  const enchantment = page.getByRole("button", {
    name: "Melee weapon enchantment 1: Fire Aspect",
    exact: true,
  });
  await expect(enchantment).toHaveText("");
  await enchantment.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Fire Aspect");
  await page.mouse.move(0, 0);
  await enchantment.focus();
  await expect(page.getByRole("tooltip")).toHaveText("Fire Aspect");
});

test("bottom bar whitespace opens item selection while modifiers keep their actions", async ({
  page,
}) => {
  await page.goto("/build");
  await page
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Choose Enchantment for Battle Hammer",
      exact: true,
    }),
  ).toBeVisible();
  const gear = page.getByRole("button", {
    name: "Choose Melee weapon",
    exact: true,
  });
  const card = gear.locator("..");
  const bounds = await card.boundingBox();
  if (!bounds) throw new Error("Equipment card is missing");
  await page.mouse.move(
    bounds.x + bounds.width - 12,
    bounds.y + bounds.height - 20,
  );
  expect(await gear.evaluate((element) => element.matches(":hover"))).toBe(
    true,
  );
  await page.mouse.click(
    bounds.x + bounds.width - 12,
    bounds.y + bounds.height - 20,
  );
  await expect(
    page.getByRole("heading", { name: "Choose Melee weapon", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Choose Enchantment for Battle Hammer",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Choose up to 3 Effects for Battle Hammer",
      exact: true,
    }),
  ).toBeVisible();
});

test("summary groups effects and enchantments and follows loadout changes", async ({
  page,
}) => {
  await page.goto("/build");
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  const summary = page.getByRole("region", {
    name: "Build summary",
    exact: true,
  });
  await expect(summary.getByText("No effects yet")).toBeVisible();
  await page
    .getByRole("button", { name: "Choose Melee weapon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Test Sword", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add effect gear_effect 1", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Equip Fire Aspect", exact: true })
    .click();
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  await expect(
    summary.getByRole("region", { name: "Attack", exact: true }),
  ).toContainText("Effect 1 description with X% roll value.");
  await expect(
    summary.getByRole("region", { name: "Enchantments", exact: true }),
  ).toContainText("Fire Aspect");
  await expect(summary).not.toContainText("Melee weapon · Test Sword");
  await expect(summary).not.toContainText("gear_effect 1");
  await expect(summary).not.toContainText("A finely crafted sword.");
  await expect(
    summary.getByRole("region", { name: "Equipment effects", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear Melee weapon", exact: true })
    .click();
  await expect(summary.getByText("No effects yet")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("shared links open as editable builds and save locally without overwriting loadouts", async ({
  page,
}) => {
  await page.goto("/build");
  await page
    .getByRole("textbox", { name: "Loadout name" })
    .fill("Shared 🔥 build");
  await page
    .getByRole("button", { name: "Equip Test Sword", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add effect gear_effect 1", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Equip Fire Aspect", exact: true })
    .click();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share build", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Link copied", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(
    /\/build(?:#build=1\.[A-Za-z0-9_-]+|\?share=[A-Za-z0-9_-]{22})$/,
  );
  const geometry = await page
    .locator(".build-view-controls")
    .evaluate((element) => {
      const share = element.querySelector("button")!.getBoundingClientRect();
      const toggle = element
        .querySelector('[role="radiogroup"]')!
        .getBoundingClientRect();
      return {
        shareY: share.top,
        toggleY: toggle.top,
        shareX: share.left,
        toggleX: toggle.left,
      };
    });
  expect(Math.abs(geometry.shareY - geometry.toggleY)).toBeLessThan(2);
  expect(geometry.shareX).toBeLessThan(geometry.toggleX);
  const savedBefore = await page.evaluate(() =>
    localStorage.getItem("mddex.builds.v3"),
  );
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Save locally", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share build", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Shared 🔥 build",
  );
  await expect(
    page.getByRole("region", { name: "Build summary", exact: true }),
  ).toContainText("Effect 1 description with X% roll value.");
  await page
    .getByRole("textbox", { name: "Loadout name" })
    .fill("Edited shared build");
  await page
    .getByRole("button", { name: "Choose Melee weapon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 2: Empty effect",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add effect gear_effect 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear Melee weapon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose Melee weapon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("mddex.builds.v3")),
  ).toBe(savedBefore);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save locally", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share build", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  const copied = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mddex.builds.v3")!),
  );
  expect(Object.keys(copied)).toHaveLength(2);
  const original = Object.values(JSON.parse(savedBefore!))[0] as {
    data: unknown;
  };
  expect(Object.values(copied)).toContainEqual(original);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Edited shared build",
  );
  await expect(
    page.getByRole("button", { name: "Choose Melee weapon", exact: true }),
  ).toContainText("Battle Hammer");
  await page.goto("/build#build=2.bad");
  await expect(page.getByRole("alert")).toContainText("build link is invalid");
  expect(
    Object.keys(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("mddex.builds.v3")!),
      ),
    ),
  ).toHaveLength(2);
});

const uniqueWeapon = {
  slug: "unique-sword",
  category: "melee_weapon",
  type: "swords",
  variation: "Unique Sword",
  image: null,
  game_data: {
    unique: true,
    effects: [
      { name: "gear_effect 1", tier: "unique", catalog_slug: "gear_effect-1" },
    ],
  },
};

test("unique equipment automatically locks its effect while the remaining effect stays editable", async ({
  page,
}) => {
  const otherUnique = {
    ...uniqueWeapon,
    slug: "other-unique",
    variation: "Other Unique Sword",
    game_data: {
      unique: true,
      effects: [{ tier: "III", catalog_slug: "gear_effect-2" }],
    },
  };
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: [...catalog, uniqueWeapon, otherUnique] }),
  );
  await page.goto("/build");
  await page
    .getByRole("button", { name: "Equip Unique Sword", exact: true })
    .click();
  const locked = page.getByRole("button", {
    name: "Melee weapon effect 1: gear_effect 1 (unique effect, locked)",
    exact: true,
  });
  await expect(locked).toBeEnabled();
  await expect(locked).toHaveCSS("cursor", "pointer");
  await expect(locked).not.toHaveCSS("border-top-color", "rgb(245, 181, 68)");
  // Check hover before activation, which dismisses the tooltip.
  await locked.hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "gear_effect 1 · Unique effect (locked)",
  );
  await page
    .getByRole("heading", { name: "Choose Melee weapon", exact: true })
    .hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await locked.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(locked).toHaveCSS("border-top-color", "rgb(245, 181, 68)");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Choose up to 3 Effects for Unique Sword",
      exact: true,
    }),
  ).toBeVisible();
  await expect(locked).toHaveCSS("border-top-color", "rgb(245, 181, 68)");
  await page
    .getByRole("button", {
      name: "Melee weapon effect 2: Empty effect",
      exact: true,
    })
    .click();
  const fixedResult = page.getByRole("button", {
    name: "Add effect gear_effect 1",
    exact: true,
  });
  await expect(fixedResult).toBeDisabled();
  await page
    .getByRole("heading", {
      name: "Choose up to 3 Effects for Unique Sword",
      exact: true,
    })
    .click();
  await expect(locked).toHaveAttribute("aria-pressed", "true");
  await expect(locked).toHaveCSS("border-top-color", "rgb(245, 181, 68)");
  await expect(fixedResult).not.toHaveCSS(
    "border-top-color",
    "rgb(245, 181, 68)",
  );
  await expect(
    page.getByRole("button", { name: "Clear selection", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add effect gear_effect 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(locked).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 2: Empty effect",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add effect gear_effect 3", exact: true })
    .click();
  await page.reload();
  await expect(locked).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 2: gear_effect 3",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose Melee weapon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Other Unique Sword", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 1: gear_effect 2 (unique effect, locked)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 2: gear_effect 3",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose Melee weapon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Test Sword", exact: true })
    .click();
  await expect(page.locator(".modifier-button.unique-effect")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    }),
  ).toBeVisible();
});

test("old shared unique builds acquire their locked effect and save it locally", async ({
  page,
}) => {
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: [...catalog, uniqueWeapon] }),
  );
  const build = emptyBuild("Old unique build");
  build.slots.melee = {
    itemSlug: uniqueWeapon.slug,
    effects: ["gear_effect-3", null],
    enchantments: [],
  };
  const token = await encodeBuildLink(build);
  await page.goto(`/build#build=${token}`);
  const locked = page.getByRole("button", {
    name: "Melee weapon effect 1: gear_effect 1 (unique effect, locked)",
    exact: true,
  });
  await expect(locked).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 2: gear_effect 3",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Build summary", exact: true }),
  ).toContainText("Effect 1 description");
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page).toHaveURL(/\/build$/);
  await page.reload();
  await expect(locked).toBeVisible();
  expect(
    await page.evaluate((name) => {
      const saved: Record<string, { data: Build }> = JSON.parse(
        localStorage.getItem("mddex.builds.v3")!,
      );
      return Object.values(saved)
        .map((row) => row.data)
        .find((row) => row.name === name)?.slots.melee?.effects;
    }, build.name),
  ).toEqual(["gear_effect-1", "gear_effect-3", null]);
});
