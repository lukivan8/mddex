import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { Button, Chip, Toast } from "@heroui/react";
import { Check, SearchX, TriangleAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { preloadCatalogArtwork } from "../catalog/catalog.artwork";
import { loadCatalog } from "../catalog/catalog.loader";
import { getCategories, getTypes } from "../catalog/catalog.helpers";
import type { CatalogItem } from "../catalog/catalog.types";
import {
  getCompletionCollection,
  type CompletionCollection,
} from "./collection.db";
import { buildDiscoveryIndex, tryDiscoverByName } from "./collection.discovery";
import {
  getCatalogItemView,
  getVisibleItemViews,
} from "./collection.presentation";
import {
  getPreferencesCollection,
  setShowAllItems,
  type PreferencesCollection,
} from "./collection.preferences";
import { SpoilerControl } from "./components/SpoilerControl";
import { DiscoveryDialog } from "./components/DiscoveryDialog";
import { toggleOwnership } from "./collection.service";
import {
  getCategoryProgress,
  getOverallProgress,
} from "./collection.selectors";
import type { CollectionFilters } from "./collection.types";
import { CollectionProgress } from "./components/CollectionProgress";
import { CategoryProgress } from "./components/CategoryProgress";
import { CollectionToolbar } from "./components/CollectionToolbar";
import { CollectionSkeleton } from "./components/CollectionSkeleton";
import { ItemList } from "./components/ItemList";
export function CollectionPage({
  filters,
  onChange,
}: {
  filters: CollectionFilters;
  onChange: (patch: CollectionFilters) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>();
  useEffect(() => {
    if (catalog) return preloadCatalogArtwork(catalog);
  }, [catalog]);
  const [collection, setCollection] = useState<CompletionCollection>();
  const [preferences, setPreferences] = useState<PreferencesCollection>();
  const { data: preferenceData } = useLiveQuery({
    query: (q) => (preferences ? q.from({ preferences }) : undefined),
  });
  const showAllItems = preferenceData?.[0]?.showAllItems ?? false;
  function changeShowAllItems(value: boolean) {
    if (!preferences) return;
    try {
      const tx = setShowAllItems(preferences, value);
      void tx.isPersisted.promise.catch(() =>
        Toast.toast.danger(
          "Could not save this preference. The change was undone.",
        ),
      );
    } catch {
      Toast.toast.danger("Could not save this preference. Please try again.");
    }
  }
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function initialize() {
      try {
        const db = getCompletionCollection();
        const prefs = getPreferencesCollection();
        await Promise.all([db.preload(), prefs.preload()]);
        const items = await loadCatalog(undefined, controller.signal);
        if (active) {
          setCollection(db);
          setPreferences(prefs);
          setCatalog(items);
          setError("");
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your collection.",
          );
      }
    }
    void initialize();
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);
  return (
    <>
      <header className="app-header">
        <div className="shell header-inner">
          <Link to="/collection" className="brand" aria-label="MDDEX collection">
            <img src="/mddex-logo.png" alt="" />
            <span>MDDEX</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link to="/collection" className="nav-link" aria-current="page">
              Collection
            </Link>
          </nav>
          <SpoilerControl
            showAllItems={showAllItems}
            onChange={changeShowAllItems}
            disabled={!preferences}
          />
        </div>
      </header>
      <main id="main" className="shell">
        <>
          {error ? (
            <div role="alert" className="page-message">
              <TriangleAlert size={28} />
              <h1>Collection unavailable</h1>
              <p>
                We couldn’t open the catalog or local collection. Your saved
                progress has not been cleared.
              </p>
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
          ) : catalog && collection ? (
            <CollectionContent
              catalog={catalog}
              collection={collection}
              filters={filters}
              onChange={onChange}
              showAllItems={showAllItems}
            />
          ) : (
            <CollectionSkeleton />
          )}
        </>
      </main>
      <Toast.Provider placement="bottom end" />
      <footer className="shell footer">
        <span>
          <img src="/mddex-logo.png" alt="" /> YOUR NEXT DISCOVERY AWAITS.
        </span>
        <span>Unofficial companion · Minecraft Dungeons 2</span>
      </footer>
    </>
  );
}
function CollectionContent({
  showAllItems,
  catalog,
  collection,
  filters,
  onChange,
}: {
  showAllItems: boolean;
  catalog: CatalogItem[];
  collection: CompletionCollection;
  filters: CollectionFilters;
  onChange: (patch: CollectionFilters) => void;
}) {
  const { data } = useLiveQuery({
    query: (q) => q.from({ completion: collection }),
  });
  const owned = useMemo(
    () => new Set(data.filter((r) => r.owned).map((r) => r.itemSlug)),
    [data],
  );
  const discoveryIndex = useMemo(() => buildDiscoveryIndex(catalog), [catalog]);
  const views = useMemo(() => {
    const entries = new Map(data.map((entry) => [entry.itemSlug, entry]));
    return catalog.map((item) =>
      getCatalogItemView(item, entries.get(item.slug), showAllItems),
    );
  }, [catalog, data, showAllItems]);
  const [explainDiscovery, setExplainDiscovery] = useState(false);
  const explained = useRef(false);
  function changeFilters(patch: CollectionFilters) {
    onChange(patch);
    if (showAllItems || patch.q === undefined) return;
    try {
      const discovery = tryDiscoverByName(collection, discoveryIndex, patch.q);
      if (!discovery) return;
      const toast = Toast.toast.success(
        `${discovery.item.variation} discovered and collected.`,
      );
      setSaveError("");
      void discovery.transaction.isPersisted.promise.catch(() => {
        Toast.toast.close(toast);
        setSaveError(
          "Discovery could not be saved and was undone. Please enter the name again to retry.",
        );
      });
    } catch {
      setSaveError("Discovery could not be saved. Please try again.");
    }
  }
  const categories = useMemo(() => getCategories(catalog), [catalog]);
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
  const progress = useMemo(
    () => getOverallProgress(catalog, owned),
    [catalog, owned],
  );
  const categoryProgress = useMemo(
    () =>
      categories.map((category) => ({
        category,
        progress: getCategoryProgress(catalog, owned, category),
      })),
    [catalog, owned, categories],
  );
  const [saveError, setSaveError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const status = useRef(filters.status);
  status.current = filters.status;
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const toggle = useCallback(
    (slug: string) => {
      if (!showAllItems && !collection.get(slug)?.discovered) {
        if (!explained.current) {
          explained.current = true;
          setExplainDiscovery(true);
        } else
          Toast.toast.info(
            "Enter the item’s full name in search to discover and collect it.",
          );
        return;
      }
      const wasOwned = collection.get(slug)?.owned ?? false;
      if (
        (status.current === "missing" && !wasOwned) ||
        (status.current === "collected" && wasOwned)
      ) {
        setLeaving((current) => new Set(current).add(slug));
        const timer = setTimeout(() => {
          setLeaving((current) => {
            const next = new Set(current);
            next.delete(slug);
            return next;
          });
          timers.current.delete(timer);
        }, 180);
        timers.current.add(timer);
      }
      try {
        const transaction = toggleOwnership(collection, slug, showAllItems);
        if (!transaction) return;
        setSaveError("");
        setAnnouncement(
          wasOwned
            ? "Item marked as missing."
            : "Item collected. Saved locally.",
        );
        void transaction.isPersisted.promise.catch(() => {
          setSaveError(
            "This change could not be saved. It has been undone. Check that browser storage is available, then try again.",
          );
          setAnnouncement("Change could not be saved.");
        });
      } catch {
        setSaveError("This change could not be saved. Please try again.");
      }
    },
    [collection, showAllItems],
  );
  const visible = useMemo(() => {
    const filterOwned = new Set(owned);
    for (const slug of leaving) {
      if (filters.status === "missing") filterOwned.delete(slug);
      if (filters.status === "collected") filterOwned.add(slug);
    }
    return getVisibleItemViews(views, filterOwned, filters);
  }, [views, owned, filters, leaving]);
  return (
    <>
      <DiscoveryDialog
        open={explainDiscovery}
        onClose={() => setExplainDiscovery(false)}
      />
      <CollectionProgress progress={progress} />
      <CategoryProgress
        categories={categoryProgress}
        selected={filters.category}
        onSelect={(category) => onChange({ category, type: "" })}
      />
      <div className="catalog-heading">
        <h2>
          The catalog{" "}
          <Chip size="sm" variant="soft">
            {catalog.length}
          </Chip>
        </h2>
        <span className="saving-status">
          <Check size={13} />{" "}
          {saveError ? "Save needs attention" : "Saved on this device"}
        </span>
      </div>
      <CollectionToolbar
        filters={filters}
        categories={categories}
        types={types}
        typeTotals={typeTotals}
        onChange={changeFilters}
        spoilerFree={!showAllItems}
        count={visible.length}
        total={catalog.length}
      />
      {saveError && (
        <div role="alert" className="save-error">
          <TriangleAlert size={18} />
          {saveError}
          <Button size="sm" variant="ghost" onPress={() => setSaveError("")}>
            Dismiss
          </Button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {visible.length ? (
        <ItemList
          items={visible}
          owned={owned}
          leaving={leaving}
          onToggle={toggle}
        />
      ) : (
        <div className="empty-state">
          <SearchX size={32} strokeWidth={1.3} />
          <h3>
            {filters.status === "missing" &&
            !filters.q &&
            !filters.category &&
            !filters.type
              ? "Every item, collected."
              : "No items found"}
          </h3>
          <p>Try another search or give your filters a little room.</p>
          <Button
            variant="secondary"
            onPress={() =>
              onChange({ q: "", category: "", type: "", status: "all" })
            }
          >
            Clear filters
          </Button>
        </div>
      )}
      <div className="catalog-footnote">
        <span>
          Click a revealed item to mark it collected. Click again to undo.
        </span>
        <span>Progress stays in this browser. No account needed.</span>
      </div>
    </>
  );
}
