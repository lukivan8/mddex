import { CatalogNavigationLink } from "../../components/CatalogNavigationLink";
import {
  applicableEffects,
  questRewardTargets,
} from "./catalog-detail.enrichment";
import { Accordion, Skeleton, Tooltip } from "@heroui/react";
import { defaultParseSearch, Link } from "@tanstack/react-router";
import { filtersSchema } from "../collection/collection.types";
import { useEffect } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronRight,
  Gift,
  MapPin,
  Skull,
  Swords,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { AppFooter } from "../../components/AppFooter";
import { ItemArtwork } from "../builds/components/ItemArtwork";
import {
  categoryLabel,
  humanize,
  isSecretTalisman,
} from "../catalog/catalog.helpers";
import { PowerInput } from "../catalog/PowerInput";
import { returnPathAtPower, scaleDamage } from "../catalog/power";
import { formatAttackDamage, knownHitCount } from "./melee-attack";
import {
  itemPath,
  isChestTalisman,
  talismanAcquisitionNotes,
  type CatalogCard,
  type ItemSource,
  type Reference,
} from "./catalog-detail.model";
import { itemSeo } from "./catalog-detail.seo";
import type { loadDetailPage } from "./catalog-detail.loader";
import "./catalog-detail.css";
import { CategorySections } from "./CategorySections";
import { trackPage } from "../analytics/analytics.browser";
import {
  fullChargeDamage,
  fullComboDamage,
  potentialVolleyDamage,
} from "./weapon-compare.model";

