import { memo, useState } from "react";
import { Checkbox } from "@heroui/react";
import { PackageOpen, LockKeyhole } from "lucide-react";
import type { CatalogItemView } from "../collection.presentation";
import { categoryLabel, humanize } from "../../catalog/catalog.helpers";
export const ItemCard = memo(
  function ItemCard({
    item,
    owned,
    onToggle,
    leaving,
  }: {
    item: CatalogItemView;
    owned: boolean;
    onToggle: (slug: string) => void;
    leaving?: boolean;
  }) {
    const [failed, setFailed] = useState(false);
    return (
      <Checkbox
        aria-label={
          item.hidden
            ? `Undiscovered ${humanize(item.type)} item`
            : item.displayName
        }
        isSelected={owned}
        onChange={() => onToggle(item.slug)}
        className={`item-card ${item.hidden ? "undiscovered" : "revealed"} ${owned ? "owned" : ""} ${leaving ? "leaving" : ""}`}
      >
        <Checkbox.Content className="item-content">
          <span className="item-top">
            <span>{humanize(item.type)}</span>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </span>
          <span className="item-art">
            {item.image && !failed ? (
              <img
                src={item.image}
                alt={item.displayName}
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
              />
            ) : (
              <span className="art-placeholder">
                {item.hidden ? (
                  <LockKeyhole size={26} strokeWidth={1} />
                ) : (
                  <PackageOpen size={30} strokeWidth={1} />
                )}
                <span>
                  {item.hidden ? "Undiscovered" : "Artwork unavailable"}
                </span>
              </span>
            )}
          </span>
          <span className="item-name">{item.displayName}</span>
          <span className="item-bottom">
            <span>{categoryLabel(item.category)}</span>
            <span className="ownership-label">
              {owned ? "Collected" : item.hidden ? "Discover" : "Collect"}
            </span>
          </span>
        </Checkbox.Content>
      </Checkbox>
    );
  },
  (previous, next) =>
    previous.owned === next.owned &&
    previous.leaving === next.leaving &&
    previous.onToggle === next.onToggle &&
    (Object.keys(previous.item) as (keyof CatalogItemView)[]).every(
      (key) => previous.item[key] === next.item[key],
    ),
);
