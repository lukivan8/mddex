import { test, expect, type Page } from "@playwright/test";
import { emptyBuild } from "../src/features/builds/build.service";
import {
  BUILDS_STORAGE_KEY,
  BUILD_PREFERENCES_KEY,
} from "../src/features/builds/build.db";
import type { CommunityBuild } from "../src/features/community/community.schema";

const build = emptyBuild("Frostbound ranger", "local-frost");
build.slots.melee = {
  itemSlug: "sword",
  effects: ["damage"],
  enchantments: ["fire"],
};
build.slots.legs = { itemSlug: "leggings", effects: [], enchantments: [null] };
build.slots.artifact1 = { itemSlug: "artifact", effects: [], enchantments: [] };
const posted: CommunityBuild = {
  id: "1ca81d62-4caf-4c40-9742-7e96679dfe50",
  name: build.name,
  build,
  tags: ["Solo", "Ranged"],
  description: [
    {
      type: "paragraph",
      content: [[{ text: "Freeze the front line.", bold: true }]],
    },
  ],
  displayName: "Aurora",
  discord: "aurora.gg",
  createdAt: 1_790_000_000,
  updatedAt: 1_790_000_000,
};
async function setup(page: Page) {
  const auth = { verified: false, deleted: false, requests: [] as string[] };
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "community-test",
        manifest: "releases/community-test/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({
      json: [
        {
          slug: "sword",
          variation: "Sword",
          category: "melee_weapon",
          type: "swords",
          image: null,
        },
        {
          slug: "fire",
          variation: "Fire Aspect",
          category: "enchantment",
          type: "melee",
          image: null,
        },
        {
          slug: "damage",
          variation: "Sharpness",
          category: "gear_effect",
          type: "offense",
          image: null,
        },
        {
          slug: "leggings",
          variation: "Test leggings",
          category: "armor",
          type: "legs",
          image: null,
        },
        {
          slug: "artifact",
          variation: "Test artifact",
          category: "artifact",
          type: "artifacts",
          image: null,
        },
      ],
    }),
  );
  await page.addInitScript(
    ({ build, key, preferences }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(
          key,
          JSON.stringify({ [build.id]: { versionKey: "test", data: build } }),
        );
        localStorage.setItem(
          preferences,
          JSON.stringify({
            workspace: {
              versionKey: "test",
              data: { id: "workspace", activeId: build.id },
            },
          }),
        );
      }
    },
    { build, key: BUILDS_STORAGE_KEY, preferences: BUILD_PREFERENCES_KEY },
  );
  await page.route("**/api/community-builds**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/tags"))
      return route.fulfill({
        json: { tags: auth.deleted ? [] : ["Ranged", "Solo", "Melee"] },
      });
    if (url.pathname.endsWith("/auth/session"))
      return route.fulfill({
        json: {
          email: auth.verified ? "creator@example.com" : null,
          displayName: auth.verified ? "Aurora" : null,
          expiresAt: auth.verified
            ? Math.floor(Date.now() / 1000) + 604800
            : null,
        },
      });
    if (url.pathname.endsWith("/auth/request")) {
      auth.requests.push(route.request().postDataJSON().requestId);
      return route.fulfill({
        json: {
          challengeId: "60af730b-670e-4842-aeca-00e99c3f4ec3",
          expiresAt: Math.floor(Date.now() / 1000) + 600,
        },
      });
    }
    if (url.pathname.endsWith("/auth/verify")) {
      if (route.request().postDataJSON().code !== "123456")
        return route.fulfill({
          status: 401,
          json: { error: "Invalid or expired code." },
        });
      auth.verified = true;
      return route.fulfill({
        json: {
          email: "creator@example.com",
          expiresAt: Math.floor(Date.now() / 1000) + 604800,
        },
      });
    }
    if (url.pathname.endsWith("/delete")) {
      if (!auth.verified)
        return route.fulfill({
          status: 401,
          json: { error: "Confirm your email before deleting this build." },
        });
      auth.deleted = true;
      return route.fulfill({ json: { id: posted.id, deleted: true } });
    }
    if (auth.deleted && url.pathname !== "/api/community-builds")
      return route.fulfill({ status: 404, json: { error: "Build not found" } });
    if (url.pathname.endsWith("/edit"))
      return route.fulfill(
        auth.verified
          ? { json: posted }
          : {
              status: 401,
              json: { error: "Confirm your email before editing this build." },
            },
      );
    if (
      url.pathname === "/api/community-builds" &&
      route.request().method() === "POST"
    )
      return route.fulfill(
        auth.verified
          ? { status: 201, json: { id: posted.id } }
          : {
              status: 401,
              json: {
                error: "Confirm your email before publishing this build.",
              },
            },
      );
    if (url.pathname === "/api/community-builds")
      return route.fulfill({
        json: {
          builds:
            auth.deleted || url.searchParams.get("q") === "nothing"
              ? []
              : [posted],
          hasMore: false,
        },
      });
    return route.fulfill({ json: posted });
  });
  return auth;
}
test("gallery navigation, centered read view, local copy and email edit gate", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/build");
  await page
    .getByRole("link", { name: "Community builds", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Community Builds." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Frostbound ranger" }).click();
  await expect(
    page.getByRole("heading", { name: "Frostbound ranger." }),
  ).toBeVisible();
  await expect(page.locator(".community-description strong")).toContainText(
    "Freeze the front line.",
  );
  await expect(page.locator(".community-gear").first()).toContainText("Sword");
  await page.getByRole("button", { name: "Edit this build" }).click();
  await expect(page).toHaveURL(`/community/${posted.id}`);
  await expect(page.locator(".community-detail-heading h1")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Confirm your email" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Confirm your email" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(`/community/${posted.id}`);
  await page.getByRole("button", { name: "Edit this build" }).click();

  await page
    .getByRole("textbox", { name: "Confirmation email", exact: true })
    .fill("creator@example.com");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(
    page.getByText("Your confirmation lasts for 7 days on this browser.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(`/community/${posted.id}`);
  await page
    .getByRole("textbox", { name: "Confirmation code", exact: true })
    .fill("000000");
  await page
    .getByRole("button", { name: "Confirm email", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Invalid or expired code",
  );
  await page
    .getByRole("textbox", { name: "Confirmation code", exact: true })
    .fill("123456");
  await page
    .getByRole("button", { name: "Confirm email", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeVisible();
  await expect(page).toHaveURL(`/community/${posted.id}/edit`);
  await page.getByRole("link", { name: "Back to build" }).click();
  await page.getByRole("button", { name: "Edit this build" }).click();
  await expect(page).toHaveURL(`/community/${posted.id}/edit`);
  await expect(
    page.getByRole("dialog", { name: "Confirm your email" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Back to build" }).click();
  await page.getByRole("button", { name: "Open in builder" }).click();
  await expect(page).toHaveURL(/\/build$/);
  await expect(page.getByRole("textbox", { name: "Loadout name" })).toHaveValue(
    "Frostbound ranger",
  );
});
test("posting inherits a local build and supports custom tags and rich description", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/community/new");
  const loadout = page.locator(".community-local-build");
  await expect(loadout.locator(".community-preview-item")).toHaveCount(12);
  await expect(
    loadout.getByRole("img", { name: "Leggings: Test leggings", exact: true }),
  ).toBeVisible();
  await expect(
    loadout.getByRole("img", {
      name: "Artifact 1: Test artifact",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Saved in this browser")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Build name", exact: true }),
  ).toHaveValue("Frostbound ranger");
  await page
    .getByRole("textbox", { name: "Search or create tag" })
    .fill("Speedrun");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Speedrun tag" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("A fast loadout with easy swaps.");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("creator@example.com");
  await page
    .getByRole("textbox", { name: "Display name", exact: true })
    .fill("Aurora");
  await page.getByRole("button", { name: "Publish build" }).click();
  await expect(
    page.getByRole("dialog", { name: "Confirm your email" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Confirmation code", exact: true })
    .fill("123456");
  const published = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/community-builds" &&
      request.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Confirm email", exact: true })
    .click();
  const payload = (await published).postDataJSON();
  expect(payload.tags).toEqual(["Speedrun"]);
  expect(payload.description[0].content[0][0].text).toBe(
    "A fast loadout with easy swaps.",
  );
  expect(payload.description[0].content[0][0].bold).toBe(true);
  expect(payload.build.slots.melee.itemSlug).toBe("sword");
  await expect(page).toHaveURL(new RegExp(`/community/${posted.id}$`));
});
test("create new returns to the builder, preserves the draft and inherits a renamed build", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/community/new");
  await page
    .getByRole("textbox", { name: "Display name", exact: true })
    .fill("Draft author");
  await page.getByRole("button", { name: "Create a new build" }).click();
  await expect(page).toHaveURL(/\/build\?community=post/);
  await page.getByRole("textbox", { name: "Loadout name" }).fill("Fresh build");
  await page.getByRole("link", { name: "Continue to posting" }).click();
  await expect(
    page.getByRole("textbox", { name: "Build name", exact: true }),
  ).toHaveValue("Fresh build");
  await expect(
    page.getByRole("textbox", { name: "Display name", exact: true }),
  ).toHaveValue("Draft author");
});
test("gallery, read view and posting fit narrow screens", async ({ page }) => {
  await setup(page);
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/community",
      `/community/${posted.id}`,
      "/community/new",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("confirmed profile survives reloads and expired authentication prompts again for posting and editing", async ({
  page,
}) => {
  const auth = await setup(page);
  await page.goto("/community/new");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("creator@example.com");
  await page
    .getByRole("textbox", { name: "Display name", exact: true })
    .fill("Aurora");
  await page
    .getByRole("textbox", { name: "Discord", exact: true })
    .fill("aurora.gg");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("A build to test email confirmation.");
  await page.getByRole("button", { name: "Publish build" }).click();
  await page
    .getByRole("textbox", { name: "Confirmation code", exact: true })
    .fill("123456");
  await page
    .getByRole("button", { name: "Confirm email", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/community/${posted.id}$`));
  await page.goto("/community/new");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toHaveValue("creator@example.com");
  await expect(
    page.getByRole("textbox", { name: "Display name", exact: true }),
  ).toHaveValue("Aurora");
  await expect(
    page.getByRole("textbox", { name: "Discord", exact: true }),
  ).toHaveValue("aurora.gg");
  await page
    .getByRole("textbox", { name: "Build name", exact: true })
    .fill("Another build");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("A build to test email confirmation.");
  await page.getByRole("button", { name: "Publish build" }).click();
  await expect(page).toHaveURL(new RegExp(`/community/${posted.id}$`));
  expect(auth.requests).toHaveLength(1);
  await page.getByRole("button", { name: "Edit this build" }).click();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  auth.verified = false;
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Confirm your email" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("creator@example.com");
  await page
    .getByRole("textbox", { name: "Confirmation code", exact: true })
    .fill("123456");
  await page
    .getByRole("button", { name: "Confirm email", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeVisible();
  auth.verified = false;
  await page.goto("/community/new");
  await page
    .getByRole("textbox", { name: "Build name", exact: true })
    .fill("After expiry");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("A build to test email confirmation.");
  await page.getByRole("button", { name: "Publish build" }).click();
  await expect(
    page.getByRole("dialog", { name: "Confirm your email" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toHaveValue("creator@example.com");
});

test("publishing retries retain the same request ID and draft after a lost response and reload", async ({
  page,
}) => {
  const auth = await setup(page);
  const keys: string[] = [];
  await page.route("**/api/community-builds", (route) => {
    if (route.request().method() !== "POST" || !auth.verified)
      return route.fallback();
    keys.push(route.request().headers()["idempotency-key"]);
    return route.fulfill(
      keys.length === 1
        ? {
            status: 503,
            json: { error: "Lost publishing response. Try again." },
          }
        : { json: { id: posted.id } },
    );
  });
  await page.goto("/community/new");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("creator@example.com");
  await page
    .getByRole("textbox", { name: "Display name", exact: true })
    .fill("Aurora");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Preserve this draft.");
  await page.getByRole("button", { name: "Publish build" }).click();
  await page
    .getByRole("textbox", { name: "Confirmation code", exact: true })
    .fill("123456");
  await page
    .getByRole("button", { name: "Confirm email", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Lost publishing response",
  );
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toContainText("Preserve this draft.");
  await page.getByRole("button", { name: "Publish build" }).click();
  await expect(page).toHaveURL(new RegExp(`/community/${posted.id}$`));
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  expect(auth.requests).toHaveLength(1);
});

test("editor deletion confirms, hides the build and leaves local loadouts intact", async ({
  page,
}) => {
  const auth = await setup(page);
  auth.verified = true;
  await page.goto(`/community/${posted.id}/edit`);
  await page.getByRole("button", { name: "Delete build", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Delete build?",
    exact: true,
  });
  await expect(dialog).toContainText("Only the site owner can restore it");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(auth.deleted).toBe(false);
  await page.getByRole("button", { name: "Delete build", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Delete build", exact: true })
    .click();
  await expect(page).toHaveURL(/\/community$/);
  await expect(
    page.getByRole("heading", { name: "There are no builds yet!" }),
  ).toBeVisible();
  await page.goto(`/community/${posted.id}`);
  await expect(page.getByRole("alert")).toContainText("Build not found");
  await page.goto("/community/new");
  await expect(page.locator(".community-local-build")).toContainText(
    "Frostbound ranger",
  );
});

test("compact equipment distinguishes modifiers and opens their catalog pages", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/community/${posted.id}`);
  const enchantment = page.getByRole("link", {
    name: "Enchantment: Fire Aspect",
    exact: true,
  });
  const effect = page.getByRole("link", {
    name: "Effect: Sharpness",
    exact: true,
  });
  await expect(enchantment).toHaveClass(/enchantment/);
  await expect(effect).toHaveClass(/effect/);
  await expect(enchantment).toHaveAttribute(
    "title",
    "Enchantment: Fire Aspect",
  );
  await enchantment.click();
  await expect(page).toHaveURL(/\/catalog\/enchantments\/fire$/);
  await page.goBack();
  await effect.click();
  await expect(page).toHaveURL(/\/catalog\/gear-effects\/damage$/);
  await page.goBack();
  await page.locator(".community-gear .gear-select").first().click();
  await expect(page).toHaveURL(/\/catalog\/melee-weapons\/sword$/);
});

test("verified email reuses its unique display name and marks mismatches on both fields", async ({
  page,
}) => {
  const auth = await setup(page);
  auth.verified = true;
  await page.goto("/community/new");
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const name = page.getByRole("textbox", { name: "Display name", exact: true });
  await expect(email).toHaveValue("creator@example.com");
  await expect(name).toHaveValue("Aurora");
  await name.fill("Different creator");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Use Aurora for this email.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("This email is registered with a different display name.", {
      exact: true,
    }),
  ).toBeVisible();
  await email.fill("other@example.com");
  await email.fill("creator@example.com");
  await expect(name).toHaveValue("Aurora");
  await expect(page.locator(".community-field-error")).toHaveCount(0);
  expect(auth.requests).toHaveLength(0);
});
