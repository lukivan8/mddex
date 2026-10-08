import resourcesCss from "../features/resources/resources.css?url";
import { createFileRoute } from "@tanstack/react-router";
import { ResourcesPage } from "../features/resources/ResourcesPage";
import { pageMetadata } from "../features/seo/metadata";

export const Route = createFileRoute("/resources/")({
  head: () => {
    const metadata = pageMetadata({
      title: "Minecraft Dungeons 2 Resources & Tools | MDDEX",
      description:
        "Inspect useful Minecraft Dungeons 2 tools and references. Plan world events with the Soul Storm forecast.",
      path: "/resources",
    });
    return {
      ...metadata,
      links: [...metadata.links, { rel: "stylesheet", href: resourcesCss }],
    };
  },
  component: ResourcesPage,
});
