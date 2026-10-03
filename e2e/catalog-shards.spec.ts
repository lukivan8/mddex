import { test, expect } from "@playwright/test";

test("Build fetches only the index; item navigation fetches one shard and reload uses IndexedDB", async ({
  page,
}) => {
  const entry = {
    slug: "shard-hammer",
    category: "melee_weapon",
    type: "hammers",
    variation: "Shard Hammer",
    image: null,
    detail_path: "details/hammer.json",
    game_data: { slug: "shard-hammer", sources: [] },
  };
  const requests: string[] = [];
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "shard-v1",
        manifest: "releases/shard-v1/manifest.json",
        catalogIndex: "releases/shard-v1/catalog-index.json",
      },
    }),
  );
  await page.route("**/releases/shard-v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path.endsWith("/catalog-index.json"))
      return route.fulfill({ json: [entry] });
    if (path.endsWith("/details/hammer.json"))
      return route.fulfill({
        json: {
          ...entry,
          description: "Loaded on demand",
          game_data: {
            ...entry.game_data,
            quest_context: { objectives: ["Find the hammer"] },
          },
        },
      });
    return route.abort();
  });
  await page.goto("/build");
  await expect(
    page.getByRole("textbox", { name: "Loadout name" }),
  ).toBeVisible();
  await expect
    .poll(() => requests)
    .toEqual(["/releases/shard-v1/catalog-index.json"]);
  await page
    .getByRole("link", { name: "Catalog", exact: true })
    .first()
    .click();
  const hammerLink = page.getByRole("link", { name: /Shard Hammer/ }).first();
  await hammerLink.hover();
  await expect
    .poll(() => requests)
    .toContain("/releases/shard-v1/details/hammer.json");
  await hammerLink.click();
  await expect(
    page.getByRole("heading", { name: "Shard Hammer", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Loaded on demand").first()).toBeVisible();
  expect(requests).toEqual([
    "/releases/shard-v1/catalog-index.json",
    "/releases/shard-v1/details/hammer.json",
  ]);
  await page.evaluate(() => {
    (window as unknown as { navigationMarker: string }).navigationMarker =
      "same-document";
  });
  await page
    .getByRole("link", { name: "Back to catalog", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /Shard Hammer/ }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { navigationMarker: string }).navigationMarker,
    ),
  ).toBe("same-document");
  expect(requests).toHaveLength(2);
  await page.goto("/build");
  await expect(
    page.getByRole("textbox", { name: "Loadout name" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Catalog", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: /Shard Hammer/ })
    .first()
    .click();
  await expect(page.getByText("Loaded on demand").first()).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("mddex.catalog."),
      ),
    ),
  ).toEqual([]);
});

test("opens uncached items before their shard loads, then uses stored details offline", async ({
  page,
}) => {
  const entry = {
    slug: "shard-hammer",
    category: "melee_weapon",
    type: "hammers",
    variation: "Shard Hammer",
    image: null,
    detail_path: "details/hammer.json",
    description: "Available from the index",
    game_data: { slug: "shard-hammer", sources: [] },
  };
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "slow-shard-v1",
        manifest: "releases/slow-shard-v1/manifest.json",
        catalogIndex: "releases/slow-shard-v1/catalog-index.json",
      },
    }),
  );
  await page.route("**/catalog-index.json", (route) =>
    route.fulfill({ json: [entry] }),
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let shardRequests = 0;
  await page.route("**/details/hammer.json", async (route) => {
    shardRequests++;
    await held;
    await route.fulfill({
      json: { ...entry, description: "Full cached details" },
    });
  });
  await page.goto("/build");
  await page
    .getByRole("link", { name: "Catalog", exact: true })
    .first()
    .click();
  const card = page
    .getByRole("article", { name: "Shard Hammer", exact: true })
    .locator("a.item-content");
  await card.click();
  // The response is deliberately held until after the page is already visible.
  await expect(page.locator("h1")).toHaveText("Shard Hammer");
  await expect(
    page.getByRole("status", { name: "Loading additional details" }),
  ).toBeVisible();
  await expect(page.locator(".detail-skeleton")).toBeVisible();
  await expect(
    page.getByText("Loading additional details…", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Available from the index").first(),
  ).toBeVisible();
  release();
  await expect(page.getByText("Full cached details").first()).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(shardRequests).toBe(1);

  await page.goto("/build");
  // Revalidation and shards are unavailable; the persisted release remains usable.
  await page.route("**/latest.json", (route) => route.abort());
  await page.route("**/details/hammer.json", (route) => {
    shardRequests++;
    return route.abort();
  });
  await page
    .getByRole("link", { name: "Catalog", exact: true })
    .first()
    .click();
  await card.click();
  await expect(page.getByText("Full cached details").first()).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(shardRequests).toBe(1);
});

