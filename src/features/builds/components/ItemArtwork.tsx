import { useState } from "react";
import { Package } from "lucide-react";
import type { CatalogItem } from "../../catalog/catalog.types";
export function ItemArtwork({ item }: { item?: CatalogItem }) {
  const [failed, setFailed] = useState<string>();
  return item?.image && failed !== item.image ? (
    <img
      src={item.image}
      alt={item.variation}
      loading="lazy"
      onError={() => setFailed(item.image!)}
    />
  ) : (
    <Package
      size={22}
      strokeWidth={1.3}
      aria-label={item ? "Artwork unavailable" : "Empty slot"}
    />
  );
}
