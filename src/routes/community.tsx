import communityCss from "../features/community/community.css?url";
import { createFileRoute } from "@tanstack/react-router";
import { CommunityLayout } from "../features/community/CommunityPage";
import { pageMetadata } from "../features/seo/metadata";
export const Route = createFileRoute("/community")({
  head: () => {
    const metadata = pageMetadata({
      title: "Community Builds | MDDEX",
      description:
        "Discover Minecraft Dungeons community loadouts, equipment, and creator guides. Share a build of your own.",
      path: "/community",
    });
    return {
      ...metadata,
      links: [...metadata.links, { rel: "stylesheet", href: communityCss }],
    };
  },
  component: CommunityLayout,
});
