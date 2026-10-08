import { Skeleton } from "@heroui/react";
import {
  CATALOG_CATEGORIES,
  categoryLabel,
} from "../../catalog/catalog.helpers";

export function CollectionSkeleton() {
  return (
    <div
      className="collection-skeleton"
      role="status"
      aria-label="Loading catalog"
    >
      <span className="sr-only">Loading catalog…</span>
      <div aria-hidden="true">
        <div className="catalog-heading">
          <div>
            <h1>
              Catalog<span className="accent">.</span>
            </h1>
            <p className="muted">
              Browse equipment, enchantments, and gear effects.
            </p>
          </div>
        </div>
        <div className="category-grid">
          {CATALOG_CATEGORIES.map((category) => (
            <div
              className="category-card skeleton-category-card"
              key={category}
            >
              <div className="category-top">
                <Skeleton className="skeleton-category-icon" />
                <Skeleton className="skeleton-category-count" />
              </div>
              <span className="category-name">{categoryLabel(category)}</span>
            </div>
          ))}
        </div>
        <div className="toolbar">
          <div className="filter-row">
            <Skeleton className="catalog-search skeleton-control" />
            <Skeleton className="filter-select skeleton-control" />
            <Skeleton className="filter-select skeleton-control" />
          </div>
        </div>
        <div className="item-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <div className="item-card" key={i}>
              <div className="item-content">
                <div className="item-top skeleton-card-top">
                  <Skeleton className="skeleton-card-type" />
                </div>
                <div className="item-art">
                  <Skeleton className="skeleton-card-art" />
                </div>
                <div className="item-name skeleton-card-name-row">
                  <Skeleton className="skeleton-card-name" />
                </div>
                <div className="item-bottom skeleton-card-bottom">
                  <Skeleton className="skeleton-card-category" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
