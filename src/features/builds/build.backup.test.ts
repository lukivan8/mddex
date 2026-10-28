import { expect, it, vi } from "vitest";
import { createBuildCollections, BUILDS_STORAGE_KEY } from "./build.db";
import { emptyBuild } from "./build.service";
import {
  exportLoadouts,
  parseLoadoutBackup,
  mergeLoadouts,
} from "./build.backup";
const collection = async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const db = createBuildCollections(storage);
  await db.builds.preload();
  return { db, storage, values };
};
function twentyBuilds() {
  return Array.from({ length: 20 }, (_, i) => {
    const build = emptyBuild(`Loadout ${i + 1}`, `original-${i}`);
    build.slots.melee = {
      itemSlug: "unknown-legacy-weapon",
      power: 154,
      enchantments: ["unknown-enchantment"],
      enchantmentTier: "III",
      effects: ["unknown-effect", null, null],
      effectTiers: ["IV", null, null],
    };
    build.variants = [
      { id: "boss", name: "Boss", slots: structuredClone(build.slots) },
    ];
    return build;
  });
}
it("round trips twenty complete loadouts, variants and unresolved references without uploads", async () => {
  const original = twentyBuilds();
  const backup = parseLoadoutBackup(exportLoadouts(original));
  const { db, storage } = await collection();
  expect(await mergeLoadouts(db, backup)).toEqual({
    imported: 20,
    skipped: 0,
    copies: 0,
  });
  const reloaded = createBuildCollections(storage);
  await reloaded.builds.preload();
  expect(
    [...reloaded.builds.values()].map(
      ({ id, name, createdAt, updatedAt, slots, variants }) => ({
        id,
        name,
        createdAt,
        updatedAt,
        slots,
        variants,
      }),
    ),
  ).toEqual([...original].sort((a, b) => a.id.localeCompare(b.id)));
  await db.builds.cleanup();
  await reloaded.builds.cleanup();
});
it("preserves conflicting local edits and skips previously imported copies on replay", async () => {
  const { db } = await collection();
  const original = twentyBuilds();
  const changed = { ...original[0], name: "Keep this local edit" };
  await db.builds.insert(changed).isPersisted.promise;
  const backup = parseLoadoutBackup(exportLoadouts(original));
  expect(await mergeLoadouts(db, backup)).toEqual({
    imported: 20,
    skipped: 0,
    copies: 1,
  });
  expect(db.builds.get(original[0].id)?.name).toBe("Keep this local edit");
  expect(await mergeLoadouts(db, backup)).toEqual({
    imported: 0,
    skipped: 20,
    copies: 0,
  });
  expect(db.builds.size).toBe(21);
  await db.builds.cleanup();
});
it("does not collapse identical loadouts that have distinct source IDs", async () => {
  const { db } = await collection();
  const first = emptyBuild("Same", "one");
  const second = { ...structuredClone(first), id: "two" };
  await mergeLoadouts(db, parseLoadoutBackup(exportLoadouts([first, second])));
  expect(db.builds.size).toBe(2);
  await db.builds.cleanup();
});
it("rejects corrupted files, future formats and duplicate IDs before any writes", () => {
  const backup = JSON.parse(exportLoadouts(twentyBuilds()));
  expect(() => parseLoadoutBackup("broken")).toThrow("supported MDDEX");
  expect(() =>
    parseLoadoutBackup(JSON.stringify({ ...backup, version: 2 })),
  ).toThrow("supported MDDEX");
  expect(() =>
    parseLoadoutBackup(
      JSON.stringify({
        ...backup,
        builds: [backup.builds[0], { ...backup.builds[1], slots: {} }],
      }),
    ),
  ).toThrow("supported MDDEX");
  expect(() =>
    parseLoadoutBackup(
      JSON.stringify({
        ...backup,
        builds: [backup.builds[0], backup.builds[0]],
      }),
    ),
  ).toThrow("supported MDDEX");
});
it("rejects quota failure without replacing existing data or acknowledging a partial import", async () => {
  const { db, storage, values } = await collection();
  const original = emptyBuild("Keep", "keep");
  await db.builds.insert(original).isPersisted.promise;
  const before = values.get(BUILDS_STORAGE_KEY);
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const write = vi.spyOn(storage, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  try {
    await expect(
      mergeLoadouts(db, parseLoadoutBackup(exportLoadouts(twentyBuilds()))),
    ).rejects.toThrow();
    expect(values.get(BUILDS_STORAGE_KEY)).toBe(before);
    expect(db.builds.size).toBe(1);
  } finally {
    write.mockRestore();
    error.mockRestore();
    await db.builds.cleanup();
  }
});
