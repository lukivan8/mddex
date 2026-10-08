import { z } from "zod";
export const GEAR_SLOTS = [
  "melee",
  "ranged",
  "head",
  "torso",
  "legs",
  "feet",
] as const;
export const BUILD_SLOTS = [
  ...GEAR_SLOTS,
  "artifact1",
  "artifact2",
  "artifact3",
  "talisman1",
  "talisman2",
  "talisman3",
] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];
export type BuildSlot = (typeof BUILD_SLOTS)[number];
export const ENCHANTMENT_COUNT = 1;
export const EFFECT_COUNT = 3;
export const modifierTierSchema = z.enum(["I", "II", "III", "IV"]);
export type ModifierTier = z.infer<typeof modifierTierSchema>;
export const MAX_ITEM_POWER = 154;
export const itemPowerSchema = z.number().int().min(1).max(MAX_ITEM_POWER);
export const equippedSchema = z.object({
  itemSlug: z.string().min(1),
  power: itemPowerSchema.optional(),
  enchantments: z.array(z.string().min(1).nullable()).max(ENCHANTMENT_COUNT),
  effects: z.array(z.string().min(1).nullable()).max(EFFECT_COUNT).default([]),
  effectTiers: z
    .array(modifierTierSchema.nullable())
    .max(EFFECT_COUNT)
    .optional(),
  enchantmentTier: modifierTierSchema.nullable().optional(),
  itemTier: modifierTierSchema.optional(),
});
export const MAX_BUILD_VARIANTS = 8;
export const buildVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(80),
  slots: z.record(z.enum(BUILD_SLOTS), equippedSchema.nullable()),
});
export const buildSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(80),
  variants: z
    .array(buildVariantSchema)
    .max(MAX_BUILD_VARIANTS - 1)
    .refine(
      (entries) =>
        entries.every((entry) => entry.id !== "base") &&
        new Set(entries.map((entry) => entry.id)).size === entries.length,
      "Variant IDs must be unique",
    )
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  slots: z.record(z.enum(BUILD_SLOTS), equippedSchema.nullable()),
});
export type Build = z.infer<typeof buildSchema>;
export type BuildTarget =
  | { kind: "item"; slot: BuildSlot }
  | { kind: "enchantment"; slot: GearSlot; index: number }
  | { kind: "effect"; slot: BuildSlot; index: number };
export const buildPreferenceSchema = z.object({
  id: z.literal("workspace"),
  activeId: z.string().nullable(),
  hideCompatibilityWarnings: z.boolean().optional(),
});
export const isGearSlot = (slot: BuildSlot): slot is GearSlot =>
  (GEAR_SLOTS as readonly string[]).includes(slot);

export const supportsEffects = (slot: BuildSlot) =>
  !slot.startsWith("talisman");

export const supportsItemPower = (slot: BuildSlot) =>
  !slot.startsWith("talisman");
