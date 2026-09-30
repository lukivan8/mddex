import { createFileRoute } from "@tanstack/react-router";
import { CommunityGallery } from "../features/community/CommunityPage";
export const Route = createFileRoute("/community/")({
  component: CommunityGallery,
});
