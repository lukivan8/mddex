import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { ArrowLeft, ArrowLeftRight, Plus, Swords } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AppFooter } from "../../components/AppFooter";
import { AppHeader } from "../../components/AppHeader";
import type { CatalogItem as PublishedItem } from "../catalog/catalog.types";
import { humanize } from "../catalog/catalog.helpers";
import { PowerInput } from "../catalog/PowerInput";
import { powerParam, returnPathAtPower, scaleDamage } from "../catalog/power";
import { attackDamage, hitsPerAttack, knownHitCount } from "./melee-attack";
import { CatalogPicker } from "../builds/components/CatalogPicker";
import { ItemArtwork } from "../builds/components/ItemArtwork";
import { normalizeDetailItem } from "./catalog-detail.loader";
import { itemPath, type CatalogItem } from "./catalog-detail.model";
import {
  comboHitCount,
  fullChargeDamage,
  fullComboDamage,
  metricRank,
  normalizedComboLength,
  potentialVolleyDamage,
  spamDamageRate,
  type MetricDirection,
  type WeaponCompareSearch,
} from "./weapon-compare.model";
import "./weapon-compare.css";

type Side = "left" | "right";
type Metric = {
  label: string;
  left?: number | string | null;
  right?: number | string | null;
  direction?: MetricDirection;
  unit?: string;
};

