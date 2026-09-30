import { createFileRoute } from "@tanstack/react-router";
import { CommunityLayout } from "../features/community/CommunityPage";
import { pageMetadata } from "../features/seo/metadata";
export const Route = createFileRoute("/community")({
  head: () =>
    pageMetadata({
      title: "Community Builds | MDDEX",
      description:
        "Discover Minecraft Dungeons community loadouts, equipment, and creator guides. Share a build of your own.",
      path: "/community",
    }),
  component: CommunityLayout,
});
