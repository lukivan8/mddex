import { test, expect } from "@playwright/test";
const effect = (slug: string, name: string) => ({
  slug,
  variation: name,
  category: "gear_effect",
  type: "attack",
  image: null,
  description: `${name} bonus`,
});
const catalog = [
  {
    slug: "hammer",
    variation: "Pool Hammer",
    category: "melee_weapon",
    type: "hammers",
    image: null,
    game_data: {
      slug: "pool-hammer",
      sources: [
        { name: "Test Plains", type: "area", catalog_slug: "test-plains" },
      ],
      rollable_effects: {
        effects: [{ catalog_slug: "sharp", name: "Sharpness" }],
      },
      enchantment_options: {
        enchantments: [{ catalog_slug: "fire", name: "Fire Aspect" }],
      },
      quest_context: [
        {
          name: "Hammer Quest",
          objectives: [{ title: "Find the hammer" }],
          completion: "The hammer is yours.",
        },
      ],
    },
  },
  {
    slug: "other",
    variation: "Other Hammer",
    category: "melee_weapon",
    type: "hammers",
    image: null,
    game_data: {
      rollable_effects: { effects: [{ catalog_slug: "cooldown" }] },
      enchantment_options: { enchantments: [] },
    },
  },
  {
    slug: "helmet",
    variation: "Pool Helmet",
    category: "armor",
    type: "head",
    image: null,
    game_data: {
      enchantment_options: { enchantments: [{ catalog_slug: "somersault" }] },
    },
  },
  effect("sharp", "Sharpness"),
  effect("cooldown", "Cooldown"),
  {
    slug: "fire",
    variation: "Fire Aspect",
    category: "enchantment",
    type: "enchantment",
    image: null,
    game_data: { slots: ["MeleeWeapon"] },
  },
  {
    slug: "bottomless",
    variation: "Bottomless Brew",
    category: "enchantment",
    type: "enchantment",
    image: null,
    game_data: { slots: ["Chest"] },
  },
  {
    slug: "somersault",
    variation: "Somersault",
    category: "enchantment",
    type: "enchantment",
    image: null,
    game_data: { slots: ["Helmet", "Chest", "Boots", "Leggings"] },
  },
];
test.beforeEach(async ({ page }) => {
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "pools",
        manifest: "releases/pools/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
});
for (const mobile of [false, true])
  test(`builder uses equipment pools and slot-specific enchants (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/build");
    await expect(
      page.locator(".gear-modifiers .modifier-button.effect"),
    ).toHaveCount(27);
    if (mobile)
      await page
        .getByRole("button", { name: "Choose Melee weapon", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Equip Pool Hammer", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Melee weapon effect 3: Empty effect",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Add effect Sharpness", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add effect Cooldown", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Add effect Sharpness", exact: true })
      .click();
    await expect(
      page.locator(".gear-modifiers .modifier-button.effect"),
    ).toHaveCount(27);
    await expect(
      page.getByRole("button", { name: /Melee weapon effect 3: Sharpness/ }),
    ).toBeVisible();
    if (mobile)
      await page.getByRole("button", { name: "Done", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Melee weapon enchantment 1: Empty enchantment",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Equip Fire Aspect", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Equip Bottomless Brew", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Equip Fire Aspect", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Choose Melee weapon", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Equip Other Hammer", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Melee weapon enchantment 1: Empty enchantment",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Melee weapon effect 1: Empty effect",
        exact: true,
      }),
    ).toBeVisible();
  });
test("applicable effects use compact icons above Where to find it with hover details", async ({
  page,
}) => {
  await page.goto("/build");
  await expect(
    page.getByRole("button", { name: "Equip Pool Hammer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Catalog", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: /Pool Hammer/ })
    .first()
    .click();
  const where = page.getByRole("heading", {
    name: "Where to find it",
    exact: true,
  });
  await expect(where).toBeVisible();
  const effects = page.getByRole("heading", {
    name: "Applicable effects",
    exact: true,
  });
  await expect(effects).toBeVisible();
  expect(
    await effects.evaluate((element) =>
      element
        .closest("section")
        ?.nextElementSibling?.querySelector("h2")
        ?.textContent?.trim(),
    ),
  ).toBe("Where to find it");
  const card = page.getByRole("link", { name: "Sharpness", exact: true });
  await expect(card).toHaveAttribute("href", /catalog\/gear-effects/);
  await card.hover();
  await expect(page.getByRole("tooltip")).toContainText("Sharpness bonus");
  await expect(page.getByText("Hammer Quest", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /More about/ })).toHaveCount(
    0,
  );
  await expect(
    page.locator("summary").filter({ hasText: "Quests and unlocks" }),
  ).toHaveCount(0);
});

for (const mobile of [false, true]) {
  test(`item power stays collapsed, saves and displays on artwork (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/build");
    await expect(
      page.getByRole("textbox", { name: "Loadout name" }),
    ).toBeVisible();
    if (mobile)
      await page
        .getByRole("button", { name: "Choose Melee weapon", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Equip Pool Hammer", exact: true })
      .click();
    const input = page.getByRole("spinbutton", {
      name: "Melee weapon power",
      exact: true,
    });
    await expect(input).toBeHidden();
    await page.getByText("Set item power", { exact: true }).click();
    await expect(page.locator(".build-power-grid input")).toHaveCount(9);
    await expect(
      page.getByRole("spinbutton", { name: /Talisman.*power/ }),
    ).toHaveCount(0);
    await expect(page.locator(".gear-power")).toHaveCount(0);
    await expect(input).toHaveAttribute("min", "1");
    await expect(input).toHaveAttribute("max", "154");
    await input.fill("154");
    await input.blur();
    await expect(page.locator(".gear-power").first()).toHaveText("154");
    await input.fill("155");
    await input.blur();
    await expect(input).toHaveValue("154");
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Loadout name" }),
    ).toBeVisible();
    await expect(page.locator(".gear-power").first()).toHaveText("154");
    await expect(input).toBeHidden();
    await page.getByText("Set item power", { exact: true }).click();
    await expect(input).toHaveValue("154");
    await input.fill("1");
    await input.blur();
    await expect(page.locator(".gear-power")).toHaveCount(0);
    await page.reload();
    await page.getByText("Set item power", { exact: true }).click();
    await expect(input).toHaveValue("1");
    await expect(page.locator(".gear-power")).toHaveCount(0);
  });
}

