import { AppFooter } from "../../components/AppFooter";
import { trackEvent } from "../analytics/analytics.browser";
import { analyticsLabels } from "../analytics/analytics.schema";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { SearchX, TriangleAlert } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { preloadCatalogArtwork } from "../catalog/catalog.artwork";
import { loadSessionCatalog } from "../catalog/catalog.session";
import {
  getCategories,
  getTypes,
  isCatalogItem,
} from "../catalog/catalog.helpers";
import type { CatalogItem } from "../catalog/catalog.types";
import {
  getCatalogItemView,
  getVisibleItemViews,
} from "./collection.presentation";
import type { CollectionFilters } from "./collection.types";
import { CategoryFilters } from "./components/CategoryFilters";
import { CollectionToolbar } from "./components/CollectionToolbar";
import { CollectionSkeleton } from "./components/CollectionSkeleton";
import { ItemList } from "./components/ItemList";
import { CatalogDirectory } from "../seo/CatalogDirectory";
import type { CatalogIndexGroup } from "../seo/catalog-index";
let browserCatalog: CatalogItem[] | undefined;
export function CollectionPage({
  filters,
  onChange,
  directory,
}: {
  filters: CollectionFilters;
  onChange: (patch: CollectionFilters) => void;
  directory: CatalogIndexGroup[];
}) {
  const [catalog, setCatalog] = useState<CatalogItem[] | undefined>(
    () => browserCatalog,
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (browserCatalog) return;
    let active = true;
    async function initialize() {
      try {
        const items = await loadSessionCatalog();
        if (active) {
          browserCatalog = items;
          setCatalog(items);
          setError("");
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load the catalog.",
          );
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <>
      <AppHeader active="collection" />
      <main id="main" className="shell collection-main">
        <div className="catalog-body">
          {error ? (
            <div role="alert" className="page-message">
              <TriangleAlert size={28} />
              <h1>Catalog unavailable</h1>
              <p>We couldn’t load the equipment catalog. Please try again.</p>
              <p className="muted error-detail">{error}</p>
              <Button
                onPress={() => {
                  setError("");
                  setAttempt((a) => a + 1);
                }}
              >
                Try again
              </Button>
            </div>
          ) : catalog ? (
            <CollectionContent
              catalog={catalog}
              filters={filters}
              onChange={onChange}
            />
          ) : (
            <CollectionSkeleton />
          )}
        </div>
        <section
          className="page-about"
          aria-label="About the equipment catalog"
        >
          <h2>Minecraft Dungeons 2 equipment catalog</h2>
          <p>
            Explore weapons, armor, artifacts, talismans, enchantments, and gear
            effects. Search by name and filter by equipment type.
          </p>
        </section>
        <CatalogDirectory groups={directory} />
      </main>
      <AppFooter />
    </>
  );
}
function CollectionContent({
  catalog: definitions,
  filters,
  onChange,
}: {
  catalog: CatalogItem[];
  filters: CollectionFilters;
  onChange: (patch: CollectionFilters) => void;
}) {
  const catalog = useMemo(
    () => definitions.filter(isCatalogItem),
    [definitions],
  );
  const views = useMemo(() => {
    const lookup = new Map(definitions.map((item) => [item.slug, item]));
    return catalog.map((item) => getCatalogItemView(item, lookup));
  }, [catalog, definitions]);
  const categories = useMemo(() => getCategories(catalog), [catalog]);
  const categoryTotals = useMemo(
    () =>
      categories.map((category) => ({
        category,
        total: catalog.filter((item) => item.category === category).length,
      })),
    [catalog, categories],
  );
  const types = useMemo(
    () => getTypes(catalog, filters.category),
    [catalog, filters.category],
  );
  const typeTotals = useMemo(
    () =>
      Object.fromEntries(
        types.map((type) => [
          type,
          catalog.filter(
            (item) =>
              item.type === type &&
              (!filters.category || item.category === filters.category),
          ).length,
        ]),
      ),
    [catalog, types, filters.category],
  );
  const visible = useMemo(
    () => getVisibleItemViews(views, filters),
    [views, filters],
  );
  useEffect(() => preloadCatalogArtwork(visible.slice(0, 24)), [visible]);
  function changeFilters(patch: CollectionFilters) {
    if (patch.q && !filters.q) trackEvent("catalog_search_used", true);
    if (patch.category !== undefined && patch.category !== filters.category) {
      const label = analyticsLabels.find(
        (value) => value === (patch.category || "all"),
      );
      if (label) trackEvent("catalog_category_selected", false, label);
    }
    if (patch.type && patch.type !== filters.type)
      trackEvent("catalog_filter_used", false, "type");
    if (patch.appliesTo && patch.appliesTo !== filters.appliesTo)
      trackEvent("catalog_filter_used", false, "applies_to");
    if (patch.sort && patch.sort !== filters.sort)
      trackEvent("catalog_sort_changed");
    onChange(patch);
  }
  return (
    <>
      <div className="catalog-heading">
        <div>
          <h1>
            Catalog<span className="accent">.</span>
          </h1>
          <p className="muted">
            Browse equipment, enchantments, and gear effects.
          </p>
        </div>
      </div>
      <CategoryFilters
        categories={categoryTotals}
        selected={filters.category}
        onSelect={(category) =>
          changeFilters({ category, type: "", appliesTo: "" })
        }
      />
      <CollectionToolbar
        filters={filters}
        categories={categories}
        types={types}
        typeTotals={typeTotals}
        onChange={changeFilters}
        count={visible.length}
        total={catalog.length}
      />
      {visible.length ? (
        <ItemList items={visible} />
      ) : (
        <div className="empty-state">
          <SearchX size={32} strokeWidth={1.3} />
          <h3>No items found</h3>
          <p>Try another search or give your filters a little room.</p>
          <Button
            variant="secondary"
            onPress={() =>
              changeFilters({
                q: "",
                category: "",
                type: "",
                appliesTo: "",
              })
            }
          >
            Clear filters
          </Button>
        </div>
      )}
    </>
  );
}
