import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "@heroui/react";
import { useLiveQuery } from "@tanstack/react-db";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Route as RouteIcon,
  ExternalLink,
  ScrollText,
  Check,
  X,
  Skull,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { AppFooter } from "../../components/AppFooter";
import { getBuildCollections, type BuildCollections } from "../builds/build.db";
import type { Build } from "../builds/build.types";
import { BuildVariants } from "../builds/components/BuildVariants";
import { resolveSharedBuild } from "../sharing/sharing.browser";
import {
  loadSessionCatalog,
  loadSessionCatalogDetail,
} from "../catalog/catalog.session";
import { resolveSourceArtwork } from "../catalog-details/source-artwork";
import { FilterSelect } from "../collection/components/FilterToolbar";
import { TRACKER_STORAGE_KEY, parseTrackerSave, markKey } from "./item-tracker";
import { LocationIcon } from "./LocationIcon";
import {
  buildFarmItems,
  buildFarmEffects,
  projectFarmTarget,
  minimumFarmPlan,
  farmTypes,
  type FarmTarget,
  type FarmOption,
  type RecommendedBoss,
} from "./farm-planner";

function StopIcon({ source }: { source: { type: string; image?: string } }) {
  return source.type === "quest" ? (
    <span className="location-icon" aria-hidden="true">
      <ScrollText size={22} />
    </span>
  ) : (
    <LocationIcon image={source.image} />
  );
}

