import { AppFooter } from "../../components/AppFooter";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useLiveQuery } from "@tanstack/react-db";
import {
  Button,
  Input,
  Modal,
  Skeleton,
  TextField,
  Toast,
} from "@heroui/react";
import { Check, FolderOpen, Plus } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { loadCatalog } from "../catalog/catalog.loader";
import { preloadCatalogArtwork } from "../catalog/catalog.artwork";
import type { CatalogItem } from "../catalog/catalog.types";
import {
  getCompletionCollection,
  type CompletionCollection,
} from "../collection/collection.db";
import { getBuildCollections, type BuildCollections } from "./build.db";
import {
  createBuild,
  deleteBuild,
  equip,
  renameBuild,
  setWorkspace,
} from "./build.service";
import { activeBuild, filledSlots } from "./build.selectors";
import { slotRules } from "./build.compatibility";
import type { BuildTarget } from "./build.types";
import { BuildBoard } from "./components/BuildBoard";
import { BuildSwitcher } from "./components/BuildSwitcher";
import { CatalogPicker, type PickerProps } from "./components/CatalogPicker";
import {
  getPreferencesCollection,
  setShowAllItems,
  type PreferencesCollection,
} from "../collection/collection.preferences";
import { SpoilerControl } from "../collection/components/SpoilerControl";
const mobileQuery = "(max-width: 900px)";
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function BuildPage() {
  const [ready, setReady] = useState<{
    catalog: CatalogItem[];
    db: BuildCollections;
    collection: CompletionCollection;
    spoilers: PreferencesCollection;
  }>();
  const { data: spoilerData } = useLiveQuery({
    query: (q) => (ready ? q.from({ preferences: ready.spoilers }) : undefined),
  });
  const showAllItems = spoilerData?.[0]?.showAllItems ?? false;
  function changeSpoilers(value: boolean) {
    if (!ready) return;
    try {
      void setShowAllItems(ready.spoilers, value).isPersisted.promise.catch(
        () =>
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
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const db = getBuildCollections();
        const collection = getCompletionCollection();
        const spoilers = getPreferencesCollection();
        const [catalog] = await Promise.all([
          loadCatalog(undefined, controller.signal),
          db.builds.preload(),
          db.preferences.preload(),
          collection.preload(),
          spoilers.preload(),
        ]);
        if (!active) return;
        if (db.builds.size === 0) {
          const { build, transaction } = createBuild(db, "Loadout 1");
          await transaction.isPersisted.promise;
          await setWorkspace(db, { activeId: build.id }).isPersisted.promise;
        }
        if (active) {
          setReady({ catalog, db, collection, spoilers });
          setError("");
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Unable to open loadouts.",
          );
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);
  useEffect(
    () => (ready ? preloadCatalogArtwork(ready.catalog) : undefined),
    [ready],
  );
  return (
    <>
      <AppHeader active="build">
        <SpoilerControl
          showAllItems={showAllItems}
          onChange={changeSpoilers}
          disabled={!ready}
        />
      </AppHeader>
      <main id="main" className="shell build-page">
        {error ? (
          <div role="alert" className="page-message">
            <h1>Loadouts unavailable</h1>
            <p>{error}</p>
            <p>Your saved loadouts have not been cleared.</p>
            <Button
              onPress={() => {
                setError("");
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : ready ? (
          <BuildWorkspace {...ready} showAllItems={showAllItems} />
        ) : (
          <div className="build-loading" aria-label="Loading loadout">
            <Skeleton className="skeleton-heading" />
            <Skeleton className="skeleton-heading" />
          </div>
        )}
      </main>
      <Toast.Provider placement="bottom end" />
      <AppFooter />
    </>
  );
}
function BuildWorkspace({
  showAllItems,
  catalog,
  db,
  collection,
}: {
  showAllItems: boolean;
  catalog: CatalogItem[];
  db: BuildCollections;
  collection: CompletionCollection;
}) {
  const { data: builds } = useLiveQuery((q) => q.from({ build: db.builds }));
  const { data: preferences } = useLiveQuery((q) =>
    q.from({ preference: db.preferences }),
  );
  const { data: completion } = useLiveQuery((q) =>
    q.from({ completion: collection }),
  );
  const build = activeBuild(builds, preferences[0]?.activeId);
  const savedAvailability = preferences[0]?.availability ?? "discovered";
  const availability =
    !showAllItems && savedAvailability === "all"
      ? "discovered"
      : savedAvailability;
  const records = useMemo(
    () => new Map(completion.map((r) => [r.itemSlug, r])),
    [completion],
  );
  const catalogMap = useMemo(
    () => new Map(catalog.map((i) => [i.slug, i])),
    [catalog],
  );
  const [target, setTarget] = useState<BuildTarget>({
    kind: "item",
    slot: "melee",
  });
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [switcher, setSwitcher] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalogVisible, setCatalogVisible] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const persist = useCallback(
    (action: () => { isPersisted: { promise: Promise<unknown> } }) => {
      try {
        const tx = action();
        setSaveError("");
        void tx.isPersisted.promise.catch(() => {
          setSaveError(
            "Could not save locally. The change was undone. Check browser storage and try again.",
          );
          setAnnouncement("Change could not be saved.");
        });
      } catch (cause) {
        setSaveError(
          cause instanceof Error
            ? cause.message
            : "Could not save this change.",
        );
      }
    },
    [],
  );
  const newLoadout = () => {
    try {
      const { build: created, transaction } = createBuild(
        db,
        `Loadout ${builds.length + 1}`,
      );
      persist(() => transaction);
      persist(() => setWorkspace(db, { activeId: created.id }));
      setTarget({ kind: "item", slot: "melee" });
      setQuery("");
      setType("");
    } catch {
      setSaveError(
        "Could not create a loadout. Check browser storage and try again.",
      );
    }
  };
  const chooseTarget = (next: BuildTarget) => {
    setTarget(next);
    setQuery("");
    setType("");
    setPickerOpen(true);
    setCatalogVisible(true);
  };
  // Other tabs can clear gear. Keep the picker pointed at a valid equipment target.
  const effectiveTarget = useMemo<BuildTarget>(
    () =>
      target.kind === "enchantment" && !build?.slots[target.slot]
        ? { kind: "item", slot: target.slot }
        : target,
    [target, build],
  );
  const onSelect = useCallback(
    (item: CatalogItem) => {
      if (!build) return;
      persist(() => equip(db, build.id, effectiveTarget, item));
      setAnnouncement(`${item.variation} equipped.`);
      setPickerOpen(false);
    },
    [build, db, effectiveTarget, persist],
  );
  if (!build)
    return (
      <div className="build-loading" aria-label="Loading loadout">
        <Skeleton className="skeleton-heading" />
      </div>
    );
  const equipped = build.slots[effectiveTarget.slot];
  const title =
    effectiveTarget.kind === "item"
      ? `Choose ${slotRules[effectiveTarget.slot].label}`
      : `Choose Enchantment for ${catalogMap.get(equipped!.itemSlug)?.variation ?? "unavailable gear"}`;
  const clear = (next: BuildTarget) => {
    persist(() => equip(db, build.id, next, null));
    setAnnouncement("Slot cleared.");
  };
  const pickerProps: PickerProps = {
    allowAll: showAllItems,
    catalog,
    records,
    target: effectiveTarget,
    availability,
    onAvailability: (value) =>
      persist(() => setWorkspace(db, { availability: value })),
    query,
    onQuery: setQuery,
    type,
    onType: setType,
    selected:
      effectiveTarget.kind === "item"
        ? equipped?.itemSlug
        : equipped?.enchantments[effectiveTarget.index],
    onSelect,
    onClear: () => clear(effectiveTarget),
  };
  return (
    <>
      {saveError && (
        <div role="alert" className="save-error">
          {saveError}
          <Button variant="ghost" size="sm" onPress={() => setSaveError("")}>
            Dismiss
          </Button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {!mobile && (
        <div className="build-view-controls">
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={catalogVisible}
            aria-controls="build-catalog-pane"
            onPress={() => setCatalogVisible((value) => !value)}
          >
            {catalogVisible ? "Hide catalog" : "Show catalog"}
          </Button>
        </div>
      )}
      <div
        className={`build-workspace ${!catalogVisible ? "build-workspace-full" : ""}`}
      >
        <section className="loadout-pane" aria-label="Active loadout">
          <div className="build-heading">
            <div>
              <span className="eyebrow">LOADOUT WORKSPACE</span>
              <TextField
                aria-label="Loadout name"
                value={build.name}
                onChange={(name) =>
                  persist(() => renameBuild(db, build.id, name))
                }
                onBlur={() => {
                  if (!build.name.trim())
                    persist(() =>
                      renameBuild(db, build.id, "Untitled loadout"),
                    );
                }}
              >
                <Input
                  maxLength={80}
                  placeholder="Untitled loadout"
                  className="build-name"
                />
              </TextField>
            </div>
            <Button
              isIconOnly
              variant="secondary"
              aria-label="Saved loadouts"
              onPress={() => setSwitcher(true)}
            >
              <FolderOpen size={18} />
            </Button>
            <Button
              isIconOnly
              variant="secondary"
              aria-label="New loadout"
              onPress={newLoadout}
            >
              <Plus size={18} />
            </Button>
          </div>
          <div className="build-summary">
            <span>{filledSlots(build)} / 12 equipped</span>
            <span className="saving-status">
              <Check size={12} />
              {saveError ? "Save needs attention" : "Saved locally"}
            </span>
          </div>
          <BuildBoard
            build={build}
            catalog={catalogMap}
            target={effectiveTarget}
            onTarget={chooseTarget}
            onClear={clear}
          />
          <p className="picker-note">
            Select a slot to choose equipment. Enchantments stay visible on your
            gear.
          </p>
        </section>
        {!mobile && catalogVisible && (
          <section
            id="build-catalog-pane"
            className="picker-pane"
            aria-label="Equipment picker"
          >
            <span className="eyebrow">
              CATALOG /{" "}
              {effectiveTarget.kind === "enchantment"
                ? `ENCHANTMENT ${effectiveTarget.index + 1}`
                : "EQUIPMENT"}
            </span>
            <h1 className="picker-title">{title}</h1>
            <CatalogPicker {...pickerProps} />
          </section>
        )}
      </div>
      <BuildSwitcher
        open={switcher}
        onClose={() => setSwitcher(false)}
        builds={builds}
        activeId={build.id}
        onSwitch={(id) => {
          persist(() => setWorkspace(db, { activeId: id }));
          setTarget({ kind: "item", slot: "melee" });
          setQuery("");
          setType("");
        }}
        onDelete={async (id) => {
          await deleteBuild(db, id);
          setAnnouncement("Loadout deleted.");
          if (id === build.id) {
            setTarget({ kind: "item", slot: "melee" });
            setQuery("");
            setType("");
          }
        }}
        onNew={newLoadout}
      />
      {mobile && (
        <Modal.Backdrop isOpen={pickerOpen} onOpenChange={setPickerOpen}>
          <Modal.Container placement="bottom" className="build-picker-sheet">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body>
                {saveError && <p role="alert">{saveError}</p>}
                <CatalogPicker {...pickerProps} />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </>
  );
}
