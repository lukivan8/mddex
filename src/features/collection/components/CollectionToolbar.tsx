import type { CatalogItem } from "../../catalog/catalog.types";
import { EFFECT_GEAR_CATEGORIES } from "../collection.effects";
import { EffectFilter, SelectedEffects } from "./EffectFilter";
import type { CollectionFilters } from "../collection.types";
import { categoryLabel, humanize } from "../../catalog/catalog.helpers";
import { FilterToolbar } from "./FilterToolbar";
export function CollectionToolbar({
  filters,
  effects,
  types,
  typeTotals,
  onChange,
}: {
  filters: CollectionFilters;
  effects: CatalogItem[];
  types: string[];
  typeTotals: Record<string, number>;
  onChange: (patch: CollectionFilters) => void;
}) {
  return (
    <FilterToolbar
      searchActions={
        <EffectFilter
          effects={effects}
          filters={filters}
          onChange={onChange}
          disabled={
            !!filters.category &&
            !EFFECT_GEAR_CATEGORIES.includes(filters.category)
          }
        />
      }
      belowSearch={
        <SelectedEffects
          effects={effects}
          filters={filters}
          onChange={onChange}
        />
      }
      searchLabel="Search catalog"
      searchPlaceholder="Search items, types, categories…"
      searchValue={filters.q || ""}
      onSearch={(q) => onChange({ q })}
      filters={[
        filters.category === "enchantment"
          ? {
              label: "Applies to",
              value: filters.appliesTo || "all",
              onChange: (value: string) =>
                onChange({
                  appliesTo:
                    value === "all"
                      ? ""
                      : (value as CollectionFilters["appliesTo"]),
                }),
              options: [
                { id: "all", name: "All equipment" },
                ...["melee_weapon", "ranged_weapon", "armor"].map((id) => ({
                  id,
                  name: categoryLabel(id),
                })),
                { id: "unknown", name: "Compatibility unknown" },
              ],
            }
          : {
              label: "Type",
              value: filters.type || "all",
              onChange: (type: string) =>
                onChange({ type: type === "all" ? "" : type }),
              options: [
                { id: "all", name: "All types" },
                ...types.map((id) => ({
                  id,
                  name: `${id === "secret_talismans" ? "Secret talismans" : humanize(id)} (${typeTotals[id]})`,
                })),
              ],
            },
      ]}
    />
  );
}
