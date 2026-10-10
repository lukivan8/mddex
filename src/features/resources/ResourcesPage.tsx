import { useState } from "react";
import { SearchField } from "@heroui/react";
import { FilterSelect } from "../collection/components/FilterToolbar";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CloudLightning,
  Map,
  Swords,
  GitBranch,
  ListChecks,
  Route as RouteIcon,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { AppFooter } from "../../components/AppFooter";
import { resources, type Resource } from "./resources";

function ResourceCard({ resource }: { resource: Resource }) {
  const external = "url" in resource;
  const Icon = external
    ? Map
    : resource.path.startsWith("/resources/item-tracker")
      ? ListChecks
      : resource.path === "/resources/soul-storm"
        ? CloudLightning
        : resource.path === "/resources/soul-storm-routes" ||
            resource.path === "/resources/planner"
          ? RouteIcon
          : resource.path === "/resources/quests"
            ? GitBranch
            : Swords;
  const Arrow = external ? ArrowUpRight : ArrowRight;
  const content = (
    <>
      <div className="resource-card-top">
        <Icon size={20} className="accent" aria-hidden="true" />
        <span className="eyebrow">{resource.category}</span>
        <Arrow size={16} className="resource-arrow" aria-hidden="true" />
      </div>
      <h2>{resource.title}</h2>
      <p className="muted">{resource.description}</p>
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </>
  );
  return external ? (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="resource-card"
    >
      {content}
    </a>
  ) : (
    <Link to={resource.path} className="resource-card">
      {content}
    </Link>
  );
}

export function ResourcesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = resources.filter(
    (resource) =>
      (!category || resource.category === category) &&
      tokens.every((token) =>
        `${resource.title} ${resource.description} ${resource.category}`
          .toLowerCase()
          .includes(token),
      ),
  );
  return (
    <>
      <AppHeader active="resources" />
      <main id="main" className="shell resources-main">
        <h1>
          Resources<span className="accent">.</span>
        </h1>
        <div className="filter-row resources-filters">
          <SearchField
            aria-label="Search resources"
            value={query}
            onChange={setQuery}
            className="catalog-search"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search tools and references…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <FilterSelect
            label="Resource category"
            value={category}
            onChange={setCategory}
            options={[
              { id: "", name: "All categories" },
              { id: "Tools", name: "Tools" },
              { id: "References", name: "References" },
            ]}
          />
        </div>
        <div className="resource-grid">
          {visible.map((resource) => (
            <ResourceCard
              key={"url" in resource ? resource.url : resource.path}
              resource={resource}
            />
          ))}
        </div>
        {visible.length === 0 && (
          <div className="resources-empty" role="status">
            <h2>No resources found</h2>
            <p className="muted">Try another search or category.</p>
          </div>
        )}
      </main>
      <AppFooter />
    </>
  );
}
