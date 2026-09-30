import { test, expect } from "@playwright/test";

const aim = {
  slug: "aim",
  category: "gear_effect",
  type: "attack",
  variation: "Aim",
  image: null,
  description: "Critical hit chance increases by 10%.",
  game_data: {
    tiers: [
      {
        tier: "I",
        talisman: false,
        text: "Critical hit chance increases by 10%.",
      },
      {
        tier: "II",
        talisman: false,
        text: "Critical hit chance increases by 15%.",
      },
      {
        tier: "III",
        talisman: false,
        text: "Critical hit chance increases by 25%.",
      },
      {
        tier: "unique",
        talisman: false,
        text: "Critical hit chance increases by 40%.",
      },
      {
        tier: "III",
        talisman: true,
        text: "Critical hit chance increases by 45%.",
      },
    ],
  },
};
const ally = { ...aim, slug: "ally", variation: "Ally", type: "utility" };
const sword = {
  slug: "sword",
  category: "melee_weapon",
  type: "swords",
  variation: "Sword",
  image: null,
};
const bow = {
  ...sword,
  slug: "bow",
  category: "ranged_weapon",
  type: "bows",
  variation: "Bow",
};
const unique = {
  ...sword,
  slug: "unique-sword",
  variation: "Unique Sword",
  game_data: {
    unique: true,
    effects: [
      {
        catalog_slug: "aim",
        tier: "unique",
        text: "Critical hit chance increases by 40%.",
      },
    ],
  },
};
const enchantment = {
  ...aim,
  slug: "enchant",
  category: "enchantment",
  type: "enchantment",
  variation: "Enchantment",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "tiers",
        manifest: "releases/tiers/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: [aim, ally, sword, bow, unique, enchantment] }),
  );
});

test("inline tiers select in one click, update full slots, default rows to max, and survive sharing", async ({
  page,
}) => {
  await page.goto("/build");
  await page.getByRole("button", { name: "Equip Sword", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add effect Aim", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select Aim tier III", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Add effect Aim", exact: true }),
  ).toContainText("25%");
  await page
    .getByRole("button", { name: "Select Aim tier I", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add effect Aim", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", {
      name: "Melee weapon effect 2: Empty effect",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select Ally tier II", exact: true })
    .click();
  const aimII = page.getByRole("button", {
    name: "Select Aim tier II",
    exact: true,
  });
  await aimII.focus();
  await page.keyboard.press("Space");
  await expect(aimII).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Add effect Aim", exact: true }),
  ).toContainText("15%");
  await expect(page.locator("button button")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/mddex-tier-picker-desktop.png" });
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Select Enchantment tier I", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose Ranged weapon", exact: true })
    .click();
  await page.getByRole("button", { name: "Equip Bow", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Ranged weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add effect Aim", exact: true })
    .click();
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  const summary = page.getByRole("region", {
    name: "Build summary",
    exact: true,
  });
  await expect(summary).toContainText("15%");
  await expect(summary).toContainText("40%");
  await expect(summary).toContainText("10%");
  await expect(summary.locator(".summary-count")).toHaveCount(0);
  await expect(summary).not.toContainText("×2");
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: "Melee weapon effect 1: Aim", exact: true })
      .locator(".modifier-tier"),
  ).toHaveText("II");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share build", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Link copied", exact: true }),
  ).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Save locally", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Melee weapon effect 1: Aim", exact: true })
      .locator(".modifier-tier"),
  ).toHaveText("II");
  await expect(summary).toContainText("15%");
  await expect(summary).toContainText("40%");
});

