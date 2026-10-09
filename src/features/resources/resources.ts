export type ResourceCategory = "Tools" | "References";
export type Resource = {
  title: string;
  category: ResourceCategory;
  description: string;
  credit: {
    name: string;
    url?: string;
    links?: readonly { label: string; url: string }[];
    contribution: string;
  };
} & (
  | {
      path:
        | "/resources/item-tracker"
        | "/resources/item-tracker-cards"
        | "/resources/item-tracker-list"
        | "/resources/item-tracker-rarities"
        | "/resources/soul-storm"
        | "/resources/melee-weapons"
        | "/resources/soul-storm-routes"
        | "/resources/quests";
    }
  | { url: string }
);

export const soulStormResource = {
  path: "/resources/soul-storm",
  title: "Soul Storm forecast",
  category: "Tools",
  description:
    "See the current storm, count down to the next one, and plan ahead with the region rotation.",
  credit: {
    name: "dungeons.tools",
    url: "https://www.dungeons.tools/2/soul-storm",
    contribution: "figuring out the Soul Storm schedule and region rotation",
  },
} as const satisfies Resource;

export const meleeWeaponsResource = {
  path: "/resources/melee-weapons",
  title: "Melee weapon stats",
  category: "References",
  description:
    "Compare normal and pure jump attack DPS, combo timing, and damage breakdowns across 58 weapons.",
  credit: {
    name: "Hybrid / ruben_elia on Discord",
    url: "https://docs.google.com/spreadsheets/d/1vVVsN22O3hGB2Oyowow4C2H8TQPzEyHRlbp61lNtJH8/edit",
    contribution: "capturing and compiling the melee weapon measurements",
  },
} as const satisfies Resource;

export const soulStormRoutesResource = {
  path: "/resources/soul-storm-routes",
  title: "Soul Storm farming routes",
  category: "References",
  description:
    "Follow LordForce’s maps and fast travel routes to clear generators and repeat each storm efficiently.",
  credit: {
    name: "LordForce on Discord",
    links: [
      { label: "YouTube", url: "https://www.youtube.com/@lordforce5546" },
    ],
    contribution:
      "planning the farming routes and sharing the annotated maps and region tips",
  },
} as const satisfies Resource;

export const wikilyMapResource = {
  url: "https://wikily.gg/minecraft-dungeons-2/interactive-map",
  title: "Interactive world map · Wikily",
  category: "Tools",
  description:
    "Find dungeon entrances, fast travel stations, merchants, chests, and Soul Storm generators.",
  credit: {
    name: "Wikily",
    url: "https://wikily.gg/minecraft-dungeons-2/interactive-map",
    contribution: "creating and maintaining the interactive world map",
  },
} as const satisfies Resource;

export const itemTrackerResource = {
  path: "/resources/item-tracker",
  title: "Item collection tracker",
  category: "Tools",
  description:
    "Check off common, rare, special, unique and soul variants, and see what is still missing from your collection.",
  credit: {
    name: "MDDEX",
    contribution:
      "building the collection tracker from the published item catalog",
  },
} as const satisfies Resource;

export const questsResource = {
  path: "/resources/quests",
  title: "Quest graph",
  category: "References",
  description:
    "Explore quest prerequisites and branching paths, with objectives, rewards, and unlocks for every quest.",
  credit: {
    name: "Wikily and Metabot",
    links: [
      {
        label: "Wikily quests",
        url: "https://wikily.gg/minecraft-dungeons-2/quests",
      },
      {
        label: "Metabot quests",
        url: "https://metabot.gg/en/minecraft-dungeons-2/quests",
      },
    ],
    contribution:
      "documenting the quest relationships and walkthroughs in the published catalog",
  },
} as const satisfies Resource;

export const resources = [
  questsResource,
  itemTrackerResource,
  soulStormResource,
  wikilyMapResource,
  meleeWeaponsResource,
  soulStormRoutesResource,
] as const satisfies readonly Resource[];
