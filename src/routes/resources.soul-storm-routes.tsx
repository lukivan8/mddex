import resourcesCss from "../features/resources/resources.css?url";
import routesCss from "../features/resources/soul-storm-routes.css?url";
import { createFileRoute } from "@tanstack/react-router";
import { SoulStormRoutesPage } from "../features/resources/SoulStormRoutesPage";
import {
  soulStormRoutes,
  type StormRouteId,
} from "../features/resources/soul-storm-routes";
import { pageMetadata } from "../features/seo/metadata";

export const Route = createFileRoute("/resources/soul-storm-routes")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { region?: StormRouteId } => ({
    region: soulStormRoutes.find((route) => route.id === search.region)?.id,
  }),
  head: () => {
    const metadata = pageMetadata({
      title: "Minecraft Dungeons 2 Soul Storm Farming Routes | MDDEX",
      description:
        "Farm Soul Storms efficiently with LordForce’s annotated maps and fast travel routes for all seven regions, plus generator tips and repeat-run instructions.",
      path: "/resources/soul-storm-routes",
    });
    return {
      ...metadata,
      links: [
        ...metadata.links,
        { rel: "stylesheet", href: resourcesCss },
        { rel: "stylesheet", href: routesCss },
      ],
    };
  },
  component: RoutesPage,
});
function RoutesPage() {
  const { region } = Route.useSearch();
  return <SoulStormRoutesPage region={region} />;
}
