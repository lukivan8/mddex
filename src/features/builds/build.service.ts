import type { CatalogItem } from "../catalog/catalog.types";
import type { BuildCollections } from "./build.db";
import {
  BUILD_SLOTS,
  ENCHANTMENT_COUNT,
  isGearSlot,
  type Availability,
  type Build,
  type BuildTarget,
} from "./build.types";
import { isCompatible } from "./build.compatibility";
export function emptyBuild(
  name = "Untitled loadout",
  id = crypto.randomUUID(),
): Build {
  const now = new Date().toISOString();
  return {
    id,
    name: name.trim().slice(0, 80) || "Untitled loadout",
    createdAt: now,
    updatedAt: now,
    slots: Object.fromEntries(
      BUILD_SLOTS.map((s) => [s, null]),
    ) as Build["slots"],
  };
}
export function createBuild(db: BuildCollections, name?: string) {
  const build = emptyBuild(name);
  return { build, transaction: db.builds.insert(build) };
}
export function setWorkspace(
  db: BuildCollections,
  patch: { activeId?: string; availability?: Availability },
) {
  return db.preferences.has("workspace")
    ? db.preferences.update("workspace", (p) => {
        Object.assign(p, patch);
      })
    : db.preferences.insert({
        id: "workspace",
        activeId: null,
        availability: "discovered",
        ...patch,
      });
}
export function renameBuild(db: BuildCollections, id: string, name: string) {
  return db.builds.update(id, (b) => {
    b.name = name.slice(0, 80);
    b.updatedAt = new Date().toISOString();
  });
}
export function compose(
  build: Build,
  target: BuildTarget,
  item: CatalogItem | null,
): Build {
  if (item && !isCompatible(item, target))
    throw new Error("This item does not fit the selected slot.");
  const next = structuredClone(build);
  if (target.kind === "item") {
    const old = next.slots[target.slot];
    next.slots[target.slot] = item
      ? {
          itemSlug: item.slug,
          enchantments: isGearSlot(target.slot)
            ? (old?.enchantments ?? Array(ENCHANTMENT_COUNT).fill(null))
            : [],
        }
      : null;
  } else {
    const gear = next.slots[target.slot];
    if (
      !gear ||
      target.index < 0 ||
      target.index >= ENCHANTMENT_COUNT ||
      !Number.isInteger(target.index)
    )
      throw new Error(
        "Choose equipped gear and a valid enchantment position first.",
      );
    gear.enchantments[target.index] = item?.slug ?? null;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
export function equip(
  db: BuildCollections,
  id: string,
  target: BuildTarget,
  item: CatalogItem | null,
) {
  const current = db.builds.get(id);
  if (!current) throw new Error("This loadout is no longer available.");
  const next = compose(current, target, item);
  return db.builds.update(id, (b) => {
    b.slots = next.slots;
    b.updatedAt = next.updatedAt;
  });
}

export async function deleteBuild(db: BuildCollections, id: string) {
  if (!db.builds.has(id)) return;
  const remaining = [...db.builds.values()]
    .filter((build) => build.id !== id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  let replacement: Build | undefined = remaining[0];
  // Save a replacement before deleting the final record. A failed write must
  // never leave the workspace empty or discard the original loadout.
  if (!replacement) {
    const created = createBuild(db, "Loadout 1");
    await created.transaction.isPersisted.promise;
    replacement = created.build;
  }
  const activeId = db.preferences.get("workspace")?.activeId;
  if (activeId === id || !activeId || !db.builds.has(activeId)) {
    await setWorkspace(db, { activeId: replacement.id }).isPersisted.promise;
  }
  await db.builds.delete(id).isPersisted.promise;
}
