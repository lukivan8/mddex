import { z } from "zod";
import { buildSchema, type Build } from "./build.types";
import type { BuildCollections } from "./build.db";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const backupSchema = z
  .object({
    format: z.literal("mddex-loadouts"),
    version: z.literal(1),
    exportedAt: z.string(),
    builds: z.array(buildSchema).min(1).max(5000),
  })
  .strict()
  .refine(
    (backup) =>
      new Set(backup.builds.map((build) => build.id)).size ===
      backup.builds.length,
    "Duplicate loadout IDs",
  );
export type LoadoutBackup = z.infer<typeof backupSchema>;
export type ImportResult = {
  imported: number;
  skipped: number;
  copies: number;
};

export function exportLoadouts(builds: Build[]): string {
  return JSON.stringify(
    backupSchema.parse({
      format: "mddex-loadouts",
      version: 1,
      exportedAt: new Date().toISOString(),
      builds,
    }),
    null,
    2,
  );
}
export function parseLoadoutBackup(text: string): LoadoutBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Choose a loadout backup smaller than 10 MB.");
  try {
    return backupSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(
      "This file is not a supported MDDEX loadout backup. No loadouts were changed.",
    );
  }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function content(build: Build) {
  const { id: _id, ...data } = buildSchema.parse(build);
  void _id;
  return canonical(data);
}
export async function mergeLoadouts(
  db: BuildCollections,
  backup: LoadoutBackup,
): Promise<ImportResult> {
  // Validate every record before preparing any mutation; keep unknown slugs.
  const valid = backupSchema.parse(backup);
  const existing = new Map<string, Build>(
    [...db.builds.values()].map((build) => [build.id, build]),
  );
  const additions: Build[] = [];
  let skipped = 0,
    copies = 0;
  for (const incoming of valid.builds) {
    let id = incoming.id;
    const fingerprint = content(incoming);
    if (existing.has(id) && content(existing.get(id)!) !== fingerprint) {
      const hash = [
        ...new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(`${incoming.id}:${fingerprint}`),
          ),
        ),
      ]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const base = `import-${hash}`;
      id = base;
      let suffix = 1;
      while (existing.has(id) && content(existing.get(id)!) !== fingerprint)
        id = `${base}-${suffix++}`;
      if (!existing.has(id)) copies++;
    }
    if (existing.has(id)) {
      skipped++;
      continue;
    }
    const added = { ...structuredClone(incoming), id };
    existing.set(id, added);
    additions.push(added);
  }
  // One collection transaction writes the complete batch. Failed persistence
  // must reject instead of reporting an optimistic import as successful.
  if (additions.length) await db.builds.insert(additions).isPersisted.promise;
  return { imported: additions.length, skipped, copies };
}
