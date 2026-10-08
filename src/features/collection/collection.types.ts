import { z } from "zod";
import { equipmentCategorySchema } from "../catalog/catalog.schema";
export const MAX_EFFECT_FILTERS = 10;
export const filtersSchema = z.object({
  q: z.string().catch("").optional(),
  category: z.string().catch("").optional(),
  type: z.string().catch("").optional(),
  appliesTo: z
    .union([equipmentCategorySchema, z.literal("unknown"), z.literal("")])
    .catch("")
    .optional(),
  effects: z
    .array(z.string().min(1).max(256))
    .max(80)
    .catch([])
    .transform((effects) => [...new Set(effects)].slice(0, MAX_EFFECT_FILTERS))
    .optional(),
  effectMatch: z.enum(["all", "any"]).catch("all").optional(),
  sort: z.enum(["name", "category"]).catch("name").optional(),
});
export type CollectionFilters = z.infer<typeof filtersSchema>;
