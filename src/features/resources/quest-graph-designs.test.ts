import { expect, it } from "vitest";
import fixture from "../../../e2e/fixtures/quests.json";
import { projectQuestGraph, QUEST_HEIGHT, QUEST_WIDTH } from "./quest-graph";
import { designQuestGraph } from "./quest-graph-designs";
const data = projectQuestGraph(fixture, []);
it("Metro preserves actual dependencies and avoids overlapping quest cards", () => {
  const layout = designQuestGraph(data);
  expect(layout.edges).toHaveLength(4);
  expect(layout.nodes).toHaveLength(4);
  const points = Object.values(layout.positions);
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      expect(
        Math.abs(points[i].x - points[j].x) >= QUEST_WIDTH ||
          Math.abs(points[i].y - points[j].y) >= QUEST_HEIGHT,
      ).toBe(true);
  for (const point of points) {
    expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
    expect(point.x + QUEST_WIDTH).toBeLessThanOrEqual(layout.width);
    expect(point.y + QUEST_HEIGHT).toBeLessThanOrEqual(layout.height);
  }
});
it("keeps the main story on one horizontal line", () => {
  const layout = designQuestGraph(data);
  const core = data.nodes
    .filter((node) => node.type === "Core Quest")
    .map((node) => layout.positions[node.source_key]);
  expect(new Set(core.map((point) => point.y)).size).toBe(1);
});
it("keeps side quest follow-ups on their own branch instead of crossing sibling cards", () => {
  const extra = projectQuestGraph(
    {
      ...fixture,
      nodes: [
        ...fixture.nodes,
        {
          source_key: "quests:fish-again",
          name: "Fish again",
          type: "Side Quest",
        },
      ],
      edges: [
        ...fixture.edges,
        { from: "quests:fishing", to: "quests:fish-again" },
      ],
    },
    [],
  );
  const graph = designQuestGraph(extra);
  expect(graph.positions["quests:fish-again"].x).toBe(
    graph.positions["quests:fishing"].x,
  );
  expect(graph.positions["quests:fish-again"].y).toBeGreaterThan(
    graph.positions["quests:fishing"].y,
  );
});

it("runs the mobile main story vertically with side quests branching horizontally", () => {
  const graph = designQuestGraph(data, true);
  const core = data.nodes
    .filter((node) => node.type === "Core Quest")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  expect(graph.orientation).toBe("vertical");
  expect(
    new Set(core.map((node) => graph.positions[node.source_key].x)).size,
  ).toBe(1);
  expect(graph.positions[core[1].source_key].y).toBeGreaterThan(
    graph.positions[core[0].source_key].y,
  );
  expect(graph.positions["quests:fishing"].x).toBeGreaterThan(
    graph.positions[core[0].source_key].x,
  );
  expect(graph.edges).toEqual(data.edges);
});
