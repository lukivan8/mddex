import { test, expect, type Page } from "@playwright/test";

test("analytics follows catalog navigation and build actions, counts repeat visits, and excludes private text", async ({
  page,
}) => {
  const events: {
    event: string;
    visitorId: string;
    sessionId: string;
    returning: boolean;
    visitorHistory?: { firstSeenAt: number; firstSeenKnown: boolean };
    path: string;
  }[] = [];
  await page.route("**/api/analytics", async (route) => {
    events.push(...route.request().postDataJSON().events);
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
  await flush(page);
  await expect
    .poll(async () => {
      await flush(page);
      return events.filter((e) => e.event === "page_view").length;
    })
    .toBe(1);
  expect(events[0].returning).toBe(false);
  expect(events[0].visitorHistory?.firstSeenKnown).toBe(true);
  const history = events[0].visitorHistory;
  const visitor = events[0].visitorId;
  const session = events[0].sessionId;
  await page.getByRole("searchbox").fill("Battle Hammer");
  await flush(page);
  await expect
    .poll(async () => {
      await flush(page);
      return events.some((e) => e.event === "catalog_search_used");
    })
    .toBe(true);
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await page
    .getByRole("button", { name: "Equip Battle Hammer", exact: true })
    .click();
  await flush(page);
  await expect
    .poll(async () => {
      await flush(page);
      return events.some((e) => e.event === "build_equipped");
    })
    .toBe(true);
  await flush(page);
  for (const name of ["build_navigation", "build_equip_attempt"]) {
    expect(events.some((e) => e.event === name)).toBe(true);
  }
  expect(events.filter((e) => e.event === "session_started")).toHaveLength(1);
  expect(new Set(events.map((e) => e.visitorId))).toEqual(new Set([visitor]));
  expect(JSON.stringify(events)).not.toContain("Battle Hammer");
  await flush(page);
  await page.reload();
  await flush(page);
  await expect
    .poll(async () => {
      await flush(page);
      return events.filter((e) => e.event === "page_view").length;
    })
    .toBe(3);
  expect(events.filter((e) => e.event === "session_started")).toHaveLength(1);
  await page.evaluate(() => {
    const key = "mddex.analytics.session.v1";
    const session = JSON.parse(localStorage.getItem(key)!);
    session.lastActive = Date.now() - 31 * 60 * 1000;
    localStorage.setItem(key, JSON.stringify(session));
  });
  await flush(page);
  await page.reload();
  await flush(page);
  await expect
    .poll(async () => {
      await flush(page);
      return events.filter((e) => e.event === "session_started").length;
    })
    .toBe(2);
  expect(events.at(-1)?.returning).toBe(true);
  expect(
    events.every(
      (e) => JSON.stringify(e.visitorHistory) === JSON.stringify(history),
    ),
  ).toBe(true);
  expect(events.at(-1)?.visitorId).toBe(visitor);
  expect(events.at(-1)?.sessionId).not.toBe(session);
});

for (const signal of ["globalPrivacyControl", "doNotTrack"] as const)
  test(`${signal} opt-out prevents analytics and does not break the page`, async ({
    page,
  }) => {
    let requests = 0;
    await page.addInitScript(
      (signal) =>
        Object.defineProperty(navigator, signal, {
          value: signal === "doNotTrack" ? "1" : true,
        }),
      signal,
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
    expect(
      await page.evaluate(() =>
        localStorage.getItem("mddex.analytics.first-seen.v1"),
      ),
    ).toBeNull();
  });

test("catalog and mob discovery report safe page paths and filter labels", async ({
  page,
}) => {
  const events: { event: string; path: string; label?: string }[] = [];
  await page.route("**/api/analytics", async (route) => {
    events.push(...route.request().postDataJSON().events);
    await route.fulfill({ status: 204 });
  });
  await page.goto("/mobs");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Hostile" }).click();
  await expect(page).toHaveURL(/kind=hostile/);
  await flush(page);
  await expect
    .poll(async () => {
      await flush(page);
      return events.some(
        (e) => e.event === "mob_kind_selected" && e.label === "hostile",
      );
    })
    .toBe(true);
  const mobName = await page
    .locator(".item-card .item-name")
    .first()
    .innerText();
  await page.getByRole("searchbox").fill(mobName.slice(0, 3));
  await flush(page);
  await expect
    .poll(async () => {
      await flush(page);
      return events.some((e) => e.event === "mobs_search_used");
    })
    .toBe(true);
  await page.locator("a.item-content").first().click();
  await expect(page.locator("h1")).toBeVisible();
  const itemPath = new URL(page.url()).pathname;
  await flush(page);
  await expect
    .poll(async () => {
      await flush(page);
      return events.some((e) => e.event === "page_view" && e.path === itemPath);
    })
    .toBe(true);
  expect(events).toContainEqual(
    expect.objectContaining({ event: "mob_kind_selected", label: "hostile" }),
  );
  expect(events.some((e) => e.event === "mobs_search_used")).toBe(true);
  expect(JSON.stringify(events)).not.toContain("?q=");
});

test("queues several real UI events and clears only after the local Worker accepts the batch", async ({
  page,
}) => {
  const requests: {
    events: { id: string; occurredAt: number; event: string }[];
  }[] = [];
  const responses: number[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/analytics"))
      requests.push(request.postDataJSON());
  });
  page.on("response", (response) => {
    if (response.url().endsWith("/api/analytics"))
      responses.push(response.status());
  });
  await page.goto("/mobs");
  await expect.poll(() => queuedCount(page)).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Hostile" }).click();
  await expect(page).toHaveURL(/kind=hostile/);
  await expect.poll(() => queuedCount(page)).toBeGreaterThanOrEqual(3);
  expect(requests).toHaveLength(0);
  await flush(page);
  expect(requests).toHaveLength(1);
  expect(requests[0].events.map((e) => e.event)).toContain("mob_kind_selected");
  expect(requests[0].events.length).toBeGreaterThanOrEqual(3);
  expect(new Set(requests[0].events.map((e) => e.id)).size).toBe(
    requests[0].events.length,
  );
  expect(requests[0].events.every((e) => Number.isInteger(e.occurredAt))).toBe(
    true,
  );
  expect(responses).toEqual([204]);
});

test("failed batches survive reload and retain original event IDs and times", async ({
  page,
}) => {
  const attempts: { id: string; occurredAt: number; event: string }[][] = [];
  let accept = false;
  await page.route("**/api/analytics", async (route) => {
    attempts.push(route.request().postDataJSON().events);
    await route.fulfill({ status: accept ? 204 : 503 });
  });
  await page.goto("/mobs");
  await expect.poll(() => queuedCount(page)).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect.poll(() => attempts.length).toBe(1);
  const first = attempts[0];
  await expect.poll(() => queuedCount(page)).toBe(first.length);
  accept = true;
  await page.reload();
  await expect.poll(() => queuedCount(page)).toBeGreaterThan(first.length);
  await flush(page);
  expect(attempts.at(-1)).toEqual(expect.arrayContaining(first));
  expect(await queuedCount(page)).toBe(0);
});

async function queuedCount(page: Page) {
  return page.evaluate(async () => {
    if (
      !(await indexedDB.databases()).some(
        (db) => db.name === "mddex-analytics-v1",
      )
    )
      return -1;
    return new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("mddex-analytics-v1", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const count = db.transaction("events").objectStore("events").count();
        count.onsuccess = () => {
          db.close();
          resolve(count.result);
        };
      };
    });
  });
}
async function flush(page: Page) {
  await expect
    .poll(async () => {
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      return queuedCount(page);
    })
    .toBe(0);
}

