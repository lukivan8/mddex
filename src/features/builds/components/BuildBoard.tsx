import { Button, Skeleton, Tooltip } from "@heroui/react";
import { Plus, X, Sparkles } from "lucide-react";
import type { CatalogItem } from "../../catalog/catalog.types";
import { selectionTargets } from "../build.selection";
import { slotRules } from "../build.compatibility";
import { uniqueEffect } from "../build.unique";
import { selectedTier } from "../build.tiers";
import type { ModifierTier } from "../build.types";
import {
  EFFECT_COUNT,
  supportsEffects,
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
  readOnly,
  catalogPending,
}: BoardProps & { slot: BuildSlot }) {
  const equipped = build.slots[slot];
  const item = equipped ? catalog.get(equipped.itemSlug) : undefined;
  const fixed = uniqueEffect(item);
  const tierFor = (slug?: string | null, tier?: ModifierTier | null) => {
    const modifier = slug ? catalog.get(slug) : undefined;
    return modifier ? selectedTier(modifier, tier)?.tier : undefined;
  };
  const name =
    item?.variation ?? (equipped ? "Unavailable item" : "Choose item");
  const talismanTier =
    item?.category === "talisman"
      ? selectedTier(item, equipped?.itemTier, item.category)?.tier
      : undefined;
  const active =
    target?.kind === "item" &&
    selectionTargets(target).some((position) => position.slot === slot);
  return (
    <div className={`gear-slot ${active ? "active" : ""}`}>
      <button
        type="button"
        disabled={readOnly}
        className="gear-select"
        aria-label={`Choose ${slotRules[slot].label}`}
        aria-pressed={active}
        onClick={() => onTarget({ kind: "item", slot })}
      >
        <span className="gear-art">
          {equipped ? (
            catalogPending ? (
              <Skeleton className="build-loading-art" />
            ) : (
              <ItemArtwork item={item} />
            )
          ) : (
            <Plus size={22} />
          )}
          {equipped && !catalogPending && (
            <span
              className="gear-power"
              aria-label={`Power ${equipped.power ?? 1}`}
            >
              {equipped.power ?? 1}
            </span>
          )}
        </span>
        <span className="gear-copy">
          <span className="eyebrow">{slotRules[slot].label}</span>
          <span className="gear-name">
            {equipped && catalogPending ? (
              <Skeleton className="build-loading-item-name" />
            ) : (
              name
            )}
            {talismanTier ? ` ${talismanTier}` : ""}
          </span>
        </span>
      </button>
      {equipped && !readOnly && (
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
      {(isGearSlot(slot) || supportsEffects(slot)) && (
        <div
          className={`gear-modifiers ${isGearSlot(slot) ? "with-enchantment" : ""}`}
        >
          {isGearSlot(slot) && (
            <ModifierButton
              slot={slot}
              kind="enchantment"
              index={0}
              equipped={!!equipped}
              slug={equipped?.enchantments[0]}
              tier={tierFor(
                equipped?.enchantments[0],
                equipped?.enchantmentTier,
              )}
              catalog={catalog}
              target={target}
              readOnly={readOnly}
              catalogPending={catalogPending}
              onTarget={onTarget}
            />
          )}
          {supportsEffects(slot) &&
            Array.from({ length: EFFECT_COUNT }, (_, index) => (
              <ModifierButton
                key={index}
                slot={slot}
                kind="effect"
                index={index}
                equipped={!!equipped}
                slug={equipped?.effects[index]}
                catalog={catalog}
                target={target}
                readOnly={readOnly}
                catalogPending={catalogPending}
                locked={index === 0 && !!fixed}
                tier={
                  index === 0 && fixed
                    ? typeof fixed.game_data?.fixed_tier === "string"
                      ? fixed.game_data.fixed_tier
                      : "unique"
                    : tierFor(
                        equipped?.effects[index],
                        equipped?.effectTiers?.[index],
                      )
                }
                onTarget={onTarget}
              />
            ))}
        </div>
      )}
    </div>
  );
}
function ModifierButton({
  slot,
  kind,
  index,
  equipped,
  slug,
  catalog,
  target,
  onTarget,
  readOnly,
  catalogPending,
  locked = false,
  tier,
}: Pick<
  BoardProps,
  "catalog" | "target" | "onTarget" | "readOnly" | "catalogPending"
> & {
  slot: BuildSlot;
  kind: "enchantment" | "effect";
  index: number;
  equipped: boolean;
  slug?: string | null;
  locked?: boolean;
  tier?: string;
}) {
  const item = slug ? catalog.get(slug) : undefined;
  const label =
    item?.variation ?? (slug ? `Unavailable ${kind}` : `Empty ${kind}`);
  const selected = target?.kind === kind && target.slot === slot;
  const choose = () => {
    if (!equipped) onTarget({ kind: "item", slot });
    else if (kind === "enchantment" && isGearSlot(slot))
      onTarget({ kind, slot, index: 0 });
    else onTarget({ kind: "effect", slot, index });
  };
  return (
    <Tooltip delay={150}>
      <Tooltip.Trigger<"button">
        render={(props) => (
          <button
            {...props}
            type="button"
            disabled={readOnly}
            className={`modifier-button ${kind} ${selected ? "active" : ""} ${locked ? "unique-effect" : ""}`}
            aria-label={`${slotRules[slot].label} ${kind} ${index + 1}: ${label}${locked ? " (unique effect, locked)" : ""}`}
            aria-pressed={selected}
            onClick={choose}
          >
            <span className="modifier-art">
              {slug ? (
                catalogPending ? (
                  <Skeleton className="build-loading-modifier" />
                ) : (
                  <ItemArtwork item={item} />
                )
              ) : kind === "enchantment" ? (
                <Sparkles size={15} />
              ) : (
                <Plus size={14} />
              )}
            </span>
            {tier && (
              <span className="modifier-tier" aria-hidden="true">
                {tier === "unique" ? "U" : tier}
              </span>
            )}
          </button>
        )}
      />
      <Tooltip.Content>
        {equipped
          ? `${label}${tier && tier !== "unique" ? ` · Tier ${tier}` : ""}${locked ? " · Unique effect (locked)" : ""}`
          : "Choose equipment first"}
      </Tooltip.Content>
    </Tooltip>
  );
}
type BoardProps = {
  readOnly?: boolean;
  catalogPending?: boolean;
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
    className: "trinket-slots artifact-slots",
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