function MetricTable({
  title,
  rows,
  left,
  right,
}: {
  title: string;
  rows: Metric[];
  left?: CatalogItem;
  right?: CatalogItem;
}) {
  return (
    <section className="compare-metrics">
      <h2>{title}</h2>
      <div className="compare-table-scroll">
        <table aria-label={title}>
          <thead>
            <tr>
              <th scope="col">Stat</th>
              <th scope="col">{left?.name ?? "First weapon"}</th>
              <th scope="col">{right?.name ?? "Second weapon"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const leftRank = metricRank(row.left, row.right, row.direction);
              const rightRank = metricRank(row.right, row.left, row.direction);
              const cell = (
                value: Metric["left"],
                rank: ReturnType<typeof metricRank>,
              ) => (
                <td className={`compare-value compare-value--${rank}`}>
                  {value == null || value === ""
                    ? "—"
                    : `${typeof value === "number" ? value.toLocaleString("en", { maximumFractionDigits: 2 }) : value}${row.unit ?? ""}`}
                  {(rank === "better" || rank === "worse") && (
                    <span className="compare-rank">{rank}</span>
                  )}
                </td>
              );
              return (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {cell(row.left, leftRank)}
                  {cell(row.right, rightRank)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function meleeTables(left?: CatalogItem, right?: CatalogItem, power = 1) {
  const a = left?.game_data.melee;
  const b = right?.game_data.melee;
  const summary: Metric[] = [
    {
      label: "Combo hits",
      left: comboHitCount(left),
      right: comboHitCount(right),
    },
    {
      label: "Full combo damage",
      left: fullComboDamage(left, power),
      right: fullComboDamage(right, power),
      direction: "higher",
    },
    {
      label: "Combo length*",
      left: normalizedComboLength(left),
      right: normalizedComboLength(right),
      direction: "lower",
      unit: " units",
    },
    {
      label: "Spam damage rate*",
      left: spamDamageRate(left, power),
      right: spamDamageRate(right, power),
      direction: "higher",
      unit: " / unit",
    },
    {
      label: "Jump damage",
      left: a?.jump ? scaleDamage(a.jump.damage, power) : null,
      right: b?.jump ? scaleDamage(b.jump.damage, power) : null,
      direction: "higher",
    },
    { label: "Combo reset", left: a?.combo_reset, right: b?.combo_reset },
  ];
  const attacks = Array.from(
    { length: Math.max(a?.combo.length ?? 0, b?.combo.length ?? 0) },
    (_, index) => {
      const first = a?.combo[index];
      const second = b?.combo[index];
      return {
        title: `Hit ${index + 1}`,
        rows: [
          {
            label: "Damage per hit",
            left: first ? scaleDamage(first.damage, power) : null,
            right: second ? scaleDamage(second.damage, power) : null,
            direction: "higher" as const,
          },
          ...((first && knownHitCount(first) != null) ||
          (second && knownHitCount(second) != null)
            ? [
                {
                  label: "Hits per attack",
                  left: first ? hitsPerAttack(first) : null,
                  right: second ? hitsPerAttack(second) : null,
                },
                {
                  label: "Attack damage",
                  left: first ? attackDamage(first, power) : null,
                  right: second ? attackDamage(second, power) : null,
                  direction: "higher" as const,
                },
              ]
            : []),
          {
            label: "Stagger",
            left: first?.stagger,
            right: second?.stagger,
            direction: "higher" as const,
          },
          {
            label: "Reach",
            left: first?.range,
            right: second?.range,
            direction: "higher" as const,
          },
          {
            label: "Speed",
            left: first?.speed,
            right: second?.speed,
            direction: "higher" as const,
          },
          ...(first?.repeat != null || second?.repeat != null
            ? [
                {
                  label: "Repeat hits",
                  left: first ? (first.repeat ?? 1) : null,
                  right: second ? (second.repeat ?? 1) : null,
                },
              ]
            : []),
          ...(first?.cooldown != null || second?.cooldown != null
            ? [
                {
                  label: "Cooldown",
                  left: first ? (first.cooldown ?? 0) : null,
                  right: second ? (second.cooldown ?? 0) : null,
                  direction: "lower" as const,
                },
              ]
            : []),
          { label: "Weight", left: first?.weight, right: second?.weight },
        ],
      };
    },
  );
  return [{ title: "Moveset overview", rows: summary }, ...attacks];
}

function rangedRows(
  left?: CatalogItem,
  right?: CatalogItem,
  power = 1,
): Metric[] {
  const a = left?.game_data.ranged;
  const b = right?.game_data.ranged;
  const projectilePattern = (item?: CatalogItem) =>
    item?.game_data.ranged?.projectiles
      ?.map(
        (shot) =>
          `${shot.count ?? 1} × ${shot.damage == null ? "?" : scaleDamage(shot.damage, power)}`,
      )
      .join(" + ");
  return [
    { label: "Ammo", left: a?.ammo, right: b?.ammo, direction: "higher" },
    {
      label: "Base volley damage*",
      left: potentialVolleyDamage(left, power),
      right: potentialVolleyDamage(right, power),
      direction: "higher",
    },
    ...(fullChargeDamage(left, power) != null ||
    fullChargeDamage(right, power) != null
      ? [
          {
            label: "Fully charged damage*",
            left: fullChargeDamage(left, power),
            right: fullChargeDamage(right, power),
            direction: "higher" as const,
          },
        ]
      : []),
    {
      label: "Projectile pattern",
      left: projectilePattern(left),
      right: projectilePattern(right),
    },
    {
      label: "Reload time",
      left: a?.reload,
      right: b?.reload,
      direction: "lower",
      unit: "s",
    },
    {
      label: "Charge time",
      left: a?.charge_time,
      right: b?.charge_time,
      direction: "lower",
      unit: "s",
    },
    { label: "Fire rate value", left: a?.fire_rate, right: b?.fire_rate },
    { label: "Volleys", left: a?.volleys, right: b?.volleys },
  ];
}

function WeaponCard({
  item,
  side,
  active,
  onChoose,
  returnTo,
  power,
}: {
  item?: CatalogItem;
  side: Side;
  active: boolean;
  onChoose: () => void;
  returnTo: string;
  power: number;
}) {
  return (
    <div className={`compare-weapon${active ? " active" : ""}`}>
      <button
        type="button"
        className="compare-weapon-select"
        onClick={onChoose}
        aria-label={`Choose ${side === "left" ? "first" : "second"} weapon`}
        aria-pressed={active}
      >
        <span className="compare-weapon-art">
          {item ? (
            <ItemArtwork
              item={{
                slug: item.slug,
                category: item.category,
                type: item.type ?? "",
                variation: item.name,
                image: item.image,
              }}
            />
          ) : (
            <Plus size={30} />
          )}
        </span>
        <span className="compare-weapon-copy">
          <small>{side === "left" ? "First weapon" : "Second weapon"}</small>
          <strong>{item?.name ?? "Choose weapon"}</strong>
          <span>
            {item
              ? item.type && item.type !== "other"
                ? humanize(item.type)
                : item.category === "ranged_weapon"
                  ? "Ranged weapon"
                  : "Melee weapon"
              : "Select from the catalog"}
          </span>
        </span>
      </button>
      {item && (
        <a
          className="compare-detail-link"
          href={`${itemPath(item)}?returnTo=${encodeURIComponent(returnTo)}${powerParam(power) ? `&power=${power}` : ""}`}
        >
          View details
        </a>
      )}
    </div>
  );
}

export function WeaponComparePage({
  weapons,
  filters,
  onChange,
}: {
  weapons: PublishedItem[];
  filters: WeaponCompareSearch;
  onChange: (patch: Partial<WeaponCompareSearch>) => void;
}) {
  const [activeSide, setActiveSide] = useState<Side>(
    filters.left ? "right" : "left",
  );
  const [query, setQuery] = useState("");
  const [weaponType, setWeaponType] = useState("");
  const power = filters.power ?? 1;
  const returnTo = returnPathAtPower(filters.returnTo, power);
  const pickerRef = useRef<HTMLElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const category = filters.mode === "ranged" ? "ranged_weapon" : "melee_weapon";
  const available = useMemo(
    () => weapons.filter((weapon) => weapon.category === category),
    [weapons, category],
  );
  const first = available.find((weapon) => weapon.slug === filters.left);
  const second = available.find((weapon) => weapon.slug === filters.right);
  const left = first ? normalizeDetailItem(first) : undefined;
  const right = second ? normalizeDetailItem(second) : undefined;
  const selected = activeSide === "left" ? first : second;
  const other = activeSide === "left" ? second : first;
  const backHref = left
    ? `${itemPath(left)}?returnTo=${encodeURIComponent(returnTo)}${powerParam(power) ? `&power=${power}` : ""}`
    : returnTo;
  const chooseSide = (side: Side) => {
    setActiveSide(side);
    setQuery("");
    setWeaponType("");
    pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const changeMode = (mode: "melee" | "ranged") => {
    if (mode === filters.mode) return;
    setActiveSide("left");
    setQuery("");
    setWeaponType("");
    onChange({ mode, left: undefined, right: undefined });
  };
  const selectWeapon = (item: PublishedItem) => {
    onChange({ [activeSide]: item.slug });
    if (activeSide === "left" && !second) setActiveSide("right");
    setQuery("");
    setWeaponType("");
    comparisonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const tables = meleeTables(left, right, power);
  return (
    <>
      <AppHeader active="collection" />
      <main id="main" className="shell compare-page">
        <a className="compare-back" href={backHref}>
          <ArrowLeft size={15} />
          {left ? `Back to ${left.name}` : "Back to catalog"}
        </a>
        <header className="compare-header">
          <div className="compare-header-top">
            <span className="eyebrow">CATALOG / WEAPONS</span>
            <PowerInput
              power={power}
              onChange={(value) =>
                onChange({
                  power: powerParam(value),
                  returnTo: returnPathAtPower(filters.returnTo, value),
                })
              }
            />
          </div>
          <h1>
            Compare weapons<span className="accent">.</span>
          </h1>
          <p>
            See published weapon values side by side before choosing your gear.
          </p>
        </header>
        <ToggleButtonGroup
          aria-label="Weapon category"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[filters.mode]}
          onSelectionChange={(keys) =>
            changeMode([...keys][0] === "ranged" ? "ranged" : "melee")
          }
        >
          <ToggleButton id="melee">Melee weapons</ToggleButton>
          <ToggleButton id="ranged">Ranged weapons</ToggleButton>
        </ToggleButtonGroup>
        <div className="compare-layout">
          <div className="compare-main">
            <div className="compare-weapons" ref={comparisonRef}>
              <WeaponCard
                item={left}
                side="left"
                active={activeSide === "left"}
                onChoose={() => chooseSide("left")}
                returnTo={returnTo}
                power={power}
              />
              <WeaponCard
                item={right}
                side="right"
                active={activeSide === "right"}
                onChoose={() => chooseSide("right")}
                returnTo={returnTo}
                power={power}
              />
            </div>
            {!left || !right ? (
              <div className="compare-empty">
                <ArrowLeftRight size={24} />
                <h2>
                  {left || right
                    ? "Choose another weapon"
                    : "Choose two weapons"}
                </h2>
                <p>
                  Select a weapon from the catalog to see its stats side by
                  side.
                </p>
                <Button
                  variant="secondary"
                  onPress={() => chooseSide(left ? "right" : "left")}
                >
                  Browse {filters.mode} weapons
                </Button>
              </div>
            ) : (
              <>
                <p className="compare-legend">
                  <span className="compare-legend-better">Better</span> and{" "}
                  <span className="compare-legend-worse">Worse</span> mark
                  favorable raw values only. Equal, missing, and
                  context-dependent stats stay neutral.
                </p>
                {filters.mode === "melee" ? (
                  <>
                    <div className="compare-section-title">
                      <Swords size={17} /> Moveset
                    </div>
                    <p className="compare-note">
                      *A relative estimate for repeatedly finishing the normal
                      combo: damage = sum of per-hit damage × hits per attack ×
                      repeat hits; combo length = sum of (1 ÷ speed + repeat
                      hits × cooldown); damage rate = damage ÷ length. Missing
                      repeat and cooldown values count as 1 and 0. The units are
                      normalized, not seconds.
                    </p>
                    {tables.map((table) => (
                      <MetricTable
                        key={table.title}
                        {...table}
                        left={left}
                        right={right}
                      />
                    ))}
                    <p className="compare-note">
                      This uses damage at the selected Power for a single
                      target, not measured in-game DPS. Jump attacks, splash,
                      effects, missed hits, and animation timing are excluded.
                      Combo reset is an idle timeout, so it adds no wait while
                      spamming attacks.
                    </p>
                  </>
                ) : (
                  <>
                    <MetricTable
                      title="Ranged stats"
                      rows={rangedRows(left, right, power)}
                      left={left}
                      right={right}
                    />
                    <p className="compare-note">
                      *Volley damage assumes every listed projectile lands. Full
                      charge damage uses ×2 for Shortbow, ×4 for Powerbow, and
                      ×3 for other bows. Crossbows have no derived full charge
                      value. These figures are not damage per second.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
          <aside
            className="compare-picker"
            ref={pickerRef}
            aria-label="Weapon picker"
          >
            <span className="eyebrow">
              CATALOG / {filters.mode.toUpperCase()}
            </span>
            <h2>Choose {activeSide === "left" ? "first" : "second"} weapon</h2>
            <CatalogPicker
              mode="compare"
              catalog={available.filter(
                (weapon) => weapon.slug !== other?.slug,
              )}
              target={{ kind: "item", slot: filters.mode }}
              query={query}
              onQuery={setQuery}
              type={weaponType}
              onType={setWeaponType}
              selected={selected?.slug}
              selectedSlugs={[]}
              lockedSlugs={[]}
              selectedTiers={{}}
              multiple={false}
              onSelect={selectWeapon}
              onClear={() => onChange({ [activeSide]: undefined })}
            />
          </aside>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
