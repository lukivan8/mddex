import { describe, expect, it } from "vitest";
import { emptyBuild } from "../builds/build.service";
import {
  buildFarmItems,
  buildFarmEffects,
  recommendedBoss,
  plannerUniqueChance,
  minimumFarmPlan,
  projectFarmTarget,
  type FarmTarget,
} from "./farm-planner";
const target = (slug: string, locations: string[]): FarmTarget => ({
  slug,
  name: slug,
  image: null,
  slots: [],
  notes: [],
  options: locations.map((name) => ({ key: name, name, type: "area" })),
});
describe("farming planner", () => {
  it("finds exact cover when greedy overlap would use an extra stop", () => {
    const targets = [
      target("1", ["A", "B"]),
      target("2", ["A", "B"]),
      target("3", ["A", "C"]),
      target("4", ["A", "C"]),
      target("5", ["B"]),
      target("6", ["C"]),
    ];
    expect(minimumFarmPlan(targets).map((stop) => stop.key)).toEqual([
      "B",
      "C",
    ]);
    expect(
      minimumFarmPlan(targets.slice(0, 4)).map((stop) => stop.key),
    ).toEqual(["A"]);
  });
  it("assigns each item to its first stop and collapses later overlaps without changing source pools", () => {
    const targets = [
      target("only-a", ["A"]),
      target("shared", ["A", "B"]),
      target("only-b", ["B"]),
    ];
    const plan = minimumFarmPlan(targets);
    expect(
      plan.map((stop) => stop.targets.map((row) => row.target.slug)),
    ).toEqual([["only-a", "shared"], ["only-b"]]);
    expect(
      plan.map((stop) => stop.acquiredBefore.map((row) => row.target.slug)),
    ).toEqual([[], ["shared"]]);
    expect(targets[1].options.map((source) => source.key)).toEqual(["A", "B"]);
    const changed = minimumFarmPlan(targets.slice(1));
    expect(changed[0].targets.map((row) => row.target.slug)).toEqual([
      "shared",
      "only-b",
    ]);
    expect(changed[0].acquiredBefore).toEqual([]);
  });
  it("includes quest rewards as route stops, while preserving unknown items", () => {
    const quest = {
      ...target("quest item", ["quest"]),
      options: [{ key: "q", name: "Quest", type: "quest" }],
    };
    const merchant = {
      ...target("shop item", ["shop"]),
      options: [{ key: "s", name: "Shop", type: "merchant" }],
    };
    const plan = minimumFarmPlan([quest, merchant, target("unknown", [])]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ key: "q", type: "quest" });
    expect(plan[0].targets[0].target.slug).toBe("quest item");
    expect(minimumFarmPlan([])).toEqual([]);
  });
  it("combines quest rewards and carries the canonical quest link into the route", () => {
    const quest = {
      key: "quest:trials:first_completion",
      name: "Trials",
      type: "quest",
      quest: "trials",
      description: "First completion reward",
    };
    const targets = [
      { ...target("amulet", []), oneTime: true, options: [quest] },
      { ...target("helmet", []), options: [quest] },
    ];
    const plan = minimumFarmPlan(targets);
    expect(plan).toHaveLength(1);
    expect(plan[0].quest).toBe("trials");
    expect(plan[0].targets).toHaveLength(2);
    expect(plan[0].targets[0].source.description).toBe(
      "First completion reward",
    );
    expect(plan[0].targets[0].target.oneTime).toBe(true);
  });
  it("deduplicates equipment and highlights one-time acquisitions without including random effects", () => {
    const build = emptyBuild("Test");
    build.slots.melee = {
      itemSlug: "axe",
      enchantments: ["sharpness"],
      effects: ["burn"],
    };
    build.slots.artifact1 = { itemSlug: "axe", enchantments: [], effects: [] };
    build.slots.talisman1 = {
      itemSlug: "amulet",
      enchantments: [],
      effects: [],
    };
    expect(buildFarmItems(build.slots)).toEqual([
      { slug: "axe", slots: ["melee", "artifact 1"], oneTime: false },
      { slug: "sharpness", slots: ["melee enchantment"], oneTime: true },
      { slug: "amulet", slots: ["talisman 1"], oneTime: true },
    ]);
  });
  it("keeps effect combinations in slot order with repeated effects and unknown references", () => {
    const build = emptyBuild("Effects");
    build.slots.melee = {
      itemSlug: "same",
      enchantments: [],
      effects: ["burn", null, "burn"],
    };
    build.slots.ranged = {
      itemSlug: "same",
      enchantments: [],
      effects: ["missing"],
    };
    const catalog = [
      {
        slug: "burn",
        variation: "Burn",
        category: "gear_effect",
        type: "attack",
        image: "/burn.png",
        game_data: {},
      },
    ];
    expect(buildFarmEffects("same", build.slots, catalog)).toEqual([
      {
        slot: "melee",
        effects: [
          { slug: "burn", name: "Burn", image: "/burn.png" },
          { slug: "burn", name: "Burn", image: "/burn.png" },
        ],
      },
      {
        slot: "ranged",
        effects: [{ slug: "missing", name: "missing", image: null }],
      },
    ]);
    expect(buildFarmEffects("burn", build.slots, catalog)).toEqual([]);
  });
  it("projects catalog acquisition and canonical quest links without inventing drop rates", () => {
    const item = {
      slug: "axe",
      variation: "Axe",
      category: "melee_weapon",
      type: "axe",
      image: null,
      game_data: {
        slug: "axe",
        sources: [
          { type: "area", name: "Woods", catalog_slug: "location-woods" },
        ],
        acquisition: {
          sources: [
            {
              type: "quest",
              name: "Help",
              href: "https://wikily.gg/minecraft-dungeons-2/quests/help",
              trigger: "first_completion",
            },
            { type: "merchant", name: "Town Merchant" },
          ],
        },
      },
    };
    const location = {
      slug: "location-woods",
      category: "location",
      type: "location",
      variation: "Woods",
      image: "https://example.com/woods.png",
      game_data: { slug: "woods" },
    };
    const projected = projectFarmTarget(item, ["melee"], [item, location]);
    expect(
      projected.options.find((source) => source.type === "area"),
    ).toMatchObject({
      image: location.image,
      path: "/catalog/locations/woods",
    });
    expect(
      projected.options.find((source) => source.type === "quest"),
    ).toMatchObject({ quest: "help", description: "First completion reward" });
    expect(projected.options.every((source) => !source.dropChance)).toBe(true);
  });
  it("prefers Singer's Meadow over an equal-stop route with lower known item odds", () => {
    const reach = target("creakings-reach", []);
    reach.options = [
      {
        key: "howling",
        name: "Howling Woods",
        type: "area",
        dropChance: {
          text: "As Longbow (≈3.33%)",
          averageProbability: 0.002639025,
        },
      },
      {
        key: "singer",
        name: "Singer's Meadow",
        type: "area",
        dropChance: {
          text: "As Longbow (≈4.17%)",
          averageProbability: 0.003304725,
        },
      },
    ];
    expect(minimumFarmPlan([reach]).map((stop) => stop.key)).toEqual([
      "singer",
    ]);
    const shared = target("already-covered", ["fixed", "howling"]);
    expect(
      minimumFarmPlan([target("fixed-item", ["fixed"]), shared, reach]).map(
        (stop) => stop.key,
      ),
    ).toEqual(["fixed", "singer"]);
  });
  it("keeps first and repeat quest reward selection rules separate", () => {
    const source = {
      type: "quest",
      name: "Finale",
      href: "https://wikily.gg/minecraft-dungeons-2/quests/finale",
    };
    const item = {
      slug: "reward",
      category: "armor",
      type: "head",
      variation: "Reward",
      image: null,
      game_data: {
        acquisition: {
          sources: [
            {
              ...source,
              trigger: "first_completion",
              selection_context: [{ title: "2 drops from a list of 4" }],
            },
            {
              ...source,
              trigger: "repeat_completion",
              selection_context: [{ title: "1 drop from a list of 4" }],
            },
          ],
        },
      },
    };
    const options = projectFarmTarget(item, ["head"], [item]).options;
    expect(options.map((option) => option.description)).toEqual([
      "First completion reward · 2 drops from a list of 4",
      "Repeat completion reward · 1 drop from a list of 4",
    ]);
    expect(new Set(options.map((option) => option.key)).size).toBe(2);
  });
  it("covers every farmable item, including the 18-item build boundary", () => {
    const targets = Array.from({ length: 18 }, (_, index) =>
      target(`${index}`, ["Shared", `Only ${index}`]),
    );
    expect(minimumFarmPlan(targets).map((stop) => stop.key)).toEqual([
      "Shared",
    ]);
  });
});

