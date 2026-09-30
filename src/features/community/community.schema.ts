import { z } from "zod";
import { buildSchema, BUILD_SLOTS } from "../builds/build.types";

export const inlineSchema = z.object({
  text: z.string().max(12_000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
});
export const descriptionSchema = z
  .array(
    z.object({
      type: z.enum(["paragraph", "heading", "bulletList", "orderedList"]),
      content: z.array(z.array(inlineSchema).max(100)).min(1).max(100),
    }),
  )
  .max(100)
  .refine(
    (value) => JSON.stringify(value).length <= 24_000,
    "Description is too long",
  );
export type Description = z.infer<typeof descriptionSchema>;
export const descriptionText = (value: Description) =>
  value
    .flatMap((block) =>
      block.content.map((line) => line.map((part) => part.text).join("")),
    )
    .join("\n");
export const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(
        /^[\p{L}\p{N}][\p{L}\p{N} _+-]*$/u,
        "Use letters, numbers, spaces, +, - or _ in tags",
      ),
  )
  .max(10)
  .transform((tags) => [
    ...new Map(tags.map((tag) => [tag.toLocaleLowerCase(), tag])).values(),
  ]);
export const communityDraftSchema = z.object({
  build: buildSchema
    .refine(
      (build) => JSON.stringify(build).length <= 20_000,
      "Build is too large",
    )
    .refine(
      (build) => BUILD_SLOTS.some((slot) => build.slots[slot]),
      "Equip at least one item before posting",
    ),
  name: z.string().trim().min(1).max(80),
  tags: tagsSchema,
  description: descriptionSchema.refine(
    (value) => descriptionText(value).trim().length > 0,
    "Add a description",
  ),
  displayName: z.string().trim().min(1).max(40),
  discord: z.string().trim().max(80).default(""),
});
export const communityPostSchema = communityDraftSchema.extend({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
});
export type CommunityDraft = z.infer<typeof communityDraftSchema>;
export const communityBuildSchema = communityDraftSchema.extend({
  id: z.uuid(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type CommunityBuild = z.infer<typeof communityBuildSchema>;
export const communityListSchema = z.object({
  builds: z.array(communityBuildSchema),
  hasMore: z.boolean(),
});
