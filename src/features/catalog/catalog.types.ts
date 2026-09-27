import type { z } from "zod";
import type { catalogItemSchema } from "./catalog.schema";
export type CatalogItem = z.infer<typeof catalogItemSchema>;
