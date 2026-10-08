import { useState } from "react";
import {
  Button,
  Modal,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@heroui/react";
import { ListFilter, X } from "lucide-react";
import type { CatalogItem } from "../../catalog/catalog.types";
import { CatalogPicker } from "../../builds/components/CatalogPicker";
import { ItemArtwork } from "../../builds/components/ItemArtwork";
import {
  MAX_EFFECT_FILTERS,
  type CollectionFilters,
} from "../collection.types";

export function EffectFilter({
  effects,
  filters,
  onChange,
  disabled,
}: {
  disabled?: boolean;
  effects: CatalogItem[];
  filters: CollectionFilters;
  onChange: (patch: CollectionFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  return (
    <>
      <Button
        className="effect-filter-trigger"
        isDisabled={disabled}
        variant="secondary"
        onPress={() => {
          setSelected(filters.effects ?? []);
          setQuery("");
          setType("");
          setOpen(true);
        }}
      >
        <ListFilter size={15} />
        Filter by effects
      </Button>
      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container
          size="lg"
          className="build-picker-sheet effect-filter-modal"
        >
          <Modal.Dialog aria-label="Filter by effects">
            <Modal.Header>
              <Modal.Heading>Filter by effects</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              <CatalogPicker
                mode="filter"
                catalog={effects}
                target={{ kind: "effect", slot: "melee", index: 0 }}
                query={query}
                onQuery={setQuery}
                type={type}
                onType={setType}
                selectedSlugs={selected}
                lockedSlugs={[]}
                selectedTiers={{}}
                multiple
                selectionLimit={MAX_EFFECT_FILTERS}
                showClear={false}
                onClear={() => setSelected([])}
                onSelect={(effect) =>
                  setSelected((current) =>
                    current.includes(effect.slug)
                      ? current.filter((slug) => slug !== effect.slug)
                      : current.length < MAX_EFFECT_FILTERS
                        ? [...current, effect.slug]
                        : current,
                  )
                }
              />
            </Modal.Body>
            <Modal.Footer>
              <span className="muted effect-filter-selected" role="status">
                {selected.length} / {MAX_EFFECT_FILTERS} selected
              </span>
              <Button
                variant="ghost"
                onPress={() => setSelected([])}
                isDisabled={!selected.length}
              >
                Clear
              </Button>
              <Button variant="secondary" onPress={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onPress={() => {
                  onChange({ effects: selected });
                  setOpen(false);
                }}
              >
                Apply filters
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

export function SelectedEffects({
  effects,
  filters,
  onChange,
}: {
  effects: CatalogItem[];
  filters: CollectionFilters;
  onChange: (patch: CollectionFilters) => void;
}) {
  if (!filters.effects?.length) return null;
  const selected = filters.effects;
  return (
    <div className="selected-effects" aria-label="Selected effect filters">
      {selected.map((slug) => {
        const effect = effects.find((entry) => entry.slug === slug);
        const name = effect?.variation ?? slug;
        return (
          <Tooltip key={slug} delay={150}>
            <Tooltip.Trigger<"button">
              render={(props) => (
                <button
                  {...props}
                  type="button"
                  className="selected-effect-icon modifier-button effect"
                  aria-label={`Remove ${name} filter`}
                  onClick={() =>
                    onChange({
                      effects: selected.filter((entry) => entry !== slug),
                    })
                  }
                >
                  <span className="modifier-art" aria-hidden="true">
                    <ItemArtwork item={effect} />
                  </span>
                  <X
                    size={10}
                    className="selected-effect-remove"
                    aria-hidden="true"
                  />
                </button>
              )}
            />
            <Tooltip.Content>
              <strong>{name}</strong>
              {effect?.description && <p>{effect.description}</p>}
              <p className="muted">Click to remove</p>
            </Tooltip.Content>
          </Tooltip>
        );
      })}
      <ToggleButtonGroup
        aria-label="Match effects"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[filters.effectMatch ?? "all"]}
        onSelectionChange={(keys) =>
          onChange({ effectMatch: [...keys][0] === "any" ? "any" : "all" })
        }
      >
        <ToggleButton id="all">All</ToggleButton>
        <ToggleButton id="any">Any</ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}
