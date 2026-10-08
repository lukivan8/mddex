import type { CatalogItem } from "./catalog.types";

/** Effect icon references point into the containing item's resolved CDN artwork. */
export function referenceArtwork(
  item: CatalogItem,
  reference: Record<string, unknown>,
): string | null {
  const icon = reference.icon;
  if (
    !icon ||
    typeof icon !== "object" ||
    !("artwork_key" in icon) ||
    typeof icon.artwork_key !== "string"
  )
    return null;
  return item.artwork?.[icon.artwork_key] ?? null;
}
