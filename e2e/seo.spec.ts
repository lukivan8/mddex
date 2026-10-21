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
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".build-guide, .page-about")).toHaveCount(0);
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

test("catalog omits SEO filler and link directories", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.locator(".page-about, .catalog-directory")).toHaveCount(0);
});

test("catalog metadata and item facts remain server-rendered without generated filler", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/catalog/armor/alchemist-loafers");
  await expect(page).toHaveTitle(
    "Alchemist Loafers in Minecraft Dungeons 2 | MDDEX",
  );
  await expect(page.locator("h1")).toHaveText("Alchemist Loafers");
  await expect(page.locator(".detail-guide, .detail-introduction")).toHaveCount(
    0,
  );
  await expect(page.locator(".detail-dossier")).toContainText(
    "Increases Soul capacity by 50%",
  );
  await expect(page.locator(".detail-dossier")).toContainText(
    "Singer's Meadow Dungeons",
  );
  const schemas = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const breadcrumbs = schemas
    .map((schema) => JSON.parse(schema))
    .find((schema) => schema["@type"] === "BreadcrumbList");
  expect(
    breadcrumbs.itemListElement.map((item: { item: string }) => item.item),
  ).toEqual([
    "https://mddex.net/build",
    "https://mddex.net/collection",
    "https://mddex.net/catalog/armor/alchemist-loafers",
  ]);
  await context.close();
});

test("status pages expose their published mechanics and gear relationships without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/catalog/status/artificing");
  await expect(page.locator(".detail-dossier")).toContainText(
    "Artifact damage and soul gathering are increased",
  );
  await expect(
    page.getByRole("heading", { name: "Gear that applies this status" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Artifact Amplifier/ }),
  ).toHaveAttribute("href", /\/catalog\/enchantments\/artifact-amplifier/);
  await context.close();
});

test("mob index omits SEO filler and link directories", async ({ page }) => {
  await page.goto("/mobs");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.locator(".page-about, .catalog-directory")).toHaveCount(0);
});
