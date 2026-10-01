import { expect, it } from "vitest";
import {
  applicableEffects,
  questRewardNames,
  locationMetadata,
} from "./catalog-detail.enrichment";
import { dropSources } from "./catalog-detail.model";
import { normalizeDetailItem } from "./catalog-detail.loader";
const item = (
  slug: string,
  category: string,
  game_data: Record<string, unknown> = {},
) =>
  normalizeDetailItem({
    slug,
    category,
    type: category,
    variation: slug,
    image: null,
    game_data,
  });
it("merges acquisition metadata into existing sources without losing conditions during reverse-drop deduplication", () => {
  const gear = item("totem", "artifact", {
    sources: [{ name: "Plains", type: "area", catalog_slug: "plains" }],
    acquisition: {
      sources: [
        {
          name: "Plains",
          type: "area",
          catalog_slug: "plains",
          condition: "When Greataxe drops with Unique rarity",
        },
        { name: "Merchant", type: "merchant", condition: "After the unlock" },
        {
          name: "Dungeon",
          type: "dungeon",
          condition: "Unique rarity variant of Greataxe",
          entrance_area: "Plains",
          destination: "Deep Dark",
          probability: "10%",
        },
        { name: "Quest story", type: "quest", condition: "Long narrative" },
        {
          name: "Witch",
          type: "mob",
          catalog_slug: "witch",
          condition: "During a storm",
        },
      ],
    },
  });
  const witch = item("witch", "mob", { drops: [{ catalog_slug: "totem" }] });
  const sources = dropSources(gear, [witch]);
  expect(sources.filter((source) => source.catalog_slug === "plains")).toEqual([
    {
      name: "Plains",
      type: "area",
      catalog_slug: "plains",
      description: "Unique rarity variant of Greataxe",
    },
  ]);
  expect(sources.find((source) => source.type === "dungeon")?.description).toBe(
    "Unique rarity variant of Greataxe Drop chance: 10%",
  );
  expect(
    sources.find((source) => source.type === "merchant")?.description,
  ).toBe("After the unlock");
  expect(
    sources.find((source) => source.catalog_slug === "witch")?.description,
  ).toBe("During a storm");
  expect(sources.some((source) => source.type === "quest")).toBe(false);
});
it("merges location loot/books and mob conditions into existing references and keeps only local facilities", () => {
  const location = item("plains", "location", {
    loot: [{ name: "Sword", catalog_slug: "sword" }],
    mobs: [{ name: "Witch", catalog_slug: "witch" }],
    wikily: {
      region: "Overworld",
      nDungeon: 9,
      nRift: 10,
      nStations: 5,
      gear: [{ title: "Sword", catalog_slug: "sword" }],
      books: [
        {
          title: "Fire Aspect",
          catalog_slug: "fire",
          subtitle: "Enchantment book",
        },
      ],
      mobs: [
        { title: "Witch", catalog_slug: "witch", subtitle: "During a storm" },
      ],
      merchants: [{ title: "Town Merchant", subtitle: "After Wading Plains" }],
      stations: [{ title: "Puddle Station" }],
      entries: [{ title: "Plains Dungeons", subtitle: "9 entrances" }],
      quests: [{ title: "Unwanted story" }],
    },
    location_context: {
      instances: [
        {
          name: "Plains Dungeons",
          levels: [{ title: "Defeat the boss", subtitle: "1 of 4 levels" }],
        },
      ],
      quest_directory: [{ name: "Every quest" }],
      maps: [{ name: "Every map" }],
    },
  });
  const metadata = locationMetadata(location, [item("witch", "mob")]);
  expect(metadata.loot.map((entry) => entry.catalog_slug)).toEqual([
    "sword",
    "fire",
  ]);
  expect(metadata.mobs[0].description).toBe("During a storm");
  expect(metadata.merchants[0].description).toBe("After Wading Plains");
  expect(metadata.entrances[0].description).toBe(
    "9 entrances Defeat the boss: 1 of 4 levels",
  );
  expect(metadata.region).toBe("Overworld");
  expect(metadata.dungeonCount).toBe(9);
  expect(JSON.stringify(metadata)).not.toContain("Every quest");
});
it("keeps applicable effects linked to canonical identities without publishing unrelated detail", () => {
  const gear = item("totem", "artifact", {
    rollable_effects: {
      effects: [{ name: "Cooldown", catalog_slug: "cooldown" }],
    },
    quest_context: [{ name: "Story" }],
  });
  expect(applicableEffects(gear)).toEqual([
    { name: "Cooldown", catalog_slug: "cooldown", description: undefined },
  ]);
});

it("names only reward quests and deduplicates acquisition evidence", () => {
  const gear = item("hardhat", "armor", {
    sources: [{ type: "quest", name: "Quest reward" }],
    acquisition: {
      sources: [
        { type: "quest", name: "Keeper of the Bees" },
        {
          type: "quest",
          name: "Keeper of the Bees",
          trigger: "first_completion",
        },
      ],
    },
    quest_context: [
      {
        name: "Keeper of the Bees",
        rewards: { first_completion: [{ catalog_slug: "hardhat" }] },
      },
      {
        name: "Unrelated prerequisite",
        rewards: { all: [{ catalog_slug: "other" }] },
      },
      {
        name: "Second reward quest",
        rewards: { all: [{ catalog_slug: "hardhat" }] },
      },
    ],
  });
  expect(questRewardNames(gear)).toEqual([
    "Keeper of the Bees",
    "Second reward quest",
  ]);
});

it("omits unused published guides from detail payloads while preserving visible location and quest metadata", () => {
  const location = item("plains", "location", {
    reference_context: { enormous: "Unused guide" },
    map_context: { routes: "Unused map" },
    wikily: {
      lead: "Local overview",
      gear: [{ name: "Sword", catalog_slug: "sword" }],
      objectives: ["Unused story"],
    },
    location_context: {
      quest_directory: ["Unused global directory"],
      source_details: [],
      instances: [
        {
          name: "Dungeon",
          levels: [{ name: "Level 1", description: "Find the exit" }],
          objectives: ["Unused story"],
        },
      ],
    },
    quest_context: [
      {
        name: "Reward quest",
        rewards: { all: [{ catalog_slug: "plains" }] },
        native: { lead: "Unused story" },
      },
    ],
  });
  expect(location.game_data).not.toHaveProperty("reference_context");
  expect(location.game_data).not.toHaveProperty("map_context");
  expect(location.game_data).not.toHaveProperty("wikily.objectives");
  expect(location.game_data).not.toHaveProperty(
    "location_context.quest_directory",
  );
  expect(questRewardNames(location)).toEqual(["Reward quest"]);
  expect(locationMetadata(location, []).loot).toEqual([
    { name: "Sword", catalog_slug: "sword", description: undefined },
  ]);
  expect(locationMetadata(location, []).entrances[0].description).toBe(
    "Level 1: Find the exit",
  );
});