function SourceName({
  source,
}: {
  source: { name: string; path?: string; quest?: string };
}) {
  return source.quest ? (
    <Link
      to="/resources/quests"
      search={{ quest: source.quest }}
      hash="quest-details"
    >
      {source.name}
    </Link>
  ) : source.path ? (
    <Link to={source.path}>{source.name}</Link>
  ) : (
    <span>{source.name}</span>
  );
}
function Chance({ source }: { source: FarmOption }) {
  return (
    <>
      {source.dropChance && (
        <small className="planner-chance">{source.dropChance.text}</small>
      )}
      {source.description && <small>{source.description}</small>}
    </>
  );
}
function BossRecommendation({
  boss,
  active = false,
}: {
  boss?: RecommendedBoss;
  active?: boolean;
}) {
  if (!boss) return null;
  return (
    <div className="planner-boss">
      {boss.image ? (
        <img src={boss.image} alt="" width={24} height={24} loading="lazy" />
      ) : (
        <Skull size={18} aria-hidden="true" />
      )}
      <span>
        {active ? "Farm boss: " : "Recommended boss: "}
        {boss.path ? <Link to={boss.path}>{boss.name}</Link> : boss.name}
      </span>
    </div>
  );
}
function TargetEffects({ target }: { target: FarmTarget }) {
  return target.effectSets?.map(({ slot, effects }) => (
    <div
      className="planner-item-effects"
      key={slot}
      role="group"
      aria-label={`${slot} effect combination`}
    >
      {effects.map((effect, index) => (
        <Tooltip key={`${effect.slug}:${index}`} delay={150}>
          <Tooltip.Trigger<"span">
            render={(props) => (
              <span
                {...props}
                tabIndex={0}
                className="planner-effect-icon"
                aria-label={effect.name}
              >
                {effect.image ? (
                  <img
                    src={effect.image}
                    alt=""
                    width={24}
                    height={24}
                    loading="lazy"
                  />
                ) : (
                  <span aria-hidden="true">?</span>
                )}
              </span>
            )}
          />
          <Tooltip.Content className="planner-item-tooltip">
            {effect.name}
          </Tooltip.Content>
        </Tooltip>
      ))}
    </div>
  ));
}
function SavedBuildPicker({
  db,
  onChoose,
  value,
}: {
  db: BuildCollections;
  onChoose: (build: Build) => void;
  value: string;
}) {
  const { data: builds } = useLiveQuery((q) => q.from({ build: db.builds }));
  const sorted = [...builds].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return (
    <FilterSelect
      label="Saved build"
      value={value}
      onChange={(id) => {
        const build = builds.find((build) => build.id === id);
        if (build) onChoose(build);
      }}
      options={[
        {
          id: "",
          name: sorted.length
            ? "Choose a saved build…"
            : "No saved builds on this device",
        },
        ...sorted.map((build) => ({
          id: build.id,
          name: build.name || "Untitled build",
        })),
      ]}
    />
  );
}
export function FarmPlannerPage() {
  const [db, setDb] = useState<BuildCollections>();
  const [storageError, setStorageError] = useState("");
  const [farmBosses, setFarmBosses] = useState(false);
  const [build, setBuild] = useState<Build>();
  const [savedId, setSavedId] = useState("");
  const [variantId, setVariantId] = useState("base");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [targets, setTargets] = useState<FarmTarget[]>([]);
  const [selectionOverrides, setSelectionOverrides] = useState<
    Map<string, boolean>
  >(new Map());
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [trackerError, setTrackerError] = useState("");
  useEffect(() => {
    const read = () => {
      try {
        setCollected(
          parseTrackerSave(localStorage.getItem(TRACKER_STORAGE_KEY)),
        );
        setTrackerError("");
      } catch {
        setCollected(new Set());
        setTrackerError(
          "Could not read tracker progress. Item selection remains manual.",
        );
      }
    };
    const sync = (event: StorageEvent) => {
      if (event.key === TRACKER_STORAGE_KEY || event.key === null) read();
    };
    read();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", read);
    window.addEventListener("pageshow", read);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", read);
      window.removeEventListener("pageshow", read);
    };
  }, []);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const imports = useRef({ id: 0 }).current;
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const collections = getBuildCollections();
        await collections.builds.preload();
        if (active) setDb(collections);
      } catch (error) {
        if (active)
          setStorageError(
            error instanceof Error
              ? error.message
              : "Saved builds are unavailable.",
          );
      }
    })();
    return () => {
      active = false;
      imports.id++;
    };
  }, [imports]);
  const selectedVariant = build?.variants?.find(
    (variant) => variant.id === variantId,
  );
  const slots = selectedVariant?.slots ?? build?.slots;
  useEffect(() => {
    if (!slots) return;
    let active = true;
    setLoading(true);
    setDataError("");
    setTargets([]);
    void (async () => {
      try {
        const catalog = await loadSessionCatalog();
        const items = await Promise.all(
          buildFarmItems(slots).map(async ({ slug, slots, oneTime }) => {
            const item = catalog.find((item) => item.slug === slug);
            if (!item)
              return {
                slug,
                name: slug,
                image: null,
                slots,
                oneTime,
                options: [],
                notes: [],
                error:
                  "This item is not in the current catalog. Your build reference has been preserved.",
              } satisfies FarmTarget;
            try {
              return {
                ...projectFarmTarget(
                  await loadSessionCatalogDetail(item),
                  slots,
                  catalog,
                ),
                oneTime,
              };
            } catch {
              return {
                slug,
                name: item.variation,
                image: item.image,
                slots,
                oneTime,
                options: [],
                notes: [],
                error: "Could not load acquisition sources. Try again.",
              } satisfies FarmTarget;
            }
          }),
        );
        const sources = await resolveSourceArtwork(
          items.flatMap((item) => item.options),
          catalog,
        );
        let sourceIndex = 0;
        const enriched = items.map((item) => ({
          ...item,
          effectSets: buildFarmEffects(item.slug, slots, catalog),
          options: item.options.map((option) => ({
            ...option,
            image: sources[sourceIndex++]?.image ?? option.image,
          })),
        }));
        if (active) setTargets(enriched);
      } catch {
        if (active)
          setDataError(
            "Could not load the catalog. Check your connection and try again.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slots, attempt]);
  const disabled = useMemo(
    () =>
      new Set(
        targets
          .filter((target) => {
            const enabled =
              selectionOverrides.get(target.slug) ??
              !(target.oneTime && collected.has(markKey(target, "collected")));
            return !enabled;
          })
          .map((target) => target.slug),
      ),
    [targets, collected, selectionOverrides],
  );
  const activeTargets = useMemo(
    () => targets.filter((target) => !disabled.has(target.slug)),
    [targets, disabled],
  );
  const plan = useMemo(
    () => minimumFarmPlan(activeTargets, new Set(), farmBosses),
    [activeTargets, farmBosses],
  );
  const remaining = activeTargets.filter(
    (target) => !target.options.some((source) => farmTypes.has(source.type)),
  );
  const choose = (next: Build, saved = "") => {
    imports.id++;
    setLinkLoading(false);
    setLinkError("");
    setBuild(next);
    setSavedId(saved);
    setVariantId("base");
    setSelectionOverrides(new Map());
  };
  const importBuild = async () => {
    const request = ++imports.id;
    setLinkLoading(true);
    setLinkError("");
    try {
      const url = new URL(link.trim(), window.location.origin);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.pathname !== "/build" ||
        (!url.searchParams.has("share") && !url.hash.startsWith("#build="))
      )
        throw new Error("Paste a shared MDDEX build link.");
      const imported = await resolveSharedBuild(
        url,
        AbortSignal.timeout(15_000),
      );
      if (request === imports.id) choose(imported);
    } catch (error) {
      if (request === imports.id)
        setLinkError(
          error instanceof Error
            ? error.message
            : "Could not open this build link.",
        );
    } finally {
      if (request === imports.id) setLinkLoading(false);
    }
  };
  const toggle = (slug: string) =>
    setSelectionOverrides((previous) => {
      const next = new Map(previous);
      next.set(slug, disabled.has(slug));
      return next;
    });
  return (
    <>
      <AppHeader active="resources" />
      <main id="main" className="shell resources-main planner-main">
        <Link to="/resources" className="resources-back">
          <ArrowLeft size={14} />
          All resources
        </Link>
        <header className="planner-heading">
          <span className="eyebrow">
            <RouteIcon size={14} /> BUILD FARMING
          </span>
          <h1>
            Farming planner<span className="accent">.</span>
          </h1>
        </header>
        <section className="planner-import" aria-label="Choose a build">
          <div>
            <label className="planner-label">Your builds</label>
            {db ? (
              <SavedBuildPicker
                db={db}
                onChoose={(next) => choose(next, next.id)}
                value={savedId}
              />
            ) : (
              <p className="muted">{storageError || "Loading saved builds…"}</p>
            )}
            <Link to="/build" className="planner-build-link">
              Open build maker <ExternalLink size={12} />
            </Link>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void importBuild();
            }}
          >
            <label className="planner-label" htmlFor="planner-build-link">
              Or paste a build link
            </label>
            <div className="planner-link-input">
              <input
                id="planner-build-link"
                type="text"
                placeholder="https://mddex.net/build?share=…"
                value={link}
                onChange={(event) => setLink(event.target.value)}
              />
              <button type="submit" disabled={linkLoading || !link.trim()}>
                {linkLoading ? "Loading…" : "Use build"}
              </button>
            </div>
            {linkError && <p role="alert">{linkError}</p>}
          </form>
          {build && !loading && targets.length > 0 && (
            <section className="planner-targets" aria-label="Build items">
              <div className="planner-section-heading">
                <h2>
                  Build items{" "}
                  <span className="muted">
                    {activeTargets.length}/{targets.length}
                  </span>
                </h2>
                <div className="planner-selection-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectionOverrides(
                        new Map(
                          targets.map((target) => [
                            target.slug,
                            disabled.size > 0,
                          ]),
                        ),
                      )
                    }
                  >
                    {disabled.size ? "Select all" : "Clear all"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectionOverrides((current) => {
                        const next = new Map(current);
                        targets
                          .filter((target) => target.oneTime)
                          .forEach((target) => next.set(target.slug, false));
                        return next;
                      })
                    }
                  >
                    Deselect one-time unlocks
                  </button>
                </div>
              </div>
              {trackerError && (
                <p role="status" className="muted">
                  {trackerError}
                </p>
              )}
              <div className="planner-target-icons">
                {targets.map((target) => {
                  const isDisabled = disabled.has(target.slug);
                  const tracked =
                    target.oneTime &&
                    collected.has(markKey(target, "collected"));
                  const status = tracked
                    ? "Collected in tracker"
                    : target.oneTime
                      ? "One-time acquisition"
                      : undefined;
                  return (
                    <Tooltip key={target.slug} delay={150}>
                      <Tooltip.Trigger<"button">
                        render={(props) => (
                          <button
                            {...props}
                            type="button"
                            role="checkbox"
                            aria-checked={!isDisabled}
                            aria-label={`${target.name} ${target.slots.join(" · ")}${status ? ` · ${status}` : ""}`}
                            className={`planner-target ${isDisabled ? "planner-target-off" : ""}`}
                            data-one-time={target.oneTime || undefined}
                            onClick={() => toggle(target.slug)}
                          >
                            <LocationIcon image={target.image ?? undefined} />
                            <span
                              className="planner-target-state"
                              aria-hidden="true"
                            >
                              {isDisabled ? (
                                <X size={12} />
                              ) : (
                                <Check size={12} />
                              )}
                            </span>
                            {target.oneTime && (
                              <span
                                className="planner-target-once"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        )}
                      />
                      <Tooltip.Content className="planner-item-tooltip">
                        <strong>{target.name}</strong>
                        <small>{target.slots.join(" · ")}</small>
                        {status && (
                          <small className="planner-one-time">{status}</small>
                        )}
                      </Tooltip.Content>
                    </Tooltip>
                  );
                })}
              </div>
              <p className="muted planner-tracker-note">
                To permanently exclude talismans and enchantments you have,
                track them{" "}
                <Link to="/resources/item-tracker" search={{ layout: "cards" }}>
                  here
                </Link>
                .
              </p>
            </section>
          )}
        </section>
        {!build && (
          <div className="planner-empty">
            <RouteIcon size={32} />
            <h2>Start with your build</h2>
            <p className="muted">
              Choose a saved loadout or paste a shared link to see farming
              locations, quest rewards, and merchants.
            </p>
          </div>
        )}
        {build && (
          <>
            <div className="planner-build-heading">
              <h2>{selectedVariant?.name || build.name || "Untitled build"}</h2>
              {!!build.variants?.length && (
                <BuildVariants
                  build={build}
                  selectedId={variantId === "base" ? undefined : variantId}
                  onSelect={(id) => {
                    setVariantId(id ?? "base");
                    setSelectionOverrides(new Map());
                  }}
                />
              )}
            </div>
            {loading ? (
              <p role="status">Finding acquisition sources…</p>
            ) : dataError ? (
              <p role="alert">
                {dataError}{" "}
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Try again
                </button>
              </p>
            ) : (
              <>
                {targets.length === 0 ? (
                  <p className="planner-empty">
                    This build has no equipped items. Add equipment in the build
                    maker to plan your farming.
                  </p>
                ) : (
                  <div className="planner-workspace">
                    <div className="planner-results" aria-live="polite">
                      <div className="planner-section-heading">
                        <label className="planner-boss-toggle">
                          <input
                            type="checkbox"
                            checked={farmBosses}
                            onChange={(event) =>
                              setFarmBosses(event.target.checked)
                            }
                          />
                          Farm bosses
                        </label>
                      </div>
                      {!activeTargets.length && (
                        <p className="planner-empty">
                          Select an item to create your plan.
                        </p>
                      )}
                      {plan.map((stop, i) => (
                        <article
                          key={stop.key}
                          className="planner-stop"
                          data-boss-farm={stop.bossFarm || undefined}
                        >
                          <header>
                            <span className="planner-stop-number">{i + 1}</span>
                            <StopIcon source={stop} />
                            <div>
                              <h3>
                                <SourceName source={stop} />
                              </h3>
                              <small>
                                {stop.bossFarm
                                  ? "Boss farming"
                                  : stop.type === "area"
                                    ? "Location"
                                    : stop.type === "quest"
                                      ? "Quest reward"
                                      : stop.type}{" "}
                                · {stop.targets.length}{" "}
                                {stop.targets.length === 1 ? "item" : "items"}
                              </small>
                            </div>
                          </header>
                          <BossRecommendation
                            boss={
                              farmBosses && stop.bossFarm
                                ? stop.recommendedBoss
                                : undefined
                            }
                            active={stop.bossFarm}
                          />
                          <div className="planner-loot">
                            {stop.targets.map(({ target, source }) => (
                              <div key={target.slug}>
                                <LocationIcon
                                  image={target.image ?? undefined}
                                />
                                <span>
                                  {target.path ? (
                                    <Link to={target.path}>{target.name}</Link>
                                  ) : (
                                    target.name
                                  )}
                                  <TargetEffects target={target} />
                                  <Chance source={source} />
                                  {target.notes[0] && (
                                    <small>{target.notes[0]}</small>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                          {!!stop.acquiredBefore.length && (
                            <details className="planner-acquired-before">
                              <summary>
                                Acquired before ({stop.acquiredBefore.length})
                              </summary>
                              <div className="planner-loot">
                                {stop.acquiredBefore.map(({ target }) => (
                                  <div key={target.slug}>
                                    <LocationIcon
                                      image={target.image ?? undefined}
                                    />
                                    {target.path ? (
                                      <Link to={target.path}>
                                        {target.name}
                                      </Link>
                                    ) : (
                                      <span>{target.name}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </article>
                      ))}
                      {!!remaining.length && (
                        <section className="planner-other">
                          <h3>Not covered by this route</h3>
                          <p className="muted">
                            These items have no documented location or quest
                            source for this route.
                          </p>
                          {remaining.map((target) => (
                            <div
                              key={target.slug}
                              className="planner-uncovered-item"
                            >
                              <p>{target.name}</p>
                              {target.error ? (
                                <p role="alert">
                                  {target.error}{" "}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAttempt((value) => value + 1)
                                    }
                                  >
                                    Retry
                                  </button>
                                </p>
                              ) : (
                                <>
                                  <p className="muted">
                                    {target.options
                                      .map((source) => source.name)
                                      .join(" · ") ||
                                      "No acquisition sources documented yet."}
                                  </p>
                                  {target.notes.map((note) => (
                                    <p className="muted" key={note}>
                                      {note}
                                    </p>
                                  ))}
                                </>
                              )}
                            </div>
                          ))}
                        </section>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
      <AppFooter />
    </>
  );
}
