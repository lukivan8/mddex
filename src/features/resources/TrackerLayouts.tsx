import type { ReactNode } from "react";
import { ItemCard } from "../collection/components/ItemCard";
import { getCatalogItemView } from "../collection/collection.presentation";
import type { CatalogItem } from "../catalog/catalog.types";
import {
  trackerMarks,
  trackerProgress,
  markKey,
  type TrackerFamily,
  type TrackerMark,
} from "./item-tracker";
export type TrackerLayout = "table" | "cards" | "list" | "rarities";
const labels: Partial<Record<TrackerMark, string>> = {
  common: "Common",
  rare: "Rare",
  special: "Special",
  unique: "Unique",
  soul_special: "Soul",
  soul_unique: "Soul",
  collected: "Collected",
};
export function TrackerLayouts({
  layout,
  families,
  collected,
  checkbox,
  itemLink,
  returnTo,
  cycleItem,
  readOnly,
}: {
  layout: Exclude<TrackerLayout, "table">;
  families: TrackerFamily[];
  collected: ReadonlySet<string>;
  checkbox: (item: CatalogItem, mark: TrackerMark) => ReactNode;
  itemLink: (item: CatalogItem) => ReactNode;
  returnTo: string;
  cycleItem: (item: CatalogItem) => void;
  readOnly: boolean;
}) {
  const items = families
    .flatMap((family) => [family.base, family.unique])
    .filter((item): item is CatalogItem => !!item);
  function status(item: CatalogItem) {
    const result = trackerProgress(
      trackerMarks(item).map((mark) => markKey(item, mark)),
      collected,
    );
    return (
      <span
        className={`tracker-layout-status ${result.count === result.total ? "complete" : ""}`}
      >
        {result.count}/{result.total}
      </span>
    );
  }
  function marks(item: CatalogItem) {
    return trackerMarks(item)
      .filter((mark) => !mark.startsWith("soul_"))
      .map((mark) => (
        <div className="tracker-layout-mark" key={mark}>
          <span>{labels[mark]}</span>
          <div className="tracker-rarity-checks">
            {checkbox(item, mark)}
            {trackerMarks(item).includes(`soul_${mark}` as TrackerMark) && (
              <div className="tracker-layout-soul">
                <span>Soul</span>
                {checkbox(item, `soul_${mark}` as TrackerMark)}
              </div>
            )}
          </div>
        </div>
      ));
  }
  if (layout === "cards")
    return (
      <div className="tracker-catalog-grid item-grid">
        {families.map((family) => (
          <div className="tracker-catalog-pair" key={family.id}>
            {[family.base, family.unique]
              .filter((item): item is CatalogItem => !!item)
              .map((item) => (
                <ItemCard
                  key={item.slug}
                  item={{
                    ...getCatalogItemView(item),
                    uniqueEffect: undefined,
                  }}
                  returnTo={returnTo}
                  cycleControl={{
                    onPress: () => cycleItem(item),
                    disabled: readOnly,
                  }}
                  topControls={
                    <div className="tracker-catalog-checks">
                      {trackerMarks(item).map((mark) => (
                        <div
                          className="tracker-catalog-mark"
                          key={mark}
                          title={labels[mark]}
                        >
                          {checkbox(item, mark)}
                        </div>
                      ))}
                    </div>
                  }
                />
              ))}
          </div>
        ))}
      </div>
    );
  if (layout === "list")
    return (
      <div className="tracker-list">
        {items.map((item) => (
          <article
            className="tracker-list-row"
            key={item.slug}
            aria-label={`${item.variation} collection`}
          >
            <div className="tracker-list-name">
              {itemLink(item)}
              {status(item)}
            </div>
            <div className="tracker-list-checks">{marks(item)}</div>
          </article>
        ))}
      </div>
    );
  const columns: TrackerMark[] = [
    "common",
    "rare",
    "special",
    "unique",
    "collected",
  ].filter((mark) =>
    items.some((item) => trackerMarks(item).includes(mark as TrackerMark)),
  ) as TrackerMark[];
  return (
    <div className="tracker-rarity-board">
      {columns.map((mark) => {
        const eligible = items.filter((item) =>
          trackerMarks(item).includes(mark),
        );
        const result = trackerProgress(
          eligible.map((item) => markKey(item, mark)),
          collected,
        );
        return (
          <section
            className={`tracker-rarity-column tracker-column-${mark}`}
            key={mark}
            aria-label={`${labels[mark]} collection`}
          >
            <header>
              <h2>{labels[mark]}</h2>
              <span className="muted">
                {result.count}/{result.total}
              </span>
            </header>
            {eligible.map((item) => (
              <article className="tracker-board-item" key={item.slug}>
                <div>{itemLink(item)}</div>
                <div className="tracker-board-checks">
                  <div>
                    <span>{labels[mark]}</span>
                    {checkbox(item, mark)}
                  </div>
                  {trackerMarks(item).includes(
                    `soul_${mark}` as TrackerMark,
                  ) && (
                    <div className="tracker-layout-soul">
                      <span>Soul</span>
                      {checkbox(item, `soul_${mark}` as TrackerMark)}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
