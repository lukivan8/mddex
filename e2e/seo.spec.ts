import { test, expect } from "@playwright/test";

test("build metadata and useful content are present without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto("http://localhost:3100/build");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Minecraft Dungeons 2 Build Maker | MDDEX");
  await expect(
    page.getByRole("heading", {
      name: "Minecraft Dungeons 2 build maker",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://mddex.net/build",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://mddex.net/og-image.png",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  const schemas = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(schemas.map((schema) => JSON.parse(schema)["@type"])).toEqual(
    expect.arrayContaining(["WebSite", "WebApplication"]),
  );
  await context.close();
});

test("catalog and shared builds have clean canonical and indexing metadata", async ({
  page,
}) => {
  await page.goto("/collection?q=sword");
  await expect(page).toHaveTitle(
    "Minecraft Dungeons 2 Equipment Catalog | MDDEX",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://mddex.net/collection",
  );
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page).toHaveTitle("Minecraft Dungeons 2 Build Maker | MDDEX");
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await page.goto("/build?share=missing");
  await expect(page).toHaveTitle("Shared Minecraft Dungeons 2 Build | MDDEX");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://mddex.net/build",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://mddex.net/build?share=missing",
  );
});

test("crawl files, branded images, manifest, and root redirect are served", async ({
  request,
}) => {
  const root = await request.get("/", { maxRedirects: 0 });
  expect(root.status()).toBe(301);
  expect(root.headers().location).toBe("/build");
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(
    "Sitemap: https://mddex.net/sitemap.xml",
  );
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("<loc>https://mddex.net/build</loc>");
  expect(await sitemap.text()).toContain(
    "<loc>https://mddex.net/collection</loc>",
  );
  expect(await sitemap.text()).toContain(
    "<loc>https://mddex.net/catalog/melee-weapons/the-prospectors-pick</loc>",
  );
  const image = await request.get("/og-image.png");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const bytes = await image.body();
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  expect((await request.get("/favicon.ico")).status()).toBe(200);
  const manifest = await (await request.get("/site.webmanifest")).json();
  expect(manifest.start_url).toBe("/build");
  const api = await request.get("/api/build-links/missing");
  expect(api.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});

test("equipment directory exposes canonical item links without JavaScript", async ({
  request,
}) => {
  const response = await request.get("/collection");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('aria-label="All equipment pages"');
  expect(html).toContain('href="/catalog/melee-weapons/the-prospectors-pick"');
  expect(html).toContain('href="/catalog/armor/beekeeper-suit"');
});

test("mob index exposes canonical location links without JavaScript", async ({
  request,
}) => {
  const response = await request.get("/mobs");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('aria-label="All locations pages"');
  expect(html).toContain('href="/catalog/locations/honeycomb-fields"');
});