for (const scenario of ["legacy", "blocked"] as const)
  test(`${scenario} visitor history remains unknown without inventing a first visit`, async ({
    page,
  }) => {
    const events: {
      visitorId: string;
      visitorHistory?: { firstSeenAt: number; firstSeenKnown: boolean };
    }[] = [];
    await page.addInitScript((scenario) => {
      if (scenario === "legacy")
        localStorage.setItem(
          "mddex.analytics.visitor.v1",
          "b4fa8b18-964d-4337-8cc7-30d3a69cd292",
        );
      else
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new Error("blocked");
          },
        });
    }, scenario);
    await page.route("**/api/analytics", async (route) => {
      events.push(...route.request().postDataJSON().events);
      await route.fulfill({ status: 204 });
    });
    await page.goto("/mobs");
    await expect.poll(() => queuedCount(page)).toBeGreaterThanOrEqual(2);
    await flush(page);
    expect(events.length).toBeGreaterThanOrEqual(2);
    if (scenario === "legacy") {
      expect(
        events.every(
          (e) =>
            e.visitorId === "b4fa8b18-964d-4337-8cc7-30d3a69cd292" &&
            e.visitorHistory?.firstSeenKnown === false,
        ),
      ).toBe(true);
    } else
      expect(events.every((e) => e.visitorHistory === undefined)).toBe(true);
  });

test("tabs share the existing browser UUID and first-seen history", async ({
  context,
  page,
}) => {
  const events: { visitorId: string; visitorHistory: unknown }[] = [];
  await context.route("**/api/analytics", async (route) => {
    events.push(...route.request().postDataJSON().events);
    await route.fulfill({ status: 204 });
  });
  await page.goto("/mobs");
  await expect.poll(() => queuedCount(page)).toBeGreaterThanOrEqual(2);
  await flush(page);
  const initial = events[0];
  const tab = await context.newPage();
  await tab.goto("/mobs");
  await expect.poll(() => queuedCount(tab)).toBeGreaterThanOrEqual(1);
  await flush(tab);
  expect(events.length).toBeGreaterThan(2);
  expect(
    events.every(
      (e) =>
        e.visitorId === initial.visitorId &&
        JSON.stringify(e.visitorHistory) ===
          JSON.stringify(initial.visitorHistory),
    ),
  ).toBe(true);
});
