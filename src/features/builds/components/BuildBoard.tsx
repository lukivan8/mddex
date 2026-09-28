import { Button, Tooltip } from "@heroui/react";
import { Plus, X } from "lucide-react";
import type { CatalogItem } from "../../catalog/catalog.types";
import { slotRules } from "../build.compatibility";
import {
  ENCHANTMENT_COUNT,
  isGearSlot,
  type Build,
  type BuildSlot,
  type BuildTarget,
} from "../build.types";
import { ItemArtwork } from "./ItemArtwork";
function GearSlotCard({
  slot,
  build,
  catalog,
  target,
  onTarget,
  onClear,
}: BoardProps & { slot: BuildSlot }) {
  const equipped = build.slots[slot];
  const item = equipped ? catalog.get(equipped.itemSlug) : undefined;
  const name =
    item?.variation ?? (equipped ? "Unavailable item" : "Choose item");
  const active = target?.slot === slot && target.kind === "item";
  return (
    <div className={`gear-slot ${active ? "active" : ""}`}>
      <Button
        variant="ghost"
        className="gear-select"
        aria-label={`Choose ${slotRules[slot].label}`}
        aria-pressed={active}
        onPress={() => onTarget({ kind: "item", slot })}
      >
        <span className="gear-art">
          {equipped ? <ItemArtwork item={item} /> : <Plus size={22} />}
        </span>
        <span className="gear-copy">
          <span className="eyebrow">{slotRules[slot].label}</span>
          <span className="gear-name">{name}</span>
        </span>
      </Button>
      {equipped && (
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="gear-clear"
          aria-label={`Clear ${slotRules[slot].label}`}
          onPress={() => onClear({ kind: "item", slot })}
        >
          <X size={13} />
        </Button>
      )}
      {isGearSlot(slot) && (
        <div
          className="enchantment-strip"
          aria-label={`${slotRules[slot].label} enchantments`}
        >
          {Array.from({ length: ENCHANTMENT_COUNT }, (_, index) => {
            const slug = equipped?.enchantments[index];
            const enchantment = slug ? catalog.get(slug) : undefined;
            const label =
              enchantment?.variation ??
              (slug ? "Unavailable enchantment" : "Empty enchantment");
            const selected =
              target?.kind === "enchantment" &&
              target.slot === slot &&
              target.index === index;
            return (
              <Tooltip key={index} delay={250}>
                <Button
                  isIconOnly
                  variant="ghost"
                  className={`enchantment-slot ${selected ? "active" : ""}`}
                  aria-label={`${slotRules[slot].label} enchantment ${index + 1}: ${label}`}
                  aria-pressed={selected}
                  onPress={() =>
                    onTarget(
                      equipped
                        ? { kind: "enchantment", slot, index }
                        : { kind: "item", slot },
                    )
                  }
                >
                  {slug ? (
                    <ItemArtwork item={enchantment} />
                  ) : (
                    <Plus size={14} />
                  )}
                </Button>

                <Tooltip.Content>
                  {equipped ? label : "Choose equipment first"}
                </Tooltip.Content>
              </Tooltip>
            );
          })}
          <span className="enchantment-caption">Enchantments</span>
        </div>
      )}
    </div>
  );
}
type BoardProps = {
  build: Build;
  catalog: ReadonlyMap<string, CatalogItem>;
  target?: BuildTarget;
  onTarget: (target: BuildTarget) => void;
  onClear: (target: BuildTarget) => void;
};
const sections: { label: string; slots: BuildSlot[]; className: string }[] = [
  { label: "Weapons", slots: ["melee", "ranged"], className: "weapon-slots" },
  {
    label: "Armor",
    slots: ["head", "torso", "legs", "feet"],
    className: "armor-slots",
  },
  {
    label: "Artifacts",
    slots: ["artifact1", "artifact2", "artifact3"],
    className: "trinket-slots",
  },
  {
    label: "Talismans",
    slots: ["talisman1", "talisman2", "talisman3"],
    className: "trinket-slots",
  },
];
export function BuildBoard(props: BoardProps) {
  return (
    <div className="build-board" aria-label="Loadout equipment">
      {sections.map((section) => (
        <section key={section.label}>
          <h2 className="board-section-title">{section.label}</h2>
          <div className={section.className}>
            {section.slots.map((slot) => (
              <GearSlotCard key={slot} slot={slot} {...props} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
