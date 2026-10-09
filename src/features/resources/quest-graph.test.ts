import { expect, it } from "vitest";
import fixture from "../../../e2e/fixtures/quests.json";
import {
  connectedQuests,
  layoutQuestGraph,
  projectQuestGraph,
  QUEST_WIDTH,
} from "./quest-graph";

it("keeps branching ancestry and merges without imposing a prerequisite combination", () => {
  const graph = projectQuestGraph(fixture, []);
  const layout = layoutQuestGraph(graph);
  expect(connectedQuests("quests:finale", layout.parents)).toEqual(
    new Set(["quests:merchant", "quests:fishing", "quests:escape"]),
  );
  expect(layout.positions["quests:merchant"].y).toBe(
    layout.positions["quests:fishing"].y,
  );
  expect(layout.positions["quests:fishing"].x).toBeGreaterThanOrEqual(
    layout.positions["quests:merchant"].x + QUEST_WIDTH,
  );
  expect(layout.positions["quests:finale"].y).toBeGreaterThan(
    layout.positions["quests:merchant"].y,
  );
  expect(graph.nodes[3].unlock_conditions?.combination).toBe(
    "source_unspecified",
  );
});
it("retains source roles, objectives and pool selection notes while trimming native payloads", () => {
  const graph = projectQuestGraph(fixture, []);
  expect(graph.nodes[0]).not.toHaveProperty("native");
  expect(graph.nodes[1]).toMatchObject({
    recommended_level: 2,
    locations: [{ title: "Brave Haven" }],
    start_location: { name: "Honeycomb Fields" },
    objectives: [{ title: "Find the merchant" }],
    supplemental_evidence: { objectives: [{ text: "Speak to the merchant" }] },
    rewards: {
      first_completion: [
        { title: "1 drop from a list of 2" },
        { title: "Mystic Robe" },
        { title: "Emerald Hammer" },
      ],
    },
  });
  expect(graph.nodes[1].minimum_level).toBeUndefined();
});
it("projects only referenced canonical catalog links", () => {
  const graph = projectQuestGraph(fixture, [
    {
      slug: "armor-mystic-robe",
      category: "armor",
      type: "chest",
      variation: "Mystic Robe",
      image: null,
      game_data: { slug: "mystic-robe" },
    },
    {
      slug: "unused",
      category: "armor",
      type: "chest",
      variation: "Other",
      image: null,
    },
  ]);
  expect(Object.keys(graph.catalogLinks)).toEqual(["armor-mystic-robe"]);
  expect(graph.catalogLinks["armor-mystic-robe"].path).toBe(
    "/catalog/armor/mystic-robe",
  );
});
it("rejects unsupported, duplicate, dangling or cyclic quest graphs", () => {
  for (const value of [
    { ...fixture, schema_version: 2 },
    { ...fixture, nodes: [...fixture.nodes, fixture.nodes[0]] },
    {
      ...fixture,
      edges: [...fixture.edges, { from: "missing", to: "quests:escape" }],
    },
    {
      ...fixture,
      edges: [...fixture.edges, { from: "quests:finale", to: "quests:escape" }],
    },
  ])
    expect(() => projectQuestGraph(value, [])).toThrow();
});
