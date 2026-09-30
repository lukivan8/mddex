import { createFileRoute } from "@tanstack/react-router";
import {
  pageMetadata,
  BUILD_TITLE,
  BUILD_DESCRIPTION,
  buildApplicationSchema,
} from "../features/seo/metadata";
import { BuildPage } from "../features/builds/BuildPage";
export const Route = createFileRoute("/build")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { share?: string; community?: "post" } => ({
    ...(typeof search.share === "string" ? { share: search.share } : {}),
    ...(search.community === "post" ? { community: "post" as const } : {}),
  }),
  head: ({ match }) => ({
    ...pageMetadata({
      title: match.search.share
        ? "Shared Minecraft Dungeons 2 Build | MDDEX"
        : BUILD_TITLE,
      description: match.search.share
        ? "View this shared Minecraft Dungeons 2 build, explore its equipment and effects, and save a copy to customize your own loadout."
        : BUILD_DESCRIPTION,
      path: "/build",
      noindex: !!match.search.share,
      share: match.search.share,
    }),
    scripts: match.search.share
      ? []
      : [
          {
            type: "application/ld+json",
            children: JSON.stringify(buildApplicationSchema),
          },
        ],
  }),
  component: BuildPage,
});
