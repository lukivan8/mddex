import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SearchField } from "@heroui/react";
import { ArrowLeft, GitBranch, RotateCw, X } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { AppFooter } from "../../components/AppFooter";
import { FilterSelect } from "../collection/components/FilterToolbar";
import {
  layoutQuestGraph,
  type Quest,
  type QuestGraphData,
  type QuestReference,
} from "./quest-graph";

import { groupQuestRewards } from "./quest-rewards";
import { QuestGraphCanvas } from "./QuestGraphCanvas";

function Reference({
  row,
  data,
}: {
  row: QuestReference;
  data: QuestGraphData;
}) {
  const item = row.catalog_slug
    ? data.catalogLinks[row.catalog_slug]
    : undefined;
  const name = row.title || row.name || item?.name;
  if (!name) return null;
  return (
    <li>
      <span className="quest-location-reference">
        {item?.image && (
          <img src={item.image} alt="" width={20} height={20} loading="lazy" />
        )}
        {item ? (
          <Link to={item.path}>{name}</Link>
        ) : row.href?.startsWith("https://") ? (
          <a href={row.href} target="_blank" rel="noopener noreferrer">
            {name}
          </a>
        ) : (
          <span>{name}</span>
        )}
      </span>
      {row.subtitle &&
        !/^Area of (?:The Sift|The Overworld)\.?$/i.test(
          row.subtitle.trim(),
        ) && <small>{row.subtitle}</small>}
    </li>
  );
}
function QuestRewards({
  rows,
  data,
}: {
  rows: QuestReference[];
  data: QuestGraphData;
}) {
  return (
    <div className="quest-rewards">
      {groupQuestRewards(rows).map((group, i) => (
        <div
          key={i}
          className={
            group.dropCount != null ? "quest-reward-pool" : "quest-reward-group"
          }
        >
          {group.dropCount != null && (
            <div className="quest-reward-pool-heading">
              <strong>
                {group.dropCount} of {group.items.length} drop
              </strong>
              <span className="quest-reward-slots" aria-hidden="true">
                {group.items.map((_, j) => (
                  <span
                    key={j}
                    className={j < group.dropCount! ? "filled" : ""}
                  />
                ))}
              </span>
            </div>
          )}
          <ul className="quest-reward-cards">
            {group.items.map((row, j) => {
              const item = row.catalog_slug
                ? data.catalogLinks[row.catalog_slug]
                : undefined;
              const content = (
                <>
                  {item?.image && (
                    <img
                      src={item.image}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                    />
                  )}
                  <span>
                    {row.title || row.name || item?.name}
                    {row.subtitle && <small>{row.subtitle}</small>}
                  </span>
                </>
              );
              return (
                <li key={j}>
                  {item ? (
                    <Link to={item.path}>{content}</Link>
                  ) : (
                    <div>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function QuestDetails({
  node,
  data,
  onSelect,
  hidden,
}: {
  hidden: boolean;
  node: Quest;
  data: QuestGraphData;
  onSelect: (key: string) => void;
}) {
  const [objectivesQuest, setObjectivesQuest] = useState<string | null>(null);
  const objectivesTrigger = useRef<HTMLButtonElement>(null);
  const objectivesClose = useRef<HTMLButtonElement>(null);
  const objectivesOpen = !hidden && objectivesQuest === node.source_key;
  useEffect(() => {
    if (objectivesOpen) objectivesClose.current?.focus({ preventScroll: true });
  }, [objectivesOpen]);
  const closeObjectives = () => {
    setObjectivesQuest(null);
    objectivesTrigger.current?.focus({ preventScroll: true });
  };
  const prerequisites = data.edges
    .filter((edge) => edge.to === node.source_key)
    .map((edge) => data.nodes.find((node) => node.source_key === edge.from)!);
  const unlocks = [
    ...(/Brave Haven Content/i.test(node.unlocks ?? "")
      ? ["New Brave Haven content"]
      : []),
    ...(/Soul Storms/i.test(node.unlocks ?? "") ? ["Soul Storms"] : []),
  ];
  const followUps = data.edges
    .filter((edge) => edge.from === node.source_key)
    .map((edge) => data.nodes.find((node) => node.source_key === edge.to)!);
  return (
    <section
      hidden={hidden}
      id="quest-details"
      className={`quest-details ${objectivesOpen ? "quest-details-objectives-open" : ""}`}
      aria-labelledby="quest-detail-title"
    >
      <div className="quest-detail-overview">
        <div className="quest-detail-heading">
          <span className="eyebrow">
            {node.type}
            {node.type === "Core Quest" && node.order != null
              ? ` · №${node.order}`
              : ""}
            {node.recommended_level != null && (
              <span title="Recommended level">
                {" "}
                · lvl {node.recommended_level}
              </span>
            )}
            {node.repeatable && (
              <span
                className="quest-repeatable-icon"
                role="img"
                aria-label="Repeatable"
                title="Repeatable"
              >
                <RotateCw size={15} aria-hidden="true" />
              </span>
            )}
          </span>
          <h2 id="quest-detail-title">{node.name}</h2>
          <button
            type="button"
            ref={objectivesTrigger}
            aria-expanded={objectivesOpen}
            aria-controls="quest-objectives-panel"
            className="quest-objectives-trigger"
            onClick={() => setObjectivesQuest(node.source_key)}
          >
            View objectives <span>{node.objectives.length}</span>
          </button>
        </div>
        <dl className="quest-facts">
          {node.giver && (
            <>
              <dt>Given by</dt>
              <dd>{node.giver}</dd>
            </>
          )}
          {node.minimum_level != null && (
            <>
              <dt>Minimum level</dt>
              <dd>{node.minimum_level}</dd>
            </>
          )}
        </dl>
        {node.giver_note && <p className="muted">{node.giver_note}</p>}
        {node.locations.length > 0 ? (
          <section>
            <h3>Location</h3>
            <ul className="quest-references">
              {node.locations.map((row, i) => (
                <Reference key={i} row={row} data={data} />
              ))}
            </ul>
          </section>
        ) : (
          node.area && <p>Area: {node.area}</p>
        )}
        <section>
          <h3>Prerequisites</h3>
          {prerequisites.length ? (
            <ul className="quest-related">
              {prerequisites.map((quest) => (
                <li key={quest.source_key}>
                  <span
                    className={`quest-type-icon ${quest.type === "Core Quest" ? "quest-type-main" : ""}`}
                    role="img"
                    aria-label={
                      quest.type === "Core Quest" ? "Main quest" : "Side quest"
                    }
                    title={
                      quest.type === "Core Quest" ? "Main quest" : "Side quest"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(quest.source_key)}
                  >
                    {quest.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No quest prerequisite listed.</p>
          )}
          {node.unlock_conditions?.combination === "source_unspecified" &&
            prerequisites.length > 1 && (
              <p className="muted">
                The sources do not specify whether all or any of these quests
                are required.
              </p>
            )}
          {node.unlock_conditions?.additional_conditions &&
            node.unlock_conditions.additional_conditions !==
              node.giver_note && (
              <p className="muted">
                {node.unlock_conditions.additional_conditions}
              </p>
            )}
        </section>
        {unlocks.length > 0 && (
          <section>
            <h3>Unlocks</h3>
            <ul className="quest-references">
              {unlocks.map((unlock) => (
                <li key={unlock}>{unlock}</li>
              ))}
            </ul>
          </section>
        )}
        {followUps.length > 0 && (
          <section>
            <h3>Follow-up quests</h3>
            <ul className="quest-related">
              {followUps.map((quest) => (
                <li key={quest.source_key}>
                  <span
                    className={`quest-type-icon ${quest.type === "Core Quest" ? "quest-type-main" : ""}`}
                    role="img"
                    aria-label={
                      quest.type === "Core Quest" ? "Main quest" : "Side quest"
                    }
                    title={
                      quest.type === "Core Quest" ? "Main quest" : "Side quest"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(quest.source_key)}
                  >
                    {quest.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {(
          [
            ["First completion", node.rewards.first_completion],
            ["Repeat completion", node.rewards.repeat_completion],
          ] as const
        ).map(
          ([title, rows]) =>
            rows.length > 0 && (
              <section key={title}>
                <h3>{title} rewards</h3>
                <QuestRewards rows={rows} data={data} />
              </section>
            ),
        )}
        {node.completion && (
          <details>
            <summary>Completion journal</summary>
            <blockquote className="quest-journal">{node.completion}</blockquote>
          </details>
        )}
      </div>
      {objectivesOpen && (
        <div
          id="quest-objectives-panel"
          className="quest-objectives-drawer"
          role="dialog"
          aria-labelledby="quest-objectives-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              closeObjectives();
            }
          }}
        >
          <div className="quest-objectives-drawer-heading">
            <h3 id="quest-objectives-title">Objectives</h3>
            <button
              ref={objectivesClose}
              type="button"
              aria-label="Close objectives"
              onClick={closeObjectives}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <p className="quest-objectives-quest-name">{node.name}</p>
          {node.objectives.length ? (
            <ol className="quest-objectives">
              {node.objectives.map((row, i) => (
                <li key={i}>
                  {row.title || row.name}
                  {row.subtitle && <small>{row.subtitle}</small>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No objectives listed.</p>
          )}
        </div>
      )}
    </section>
  );
}
type QuestView = "graph" | "details";
function QuestSectionSwitch({
  view,
  onChange,
}: {
  view: QuestView;
  onChange: (view: QuestView) => void;
}) {
  return (
    <nav className="quest-section-switch" aria-label="Quest view">
      <button
        type="button"
        aria-pressed={view === "graph"}
        aria-controls="quest-graph"
        onClick={() => onChange("graph")}
      >
        <GitBranch size={15} aria-hidden="true" /> Graph
      </button>
      <button
        type="button"
        aria-pressed={view === "details"}
        aria-controls="quest-details"
        onClick={() => onChange("details")}
      >
        Details
      </button>
    </nav>
  );
}

export function QuestGraphPage({
  data,
  selectedSlug,
  onSelect,
}: {
  data: QuestGraphData;
  selectedSlug?: string;
  onSelect: (key: string) => void;
}) {
  const [view, setView] = useState<QuestView>("graph");
  useEffect(() => {
    const syncView = () =>
      setView(window.location.hash === "#quest-details" ? "details" : "graph");
    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);
  const changeView = (next: QuestView) => {
    setView(next);
    window.history.replaceState(window.history.state, "", `#quest-${next}`);
    requestAnimationFrame(() => {
      document
        .getElementById(`quest-${next}`)
        ?.scrollIntoView({ block: "start" });
    });
  };
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const layout = useMemo(() => layoutQuestGraph(data), [data]);
  const selected =
    data.nodes.find(
      (node) =>
        node.source_key === `quests:${selectedSlug}` ||
        node.source_key === selectedSlug,
    ) ??
    data.nodes.find(
      (node) => layout.parents.get(node.source_key)?.size === 0,
    ) ??
    data.nodes[0];
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = data.nodes.filter(
    (node) =>
      (!type || node.type === type) &&
      tokens.every((token) =>
        `${node.name} ${node.giver ?? ""} ${node.area ?? ""} ${node.start_location?.name ?? ""}`
          .toLowerCase()
          .includes(token),
      ),
  );
  const matchKeys = new Set(matches.map((node) => node.source_key));
  const filtering = Boolean(tokens.length || type);
  return (
    <>
      <AppHeader active="resources" />
      <main id="main" className="shell resources-main quests-main">
        <Link to="/resources" className="resources-back">
          <ArrowLeft size={14} aria-hidden="true" />
          All resources
        </Link>
        <div className="quest-page-heading">
          <div>
            <span className="eyebrow">
              <GitBranch size={14} aria-hidden="true" /> QUEST PROGRESSION
            </span>
            <h1>
              Quest graph<span className="accent">.</span>
            </h1>
            <p className="muted">
              Follow the story, explore side paths, and see what each quest
              unlocks.
            </p>
          </div>
        </div>
        <div className="quest-toolbar">
          <SearchField
            aria-label="Find a quest"
            value={query}
            onChange={setQuery}
            className="catalog-search"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search quest, giver, or area…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <FilterSelect
            label="Quest type"
            value={type}
            onChange={setType}
            options={[
              { id: "", name: "All quests" },
              { id: "Core Quest", name: "Core quests" },
              { id: "Side Quest", name: "Side quests" },
            ]}
          />
        </div>
        {filtering && (
          <div
            className="quest-search-results"
            role="region"
            aria-label="Matching quests"
          >
            <span className="muted" role="status">
              {matches.length} matching quests
            </span>
            {matches.map((node) => (
              <button
                type="button"
                key={node.source_key}
                onClick={() => onSelect(node.source_key)}
                aria-pressed={node.source_key === selected.source_key}
              >
                {node.name}
              </button>
            ))}
            {matches.length === 0 && (
              <p className="muted">Try another quest name, giver, or area.</p>
            )}
          </div>
        )}
        <div className="quest-workspace">
          <QuestGraphCanvas
            active={view === "graph"}
            data={data}
            selectedKey={selected.source_key}
            matchKeys={matchKeys}
            filtering={filtering}
            onSelect={onSelect}
          />
          <QuestDetails
            hidden={view !== "details"}
            node={selected}
            data={data}
            onSelect={onSelect}
          />
        </div>
        <QuestSectionSwitch view={view} onChange={changeView} />
      </main>
      <AppFooter />
    </>
  );
}
