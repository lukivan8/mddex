import { test, expect } from "@playwright/test";

test("analytics follows catalog navigation and build actions, counts repeat visits, and excludes private text", async ({
  page,
}) => {
  const events: {
    event: string;
    visitorId: string;
    sessionId: string;
    returning: boolean;
    path: string;
  }[] = [];
  await page.route("**/api/analytics", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "analytics",
        manifest: "releases/analytics/manifest.json",
      },
    }),
  );
  await page.route("**/catalog.json", (route) =>
    route.fulfill({
      json: [
        {
          slug: "hammer",
          category: "melee_weapon",
          type: "hammers",
          variation: "Battle Hammer",
          image: null,
        },
      ],
    }),
  );
  await page.goto("/collection");
  await expect
    .poll(() => events.filter((e) => e.event === "page_view").length)
    .toBe(1);
  expect(events[0].returning).toBe(false);
  const visitor = events[0].visitorId;
  const session = events[0].sessionId;
  await page.getByRole("searchbox").fill("Battle Hammer");
  await expect
    .poll(() => events.some((e) => e.event === "catalog_search_used"))
    .toBe(true);
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await page
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  await expect
    .poll(() => events.some((e) => e.event === "build_equipped"))
    .toBe(true);
  for (const name of ["build_navigation", "build_equip_attempt"]) {
    expect(events.some((e) => e.event === name)).toBe(true);
  }
  expect(events.filter((e) => e.event === "session_started")).toHaveLength(1);
  expect(new Set(events.map((e) => e.visitorId))).toEqual(new Set([visitor]));
  expect(JSON.stringify(events)).not.toContain("Battle Hammer");
  await page.reload();
  await expect
    .poll(() => events.filter((e) => e.event === "page_view").length)
    .toBe(3);
  expect(events.filter((e) => e.event === "session_started")).toHaveLength(1);
  await page.evaluate(() => {
    const key = "mddex.analytics.session.v1";
    const session = JSON.parse(localStorage.getItem(key)!);
    session.lastActive = Date.now() - 31 * 60 * 1000;
    localStorage.setItem(key, JSON.stringify(session));
  });
  await page.reload();
  await expect
    .poll(() => events.filter((e) => e.event === "session_started").length)
    .toBe(2);
  expect(events.at(-1)?.returning).toBe(true);
  expect(events.at(-1)?.visitorId).toBe(visitor);
  expect(events.at(-1)?.sessionId).not.toBe(session);
});

test("privacy opt-out prevents analytics and does not break the page", async ({
  page,
}) => {
  let requests = 0;
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "globalPrivacyControl", { value: true }),
  );
  page.on("request", (request) => {
    if (request.url().endsWith("/api/analytics")) requests++;
  });
  await page.goto("/build");
  await expect(
    page.getByRole("link", { name: "Build", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("mddex.analytics.visitor.v1"),
    ),
  ).toBeNull();
});

test("catalog and mob discovery report safe page paths and filter labels", async ({
  page,
}) => {
  const events: { event: string; path: string; label?: string }[] = [];
  await page.route("**/api/analytics", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.goto("/mobs");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Hostile" }).click();
  await expect(page).toHaveURL(/kind=hostile/);
  await expect
    .poll(() =>
      events.some(
        (e) => e.event === "mob_kind_selected" && e.label === "hostile",
      ),
    )
    .toBe(true);
  const mobName = await page
    .locator(".item-card .item-name")
    .first()
    .innerText();
  await page.getByRole("searchbox").fill(mobName.slice(0, 3));
  await expect
    .poll(() => events.some((e) => e.event === "mobs_search_used"))
    .toBe(true);
  await page.locator("a.item-content").first().click();
  await expect(page.locator("h1")).toBeVisible();
  const itemPath = new URL(page.url()).pathname;
  await expect
    .poll(() =>
      events.some((e) => e.event === "page_view" && e.path === itemPath),
    )
    .toBe(true);
  expect(events).toContainEqual(
    expect.objectContaining({ event: "mob_kind_selected", label: "hostile" }),
  );
  expect(events.some((e) => e.event === "mobs_search_used")).toBe(true);
  expect(JSON.stringify(events)).not.toContain("?q=");
});
