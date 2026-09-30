import type { CollectionFilters } from "../collection.types";
import { categoryLabel, humanize } from "../../catalog/catalog.helpers";
import { FilterToolbar } from "./FilterToolbar";
export function CollectionToolbar({
  filters,
  categories,
  types,
  typeTotals,
  onChange,
  count,
  total,
}: {
  filters: CollectionFilters;
  categories: string[];
  types: string[];
  typeTotals: Record<string, number>;
  onChange: (patch: CollectionFilters) => void;
  count: number;
  total: number;
}) {
  return (
    <FilterToolbar
      searchLabel="Search catalog"
      searchPlaceholder="Search items, types, categories…"
      searchValue={filters.q || ""}
      onSearch={(q) => onChange({ q })}
      filters={[
        {
          label: "Category",
          value: filters.category || "all",
          onChange: (category: string) =>
            onChange({
              category: category === "all" ? "" : category,
              type: "",
              appliesTo: "",
            }),
          options: [
            { id: "all", name: "All categories" },
            ...categories.map((id) => ({ id, name: categoryLabel(id) })),
          ],
        },
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
                  name: `${humanize(id)} (${typeTotals[id]})`,
                })),
              ],
            },
      ]}
      sort={{
        label: "Sort items",
        value: filters.sort || "name",
        onChange: (sort) =>
          onChange({ sort: sort as CollectionFilters["sort"] }),
        options: [
          { id: "name", name: "Name A–Z" },
          { id: "category", name: "Category" },
        ],
      }}
      count={count}
      total={total}
      noun="items"
      hasFilters={
        !!(filters.q || filters.category || filters.type || filters.appliesTo)
      }
      onClear={() => onChange({ q: "", category: "", type: "", appliesTo: "" })}
    />
  );
}
