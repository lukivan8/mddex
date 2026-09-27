import { z } from "zod";
export const completionSchema = z
  .object({
    itemSlug: z.string().min(1),
    owned: z.boolean(),
    discovered: z.boolean(),
  })
  .refine(
    (record) => !record.owned || record.discovered,
    "Collected items must be discovered",
  );
export type CompletionRecord = z.infer<typeof completionSchema>;
export const filtersSchema = z.object({
  q: z.string().catch("").optional(),
  category: z.string().catch("").optional(),
  type: z.string().catch("").optional(),
  status: z.enum(["all", "missing", "collected"]).catch("all").optional(),
  sort: z
    .enum(["name", "category", "missing", "collected"])
    .catch("name")
    .optional(),
});
export type CollectionFilters = z.infer<typeof filtersSchema>;
export type Progress = { owned: number; total: number; percent: number };
