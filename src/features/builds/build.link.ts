import { z } from "zod";
import { emptyBuild } from "./build.service";
import {
  BUILD_SLOTS,
  isGearSlot,
  supportsEffects,
  EFFECT_COUNT,
  type Build,
  equippedSchema,
  MAX_BUILD_VARIANTS,
} from "./build.types";

const MAX_BYTES = 32_768;
const payloadSchema = z.tuple([
  z.string().max(80),
  z.array(z.string().min(1).max(256)).max(60),
  z
    .array(z.array(z.number().int().min(0).max(60)).min(1).max(5).nullable())
    .length(BUILD_SLOTS.length),
  z
    .array(
      equippedSchema
        .pick({
          effectTiers: true,
          enchantmentTier: true,
          itemTier: true,
          power: true,
        })
        .nullable(),
    )
    .length(BUILD_SLOTS.length)
    .optional(),
]);

async function transform(bytes: Uint8Array, decompress: boolean) {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(
      decompress
        ? new DecompressionStream("deflate")
        : new CompressionStream("deflate"),
    );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Build link is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function encodeBuildLink(build: Build): Promise<string> {
  if (build.variants?.length) {
    const tokens = await Promise.all([
      encodeBuildLink({ ...build, variants: undefined }),
      ...build.variants.map((variant) =>
        encodeBuildLink({
          ...build,
          ...variant,
          variants: undefined,
        }),
      ),
    ]);
    const bytes = await transform(
      new TextEncoder().encode(JSON.stringify(tokens)),
      false,
    );
    const token = `2.${btoa(String.fromCharCode(...bytes))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "")}`;
    if (token.length > 8192) throw new Error("Build link is too large.");
    return token;
  }
  const slugs: string[] = [];
  const reference = (slug?: string | null) => {
    if (!slug) return 0;
    let index = slugs.indexOf(slug);
    if (index < 0) {
      index = slugs.length;
      slugs.push(slug);
    }
    return index + 1;
  };
  const slots = BUILD_SLOTS.map((slot) => {
    const gear = build.slots[slot];
    if (!gear) return null;
    const row = [
      reference(gear.itemSlug),
      reference(isGearSlot(slot) ? gear.enchantments[0] : null),
      ...Array.from({ length: EFFECT_COUNT }, (_, index) =>
        reference(supportsEffects(slot) ? gear.effects[index] : null),
      ),
    ];
    while (row.length > 1 && row.at(-1) === 0) row.pop();
    return row;
  });
  const tiers = BUILD_SLOTS.map((slot) => {
    const gear = build.slots[slot];
    return gear &&
      (gear.effectTiers ||
        gear.enchantmentTier !== undefined ||
        gear.itemTier ||
        gear.power !== undefined)
      ? {
          ...(gear.effectTiers ? { effectTiers: gear.effectTiers } : {}),
          ...(gear.enchantmentTier !== undefined
            ? { enchantmentTier: gear.enchantmentTier }
            : {}),
          ...(gear.itemTier ? { itemTier: gear.itemTier } : {}),
          ...(gear.power !== undefined ? { power: gear.power } : {}),
        }
      : null;
  });
  const payload = payloadSchema.parse([
    build.name,
    slugs,
    slots,
    ...(tiers.some(Boolean) ? [tiers] : []),
  ]);
  const bytes = await transform(
    new TextEncoder().encode(JSON.stringify(payload)),
    false,
  );
  const encoded = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return `1.${encoded}`;
}

export async function decodeBuildLink(token: string): Promise<Build> {
  try {
    if (token.length > 8192 || !/^[12]\.[A-Za-z0-9_-]+$/.test(token))
      throw new Error();
    const raw = atob(token.slice(2).replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = await transform(
      Uint8Array.from(raw, (character) => character.charCodeAt(0)),
      true,
    );
    const payload: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (token.startsWith("2.")) {
      const tokens = z
        .array(
          z
            .string()
            .max(8192)
            .regex(/^1\.[A-Za-z0-9_-]+$/),
        )
        .min(2)
        .max(MAX_BUILD_VARIANTS)
        .parse(payload);
      const [build, ...variants] = await Promise.all(
        tokens.map(decodeBuildLink),
      );
      build.variants = variants.map(({ id, name, slots }) => ({
        id,
        name,
        slots,
      }));
      return build;
    }
    const [name, slugs, slots, tiers] = payloadSchema.parse(payload);
    const resolve = (ref: number) => {
      if (ref === 0) return null;
      if (!slugs[ref - 1]) throw new Error();
      return slugs[ref - 1];
    };
    const build = emptyBuild(name);
    build.name = name;
    BUILD_SLOTS.forEach((slot, index) => {
      const row = slots[index];
      const chosen = tiers?.[index];
      if (!row) {
        if (chosen) throw new Error();
        return;
      }
      const itemSlug = resolve(row[0]);
      const enchantment = resolve(row[1] ?? 0);
      const effects = [2, 3, 4].map((position) => resolve(row[position] ?? 0));
      if (
        !itemSlug ||
        (!isGearSlot(slot) && enchantment) ||
        (!supportsEffects(slot) && effects.some(Boolean)) ||
        (chosen?.enchantmentTier && (!isGearSlot(slot) || !enchantment)) ||
        (chosen?.itemTier && !slot.startsWith("talisman")) ||
        chosen?.effectTiers?.some(
          (tier, position) =>
            tier && (!supportsEffects(slot) || !effects[position]),
        )
      )
        throw new Error();
      build.slots[slot] = {
        itemSlug,
        enchantments: isGearSlot(slot) ? [enchantment] : [],
        effects: supportsEffects(slot) ? effects.slice(0, EFFECT_COUNT) : [],
        ...chosen,
      };
    });
    return build;
  } catch {
    throw new Error(
      "This build link is invalid or uses an unsupported version. Your saved loadouts have not been changed.",
    );
  }
}