test("unique effects use their fixed published value and have no editable tier buttons", async ({
  page,
}) => {
  await page.goto("/build");
  const uniqueRow = page.getByRole("button", {
    name: "Equip Unique Sword",
    exact: true,
  });
  await expect(uniqueRow.locator(".picker-unique-icon")).toHaveAttribute(
    "title",
    "Aim: Critical hit chance increases by 40%.",
  );
  await expect(
    page
      .getByRole("button", { name: "Equip Sword", exact: true })
      .locator(".picker-unique-icon"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Equip Unique Sword", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 2: Empty effect",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Select Aim tier I", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add effect Aim", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Add effect Aim", exact: true }),
  ).toContainText("40%");
  await page
    .getByRole("button", { name: "Select Ally tier I", exact: true })
    .click();
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  const summary = page.getByRole("region", {
    name: "Build summary",
    exact: true,
  });
  await expect(summary).toContainText("40%");
  await expect(summary).toContainText("10%");
  await expect(summary.getByText("Unique", { exact: true })).toHaveCount(0);
});

test("mobile tier selection stays in the sheet and fits without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/build");
  await page
    .getByRole("button", { name: "Choose Melee weapon", exact: true })
    .click();
  await page.getByRole("button", { name: "Equip Sword", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Select Aim tier II", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Select Aim tier II", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    dialog.getByRole("button", { name: "Add effect Aim", exact: true }),
  ).toContainText("15%");
  await page.screenshot({ path: "/tmp/mddex-tier-picker-mobile.png" });
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page
      .getByRole("button", { name: "Melee weapon effect 1: Aim", exact: true })
      .locator(".modifier-tier"),
  ).toHaveText("II");
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Select Enchantment tier I", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .getByRole("button", {
        name: "Melee weapon enchantment 1: Enchantment",
        exact: true,
      })
      .locator(".modifier-tier"),
  ).toHaveText("I");
});

