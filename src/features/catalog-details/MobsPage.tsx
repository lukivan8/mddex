import { AppHeader } from "../../components/AppHeader";
import { trackEvent } from "../analytics/analytics.browser";
import { AppFooter } from "../../components/AppFooter";
import { ItemList } from "../collection/components/ItemList";
import { Button } from "@heroui/react";
import { FilterToolbar } from "../collection/components/FilterToolbar";
import { Crown, Leaf, PawPrint, Skull } from "lucide-react";
import type { MobFilters, mobsCatalog } from "./mobs.model";
import { CatalogDirectory } from "../seo/CatalogDirectory";
import type { CatalogIndexGroup } from "../seo/catalog-index";
export function MobsPage({
  items,
  locations,
  locationDirectory,
  filters,
  onChange,
}: {
  items: ReturnType<typeof mobsCatalog>["items"];
  locations: ReturnType<typeof mobsCatalog>["locations"];
  locationDirectory: CatalogIndexGroup[];
  filters: MobFilters;
  onChange: (patch: MobFilters) => void;
}) {
  const tokens = (filters.q ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const visible = items
    .filter(
      (item) =>
        (!filters.kind || item.kind === filters.kind) &&
        (!filters.location || item.locations.includes(filters.location)) &&
        tokens.every((token) =>
          `${item.displayName} ${item.type} ${item.slug}`
            .toLowerCase()
            .includes(token),
        ),
    )
    .sort((a, b) => {
      if (filters.sort === "kind") {
        const order = ["hostile", "boss", "companion", "neutral", "other"];
        const difference = order.indexOf(a.kind) - order.indexOf(b.kind);
        if (difference) return difference;
      }
      return filters.sort === "name_desc"
        ? b.displayName.localeCompare(a.displayName)
        : a.displayName.localeCompare(b.displayName);
    });
  const kinds = [
    { id: "hostile", label: "Hostile", icon: Skull },
    { id: "boss", label: "Bosses", icon: Crown },
    { id: "companion", label: "Companion", icon: PawPrint },
    { id: "neutral", label: "Neutral", icon: Leaf },
  ] as const;
  function changeFilters(patch: MobFilters) {
    if (patch.q && !filters.q) trackEvent("mobs_search_used", true);
    if (patch.kind !== undefined && patch.kind !== filters.kind)
      trackEvent("mob_kind_selected", false, patch.kind);
    if (patch.location && patch.location !== filters.location)
      trackEvent("mob_location_selected");
    if (patch.sort && patch.sort !== filters.sort)
      trackEvent("mob_sort_changed");
    onChange(patch);
  }
  return (
    <>
      <AppHeader active="mobs" />
      <main className="shell collection-main" id="main">
        <div className="catalog-heading">
          <div>
            <h1>
              Mobs<span className="accent">.</span>
            </h1>
            <p className="muted">
              Explore enemies, bosses, and their known drops.
            </p>
          </div>
        </div>
        <div
          className="category-grid mob-category-grid"
          role="group"
          aria-label="Mob type"
        >
          {kinds.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              className={`category-card ${filters.kind === id ? "active" : ""}`}
              aria-label={label}
              aria-pressed={filters.kind === id}
              onPress={() =>
                changeFilters({ kind: filters.kind === id ? undefined : id })
              }
            >
              <span className="category-top">
                <Icon size={18} />
                <span>
                  {items.filter((item) => item.kind === id).length} mobs
                </span>
              </span>
              <span className="category-name">{label}</span>
            </Button>
          ))}
        </div>
        <FilterToolbar
          searchLabel="Search mobs"
          searchPlaceholder="Search mobs…"
          searchValue={filters.q ?? ""}
          onSearch={(q) => changeFilters({ q: q || undefined })}
          filters={[
            {
              label: "Location",
              value: filters.location ?? "all",
              onChange: (location) =>
                changeFilters({
                  location: location === "all" ? undefined : location,
                }),
              options: [{ id: "all", name: "All locations" }, ...locations],
            },
          ]}
          sort={{
            label: "Sort mobs",
            value: filters.sort ?? "name",
            onChange: (sort) =>
              changeFilters({ sort: sort as MobFilters["sort"] }),
            options: [
              { id: "name", name: "Name A–Z" },
              { id: "name_desc", name: "Name Z–A" },
              { id: "kind", name: "Mob type" },
            ],
          }}
          count={visible.length}
          total={items.length}
          noun="mobs"
          hasFilters={!!(filters.q || filters.kind || filters.location)}
          onClear={() =>
            changeFilters({
              q: undefined,
              kind: undefined,
              location: undefined,
            })
          }
        />
        <ItemList items={visible} />
        {!visible.length && (
          <p className="page-message">No mobs match your filters.</p>
        )}
        <section className="page-about">
          <h2>Minecraft Dungeons 2 mobs</h2>
          <p>
            Browse Minecraft Dungeons 2 (MCD2) mob entries for published health,
            attacks, encounters, and explicit item drops. Each mob links to its
            known locations and related catalog entries.
          </p>
        </section>
        <CatalogDirectory
          groups={locationDirectory}
          title="All locations"
          description="Browse every published location and its known loot and mobs."
        />
      </main>
      <AppFooter />
    </>
  );
}
