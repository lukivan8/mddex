import { BuildPowerInputs } from "./components/BuildPowerInputs";
import { trackEvent } from "../analytics/analytics.browser";
import type { AnalyticsEvent } from "../analytics/analytics.schema";
import { Link, useNavigate } from "@tanstack/react-router";
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@heroui/react";
import { FolderOpen, Plus, TriangleAlert } from "lucide-react";
import { buttonVariants } from "@heroui/styles";
import { AppHeader } from "../../components/AppHeader";
import { loadSessionCatalog } from "../catalog/catalog.session";
import { preloadCatalogArtwork } from "../catalog/catalog.artwork";
import type { CatalogItem } from "../catalog/catalog.types";
import { getBuildCollections, type BuildCollections } from "./build.db";
import {
  createBuild,
  deleteBuild,
  duplicateBuild,
  compose,
  composeItemPower,
  setWorkspace,
} from "./build.service";
import { activeBuild } from "./build.selectors";
import {
  uniqueEffect,
  uniqueEffectCatalog,
  withUniqueEffects,
} from "./build.unique";
import {
  composeSelection,
  selectedSlug,
  selectionTargets,
} from "./build.selection";
import { slotRules, incompatibleModifiers } from "./build.compatibility";
import {
  BUILD_SLOTS,
  EFFECT_COUNT,
  type Build,
  type BuildSlot,
  type BuildTarget,
  type ModifierTier,
} from "./build.types";
import { useRouterState } from "@tanstack/react-router";
import { resolveSharedBuild } from "../sharing/sharing.browser";
import { ShareBuildButton } from "./components/BuildSharing";
import { BuildSummary } from "./components/BuildSummary";
import { BuildVariants } from "./components/BuildVariants";
import {
  addBuildVariant,
  removeBuildVariant,
  selectBuildVariant,
  updateBuildVariant,
  variantNumeral,
} from "./build.variants";
import { BuildBoard } from "./components/BuildBoard";
import { BuildSwitcher } from "./components/BuildSwitcher";
import { CatalogPicker, type PickerProps } from "./components/CatalogPicker";
const mobileQuery = "(max-width: 900px)";
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
type BuildReady = {
  catalog: CatalogItem[];
  db: BuildCollections;
};
let browserReady: BuildReady | undefined;
const loadingBuild: Build = {
  id: "loading-build",
  name: "Loadout 1",
  createdAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
  slots: Object.fromEntries(
    BUILD_SLOTS.map((slot) => [slot, null]),
  ) as Build["slots"],
};
export function BuildPage() {
  const returningToCommunity = useRouterState({
    select: (state) => state.location.search.community === "post",
  });
  const [ready, setReady] = useState<BuildReady | undefined>(
    () => browserReady,
  );
  const [error, setError] = useState("");
  const [localDb, setLocalDb] = useState<BuildCollections | undefined>(
    () => browserReady?.db,
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (browserReady) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("share"))
      void resolveSharedBuild(url, AbortSignal.timeout(15_000)).catch(() => {});
    void (async () => {
      try {
        const db = getBuildCollections();
        const catalogPromise = loadSessionCatalog();
        // Local storage can fail independently; keep the remote request handled.
        void catalogPromise.catch(() => {});
        await Promise.all([db.builds.preload(), db.preferences.preload()]);
        if (!active) return;
        if (db.builds.size === 0) {
          const { build, transaction } = createBuild(db, "Loadout 1");
          await transaction.isPersisted.promise;
          await setWorkspace(db, { activeId: build.id }).isPersisted.promise;
        }
        setLocalDb(db);
        const catalog = await catalogPromise;
        if (active) {
          browserReady = { catalog, db };
          setReady(browserReady);
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
    };
  }, [attempt]);
  return (
    <>
      <AppHeader active="build" />
      <main id="main" className="shell build-page">
        <header className="build-introduction">
          <h1>Minecraft Dungeons 2 build maker</h1>
          <p>
            Create a loadout with weapons, armor, artifacts, and talismans.
            Choose enchantments and gear effects, review the summary, and share
            your build. Free to use, with no account required.
          </p>
        </header>
        {returningToCommunity && (
          <div className="community-builder-return">
            <span className="muted">
              Equip your loadout, then share it with the community.
            </span>
            <Link
              to="/community/new"
              className={buttonVariants({ variant: "secondary" })}
            >
              Continue to posting →
            </Link>
          </div>
        )}
        {error ? (
          <div role="alert" className="page-message">
            <h2>Loadouts unavailable</h2>
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
          <BuildWorkspace {...ready} />
        ) : localDb ? (
          <LocalBuildLoading db={localDb} />
        ) : (
          <BuildLoadingLayout build={loadingBuild} />
        )}
        <BuildGuide />
      </main>
      <Toast.Provider placement="bottom end" />
      <AppFooter />
    </>
  );
}
function BuildGuide() {
  return (
    <section
      className="page-about build-guide"
      aria-labelledby="build-guide-title"
    >
      <h2 id="build-guide-title">How to make a Minecraft Dungeons 2 build</h2>
      <p>
        MDDEX is a build planner for Minecraft Dungeons II. Start with an empty
        loadout or open a shared build, then choose equipment for all 12 slots:
        a melee weapon, a ranged weapon, four armor pieces, three artifacts, and
        three talismans.
      </p>
      <ol>
        <li>
          <strong>Choose your equipment.</strong> Select a slot to see
          compatible items in the catalog. Search by name or filter by type,
          then select an item to equip it. Open the{" "}
          <Link to="/collection">equipment catalog</Link> to inspect item stats,
          effects, related equipment, and listed drops.
        </li>
        <li>
          <strong>Add enchantments and gear effects.</strong> Select a modifier
          slot to choose its effect and tier. Unique effects stay attached to
          their equipment. Review compatibility warnings when changing items.
        </li>
        <li>
          <strong>Review your loadout.</strong> Set item power and switch to
          Summary to review your equipment and effects together. Compare boss
          fights and grinding setups with the variant tabs. Add a variant to
          copy your current equipment, then give it a descriptive name.
        </li>
        <li>
          <strong>Save and share.</strong> Builds save in this browser. Use
          Share build to create a link that a friend can open and save as a
          separate copy, including all of its variants.
        </li>
      </ol>
      <h3>Where can I find the equipment for my build?</h3>
      <p>
        Equipment pages list the available drop sources and link to related
        locations. Browse <Link to="/mobs">mobs, bosses, and locations</Link> to
        check known encounters and explicit item drops. A mob appearing in a
        location does not by itself mean that it drops every item there.
      </p>
      <h3>Do I need an account to use the build maker?</h3>
      <p>
        No. Planning, local saving, and sharing build links work without an
        account. Local loadouts belong to this browser; use a share link to
        transfer a build to another device. Clearing browser data can remove
        locally saved loadouts.
      </p>
      <h3>Can I customize someone else’s build?</h3>
      <p>
        Yes. Open their share link and save your own copy before changing its
        equipment. You can also browse{" "}
        <Link to="/community">community builds</Link> for loadouts and creator
        notes.
      </p>
    </section>
  );
}
const pendingCatalog = new Map<string, CatalogItem>();
function LocalBuildLoading({ db }: { db: BuildCollections }) {
  const { data: builds } = useLiveQuery((q) => q.from({ build: db.builds }));
  const { data: preferences } = useLiveQuery((q) =>
    q.from({ preference: db.preferences }),
  );
  return (
    <BuildLoadingLayout
      build={activeBuild(builds, preferences[0]?.activeId) ?? loadingBuild}
    />
  );
}
function BuildLoadingLayout({ build }: { build: Build }) {
  return (
    <div
      className="build-loading"
      role="status"
      aria-label="Loading equipment catalog"
    >
      <span className="sr-only">Loading equipment catalog…</span>
      <div aria-hidden="true">
        <div className="build-view-controls">
          <div className="build-view-actions">
            <Skeleton className="build-loading-share" />
            <BuildVariants
              build={build}
              disabled
              onSelect={() => {}}
              onAdd={() => {}}
            />
          </div>
          <div className="build-loading-tabs">
            <span>Catalog</span>
            <span>Summary</span>
          </div>
        </div>
        <div className="build-workspace">
          <section className="loadout-pane">
            <div className="build-heading">
              <div>
                <span className="eyebrow">
                  Build<span className="accent">.</span>
                </span>
                <TextField
                  aria-label="Loading loadout name"
                  value={build.name}
                  isDisabled
                >
                  <Input className="build-name" />
                </TextField>
              </div>
              <Button
                isIconOnly
                variant="secondary"
                isDisabled
                aria-label="Saved loadouts"
              >
                <FolderOpen size={18} />
              </Button>
              <Button
                isIconOnly
                variant="secondary"
                isDisabled
                aria-label="New loadout"
              >
                <Plus size={18} />
              </Button>
            </div>
            <BuildBoard
              build={build}
              catalog={pendingCatalog}
              catalogPending
              readOnly
              target={{ kind: "item", slot: "melee" }}
              onTarget={() => {}}
              onClear={() => {}}
            />
          </section>
          <section className="picker-pane" aria-label="Equipment picker">
            <span className="eyebrow">CATALOG / EQUIPMENT</span>
            <h2 className="picker-title">Choose Melee weapon</h2>
            <div className="catalog-picker">
              <Skeleton className="build-loading-search" />
              <Skeleton className="build-loading-types" />
              <Skeleton className="build-loading-meta" />
              <div className="picker-results">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton className="build-loading-result" key={index} />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
function BuildWorkspace({
  catalog,
  db,
}: {
  catalog: CatalogItem[];
  db: BuildCollections;
}) {
  const { data: builds } = useLiveQuery((q) => q.from({ build: db.builds }));
  const { data: preferences } = useLiveQuery((q) =>
    q.from({ preference: db.preferences }),
  );
  const savedBuild = activeBuild(builds, preferences[0]?.activeId);
  const catalogMap = useMemo(() => uniqueEffectCatalog(catalog), [catalog]);
  const [target, setTarget] = useState<BuildTarget>({
    kind: "item",
    slot: "melee",
  });
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [switcher, setSwitcher] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [panel, setPanel] = useState<"catalog" | "summary">("catalog");
  const catalogVisible = panel === "catalog";
  const [sharedBuild, setSharedBuild] = useState<Build>();
  const rootBuild = sharedBuild ?? savedBuild;
  const [variantSelection, setVariantSelection] = useState<{
    buildId: string;
    id?: string;
  }>();
  const variantId =
    variantSelection?.buildId === rootBuild?.id &&
    rootBuild?.variants?.some((entry) => entry.id === variantSelection?.id)
      ? variantSelection?.id
      : undefined;
  const variantIndex = variantId
    ? (rootBuild?.variants?.findIndex((entry) => entry.id === variantId) ??
        -1) + 1
    : 0;
  const build = useMemo(() => {
    return rootBuild
      ? withUniqueEffects(selectBuildVariant(rootBuild, variantId), catalogMap)
      : undefined;
  }, [rootBuild, variantId, catalogMap]);
  useEffect(() => {
    if (!build) return;
    const slugs = new Set(
      Object.values(build.slots).flatMap((slot) =>
        slot ? [slot.itemSlug, ...slot.effects, ...slot.enchantments] : [],
      ),
    );
    return preloadCatalogArtwork(
      catalog.filter((item) => slugs.has(item.slug)),
    );
  }, [build, catalog]);
  const [savingShared, setSavingShared] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const locationHref = useRouterState({
    select: (state) => state.location.href,
  });
  const navigate = useNavigate();
  const closeShared = () => {
    setSharedBuild(undefined);
    setLinkError("");
    setLinkLoading(false);
    void navigate({
      to: "/build",
      search: {},
      hash: "",
      replace: true,
      resetScroll: false,
    });
  };
  useEffect(() => {
    let revision = 0;
    let controller: AbortController;
    const readLink = () => {
      const current = ++revision;
      setSharedBuild(undefined);
      setLinkError("");
      controller?.abort();
      setLinkLoading(false);
      const url = new URL(window.location.href);
      if (!url.hash.startsWith("#build=") && !url.searchParams.has("share"))
        return;
      setLinkLoading(true);
      controller = new AbortController();
      const linkHref = url.href;
      void resolveSharedBuild(url, controller.signal)
        .then((shared) => {
          if (current === revision && window.location.href === linkHref) {
            setSharedBuild(shared);
            trackEvent("shared_build_opened");
            setPanel("summary");
            setPickerOpen(false);
            setQuery("");
            setType("");
            setTarget({ kind: "item", slot: "melee" });
          }
        })
        .catch((cause) => {
          if (current === revision && window.location.href === linkHref)
            setLinkError(
              cause instanceof Error
                ? cause.message
                : "Could not open this build link.",
            );
        })
        .finally(() => {
          if (current === revision) setLinkLoading(false);
        });
    };
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => {
      revision++;
      controller?.abort();
      window.removeEventListener("hashchange", readLink);
    };
  }, [locationHref]);
  const [saveError, setSaveError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const persist = useCallback(
    (
      action: () => { isPersisted: { promise: Promise<unknown> } },
      success?: AnalyticsEvent,
    ) => {
      try {
        const tx = action();
        setSaveError("");
        void tx.isPersisted.promise
          .then(() => {
            if (success) trackEvent(success);
          })
          .catch(() => {
            trackEvent("build_save_failed");
            setSaveError(
              "Could not save locally. The change was undone. Check browser storage and try again.",
            );
            setAnnouncement("Change could not be saved.");
          });
      } catch (cause) {
        trackEvent("build_save_failed");
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
    trackEvent("build_create_attempt");
    try {
      const { build: created, transaction } = createBuild(
        db,
        `Loadout ${builds.length + 1}`,
      );
      persist(() => transaction, "build_created");
      persist(() => setWorkspace(db, { activeId: created.id }));
      closeShared();
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
    trackEvent("build_slot_selected");
    setTarget(next);
    setQuery("");
    setType("");
    setPickerOpen(true);
    setPanel("catalog");
  };
  // Other tabs can clear gear. Keep the picker pointed at a valid equipment target.
  const effectiveTarget = useMemo<BuildTarget>(
    () =>
      target.kind !== "item" && !build?.slots[target.slot]
        ? { kind: "item", slot: target.slot }
        : target,
    [target, build],
  );
  const pickerTargetKey = `${effectiveTarget.kind}:${effectiveTarget.slot}:${effectiveTarget.kind === "item" ? "" : effectiveTarget.index}`;
  const groupTargets = selectionTargets(effectiveTarget);
  const multiple = groupTargets.length > 1;
  const saveSelection = useCallback(
    (item: CatalogItem | null, tier?: ModifierTier) => {
      if (!build) throw new Error("This loadout is no longer available.");
      const edit = (current: Build) =>
        updateBuildVariant(current, variantId, (selected) =>
          composeSelection(selected, effectiveTarget, item, catalogMap, tier),
        );
      if (sharedBuild) {
        setSharedBuild((current) => (current ? edit(current) : current));
        return { isPersisted: { promise: Promise.resolve() } };
      }
      const current = db.builds.get(build.id);
      if (!current) throw new Error("This loadout is no longer available.");
      const next = edit(current);
      return db.builds.update(build.id, (saved) => {
        Object.assign(saved, next);
      });
    },
    [build, sharedBuild, db, effectiveTarget, catalogMap, variantId],
  );
  const onSelect = useCallback(
    (item: CatalogItem, tier?: ModifierTier) => {
      if (!build) return;
      trackEvent("build_equip_attempt");
      persist(() => saveSelection(item, tier), "build_equipped");
      setAnnouncement(`${item.variation} selection updated.`);
      if (!multiple) setPickerOpen(false);
    },
    [build, saveSelection, multiple, persist],
  );
  if (!build || linkLoading)
    return (
      <div className="build-loading" aria-label="Loading loadout">
        <Skeleton className="skeleton-heading" />
      </div>
    );
  const changeRoot = (edit: (current: Build) => Build) => {
    if (sharedBuild) {
      setSharedBuild((current) => (current ? edit(current) : current));
    } else
      persist(() => {
        const current = db.builds.get(build.id);
        if (!current) throw new Error("This loadout is no longer available.");
        const next = edit(current);
        return db.builds.update(build.id, (saved) => {
          Object.assign(saved, next);
        });
      });
  };
  const changeVariant = (edit: (selected: Build) => Build) =>
    changeRoot((current) => updateBuildVariant(current, variantId, edit));
  const chooseVariant = (id?: string) => {
    setVariantSelection({ buildId: build.id, id });
    setPickerOpen(false);
    setTarget({ kind: "item", slot: "melee" });
    setQuery("");
    setType("");
  };
  const changeItemPower = (slot: BuildSlot, power: number) => {
    changeVariant((selected) => composeItemPower(selected, slot, power));
  };
  const compatibilityIssues = incompatibleModifiers(build, catalogMap);
  const hideWarnings = preferences[0]?.hideCompatibilityWarnings ?? false;
  const setWarningsHidden = (hidden: boolean) =>
    persist(() => setWorkspace(db, { hideCompatibilityWarnings: hidden }));
  const equipped = build.slots[effectiveTarget.slot];
  const fixed = equipped
    ? uniqueEffect(catalogMap.get(equipped.itemSlug))
    : undefined;
  const title =
    effectiveTarget.kind === "item" && multiple
      ? `Choose up to 3 ${effectiveTarget.slot.startsWith("artifact") ? "Artifacts" : "Talismans"}`
      : effectiveTarget.kind === "item"
        ? `Choose ${slotRules[effectiveTarget.slot].label}`
        : `Choose ${effectiveTarget.kind === "effect" ? `up to ${EFFECT_COUNT} Effects` : "Enchantment"} for ${catalogMap.get(equipped!.itemSlug)?.variation ?? "unavailable gear"}`;
  const clear = (next: BuildTarget) => {
    changeVariant((selected) => compose(selected, next, null, catalogMap));
    setAnnouncement("Slot cleared.");
  };
  const rename = (name: string) => {
    changeVariant((selected) => ({
      ...selected,
      name: name.slice(0, 80),
      updatedAt: new Date().toISOString(),
    }));
  };
  const saveLocally = async () => {
    if (!sharedBuild || savingShared) return;
    setSavingShared(true);
    setSaveError("");
    try {
      const copy = {
        ...withUniqueEffects(sharedBuild, catalogMap),
        ...(sharedBuild.variants
          ? {
              variants: sharedBuild.variants.map((variant) => ({
                ...variant,
                slots: withUniqueEffects(
                  { ...sharedBuild, ...variant },
                  catalogMap,
                ).slots,
              })),
            }
          : {}),
      };
      if (db.builds.has(sharedBuild.id)) {
        await db.builds.update(sharedBuild.id, (saved) => {
          Object.assign(saved, copy);
        }).isPersisted.promise;
      } else await db.builds.insert(copy).isPersisted.promise;
      await setWorkspace(db, { activeId: sharedBuild.id }).isPersisted.promise;
      trackEvent("shared_build_saved");
      closeShared();
      setAnnouncement("Build saved locally.");
    } catch {
      setSaveError("Could not save locally. Try again.");
    } finally {
      setSavingShared(false);
    }
  };
  const pickerProps: PickerProps = {
    catalog,
    target: effectiveTarget,
    equipment: equipped ? catalogMap.get(equipped.itemSlug) : undefined,
    query,
    onQuery: setQuery,
    type,
    onType: setType,
    selected:
      effectiveTarget.kind === "item"
        ? equipped?.itemSlug
        : effectiveTarget.kind === "effect"
          ? equipped?.effects[effectiveTarget.index]
          : equipped?.enchantments[effectiveTarget.index],
    selectedSlugs: groupTargets
      .map((position) => selectedSlug(build, position))
      .filter((slug): slug is string => !!slug),
    lockedSlugs: effectiveTarget.kind === "effect" && fixed ? [fixed.slug] : [],
    lockedEffect: effectiveTarget.kind === "effect" ? fixed : undefined,
    selectedTiers: Object.fromEntries(
      groupTargets.flatMap((position) => {
        const slug = selectedSlug(build, position);
        const gear = build.slots[position.slot];
        return slug
          ? [
              [
                slug,
                position.kind === "item"
                  ? gear?.itemTier
                  : position.kind === "effect"
                    ? gear?.effectTiers?.[position.index]
                    : gear?.enchantmentTier,
              ],
            ]
          : [];
      }),
    ),
    multiple,
    onSelect,
    onClear: () => {
      if (multiple) persist(() => saveSelection(null), "build_slot_cleared");
      else clear(effectiveTarget);
    },
  };
  return (
    <>
      {linkError && (
        <div role="alert" className="save-error">
          {linkError}
          <Button variant="ghost" size="sm" onPress={closeShared}>
            Dismiss
          </Button>
        </div>
      )}
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
      <div className="build-view-controls">
        <div className="build-view-actions">
          {sharedBuild ? (
            <Button
              variant="secondary"
              size="sm"
              isDisabled={savingShared}
              onPress={() => {
                void saveLocally();
              }}
            >
              {savingShared ? "Saving…" : "Save locally"}
            </Button>
          ) : (
            <ShareBuildButton build={rootBuild!} />
          )}

          <BuildVariants
            build={rootBuild!}
            selectedId={variantId}
            disabled={savingShared}
            onSelect={chooseVariant}
            onAdd={() => {
              const added = addBuildVariant(rootBuild!, variantId);
              changeRoot(() => added.build);
              chooseVariant(added.variant.id);
              setAnnouncement(
                "Variant added. Name it for a boss fight or grinding.",
              );
            }}
            onRemove={() => {
              if (variantId)
                changeRoot((current) => removeBuildVariant(current, variantId));
              chooseVariant();
              setAnnouncement("Variant deleted.");
            }}
          />
        </div>

        <ToggleButtonGroup
          className="build-panel-switcher"
          aria-label="Build panel"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[panel]}
          onSelectionChange={(keys) => {
            const next = [...keys][0] === "summary" ? "summary" : "catalog";
            if (next === "summary" && panel !== "summary")
              trackEvent("build_summary_viewed", true);
            setPanel(next);
          }}
        >
          <ToggleButton id="catalog">Catalog</ToggleButton>
          <ToggleButton id="summary">Summary</ToggleButton>
        </ToggleButtonGroup>
      </div>
      <div className="build-workspace">
        <section className="loadout-pane" aria-label="Active loadout">
          <div className="build-heading">
            <div>
              <span className="eyebrow">
                Build<span className="accent">.</span>
              </span>
              <div className="build-name-row">
                <TextField
                  className="build-name-field"
                  style={{ width: `${(build.name.length || 20) + 1}ch` }}
                  aria-label="Loadout name"
                  value={build.name}
                  isDisabled={savingShared}
                  onChange={rename}
                  onBlur={() => {
                    if (!variantId && !build.name.trim())
                      rename("Untitled loadout");
                  }}
                >
                  <Input
                    maxLength={80}
                    placeholder={
                      variantId
                        ? `Variant ${variantNumeral(variantIndex)} name`
                        : "Untitled loadout"
                    }
                    className="build-name"
                  />
                </TextField>
                {compatibilityIssues.length > 0 && hideWarnings && (
                  <Tooltip delay={150}>
                    <Tooltip.Trigger<"button">
                      render={(props) => (
                        <button
                          {...props}
                          type="button"
                          className="build-warning-toggle"
                          aria-label="Show compatibility warnings"
                          onClick={() => setWarningsHidden(false)}
                        >
                          <TriangleAlert size={18} />
                        </button>
                      )}
                    />
                    <Tooltip.Content className="build-warning-tooltip">
                      <p>
                        Some saved modifiers do not fit the current gear.
                        Replace or clear them.
                      </p>
                      <ul>
                        {compatibilityIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </Tooltip.Content>
                  </Tooltip>
                )}
              </div>
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
          {compatibilityIssues.length > 0 && !hideWarnings && (
            <div className="build-compatibility-warning" role="status">
              <p>
                Some saved modifiers do not fit the current gear. Replace or
                clear them.
              </p>
              <ul>
                {compatibilityIssues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => setWarningsHidden(true)}
              >
                Hide warnings
              </Button>
            </div>
          )}
          <BuildBoard
            build={build}
            catalog={catalogMap}
            readOnly={savingShared}
            target={
              (mobile ? pickerOpen : catalogVisible)
                ? effectiveTarget
                : undefined
            }
            onTarget={chooseTarget}
            onClear={clear}
          />
          <BuildPowerInputs
            key={`${build.id}:${variantId ?? "base"}`}
            build={build}
            disabled={savingShared}
            onChange={changeItemPower}
          />
        </section>
        {panel === "catalog" && !mobile && (
          <section
            id="build-catalog-pane"
            key={pickerTargetKey}
            className="picker-pane"
            aria-label="Equipment picker"
            tabIndex={0}
          >
            <span className="eyebrow">
              CATALOG /{" "}
              {effectiveTarget.kind === "effect"
                ? "EFFECTS"
                : effectiveTarget.kind === "enchantment"
                  ? "ENCHANTMENTS"
                  : "EQUIPMENT"}
            </span>
            <h2 className="picker-title">{title}</h2>
            <CatalogPicker {...pickerProps} />
          </section>
        )}
        <section
          className={`picker-pane summary-pane${panel === "catalog" ? " summary-pane--mobile-only" : ""}`}
          aria-label="Build summary"
          tabIndex={mobile ? -1 : 0}
        >
          <BuildSummary build={build} catalog={catalogMap} />
        </section>
      </div>
      <BuildSwitcher
        open={switcher}
        onClose={() => setSwitcher(false)}
        builds={builds}
        activeId={build.id}
        onSwitch={(id) => {
          persist(() => setWorkspace(db, { activeId: id }), "build_switched");
          closeShared();
          setTarget({ kind: "item", slot: "melee" });
          setQuery("");
          setType("");
        }}
        onDelete={async (id) => {
          await deleteBuild(db, id);
          trackEvent("build_deleted");
          setAnnouncement("Loadout deleted.");
          if (id === build.id) {
            setTarget({ kind: "item", slot: "melee" });
            setQuery("");
            setType("");
          }
        }}
        onDuplicate={async (id) => {
          const { build: copied, transaction } = duplicateBuild(db, id);
          await transaction.isPersisted.promise;
          await setWorkspace(db, { activeId: copied.id }).isPersisted.promise;
          closeShared();
          setTarget({ kind: "item", slot: "melee" });
          setQuery("");
          setType("");
          setAnnouncement("Loadout duplicated.");
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
              <Modal.Body key={pickerTargetKey}>
                {saveError && <p role="alert">{saveError}</p>}
                <CatalogPicker {...pickerProps} />
              </Modal.Body>
              {multiple && (
                <Modal.Footer>
                  <Button onPress={() => setPickerOpen(false)}>Done</Button>
                </Modal.Footer>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </>
  );
}
