import type { CatalogItem } from "./catalog.types";

/** Warm the browser image cache without mounting images or changing discovery state. */
export function preloadCatalogArtwork(items: Pick<CatalogItem, "image">[]) {
  const urls = [
    ...new Set(items.flatMap((item) => (item.image ? [item.image] : []))),
  ];
  const active = new Map<HTMLImageElement, ReturnType<typeof setTimeout>>();
  let next = 0;
  let stopped = false;
  const concurrency = 3;

  function pump() {
    while (!stopped && active.size < concurrency && next < urls.length) {
      const image = new Image();
      image.fetchPriority = "low";
      image.decoding = "async";
      const finish = () => {
        clearTimeout(active.get(image));
        image.onload = image.onerror = null;
        active.delete(image);
        pump();
      };
      // A stalled development-CDN request must not block the rest of the queue.
      active.set(
        image,
        setTimeout(() => {
          image.removeAttribute("src");
          finish();
        }, 15_000),
      );
      image.onload = finish;
      image.onerror = finish;
      image.src = urls[next++];
    }
  }

  // Give the page's first paint and visible resources priority.
  const idle =
    typeof requestIdleCallback === "function"
      ? requestIdleCallback(pump, { timeout: 1000 })
      : undefined;
  const fallback = idle === undefined ? setTimeout(pump, 200) : undefined;
  return () => {
    stopped = true;
    if (idle !== undefined) cancelIdleCallback(idle);
    clearTimeout(fallback);
    for (const [image, timeout] of active) {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      image.removeAttribute("src");
    }
    active.clear();
  };
}
