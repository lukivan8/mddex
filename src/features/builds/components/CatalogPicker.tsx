import { memo, useMemo } from "react";
import {
  Button,
  SearchField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { Check, SearchX, X } from "lucide-react";
import { buildSearchIndex, humanize } from "../../catalog/catalog.helpers";
import type { CatalogItem } from "../../catalog/catalog.types";
import type { CompletionRecord } from "../../collection/collection.types";
import { pickerItems } from "../build.selectors";
import { isCompatible } from "../build.compatibility";
import type { Availability, BuildTarget } from "../build.types";
import { ItemArtwork } from "./ItemArtwork";
const PickerResult = memo(function PickerResult({
  item,
  selected,
  onSelect,
}: {
  item: CatalogItem;
  selected: boolean;
  onSelect: (item: CatalogItem) => void;
}) {
  return (
    <Button
      variant="ghost"
      className={`picker-result ${selected ? "active" : ""}`}
      aria-label={`Equip ${item.variation}`}
      aria-pressed={selected}
      onPress={() => onSelect(item)}
    >
      <span className="picker-art">
        <ItemArtwork item={item} />
      </span>
      <span className="picker-result-copy">
        <strong>{item.variation}</strong>
        <span className="muted">{humanize(item.type)}</span>
      </span>
      {selected && <Check size={15} />}
    </Button>
  );
});
export type PickerProps = {
  allowAll: boolean;
  catalog: CatalogItem[];
  records: ReadonlyMap<string, CompletionRecord>;
  target: BuildTarget;
  availability: Availability;
  onAvailability: (value: Availability) => void;
  query: string;
  onQuery: (value: string) => void;
  type: string;
  onType: (value: string) => void;
  selected?: string | null;
  onSelect: (item: CatalogItem) => void;
  onClear: () => void;
};
export function CatalogPicker({
  allowAll,
  catalog,
  records,
  target,
  availability,
  onAvailability,
  query,
  onQuery,
  type,
  onType,
  selected,
  onSelect,
  onClear,
}: PickerProps) {
  const index = useMemo(() => buildSearchIndex(catalog), [catalog]);
  const available = useMemo(
    () =>
      pickerItems(catalog, records, target, availability, query, index, type),
    [catalog, records, target, availability, query, index, type],
  );
  const types = useMemo(
    () =>
      [
        ...new Set(
          catalog.filter((i) => isCompatible(i, target)).map((i) => i.type),
        ),
      ].sort(),
    [catalog, target],
  );
  return (
    <div className="catalog-picker">
      <SearchField
        aria-label="Search compatible items"
        value={query}
        onChange={onQuery}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            placeholder={
              target.kind === "enchantment"
                ? "Search enchantments…"
                : "Search compatible items…"
            }
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <ToggleButtonGroup
        aria-label="Picker availability"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[availability]}
        onSelectionChange={(keys) =>
          onAvailability([...keys][0] as Availability)
        }
      >
        <ToggleButton id="owned">Owned</ToggleButton>
        <ToggleButton id="discovered">Discovered</ToggleButton>
        {allowAll && <ToggleButton id="all">All</ToggleButton>}
      </ToggleButtonGroup>
      {types.length > 1 && (
        <div className="picker-types">
          <ToggleButtonGroup
            aria-label="Item type"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[type || "any"]}
            onSelectionChange={(keys) =>
              onType([...keys][0] === "any" ? "" : String([...keys][0]))
            }
          >
            <ToggleButton id="any">All types</ToggleButton>
            {types.map((t) => (
              <ToggleButton key={t} id={t}>
                {humanize(t)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
      )}
      <div className="picker-meta">
        <span role="status">
          {available.length} compatible{" "}
          {available.length === 1 ? "item" : "items"}
        </span>
        {selected && (
          <Button variant="ghost" size="sm" onPress={onClear}>
            <X size={13} />
            Clear selected slot
          </Button>
        )}
      </div>
      <div className="picker-results">
        {available.map((item) => (
          <PickerResult
            key={item.slug}
            item={item}
            selected={selected === item.slug}
            onSelect={onSelect}
          />
        ))}
      </div>
      {!available.length && (
        <div className="empty-state picker-empty">
          <SearchX size={26} />
          <h3>No matching items</h3>
          <p>
            {query || type
              ? "Try a different search or type."
              : `No compatible items in ${availability}. Discover items in Collection${allowAll ? ", or choose All to browse the full catalog." : ", or enable Show all items in the header."}`}
          </p>
          {(query || type) && (
            <Button
              variant="secondary"
              onPress={() => {
                onQuery("");
                onType("");
              }}
            >
              Clear search and type
            </Button>
          )}
        </div>
      )}
      <p className="picker-note">
        {availability === "all"
          ? "All catalog items are visible here. Your collection is unchanged."
          : "Only your available items are shown. Equipping never changes your collection."}
      </p>
    </div>
  );
}
