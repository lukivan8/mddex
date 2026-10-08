import { useEffect, useState } from "react";
import { loadSessionCatalog } from "../catalog/catalog.session";

export function useLocationImages() {
  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    void loadSessionCatalog()
      .then((catalog) => {
        if (!cancelled)
          setImages(
            Object.fromEntries(
              catalog
                .filter((item) => item.category === "location" && item.image)
                .map((item) => [item.variation, item.image!]),
            ),
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return images;
}
