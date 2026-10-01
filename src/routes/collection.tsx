import { createFileRoute } from "@tanstack/react-router";
import {
  pageMetadata,
  CATALOG_TITLE,
  CATALOG_DESCRIPTION,
} from "../features/seo/metadata";
import { CollectionPage } from "../features/collection/CollectionPage";
import { loadSessionCatalog } from "../features/catalog/catalog.session";
import { catalogIndex } from "../features/seo/catalog-index";
import { CATALOG_REFERENCE_CATEGORIES } from "../features/catalog/catalog.helpers";
import {
  filtersSchema,
  type CollectionFilters,
} from "../features/collection/collection.types";
export const Route = createFileRoute("/collection")({
  staleTime: Infinity,
  preloadStaleTime: Infinity,
  validateSearch: (search) => filtersSchema.parse(search),
  loader: async () => {
    const catalog = await loadSessionCatalog();
    return {
      directory: catalogIndex(catalog),
      referenceDirectory: catalogIndex(catalog, CATALOG_REFERENCE_CATEGORIES),
    };
  },
  head: () =>
    pageMetadata({
      title: CATALOG_TITLE,
      description: CATALOG_DESCRIPTION,
      path: "/collection",
    }),
  component: CollectionRoute,
});
function CollectionRoute() {
  const { directory, referenceDirectory } = Route.useLoaderData();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  function onChange(patch: CollectionFilters) {
    void navigate({
      search: (previous) => {
        const next = { ...previous, ...patch };
        return {
          q: next.q || undefined,
          category: next.category || undefined,
          type: next.type || undefined,
          appliesTo:
            next.category === "enchantment"
              ? next.appliesTo || undefined
              : undefined,
          sort: next.sort === "name" ? undefined : next.sort,
        };
      },
      replace: true,
      resetScroll: false,
    });
  }
  return (
    <CollectionPage
      filters={filters}
      onChange={onChange}
      directory={directory}
      referenceDirectory={referenceDirectory}
    />
  );
}
