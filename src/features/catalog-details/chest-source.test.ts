import { expect, it } from "vitest";
import { normalizeDetailItem } from "./catalog-detail.loader";
import {
  dropSources,
  isChestTalisman,
  talismanAcquisitionNotes,
} from "./catalog-detail.model";
import { itemSeo } from "./catalog-detail.seo";
import { isSecretTalisman } from "../catalog/catalog.helpers";
import {
  getCatalogItemView,
  getVisibleItemViews,
} from "../collection/collection.presentation";

it.each(["Ocelot's Paw", "Soul Chip"])(
  "shows chest acquisition for %s despite its quest source",
  (name) => {
    const item = normalizeDetailItem({
      slug: name,
      category: "talisman",
      type: "talisman",
      variation: name,
      image: null,
      game_data: {
        sources: [
          { type: "quest", name: "Quest reward" },
          { type: "chest", name: "Talisman chest" },
        ],
      },
    });
    expect(isChestTalisman(item)).toBe(true);
    expect(itemSeo(item, []).sections).toContainEqual({
      heading: `Where can ${name} drop?`,
      text: "Found in chests",
    });
    item.game_data.sources = [{ type: "quest", name: "Quest reward" }];
    expect(isChestTalisman(item)).toBe(false);
  },
);

it("displays new chest directions and preserves secret location evidence through detail trimming", () => {
  const directions =
    "Inside a rift, find the interactable breakable wall and open it to reach the hidden talisman.";
  const location =
    "A talisman chest in one of the rooms the rift levels of The Sift can be built from (not in every run)";
  const published = {
    slug: "talisman-ocelot-s-paw",
    category: "talisman",
    type: "talisman",
    variation: "Ocelot's Paw",
    image: null,
    game_data: {
      sources: [{ type: "chest", name: directions }],
      wikily: { kind: "Secret Talisman", where: "Found in a rift chest." },
      reference_context: {
        pages: [
          {
            kind: "secret-talismans",
            cards: [
              { name: "Soul Chip", text: "A chest in the Ravines" },
              { name: "Ocelot's Paw", text: location },
            ],
          },
        ],
      },
    },
  };
  const item = normalizeDetailItem(published);
  expect(item.game_data).not.toHaveProperty("wikily");
  expect(item.game_data).not.toHaveProperty("reference_context");
  expect(isChestTalisman(item)).toBe(true);
  expect(isSecretTalisman(item)).toBe(true);
  expect(talismanAcquisitionNotes(item)).toEqual([location, directions]);
  const seo = itemSeo(item, []);
  expect(seo.introduction).toContain("a secret talisman");
  expect(
    seo.sections.find((section) => section.heading.includes("drop"))?.text,
  ).toBe(`${location} ${directions}`);
  const view = getCatalogItemView(published);
  expect(view.secretTalisman).toBe(true);
  expect(getVisibleItemViews([view], { q: "secret talisman" })).toEqual([view]);
});

it("keeps location links alongside chest directions and falls back to acquisition text", () => {
  const item = normalizeDetailItem({
    slug: "talisman-amethyst-lens",
    category: "talisman",
    type: "talisman",
    variation: "Amethyst Lens",
    image: null,
    game_data: {
      sources: [{ type: "chest", name: "Climb the waterfall." }],
      acquisition: {
        source_text: "Found in Howling Woods.",
        sources: [
          {
            type: "area",
            name: "Howling Woods",
            catalog_slug: "location-howling-woods",
          },
        ],
      },
    },
  });
  expect(talismanAcquisitionNotes(item)).toEqual([
    "Found in Howling Woods.",
    "Climb the waterfall.",
  ]);
  expect(dropSources(item, [])).toContainEqual(
    expect.objectContaining({ catalog_slug: "location-howling-woods" }),
  );
});

it("does not mark quest and mob reward talismans as secret or add secret acquisition text", () => {
  for (const type of ["quest", "mob"]) {
    const item = normalizeDetailItem({
      slug: "talisman-normal",
      category: "talisman",
      type: "talisman",
      variation: "Normal Talisman",
      image: null,
      game_data: {
        sources: [{ type, name: "Reward" }],
        wikily: { kind: "Talisman", where: "Reward for completing a quest." },
        acquisition: { source_text: "Reward for completing a quest." },
      },
    });
    expect(isSecretTalisman(item)).toBe(false);
    expect(isChestTalisman(item)).toBe(false);
    expect(item.game_data).not.toHaveProperty("talismanAcquisition");
    expect(talismanAcquisitionNotes(item)).toEqual([]);
  }
});
