import { useEffect, useMemo, useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { Button, SearchField, Skeleton } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { ArrowUpRight, Plus, PackageOpen } from "lucide-react";
import { FilterSelect } from "../collection/components/FilterToolbar";
import { AppHeader } from "../../components/AppHeader";
import { AppFooter } from "../../components/AppFooter";
import { loadSessionCatalog } from "../catalog/catalog.session";
import type { CatalogItem } from "../catalog/catalog.types";
import { ItemArtwork } from "../builds/components/ItemArtwork";
import { BUILD_SLOTS, type Build } from "../builds/build.types";
import { slotRules } from "../builds/build.compatibility";
import { communityRequest } from "./community.browser";
import {
  communityListSchema,
  descriptionText,
  type CommunityBuild,
} from "./community.schema";

export function CommunityLayout() {
  return (
    <>
      <AppHeader active="community" />
      <main id="main" className="shell community-page">
        <Outlet />
      </main>
      <AppFooter />
    </>
  );
}
export function EquipmentPreview({
  build,
  catalog,
}: {
  build: Build;
  catalog: ReadonlyMap<string, CatalogItem>;
}) {
  return (
    <div className="community-equipment-preview" aria-label="Equipment preview">
      {BUILD_SLOTS.map((slot) => {
        const gear = build.slots[slot];
        const item = gear ? catalog.get(gear.itemSlug) : undefined;
        const label = `${slotRules[slot].label}: ${item?.variation ?? (gear ? "Unavailable item" : "Empty slot")}`;
        return (
          <span
            key={slot}
            className="community-preview-item"
            title={label}
            role="img"
            aria-label={label}
          >
            {gear ? (
              <ItemArtwork item={item} />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}
          </span>
        );
      })}
    </div>
  );
}
export function CommunityGallery() {
  const [builds, setBuilds] = useState<CommunityBuild[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const catalogMap = useMemo(
    () => new Map(catalog.map((item) => [item.slug, item])),
    [catalog],
  );
  useEffect(() => {
    let active = true;
    void loadSessionCatalog()
      .then((items) => {
        if (active) setCatalog(items);
      })
      .catch(() => {});
    void communityRequest("/tags")
      .then((data) => {
        if (
          active &&
          data &&
          typeof data === "object" &&
          "tags" in data &&
          Array.isArray(data.tags)
        )
          setTags(
            data.tags.filter(
              (value): value is string => typeof value === "string",
            ),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError("");
        void communityRequest(
          `?${new URLSearchParams({ q: query, tag, offset: String(offset) })}`,
          { signal: controller.signal },
        )
          .then((data) => {
            if (!active) return;
            const parsed = communityListSchema.parse(data);
            setBuilds(parsed.builds);
            setHasMore(parsed.hasMore);
          })
          .catch((cause: unknown) => {
            if (active)
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not load builds",
              );
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, tag, offset, attempt]);
  return (
    <>
      <div className="community-heading">
        <div>
          <h1>
            Community Builds<span className="accent">.</span>
          </h1>
          <p className="muted">Find builds to try out and post your own</p>
        </div>
        <Link to="/community/new" className={buttonVariants()}>
          <Plus size={16} />
          Post a build
        </Link>
      </div>
      <div className="filter-row community-toolbar">
        <SearchField
          aria-label="Search community builds"
          value={query}
          onChange={(value) => {
            setQuery(value);
            setOffset(0);
          }}
          className="catalog-search"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search builds, tags, creators…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <FilterSelect
          label="Filter builds by tag"
          value={tag ? `tag:${tag}` : "all"}
          onChange={(value) => {
            setTag(value === "all" ? "" : value.slice(4));
            setOffset(0);
          }}
          options={[
            { id: "all", name: "All tags" },
            ...tags.map((value) => ({ id: `tag:${value}`, name: value })),
          ]}
        />
      </div>
      {error ? (
        <div className="community-message" role="alert">
          <h2>Community builds unavailable</h2>
          <p>{error}</p>
          <Button
            variant="secondary"
            onPress={() => setAttempt((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div
          className="community-grid"
          role="status"
          aria-label="Loading community builds"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="community-card-skeleton" />
          ))}
        </div>
      ) : builds.length ? (
        <div className="community-grid">
          {builds.map((build) => (
            <article className="community-card" key={build.id}>
              <Link
                to="/community/$buildId"
                params={{ buildId: build.id }}
                className="community-card-title"
              >
                <h2>{build.name}</h2>
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <div className="community-byline">by {build.displayName}</div>
              <EquipmentPreview build={build.build} catalog={catalogMap} />
              <div className="community-tags">
                {build.tags.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="community-tag"
                    onClick={() => {
                      setTag(value);
                      setOffset(0);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="community-card-description">
                {descriptionText(build.description)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="community-message community-empty">
          <PackageOpen size={28} strokeWidth={1.3} />
          <h2>
            {query || tag ? "No builds match" : "There are no builds yet!"}
          </h2>
          {(query || tag) && (
            <p className="muted">Try another search or tag.</p>
          )}
          {!query && !tag && (
            <Link to="/community/new" className={buttonVariants()}>
              Post first build
            </Link>
          )}
        </div>
      )}
      {!loading && !error && (offset > 0 || hasMore) && (
        <div className="community-pagination">
          <Button
            variant="secondary"
            isDisabled={offset === 0}
            onPress={() => setOffset(Math.max(0, offset - 24))}
          >
            Previous
          </Button>
          <span className="muted">Page {Math.floor(offset / 24) + 1}</span>
          <Button
            variant="secondary"
            isDisabled={!hasMore}
            onPress={() => setOffset(offset + 24)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
