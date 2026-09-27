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
// Composition assumption, not a claim about final game eligibility.
export const ENCHANTMENT_COUNT = 3;
export const equippedSchema = z.object({
  itemSlug: z.string().min(1),
  enchantments: z.array(z.string().min(1).nullable()).max(ENCHANTMENT_COUNT),
});
export const buildSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(80),
  createdAt: z.string(),
  updatedAt: z.string(),
  slots: z.record(z.enum(BUILD_SLOTS), equippedSchema.nullable()),
});
export type Build = z.infer<typeof buildSchema>;
export type BuildTarget =
  | { kind: "item"; slot: BuildSlot }
  | { kind: "enchantment"; slot: GearSlot; index: number };
export const availabilitySchema = z.enum(["owned", "discovered", "all"]);
export type Availability = z.infer<typeof availabilitySchema>;
export const buildPreferenceSchema = z.object({
  id: z.literal("workspace"),
  activeId: z.string().nullable(),
  availability: availabilitySchema,
});
export const isGearSlot = (slot: BuildSlot): slot is GearSlot =>
  (GEAR_SLOTS as readonly string[]).includes(slot);
