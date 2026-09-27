import { z } from "zod";
export const catalogItemSchema = z.object({
  slug: z.string().min(1),
  category: z.string().min(1),
  type: z.string().min(1),
  variation: z.string().min(1),
  image: z.string().min(1).nullable(),
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