test("tier hover and keyboard focus preview text without changing the build", async ({
  page,
}) => {
  await page.goto("/build");
  await page.getByRole("button", { name: "Equip Sword", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  const row = page.getByRole("button", { name: "Add effect Aim", exact: true });
  const first = page.getByRole("button", {
    name: "Select Aim tier I",
    exact: true,
  });
  const second = page.getByRole("button", {
    name: "Select Aim tier II",
    exact: true,
  });
  const search = page.getByRole("searchbox", {
    name: "Search effects",
    exact: true,
  });
  await expect(row).toContainText("25%");
  await first.hover();
  await expect(row).toContainText("10%");
  await expect(row).toHaveAttribute("aria-pressed", "false");
  await expect(first).not.toHaveAttribute("title");
  await search.hover();
  await expect(row).toContainText("25%");
  await second.focus();
  await expect(row).toContainText("15%");
  await search.focus();
  await expect(row).toContainText("25%");
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  const before = await page.evaluate(() =>
    localStorage.getItem("mddex.builds.v3"),
  );
  await first.hover();
  await expect(row).toContainText("10%");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await search.hover();
  await search.focus();
  await expect(row).toContainText("15%");
  expect(
    await page.evaluate(() => localStorage.getItem("mddex.builds.v3")),
  ).toBe(before);
});

test("summary adds effect values, hides effect tiers, highlights totals and keeps enchantments separate", async ({
  page,
}) => {
  const healing = {
    ...aim,
    type: "defense",
    game_data: {
      tiers: [
        {
          tier: "I",
          text: "Restores 1% of max health for each soul gathered.",
          talisman: false,
        },
        {
          tier: "III",
          text: "Restores 5% of max health for each soul gathered.",
          talisman: false,
        },
      ],
    },
  };
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: [healing, sword, bow, enchantment] }),
  );
  await page.goto("/build");
  await page.getByRole("button", { name: "Equip Sword", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add effect Aim", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Melee weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Select Enchantment tier I", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose Ranged weapon", exact: true })
    .click();
  await page.getByRole("button", { name: "Equip Bow", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Ranged weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Select Aim tier I", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Ranged weapon enchantment 1: Empty enchantment",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Select Enchantment tier III", exact: true })
    .click();
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  const summary = page.getByRole("region", {
    name: "Build summary",
    exact: true,
  });
  const defense = summary.getByRole("region", { name: "Defense", exact: true });
  await expect(defense.locator("p")).toHaveText(
    "Restores 6% of max health for each soul gathered.",
  );
  await expect(defense.locator(".summary-tier")).toHaveCount(0);
  await expect(defense.locator("strong.summary-number")).toHaveText("6%");
  await expect(defense.locator("strong.summary-number")).toHaveCSS(
    "color",
    "rgb(245, 181, 68)",
  );
  await expect(defense.locator("strong.summary-number")).toHaveCSS(
    "font-weight",
    "600",
  );
  const enchants = summary.getByRole("region", {
    name: "Enchantments",
    exact: true,
  });
  await expect(enchants.locator(".summary-contribution")).toHaveCount(2);
  await expect(enchants.locator(".summary-tier")).toHaveText([
    "Tier I",
    "Tier III",
  ]);
  await expect(enchants).toContainText("10%");
  await expect(enchants).toContainText("25%");
  await page.screenshot({ path: "/tmp/mddex-additive-summary.png" });
});

test("talismans use their own I II III values and contribute to the additive summary", async ({
  page,
}) => {
  const spiritual = {
    ...aim,
    slug: "spiritual",
    variation: "Spiritual",
    type: "utility",
    game_data: {
      tiers: [
        { tier: "I", talisman: false, text: "Increases Soul capacity by 25%." },
        {
          tier: "II",
          talisman: false,
          text: "Increases Soul capacity by 30%.",
        },
        {
          tier: "III",
          talisman: false,
          text: "Increases Soul capacity by 35%.",
        },
        { tier: "I", talisman: true, text: "Increases Soul capacity by 15%." },
        { tier: "II", talisman: true, text: "Increases Soul capacity by 20%." },
        {
          tier: "III",
          talisman: true,
          text: "Increases Soul capacity by 35%.",
        },
      ],
    },
  };
  const talisman = {
    ...sword,
    slug: "soul-chip",
    category: "talisman",
    variation: "Soul Chip",
    game_data: {
      levels: [
        {
          level: "1",
          effects: [
            {
              catalog_slug: "spiritual",
              text: "Increases Soul capacity by 15%.",
            },
          ],
        },
        {
          level: "2",
          effects: [
            {
              catalog_slug: "spiritual",
              text: "Increases Soul capacity by 20%.",
            },
          ],
        },
        {
          level: "3",
          effects: [
            {
              catalog_slug: "spiritual",
              text: "Increases Soul capacity by 35%.",
            },
          ],
        },
      ],
    },
  };
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: [sword, spiritual, talisman] }),
  );
  await page.goto("/build");
  await page.getByRole("button", { name: "Equip Sword", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Melee weapon effect 1: Empty effect",
      exact: true,
    })
    .click();
  const spiritualRow = page.getByRole("button", {
    name: "Add effect Spiritual",
    exact: true,
  });
  await page
    .getByRole("button", { name: "Select Spiritual tier I", exact: true })
    .hover();
  await expect(spiritualRow).toContainText("25%");
  await expect(spiritualRow).not.toContainText("15%");
  await page
    .getByRole("button", { name: "Select Spiritual tier I", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose Talisman 1", exact: true })
    .click();
  const talismanRow = page.getByRole("button", {
    name: "Equip Soul Chip",
    exact: true,
  });
  await expect(
    page
      .getByRole("group", { name: "Soul Chip tier", exact: true })
      .getByRole("button"),
  ).toHaveText(["I", "II", "III"]);
  await page
    .getByRole("button", { name: "Select Soul Chip tier I", exact: true })
    .hover();
  await expect(talismanRow).toContainText("15%");
  await page
    .getByRole("button", { name: "Select Soul Chip tier I", exact: true })
    .click();
  await page.getByRole("radio", { name: "Summary", exact: true }).click();
  const summary = page.getByRole("region", {
    name: "Build summary",
    exact: true,
  });
  await expect(summary).toContainText("Increases Soul capacity by 40%.");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Choose Talisman 1", exact: true }),
  ).toContainText("Soul Chip I");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share build", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Link copied", exact: true }),
  ).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(link);
  await expect(summary).toContainText("Increases Soul capacity by 40%.");
});

