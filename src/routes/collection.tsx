import { createFileRoute } from "@tanstack/react-router";
import { CollectionPage } from "../features/collection/CollectionPage";
import {
  filtersSchema,
  type CollectionFilters,
} from "../features/collection/collection.types";
export const Route = createFileRoute("/collection")({
  validateSearch: (search) => filtersSchema.parse(search),
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
          category: next.category || undefined,
          type: next.type || undefined,
          status: next.status === "all" ? undefined : next.status,
          sort: next.sort === "name" ? undefined : next.sort,
        };
      },
      replace: true,
      resetScroll: false,
    });
  }
  return <CollectionPage filters={filters} onChange={onChange} />;
}
