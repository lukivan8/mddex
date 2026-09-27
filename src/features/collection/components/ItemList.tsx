import { ItemCard } from "./ItemCard";
import type { CatalogItemView } from "../collection.presentation";
export function ItemList({
  items,
  owned,
  leaving,
  onToggle,
}: {
  items: CatalogItemView[];
  owned: ReadonlySet<string>;
  leaving: ReadonlySet<string>;
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="item-grid" aria-label="Catalog items">
      {items.map((item) => (
        <ItemCard
          key={item.slug}
          item={item}
          owned={owned.has(item.slug)}
          leaving={leaving.has(item.slug)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