const SHOW_COMPARE_LINK = false;
function Numbers({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+(?:\.\d+)?%?)/g).map((part, i) =>
        /^\d/.test(part) ? (
          <strong className="detail-gold" key={i}>
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
function Artwork({
  item,
  priority = false,
}: {
  item: CatalogCard;
  priority?: boolean;
}) {
  if (item.category === "mob" && !item.image)
    return <Skull size={48} aria-label={item.name} />;
  return (
    <ItemArtwork
      priority={priority}
      item={{
        slug: item.slug,
        category: item.category,
        type: item.type ?? "",
        variation: item.name,
        image: item.image,
      }}
    />
  );
}
function ApplicableEffects({
  entries,
  catalog,
  returnTo,
  selectedEffects,
}: {
  selectedEffects: string[];
  entries: Reference[];
  catalog: CatalogCard[];
  returnTo: string;
}) {
  return (
    <div className="detail-effect-icons">
      {entries.map((entry) => {
        const target = catalog.find((item) => item.slug === entry.catalog_slug);
        const name = target?.name ?? entry.name;
        const description =
          entry.description ??
          target?.description ??
          target?.game_data.tiers
            ?.map((tier) => tier.text)
            .filter(Boolean)
            .join(" ");
        return (
          <Tooltip key={entry.catalog_slug ?? entry.name} delay={150}>
            <Tooltip.Trigger<"a">
              render={(props) => (
                <CatalogNavigationLink
                  {...props}
                  role={target ? "link" : "button"}
                  className={`detail-effect-icon ${selectedEffects.includes(target?.slug ?? entry.catalog_slug ?? "") ? "filter-match" : ""}`}
                  aria-label={name}
                  tabIndex={0}
                  href={
                    target
                      ? `${itemPath(target)}?returnTo=${encodeURIComponent(returnTo)}`
                      : undefined
                  }
                >
                  {target ? (
                    <Artwork item={target} />
                  ) : (
                    <span aria-hidden="true">{name.slice(0, 2)}</span>
                  )}
                </CatalogNavigationLink>
              )}
            />
            <Tooltip.Content className="detail-effect-tooltip">
              <strong>{name}</strong>
              {description && (
                <p>
                  <Numbers text={description} />
                </p>
              )}
            </Tooltip.Content>
          </Tooltip>
        );
      })}
    </div>
  );
}
function ReferenceCard({
  item,
  label,
  returnTo,
}: {
  item: CatalogCard;
  label: string;
  returnTo: string;
}) {
  return (
    <CatalogNavigationLink
      href={`${itemPath(item)}?returnTo=${encodeURIComponent(returnTo)}`}
      className="detail-reference"
    >
      <Artwork item={item} />
      <div>
        <small>{label}</small>
        <h3>{item.name}</h3>
      </div>
      <ChevronRight size={16} />
    </CatalogNavigationLink>
  );
}
function Sources({
  sources,
  catalog,
  returnTo,
}: {
  sources: ItemSource[];
  catalog: CatalogCard[];
  returnTo: string;
}) {
  return (
    <div className="detail-sources">
      {sources.map((source) => {
        const target = catalog.find(
          (item) => item.slug === source.catalog_slug,
        );
        const body = (
          <>
            {source.image ? (
              <ItemArtwork
                item={{
                  slug: source.name,
                  category: "location",
                  type: source.type,
                  variation: source.name,
                  image: source.image,
                }}
              />
            ) : source.type === "mob" && !target?.image ? (
              <Skull size={28} />
            ) : target ? (
              <Artwork item={target} />
            ) : (
              <MapPin size={28} />
            )}
            <div>
              <h3>{source.name}</h3>
              {source.type === "mob" && <small>Mob drop</small>}
              {source.dropChance && (
                <p className="detail-reference-note">
                  {source.dropChance.text}
                </p>
              )}
              {source.description && (
                <p className="detail-reference-note">{source.description}</p>
              )}
            </div>
            {target && <ChevronRight size={15} />}
          </>
        );
        return target ? (
          <CatalogNavigationLink
            key={target.slug}
            className="detail-source"
            href={`${itemPath(target)}?returnTo=${encodeURIComponent(returnTo)}`}
          >
            {body}
          </CatalogNavigationLink>
        ) : (
          <div key={source.name} className="detail-source">
            {body}
          </div>
        );
      })}
    </div>
  );
}
export function CatalogDetailPage({
  item,
  catalog: relatedCatalog,
  sources,
  returnTo: initialReturnTo,
  power,
  onPowerChange,
  detailState,
  onRetry,
}: Awaited<ReturnType<typeof loadDetailPage>> & {
  returnTo: string;
  power: number;
  onPowerChange: (power: number) => void;
  detailState?: "loading" | "failed";
  onRetry?: () => void;
}) {
  // The loader sends the current item once. Restore it for self-references in
  // the rendering lookup without duplicating it in the hydration payload.
  const catalog = [item, ...relatedCatalog];
  const returnTo = returnPathAtPower(initialReturnTo, 1);
  const selectedEffects =
    filtersSchema.parse(
      defaultParseSearch(new URL(returnTo, "https://mddex.net").search),
    ).effects ?? [];
  const seo = itemSeo(item, catalog, power, sources);
  const data = item.game_data;
  const effects = applicableEffects(item);
  const uniqueRolls = [
    ...new Set(
      sources.flatMap((source) => source.dropChance?.uniqueRolls ?? []),
    ),
  ];
  const rewardQuests = questRewardTargets(item);
  const foundInChests = isChestTalisman(item);
  const acquisitionNotes = talismanAcquisitionNotes(item);
  const isQuestReward =
    rewardQuests.length > 0 ||
    (!foundInChests &&
      !(
        item.category === "talisman" &&
        sources.some((source) => source.type === "mob")
      ) &&
      data.sources.some((source) => source.type === "quest"));
  const family = data.base ?? data.uniqueVariant;
  const related = catalog.find((entry) => entry.slug === family?.catalog_slug);
  const armorSlots = ["helmet", "chest", "leggings", "boots"];
  const setEquipment =
    item.category === "armor" && data.set
      ? catalog
          .filter(
            (entry) =>
              entry.category === "armor" &&
              entry.slug !== item.slug &&
              entry.slug !== related?.slug &&
              entry.game_data.set === data.set,
          )
          .sort(
            (a, b) =>
              armorSlots.indexOf(a.game_data.slot ?? "") -
                armorSlots.indexOf(b.game_data.slot ?? "") ||
              a.name.localeCompare(b.name),
          )
      : [];
  const melee = data.melee;
  const ranged = data.ranged;
  const chargedDamage = fullChargeDamage(item, power);
  const comboDamage = fullComboDamage(item, power);
  const path = itemPath(item);
  useEffect(() => {
    trackPage(path);
  }, [path]);
  return (
    <>
      <AppHeader active={item.category === "mob" ? "mobs" : "collection"} />
      <main id="main" className="shell catalog-detail">
        <div className="detail-toolbar">
          <CatalogNavigationLink className="detail-back" href={returnTo}>
            <ArrowLeft size={15} />
            {returnTo.startsWith("/mobs")
              ? "Back to mobs"
              : returnTo.startsWith("/resources/item-tracker")
                ? "Back to tracker"
                : "Back to catalog"}
          </CatalogNavigationLink>
          {(item.category === "melee_weapon" ||
            item.category === "ranged_weapon") && (
            <div className="detail-actions">
              <PowerInput power={power} onChange={onPowerChange} />
              {SHOW_COMPARE_LINK && (
                <Link
                  className="detail-compare"
                  to="/compare"
                  search={{
                    mode: item.category === "melee_weapon" ? "melee" : "ranged",
                    left: item.slug,
                    right: undefined,
                    returnTo,
                    power: power === 1 ? undefined : power,
                  }}
                >
                  <ArrowLeftRight size={15} />
                  Compare weapon
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="detail-title">
          <span className="eyebrow">
            {categoryLabel(item.category)}
            {isSecretTalisman(item) ? " / Secret talisman" : ""}
            {item.type && item.type !== "other" && item.type !== item.category
              ? ` / ${humanize(item.type)}`
              : ""}
          </span>
          <h1>{item.name}</h1>
          <p className="detail-introduction">{seo.introduction}</p>
        </div>
        {detailState === "failed" && (
          <p role="status" className="detail-load-status">
            Additional details couldn’t load.{" "}
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          </p>
        )}
        <div className="detail-dossier">
          <aside>
            <div className="detail-art">
              <Artwork item={item} priority />
            </div>
            {item.description && <blockquote>“{item.description}”</blockquote>}
            {data.effects?.map((effect) => {
              const target = catalog.find(
                (entry) =>
                  entry.slug === effect.catalog_slug ||
                  entry.name === effect.name,
              );
              return (
                <CatalogNavigationLink
                  className={`detail-effect ${selectedEffects.includes(target?.slug ?? effect.catalog_slug ?? "") ? "filter-match" : ""}`}
                  key={effect.name}
                  href={
                    target
                      ? `${itemPath(target)}?returnTo=${encodeURIComponent(returnTo)}`
                      : undefined
                  }
                >
                  {target && <Artwork item={target} />}
                  <div>
                    <small>
                      {effect.tier === "unique" ? "Unique effect" : "Effect"}
                    </small>
                    <h3>{effect.name}</h3>
                    {effect.text && (
                      <p>
                        <Numbers text={effect.text} />
                      </p>
                    )}
                  </div>
                </CatalogNavigationLink>
              );
            })}
            {(related || setEquipment.length > 0) && (
              <section>
                <h2>
                  {item.category.endsWith("weapon")
                    ? "Weapon family"
                    : "Related equipment"}
                </h2>
                {related && (
                  <ReferenceCard
                    item={related}
                    label={
                      data.base
                        ? item.category === "armor"
                          ? "Base armor"
                          : "Base weapon"
                        : "Unique variant"
                    }
                    returnTo={returnTo}
                  />
                )}
                {setEquipment.map((entry) => (
                  <ReferenceCard
                    key={entry.slug}
                    item={entry}
                    label={`${data.set} set`}
                    returnTo={returnTo}
                  />
                ))}
              </section>
            )}
          </aside>
          <div>
            {item.category === "status" && data.status && (
              <>
                {[
                  {
                    title: "Gear that applies this status",
                    entries: data.status.gear,
                  },
                  {
                    title: "Mobs that apply this status",
                    entries: data.status.mobs,
                  },
                  { title: "Immune mobs", entries: data.status.immune },
                ]
                  .filter((group) => group.entries.length > 0)
                  .map((group) => (
                    <section key={group.title}>
                      <h2>{group.title}</h2>
                      {group.entries.map((reference) => {
                        const target = catalog.find(
                          (entry) => entry.slug === reference.catalog_slug,
                        );
                        return target ? (
                          <ReferenceCard
                            key={target.slug}
                            item={target}
                            label={group.title}
                            returnTo={returnTo}
                          />
                        ) : (
                          <p key={reference.name}>{reference.name}</p>
                        );
                      })}
                    </section>
                  ))}
              </>
            )}
            {melee && (
              <section>
                <h2>
                  <Swords size={17} />
                  Moveset
                </h2>
                <dl className="detail-stats">
                  <div>
                    <dt>Combo</dt>
                    <dd>
                      {melee.combo.length}{" "}
                      {melee.combo.some((hit) => knownHitCount(hit) != null)
                        ? "attacks"
                        : "hits"}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {melee.combo.some((hit) => knownHitCount(hit) != null)
                        ? "Damage per hit × hits"
                        : "Hit damage"}
                    </dt>
                    <dd>
                      {melee.combo
                        .map((hit) => formatAttackDamage(hit, power))
                        .join(" → ")}
                    </dd>
                  </div>
                  {melee.jump && (
                    <div>
                      <dt>Jump damage</dt>
                      <dd>{formatAttackDamage(melee.jump, power)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Combo reset</dt>
                    <dd>{melee.combo_reset}</dd>
                  </div>
                  {comboDamage != null && (
                    <div className="detail-combo-total">
                      <dt>Full combo damage</dt>
                      <dd>{comboDamage}</dd>
                    </div>
                  )}
                </dl>
                <div className="detail-table-scroll">
                  <table aria-label="Attack values">
                    <thead>
                      <tr>
                        <th>Attack</th>
                        <th>
                          {melee.combo.some((hit) => knownHitCount(hit) != null)
                            ? "Damage per hit × hits"
                            : "Damage"}
                        </th>
                        <th>Stagger</th>
                        <th>Range</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...melee.combo,
                        ...(melee.jump ? [melee.jump] : []),
                      ].map((hit, i) => (
                        <tr key={i}>
                          <th>
                            {i === melee.combo.length ? "Jump" : `Hit ${i + 1}`}
                          </th>
                          <td className="detail-gold">
                            {formatAttackDamage(hit, power)}
                          </td>
                          <td>{hit.stagger}</td>
                          <td>{hit.range}</td>
                          <td>{hit.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Accordion>
                  <Accordion.Item id="advanced">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        More attack values
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body>
                        <div className="detail-table-scroll">
                          <table aria-label="Additional attack values">
                            <thead>
                              <tr>
                                <th>Attack</th>
                                <th>Speed</th>
                                <th>Cone</th>
                                <th>Knockback</th>
                                <th>Splash</th>
                              </tr>
                            </thead>
                            <tbody>
                              {melee.combo.map((hit, i) => (
                                <tr key={i}>
                                  <th>Hit {i + 1}</th>
                                  {["speed", "cone", "knockback", "splash"].map(
                                    (key) => (
                                      <td key={key}>
                                        {String(
                                          (
                                            hit as unknown as Record<
                                              string,
                                              unknown
                                            >
                                          )[key] ?? "—",
                                        )}
                                      </td>
                                    ),
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </section>
            )}
            {ranged && (
              <section>
                <h2>
                  <Swords size={17} />
                  Ranged stats
                </h2>
                <dl className="detail-stats">
                  {[
                    ["Ammo", ranged.ammo],
                    [
                      "Damage",
                      chargedDamage != null
                        ? `${potentialVolleyDamage(item, power)} → ${chargedDamage} (fully charged)`
                        : ranged.projectiles
                            ?.map((p) =>
                              p.damage == null
                                ? "—"
                                : scaleDamage(p.damage, power),
                            )
                            .join(" / "),
                    ],
                  ]
                    .filter(([, value]) => value != null)
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
              </section>
            )}
            <CategorySections
              item={item}
              catalog={catalog}
              returnTo={returnTo}
            />
            {effects.length > 0 && (
              <section>
                <h2>Applicable effects</h2>
                <ApplicableEffects
                  entries={effects}
                  selectedEffects={selectedEffects}
                  catalog={catalog}
                  returnTo={returnTo}
                />
              </section>
            )}
            {(sources.length > 0 ||
              foundInChests ||
              acquisitionNotes.length > 0 ||
              isQuestReward ||
              item.category === "enchantment") && (
              <section>
                <h2>
                  <MapPin size={17} />
                  Where to find it
                </h2>
                {acquisitionNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
                {foundInChests && acquisitionNotes.length === 0 && (
                  <p>Found in chests</p>
                )}
                <Sources
                  sources={sources}
                  catalog={catalog}
                  returnTo={returnTo}
                />
                {sources.some((source) => source.dropChance) && (
                  <>
                    {uniqueRolls.length > 0 && (
                      <p className="detail-reference-note">
                        Unique chance when the base item drops:{" "}
                        {uniqueRolls.join("; ")}.
                      </p>
                    )}
                  </>
                )}
                {item.category === "enchantment" && sources.length === 0 && (
                  <p className="muted">No specific location</p>
                )}
                {isQuestReward && (
                  <div className="detail-quest-reward">
                    <Gift size={16} />
                    <span>
                      {rewardQuests.length > 0 ? (
                        <>
                          Quest reward:{" "}
                          {rewardQuests.map((quest, i) => (
                            <span key={quest.name}>
                              {i > 0 ? ", " : ""}
                              <Link
                                to="/resources/quests"
                                search={{ quest: quest.quest }}
                                hash={quest.quest ? "quest-details" : undefined}
                              >
                                {quest.name}
                              </Link>
                            </span>
                          ))}
                        </>
                      ) : (
                        <Link to="/resources/quests">Quest reward</Link>
                      )}
                    </span>
                  </div>
                )}
              </section>
            )}
            {data.drops.length > 0 && (
              <section>
                <h2>Drops</h2>
                {data.drops.map((drop) => {
                  const target = catalog.find(
                    (entry) => entry.slug === drop.catalog_slug,
                  );
                  return target ? (
                    <ReferenceCard
                      item={target}
                      key={target.slug}
                      label="Item drop"
                      returnTo={returnTo}
                    />
                  ) : null;
                })}
              </section>
            )}
            {detailState === "loading" && (
              <div
                className="detail-skeleton"
                role="status"
                aria-label="Loading additional details"
              >
                <div aria-hidden="true">
                  <Skeleton className="detail-skeleton-heading" />
                  <Skeleton className="detail-skeleton-line" />
                  <Skeleton className="detail-skeleton-line" />
                  <Skeleton className="detail-skeleton-short" />
                </div>
              </div>
            )}
          </div>
        </div>
        <section className="detail-guide" aria-labelledby="about-item">
          <h2 id="about-item">{seo.heading}</h2>
          <p>
            {item.category === "mob" || item.category === "location" ? (
              <>
                Use the listed encounters and drops to plan your equipment
                search.{" "}
              </>
            ) : (
              <>
                Review {item.name}’s details before choosing equipment for your
                loadout.{" "}
              </>
            )}
            <Link to="/build">Open the Minecraft Dungeons 2 build maker</Link>{" "}
            to plan weapons, armor, artifacts, talismans, and modifiers
            together.
          </p>
          <div>
            {seo.sections.map((section) => (
              <section key={section.heading}>
                <h3>{section.heading}</h3>
                <p>
                  <Numbers text={section.text} />
                </p>
              </section>
            ))}
          </div>
        </section>
      </main>
      <AppFooter />
    </>
  );
}
