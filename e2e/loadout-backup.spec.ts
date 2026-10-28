import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { emptyBuild } from "../src/features/builds/build.service";
import { exportLoadouts } from "../src/features/builds/build.backup";

for (const mobile of [false, true]) {
  test(`twenty loadouts transfer as a file without replacing destination saves (${mobile ? "mobile" : "desktop"})`, async ({
    page,
    context,
    browser,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const source = Array.from({ length: 20 }, (_, i) => {
      const b = emptyBuild(`Loadout ${i + 1}`, `source-${i}`);
      b.slots.melee = {
        itemSlug: "unknown-weapon",
        power: 154,
        enchantments: ["unknown-enchantment"],
        enchantmentTier: "III",
        effects: ["unknown-effect"],
        effectTiers: ["IV"],
      };
      b.variants = [
        { id: "boss", name: "Boss variant", slots: structuredClone(b.slots) },
      ];
      return b;
    });
    await context.addInitScript((builds) => {
      if (!localStorage.getItem("mddex.builds.v3"))
        localStorage.setItem(
          "mddex.builds.v3",
          JSON.stringify(
            Object.fromEntries(
              builds.map((b) => ["s:" + b.id, { versionKey: "seed", data: b }]),
            ),
          ),
        );
    }, source);
    await context.route("**/latest.json", (r) =>
      r.fulfill({
        json: {
          catalogVersion: "test",
          manifest: "releases/test/manifest.json",
        },
      }),
    );
    await context.route("**/catalog.json", (r) => r.fulfill({ json: [] }));
    await page.goto("/build");
    await page
      .getByRole("button", { name: "Saved loadouts", exact: true })
      .click();
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export all loadouts", exact: true })
      .click();
    const download = await downloaded;
    const path = await download.path();
    expect(path).toBeTruthy();
    const bytes = await readFile(path!);
    expect(JSON.parse(bytes.toString()).builds).toHaveLength(20);
    // A second browser context has its own local saves, just as another
    // browser or website origin would. It receives only the downloaded file.
    const destinationContext = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
    });
    await destinationContext.addInitScript((builds) => {
      if (!localStorage.getItem("mddex.builds.v3"))
        localStorage.setItem(
          "mddex.builds.v3",
          JSON.stringify(
            Object.fromEntries(
              builds.map((b) => ["s:" + b.id, { versionKey: "seed", data: b }]),
            ),
          ),
        );
    }, source);
    await destinationContext.route("**/latest.json", (r) =>
      r.fulfill({
        json: {
          catalogVersion: "test",
          manifest: "releases/test/manifest.json",
        },
      }),
    );
    await destinationContext.route("**/catalog.json", (r) =>
      r.fulfill({ json: [] }),
    );
    const destination = await destinationContext.newPage();
    await destination.goto("http://localhost:3100/build");
    await destination.evaluate(() => {
      const key = "mddex.builds.v3";
      const records = JSON.parse(localStorage.getItem(key)!);
      const first = Object.values(records)[0] as { data: { name: string } };
      first.data.name = "Keep destination";
      localStorage.setItem(key, JSON.stringify(records));
    });
    await destination.reload();
    await destination
      .getByRole("button", { name: "Saved loadouts", exact: true })
      .click();
    await destination.getByLabel("Loadout backup file").setInputFiles({
      name: "loadouts.json",
      mimeType: "application/json",
      buffer: bytes,
    });
    await expect(
      destination.getByText("20 loadouts ready to import", { exact: false }),
    ).toBeVisible();
    const before = await destination.evaluate(() =>
      localStorage.getItem("mddex.builds.v3"),
    );
    await destination
      .getByRole("button", { name: "Cancel import", exact: true })
      .click();
    expect(
      await destination.evaluate(() => localStorage.getItem("mddex.builds.v3")),
    ).toBe(before);
    await destination.getByLabel("Loadout backup file").setInputFiles({
      name: "loadouts.json",
      mimeType: "application/json",
      buffer: bytes,
    });
    await destination
      .getByRole("button", { name: "Import 20 loadouts", exact: true })
      .click();
    // The other origin was independently seeded with the same IDs: one changed
    // destination record is retained, nineteen exact matches are skipped.
    await expect(
      destination.getByText(
        "Imported 1 loadouts. 19 already here. 1 kept as copies.",
        { exact: true },
      ),
    ).toBeVisible();
    const saved = await destination.evaluate(() =>
      Object.values(JSON.parse(localStorage.getItem("mddex.builds.v3")!)).map(
        (r) => (r as { data: unknown }).data,
      ),
    );
    expect(saved).toHaveLength(21);
    expect(saved).toContainEqual(
      expect.objectContaining({ name: "Keep destination" }),
    );
    expect(saved).toContainEqual(
      expect.objectContaining({
        name: "Loadout 1",
        variants: source[0].variants,
        slots: source[0].slots,
      }),
    );
    await destination.reload();
    await destination
      .getByRole("button", { name: "Saved loadouts", exact: true })
      .click();
    await destination.getByLabel("Loadout backup file").setInputFiles({
      name: "loadouts.json",
      mimeType: "application/json",
      buffer: bytes,
    });
    await destination
      .getByRole("button", { name: "Import 20 loadouts", exact: true })
      .click();
    await expect(
      destination.getByText(
        "Imported 0 loadouts. 20 already here. 0 kept as copies.",
        { exact: true },
      ),
    ).toBeVisible();
    await destination.getByLabel("Loadout backup file").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        exportLoadouts(source).replace('"version": 1', '"version": 999'),
      ),
    });
    await expect(destination.getByRole("alert")).toContainText(
      "not a supported MDDEX",
    );
    await destinationContext.close();
  });
}
