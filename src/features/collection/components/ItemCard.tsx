import { Link } from "@tanstack/react-router";
import { detailCategory } from "../../catalog-details/catalog-detail.model";
import { memo, useState, type ReactNode } from "react";
import { PackageOpen, Skull } from "lucide-react";
import { Tooltip } from "@heroui/react";
import { ItemArtwork } from "../../builds/components/ItemArtwork";
import type { CatalogItemView } from "../collection.presentation";
import { categoryLabel, humanize } from "../../catalog/catalog.helpers";
export const ItemCard = memo(
  function ItemCard({
    item,
    returnTo,
    topControls,
    cycleControl,
  }: {
    item: CatalogItemView;
    returnTo: string;
    topControls?: ReactNode;
    cycleControl?: { onPress: () => void; disabled: boolean };
  }) {
    const [failed, setFailed] = useState(false);
    const destination = {
      to: "/catalog/$category/$slug" as const,
      params: {
        category: detailCategory(item.category),
        slug: item.detailSlug ?? item.slug,
      },
      search: { returnTo, power: undefined },
    };
    const content = (
      <>
        <div
          className={`item-top${item.uniqueEffect ? " with-unique-effect" : ""}`}
        >
          <span>
            {item.category === "mob"
              ? humanize(item.kind ?? "other")
              : item.secretTalisman
                ? "Secret talisman"
                : (item.applicability ?? humanize(item.type))}
          </span>
        </div>
        <span className="item-art">
          {item.image && !failed ? (
            <img
              src={item.image}
              alt={item.displayName}
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
            />
          ) : item.category === "mob" ? (
            <span className="art-placeholder">
              <Skull size={30} strokeWidth={1} />
            </span>
          ) : (
            <span className="art-placeholder">
              <PackageOpen size={30} strokeWidth={1} />
              <span>Artwork unavailable</span>
            </span>
          )}
        </span>
        <h3 className="item-name">
          {cycleControl ? (
            <Link {...destination} className="tracker-item-name-link">
              {item.displayName}
            </Link>
          ) : (
            item.displayName
          )}
        </h3>
        {item.category !== "mob" && (
          <span className="item-bottom">
            <span>{categoryLabel(item.category)}</span>
          </span>
        )}
      </>
    );
    return (
      <article className="item-card" aria-label={item.displayName}>
        {topControls}
        {cycleControl ? (
          <>
            <button
              type="button"
              className="tracker-card-cycle"
              aria-label={`Cycle ${item.displayName} collection rarity`}
              disabled={cycleControl.disabled}
              onClick={cycleControl.onPress}
            />
            <div className="item-content">{content}</div>
          </>
        ) : (
          <Link className="item-content" {...destination}>
            {content}
          </Link>
        )}
        {item.uniqueEffect && (
          <Tooltip delay={150}>
            <Tooltip.Trigger<"button">
              render={(props) => (
                <button
                  {...props}
                  type="button"
                  className="item-unique-effect"
                  aria-label={`Unique effect: ${item.uniqueEffect!.variation}`}
                >
                  <ItemArtwork item={item.uniqueEffect} />
                </button>
              )}
            />
            <Tooltip.Content>
              {item.uniqueEffect.variation}
              {item.uniqueEffect.description
                ? `: ${item.uniqueEffect.description}`
                : ""}
            </Tooltip.Content>
          </Tooltip>
        )}
      </article>
    );
  },
  (previous, next) =>
    previous.returnTo === next.returnTo &&
    previous.topControls === next.topControls &&
    previous.cycleControl === next.cycleControl &&
    (Object.keys(previous.item) as (keyof CatalogItemView)[]).every(
      (key) => previous.item[key] === next.item[key],
    ),
);
