import { memo, useMemo, useState } from "react";
import {
  Button,
  SearchField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { Check, SearchX, X } from "lucide-react";
import { buildSearchIndex, humanize } from "../../catalog/catalog.helpers";
import type { CatalogItem } from "../../catalog/catalog.types";
import { pickerItems } from "../build.selectors";
import { isCompatible } from "../build.compatibility";
import {
  EFFECT_COUNT,
  type BuildTarget,
  type ModifierTier,
} from "../build.types";
import { availableTiers, selectedTier, tierDescription } from "../build.tiers";
import { ItemArtwork } from "./ItemArtwork";
import { slotRules } from "../build.compatibility";
import { uniqueEffect } from "../build.unique";
const PickerResult = memo(function PickerResult({
  item,
  selected,
  onSelect,
  disabled,
  effect,
  locked,
  tier,
  innate,
  gearCategory,
  builtInEffect,
  comparison,
}: {
  item: CatalogItem;
  selected: boolean;
  disabled: boolean;
  effect: boolean;
  locked: boolean;
  tier?: ModifierTier | null;
  innate?: CatalogItem;
  gearCategory: string;
  builtInEffect?: CatalogItem;
  comparison: boolean;
  onSelect: (item: CatalogItem, tier?: ModifierTier) => void;
}) {
  const [hoveredTier, setHoveredTier] = useState<ModifierTier>();
  const [focusedTier, setFocusedTier] = useState<ModifierTier>();
  const tiers =
    item.category === "gear_effect" ||
    item.category === "enchantment" ||
    item.category === "talisman"
      ? availableTiers(item, gearCategory)
      : [];
  const chosen = selectedTier(item, tier, gearCategory);
  const description = locked
    ? (innate?.description ?? item.description)
    : tierDescription(item, hoveredTier ?? focusedTier ?? tier, gearCategory);
  return (
    <div className="picker-result-row">
      <Button
        variant="ghost"
        className={`picker-result ${selected ? "active" : ""} ${locked ? "unique-effect" : ""}`}
        aria-label={
          comparison
            ? `Select ${item.variation} for comparison`
            : `${effect ? "Add effect" : "Equip"} ${item.variation}`
        }
        isDisabled={disabled}
        aria-pressed={selected}
        onPress={() => onSelect(item)}
      >
        <span className="picker-art">
          <ItemArtwork item={item} />
        </span>
        <span className="picker-result-copy">
          <span
            className={`picker-result-name ${tiers.length && !locked ? "with-tiers" : ""}`}
            style={
              tiers.length && !locked
                ? { paddingRight: tiers.length * 33 + 11 }
                : builtInEffect
                  ? { paddingRight: 44, minHeight: 32 }
                  : undefined
            }
          >
            <strong>{item.variation}</strong>
            {selected && <Check size={15} />}
          </span>
          <span className="muted">{humanize(item.type)}</span>
          {locked && (
            <span className="unique-effect-label">Unique effect · Locked</span>
          )}
          {description && (
            <span className="picker-description">{description}</span>
          )}
        </span>
        {builtInEffect && (
          <span
            className="picker-unique-icon"
            aria-label={`Unique effect: ${builtInEffect.variation}`}
            title={`${builtInEffect.variation}${builtInEffect.description ? `: ${builtInEffect.description}` : ""}`}
          >
            <ItemArtwork item={builtInEffect} />
          </span>
        )}
      </Button>
      {tiers.length > 0 && !locked && (
        <div
          className="picker-tiers"
          role="group"
          aria-label={`${item.variation} tier`}
        >
          {tiers.map((entry) => (
            <button
              key={entry.tier}
              type="button"
              className="tier-button"
              disabled={disabled}
              aria-label={`Select ${item.variation} tier ${entry.tier}`}
              aria-pressed={selected && chosen?.tier === entry.tier}
              onPointerEnter={(event) => {
                if (
                  event.pointerType === "mouse" ||
                  event.pointerType === "pen"
                )
                  setHoveredTier(entry.tier);
              }}
              onPointerLeave={() => setHoveredTier(undefined)}
              onFocus={() => setFocusedTier(entry.tier)}
              onBlur={() => setFocusedTier(undefined)}
              onClick={() => onSelect(item, entry.tier)}
            >
              {entry.tier}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
export type PickerProps = {
  catalog: CatalogItem[];
  target: BuildTarget;
  equipment?: CatalogItem;
  query: string;
  onQuery: (value: string) => void;
  type: string;
  onType: (value: string) => void;
  selected?: string | null;
  selectedSlugs: string[];
  lockedSlugs: string[];
  lockedEffect?: CatalogItem;
  selectedTiers: Record<string, ModifierTier | null | undefined>;
  multiple: boolean;
  onSelect: (item: CatalogItem, tier?: ModifierTier) => void;
  onClear: () => void;
  mode?: "build" | "compare";
};
export function CatalogPicker({
  catalog,
  target,
  equipment,
  query,
  onQuery,
  type,
  onType,
  selected,
  selectedSlugs,
  lockedSlugs,
  lockedEffect,
  selectedTiers,
  multiple,
  onSelect,
  onClear,
  mode = "build",
}: PickerProps) {
  const index = useMemo(() => buildSearchIndex(catalog), [catalog]);
  const uniqueEffects = useMemo(() => {
    const lookup = new Map(catalog.map((item) => [item.slug, item]));
    const effects = new Map<string, CatalogItem>();
    for (const item of catalog) {
      const fixed = uniqueEffect(item);
      if (!fixed) continue;
      const canonical = lookup.get(fixed.slug);
      effects.set(item.slug, {
        ...(canonical ?? fixed),
        description: fixed.description ?? canonical?.description,
      });
    }
    return effects;
  }, [catalog]);
  const available = useMemo(() => {
    const items = pickerItems(catalog, target, query, index, type, equipment);
    if (target.kind !== "effect" || !lockedEffect) return items;
    const fixed =
      catalog.find((item) => item.slug === lockedEffect.slug) ?? lockedEffect;
    return [fixed, ...items.filter((item) => item.slug !== fixed.slug)];
  }, [catalog, target, query, index, type, lockedEffect, equipment]);
  const types = useMemo(
    () =>
      [
        ...new Set(
          catalog
            .filter((i) => isCompatible(i, target, equipment))
            .map((i) => i.type),
        ),
      ].sort(),
    [catalog, target, equipment],
  );
  return (
    <div className="catalog-picker">
      {multiple && (
        <p className="muted" role="status">
          {selectedSlugs.length} / {target.kind === "effect" ? EFFECT_COUNT : 3}{" "}
          selected. Click {target.kind === "effect" ? "an effect" : "an item"}{" "}
          to select or deselect it.
          {lockedSlugs.length > 0 && " Unique effects are locked."}
        </p>
      )}
      <SearchField
        aria-label={
          mode === "compare"
            ? "Search weapons"
            : target.kind === "effect"
              ? "Search effects"
              : "Search compatible items"
        }
        value={query}
        onChange={onQuery}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            placeholder={
              mode === "compare"
                ? "Search weapons…"
                : target.kind === "effect"
                  ? "Search effects…"
                  : target.kind === "enchantment"
                    ? "Search enchantments…"
                    : "Search compatible items…"
            }
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
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
        {(multiple
          ? selectedSlugs.some((slug) => !lockedSlugs.includes(slug))
          : selected) && (
          <Button variant="ghost" size="sm" onPress={onClear}>
            <X size={13} />
            {multiple
              ? "Clear selection"
              : mode === "compare"
                ? "Clear weapon"
                : "Clear selected slot"}
          </Button>
        )}
      </div>
      <div className="picker-results">
        {available.map((item) => (
          <PickerResult
            key={item.slug}
            item={item}
            builtInEffect={uniqueEffects.get(item.slug)}
            comparison={mode === "compare"}
            effect={target.kind === "effect"}
            gearCategory={slotRules[target.slot].category}
            selected={
              multiple
                ? selectedSlugs.includes(item.slug)
                : selected === item.slug
            }
            locked={lockedSlugs.includes(item.slug)}
            innate={lockedSlugs.includes(item.slug) ? lockedEffect : undefined}
            tier={selectedTiers[item.slug]}
            disabled={
              lockedSlugs.includes(item.slug) ||
              (multiple &&
                selectedSlugs.length >=
                  (target.kind === "effect" ? EFFECT_COUNT : 3) &&
                !selectedSlugs.includes(item.slug))
            }
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
              : "No compatible items in the catalog."}
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
    </div>
  );
}
