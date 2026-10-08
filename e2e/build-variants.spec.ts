import { test, expect } from "@playwright/test";
import { emptyBuild } from "../src/features/builds/build.service";
import {
  addBuildVariant,
  updateBuildVariant,
} from "../src/features/builds/build.variants";
import { encodeBuildLink } from "../src/features/builds/build.link";

const initial = emptyBuild("Grinding", "variants-test");
initial.slots.melee = {
  itemSlug: "hammer",
  power: 100,
  enchantments: [],
  effects: [],
};
const catalog = [
  {
    slug: "hammer",
    variation: "Battle Hammer",
    category: "melee_weapon",
    type: "hammers",
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

for (const mobile of [false, true]) {
  test(`variants keep edits separate and survive reload on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((build) => {
      if (!localStorage.getItem("mddex.builds.v3"))
        localStorage.setItem(
          "mddex.builds.v3",
          JSON.stringify({
            ["s:" + build.id]: { versionKey: "seed", data: build },
          }),
        );
    }, initial);
    await page.goto("/build");
    await page
      .getByRole("button", { name: "Add variant", exact: true })
      .click();
    const name = page.getByRole("textbox", { name: "Loadout name" });
    await expect(name).toHaveValue("");
    await expect(name).toHaveAttribute("placeholder", "Variant II name");
    await name.fill("Boss fights");
    await page
      .getByRole("button", { name: "Clear Melee weapon", exact: true })
      .click();
    await page
      .getByRole("radio", { name: "Variant I: Grinding", exact: true })
      .click();
    await expect(name).toHaveValue("Grinding");
    await expect(
      page.getByRole("button", { name: "Choose Melee weapon", exact: true }),
    ).toContainText("Battle Hammer");
    await page.reload();
    await page
      .getByRole("radio", { name: "Variant II: Boss fights", exact: true })
      .click();
    await expect(name).toHaveValue("Boss fights");
    await expect(
      page.getByRole("button", { name: "Choose Melee weapon", exact: true }),
    ).toContainText("Choose item");
    await page
      .getByRole("button", { name: "Delete variant", exact: true })
      .click();
    const confirmation = page.getByRole("dialog", { name: "Delete variant?" });
    await expect(confirmation).toContainText("Boss fights");
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(confirmation).toHaveCount(0);
    await expect(name).toHaveValue("Boss fights");
    await page
      .getByRole("button", { name: "Delete variant", exact: true })
      .click();
    await confirmation
      .getByRole("button", { name: "Delete variant", exact: true })
      .click();
    await expect(page.getByRole("radio", { name: /Variant II/ })).toHaveCount(
      0,
    );
    await expect(name).toHaveValue("Grinding");
  });
}

function sharedBuild() {
  const { build, variant } = addBuildVariant(initial);
  return updateBuildVariant(build, variant.id, (selected) => ({
    ...selected,
    name: "Boss fights",
    slots: emptyBuild().slots,
  }));
}

test("shared builds switch variants and save the complete set locally", async ({
  page,
}) => {
  const token = await encodeBuildLink(sharedBuild());
  await page.goto(`/build#build=${token}`);
  await page
    .getByRole("radio", { name: "Variant II: Boss fights", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Boss fights",
  );
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Share build", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("radio", { name: "Variant I: Grinding", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Grinding",
  );
  await expect(
    page.getByRole("button", { name: "Choose Melee weapon", exact: true }),
  ).toContainText("Battle Hammer");
  await page
    .getByRole("radio", { name: "Variant II: Boss fights", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Boss fights",
  );
});

test("community builds show variant equipment and copy all variants into the builder", async ({
  page,
}) => {
  const id = "00000000-0000-4000-8000-000000000001";
  await page.route(`**/api/community-builds/${id}`, (route) =>
    route.fulfill({
      json: {
        id,
        build: sharedBuild(),
        name: "Versatile build",
        tags: [],
        description: [
          {
            type: "paragraph",
            content: [[{ text: "Boss fights and grinding." }]],
          },
        ],
        displayName: "Builder",
        discord: "",
        createdAt: 1,
        updatedAt: 1,
      },
    }),
  );
  await page.goto(`/community/${id}`);
  await expect(page.getByLabel("Build equipment")).toContainText(
    "Battle Hammer",
  );
  await page
    .getByRole("radio", { name: "Variant II: Boss fights", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Boss fights", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Build equipment")).not.toContainText(
    "Battle Hammer",
  );
  await page
    .getByRole("button", { name: "Open in builder", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Versatile build",
  );
  await page
    .getByRole("radio", { name: "Variant II: Boss fights", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Boss fights",
  );
});
