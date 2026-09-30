import { Shield, Swords, Sparkles, Zap } from "lucide-react";
import type { CatalogItem } from "../../catalog/catalog.types";
import type { Build } from "../build.types";
import { buildSummary } from "../build.summary";
import {
  additiveEffectDescriptions,
  summaryNumberParts,
} from "../build.summary.numbers";
import { ItemArtwork } from "./ItemArtwork";
import { BuildCost } from "./BuildCost";

export function BuildSummary({
  build,
  catalog,
}: {
  build: Build;
  catalog: ReadonlyMap<string, CatalogItem>;
}) {
  const groups = buildSummary(build, catalog);
  return (
    <>
      <div className="summary-topline">
        <span className="eyebrow">BUILD / SUMMARY</span>
        <BuildCost build={build} catalog={catalog} />
      </div>
      <h2 className="picker-title">Effects & enchantments</h2>
      {groups.length === 0 ? (
        <div className="summary-empty">
          <Sparkles size={24} strokeWidth={1.3} />
          <h2>No effects yet</h2>
          <p>
            Add effects and enchantments to your equipment to see them here.
          </p>
        </div>
      ) : (
        <div className="build-summary">
          {groups.map((group) => {
            const Icon =
              group.label === "Defense"
                ? Shield
                : group.label === "Attack"
                  ? Swords
                  : group.label === "Enchantments"
                    ? Sparkles
                    : Zap;
            return (
              <section
                key={group.label}
                aria-label={group.label}
                className="summary-group"
              >
                <h2>
                  <Icon size={15} />
                  {group.label}
                </h2>
                <ul>
                  {group.entries.map((entry) => (
                    <li key={entry.slug} className="summary-entry">
                      <span
                        className={`summary-art${group.label === "Enchantments" ? " summary-enchantment-art" : ""}`}
                      >
                        <ItemArtwork item={entry.item} />
                      </span>
                      <div className="summary-copy">
                        {group.label === "Enchantments" && (
                          <div className="summary-name">
                            <h3>
                              {entry.item?.variation ?? "Unavailable effect"}
                            </h3>
                          </div>
                        )}
                        {(group.label === "Enchantments"
                          ? entry.contributions
                          : additiveEffectDescriptions(entry.contributions)
                        ).map((contribution, index) => (
                          <div
                            className="summary-contribution"
                            key={index}
                            title={contribution.source}
                          >
                            {"tier" in contribution && contribution.tier && (
                              <span className="summary-tier">
                                {contribution.tier === "unique"
                                  ? "Unique"
                                  : `Tier ${contribution.tier}`}
                              </span>
                            )}
                            {contribution.description ? (
                              <p>
                                {summaryNumberParts(
                                  contribution.description,
                                ).map((part, partIndex) =>
                                  partIndex % 2 ? (
                                    <strong
                                      className="summary-number"
                                      key={partIndex}
                                    >
                                      {part}
                                    </strong>
                                  ) : (
                                    part
                                  ),
                                )}
                              </p>
                            ) : group.label !== "Enchantments" ? (
                              <p>Description unavailable</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
