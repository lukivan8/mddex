import { z } from "zod";

export const eventNames = [
  "session_started",
  "page_view",
  "catalog_search_used",
  "catalog_category_selected",
  "catalog_filter_used",
  "catalog_sort_changed",
  "mobs_search_used",
  "mob_kind_selected",
  "mob_location_selected",
  "mob_sort_changed",
  "build_navigation",
  "build_create_attempt",
  "build_created",
  "build_slot_selected",
  "build_equip_attempt",
  "build_equipped",
  "build_save_failed",
  "build_slot_cleared",
  "build_switched",
  "build_deleted",
  "build_summary_viewed",
  "build_shared",
  "shared_build_opened",
  "shared_build_saved",
] as const;
export type AnalyticsEvent = (typeof eventNames)[number];
export const analyticsLabels = [
  "all",
  "melee_weapon",
  "ranged_weapon",
  "armor",
  "artifact",
  "talisman",
  "enchantment",
  "gear_effect",
  "hostile",
  "boss",
  "companion",
  "neutral",
  "type",
  "applies_to",
] as const;
export type AnalyticsLabel = (typeof analyticsLabels)[number];
const pagePath = z.union([
  z.enum(["/build", "/collection", "/mobs"]),
  z
    .string()
    .regex(
      /^\/catalog\/(?:melee-weapons|ranged-weapons|armor|artifacts|talismans|enchantments|gear-effects|mobs|locations|status|cape|pet)\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
    )
    .max(160),
]);
export const analyticsSchema = z
  .object({
    event: z.enum(eventNames),
    visitorId: z.uuid(),
    sessionId: z.uuid(),
    returning: z.boolean(),
    path: pagePath,
    label: z.enum(analyticsLabels).optional(),
  })
  .strict();

export const ANALYTICS_BATCH_SIZE = 100;
export const ANALYTICS_BODY_LIMIT = 48 * 1024;
export const ANALYTICS_RETENTION = 7 * 24 * 60 * 60 * 1000;
export const queuedAnalyticsSchema = analyticsSchema.extend({
  id: z.uuid(),
  occurredAt: z.number().int().positive().max(8.64e15),
  visitorHistory: z
    .object({
      firstSeenAt: z.number().int().positive().max(8.64e15),
      firstSeenKnown: z.boolean(),
    })
    .strict()
    .optional(),
});
export type QueuedAnalyticsEvent = z.infer<typeof queuedAnalyticsSchema>;
export const analyticsBatchSchema = z
  .object({
    events: z.array(queuedAnalyticsSchema).min(1).max(ANALYTICS_BATCH_SIZE),
  })
  .strict();