for (const mobile of [false, true]) {
  test(`fourth effect tier previews, defaults to max, and persists (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const recovery = {
      ...aim,
      slug: "recovery",
      variation: "Recovery",
      game_data: {
        tiers: [10, 20, 30, 40].map((value, index) => ({
          tier: ["I", "II", "III", "IV"][index],
          talisman: false,
          text: `Increases all healing received by ${value}%.`,
        })),
      },
    };
    await page.route("**/catalog.json", (route) =>
      route.fulfill({ json: [sword, recovery] }),
    );
    await page.goto("/build");
    if (mobile)
      await page
        .getByRole("button", { name: "Choose Melee weapon", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Equip Sword", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Melee weapon effect 1: Empty effect",
        exact: true,
      })
      .click();
    const row = page.getByRole("button", {
      name: "Add effect Recovery",
      exact: true,
    });
    const tiers = page.getByRole("group", {
      name: "Recovery tier",
      exact: true,
    });
    await expect(tiers.getByRole("button")).toHaveText([
      "I",
      "II",
      "III",
      "IV",
    ]);
    const nameBox = await row.locator("strong").boundingBox();
    const tierBox = await tiers.boundingBox();
    expect(nameBox!.x + nameBox!.width).toBeLessThan(tierBox!.x);
    await row.click();
    const fourth = page.getByRole("button", {
      name: "Select Recovery tier IV",
      exact: true,
    });
    await expect(fourth).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Select Recovery tier I", exact: true })
      .click();
    if (!mobile) {
      await fourth.hover();
      await expect(row).toContainText("40%");
      await expect(fourth).toHaveAttribute("aria-pressed", "false");
    }
    await fourth.click();
    if (mobile)
      await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("radio", { name: "Summary", exact: true }).click();
    const summary = page.getByRole("region", {
      name: "Build summary",
      exact: true,
    });
    await expect(summary).toContainText(
      "Increases all healing received by 40%.",
    );
    await expect(summary.locator(".summary-number")).toHaveText(["40%"]);
    await page.reload();
    await page.getByRole("radio", { name: "Summary", exact: true }).click();
    await expect(summary).toContainText(
      "Increases all healing received by 40%.",
    );
  });
}

for (const mobile of [false, true]) {
  test(`unique-only effect is pinned and its gear icon opens the picker (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const fixed = {
      ...aim,
      variation: "Zenith Aim",
      applicable_categories: ["armor"],
      game_data: {
        tiers: aim.game_data.tiers.filter((tier) => tier.tier === "unique"),
      },
    };
    await page.route("**/catalog.json", (route) =>
      route.fulfill({ json: [sword, unique, fixed, ally] }),
    );
    await page.goto("/build");
    if (mobile)
      await page
        .getByRole("button", { name: "Choose Melee weapon", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Equip Unique Sword", exact: true })
      .click();
    const icon = page.getByRole("button", {
      name: "Melee weapon effect 1: Zenith Aim (unique effect, locked)",
      exact: true,
    });
    await icon.click();
    const pinned = page.getByRole("button", {
      name: "Add effect Zenith Aim",
      exact: true,
    });
    await expect(pinned).toBeDisabled();
    await expect(pinned).toContainText("40%");
    await expect(
      page.locator(".picker-results .picker-result").first(),
    ).toHaveAccessibleName("Add effect Zenith Aim");
    await page
      .getByRole("searchbox", { name: "Search effects", exact: true })
      .fill("Ally");
    await expect(pinned).toBeVisible();
    await page
      .getByRole("button", { name: "Select Ally tier I", exact: true })
      .click();
    if (mobile)
      await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(icon).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Melee weapon effect 2: Ally",
        exact: true,
      }),
    ).toBeVisible();
  });
}
