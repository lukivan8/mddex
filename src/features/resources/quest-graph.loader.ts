import {
  loadSessionCatalog,
  loadSessionCatalogDetail,
} from "../catalog/catalog.session";
import { projectQuestGraph } from "./quest-graph";

export async function loadQuestGraph() {
  const catalog = await loadSessionCatalog();
  // Every location shard carries the complete graph; load just one pinned shard.
  const location =
    catalog.find((item) => item.slug === "location-brave-haven") ??
    catalog.find((item) => item.category === "location");
  if (!location) throw new Error("Quest data is unavailable in this catalog.");
  const detail = await loadSessionCatalogDetail(location);
  return projectQuestGraph(detail.game_data?.quest_graph, catalog);
}
