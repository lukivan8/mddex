import { z } from "zod";
export const equipmentCategorySchema = z.enum([
  "melee_weapon",
  "ranged_weapon",
  "armor",
  "artifact",
]);
export const catalogItemSchema = z.object({
  slug: z.string().min(1),
  category: z.string().min(1),
  type: z.string().min(1),
  variation: z.string().min(1),
  image: z.string().min(1).nullable(),
  description: z.string().nullish(),
  applicable_categories: z.array(equipmentCategorySchema).nullish(),
  // Retain release metadata, including item sources and location loot links.
  game_data: z.record(z.string(), z.unknown()).nullish(),
});
export const catalogSchema = z
  .array(catalogItemSchema)
  .refine(
    (items) => new Set(items.map((item) => item.slug)).size === items.length,
    "Catalog contains duplicate slugs",
  );

export const latestReleaseSchema = z.object({
  catalogVersion: z.string().min(1),
  manifest: z.string().trim().min(1),
});
