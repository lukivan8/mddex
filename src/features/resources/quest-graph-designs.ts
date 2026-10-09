import {
  connectedQuests,
  layoutQuestGraph,
  QUEST_HEIGHT,
  QUEST_WIDTH,
  type Quest,
  type QuestGraphData,
} from "./quest-graph";

export type Point = { x: number; y: number };
export type GraphBand = Point & {
  width: number;
  height: number;
  label: string;
};
export function designQuestGraph(data: QuestGraphData, vertical = false) {
  const base = layoutQuestGraph(data);
  const core = data.nodes
    .filter((node) => node.type === "Core Quest")
    .sort(
      (a, b) =>
        (a.order ?? Infinity) - (b.order ?? Infinity) ||
        a.name.localeCompare(b.name),
    );
  const coreKeys = new Set(core.map((node) => node.source_key));
  const coreIndex = new Map(core.map((node, i) => [node.source_key, i]));
  const nodes = data.nodes;
  const edges = data.edges;
  const groups = Array.from(
    { length: Math.max(1, core.length) },
    () => [] as Quest[],
  );
  const anchor = (node: Quest) =>
    Math.max(
      0,
      ...[...connectedQuests(node.source_key, base.parents)].map(
        (key) => coreIndex.get(key) ?? -1,
      ),
    );
  for (const node of nodes)
    if (!coreKeys.has(node.source_key)) groups[anchor(node)].push(node);
  for (const group of groups)
    group.sort(
      (a, b) =>
        base.positions[a.source_key].y - base.positions[b.source_key].y ||
        (a.order ?? Infinity) - (b.order ?? Infinity) ||
        a.name.localeCompare(b.name),
    );
  const positions: Record<string, Point> = {};
  const bands: GraphBand[] = [];
  const STEP_X = QUEST_WIDTH + 86,
    STEP_Y = QUEST_HEIGHT + 118,
    MARGIN = 70;
  core.forEach((node, i) => {
    positions[node.source_key] = vertical
      ? { x: MARGIN, y: MARGIN + i * STEP_Y }
      : { x: MARGIN + i * STEP_X, y: MARGIN };
  });
  groups.forEach((group, i) =>
    group.forEach((node, j) => {
      positions[node.source_key] = vertical
        ? { x: MARGIN + (j + 1) * STEP_X, y: MARGIN + i * STEP_Y }
        : { x: MARGIN + i * STEP_X, y: MARGIN + (j + 1) * STEP_Y };
    }),
  );
  bands.push({
    x: 40,
    y: 36,
    width: vertical ? QUEST_WIDTH + 60 : Math.max(1, core.length) * STEP_X,
    height: vertical ? Math.max(1, core.length) * STEP_Y : QUEST_HEIGHT + 46,
    label: "MAIN STORY",
  });
  // Catalogs without a core quest lane remain usable.
  for (const node of nodes)
    positions[node.source_key] ??= base.positions[node.source_key];
  const width =
    Math.max(
      ...Object.values(positions).map((point) => point.x + QUEST_WIDTH),
      ...bands.map((band) => band.x + band.width),
    ) + MARGIN;
  const height =
    Math.max(
      ...nodes.map((node) => positions[node.source_key].y + QUEST_HEIGHT),
      ...bands.map((band) => band.y + band.height),
    ) + MARGIN;
  return {
    nodes,
    edges,
    positions,
    bands,
    width,
    height,
    parents: base.parents,
    children: base.children,
    orientation: vertical ? "vertical" : "horizontal",
  };
}

/** Route card ports toward each other, retaining side branches as real dependencies. */
export function questEdgePath(start: Point, end: Point) {
  if (start.y === end.y && Math.abs(end.x - start.x) > 350) {
    const forward = end.x > start.x;
    const portX = start.x + (forward ? QUEST_WIDTH : 0);
    const elbowX = portX + (forward ? 30 : -30);
    return `M${portX},${start.y + QUEST_HEIGHT / 2} H${elbowX} V${start.y - 30} H${end.x + QUEST_WIDTH / 2} V${end.y - 5}`;
  }
  if (Math.abs(end.x - start.x) > Math.abs(end.y - start.y) * 1.3) {
    const forward = end.x > start.x;
    const x1 = start.x + (forward ? QUEST_WIDTH : 0),
      y1 = start.y + QUEST_HEIGHT / 2,
      x2 = end.x + (forward ? 0 : QUEST_WIDTH),
      y2 = end.y + QUEST_HEIGHT / 2;
    return `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2 + (forward ? -5 : 5)},${y2}`;
  }
  const x1 = start.x + QUEST_WIDTH / 2,
    y1 = start.y + QUEST_HEIGHT,
    x2 = end.x + QUEST_WIDTH / 2,
    y2 = end.y;
  // Dogleg long links outside card interiors.
  if (Math.abs(end.y - start.y) > 350 && start.x === end.x)
    return `M${start.x + QUEST_WIDTH},${start.y + QUEST_HEIGHT / 2} H${start.x + QUEST_WIDTH + 30} V${end.y + QUEST_HEIGHT / 2} H${end.x + QUEST_WIDTH + 5}`;
  return `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2 - 5}`;
}
