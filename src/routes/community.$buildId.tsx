import { createFileRoute } from "@tanstack/react-router";
import { CommunityBuildPage } from "../features/community/CommunityBuildPage";
import { pageMetadata } from "../features/seo/metadata";
export const Route = createFileRoute("/community/$buildId")({
  head: ({ params }) =>
    pageMetadata({
      title: "Community Build | MDDEX",
      description:
        "Explore this community build’s equipment, effects, enchantments, and creator notes.",
      path: `/community/${params.buildId}`,
      noindex: true,
    }),
  component: CommunityBuildRoute,
});
function CommunityBuildRoute() {
  return <CommunityBuildPage buildId={Route.useParams().buildId} />;
}
