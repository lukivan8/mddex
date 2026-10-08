import { randomId } from "../../lib/random-id";
import { MAX_BUILD_VARIANTS, type Build } from "./build.types";

export const variantNumeral = (index: number) =>
  ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][index] ??
  String(index + 1);

export function selectBuildVariant(build: Build, id?: string): Build {
  const variant = build.variants?.find((entry) => entry.id === id);
  return variant
    ? { ...build, name: variant.name, slots: variant.slots }
    : build;
}

// Keep the base loadout intact when editing a selected variant.
export function updateBuildVariant(
  build: Build,
  id: string | undefined,
  edit: (selected: Build) => Build,
): Build {
  const next = edit(selectBuildVariant(build, id));
  if (!build.variants?.some((entry) => entry.id === id)) return next;
  return {
    ...build,
    updatedAt: next.updatedAt,
    variants: build.variants.map((entry) =>
      entry.id === id
        ? { ...entry, name: next.name, slots: next.slots }
        : entry,
    ),
  };
}

export function addBuildVariant(build: Build, sourceId?: string) {
  if ((build.variants?.length ?? 0) >= MAX_BUILD_VARIANTS - 1)
    throw new Error(`A build can have up to ${MAX_BUILD_VARIANTS} variants.`);
  const variant = {
    id: randomId(),
    name: "",
    slots: structuredClone(selectBuildVariant(build, sourceId).slots),
  };
  return {
    build: {
      ...build,
      updatedAt: new Date().toISOString(),
      variants: [...(build.variants ?? []), variant],
    },
    variant,
  };
}

export function removeBuildVariant(build: Build, id: string): Build {
  return {
    ...build,
    updatedAt: new Date().toISOString(),
    variants: build.variants?.filter((entry) => entry.id !== id),
  };
}