it("maps the six owner-recommended bosses without extending recommendations to dungeons", () => {
  const names = [
    "Rainy Plains",
    "Lullaby Hills",
    "Howling Woods",
    "Frozen Highlands",
    "The Deep Dark",
    "Singer's Meadow",
  ];
  expect(
    names.map((name) => recommendedBoss({ type: "area", name })?.name),
  ).toEqual([
    "Copper Monstrosity",
    "Redstone Monstrosity",
    "Soul Corrupted Witch",
    "Prime Enchanter",
    "Twisted Warden",
    "Sculk Monstrosity",
  ]);
  expect(
    recommendedBoss({
      type: "area",
      name: "Deep Dark",
      catalog_slug: "location-the-deep-dark",
    })?.name,
  ).toBe("Twisted Warden");
  expect(
    recommendedBoss({ type: "dungeon", name: "Frozen Highlands" }),
  ).toBeUndefined();
});
it("maximizes boss coverage before planning the remaining items, even when a regular stop could cover all", () => {
  const boss = { name: "Sculk Monstrosity", slug: "mob-sculk-monstrosity" };
  const targets = [
    target("weapon", ["all", "meadow"]),
    target("artifact", ["all", "plains"]),
    target("book", ["all", "meadow"]),
  ];
  for (const entry of targets)
    for (const source of entry.options) {
      if (source.key !== "all") source.recommendedBoss = boss;
      source.bossEligible = entry.slug !== "book";
    }
  expect(minimumFarmPlan(targets)).toHaveLength(1);
  const route = minimumFarmPlan(targets, new Set(), true);
  expect(route.map((stop) => stop.bossFarm === true)).toEqual([
    true,
    true,
    false,
  ]);
  expect(
    route
      .slice(0, 2)
      .flatMap((stop) => stop.targets.map((row) => row.target.slug))
      .sort(),
  ).toEqual(["artifact", "weapon"]);
  expect(route[2].targets.map((row) => row.target.slug)).toEqual(["book"]);
  expect(
    new Set(route.flatMap((stop) => stop.targets.map((row) => row.target.slug)))
      .size,
  ).toBe(3);
  expect(minimumFarmPlan(targets, new Set(["all", "meadow"]), true)).toEqual(
    [],
  );
  expect(minimumFarmPlan(targets, new Set(["boss:plains"]), true)).toEqual([]);
});
it("leaves boss mode unchanged when no targets have recommended boss sources", () => {
  const targets = [target("book", ["woods"]), target("quest-item", ["quest"])];
  expect(minimumFarmPlan(targets, new Set(), true)).toEqual(
    minimumFarmPlan(targets),
  );
});

