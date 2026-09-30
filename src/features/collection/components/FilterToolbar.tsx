import { useEffect, useRef } from "react";
import { Button, ListBox, SearchField, Select } from "@heroui/react";
export type FilterOption = { id: string; name: string };
export type FilterControl = {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
};
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: FilterControl) {
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
export function FilterToolbar({
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearch,
  filters,
  sort,
  count,
  total,
  noun,
  hasFilters,
  onClear,
}: {
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearch: (value: string) => void;
  filters: FilterControl[];
  sort: FilterControl;
  count: number;
  total: number;
  noun: string;
  hasFilters: boolean;
  onClear: () => void;
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
  return (
    <div className="toolbar">
      <div className="filter-row">
        <SearchField
          aria-label={searchLabel}
          value={searchValue}
          onChange={onSearch}
          className="catalog-search"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input ref={input} placeholder={searchPlaceholder} />
            <SearchField.ClearButton />
            <kbd aria-hidden="true">/</kbd>
          </SearchField.Group>
        </SearchField>
        {filters.map((filter) => (
          <FilterSelect key={filter.label} {...filter} />
        ))}
      </div>
      <div className="results-toolbar">
        <div className="results-actions">
          <span className="result-count" role="status">
            {count}{" "}
            <span className="muted">
              of {total} {noun}
            </span>
          </span>
          {hasFilters && (
            <Button size="sm" variant="ghost" onPress={onClear}>
              Clear filters
            </Button>
          )}
          <FilterSelect {...sort} />
        </div>
      </div>
    </div>
  );
}