for (const mobile of [false, true]) {
  test(`compatibility warnings collapse and remember the preference (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/build");
    if (mobile)
      await page
        .getByRole("button", { name: "Choose Melee weapon", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Equip Pool Hammer", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(
            localStorage.getItem("mddex.builds.v3") ?? "{}",
          );
          return (
            Object.values(saved) as {
              data: { slots: { melee: { itemSlug: string } | null } };
            }[]
          ).some((entry) => entry.data.slots.melee?.itemSlug === "hammer");
        }),
      )
      .toBe(true);
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem("mddex.builds.v3")!);
      for (const entry of Object.values(saved) as {
        data: { slots: { melee: { effects: string[] } | null } };
      }[]) {
        if (entry.data.slots.melee)
          entry.data.slots.melee.effects = ["cooldown"];
      }
      localStorage.setItem("mddex.builds.v3", JSON.stringify(saved));
    });
    await page.reload();
    const panel = page.locator(".build-compatibility-warning");
    await expect(panel).toContainText("Cooldown does not fit Pool Hammer.");
    await page
      .getByRole("button", { name: "Hide warnings", exact: true })
      .click();
    await expect(panel).toHaveCount(0);
    const icon = page.getByRole("button", {
      name: "Show compatibility warnings",
      exact: true,
    });
    await expect(icon).toBeVisible();
    if (!mobile) {
      await icon.hover();
      await expect(page.getByRole("tooltip")).toContainText(
        "Cooldown does not fit Pool Hammer.",
      );
      await page.mouse.move(0, 0);
      await icon.focus();
      await expect(page.getByRole("tooltip")).toContainText(
        "Cooldown does not fit Pool Hammer.",
      );
    }
    await page.reload();
    await expect(icon).toBeVisible();
    await expect(panel).toHaveCount(0);
    await icon.click();
    await expect(panel).toContainText("Cooldown does not fit Pool Hammer.");
    await expect(icon).toHaveCount(0);
  });
}

test("mobile builds can be created and saved without crypto.randomUUID", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/build");
  const name = page.getByRole("textbox", { name: "Loadout name", exact: true });
  await expect(name).toHaveValue("Loadout 1");
  await page.getByRole("button", { name: "New loadout", exact: true }).click();
  await name.fill("Mobile compatible build");
  await name.blur();
  await page
    .getByRole("button", { name: "Choose Melee weapon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Pool Hammer", exact: true })
    .click();
  await page.reload();
  await expect(name).toHaveValue("Mobile compatible build");
  await expect(
    page.getByRole("button", { name: "Choose Melee weapon", exact: true }),
  ).toContainText("Pool Hammer");
  await expect(
    page.getByRole("heading", { name: "Loadouts unavailable", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
