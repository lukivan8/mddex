import { expect, test } from "@playwright/test";
import { emptyBuild } from "../src/features/builds/build.service";
import type { BuildSlot } from "../src/features/builds/build.types";

const equipment: { slot: BuildSlot; name: string; category: string }[] = [
  {
    slot: "melee",
    name: "Prime Enchanter's Gauntlets",
    category: "melee_weapon",
  },
  { slot: "ranged", name: "The Close Ranger", category: "ranged_weapon" },
  { slot: "head", name: "Oracle Crown", category: "armor" },
  { slot: "torso", name: "Scoundrel Blazer", category: "armor" },
  { slot: "legs", name: "Sage Belt", category: "armor" },
  { slot: "feet", name: "Dreamruler Slippers", category: "armor" },
  { slot: "artifact1", name: "Conductive Quiver", category: "artifact" },
  { slot: "artifact2", name: "Fighter's Flute", category: "artifact" },
  { slot: "artifact3", name: "Warrior Drums", category: "artifact" },
  { slot: "talisman1", name: "Essence of Efficiency", category: "talisman" },
];

for (const width of [320, 390, 520]) {
  test(`equipment names and controls fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const build = emptyBuild("Mobile layout");
    for (const { slot } of equipment)
      build.slots[slot] = {
        itemSlug: slot,
        enchantments: [slot],
        effects: [slot],
      };
    await page.addInitScript((saved) => {
      localStorage.setItem(
        "mddex.builds.v3",
        JSON.stringify({
          ["s:" + saved.id]: { versionKey: "mobile-layout", data: saved },
        }),
      );
    }, build);
    await page.route("**/latest.json", (route) =>
      route.fulfill({
        json: {
          catalogVersion: "mobile-layout",
          manifest: "releases/mobile-layout/manifest.json",
        },
      }),
    );
    await page.route("**/catalog.json", (route) =>
      route.fulfill({
        json: equipment.map(({ slot, name, category }) => ({
          slug: slot,
          variation: name,
          category,
          type: category,
          image:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26'%3E%3Crect width='26' height='26' fill='%2366ccff'/%3E%3C/svg%3E",
          game_data:
            category === "talisman"
              ? {
                  levels: [1, 2, 3].map((level) => ({
                    level,
                    effects: [
                      { text: "Reduces rolling cooldown time by 45%." },
                    ],
                  })),
                }
              : undefined,
        })),
      }),
    );
    await page.goto("/build");
    await expect(page.locator(".gear-name").first()).toHaveText(
      "Prime Enchanter's Gauntlets",
    );
    const issues = await page.locator(".build-board").evaluate((board) => {
      const failures: string[] = [];
      for (const card of board.querySelectorAll<HTMLElement>(".gear-slot")) {
        const name = card.querySelector<HTMLElement>(".gear-name")!;
        const art = card.querySelector<HTMLElement>(".gear-art")!;
        const label = card.querySelector<HTMLElement>(".eyebrow")!;
        const clear = card.querySelector<HTMLElement>(".gear-clear");
        const bounds = card.getBoundingClientRect();
        const nameBounds = name.getBoundingClientRect();
        const hideLabel =
          innerWidth <= 360 && card.classList.contains("equipped");
        if ((getComputedStyle(label).display === "none") !== hideLabel)
          failures.push(`Incorrect slot label visibility: ${name.textContent}`);
        for (const modifier of card.querySelectorAll(".modifier-button")) {
          const buttonBounds = modifier.getBoundingClientRect();
          const iconBounds = modifier
            .querySelector(".modifier-art")!
            .getBoundingClientRect();
          if (
            Math.abs(
              buttonBounds.left +
                buttonBounds.right -
                (iconBounds.left + iconBounds.right),
            ) > 1 ||
            Math.abs(
              buttonBounds.top +
                buttonBounds.bottom -
                (iconBounds.top + iconBounds.bottom),
            ) > 1
          )
            failures.push(`Modifier icon is off center: ${name.textContent}`);
          if (iconBounds.width > buttonBounds.width - 2)
            failures.push(`Modifier icon exceeds button: ${name.textContent}`);
        }
        if (nameBounds.top < art.getBoundingClientRect().bottom)
          failures.push(`Name squeezed beside artwork: ${name.textContent}`);
        if (nameBounds.width < bounds.width - 24)
          failures.push(`Name does not use card width: ${name.textContent}`);
        if (card.scrollWidth > card.clientWidth)
          failures.push(`Card overflows: ${name.textContent}`);
        if (getComputedStyle(name).minHeight !== "0px")
          failures.push(`Name reserves empty lines: ${name.textContent}`);
        if (card.closest(".artifact-slots")) {
          const modifiers = card.querySelector(".gear-modifiers")!;
          if (modifiers.getBoundingClientRect().top - nameBounds.bottom > 11)
            failures.push(`Empty space above modifiers: ${name.textContent}`);
        }
        if (clear) {
          const labelRange = document.createRange();
          labelRange.selectNodeContents(label);
          const clearBounds = clear.getBoundingClientRect();
          if (
            Array.from(labelRange.getClientRects()).some(
              (rect) =>
                rect.right > clearBounds.left &&
                rect.left < clearBounds.right &&
                rect.bottom > clearBounds.top &&
                rect.top < clearBounds.bottom,
            )
          )
            failures.push(
              `Slot label overlaps clear button: ${name.textContent}`,
            );
        }
        // Each individual word must stay on one line, including the long words
        // that were split across several lines in the reported screenshot.
        const text = name.firstChild;
        if (text?.nodeType === Node.TEXT_NODE) {
          for (const match of text.textContent!.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(text, match.index!);
            range.setEnd(text, match.index! + match[0].length);
            if (
              new Set(
                Array.from(range.getClientRects(), (rect) =>
                  Math.round(rect.top),
                ),
              ).size > 1
            )
              failures.push(`Word split: ${match[0]}`);
          }
        }
      }
      return failures;
    });
    expect(issues).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const columns = await page.locator(".trinket-slots").evaluateAll((groups) =>
      groups.map((group) => ({
        bounds: group.getBoundingClientRect().toJSON(),
        cards: Array.from(group.children, (card) =>
          card.getBoundingClientRect().toJSON(),
        ),
      })),
    );
    const [artifacts, talismans] = columns;
    expect(artifacts.bounds.top).toBe(talismans.bounds.top);
    expect(artifacts.bounds.right).toBeLessThan(talismans.bounds.left);
    for (const column of columns) {
      for (let i = 0; i < column.cards.length; i++) {
        expect(column.cards[i].left).toBe(column.bounds.left);
        expect(column.cards[i].width).toBe(column.bounds.width);
        if (i > 0)
          expect(column.cards[i].top - column.cards[i - 1].bottom).toBe(8);
      }
    }
    // Different card heights must not force the two stacks into shared rows.
    expect(artifacts.cards[1].top).not.toBe(talismans.cards[1].top);
    await page.screenshot({
      path: test.info().outputPath("mobile-loadout.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Clear Artifact 1", exact: true })
      .click();
    await expect(page.locator(".artifact-slots .gear-name").first()).toHaveText(
      "Choose item",
    );
    await page
      .getByRole("button", { name: "Choose Talisman 2", exact: true })
      .click();
    const result = page
      .locator(".picker-result-row")
      .filter({ hasText: "Essence of Efficiency" });
    await expect(result.locator(".picker-tiers")).toBeVisible();
    for (const selected of [true, false]) {
      await expect(result.locator(".picker-result")).toHaveAttribute(
        "aria-pressed",
        String(selected),
      );
      const geometry = await result.evaluate((row) => {
        const name = row
          .querySelector(".picker-result-name")!
          .getBoundingClientRect();
        const tiers = row
          .querySelector(".picker-tiers")!
          .getBoundingClientRect();
        const check = row
          .querySelector(".picker-result-name svg")
          ?.getBoundingClientRect();
        const art = row.querySelector(".picker-art")!.getBoundingClientRect();
        return {
          width: name.width,
          cardWidth: row.getBoundingClientRect().width,
          gap: name.top - art.bottom,
          belowTiers: name.top >= tiers.bottom,
          checkFits:
            !check || (check.right < tiers.left && check.bottom <= name.top),
        };
      });
      expect(geometry.width).toBeGreaterThanOrEqual(geometry.cardWidth - 30);
      expect(geometry.gap).toBeGreaterThanOrEqual(5);
      expect(geometry.gap).toBeLessThanOrEqual(7);
      expect(geometry.belowTiers).toBe(true);
      expect(geometry.checkFits).toBe(true);
      if (selected) await result.locator(".picker-result").click();
    }
    await result
      .getByRole("button", {
        name: "Select Essence of Efficiency tier III",
        exact: true,
      })
      .click();
    await expect(result.locator(".picker-result")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      result.getByRole("button", {
        name: "Select Essence of Efficiency tier III",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: test.info().outputPath("mobile-picker.png"),
    });
    await expect(page.locator(".picker-results")).toHaveCSS(
      "grid-template-columns",
      /^\S+$/,
    );
    if (width === 320) {
      for (const modalWidth of [600, 768, 900, 1365]) {
        await page.setViewportSize({ width: modalWidth, height: 980 });
        await expect(page.locator(".picker-results")).toHaveCSS(
          "grid-template-columns",
          /^\S+$/,
        );
      }
    }
  });
}
