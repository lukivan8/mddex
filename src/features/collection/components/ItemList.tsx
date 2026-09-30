import { useLocation } from "@tanstack/react-router";
import { ItemCard } from "./ItemCard";
import type { CatalogItemView } from "../collection.presentation";
import { returnPathAtPower } from "../../catalog/power";
export function ItemList({ items }: { items: CatalogItemView[] }) {
  const returnTo = useLocation({ select: (location) => location.href });
  const cleanReturnTo = returnPathAtPower(returnTo, 1);
  return (
    <div className="item-grid" aria-label="Catalog items">
      {items.map((item) => (
        <ItemCard key={item.slug} item={item} returnTo={cleanReturnTo} />
      ))}
    </div>
  );
}
