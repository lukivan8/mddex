import { useEffect, useState, type ReactNode } from "react";
import { Accordion, Card, Tabs } from "@heroui/react";
import {
  ArrowLeft,
  ChevronRight,
  Gem,
  MapPin,
  Shield,
  Skull,
  Swords,
} from "lucide-react";
import snapshot from "./example-data.json";
import { itemSeo } from "./item-seo";
import "./preview.css";
import { AppFooter } from "../../src/components/AppFooter";
import { CATALOG_URL, rememberCatalogReturn } from "./catalog-return";
import {
  catalogItems,
  itemsBySlug,
  itemPath,
  dropSources,
  type CatalogItem,
  type ItemSource,
} from "./item-links";

const weapon = snapshot.weapon;
const data = weapon.game_data;
const effect = data.effects[0];
const references: Record<string, { variation: string; image: string | null }> =
  snapshot.references;
const effectImage = references[effect.catalog_slug].image;
const baseImage = references[data.base.catalog_slug].image;
type Source = {
  name: string;
  type: string;
  via: string | null;
  catalog_slug?: string;
};
const sources: Source[] = data.sources;
const areas = sources.filter((source) => source.type === "area");
function Image({
  src,
  name,
  className = "",
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  return src ? (
    <img className={className} src={src} alt={name} loading="lazy" />
  ) : (
    <Gem size={22} aria-label="No artwork" />
  );
}
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="detail-section">
      <h3>
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
function Identity({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`identity ${compact ? "compact" : ""}`}>
      <div className="weapon-art">
        <Image src={weapon.image} name={weapon.variation} />
      </div>
      <div className="identity-copy">
        <blockquote className="flavor">“{weapon.description}”</blockquote>
      </div>
    </div>
  );
}
function UniqueEffect() {
  return (
    <a
      className="unique-box"
      href={itemPath(itemsBySlug.get(effect.catalog_slug)!)}
    >
      <Image src={effectImage} name={effect.name} />
      <div>
        <span className="eyebrow gold">UNIQUE EFFECT</span>
        <h4>{effect.name}</h4>
        <p>
          Grants a <strong className="gold">20%</strong> chance to receive
          additional emeralds.
        </p>
      </div>
    </a>
  );
}
function Stats({ compact = false }: { compact?: boolean }) {
  const values = [
    ["Combo", "3 hits"],
    ["Hit damage", "16 → 16 → 24"],
    ["Jump damage", "28"],
    ["Combo reset", String(data.melee.combo_reset)],
  ];
  return (
    <dl className={`stats ${compact ? "compact-stats" : ""}`}>
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function CombatTable() {
  return (
    <div className="table-scroll">
      <table aria-label="Attack values">
        <thead>
          <tr>
            <th>Attack</th>
            <th>Damage</th>
            <th>Stagger</th>
            <th>Range</th>
            <th>Weight</th>
          </tr>
        </thead>
        <tbody>
          {data.melee.combo.map((hit, index) => (
            <tr key={index}>
              <th>Hit {index + 1}</th>
              <td className="gold">{hit.damage}</td>
              <td>{hit.stagger}</td>
              <td>{hit.range}</td>
              <td>{hit.weight}</td>
            </tr>
          ))}
          <tr>
            <th>Jump</th>
            <td className="gold">{data.melee.jump.damage}</td>
            <td>{data.melee.jump.stagger}</td>
            <td>{data.melee.jump.range}</td>
            <td>{data.melee.jump.weight}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
function Advanced() {
  return (
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
            <div className="table-scroll">
              <table aria-label="Advanced attack values">
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
                  {data.melee.combo.map((hit, index) => (
                    <tr key={index}>
                      <th>Hit {index + 1}</th>
                      <td>{hit.speed}</td>
                      <td>{hit.cone}</td>
                      <td>{hit.knockback}</td>
                      <td>{hit.splash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted note">
              Values are shown as published. The source does not specify units
              for these fields.
            </p>
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
function SourceCards({
  sources,
  gallery = false,
}: {
  sources: ItemSource[];
  gallery?: boolean;
}) {
  return (
    <div className={gallery ? "location-gallery" : "drop-list"}>
      {sources.map((source) => {
        const target = source.catalog_slug
          ? itemsBySlug.get(source.catalog_slug)
          : undefined;
        const content = (
          <>
            {source.type === "mob" ? (
              <Skull size={28} aria-hidden="true" />
            ) : (
              <Image src={target?.image ?? null} name={source.name} />
            )}
            <div>
              <h4>{source.name}</h4>
              {source.type === "mob" && (
                <span className="eyebrow">Mob drop</span>
              )}
            </div>
            {target ? (
              <ChevronRight size={15} className="muted" />
            ) : (
              <MapPin size={15} className="muted" />
            )}
          </>
        );
        return target ? (
          <a
            className="location source-card"
            href={itemPath(target)}
            key={source.catalog_slug}
          >
            {content}
          </a>
        ) : (
          <div className="location" key={source.name}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
function Drops({ gallery = false }: { gallery?: boolean }) {
  return (
    <SourceCards
      sources={dropSources(itemsBySlug.get(weapon.slug)!)}
      gallery={gallery}
    />
  );
}
function ItemCard({ item, label }: { item: CatalogItem; label: string }) {
  return (
    <a className="related item-reference-card" href={itemPath(item)}>
      <Image src={item.image} name={item.name} />
      <div>
        <span className="eyebrow">{label}</span>
        <h4>{item.name}</h4>
      </div>
      <ChevronRight size={16} aria-hidden="true" />
    </a>
  );
}
function Related() {
  return (
    <ItemCard
      item={itemsBySlug.get(data.base.catalog_slug)!}
      label="Base weapon"
    />
  );
}
function ReferenceDetails({ item }: { item: CatalogItem }) {
  const melee = item.game_data.melee;
  const sources = dropSources(item);
  const family = item.game_data.base ?? item.game_data.uniqueVariant;
  const related = family?.catalog_slug
    ? itemsBySlug.get(family.catalog_slug)
    : undefined;
  return (
    <div className="dossier">
      <aside>
        <div className="identity">
          <div className="weapon-art">
            <Image src={item.image} name={item.name} />
          </div>
          {item.description && (
            <blockquote className="flavor">“{item.description}”</blockquote>
          )}
        </div>
        {related && (
          <Section title="Weapon family">
            <ItemCard
              item={related}
              label={item.game_data.base ? "Base weapon" : "Unique variant"}
            />
          </Section>
        )}
      </aside>
      <div>
        {melee && (
          <Section title="Moveset" icon={<Swords size={17} />}>
            <div className="table-scroll">
              <table aria-label="Attack values">
                <thead>
                  <tr>
                    <th>Attack</th>
                    <th>Damage</th>
                    <th>Stagger</th>
                    <th>Range</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {[...melee.combo, ...(melee.jump ? [melee.jump] : [])].map(
                    (hit, i) => (
                      <tr key={i}>
                        <th>
                          {i === melee.combo.length ? "Jump" : `Hit ${i + 1}`}
                        </th>
                        <td className="gold">{hit.damage}</td>
                        <td>{hit.stagger}</td>
                        <td>{hit.range}</td>
                        <td>{hit.weight}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        )}
        {sources.length > 0 && (
          <Section title="Where to find it" icon={<MapPin size={17} />}>
            <SourceCards sources={sources} gallery />
          </Section>
        )}
        {item.game_data.drops.length > 0 && (
          <Section title="Drops">
            {item.game_data.drops.map((drop) => {
              const target = drop.catalog_slug
                ? itemsBySlug.get(drop.catalog_slug)
                : undefined;
              return target ? (
                <ItemCard key={target.slug} item={target} label="Item drop" />
              ) : null;
            })}
          </Section>
        )}
      </div>
    </div>
  );
}
function Dossier() {
  return (
    <div className="dossier">
      <aside>
        <Identity />
        <UniqueEffect />
        <Section title="Weapon family">
          <Related />
        </Section>
      </aside>
      <div>
        <Section title="Moveset" icon={<Swords size={17} />}>
          <Stats />
          <CombatTable />
          <Advanced />
        </Section>
        <Section title="Where to find it" icon={<MapPin size={17} />}>
          <Drops gallery />
        </Section>
      </div>
    </div>
  );
}
function TabbedDetails() {
  return (
    <>
      <Identity compact />
      <Tabs aria-label="Weapon details" defaultSelectedKey="overview">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Detail sections">
            {["Overview", "Combat", "Drops", "Family"].map((label) => (
              <Tabs.Tab key={label} id={label.toLowerCase()}>
                {label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel shouldForceMount id="overview">
          <UniqueEffect />
          <Stats />
          <Section title="Drop sources" icon={<MapPin size={17} />}>
            <div className="source-preview">
              {areas.slice(0, 2).map((source) => (
                <div key={source.name}>
                  <Image
                    src={references[source.catalog_slug!].image}
                    name={source.name}
                  />
                  <span>{source.name}</span>
                </div>
              ))}
            </div>
            <p className="muted note">4 locations</p>
          </Section>
        </Tabs.Panel>
        <Tabs.Panel shouldForceMount id="combat">
          <Section title="Attack sequence">
            <CombatTable />
            <Advanced />
          </Section>
        </Tabs.Panel>
        <Tabs.Panel shouldForceMount id="drops">
          <Section title="Where to find it">
            <Drops />
          </Section>
        </Tabs.Panel>
        <Tabs.Panel shouldForceMount id="family">
          <Section title="Related equipment">
            <Related />
          </Section>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
function Inspector() {
  return (
    <div className="inspector">
      <aside className="catalog-context">
        <div className="eyebrow">CATALOG / PICKAXES</div>
        <Card className="selected-tile">
          <Card.Content>
            <Image src={weapon.image} name={weapon.variation} />
            <span className="gold">Unique</span>
            <h4>{weapon.variation}</h4>
            <span className="tile-selected">
              Viewing details <ChevronRight size={14} />
            </span>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content>
            <Image src={baseImage} name={data.base.name} />
            <h4>{data.base.name}</h4>
            <p className="muted">Base weapon</p>
          </Card.Content>
        </Card>
        <p className="muted note">
          The Prospector’s Pick is the unique variant of Pickaxe.
        </p>
      </aside>
      <div className="inspector-detail">
        <TabbedDetails />
        <div className="inspector-footer">
          <Shield size={15} />
          <span>Pickaxe weapon family</span>
        </div>
      </div>
    </div>
  );
}
function AccordionDetails() {
  const sections = [
    {
      id: "combat",
      name: "Moveset",
      summary: "3 hits · 16 / 16 / 24 damage",
      body: (
        <>
          <Stats compact />
          <CombatTable />
          <Advanced />
        </>
      ),
    },
    {
      id: "drops",
      name: "Where to find it",
      summary: "4 locations",
      body: (
        <>
          <Drops />
        </>
      ),
    },
    {
      id: "family",
      name: "Weapon family",
      summary: "Unique variant of Pickaxe",
      body: <Related />,
    },
  ];
  return (
    <>
      <Identity compact />
      <UniqueEffect />
      <Accordion allowsMultipleExpanded defaultExpandedKeys={["drops"]}>
        {sections.map((section) => (
          <Accordion.Item key={section.id} id={section.id}>
            <Accordion.Heading>
              <Accordion.Trigger>
                <span className="accordion-label">
                  <strong>{section.name}</strong>
                  <span>{section.summary}</span>
                </span>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>{section.body}</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </>
  );
}
function CombatWorkbench() {
  const [attack, setAttack] = useState("hit0");
  const hit =
    attack === "jump"
      ? data.melee.jump
      : data.melee.combo[Number(attack.slice(3))];
  return (
    <>
      <Identity compact />
      <div className="workbench">
        <div>
          <Section title="Attack sequence" icon={<Swords size={17} />}>
            <Tabs
              selectedKey={attack}
              onSelectionChange={(key) => setAttack(String(key))}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="Attack selector">
                  {data.melee.combo.map((entry, index) => (
                    <Tabs.Tab key={index} id={`hit${index}`}>
                      <span>
                        Hit {index + 1}
                        <b>{entry.damage}</b>
                      </span>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                  <Tabs.Tab id="jump">
                    <span>
                      Jump<b>{data.melee.jump.damage}</b>
                    </span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
              {["hit0", "hit1", "hit2", "jump"].map((id) => (
                <Tabs.Panel key={id} id={id}>
                  <div className="attack-result">
                    <div>
                      <span className="eyebrow">
                        {attack === "jump"
                          ? "JUMP ATTACK"
                          : `COMBO HIT ${Number(attack.slice(3)) + 1}`}
                      </span>
                      <div className="damage-value">
                        {hit.damage}
                        <small>damage</small>
                      </div>
                    </div>
                    <dl>
                      <div>
                        <dt>Stagger</dt>
                        <dd>{hit.stagger}</dd>
                      </div>
                      <div>
                        <dt>Range</dt>
                        <dd>{hit.range}</dd>
                      </div>
                      <div>
                        <dt>Weight</dt>
                        <dd>{hit.weight}</dd>
                      </div>
                      <div>
                        <dt>Splash</dt>
                        <dd>{hit.splash}</dd>
                      </div>
                    </dl>
                  </div>
                </Tabs.Panel>
              ))}
            </Tabs>
            <div className="combat-foot">
              <span>
                Combo reset <b>{data.melee.combo_reset}</b>
              </span>
              <span>
                Jump damage <b>{data.melee.jump.damage}</b>
              </span>
            </div>
            <Advanced />
          </Section>
        </div>
        <aside>
          <UniqueEffect />
          <Section title="Base weapon">
            <Related />
          </Section>
        </aside>
      </div>
      <Section title="Drop sources" icon={<MapPin size={17} />}>
        <Drops gallery />
      </Section>
    </>
  );
}
export const pageOptions = [
  {
    id: "dossier",
    name: "Split dossier",
    path: "/catalog/melee-weapons/the-prospectors-pick",
  },
  {
    id: "dialog",
    name: "Tabbed page",
    path: "/catalog/melee-weapons/the-prospectors-pick/tabbed",
  },
  {
    id: "inspector",
    name: "Catalog inspector",
    path: "/catalog/melee-weapons/the-prospectors-pick/inspector",
  },
  {
    id: "sheet",
    name: "Accordion page",
    path: "/catalog/melee-weapons/the-prospectors-pick/accordion",
  },
  {
    id: "combat",
    name: "Combat workbench",
    path: "/catalog/melee-weapons/the-prospectors-pick/combat",
  },
];
function HighlightNumbers({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+(?:\.\d+)?%?)/g).map((part, index) =>
        /^\d/.test(part) ? (
          <strong className="gold" key={index}>
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
function ItemGuide({ item }: { item: CatalogItem }) {
  const seo = itemSeo(item);
  return (
    <section className="item-guide" aria-labelledby="about-item">
      <h2 id="about-item">{seo.heading}</h2>
      <p>{seo.introduction}</p>
      {seo.sections.length > 0 && (
        <div className="guide-grid">
          {seo.sections.map((section) => (
            <div key={section.heading}>
              <h3>{section.heading}</h3>
              <p>
                <HighlightNumbers text={section.text} />
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export const linkedPages = catalogItems
  .filter((item) => item.slug !== weapon.slug)
  .map((item) => ({
    id: "dossier",
    name: item.name,
    path: itemPath(item),
    catalogSlug: item.slug,
  }));
export function App({
  selected = "dossier",
  catalogSlug = weapon.slug,
}: {
  selected?: string;
  catalogSlug?: string;
}) {
  const currentItem =
    itemsBySlug.get(catalogSlug) ?? itemsBySlug.get(weapon.slug)!;
  const isExample = currentItem.slug === weapon.slug;
  const [catalogHref, setCatalogHref] = useState(CATALOG_URL);
  useEffect(() => {
    setCatalogHref(rememberCatalogReturn());
  }, []);
  const layouts: Record<string, ReactNode> = {
    dossier: <Dossier />,
    dialog: <TabbedDetails />,
    inspector: <Inspector />,
    sheet: <AccordionDetails />,
    combat: <CombatWorkbench />,
  };
  return (
    <div className={`item-page layout-${selected}`}>
      <header className="app-header">
        <div className="header-inner">
          <a
            href="https://mddex.net/build"
            className="brand"
            aria-label="MDDEX builds"
          >
            <img src="/mddex-logo.png" alt="" />
            <span>MDDEX</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="https://mddex.net/build" className="nav-link">
              Build
            </a>
            <a href={catalogHref} className="nav-link" aria-current="page">
              Catalog
            </a>
          </nav>
        </div>
      </header>
      <div className="item-back">
        <a href={catalogHref}>
          <ArrowLeft size={15} />
          Back to catalog
        </a>
      </div>
      <main id="item-details">
        <div className="page-title">
          <span className="eyebrow">
            {isExample
              ? "Melee weapon / Pickaxes"
              : currentItem.category.replaceAll("_", " ")}
          </span>
          <h1>{currentItem.name}</h1>
        </div>
        {isExample ? (
          (layouts[selected] ?? layouts.dossier)
        ) : (
          <ReferenceDetails item={currentItem} />
        )}
      </main>
      <ItemGuide item={currentItem} />
      <AppFooter />
    </div>
  );
}
