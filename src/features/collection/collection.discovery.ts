import type { CatalogItem } from "../catalog/catalog.types";
import type { CompletionCollection } from "./collection.db";
import { isDiscovered } from "./collection.defaults";
export function normalizeDiscoveryName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’‘ʼ`]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function buildDiscoveryIndex(catalog: CatalogItem[]) {
  const index = new Map<string, CatalogItem[]>();
  for (const item of catalog) {
    const name = normalizeDiscoveryName(item.variation);
    index.set(name, [...(index.get(name) || []), item]);
  }
  return index;
}
export function tryDiscoverByName(
  collection: CompletionCollection,
  index: ReturnType<typeof buildDiscoveryIndex>,
  query: string,
) {
  const matches = index.get(normalizeDiscoveryName(query));
  // Check ambiguity across the whole catalog, even when one match is already discovered.
  if (matches?.length !== 1) return;
  const item = matches[0];
  const existing = collection.get(item.slug);
  if (isDiscovered(item.slug, existing)) return;
  const transaction = existing
    ? collection.update(item.slug, (draft) => {
        draft.discovered = true;
        draft.owned = true;
      })
    : collection.insert({ itemSlug: item.slug, discovered: true, owned: true });
  return { item, transaction };
}
