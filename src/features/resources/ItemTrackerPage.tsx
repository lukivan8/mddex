import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Modal,
  SearchField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeft,
  Copy,
  Check,
  RotateCcw,
  Share2,
  Link as LinkIcon,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { AppFooter } from "../../components/AppFooter";
import { ResourceCredit } from "./ResourceCredit";
import { CatalogNavigationLink } from "../../components/CatalogNavigationLink";
import { ItemArtwork } from "../builds/components/ItemArtwork";
import { loadSessionCatalog } from "../catalog/catalog.session";
import type { CatalogItem } from "../catalog/catalog.types";
import { categoryLabel, isSecretTalisman } from "../catalog/catalog.helpers";
import { detailCategory } from "../catalog-details/catalog-detail.model";
import { FilterSelect } from "../collection/components/FilterToolbar";
import {
  TRACKER_CATEGORIES,
  TRACKER_STORAGE_KEY,
  familyKeys,
  markKey,
  parseTrackerSave,
  trackerFamilies,
  trackerMarks,
  trackerProgress,
  trackerPreviewMarks,
  setTrackerMark,
  cycleTrackerItem,
  soulMark,
  upgradeTrackerSave,
  type TrackerCategory,
  type TrackerMark,
} from "./item-tracker";
import { readTrackerShare, trackerShareToken } from "./item-tracker-share";
import { TrackerLayouts, type TrackerLayout } from "./TrackerLayouts";
import { createTrackerImage } from "./item-tracker-image";
const labels: Record<TrackerMark, string> = {
  common: "Common",
  rare: "Rare",
  special: "Special",
  unique: "Unique",
  soul: "Soul",
  soul_common: "Soul Common",
  soul_rare: "Soul Rare",
  soul_special: "Soul Special",
  soul_unique: "Soul Unique",
  collected: "Collected",
};
function GearName({
  item,
  returnTo,
}: {
  item?: CatalogItem;
  returnTo: string;
}) {
  if (!item) return <span className="muted">—</span>;
  const slug =
    typeof item.game_data?.slug === "string" ? item.game_data.slug : item.slug;
  return (
    <CatalogNavigationLink
      className="tracker-gear"
      aria-label={item.variation}
      href={`/catalog/${detailCategory(item.category)}/${slug}?returnTo=${encodeURIComponent(returnTo)}`}
    >
      <span className="tracker-art">
        <ItemArtwork item={item} />
      </span>
      <span>{item.variation}</span>
    </CatalogNavigationLink>
  );
}
export function ItemTrackerPage({
  layout = "cards",
}: {
  layout?: TrackerLayout;
}) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  // URL fragments are absent from SSR requests. Read them after hydration so
  // shared banners and layout links match the server's initial HTML.
  const isShared = ready && location.hash.startsWith("collection=");
  const [sharedCollected, setSharedCollected] = useState<Set<string>>();
  const [sharedError, setSharedError] = useState("");
  const shareGeneration = useRef(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [shareLink, setShareLink] = useState("");
  const [sharing, setSharing] = useState(false);
  const [linkStatus, setLinkStatus] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>();
  const [loadError, setLoadError] = useState(false);
  const [savedCollected, setCollected] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState("");
  const [category, setCategory] = useState<TrackerCategory>("melee_weapon");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [secretOnly, setSecretOnly] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [hoveredMark, setHoveredMark] = useState<{
    slug: string;
    mark: TrackerMark;
  }>();
  const [focusedMark, setFocusedMark] = useState<{
    slug: string;
    mark: TrackerMark;
  }>();
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [shareImage, setShareImage] = useState<Blob>();
  useEffect(() => {
    let cancelled = false;
    void loadSessionCatalog()
      .then((items) => {
        if (!cancelled) setCatalog(items);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    try {
      setCollected(parseTrackerSave(localStorage.getItem(TRACKER_STORAGE_KEY)));
    } catch {
      setSaveError(
        "Saved progress could not be loaded. New changes will replace the saved tracker.",
      );
    }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key !== TRACKER_STORAGE_KEY) return;
      try {
        setCollected(parseTrackerSave(event.newValue));
      } catch {
        setSaveError("Progress from another tab could not be loaded.");
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    setShareOpen(false);
    setResetOpen(false);
  }, [location.href]);
  useEffect(() => {
    let cancelled = false;
    setSharedCollected(undefined);
    setSharedError("");
    if (isShared)
      void readTrackerShare(location.hash.slice("collection=".length))
        .then((value) => {
          if (!cancelled) setSharedCollected(value);
        })
        .catch(() => {
          if (!cancelled)
            setSharedError("This collection link is invalid or incomplete.");
        });
    return () => {
      cancelled = true;
    };
  }, [isShared, location.hash]);
  useEffect(() => {
    if (!shareImage) {
      setPreviewUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(shareImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [shareImage]);
  const collected = useMemo(
    () =>
      upgradeTrackerSave(
        isShared ? (sharedCollected ?? new Set()) : savedCollected,
        catalog ?? [],
      ),
    [savedCollected, sharedCollected, isShared, catalog],
  );
  const groups = useMemo(
    () =>
      TRACKER_CATEGORIES.map((id) => ({
        id,
        families: trackerFamilies(catalog ?? [], id),
      })),
    [catalog],
  );
  const group = groups.find((entry) => entry.id === category)!;
  const progress = trackerProgress(
    groups.flatMap((entry) => entry.families.flatMap(familyKeys)),
    collected,
  );
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = group.families.filter((family) => {
    const text = [family.base, family.unique]
      .filter(Boolean)
      .map((item) => `${item!.variation} ${item!.type}`)
      .join(" ")
      .toLowerCase();
    const state = trackerProgress(familyKeys(family), collected);
    return (
      (category !== "talisman" ||
        !secretOnly ||
        [family.base, family.unique].some(
          (item) => item && isSecretTalisman(item),
        )) &&
      words.every((word) => text.includes(word)) &&
      (view === "all" ||
        (view === "missing"
          ? state.count < state.total
          : state.count === state.total))
    );
  });
  const soul = ["melee_weapon", "ranged_weapon", "armor"].includes(category);
  const paired = group.families.some((family) => family.unique);
  const baseMarks: TrackerMark[] =
    category === "talisman" || category === "enchantment"
      ? ["collected"]
      : ["common", "rare", "special"];
  const uniqueMarks: TrackerMark[] = ["unique"];
  function openSharePreview() {
    if (!catalog) return;
    setShareImage(undefined);
    setShareLink("");
    setPreviewError("");
    setCopyError("");
    setCopied(false);
    setLinkStatus("");
    setShareOpen(true);
    const generation = ++shareGeneration.current;
    const snapshot = new Set(collected);
    void createTrackerImage(catalog, snapshot)
      .then((image) => {
        if (generation === shareGeneration.current) setShareImage(image);
      })
      .catch(() =>
        setPreviewError(
          "Could not create the image. Close the preview and try again.",
        ),
      );
    void trackerShareToken(snapshot)
      .then((token) => {
        if (generation === shareGeneration.current)
          setShareLink(
            `${window.location.origin}/resources/item-tracker#collection=${token}`,
          );
      })
      .catch(() => setPreviewError("Could not create the collection link."));
  }
  function copyImage() {
    if (!shareImage || copying) return;
    setCopying(true);
    setCopied(false);
    setCopyError("");
    const copy =
      typeof ClipboardItem !== "undefined" && navigator.clipboard?.write
        ? navigator.clipboard.write([
            new ClipboardItem({ "image/png": shareImage }),
          ])
        : Promise.reject(new Error("Clipboard images unavailable"));
    void copy
      .then(() => setCopied(true))
      .catch(() =>
        setCopyError(
          "Could not copy the image. Allow clipboard access or save it below.",
        ),
      )
      .finally(() => setCopying(false));
  }
  function copyProgressLink() {
    if (!shareLink || sharing) return;
    setSharing(true);
    setLinkStatus("");
    setCopyError("");
    const action =
      navigator.clipboard?.writeText(shareLink) ??
      Promise.reject(new Error("Clipboard unavailable"));
    void action
      .then(() => setLinkStatus("Link copied!"))
      .catch((error) => {
        if (error?.name !== "AbortError")
          setCopyError(
            "Could not copy the link. Allow clipboard access and try again.",
          );
      })
      .finally(() => setSharing(false));
  }
  function downloadImage() {
    if (!shareImage) return;
    const url = URL.createObjectURL(shareImage);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mddex-collection.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function save(next: Set<string>) {
    setCollected(next);
    setCopied(false);
    try {
      localStorage.setItem(
        TRACKER_STORAGE_KEY,
        JSON.stringify({ version: 2, collected: [...next] }),
      );
      setSaveError("");
    } catch {
      setSaveError(
        "Progress is kept for this visit, but could not be saved on this device.",
      );
    }
  }
  function checkbox(item: CatalogItem | undefined, mark: TrackerMark) {
    if (!item || !trackerMarks(item).includes(mark))
      return (
        <span className="tracker-na" aria-label="Not applicable">
          —
        </span>
      );
    const key = markKey(item, mark);
    const preview = hoveredMark ?? focusedMark;
    const highlighted =
      preview?.slug === item.slug &&
      trackerPreviewMarks(item, preview.mark, collected).includes(mark);
    return (
      <label
        className="tracker-check-target"
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch")
            setHoveredMark({ slug: item.slug, mark });
        }}
        onPointerLeave={() => setHoveredMark(undefined)}
      >
        <input
          type="checkbox"
          className={`tracker-check tracker-${mark} ${highlighted ? "tracker-preview" : ""}`}
          aria-label={`${item.variation} ${labels[mark]}`}
          checked={collected.has(key)}
          disabled={!ready || isShared}
          onFocus={() => setFocusedMark({ slug: item.slug, mark })}
          onBlur={() => setFocusedMark(undefined)}
          onChange={(event) =>
            save(setTrackerMark(collected, item, mark, event.target.checked))
          }
        />
      </label>
    );
  }
  const columnTotal = (mark: TrackerMark, unique: boolean) => {
    const keys = group.families.flatMap((family) => {
      const item = unique ? family.unique : family.base;
      return item && trackerMarks(item).includes(mark)
        ? [markKey(item, mark)]
        : [];
    });
    const result = trackerProgress(keys, collected);
    return `${result.count} / ${result.total}`;
  };
  return (
    <>
      <AppHeader active="resources" />
      <main id="main" className="shell resources-main tracker-main">
        <Link to="/resources" className="resources-back">
          <ArrowLeft size={14} /> All resources
        </Link>
        <div className="tracker-heading">
          <div>
            <h1>
              Item tracker<span className="accent">.</span>
            </h1>
            <p className="muted">
              Keep track of your collection, from common gear to unique and soul
              variants.
            </p>
          </div>
          <Button
            variant="secondary"
            className="tracker-share"
            isDisabled={!catalog || !ready || (isShared && !sharedCollected)}
            onPress={openSharePreview}
          >
            <Share2 size={16} /> Share
          </Button>
        </div>
        <nav className="tracker-layout-switch" aria-label="Tracker layout">
          {(
            [
              ["cards", "/resources/item-tracker", "Cards"],
              ["table", "/resources/item-tracker", "Table"],
            ] as const
          ).map(([id, path, label]) => (
            <Link
              key={id}
              to={path}
              search={{ layout: id }}
              preload={false}
              replace
              resetScroll={false}
              hash={ready ? location.hash : ""}
              aria-current={layout === id ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        {isShared && (
          <div className="tracker-shared-banner">
            <span>
              {sharedError ||
                (sharedCollected
                  ? "Shared collection"
                  : "Loading shared collection…")}
            </span>
            <Link
              to="/resources/item-tracker"
              search={{ layout: "cards" }}
              hash=""
            >
              Open my tracker
            </Link>
          </div>
        )}
        <section className="tracker-progress" aria-label="Collection progress">
          <div>
            <strong>
              {progress.count}{" "}
              <span className="muted">/ {progress.total} variants</span>
            </strong>
            <span className="muted">
              collected ·{" "}
              {progress.total
                ? Math.round((progress.count / progress.total) * 100)
                : 0}
              %
            </span>
          </div>
          <progress
            value={progress.count}
            max={progress.total || 1}
            aria-label="Overall collection progress"
          />
        </section>
        {saveError && (
          <p role="alert" className="tracker-error">
            {saveError}
          </p>
        )}
        <div className="tracker-tabs">
          <ToggleButtonGroup
            aria-label="Tracker category"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[category]}
            onSelectionChange={(keys) =>
              setCategory([...keys][0] as TrackerCategory)
            }
          >
            {groups.map((entry) => {
              const state = trackerProgress(
                entry.families.flatMap(familyKeys),
                collected,
              );
              return (
                <ToggleButton id={entry.id} key={entry.id}>
                  {categoryLabel(entry.id)}{" "}
                  <span className="muted">
                    {state.count}/{state.total}
                  </span>
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </div>
        <div className="filter-row tracker-filters">
          <SearchField
            aria-label="Search tracked items"
            value={query}
            onChange={setQuery}
            className="catalog-search"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search items or types…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <FilterSelect
            label="Collection status"
            value={view}
            onChange={setView}
            options={[
              { id: "all", name: "All items" },
              { id: "missing", name: "Missing items" },
              { id: "complete", name: "Completed items" },
            ]}
          />
        </div>
        <div className="tracker-section-meta">
          {category === "talisman" && (
            <label className="tracker-secret-filter">
              <input
                type="checkbox"
                className="tracker-check"
                checked={secretOnly}
                onChange={(event) => setSecretOnly(event.target.checked)}
              />
              Secret talismans only
            </label>
          )}
          <Button
            size="sm"
            variant="ghost"
            isDisabled={!progress.count || isShared}
            onPress={() => setResetOpen(true)}
          >
            <RotateCcw size={13} /> Reset progress
          </Button>
        </div>
        {!catalog ? (
          <div className="empty-state" role="status">
            {loadError
              ? "The catalog could not be loaded. Refresh to try again."
              : "Loading your collection…"}
          </div>
        ) : visible.length && layout !== "table" ? (
          <TrackerLayouts
            layout={layout}
            returnTo={location.href}
            families={visible}
            collected={collected}
            checkbox={checkbox}
            cycleItem={(item) => save(cycleTrackerItem(collected, item))}
            readOnly={!ready || isShared}
            itemLink={(item) => (
              <GearName item={item} returnTo={location.href} />
            )}
          />
        ) : visible.length ? (
          <div className="tracker-table-scroll">
            <table className="tracker-table">
              <caption className="sr-only">
                {categoryLabel(category)} collection checklist
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  {baseMarks.map((mark) => (
                    <th
                      className={`tracker-column-${mark}`}
                      key={mark}
                      scope="col"
                    >
                      {labels[mark]}
                      {soul && (mark === "special" || mark === "unique") && (
                        <div className="tracker-subheading">
                          <span>Normal</span>
                          <span>Soul</span>
                        </div>
                      )}
                    </th>
                  ))}
                  {paired && (
                    <>
                      <th scope="col">Unique item</th>
                      {uniqueMarks.map((mark) => (
                        <th
                          className={`tracker-column-${mark}`}
                          key={mark}
                          scope="col"
                        >
                          {labels[mark]}
                          {soul &&
                            (mark === "special" || mark === "unique") && (
                              <div className="tracker-subheading">
                                <span>Normal</span>
                                <span>Soul</span>
                              </div>
                            )}
                        </th>
                      ))}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((family) => (
                  <tr key={family.id}>
                    <th scope="row">
                      <GearName item={family.base} returnTo={location.href} />
                    </th>
                    {baseMarks.map((mark) => (
                      <td key={mark}>
                        <div className="tracker-rarity-checks">
                          {checkbox(family.base, mark)}
                          {soul &&
                            mark === "special" &&
                            checkbox(family.base, soulMark(mark))}
                        </div>
                      </td>
                    ))}
                    {paired && (
                      <>
                        <td className="tracker-unique-name">
                          <GearName
                            item={family.unique}
                            returnTo={location.href}
                          />
                        </td>
                        {uniqueMarks.map((mark) => (
                          <td key={mark}>
                            <div className="tracker-rarity-checks">
                              {checkbox(family.unique, mark)}
                              {soul && checkbox(family.unique, soulMark(mark))}
                            </div>
                          </td>
                        ))}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Category totals</th>
                  {baseMarks.map((mark) => (
                    <td key={mark}>
                      <div className="tracker-rarity-checks">
                        <span>{columnTotal(mark, false)}</span>
                        {soul && (mark === "special" || mark === "unique") && (
                          <span>{columnTotal(soulMark(mark), false)}</span>
                        )}
                      </div>
                    </td>
                  ))}
                  {paired && (
                    <>
                      <td />
                      <td>
                        <div className="tracker-rarity-checks">
                          <span>{columnTotal("unique", true)}</span>
                          {soul && (
                            <span>{columnTotal("soul_unique", true)}</span>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state" role="status">
            <h2>No matching items</h2>
            <p>Try another search or collection status.</p>
          </div>
        )}
        {layout === "table" && (
          <ResourceCredit
            credit={{
              name: "c00k31s on Discord",
              links: [
                {
                  label: "Item collection spreadsheet",
                  url: "https://docs.google.com/spreadsheets/d/1tqkZcG5Qb-6GEXUidMWrhJ2mLLQSDnio8F5EFeoT-qQ/edit?gid=748155133#gid=748155133",
                },
              ],
              contribution: "the collection tracker table layout",
            }}
          />
        )}
      </main>
      <AppFooter />
      <Modal.Backdrop isOpen={shareOpen} onOpenChange={setShareOpen}>
        <Modal.Container size="lg" className="tracker-share-modal">
          <Modal.Dialog aria-label="Share collection">
            <Modal.Header>
              <Modal.Heading>Share collection</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              {previewUrl ? (
                <img
                  className="tracker-share-preview"
                  src={previewUrl}
                  alt="Collection progress share image"
                />
              ) : (
                <p className="muted" role="status">
                  Creating your collection image…
                </p>
              )}
              {previewError && <p role="alert">{previewError}</p>}
              {copyError && (
                <div className="tracker-copy-feedback" role="status">
                  <span>{copyError}</span>
                  {shareImage && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={downloadImage}
                    >
                      Save image
                    </Button>
                  )}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                isDisabled={!shareImage || copying}
                onPress={copyImage}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copying ? "Copying…" : copied ? "Copied!" : "Copy image"}
              </Button>
              <Button
                isDisabled={!shareLink || sharing}
                onPress={copyProgressLink}
              >
                <LinkIcon size={16} />
                {sharing ? "Copying…" : linkStatus || "Copy link"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Modal.Backdrop isOpen={resetOpen} onOpenChange={setResetOpen}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Reset collection progress?</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              This clears all rarity and soul checkboxes across every category
              on this device.
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  save(new Set());
                  setResetOpen(false);
                }}
              >
                Reset all progress
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
