import { CatalogNavigationLink } from "../../components/CatalogNavigationLink";
import { locationMetadata } from "./catalog-detail.enrichment";
import { type ReactNode } from "react";
import { WikilyLocationLink } from "./WikilyLocationLink";
import {
  CATALOG_CATEGORIES,
  categoryLabel,
  humanize,
} from "../catalog/catalog.helpers";
import {
  itemPath,
  type CatalogItem,
  type Reference,
} from "./catalog-detail.model";
import { ItemArtwork } from "../builds/components/ItemArtwork";
import { ChevronRight, Skull } from "lucide-react";
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Stats({
  values,
}: {
  values: [string, string | number | null | undefined][];
}) {
  return (
    <dl className="detail-stats">
      {values
        .filter(([, value]) => value != null && value !== "")
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}
export function RelatedEntries({
  entries,
  catalog,
  returnTo,
  label,
}: {
  entries: Reference[];
  catalog: CatalogItem[];
  returnTo: string;
  label: string;
}) {
  return (
    <div className="detail-related-grid">
      {entries.map((entry) => {
        const target = catalog.find((item) => item.slug === entry.catalog_slug);
        if (!target)
          return (
            <div
              className="detail-reference"
              key={entry.catalog_slug ?? entry.name}
            >
              {entry.image && (
                <ItemArtwork
                  item={{
                    slug: entry.name,
                    category: "location",
                    type: "",
                    variation: entry.name,
                    image: entry.image,
                  }}
                />
              )}
              <div>
                {label && <small>{label}</small>}
                <h3>{entry.name}</h3>
                {entry.description && (
                  <p className="detail-reference-note">{entry.description}</p>
                )}
              </div>
            </div>
          );
        return (
          <CatalogNavigationLink
            className="detail-reference"
            href={`${itemPath(target)}?returnTo=${encodeURIComponent(returnTo)}`}
            key={target.slug}
          >
            {target.category === "mob" && !target.image ? (
              <Skull size={28} />
            ) : (
              <ItemArtwork
                item={{
                  slug: target.slug,
                  category: target.category,
                  type: target.type ?? "",
                  variation: target.name,
                  image: target.image,
                }}
              />
            )}
            <div>
              {label && <small>{label}</small>}
              <h3>{target.name}</h3>
              {entry.description && (
                <p className="detail-reference-note">{entry.description}</p>
              )}
            </div>
            <ChevronRight size={15} />
          </CatalogNavigationLink>
        );
      })}
    </div>
  );
}
function LocationLoot({
  entries,
  catalog,
  returnTo,
}: {
  entries: Reference[];
  catalog: CatalogItem[];
  returnTo: string;
}) {
  const bySlug = new Map(catalog.map((item) => [item.slug, item]));
  const groups = new Map<string, Reference[]>();
  for (const entry of entries) {
    const category = bySlug.get(entry.catalog_slug ?? "")?.category;
    const key = CATALOG_CATEGORIES.some((value) => value === category)
      ? category!
      : "other";
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return (
    <Section title="Loot">
      {[...CATALOG_CATEGORIES, "other"].flatMap((category) => {
        const group = groups.get(category);
        if (!group?.length) return [];
        return [
          <div className="detail-loot-group" key={category}>
            <h3>
              {category === "other" ? "Other loot" : categoryLabel(category)}
            </h3>
            <RelatedEntries
              entries={group}
              catalog={catalog}
              returnTo={returnTo}
              label=""
            />
          </div>,
        ];
      })}
    </Section>
  );
}
export function CategorySections({
  item,
  catalog,
  returnTo,
}: {
  item: CatalogItem;
  catalog: CatalogItem[];
  returnTo: string;
}) {
  const d = item.game_data;
  const location =
    item.category === "location" ? locationMetadata(item, catalog) : undefined;
  const references = (entries: Reference[], label: string) => (
    <RelatedEntries
      entries={entries}
      catalog={catalog}
      returnTo={returnTo}
      label={label}
    />
  );
  return (
    <>
      {item.category === "armor" && (
        <Section title="Armor details">
          <Stats
            values={[
              ["Slot", d.slot ? humanize(d.slot) : null],
              ["Set", d.set],
              ["Base set", d.baseSet],
            ]}
          />
        </Section>
      )}
      {d.artifact && (
        <Section title="Artifact stats">
          <Stats
            values={[
              ["Cooldown", d.artifact.cooldown],
              ["Soul cost", d.artifact.soul_cost],
            ]}
          />
        </Section>
      )}
      {d.summons && (
        <Section title="Summons">
          {references([d.summons], "Summoned mob")}
        </Section>
      )}
      {d.levels?.length ? (
        <Section title="Talisman levels">
          {d.levels.map((level) => (
            <section className="detail-level" key={level.level}>
              <h3>Level {level.level}</h3>
              {level.xp != null && (
                <p className="muted">XP: {level.xp.toLocaleString("en")}</p>
              )}
              {level.effects?.map((effect) => {
                const target = catalog.find(
                  (entry) => entry.slug === effect.catalog_slug,
                );
                return (
                  <p key={effect.name}>
                    {target ? (
                      <CatalogNavigationLink
                        href={`${itemPath(target)}?returnTo=${encodeURIComponent(returnTo)}`}
                      >
                        {effect.name}
                      </CatalogNavigationLink>
                    ) : (
                      effect.name
                    )}
                    {effect.text ? `: ${effect.text}` : ""}
                  </p>
                );
              })}
            </section>
          ))}
        </Section>
      ) : null}
      {d.gear?.length || d.slots?.length || d.category ? (
        <Section title="Compatibility">
          <Stats
            values={[
              ["Type", d.category ? humanize(d.category) : null],
              ["Rolls on", d.gear?.map(humanize).join(", ")],
              ["Equipment", d.slots?.join(", ")],
            ]}
          />
        </Section>
      ) : null}
      {d.tiers?.length
        ? [false, true].map((talisman) => {
            const tiers = d.tiers!.filter(
              (tier) => Boolean(tier.talisman) === talisman,
            );
            if (!tiers.length) return null;
            return (
              <Section
                key={String(talisman)}
                title={
                  talisman
                    ? "Talisman tiers"
                    : item.category === "gear_effect"
                      ? "Gear tiers"
                      : "Enchantment tiers"
                }
              >
                <div className="detail-table-scroll">
                  <table
                    aria-label={
                      talisman ? "Talisman tier values" : "Tier values"
                    }
                  >
                    <thead>
                      <tr>
                        <th>Tier</th>
                        <th>Effect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier) => (
                        <tr key={tier.tier}>
                          <th
                            className={
                              tier.tier === "unique" ? "detail-gold" : undefined
                            }
                          >
                            {tier.tier === "unique" ? "Unique" : tier.tier}
                          </th>
                          <td className="detail-tier-text">{tier.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            );
          })
        : null}
      {d.carriers?.length ? (
        <Section title="Found on">{references(d.carriers, "Gear")}</Section>
      ) : null}
      {item.category === "mob" && (
        <Section title="Mob stats">
          <Stats
            values={[
              ["Health", d.health],
              ["Speed", d.speed],
              ["Poise", d.poise],
              ["Souls", d.souls],
              ["Kind", d.mobKind ? humanize(d.mobKind) : null],
            ]}
          />
        </Section>
      )}
      {d.attacks?.length ? (
        <Section title="Attacks">
          <div className="detail-table-scroll">
            <table aria-label="Mob attacks">
              <thead>
                <tr>
                  <th>Attack</th>
                  <th>Damage</th>
                  <th>Cooldown</th>
                  <th>Element</th>
                </tr>
              </thead>
              <tbody>
                {d.attacks.map((attack, i) => (
                  <tr key={i}>
                    <th>{attack.attack}</th>
                    <td className="detail-gold">{attack.damage ?? "—"}</td>
                    <td>{attack.cooldown ?? "—"}</td>
                    <td>{attack.element ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
      {d.resist?.length ? (
        <Section title="Damage multipliers">
          <Stats
            values={d.resist.map((resist) => [
              resist.type,
              `×${resist.multiplier}`,
            ])}
          />
        </Section>
      ) : null}
      {d.forms?.length ? (
        <Section title="Forms">
          {d.forms.map((form) => (
            <section key={form.label} className="detail-level">
              <h3>{form.label}</h3>
              <Stats
                values={[
                  ["Health", form.health],
                  ["Speed", form.speed],
                  ["Damage", form.damage],
                  ["Poise", form.poise],
                  ["Souls", form.souls],
                ]}
              />
            </section>
          ))}
        </Section>
      ) : null}
      {d.areas?.length ? (
        <Section title="Locations">{references(d.areas, "Location")}</Section>
      ) : null}
      {d.fights?.length ? (
        <Section title="Encounters">
          {d.fights.map((fight, i) => (
            <section className="detail-level" key={i}>
              <h3>{fight.quest ?? humanize(fight.kind)}</h3>
              {fight.catalog_slug &&
                fight.place &&
                references(
                  [{ name: fight.place, catalog_slug: fight.catalog_slug }],
                  humanize(fight.kind),
                )}
              {fight.regions?.length
                ? references(fight.regions, "Region")
                : null}
            </section>
          ))}
        </Section>
      ) : null}
      {d.baseMob && (
        <Section title="Base mob">{references([d.baseMob], "Mob")}</Section>
      )}
      {d.summonedBy && (
        <Section title="Summoned by">
          {references([d.summonedBy], "Mob")}
        </Section>
      )}
      {d.minions?.length ? (
        <Section title="Minions">{references(d.minions, "Mob")}</Section>
      ) : null}
      {item.category === "location" && (
        <Section title="Location details">
          <WikilyLocationLink name={item.name} />
          {location?.overview && <p>{location.overview}</p>}
          <Stats
            values={[
              ["Level", d.level],
              ["Region", location?.region],
              ["Dungeon entrances", location?.dungeonCount],
              ["Rift entrances", location?.riftCount],
              ["Minecart stations", location?.stationCount],
            ]}
          />
          {d.subAreas?.length ? <p>Subareas: {d.subAreas.join(", ")}</p> : null}
        </Section>
      )}
      {location && location.loot.length > 0 && (
        <LocationLoot
          entries={location.loot}
          catalog={catalog}
          returnTo={returnTo}
        />
      )}
      {location && location.entrances.length > 0 && (
        <Section title="Entrances">
          {references(location.entrances, "")}
        </Section>
      )}
      {location && location.places.length > 0 && (
        <Section title="Subareas">{references(location.places, "")}</Section>
      )}
      {location && location.merchants.length > 0 && (
        <Section title="Merchants">
          {references(location.merchants, "")}
        </Section>
      )}
      {location && location.stations.length > 0 && (
        <Section title="Minecart stations">
          {references(location.stations, "")}
        </Section>
      )}
      {(location?.mobs ?? d.mobs)?.length ? (
        <Section title="Mobs">
          {references(location?.mobs ?? d.mobs!, "Mob")}
        </Section>
      ) : null}
      {(location?.minibosses ?? d.minibosses)?.length ? (
        <Section title="Minibosses">
          {references(location?.minibosses ?? d.minibosses!, "Mob")}
        </Section>
      ) : null}
      {d.arena?.length ? (
        <Section title="Arena encounters">{references(d.arena, "Mob")}</Section>
      ) : null}
    </>
  );
}
