import { expect, it } from "vitest";
import { normalizeDetailItem } from "./catalog-detail.loader";
import { itemSeo } from "./catalog-detail.seo";

it("keeps the full equipment name in the target heading and introduction", () => {
  const item = normalizeDetailItem({
    slug: "melee_weapon-prospectors-pick",
    category: "melee_weapon",
    type: "pickaxes",
    variation: "The Prospector's Pick",
    image: null,
    game_data: { slug: "the-prospectors-pick", unique: true },
  });
  const seo = itemSeo(item, []);
  expect(seo.heading).toBe("The Prospector's Pick in Minecraft Dungeons 2");
  expect(seo.title).toBe(`${seo.heading} | MDDEX`);
  expect(seo.introduction).toContain("a unique pickaxe");
  expect(seo.introduction).toContain("The Prospector's Pick");
  expect(seo.introduction).not.toContain("searches");
});

it("distinguishes an artifact from its namesake status effect in search titles", () => {
  const entry = (category: string) =>
    normalizeDetailItem({
      slug: `${category}-blaze-bangle`,
      category,
      type: category,
      variation: "Blaze Bangle",
      image: null,
      game_data: { slug: "blaze-bangle" },
    });
  const artifact = itemSeo(entry("artifact"), []);
  const status = itemSeo(entry("status"), []);
  expect(artifact.heading).toBe(status.heading);
  expect(artifact.title).not.toBe(status.title);
  expect(status.title).toContain("status effect");
  expect(artifact.canonical).not.toBe(status.canonical);
});

it("uses the resolved acquisition sources even when the router catalog is trimmed", () => {
  const item = normalizeDetailItem({
    slug: "armor-alchemist-loafers",
    category: "armor",
    type: "feet",
    variation: "Alchemist Loafers",
    image: null,
    game_data: { sources: [{ name: "Frozen Highlands", type: "area" }] },
  });
  const seo = itemSeo(item, [], 1, [
    { name: "Frozen Highlands", type: "area" },
    {
      name: "Singer's Meadow Dungeons",
      type: "dungeon",
      description: "Unique rarity variant of Sorcerer Boots",
    },
  ]);
  expect(
    seo.sections.find((section) => section.heading.includes("drop"))?.text,
  ).toContain("Singer's Meadow Dungeons");
  expect(
    seo.sections.find((section) => section.heading.includes("drop"))?.text,
  ).toContain("Unique rarity variant of Sorcerer Boots");
});

it("renders published status relationships without treating immunity as an application source", () => {
  const item = normalizeDetailItem({
    slug: "status-frozen",
    category: "status",
    type: "status",
    variation: "Frozen",
    image: null,
    description: "Movement is slowed.",
    game_data: {
      alignment: "negative",
      wikily: {
        gear: [
          {
            title: "Freezing Quiver",
            catalog_slug: "artifact-freezing-quiver",
          },
        ],
        mobs: [{ title: "Stray", catalog_slug: "mob-stray" }],
        immune: [{ title: "Iceologer", catalog_slug: "mob-iceologer" }],
      },
    },
  });
  const seo = itemSeo(item, []);
  expect(
    seo.sections.find((section) => section.heading === "What applies Frozen?")
      ?.text,
  ).toBe("Listed gear includes Freezing Quiver. Listed mobs include Stray.");
  expect(
    seo.sections.find((section) => section.heading.includes("immune"))?.text,
  ).toBe("Published immunities include Iceologer.");
  expect(item.game_data).not.toHaveProperty("wikily");
});

it("uses only the matching cosmetic's published unlock text", () => {
  const item = normalizeDetailItem({
    slug: "pet-blub-pet",
    category: "pet",
    type: "pet",
    variation: "Blub Pet",
    image: null,
    description: "A lost blub follows you.",
    game_data: {
      reference_context: {
        pages: [
          {
            cards: [
              { name: "Hero Cape", text: "Unlocked by a different promotion." },
              {
                name: "Blub Pet",
                text: "A lost blub follows you. Unlocked with the Deluxe Edition.",
              },
            ],
          },
        ],
      },
    },
  });
  expect(itemSeo(item, []).sections).toContainEqual({
    heading: "How do I unlock Blub Pet?",
    text: "Unlocked with the Deluxe Edition.",
  });
  expect(item.game_data).not.toHaveProperty("reference_context");
});
