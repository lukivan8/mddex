import { Skeleton } from "@heroui/react";
export function CollectionSkeleton() {
  return (
    <div
      className="collection-skeleton"
      role="status"
      aria-label="Loading collection"
    >
      <span className="sr-only">Loading collection…</span>
      <Skeleton className="skeleton-heading" />
      <div className="category-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="skeleton-category" />
        ))}
      </div>
      <Skeleton className="skeleton-toolbar" />
      <div className="item-grid">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="skeleton-item" />
        ))}
      </div>
    </div>
  );
}
