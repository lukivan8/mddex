import { createFileRoute } from "@tanstack/react-router";
import resourcesCss from "../features/resources/resources.css?url";
import plannerCss from "../features/resources/farm-planner.css?url";
import { FarmPlannerPage } from "../features/resources/FarmPlannerPage";
import { pageMetadata } from "../features/seo/metadata";
export const Route = createFileRoute("/resources/planner")({
  head: () => {
    const metadata = pageMetadata({
      title: "Minecraft Dungeons 2 Farming Planner | MDDEX",
      description:
        "Plan overlapping farming stops for your build, compare catalog acquisition sources, and choose which items to farm.",
      path: "/resources/planner",
    });
    return {
      ...metadata,
      links: [
        ...metadata.links,
        { rel: "stylesheet", href: resourcesCss },
        { rel: "stylesheet", href: plannerCss },
      ],
    };
  },
  component: FarmPlannerPage,
});
