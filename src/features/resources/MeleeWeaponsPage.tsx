import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Modal, SearchField } from "@heroui/react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { AppFooter } from "../../components/AppFooter";
import { CatalogPicker } from "../builds/components/CatalogPicker";
import { ItemArtwork } from "../builds/components/ItemArtwork";
import type { CatalogItem } from "../catalog/catalog.types";
import { ResourceCredit } from "./ResourceCredit";
import { meleeWeaponsResource } from "./resources";
import {
  compareMeleeWeapons,
  filterMeleeWeapons,
  meleeWeapons,
  type MeleeWeapon,
} from "./melee-weapons";

export const meleeVariants = [
  {
    id: "reference",
    name: "Reference",
    description:
      "Browse normal and pure jump attack stats, and inspect each weapon’s combo.",
  },
  {
    id: "workbench",
    name: "Compare",
    description: "Choose two weapons to compare damage, DPS and combo time.",
  },
] as const;
export type MeleeVariant = (typeof meleeVariants)[number]["id"];
export type MeleeReferenceSearch = {
  variant: MeleeVariant;
  weapon: string;
  against: string;
};
const number = (value: number) => value.toFixed(1);
const seconds = (value: number) => `${value.toFixed(2)} s`;
const value = (weapon: MeleeWeapon, metric: "dps" | "comboDuration") =>
  metric === "dps" ? number(weapon[metric]) : seconds(weapon[metric]);
const byName = new Map(meleeWeapons.map((weapon) => [weapon.name, weapon]));