test("failed detail enrichment keeps the item usable and can retry", async ({
  page,
}) => {
  const entry = {
    slug: "retry-hammer",
    category: "melee_weapon",
    type: "hammers",
    variation: "Retry Hammer",
    image: null,
    detail_path: "details/retry-hammer.json",
    game_data: { slug: "retry-hammer", sources: [] },
  };
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "retry-v1",
        manifest: "releases/retry-v1/manifest.json",
        catalogIndex: "releases/retry-v1/catalog-index.json",
      },
    }),
  );
  await page.route("**/catalog-index.json", (route) =>
    route.fulfill({ json: [entry] }),
  );
  await page.route("**/details/retry-hammer.json", (route) => route.abort());
  await page.goto("/build");
  await page
    .getByRole("link", { name: "Catalog", exact: true })
    .first()
    .click();
  await page
    .getByRole("article", { name: "Retry Hammer", exact: true })
    .locator("a.item-content")
    .click();
  await expect(page.locator("h1")).toHaveText("Retry Hammer");
  await expect(page.getByRole("status")).toContainText(
    "Additional details couldn’t load.",
  );
  await page.route("**/details/retry-hammer.json", (route) =>
    route.fulfill({
      json: {
        ...entry,
        description: "Details after retry",
      },
    }),
  );
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Details after retry").first()).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("item-to-item navigation displays the next item while its shard is pending", async ({
  page,
}) => {
  const first = {
    slug: "first-hammer",
    category: "melee_weapon",
    type: "hammers",
    variation: "First Hammer",
    image: null,
    detail_path: "details/first.json",
    game_data: {
      slug: "first-hammer",
      sources: [],
      base: { name: "Second Hammer", catalog_slug: "second-hammer" },
    },
  };
  const second = {
    ...first,
    slug: "second-hammer",
    variation: "Second Hammer",
    detail_path: "details/second.json",
    game_data: { slug: "second-hammer", sources: [] },
  };
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "between-v1",
        manifest: "releases/between-v1/manifest.json",
        catalogIndex: "releases/between-v1/catalog-index.json",
      },
    }),
  );
  await page.route("**/catalog-index.json", (route) =>
    route.fulfill({ json: [first, second] }),
  );
  await page.route("**/details/first.json", (route) =>
    route.fulfill({
      json: {
        ...first,
        description: "First full details",
      },
    }),
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/details/second.json", async (route) => {
    await held;
    await route.fulfill({
      json: { ...second, description: "Second full details" },
    });
  });
  await page.goto("/build");
  await page
    .getByRole("link", { name: "Catalog", exact: true })
    .first()
    .click();
  await page
    .getByRole("article", { name: "First Hammer", exact: true })
    .locator("a.item-content")
    .click();
  await expect(page.getByText("First full details").first()).toBeVisible();
  await page.getByRole("link", { name: /Base weapon Second Hammer/ }).click();
  await expect(page.locator("h1")).toHaveText("Second Hammer");
  await expect(
    page.getByRole("status", { name: "Loading additional details" }),
  ).toBeVisible();
  await expect(page.locator(".detail-skeleton")).toBeVisible();
  await expect(
    page.getByText("Loading additional details…", { exact: true }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(page.locator("h1")).toHaveText("First Hammer");
  release();
  await page.getByRole("link", { name: /Base weapon Second Hammer/ }).click();
  await expect(page.locator("h1")).toHaveText("Second Hammer");
  await expect(page.getByText("Second full details").first()).toBeVisible();
});
