import { useState } from "react";
import { Package } from "lucide-react";
import type { CatalogItem } from "../../catalog/catalog.types";
export function ItemArtwork({
  item,
  priority = false,
}: {
  item?: CatalogItem;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  return item?.image && failed !== item.image ? (
    <img
      src={item.image}
      alt={item.variation}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
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
