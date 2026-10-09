import { test, expect } from "@playwright/test";
import graph from "./fixtures/quests.json" with { type: "json" };
const location = {
  slug: "location-brave-haven",
  category: "location",
  type: "location",
  variation: "Brave Haven",
  image: null,
  detail_path: "details/brave-haven.json",
  game_data: { slug: "brave-haven" },
};
const catalog = [
  location,
  {
    ...location,
    slug: "location-other",
    variation: "Other",
    detail_path: "details/other.json",
  },
  {
    slug: "armor-mystic-robe",
    category: "armor",
    type: "chest",
    variation: "Mystic Robe",
    image: null,
    game_data: { slug: "mystic-robe" },
  },
];
for (const mobile of [false, true])
  test(`quest graph explores published branches and walkthroughs on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const shards: string[] = [];
    await page.route("**/latest.json", (route) =>
      route.fulfill({
        json: {
          catalogVersion: "quests-v1",
          manifest: "releases/quests-v1/manifest.json",
          catalogIndex: "releases/quests-v1/catalog-index.json",
        },
      }),
    );
    await page.route("**/releases/quests-v1/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("catalog-index.json"))
        return route.fulfill({ json: catalog });
      shards.push(url);
      if (url.endsWith("details/brave-haven.json"))
        return route.fulfill({
          json: {
            ...location,
            game_data: { ...location.game_data, quest_graph: graph },
          },
        });
      return route.abort();
    });
    await page.goto("/resources");
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("searchbox", { name: "Search resources" })
      .fill("quest");
    await expect(page.locator(".resource-card")).toHaveCount(1);
    await page.getByRole("link", { name: /Quest graph/ }).click();
    await expect(page.locator(".quest-graph-canvas")).toHaveAttribute(
      "data-orientation",
      mobile ? "vertical" : "horizontal",
    );
    await expect(page.locator(".quest-node")).toHaveCount(4);
    await expect(page.locator(".quest-edges > g > path")).toHaveCount(4);
    const viewSwitch = page.getByRole("navigation", { name: "Quest view" });
    const showDetails = () =>
      viewSwitch.getByRole("button", { name: "Details", exact: true }).click();
    const showGraph = () =>
      viewSwitch.getByRole("button", { name: "Graph", exact: true }).click();
    await expect(page.locator("#quest-details")).toBeHidden();
    const search = page.getByRole("searchbox", { name: "Find a quest" });
    await search.fill("Cartographer");
    await expect(
      page.getByRole("region", { name: "Matching quests" }),
    ).toContainText("1 matching quests");
    await page
      .getByRole("region", { name: "Matching quests" })
      .getByRole("button", { name: "The Lost Merchant", exact: true })
      .click();
    await expect(page).toHaveURL(/quest=merchant/);
    const details = page.locator("#quest-details");
    await expect(page.locator(".quest-graph-canvas")).toHaveCSS(
      "transform",
      "none",
    );
    await expect(page.locator(".quest-graph-canvas")).toHaveCSS(
      "will-change",
      "auto",
    );
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(page.locator(".quest-node strong").first()).toHaveCSS(
      "font-size",
      "16.1px",
    );
    await page.getByRole("button", { name: "Reset zoom", exact: true }).click();

    const cameraBeforeSwitch = await page
      .locator(".quest-graph-canvas")
      .getAttribute("style");
    await showDetails();
    await expect(page.locator("#quest-graph")).toBeHidden();
    await expect(details).toBeVisible();
    await expect(
      viewSwitch.getByRole("button", { name: "Details", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      details.getByRole("heading", { name: "The Lost Merchant", exact: true }),
    ).toBeVisible();
    await showGraph();
    await expect(details).toBeHidden();
    await expect(page.locator("#quest-graph")).toBeVisible();
    await expect(page.locator(".quest-graph-canvas")).toHaveAttribute(
      "style",
      cameraBeforeSwitch!,
    );
    await expect(viewSwitch).toBeInViewport();
    await showDetails();
    await expect(page.getByRole("dialog", { name: "Objectives" })).toHaveCount(
      0,
    );
    await details.getByRole("button", { name: /View objectives/ }).click();
    const objectives = page.getByRole("dialog", { name: "Objectives" });
    await expect(objectives).toBeVisible();
    const panelBounds = await objectives.boundingBox();
    const detailsBounds = await details.boundingBox();
    expect(panelBounds!.x).toBeGreaterThanOrEqual(detailsBounds!.x);
    expect(panelBounds!.y).toBeGreaterThanOrEqual(detailsBounds!.y);
    expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(
      detailsBounds!.x + detailsBounds!.width,
    );
    expect(panelBounds!.y + panelBounds!.height).toBeLessThanOrEqual(
      detailsBounds!.y + detailsBounds!.height,
    );
    await expect(objectives).not.toHaveAttribute("aria-modal", "true");
    await expect(objectives.locator(".quest-objectives")).toHaveCSS(
      "list-style-type",
      "decimal",
    );
    await expect(objectives).toContainText("Find the merchant");
    await expect(objectives).not.toContainText("Speak to the merchant");
    await page.keyboard.press("Escape");
    await expect(objectives).toHaveCount(0);
    await expect(
      details.getByRole("button", { name: /View objectives/ }),
    ).toBeFocused();
    await expect(details.locator(".quest-detail-heading")).toContainText(
      "Core Quest · №2 · lvl 2",
    );
    await expect(
      details.getByText("Recommended level", { exact: true }),
    ).toHaveCount(0);
    await expect(
      details.getByRole("img", { name: "Repeatable", exact: true }),
    ).toHaveCount(0);
    await expect(details).not.toContainText("Minimum level");
    await expect(
      details.getByRole("heading", { name: "Location", exact: true }),
    ).toBeVisible();
    await expect(details).not.toContainText("Wikily");
    await expect(details).not.toContainText("Metabot");
    await expect(details).not.toContainText("Source differences");
    await expect(
      details.getByRole("link", { name: /walkthrough/i }),
    ).toHaveCount(0);
    await expect(details.locator(".quest-reward-pool")).toContainText(
      "1 of 2 drop",
    );
    await expect(
      details.locator(".quest-reward-pool .quest-reward-cards > li"),
    ).toHaveCount(2);
    await expect(
      details.getByRole("link", { name: "Mystic Robe" }),
    ).toHaveAttribute("href", "/catalog/armor/mystic-robe");
    await details
      .getByRole("button", { name: "The Final Souldown", exact: true })
      .click();
    await expect(details).toContainText("whether all or any");
    await expect(page.locator(".quest-edge-ancestor")).toHaveCount(4);
    await showGraph();
    await search.fill("not a quest");
    await expect(page.getByRole("status")).toContainText("0 matching quests");
    await search.fill("");
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Reset zoom", exact: true }),
    ).toHaveText("85%");
    await page
      .getByRole("button", { name: "Fit graph width", exact: true })
      .click();
    await expect
      .poll(() =>
        page.locator(".quest-node").evaluateAll((nodes) => {
          const view = document
            .querySelector(".quest-graph-viewport")!
            .getBoundingClientRect();
          return nodes.every((node) => {
            const rect = node.getBoundingClientRect();
            return (
              rect.left >= view.left - 1 &&
              rect.right <= view.right + 1 &&
              rect.top >= view.top - 1 &&
              rect.bottom <= view.bottom + 1
            );
          });
        }),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole("group", { name: "Graph design" })).toHaveCount(
      0,
    );
    await expect(page.locator(".quest-graph-canvas")).toHaveAttribute(
      "data-design",
      "metro",
    );
    await expect(page.locator(".quest-location-unlock")).toHaveCount(0);
    await showDetails();
    await details
      .getByRole("button", { name: "The Lost Merchant", exact: true })
      .click();
    await showGraph();
    await expect(page.locator(".quest-node")).toHaveCount(4);
    await page
      .getByRole("button", { name: "Fit graph width", exact: true })
      .click();
    const graphView = page.locator(".quest-graph-viewport");
    await graphView.scrollIntoViewIfNeeded();
    const bounds = await graphView.boundingBox();
    const panY = Math.min(
      bounds!.y + bounds!.height - 25,
      await page.evaluate(() => innerHeight - 45),
    );
    const canvas = page.locator(".quest-graph-canvas");
    const beforePan = await canvas.getAttribute("style");
    await page.mouse.move(bounds!.x + 20, panY);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + 100, panY - 40, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(canvas).not.toHaveAttribute("style", beforePan!);
    const beforeWheel = await canvas.getAttribute("style");
    await page.mouse.wheel(0, -160);
    await expect(canvas).not.toHaveAttribute("style", beforeWheel!);
    if (mobile) {
      await page
        .getByRole("button", { name: "Reset zoom", exact: true })
        .click();
      const touch = await page.context().newCDPSession(page);
      await touch.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 2,
      });
      const box = await graphView.boundingBox();
      const x = box!.x + box!.width / 2,
        y = Math.min(
          box!.y + box!.height / 2,
          await page.evaluate(() => innerHeight - 80),
        );
      const beforeTouch = await canvas.getAttribute("style");
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + 30, y: y + 20, id: 1 }],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(canvas).not.toHaveAttribute("style", beforeTouch!);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: x - 40, y, id: 1 },
          { x: x + 40, y, id: 2 },
        ],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x - 70, y, id: 1 },
          { x: x + 70, y, id: 2 },
        ],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(
        page.getByRole("button", { name: "Reset zoom", exact: true }),
      ).not.toHaveText("100%");
      await touch.detach();
    }
    const beforeMap = await canvas.getAttribute("style");
    await page
      .getByRole("button", { name: "Navigate graph overview", exact: true })
      .click();
    await expect(canvas).not.toHaveAttribute("style", beforeMap!);
    expect(shards).toHaveLength(1);
    await page.goBack();
    await page.goForward();
    await showGraph();
    await expect(page.locator(".quest-node")).toHaveCount(4);
    expect(shards).toHaveLength(1);
  });
test("quest graph loading failure can retry without affecting local saves", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/latest.json", (route) =>
    route.fulfill({
      json: {
        catalogVersion: "quests-retry",
        manifest: "releases/quests-retry/manifest.json",
        catalogIndex: "releases/quests-retry/catalog-index.json",
      },
    }),
  );
  await page.route("**/catalog-index.json", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.route("**/details/brave-haven.json", (route) =>
    failed
      ? route.fulfill({ status: 503, body: "unavailable" })
      : route.fulfill({
          json: {
            ...location,
            game_data: { ...location.game_data, quest_graph: graph },
          },
        }),
  );
  await page.goto("/resources");
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox", { name: "Search resources" }).fill("quest");
  await expect(page.locator(".resource-card")).toHaveCount(1);
  await page.evaluate(() => localStorage.setItem("quest-save-marker", "keep"));
  await page.getByRole("link", { name: /Quest graph/ }).click();
  await expect(
    page.getByRole("heading", { name: "Quest graph unavailable" }),
  ).toBeVisible();
  failed = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".quest-node")).toHaveCount(4);
  expect(
    await page.evaluate(() => localStorage.getItem("quest-save-marker")),
  ).toBe("keep");
});
