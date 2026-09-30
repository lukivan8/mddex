import { createFileRoute } from "@tanstack/react-router";
import { MobsPage } from "../features/catalog-details/MobsPage";
import { loadSessionCatalog } from "../features/catalog/catalog.session";
import {
  mobsCatalog,
  type MobFilters,
} from "../features/catalog-details/mobs.model";
import { pageMetadata } from "../features/seo/metadata";
import { catalogIndex } from "../features/seo/catalog-index";
export const Route = createFileRoute("/mobs")({
  validateSearch: (search: Record<string, unknown>): MobFilters => ({
    q: typeof search.q === "string" ? search.q : undefined,
    kind:
      search.kind === "boss" ||
      search.kind === "neutral" ||
      search.kind === "hostile" ||
      search.kind === "companion"
        ? search.kind
        : undefined,
    location: typeof search.location === "string" ? search.location : undefined,
    sort:
      search.sort === "name_desc" || search.sort === "kind"
        ? search.sort
        : undefined,
  }),
  loader: async () => {
    const catalog = await loadSessionCatalog();
    return {
      ...mobsCatalog(catalog),
      locationDirectory: catalogIndex(catalog, ["location"]),
    };
  },
  head: () =>
    pageMetadata({
      title: "Minecraft Dungeons 2 Mobs & Enemy Drops | MDDEX",
      description:
        "Browse Minecraft Dungeons 2 mobs, enemies and bosses. Explore their stats, attacks, drop sources and locations in the MCD2 catalog.",
      path: "/mobs",
    }),
  component: MobsRoute,
});
function MobsRoute() {
  const catalog = Route.useLoaderData();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MobsPage
      {...catalog}
      filters={filters}
      onChange={(patch) => {
        void navigate({
          search: { ...filters, ...patch },
          replace: true,
          resetScroll: false,
        });
      }}
    />
  );
}
