import { createFileRoute } from "@tanstack/react-router";
import { CommunityPostPage } from "../features/community/CommunityPostPage";
import { pageMetadata } from "../features/seo/metadata";
export const Route = createFileRoute("/community/new")({
  head: () =>
    pageMetadata({
      title: "Post a Community Build | MDDEX",
      description: "Share your local loadout with the MDDEX community.",
      path: "/community/new",
      noindex: true,
    }),
  component: CommunityPostPage,
});
