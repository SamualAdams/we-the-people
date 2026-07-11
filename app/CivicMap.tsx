"use client";

import { useMemo, useState } from "react";
import type { Branch, BranchId, Division } from "./civic-data";
import { SelectionExplainChat } from "./SelectionExplainChat";

type FilterId = BranchId | "all";

const filters: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "judicial", label: "Courts" },
  { id: "constitutional", label: "Parish" },
  { id: "executive", label: "Mayor" },
  { id: "legislative", label: "Council" },
];

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function branchText(branch: Branch) {
  return [
    branch.title,
    branch.subtitle,
    branch.summary,
    branch.count,
    ...branch.divisions.flatMap((division) => [
      division.title,
      ...division.items,
    ]),
  ].join(" ");
}

function officeCount(branch: Branch) {
  return branch.divisions.reduce(
    (count, division) => count + division.items.length,
    0,
  );
}

function filterDivisions(branch: Branch, query: string): Division[] {
  if (!query) {
    return branch.divisions;
  }

  const branchMatches = normalize(
    [branch.title, branch.subtitle, branch.summary].join(" "),
  ).includes(query);

  if (branchMatches) {
    return branch.divisions;
  }

  return branch.divisions
    .map((division) => {
      const divisionMatches = normalize(division.title).includes(query);
      const items = division.items.filter((item) =>
        normalize(item).includes(query),
      );

      return {
        ...division,
        items: divisionMatches ? division.items : items,
      };
    })
    .filter((division) => division.items.length > 0);
}

function electedCount(branch: Branch) {
  return branch.divisions
    .flatMap((division) => division.items)
    .filter((item) => item.includes("*") && !item.includes("**")).length;
}

export function CivicMap({ branches }: { branches: Branch[] }) {
  const [activeId, setActiveId] = useState<BranchId | null>("executive");
  const [filterId, setFilterId] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  const normalizedQuery = normalize(query);
  const visibleBranches = useMemo(() => {
    return branches
      .filter((branch) => filterId === "all" || branch.id === filterId)
      .filter((branch) =>
        normalizedQuery
          ? normalize(branchText(branch)).includes(normalizedQuery)
          : true,
      )
      .map((branch) => ({
        ...branch,
        divisions: filterDivisions(branch, normalizedQuery),
      }));
  }, [branches, filterId, normalizedQuery]);

  const selectedBranch =
    visibleBranches.find((branch) => branch.id === activeId) ??
    visibleBranches[0] ??
    null;

  const totalOffices = branches.reduce(
    (count, branch) => count + officeCount(branch),
    0,
  );

  return (
    <main className="home-shell">
      <header className="site-header" aria-label="Site header">
        <div className="brand-mark" aria-hidden="true" />
        <div>
          <p className="site-kicker">East Baton Rouge Parish</p>
          <p className="site-name">We the People Baton Rouge</p>
        </div>
      </header>

      <section className="map-section" aria-labelledby="map-title">
        <div className="intro-panel">
          <p className="eyebrow">Local civic structure</p>
          <h1 id="map-title">Baton Rouge government, simplified</h1>
          <p className="intro-copy">
            Citizens at the top. Branches below. Offices and departments grouped
            into a readable map.
          </p>
        </div>

        <div className="control-panel" aria-label="Map controls">
          <label className="search-field" htmlFor="office-search">
            <span>Search offices</span>
            <input
              id="office-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Police, council, assessor..."
              type="search"
              value={query}
            />
          </label>

          <div className="filter-tabs" role="group" aria-label="Branch filter">
            {filters.map((filter) => (
              <button
                aria-pressed={filterId === filter.id}
                className="filter-tab"
                key={filter.id}
                onClick={() => {
                  setFilterId(filter.id);
                  if (filter.id !== "all") {
                    setActiveId(filter.id);
                  }
                }}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="map-canvas" aria-label="Organization map">
          <div className="citizens-node">
            <span className="node-label">Citizens of East Baton Rouge Parish</span>
            <span className="node-detail">
              {totalOffices} offices, departments, boards, and districts
            </span>
          </div>

          {visibleBranches.length > 0 ? (
            <div className="branch-grid">
              {visibleBranches.map((branch) => {
                const isActive = selectedBranch?.id === branch.id;
                const isMuted = Boolean(selectedBranch) && !isActive;

                return (
                  <article
                    className={`branch branch-${branch.id} ${
                      isActive ? "is-active" : ""
                    } ${isMuted ? "is-muted" : ""}`}
                    key={branch.id}
                  >
                    <button
                      aria-controls="branch-details"
                      aria-expanded={isActive}
                      className="branch-heading"
                      onClick={() =>
                        setActiveId((current) =>
                          current === branch.id ? null : branch.id,
                        )
                      }
                      type="button"
                    >
                      <span>
                        <span className="branch-summary">{branch.summary}</span>
                        <span className="branch-title">{branch.title}</span>
                        <span className="branch-subtitle">
                          {branch.subtitle}
                        </span>
                      </span>
                      <span className="branch-count">{branch.count}</span>
                    </button>

                    <div className="division-stack">
                      {branch.divisions.map((division) => (
                        <section className="division-card" key={division.title}>
                          <h3>{division.title}</h3>
                          <ul>
                            {division.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state" role="status">
              <p>No matching offices</p>
            </div>
          )}

          <aside
            className="focus-panel"
            id="branch-details"
            aria-live="polite"
            aria-label="Focused branch details"
          >
            {selectedBranch ? (
              <>
                <div className="focus-header">
                  <p className="eyebrow">Focused view</p>
                  <h2>{selectedBranch.title}</h2>
                  <p>{selectedBranch.subtitle}</p>
                </div>

                <dl className="stat-grid">
                  <div>
                    <dt>Groups</dt>
                    <dd>{selectedBranch.divisions.length}</dd>
                  </div>
                  <div>
                    <dt>Listed offices</dt>
                    <dd>{officeCount(selectedBranch)}</dd>
                  </div>
                  <div>
                    <dt>Elected</dt>
                    <dd>{electedCount(selectedBranch)}</dd>
                  </div>
                </dl>

                <div className="focus-path" aria-label="Civic path">
                  <span>Citizens</span>
                  <span>{selectedBranch.title}</span>
                  <span>{selectedBranch.summary}</span>
                </div>

                <div className="focus-list">
                  {selectedBranch.divisions.map((division) => (
                    <section key={division.title}>
                      <h3>{division.title}</h3>
                      <p>{division.items.join(" / ")}</p>
                    </section>
                  ))}
                </div>

                <button
                  className="reset-button"
                  onClick={() => {
                    setActiveId(null);
                    setFilterId("all");
                    setQuery("");
                  }}
                  type="button"
                >
                  Reset map
                </button>
              </>
            ) : (
              <div className="focus-header">
                <p className="eyebrow">Full map</p>
                <h2>All branches</h2>
                <p>{totalOffices} listed offices, departments, and boards.</p>
              </div>
            )}
          </aside>
        </div>

        <aside className="legend" aria-label="Chart legend">
          <span>* Elected officials</span>
          <span>** State statutorily defined offices/funds</span>
        </aside>
      </section>

      <SelectionExplainChat />
    </main>
  );
}
