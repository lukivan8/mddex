import { useEffect, useRef } from "react";
import {
  Button,
  ListBox,
  SearchField,
  Select,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import type { CollectionFilters } from "../collection.types";
import { categoryLabel, humanize } from "../../catalog/catalog.helpers";
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(key) => onChange(String(key))}
      className="filter-select"
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.name}
            >
              {option.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
export function CollectionToolbar({
  filters,
  categories,
  types,
  typeTotals,
  onChange,
  count,
  total,
  spoilerFree,
}: {
  filters: CollectionFilters;
  categories: string[];
  types: string[];
  typeTotals: Record<string, number>;
  onChange: (patch: CollectionFilters) => void;
  count: number;
  total: number;
  spoilerFree: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const editing =
        event.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
          event.target.isContentEditable);
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !editing)
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const active = !!(
    filters.q ||
    filters.category ||
    filters.type ||
    (filters.status && filters.status !== "all")
  );
  return (
    <div className="toolbar">
      {spoilerFree && (
        <p className="discovery-hint" id="discovery-hint">
          Hidden items reveal themselves when you enter their full name.
        </p>
      )}
      <div className="filter-row">
        <SearchField
          aria-label="Search collection"
          aria-describedby={spoilerFree ? "discovery-hint" : undefined}
          value={filters.q || ""}
          onChange={(q) => onChange({ q })}
          className="catalog-search"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              ref={input}
              placeholder={
                spoilerFree
                  ? "Search or enter an item name to discover it…"
                  : "Search items, types, categories…"
              }
            />
            <SearchField.ClearButton />
            <kbd aria-hidden="true">/</kbd>
          </SearchField.Group>
        </SearchField>
        <FilterSelect
          label="Category"
          value={filters.category || "all"}
          onChange={(category) =>
            onChange({ category: category === "all" ? "" : category, type: "" })
          }
          options={[
            { id: "all", name: "All categories" },
            ...categories.map((id) => ({ id, name: categoryLabel(id) })),
          ]}
        />
        <FilterSelect
          label="Type"
          value={filters.type || "all"}
          onChange={(type) => onChange({ type: type === "all" ? "" : type })}
          options={[
            { id: "all", name: "All types" },
            ...types.map((id) => ({
              id,
              name: `${humanize(id)} (${typeTotals[id]})`,
            })),
          ]}
        />
      </div>
      <div className="results-toolbar">
        <ToggleButtonGroup
          aria-label="Completion status"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[filters.status || "all"]}
          onSelectionChange={(keys) =>
            onChange({ status: [...keys][0] as CollectionFilters["status"] })
          }
        >
          <ToggleButton id="all">All items</ToggleButton>
          <ToggleButton id="missing">Missing</ToggleButton>
          <ToggleButton id="collected">Collected</ToggleButton>
        </ToggleButtonGroup>
        <div className="results-actions">
          <span className="result-count" role="status">
            {count} <span className="muted">of {total} items</span>
          </span>
          {active && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() =>
                onChange({ q: "", category: "", type: "", status: "all" })
              }
            >
              Clear filters
            </Button>
          )}
          <FilterSelect
            label="Sort items"
            value={filters.sort || "name"}
            onChange={(sort) =>
              onChange({ sort: sort as CollectionFilters["sort"] })
            }
            options={[
              { id: "name", name: "Name A–Z" },
              { id: "category", name: "Category" },
              { id: "missing", name: "Missing first" },
              { id: "collected", name: "Collected first" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