function WeaponArt({
  item,
  large = false,
}: {
  item: CatalogItem;
  large?: boolean;
}) {
  return (
    <span className={`mr-art${large ? " mr-art--large" : ""}`}>
      <ItemArtwork item={item} priority={large} />
    </span>
  );
}
function WeaponStats({ weapon }: { weapon: MeleeWeapon }) {
  return (
    <dl className="mr-stats">
      <div>
        <dt>Base attack DPS</dt>
        <dd>{value(weapon, "dps")}</dd>
      </div>
      <div>
        <dt>Combo damage</dt>
        <dd>{weapon.damage}</dd>
      </div>
      <div>
        <dt>Combo time</dt>
        <dd>{value(weapon, "comboDuration")}</dd>
      </div>
      <div>
        <dt>Pure jump attack DPS</dt>
        <dd>{number(weapon.jumpDps)}</dd>
      </div>
      <div>
        <dt>Jump attack damage</dt>
        <dd>{weapon.jumpDamage}</dd>
      </div>
      <div>
        <dt>Jump attack interval</dt>
        <dd>{weapon.jumpInterval.toFixed(3)} s</dd>
      </div>
    </dl>
  );
}
function WeaponDetails({
  weapon,
  item,
  compact = false,
}: {
  weapon: MeleeWeapon;
  item: CatalogItem;
  compact?: boolean;
}) {
  return (
    <article
      className={`mr-inspector${compact ? " mr-inspector--compact" : ""}`}
      aria-label={`${weapon.name} reference`}
    >
      <div className="mr-inspector-heading">
        <span className="eyebrow">
          {weapon.edition} / {weapon.family}
        </span>
      </div>
      <div className="mr-portrait">
        <WeaponArt item={item} large />
      </div>
      <h2>{weapon.name}</h2>
      <WeaponStats weapon={weapon} />
      <div className="mr-formula">
        <span>Normal combo</span>
        <strong>{weapon.breakdown}</strong>
        <small>{weapon.damage} total damage</small>
      </div>
      <details className="mr-timing">
        <summary>
          {compact
            ? `${weapon.name}: timing & notes`
            : "Timing details & source notes"}
        </summary>
        <p>
          Initial delay: <strong>{seconds(weapon.delay)}</strong>. Effective
          combo: <strong>{value(weapon, "comboDuration")}</strong>.
        </p>
        <p className="muted">
          Hit times are relative to the start of each variant. Variant duration
          and post-delay determine when the next variant can begin.
        </p>
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Hit time(s), s</th>
              <th>Duration, s</th>
              <th>Post-delay, s</th>
            </tr>
          </thead>
          <tbody>
            {weapon.stages.map((stage, i) => (
              <tr key={i}>
                <th scope="row">{stage.stage}</th>
                <td>{stage.hits.map((hit) => hit.toFixed(3)).join(", ")}</td>
                <td>{stage.duration.toFixed(3)}</td>
                <td>{stage.postDelay.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}
function Comparison({
  first,
  second,
  items,
  choose,
}: {
  first: MeleeWeapon;
  second: MeleeWeapon;
  items: Map<string, CatalogItem>;
  choose: (side: "weapon" | "against") => void;
}) {
  const difference = compareMeleeWeapons(first, second);
  return (
    <section className="mr-comparison" aria-label="Compare two weapons">
      <div className="mr-comparison-weapons">
        {[first, second].map((weapon, i) => (
          <button
            key={i}
            className="mr-choose-weapon"
            onClick={() => choose(i ? "against" : "weapon")}
            aria-label={`Choose ${i ? "second" : "first"} weapon`}
          >
            <WeaponArt item={items.get(weapon.name)!} large />
            <span>
              <small>{i ? "SECOND WEAPON" : "FIRST WEAPON"}</small>
              <strong>{weapon.name}</strong>
              <span>
                {weapon.edition} · {weapon.family}
              </span>
              <em>
                Change weapon <ChevronDown size={12} />
              </em>
            </span>
          </button>
        ))}
      </div>
      <div className="mr-comparison-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Attack stats</th>
              <th scope="col">{first.name}</th>
              <th scope="col">{second.name}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                Base attack DPS <small>Higher = more damage per second</small>
              </th>
              {[first, second].map((w, i) => (
                <td
                  key={i}
                  className={
                    w.dps > (i ? first : second).dps ? "mr-favorable" : ""
                  }
                >
                  {value(w, "dps")}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                Combo damage <small>Every hit in the chain</small>
              </th>
              <td>{first.damage}</td>
              <td>{second.damage}</td>
            </tr>
            <tr>
              <th scope="row">
                Combo time <small>Shorter = less commitment</small>
              </th>
              {[first, second].map((w, i) => (
                <td
                  key={i}
                  className={
                    w.comboDuration < (i ? first : second).comboDuration
                      ? "mr-favorable"
                      : ""
                  }
                >
                  {value(w, "comboDuration")}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Damage breakdown</th>
              <td>{first.breakdown}</td>
              <td>{second.breakdown}</td>
            </tr>
            <tr>
              <th scope="row">Pure jump attack DPS</th>
              {[first, second].map((w, i) => (
                <td
                  key={i}
                  className={
                    w.jumpDps > (i ? first : second).jumpDps
                      ? "mr-favorable"
                      : ""
                  }
                >
                  {number(w.jumpDps)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Jump attack damage</th>
              <td>{first.jumpDamage}</td>
              <td>{second.jumpDamage}</td>
            </tr>
            <tr>
              <th scope="row">Jump attack interval</th>
              <td>{first.jumpInterval.toFixed(3)} s</td>
              <td>{second.jumpInterval.toFixed(3)} s</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="melee-comparison-result" role="status">
        {first.name === second.name ? (
          "Choose two different weapons to compare."
        ) : (
          <>
            <strong>{second.name}</strong> has{" "}
            {difference.dps === 0
              ? "the same base attack DPS as"
              : `${number(Math.abs(difference.dps))} ${difference.dps > 0 ? "more" : "less"} base attack DPS than`}{" "}
            {first.name}.{" "}
            <span>
              Higher base DPS alone does not determine the best weapon for your
              build.
            </span>
          </>
        )}
      </p>
    </section>
  );
}
function Methodology() {
  return (
    <section className="mr-method" aria-labelledby="mr-method-heading">
      <p className="eyebrow">READING THE REFERENCE</p>
      <h2 id="mr-method-heading">Understanding melee attacks</h2>
      <p className="mr-method-intro">
        Damage tells you how hard a combo hits. Timing tells you how often you
        can repeat it.
      </p>
      <div className="mr-method-grid">
        <div>
          <h3>Damage, time and DPS</h3>
          <p>
            Combo damage adds every normal hit. For example, 6×2 + 6×2 + 9×2 is
            six hits for 42 damage. Combo time is the time needed to chain the
            full attack sequence, including speed adjustments and cooldowns.
            Base attack DPS describes damage per second when repeating that
            combo.
          </p>
          <p>
            Normal attack DPS covers the full normal combo. Pure jump attack DPS
            covers repeated jump attacks. Effects and enchantments are excluded.
            Times are rounded; DPS retains the chart’s reported values.
          </p>
        </div>
        <div>
          <h3>What the measurements reveal</h3>
          <p>
            Spectral Spear has the highest normal attack chart DPS at 51.9, with
            58 damage in a 1.117-second combo. Mob Mallet deals 114 damage per
            combo, but its 4.48-second chain delivers 25.5 DPS. More damage per
            combo does not necessarily mean more damage per second.
          </p>
          <p>
            Use combo time to understand commitment and DPS to compare sustained
            attacks. Reach, effects and the rest of your build still matter when
            choosing a weapon.
          </p>
        </div>
        <div>
          <h3>Variant timings and delays</h3>
          <p>
            Each hit variant has its own duration, hit times and post-delay. The
            timing table shows hits relative to the start of that variant.
            Initial delay and post-delays also contribute to the full combo.
          </p>
          <p>
            Both spears deal 58 combo damage. Short Spear takes 1.229 seconds;
            Spectral Spear takes 1.117 seconds. These corrected values replace
            the previous estimates. Rounded variant times can differ slightly
            from the chart’s reported combo duration.
          </p>
        </div>
        <div>
          <h3>Pure jump attacks</h3>
          <p>
            Pure jump attack DPS is jump attack damage divided by the repeat
            interval. The current chart uses a shared 0.740-second interval. War
            Hammer and Heartbreaker each deal 40 damage, giving 54.1 DPS. This
            measures repeated jump attacks without normal combo hits.
          </p>
          <p>
            The contributor’s jump model gives roughly 2.48 blocks of height, a
            0.538-second normal jump, an earliest jump attack about 0.02 seconds
            after jumping, and about 0.45 seconds of recovery. A perfect jump
            attack takes roughly 0.75 seconds. Jump-cancel combo DPS is not
            included. Snapshot: October 7, 2026, from the visible Melee Stats
            tab. Chart values take precedence where sources disagree.
          </p>
        </div>
      </div>
      <div className="mr-source-links">
        <a
          href="https://www.desmos.com/calculator/zg40enymfp"
          target="_blank"
          rel="noopener noreferrer"
        >
          Contributor’s jump timing model ↗
        </a>
        <a
          href={meleeWeaponsResource.credit.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Original measurement chart ↗
        </a>
        <a
          href="https://metabot.gg/en/minecraft-dungeons-2/weapons"
          target="_blank"
          rel="noopener noreferrer"
        >
          Additional stats on Metabot ↗
        </a>
      </div>
    </section>
  );
}

export function MeleeWeaponsPage({
  catalog,
  filters,
  onChange,
}: {
  catalog: CatalogItem[];
  filters: MeleeReferenceSearch;
  onChange: (patch: Partial<MeleeReferenceSearch>) => void;
}) {
  const inspectorRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [edition, setEdition] = useState("");
  const [sort, setSort] = useState("dps");
  const [pickerSide, setPickerSide] = useState<"weapon" | "against" | null>(
    null,
  );
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerType, setPickerType] = useState("");
  const items = useMemo(
    () =>
      new Map(
        meleeWeapons.map((weapon) => [
          weapon.name,
          catalog.find(
            (item) => item.variation.replaceAll("’", "'") === weapon.name,
          ) ?? {
            slug: weapon.name.toLowerCase().replaceAll(" ", "-"),
            category: "melee_weapon",
            type: weapon.family,
            variation: weapon.name,
            image: null,
          },
        ]),
      ),
    [catalog],
  );
  const pickerCatalog = useMemo(
    () => [
      ...catalog.filter((item) => item.category !== "melee_weapon"),
      ...items.values(),
    ],
    [catalog, items],
  );
  const first = byName.get(filters.weapon) ?? byName.get("Sword")!;
  const second = byName.get(filters.against) ?? byName.get("War Hammer")!;
  const variant =
    meleeVariants.find((entry) => entry.id === filters.variant) ??
    meleeVariants[0];
  const visible = filterMeleeWeapons(query, edition, sort);
  const choose = (side: "weapon" | "against") => {
    setPickerQuery("");
    setPickerType("");
    setPickerSide(side);
  };
  const select = (item: CatalogItem) => {
    onChange({ [pickerSide ?? "weapon"]: item.variation });
    setPickerSide(null);
  };
  const inspect = (weapon: MeleeWeapon) => {
    onChange({ weapon: weapon.name });
    if (window.matchMedia("(max-width: 850px)").matches)
      inspectorRef.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
  };
  const picker = () => (
    <CatalogPicker
      mode="compare"
      showClear={false}
      catalog={pickerCatalog}
      target={{ kind: "item", slot: "melee" }}
      query={pickerQuery}
      onQuery={setPickerQuery}
      type={pickerType}
      onType={setPickerType}
      selected={
        items.get(pickerSide === "weapon" ? first.name : second.name)?.slug
      }
      selectedSlugs={[]}
      lockedSlugs={[]}
      selectedTiers={{}}
      multiple={false}
      onSelect={select}
      onClear={() => setPickerSide(null)}
    />
  );
  const toolbar = (
    <div className="mr-toolbar">
      <SearchField
        aria-label="Search melee weapons"
        value={query}
        onChange={setQuery}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Find a weapon or family…" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <label>
        <span className="sr-only">Weapon edition</span>
        <select
          aria-label="Weapon edition"
          value={edition}
          onChange={(e) => setEdition(e.target.value)}
        >
          <option value="">All weapons</option>
          <option>Base</option>
          <option>Unique</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Sort weapons</span>
        <select
          aria-label="Sort weapons"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="dps">Highest normal DPS</option>
          <option value="jumpDps">Highest jump DPS</option>
          <option value="time">Shortest combo</option>
          <option value="damage">Most damage</option>
          <option value="name">Name A–Z</option>
        </select>
      </label>
    </div>
  );
  const table = (
    <section className="mr-reference-table" aria-label="All melee weapon stats">
      <div className="mr-section-title">
        <h2>All weapons</h2>
      </div>
      {toolbar}
      <div className="mr-table-scroll">
        <table className="melee-table">
          <thead>
            <tr>
              <th scope="col">Weapon / family</th>
              <th scope="col">Base DPS</th>
              <th scope="col">Damage</th>
              <th scope="col">Combo time</th>
              <th scope="col">Hit sequence</th>
              <th scope="col">Jump DPS</th>
              <th scope="col">Jump damage</th>
              <th scope="col">Jump interval</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((weapon) => (
              <tr
                key={weapon.name}
                className={first.name === weapon.name ? "mr-selected-row" : ""}
              >
                <th scope="row">
                  <button
                    aria-label={`Inspect ${weapon.name}`}
                    aria-pressed={first.name === weapon.name}
                    onClick={() => inspect(weapon)}
                  >
                    <WeaponArt item={items.get(weapon.name)!} />
                    <span>
                      <strong>{weapon.name}</strong>
                      <small>
                        {weapon.edition} · {weapon.family}
                      </small>
                    </span>
                  </button>
                </th>
                <td className="mr-dps">{value(weapon, "dps")}</td>
                <td>{weapon.damage}</td>
                <td>{value(weapon, "comboDuration")}</td>
                <td className="mr-sequence">{weapon.breakdown}</td>
                <td className="mr-dps">{number(weapon.jumpDps)}</td>
                <td>{weapon.jumpDamage}</td>
                <td>{weapon.jumpInterval.toFixed(3)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && (
        <p className="mr-empty" role="status">
          No weapons found. Try another name or edition.
        </p>
      )}
    </section>
  );
  const inspector = (
    <WeaponDetails weapon={first} item={items.get(first.name)!} />
  );
  const comparison = (
    <Comparison first={first} second={second} items={items} choose={choose} />
  );
  return (
    <>
      <AppHeader active="resources" />
      <main
        id="main"
        className={`shell resources-main mr-page mr-page--${variant.id}`}
      >
        <div className="mr-topline">
          <Link to="/resources" className="resources-back">
            <ArrowLeft size={14} /> All resources
          </Link>
        </div>
        <nav className="mr-views" aria-label="Melee reference views">
          {meleeVariants.map((entry) => (
            <button
              key={entry.id}
              aria-current={entry.id === variant.id ? "page" : undefined}
              onClick={() => onChange({ variant: entry.id })}
            >
              {entry.name}
            </button>
          ))}
        </nav>
        <header className="mr-header">
          <div>
            <p className="eyebrow">REFERENCE / MINECRAFT DUNGEONS II</p>
            <h1>
              Melee weapon stats<span className="accent">.</span>
            </h1>
            <p className="mr-deck">{variant.description}</p>
          </div>
        </header>
        {variant.id === "reference" && (
          <>
            <div className="mr-desk">
              <div>{table}</div>
              <aside className="mr-sticky" ref={inspectorRef}>
                {inspector}
                <button
                  className="mr-action"
                  onClick={() => onChange({ variant: "workbench" })}
                >
                  <ArrowLeftRight size={15} /> Compare {first.name}
                </button>
              </aside>
            </div>
          </>
        )}
        {variant.id === "workbench" && (
          <>
            <div className="mr-section-title">
              <h2>Compare two weapons</h2>
              <button
                className="mr-text-button"
                onClick={() =>
                  onChange({ weapon: second.name, against: first.name })
                }
              >
                <ArrowLeftRight size={14} /> Swap sides
              </button>
            </div>
            {comparison}
            <div className="mr-workbench-details">
              <WeaponDetails
                weapon={first}
                item={items.get(first.name)!}
                compact
              />
              <WeaponDetails
                weapon={second}
                item={items.get(second.name)!}
                compact
              />
            </div>
            <details className="mr-all-details">
              <summary>
                Look up all 58 weapons <ChevronDown size={15} />
              </summary>
              {table}
            </details>
          </>
        )}
        <div id="mr-methodology">
          <Methodology />
        </div>
        <ResourceCredit credit={meleeWeaponsResource.credit} />
        <Modal.Backdrop
          isOpen={pickerSide !== null}
          onOpenChange={(open) => {
            if (!open) setPickerSide(null);
          }}
        >
          <Modal.Container size="lg" className="mr-picker-modal">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>
                  <SlidersHorizontal size={16} /> Choose{" "}
                  {pickerSide === "against" ? "second" : "first"} weapon
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body>{picker()}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </main>
      <AppFooter />
    </>
  );
}
