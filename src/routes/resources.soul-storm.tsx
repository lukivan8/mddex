import resourcesCss from "../features/resources/resources.css?url";
import { createFileRoute } from "@tanstack/react-router";
import { SoulStormPage } from "../features/resources/SoulStormPage";
import { pageMetadata } from "../features/seo/metadata";

export const Route = createFileRoute("/resources/soul-storm")({
  head: () => {
    const metadata = pageMetadata({
      title: "Minecraft Dungeons 2 Soul Storm Forecast | MDDEX",
      description:
        "Forecast the current and upcoming Soul Storms in Minecraft Dungeons 2. See a live countdown, region rotation and local start times.",
      path: "/resources/soul-storm",
    });
    return {
      ...metadata,
      links: [...metadata.links, { rel: "stylesheet", href: resourcesCss }],
    };
  },
  component: SoulStormPage,
});
