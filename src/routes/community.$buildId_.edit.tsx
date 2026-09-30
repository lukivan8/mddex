import { createFileRoute } from "@tanstack/react-router";
import { CommunityEditPage } from "../features/community/CommunityPostPage";
import { pageMetadata } from "../features/seo/metadata";
export const Route = createFileRoute("/community/$buildId_/edit")({
  head: ({ params }) =>
    pageMetadata({
      title: "Edit Community Build | MDDEX",
      description: "Confirm your email to edit your community build.",
      path: `/community/${params.buildId}/edit`,
      noindex: true,
    }),
  component: CommunityEditRoute,
});
function CommunityEditRoute() {
  return <CommunityEditPage buildId={Route.useParams().buildId} />;
}
