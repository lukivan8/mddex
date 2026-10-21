import { createFileRoute } from "@tanstack/react-router";
import {
  pageMetadata,
  CATALOG_TITLE,
  CATALOG_DESCRIPTION,
} from "../features/seo/metadata";
import { CollectionPage } from "../features/collection/CollectionPage";
import {
  filtersSchema,
  type CollectionFilters,
} from "../features/collection/collection.types";
export const Route = createFileRoute("/collection")({
  staleTime: Infinity,
  preloadStaleTime: Infinity,
  validateSearch: (search) => filtersSchema.parse(search),
  head: () =>
    pageMetadata({
      title: CATALOG_TITLE,
      description: CATALOG_DESCRIPTION,
      path: "/collection",
    }),
  component: CollectionRoute,
});
function CollectionRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  function onChange(patch: CollectionFilters) {
    void navigate({
      search: (previous) => {
        const next = { ...previous, ...patch };
        return {
          q: next.q || undefined,
          effects: next.effects?.length ? next.effects : undefined,
          effectMatch:
            next.effects?.length && next.effectMatch === "any"
              ? "any"
              : undefined,
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
  return <CollectionPage filters={filters} onChange={onChange} />;
}
