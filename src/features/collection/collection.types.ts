import { z } from "zod";
import { equipmentCategorySchema } from "../catalog/catalog.schema";
export const filtersSchema = z.object({
  q: z.string().catch("").optional(),
  category: z.string().catch("").optional(),
  type: z.string().catch("").optional(),
  appliesTo: z
    .union([equipmentCategorySchema, z.literal("unknown"), z.literal("")])
    .catch("")
    .optional(),
  sort: z.enum(["name", "category"]).catch("name").optional(),
});
export type CollectionFilters = z.infer<typeof filtersSchema>;
