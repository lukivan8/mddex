import type { CompletionCollection } from "./collection.db";
export function toggleOwnership(
  collection: CompletionCollection,
  itemSlug: string,
  allowUndiscovered = false,
) {
  const existing = collection.get(itemSlug);
  if (!existing?.discovered && !allowUndiscovered) return;
  return existing
    ? collection.update(itemSlug, (draft) => {
        draft.owned = !draft.owned;
        draft.discovered = true;
      })
    : collection.insert({ itemSlug, owned: true, discovered: true });
}
