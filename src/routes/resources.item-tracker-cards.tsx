import { createFileRoute } from "@tanstack/react-router";
import { ItemTrackerPage } from "../features/resources/ItemTrackerPage";
import { pageMetadata } from "../features/seo/metadata";
import resourcesCss from "../features/resources/resources.css?url";
import trackerCss from "../features/resources/item-tracker.css?url";
export const Route = createFileRoute("/resources/item-tracker-cards")({
  head: () => {
    const metadata = pageMetadata({
      title: "Minecraft Dungeons 2 Item Tracker · Cards | MDDEX",
      description:
        "Track common, rare, special, unique and soul variants in your Minecraft Dungeons 2 collection.",
      path: "/resources/item-tracker-cards",
    });
    return {
      ...metadata,
      links: [
        ...metadata.links,
        { rel: "stylesheet", href: resourcesCss },
        { rel: "stylesheet", href: trackerCss },
      ],
    };
  },
  component: () => <ItemTrackerPage layout="cards" />,
});
