import { z } from "zod";
import type { CatalogItem } from "../catalog/catalog.types";
import { itemPath } from "../catalog-details/catalog-detail.model";
import { normalizeDetailItem } from "../catalog-details/catalog-detail.loader";

const text = z.string().nullish();
const reference = z.object({
  title: text,
  name: text,
  subtitle: text,
  href: text,
  catalog_slug: text,
});
const references = z.array(reference).default([]);
const quest = z.object({
  source_key: z.string().min(1),
  source_url: text,
  name: z.string().min(1),
  type: z.string(),
  order: z.number().nullish(),
  giver: text,
  giver_note: text,
  area: text,
  repeatable: z.boolean().default(false),
  recommended_level: z.number().nullish(),
  minimum_level: z.number().nullish(),
  start_location: reference.nullish(),
  locations: references,
  objectives: references,
  completion: text,
  unlocks: text,
  rewards: z
    .object({ first_completion: references, repeat_completion: references })
    .default({ first_completion: [], repeat_completion: [] }),
  unlock_conditions: z
    .object({ combination: text, additional_conditions: text })
    .nullish(),
  source_conflicts: z
    .array(z.object({ field: z.string(), caveat: text }))
    .default([]),
  supplemental_evidence: z
    .object({
      source_url: text,
      objectives: z
        .array(
          z.object({
            text: z.string(),
            count: z.number().nullish(),
            action: text,
          }),
        )
        .default([]),
      map: z
        .object({
          text,
          links: z
            .array(z.object({ name: z.string(), href: z.string() }))
            .default([]),
        })
        .nullish(),
    })
    .nullish(),
});
const schema = z.object({
  schema_version: z.literal(1),
  nodes: z.array(quest).min(1),
  edges: z.array(z.object({ from: z.string(), to: z.string() })),
});
export type Quest = z.infer<typeof quest>;
export type QuestGraph = z.infer<typeof schema>;
export type QuestReference = z.infer<typeof reference>;
export type QuestCatalogLink = {
  name: string;
  path: string;
  image: string | null;
};
export type QuestGraphData = QuestGraph & {
  catalogLinks: Record<string, QuestCatalogLink>;
};
export const QUEST_WIDTH = 244;
export const QUEST_HEIGHT = 112;
const GAP_X = 32,
  GAP_Y = 52,
  PADDING = 24;

/** Validate dependencies and derive ranks without assuming story order is an unlock rule. */
export function layoutQuestGraph(graph: QuestGraph) {
  const nodes = new Map(graph.nodes.map((node) => [node.source_key, node]));
  if (nodes.size !== graph.nodes.length)
    throw new Error("Duplicate quest identities in catalog.");
  const parents = new Map(
    graph.nodes.map((node) => [node.source_key, new Set<string>()]),
  );
  const children = new Map(
    graph.nodes.map((node) => [node.source_key, new Set<string>()]),
  );
  for (const edge of graph.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to))
      throw new Error("Missing quest dependency in catalog.");
    parents.get(edge.to)!.add(edge.from);
    children.get(edge.from)!.add(edge.to);
  }
  const remaining = new Map(
    [...parents].map(([key, value]) => [key, value.size]),
  );
  const rank = new Map(graph.nodes.map((node) => [node.source_key, 0]));
  const queue = graph.nodes
    .filter((node) => remaining.get(node.source_key) === 0)
    .map((node) => node.source_key);
  let visited = 0;
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i];
    visited++;
    for (const child of children.get(key)!) {
      rank.set(child, Math.max(rank.get(child)!, rank.get(key)! + 1));
      remaining.set(child, remaining.get(child)! - 1);
      if (remaining.get(child) === 0) queue.push(child);
    }
  }
  if (visited !== nodes.size)
    throw new Error("Cyclic quest dependencies in catalog.");
  const layers: Quest[][] = [];
  for (const node of graph.nodes)
    (layers[rank.get(node.source_key)!] ??= []).push(node);
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [depth, layer] of layers.entries()) {
    layer.sort(
      (a, b) =>
        Number(b.type === "Core Quest") - Number(a.type === "Core Quest") ||
        (a.order ?? Infinity) - (b.order ?? Infinity) ||
        a.name.localeCompare(b.name),
    );
    layer.forEach((node, column) => {
      positions[node.source_key] = {
        x: PADDING + column * (QUEST_WIDTH + GAP_X),
        y: PADDING + depth * (QUEST_HEIGHT + GAP_Y),
      };
    });
  }
  return {
    positions,
    width:
      PADDING * 2 +
      Math.max(...layers.map((layer) => layer.length)) * (QUEST_WIDTH + GAP_X) -
      GAP_X,
    height: PADDING * 2 + layers.length * (QUEST_HEIGHT + GAP_Y) - GAP_Y,
    parents,
    children,
  };
}

export function projectQuestGraph(
  value: unknown,
  catalog: CatalogItem[],
): QuestGraphData {
  const graph = schema.parse(value);
  layoutQuestGraph(graph);
  const slugs = new Set(
    graph.nodes.flatMap((node) =>
      [
        ...node.locations,
        ...(node.start_location ? [node.start_location] : []),
        ...node.rewards.first_completion,
        ...node.rewards.repeat_completion,
      ].flatMap((row) => (row.catalog_slug ? [row.catalog_slug] : [])),
    ),
  );
  const catalogLinks = Object.fromEntries(
    catalog
      .filter((item) => slugs.has(item.slug))
      .map((item) => [
        item.slug,
        {
          name: item.variation,
          path: itemPath(normalizeDetailItem(item)),
          image: item.image,
        },
      ]),
  );
  return { ...graph, catalogLinks };
}

export function connectedQuests(key: string, links: Map<string, Set<string>>) {
  const found = new Set<string>();
  const pending = [key];
  for (let i = 0; i < pending.length; i++)
    for (const next of links.get(pending[i]) ?? []) {
      if (!found.has(next) && next !== key) {
        found.add(next);
        pending.push(next);
      }
    }
  return found;
}
