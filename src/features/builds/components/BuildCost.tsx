import type { CatalogItem } from "../../catalog/catalog.types";
import { buildEnchantmentCost, ENCHANTMENT_POINT_LIMIT } from "../build.cost";
import type { Build } from "../build.types";

export function BuildCost({
  build,
  catalog,
}: {
  build: Build;
  catalog: ReadonlyMap<string, CatalogItem>;
}) {
  const { points, shards, overLimit } = buildEnchantmentCost(build, catalog);

  return (
    <div className="build-cost" aria-label="Build enchantment cost">
      <div className={`build-cost-points${overLimit ? " over-limit" : ""}`}>
        <span className="build-cost-icon">
          <img
            src="/cost-icons/enchantment-points.webp"
            srcSet="/cost-icons/enchantment-points.webp 1x, /cost-icons/enchantment-points@2x.webp 2x"
            alt="Enchantment points"
            width={40}
            height={40}
          />
        </span>
        <strong>
          {points} / {ENCHANTMENT_POINT_LIMIT}
        </strong>
        {overLimit && (
          <span className="sr-only">
            Over limit by {points - ENCHANTMENT_POINT_LIMIT}
          </span>
        )}
      </div>
      <div className="build-cost-shards">
        <span className="build-cost-icon">
          <img
            src="/cost-icons/echo-shard.webp"
            srcSet="/cost-icons/echo-shard.webp 1x, /cost-icons/echo-shard@2x.webp 2x"
            alt="Shards"
            width={40}
            height={40}
          />
        </span>
        <strong>{shards}</strong>
      </div>
    </div>
  );
}
