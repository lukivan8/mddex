import { test, expect } from "@playwright/test";
import { emptyBuild } from "../src/features/builds/build.service";
import { encodeBuildLink } from "../src/features/builds/build.link";
const origin = "http://localhost:3100";
const headers = { Origin: origin };

test("D1 identity credentials and immutable links resolve immediately", async ({
  request,
  playwright,
}) => {
  const first = await request.post("/api/identity", { headers, data: {} });
  expect(first.status()).toBe(201);
  const { userId } = await first.json();
  expect(userId).toMatch(/^[a-f0-9-]{36}$/);
  expect(first.headers()["set-cookie"]).toContain("HttpOnly");
  expect(first.headers()["set-cookie"]).toContain("SameSite=Lax");
  expect(
    (await (await request.post("/api/identity", { headers, data: {} })).json())
      .userId,
  ).toBe(userId);
  const build = emptyBuild("Stored build");
  build.slots.melee = {
    itemSlug: "sword",
    effects: ["effect", null],
    enchantments: [null],
  };
  const token = await encodeBuildLink(build);
  const uploaded = await request.post("/api/build-links", {
    headers,
    data: { token },
  });
  expect(uploaded.status()).toBe(201);
  const { id } = await uploaded.json();
  expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  const stranger = await playwright.request.newContext({ baseURL: origin });
  const resolved = await stranger.get(`/api/build-links/${id}`);
  expect(resolved.status()).toBe(200);
  expect(await resolved.json()).toEqual({ token });
  expect(resolved.headers()["cache-control"]).toContain("immutable");
  const duplicate = await request.post("/api/build-links", {
    headers,
    data: { token },
  });
  expect((await duplicate.json()).id).toBe(id);
  expect(
    (
      await stranger.post("/api/build-links", {
        headers,
        data: { token, userId },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/build-links", {
        headers: { Origin: "https://evil.example" },
        data: { token },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/build-links", {
        headers,
        data: { token: "bad" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/build-links", {
        headers,
        data: { token: "a".repeat(11_000) },
      })
    ).status(),
  ).toBe(400);
  const missing = await stranger.get("/api/build-links/aaaaaaaaaaaaaaaaaaaaaa");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["cache-control"]).toBe("no-store");
  await stranger.dispose();
});

const catalog = [
  {
    slug: "sword",
    variation: "Sword",
    category: "melee_weapon",
    type: "swords",
    image: null,
  },
];
async function mockCatalog(page: import("@playwright/test").Page) {
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "short-links",
        manifest: "releases/short-links/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
}

test("only sharing stores snapshots; repeated shares reuse a confirmed link offline", async ({
  page,
  browser,
}) => {
  await mockCatalog(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/build");
  await page.getByRole("button", { name: "Equip Sword", exact: true }).click();
  let writes = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/api/build-links" &&
      request.method() === "POST"
    )
      writes++;
  });
  // Let the former background preparation interval elapse.
  await page.waitForTimeout(700);
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Share build", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Link copied", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Link copied", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Link copied", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/build\?share=[A-Za-z0-9_-]{22}$/);
  await page.context().setOffline(false);
  const recipient = await browser.newContext();
  const view = await recipient.newPage();
  await mockCatalog(view);
  await view.goto(link);
  await expect(
    view.getByRole("button", { name: "Save locally", exact: true }),
  ).toBeVisible();
  await expect(
    view.getByRole("button", { name: "Choose Melee weapon", exact: true }),
  ).toContainText("Sword");
  await view.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(view).toHaveURL(/\/build$/);
  await expect(view).toHaveTitle("Minecraft Dungeons 2 Build Maker | MDDEX");
  await expect(view.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow, max-image-preview:large",
  );
  await view.reload();
  await expect(
    view.getByRole("button", { name: "Choose Melee weapon", exact: true }),
  ).toContainText("Sword");
  await recipient.close();
});

test("pending shares wait for commit; failures copy a self-contained fallback", async ({
  page,
}) => {
  await mockCatalog(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/build-links", async (route) => {
    await pending;
    await route.fulfill({ status: 503, json: { error: "Unavailable" } });
  });
  await page.goto("/build");
  await page.getByRole("button", { name: "Equip Sword", exact: true }).click();
  await page.getByRole("button", { name: "Share build", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sharing…" }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("button", { name: "Link copied", exact: true }),
  ).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/build#build=1\./);
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Save locally", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose Melee weapon", exact: true }),
  ).toContainText("Sword");
});
