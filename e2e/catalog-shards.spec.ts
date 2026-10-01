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
