import { test, expect } from "@playwright/test";

test("Soul Storm forecast switches start and end times between 24-hour and 12-hour clocks", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
  });
  const page = await context.newPage();
  try {
    await page.clock.install({ time: new Date("2026-01-01T00:45:00Z") });
    await page.goto("/resources/soul-storm");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "Soul Storm forecast." }),
    ).toBeVisible();
    const toggle = page.getByRole("checkbox", { name: "Show 12-hour clock" });
    const times = page.locator(".storm-table tbody tr").first().locator("time");
    await expect(toggle).not.toBeChecked();
    await expect(times.nth(0)).toHaveText("01:20");
    await expect(times.nth(1)).toHaveText("01:40");
    const start = await times.nth(0).getAttribute("datetime");
    await toggle.check();
    await expect(times.nth(0)).toHaveText("01:20 AM");
    await expect(times.nth(1)).toHaveText("01:40 AM");
    await expect(times.nth(0)).toHaveAttribute("datetime", start!);
    await toggle.uncheck();
    await expect(times.nth(0)).toHaveText("01:20");
    await expect(
      page.getByRole("checkbox", { name: "Notify me on next storm" }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("melee reference supports search, corrected spear stats, jump attacks and source attribution", async ({
  page,
}) => {
  await page.goto("/resources/melee-weapons");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "Melee weapon stats." }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search melee weapons" })
    .fill("spectral");
  await expect(page.locator(".melee-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Inspect Spectral Spear", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Spectral Spear reference" }),
  ).toContainText("51.9");
  const spear = page.getByRole("article", { name: "Spectral Spear reference" });
  await expect(spear).toContainText("Pure jump attack DPS");
  await expect(spear).toContainText("29.7");
  await expect(spear).toContainText("0.740 s");
  await expect(spear).not.toContainText("estimated");
  await page.getByRole("searchbox", { name: "Search melee weapons" }).fill("");
  await page
    .getByRole("combobox", { name: "Sort weapons" })
    .selectOption("jumpDps");
  await expect(page.locator(".melee-table tbody tr").first()).toContainText(
    "54.1",
  );
  await expect(page).toHaveURL(/weapon=Spectral/);
  await expect(
    page.getByRole("checkbox", { name: "Include estimates" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Credit", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search melee weapons" })
    .fill("no such weapon");
  await expect(
    page.getByText("No weapons found.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Hybrid / ruben_elia on Discord" }),
  ).toHaveAttribute("href", /docs.google.com/);
});

test("reference and compare views preserve selection and the catalog picker changes comparison slots", async ({
  page,
}) => {
  await page.goto("/resources/melee-weapons?weapon=Spectral+Spear");
  await page.waitForLoadState("networkidle");
  const designs = page.getByRole("navigation", {
    name: "Melee reference views",
  });
  for (const name of ["Compare", "Reference"]) {
    await designs.getByRole("button", { name: new RegExp(name) }).click();
    await expect(
      designs.getByRole("button", { name: new RegExp(name) }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveURL(/weapon=Spectral/);
  }
  await designs.getByRole("button", { name: /Compare/ }).click();
  await page.getByRole("button", { name: "Choose second weapon" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("searchbox", { name: "Search weapons" })
    .fill("Twilight");
  await dialog
    .getByRole("button", { name: "Select Twilight Dagger for comparison" })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".mr-comparison-table")).toContainText(
    "Pure jump attack DPS",
  );
  await expect(page.locator(".mr-comparison-table")).toContainText("37.8");
  await expect(page).toHaveURL(/against=Twilight/);
  await page.getByRole("button", { name: "Swap sides" }).click();
  await expect(page).toHaveURL(/weapon=Twilight.*against=Spectral/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Choose first weapon" }),
  ).toContainText("Twilight Dagger");
});

test("melee explanations are a visible section below the reference and timing details remain accessible", async ({
  page,
}) => {
  await page.goto("/resources/melee-weapons?weapon=Battlestaff");
  await page.waitForLoadState("networkidle");
  const explanation = page.getByRole("region", {
    name: "Understanding melee attacks",
  });
  await expect(explanation).toBeVisible();
  await expect(
    explanation.getByRole("heading", { name: "Damage, time and DPS" }),
  ).toBeVisible();
  await expect(explanation).toContainText("Both spears deal 58 combo damage");
  await expect(page.locator(".mr-insight-strip")).toHaveCount(0);
  const weapon = page.getByRole("article", { name: "Battlestaff reference" });
  await weapon.locator("summary").click();
  await expect(weapon).toContainText("2.32 s");
  await expect(weapon.getByRole("table")).toContainText("0.588");
  await expect(weapon.getByRole("table")).toBeVisible();
  const referenceBottom = await page
    .locator(".mr-desk")
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const explanationTop = await explanation.evaluate(
    (el) => el.getBoundingClientRect().top,
  );
  expect(explanationTop).toBeGreaterThan(referenceBottom);
});

test("reference and compare views contain horizontal scrolling on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/resources/melee-weapons");
  await page.waitForLoadState("networkidle");
  for (const name of ["Reference", "Compare"]) {
    await page
      .getByRole("navigation", { name: "Melee reference views" })
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
  }
});

test("storm routes preserve region selection, show maps and alternatives, and link to the forecast", async ({
  page,
}) => {
  await page.goto("/resources/soul-storm-routes");
  await page.waitForLoadState("networkidle");
  const regions = page.getByRole("navigation", {
    name: "Choose a storm region",
  });
  await expect(regions.getByRole("link")).toHaveCount(7);
  await regions.getByRole("link", { name: "Frozen Highlands" }).click();
  await expect(page).toHaveURL(/region=frozen-highlands/);
  await expect(
    page.getByRole("heading", { name: "Bring a bow" }),
  ).toBeVisible();
  await expect(
    page.getByText(/sometimes fails to drop its chest/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alternative route" }),
  ).toBeVisible();
  await expect(page.locator(".image-viewer-preview img")).toHaveAttribute(
    "src",
    "/resources/soul-storm-routes/frozen-highlands.png",
  );
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>(
      ".image-viewer-preview img",
    );
    return image?.complete && image.naturalWidth > 0;
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "Frozen Highlands", exact: true }),
  ).toBeVisible();
  await regions.getByRole("link", { name: "Lullaby Hills" }).click();
  await expect(
    page.getByText(/no mobs along that route to collect souls/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View Lullaby Hills route map" })
    .click();
  const viewer = page.getByRole("dialog", { name: "Lullaby Hills route map" });
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(viewer.getByText("150%", { exact: true })).toBeVisible();
  const mapViewport = viewer.getByRole("region", {
    name: "Scrollable route map",
  });
  await expect
    .poll(() =>
      mapViewport.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    )
    .toBe(true);
  const bounds = (await mapViewport.boundingBox())!;
  const beforePan = await mapViewport.evaluate((element) => element.scrollLeft);
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 - 60,
    bounds.y + bounds.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  expect(
    await mapViewport.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(beforePan);

  await expect(page).toHaveURL(/region=lullaby-hills/);
  await viewer.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(viewer.getByText("100%", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Lullaby Hills route map" }),
  ).toBeFocused();
  await expect(
    page.getByText("LordForce on Discord", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Check schedule for each specific location" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Soul Storm forecast." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore farming routes and maps" })
    .click();
  await expect(page).toHaveURL(/soul-storm-routes\?region=/);
});

for (const scenario of [
  { time: "2026-01-01T00:45:00Z", region: "Singer's Meadow" },
  { time: "2026-01-01T01:05:00Z", region: "Rainy Plains" },
]) {
  test(`storm routes default to ${scenario.region} at ${scenario.time}`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(scenario.time) });
    await page.goto("/resources/soul-storm-routes");
    const regions = page.getByRole("navigation", {
      name: "Choose a storm region",
    });
    await expect(
      regions.getByRole("link", { name: scenario.region, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: scenario.region, exact: true }),
    ).toBeVisible();
    const status = page.getByLabel("Current storm status");
    await expect(
      status.getByText(scenario.region, { exact: true }),
    ).toBeVisible();
    await expect(status).toContainText(
      scenario.time === "2026-01-01T00:45:00Z"
        ? "Active · ends in"
        : "No storm active · next starts in",
    );
    await page.goto("/resources/soul-storm-routes?region=honeycomb-fields");
    await expect(
      regions.getByRole("link", { name: "Honeycomb Fields", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });
}

test("storm route status updates while preserving the chosen region", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-01T00:19:50Z") });
  await page.goto("/resources/soul-storm-routes?region=honeycomb-fields");
  const status = page.getByLabel("Current storm status");
  await expect(status).toContainText("Howling Woods");
  await expect(status).toContainText("Active · ends in");
  await page.clock.fastForward(20_000);
  await expect(status).toContainText("Singer's Meadow");
  await expect(status).toContainText("No storm active · next starts in");
  await page.clock.fastForward(20 * 60_000);
  await expect(status).toContainText("Active · ends in");
  await expect(
    page.getByRole("heading", { name: "Honeycomb Fields", exact: true }),
  ).toBeVisible();
});
