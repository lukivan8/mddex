import type { CatalogItem } from "../catalog/catalog.types";
import type { BuildCollections } from "./build.db";
import {
  BUILD_SLOTS,
  ENCHANTMENT_COUNT,
  EFFECT_COUNT,
  supportsEffects,
  isGearSlot,
  type Build,
  type BuildTarget,
  type BuildSlot,
  itemPowerSchema,
  type ModifierTier,
} from "./build.types";
import { isCompatible } from "./build.compatibility";
import { uniqueEffect, withUniqueEffects } from "./build.unique";
import { availableTiers, selectedTier } from "./build.tiers";
export function emptyBuild(
  name = "Untitled loadout",
  id = crypto.randomUUID(),
): Build {
  const now = new Date().toISOString();
  return {
    id,
    name: name.trim().slice(0, 80) || "Untitled loadout",
    createdAt: now,
    updatedAt: now,
    slots: Object.fromEntries(
      BUILD_SLOTS.map((s) => [s, null]),
    ) as Build["slots"],
  };
}
export function createBuild(db: BuildCollections, name?: string) {
  const build = emptyBuild(name);
  return { build, transaction: db.builds.insert(build) };
}
export function setWorkspace(
  db: BuildCollections,
  patch: { activeId?: string; hideCompatibilityWarnings?: boolean },
) {
  return db.preferences.has("workspace")
    ? db.preferences.update("workspace", (p) => {
        Object.assign(p, patch);
      })
    : db.preferences.insert({
        id: "workspace",
        activeId: null,
        ...patch,
      });
}
export function renameBuild(db: BuildCollections, id: string, name: string) {
  return db.builds.update(id, (b) => {
    b.name = name.slice(0, 80);
    b.updatedAt = new Date().toISOString();
  });
}
export function compose(
  build: Build,
  target: BuildTarget,
  item: CatalogItem | null,
  catalog: ReadonlyMap<string, CatalogItem> = new Map(),
  tier?: ModifierTier,
): Build {
  const equipment = build.slots[target.slot];
  if (
    item &&
    !isCompatible(
      item,
      target,
      target.kind === "item"
        ? undefined
        : equipment
          ? catalog.get(equipment.itemSlug)
          : undefined,
    )
  )
    throw new Error("This item does not fit the selected slot.");
  const next = structuredClone(withUniqueEffects(build, catalog));
  if (target.kind === "item") {
    const old = next.slots[target.slot];
    const oldFixed = old ? uniqueEffect(catalog.get(old.itemSlug)) : undefined;
    const fixed = item ? uniqueEffect(item) : undefined;
    const effects = old?.effects ?? Array(EFFECT_COUNT).fill(null);
    const keptIndices = effects.flatMap((slug, index) =>
      slug && slug !== oldFixed?.slug && slug !== fixed?.slug ? [index] : [],
    );
    if (
      tier &&
      item &&
      !availableTiers(item, item.category).some((entry) => entry.tier === tier)
    )
      throw new Error("This tier is not available for the selected item.");
    const itemTier =
      item?.category === "talisman"
        ? selectedTier(item, tier, item.category)?.tier
        : undefined;
    next.slots[target.slot] = item
      ? {
          itemSlug: item.slug,
          ...(old?.power !== undefined ? { power: old.power } : {}),
          ...(itemTier ? { itemTier } : {}),
          enchantments: isGearSlot(target.slot)
            ? (old?.enchantments ?? Array(ENCHANTMENT_COUNT).fill(null))
            : [],
          effects: supportsEffects(target.slot)
            ? fixed
              ? [
                  fixed.slug,
                  ...effects.filter(
                    (slug) =>
                      slug && slug !== oldFixed?.slug && slug !== fixed.slug,
                  ),
                  ...Array(EFFECT_COUNT).fill(null),
                ].slice(0, EFFECT_COUNT)
              : oldFixed
                ? effects.map((slug) => (slug === oldFixed.slug ? null : slug))
                : effects
            : [],
          ...(old?.enchantmentTier !== undefined && isGearSlot(target.slot)
            ? { enchantmentTier: old.enchantmentTier }
            : {}),
          ...(old?.effectTiers && supportsEffects(target.slot)
            ? {
                effectTiers: fixed
                  ? [
                      null,
                      ...keptIndices.map(
                        (index) => old.effectTiers![index] ?? null,
                      ),
                      ...Array(EFFECT_COUNT).fill(null),
                    ].slice(0, EFFECT_COUNT)
                  : oldFixed
                    ? old.effectTiers.map((value, index) =>
                        index === 0 ? null : value,
                      )
                    : old.effectTiers,
              }
            : {}),
        }
      : null;
    // Explicit gear replacement keeps compatible selections and their tiers.
    const equipped = next.slots[target.slot];
    if (item && equipped) {
      equipped.enchantments = equipped.enchantments.map((slug, index) => {
        const modifier = slug ? catalog.get(slug) : undefined;
        if (
          !modifier ||
          isCompatible(
            modifier,
            { kind: "enchantment", slot: target.slot, index } as BuildTarget,
            item,
          )
        )
          return slug;
        equipped.enchantmentTier = null;
        return null;
      });
      equipped.effects = equipped.effects.map((slug, index) => {
        if (index === 0 && slug === fixed?.slug) return slug;
        const modifier = slug ? catalog.get(slug) : undefined;
        if (
          !modifier ||
          isCompatible(
            modifier,
            { kind: "effect", slot: target.slot, index },
            item,
          )
        )
          return slug;
        if (equipped.effectTiers) equipped.effectTiers[index] = null;
        return null;
      });
    }
  } else {
    const gear = next.slots[target.slot];
    if (
      !gear ||
      target.index < 0 ||
      (target.kind === "effect" && !supportsEffects(target.slot)) ||
      target.index >=
        (target.kind === "effect" ? EFFECT_COUNT : ENCHANTMENT_COUNT) ||
      !Number.isInteger(target.index)
    )
      throw new Error("Choose equipment and a valid modifier position first.");
    const modifiers =
      target.kind === "effect" ? gear.effects : gear.enchantments;
    const fixed = uniqueEffect(catalog.get(gear.itemSlug));
    if (
      target.kind === "effect" &&
      fixed &&
      (target.index === 0 || item?.slug === fixed.slug)
    )
      throw new Error("The unique effect is locked to this equipment.");
    modifiers[target.index] = item?.slug ?? null;
    const gearCategory = catalog.get(gear.itemSlug)?.category;
    if (
      tier &&
      item &&
      !availableTiers(item, gearCategory).some((entry) => entry.tier === tier)
    )
      throw new Error("This tier is not available for the selected modifier.");
    const chosenTier = item
      ? selectedTier(item, tier, gearCategory)?.tier
      : null;
    if (target.kind === "effect" && (chosenTier || gear.effectTiers)) {
      gear.effectTiers ??= Array(EFFECT_COUNT).fill(null);
      gear.effectTiers![target.index] = chosenTier ?? null;
    } else if (
      target.kind === "enchantment" &&
      (chosenTier || gear.enchantmentTier !== undefined)
    ) {
      gear.enchantmentTier = chosenTier ?? null;
    }
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
export function composeItemPower(
  build: Build,
  slot: BuildSlot,
  power: number,
): Build {
  const valid = itemPowerSchema.parse(power);
  const next = structuredClone(build);
  const equipment = next.slots[slot];
  if (!equipment) throw new Error("Choose an item before setting its power.");
  equipment.power = valid;
  next.updatedAt = new Date().toISOString();
  return next;
}
export function equip(
  db: BuildCollections,
  id: string,
  target: BuildTarget,
  item: CatalogItem | null,
  catalog?: ReadonlyMap<string, CatalogItem>,
) {
  const current = db.builds.get(id);
  if (!current) throw new Error("This loadout is no longer available.");
  const next = compose(current, target, item, catalog);
  return db.builds.update(id, (b) => {
    b.slots = next.slots;
    b.updatedAt = next.updatedAt;
  });
}

export async function deleteBuild(db: BuildCollections, id: string) {
  if (!db.builds.has(id)) return;
  const remaining = [...db.builds.values()]
    .filter((build) => build.id !== id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  let replacement: Build | undefined = remaining[0];
  // Save a replacement before deleting the final record. A failed write must
  // never leave the workspace empty or discard the original loadout.
  if (!replacement) {
    const created = createBuild(db, "Loadout 1");
    await created.transaction.isPersisted.promise;
    replacement = created.build;
  }
  const activeId = db.preferences.get("workspace")?.activeId;
  if (activeId === id || !activeId || !db.builds.has(activeId)) {
    await setWorkspace(db, { activeId: replacement.id }).isPersisted.promise;
  }
  await db.builds.delete(id).isPersisted.promise;
}