it("uses the owner-selected 5% and 10% unique rolls against base pool probability", () => {
  const entry = target("unique", ["area"]);
  const source = entry.options[0];
  source.dropChance = {
    text: "As Axe (≈4%)",
    averageProbability: 0.00317,
    basePoolProbability: 0.04,
    baseItem: "Axe",
  };
  source.recommendedBoss = {
    name: "Copper Monstrosity",
    slug: "mob-copper-monstrosity",
  };
  source.bossEligible = true;
  const regular = minimumFarmPlan([entry])[0].targets[0].source.dropChance;
  expect(regular?.text).toBe("≈0.2% unique");
  expect(regular?.averageProbability).toBeCloseTo(0.002);
  const boss = minimumFarmPlan([entry], new Set(), true)[0].targets[0].source
    .dropChance;
  expect(boss?.text).toBe("≈0.4% unique");
  expect(boss?.averageProbability).toBeCloseTo(0.004);
  expect(source.dropChance.averageProbability).toBe(0.00317);
  expect(
    plannerUniqueChance({
      ...source,
      dropChance: { text: "No pool", averageProbability: 0.02 },
    }),
  ).toBeUndefined();
  for (const pool of [-1, 2, NaN])
    expect(
      plannerUniqueChance({
        ...source,
        dropChance: { text: "Invalid", basePoolProbability: pool },
      }),
    ).toBeUndefined();
});
