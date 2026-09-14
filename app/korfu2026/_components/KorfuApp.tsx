"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import "./korfu-theme.css";

const KorfuMap = dynamic(() => import("./KorfuMap"), {
  ssr: false,
  loading: () => (
    <div
      aria-busy="true"
      aria-label="Načítám mapu…"
      className="kf-card flex h-64 items-center justify-center text-sm"
      style={{ color: "var(--muted)" }}
      role="status"
    >
      Načítám mapu…
    </div>
  ),
});
import { PLACES } from "../_data/places";
import { COMBOS } from "../_data/combos";
import {
  HORSE_OPERATORS,
  HORSE_LEADS,
  BOAT_OPERATORS,
  DIVING_OPERATORS,
  QUAD_OPERATORS,
  CHECKLISTS,
  CONTACT_TEMPLATES,
} from "../_data/operators";
import {
  TRIP_FACTS,
  EMERGENCY_CONTACTS,
  EVENTS,
  TRANSPORT_OPTIONS,
  RODA_PRAKTIKA,
  VECERNI_PODNIKY,
  VECERNI_ALTERNATIVY,
  RESTAURACE_RODA,
  WHAT_TO_TRY,
  ZASOBY_TIPY,
  SOURCES_SECTION,
  POCASI_PRAVIDLA,
  POCASI_SNAPSHOT,
  PENIZE_DATA,
} from "../_data/practical";
import {
  SELECTION_KEY,
  CATEGORY_LABEL,
  AREA_LABEL,
  TIER_LABEL,
  DIFFICULTY_LABEL,
  TRANSPORT_LABEL,
  WEATHER_LABEL,
  FRESHNESS_LABEL,
  SELECTION_STATUS_LABEL,
} from "../_data/types";
import type {
  Category,
  Area,
  Difficulty,
  TransportMode,
  WeatherFit,
  Tier,
  SelectionState,
  SelectionStatus,
} from "../_data/types";
import { PlaceCard } from "./PlaceCard";
import { OperatorCard } from "./OperatorCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "prehled" | "moznosti" | "mapa" | "muj-vyber" | "prakticke";

interface Filters {
  category: Category | null;
  area: Area | null;
  difficulty: Difficulty | null;
  transport: TransportMode | null;
  weather: WeatherFit | null;
  priority: Tier | null;
}

const EMPTY_FILTERS: Filters = {
  category: null,
  area: null,
  difficulty: null,
  transport: null,
  weather: null,
  priority: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_SELECTION: SelectionState = {
  oblibene: [],
  chceme: [],
  navstiveno: [],
};

function loadSelection(): SelectionState {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (!raw) return EMPTY_SELECTION;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        ...EMPTY_SELECTION,
        chceme: parsed.filter((id): id is string => typeof id === "string"),
      };
    }
    if (!parsed || typeof parsed !== "object") return EMPTY_SELECTION;
    const candidate = parsed as Partial<SelectionState>;
    return {
      oblibene: Array.isArray(candidate.oblibene)
        ? candidate.oblibene.filter((id): id is string => typeof id === "string")
        : [],
      chceme: Array.isArray(candidate.chceme)
        ? candidate.chceme.filter((id): id is string => typeof id === "string")
        : [],
      navstiveno: Array.isArray(candidate.navstiveno)
        ? candidate.navstiveno.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return EMPTY_SELECTION;
  }
}

function saveSelection(selection: SelectionState): void {
  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
  } catch {
    // localStorage nedostupné — tiché selhání
  }
}

// ─── Filter data ──────────────────────────────────────────────────────────────

const UNIQUE_CATEGORIES = [...new Set(PLACES.map((p) => p.category))].sort();
const UNIQUE_AREAS = [...new Set(PLACES.map((p) => p.area))].sort();
const UNIQUE_DIFFICULTIES = [
  ...new Set(PLACES.map((p) => p.difficulty).filter(Boolean)),
] as Difficulty[];
const UNIQUE_TRANSPORTS = [
  ...new Set(PLACES.flatMap((p) => p.transportModes)),
].sort() as TransportMode[];
const UNIQUE_WEATHERS = [
  ...new Set(PLACES.flatMap((p) => p.weatherFit)),
].sort() as WeatherFit[];
const TIERS: Tier[] = ["must-see", "doporuceni", "dalsi-moznost"];

const CATEGORY_EMOJI: Partial<Record<Category, string>> = {
  plaz: "🏖️",
  pamatka: "🏛️",
  vesnice: "🏘️",
  mesto: "🏙️",
  priroda: "🥾",
  vyhlidka: "🌄",
  aktivita: "✨",
  lod: "⛵",
  jidlo: "🍽️",
  vecer: "🌙",
  doprava: "🚗",
  prakticke: "ℹ️",
  zakladna: "🏨",
};

// ─── Small shared UI ──────────────────────────────────────────────────────────

function SelectFilter<T extends string>({
  label,
  value,
  options,
  labelMap,
  onChange,
}: {
  label: string;
  value: T | null;
  options: T[];
  labelMap: Record<T, string>;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>
        {label}
      </label>
      <select
        className="rounded-lg border px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--ink)" }}
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value as T) || null)}
      >
        <option value="">Vše</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labelMap[opt]}
          </option>
        ))}
      </select>
    </div>
  );
}

function SpLine({ sp, show }: { sp: string; show: boolean }) {
  if (!show) return null;
  return <p className="kf-sp">{sp}</p>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KorfuApp() {
  const [activeTab, setActiveTab] = useState<Tab>("prehled");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setSelection(loadSelection());
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  const updateSelection = useCallback((id: string, status: SelectionStatus | null) => {
    setSelection((previous) => {
      const next: SelectionState = {
        oblibene: previous.oblibene.filter((savedId) => savedId !== id),
        chceme: previous.chceme.filter((savedId) => savedId !== id),
        navstiveno: previous.navstiveno.filter((savedId) => savedId !== id),
      };
      if (status) next[status] = [...next[status], id];
      saveSelection(next);
      return next;
    });
  }, []);

  const filteredPlaces = PLACES.filter((p) => {
    if (filters.category && p.category !== filters.category) return false;
    if (filters.area && p.area !== filters.area) return false;
    if (filters.difficulty && p.difficulty !== filters.difficulty) return false;
    if (filters.transport && !p.transportModes.includes(filters.transport))
      return false;
    if (filters.weather && !p.weatherFit.includes(filters.weather))
      return false;
    if (filters.priority && p.tier !== filters.priority) return false;
    return true;
  });

  const hasSecondaryFilters =
    filters.area !== null ||
    filters.difficulty !== null ||
    filters.transport !== null ||
    filters.weather !== null ||
    filters.priority !== null;
  const selectionStatusFor = (id: string): SelectionStatus | null => {
    for (const status of Object.keys(SELECTION_STATUS_LABEL) as SelectionStatus[]) {
      if (selection[status].includes(id)) return status;
    }
    return null;
  };
  const selectedPlaces = PLACES.filter((p) => selectionStatusFor(p.id) !== null);

  // ── Přehled tab ────────────────────────────────────────────────────────────
  function renderPrehled() {
    return (
      <>
        {/* Sticky category chip toolbar */}
        <div className="kf-toolbar -mx-4 mb-4 px-4 sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              aria-pressed={filters.category === null}
              className="kf-chip"
              onClick={() => setFilters((f) => ({ ...f, category: null }))}
              type="button"
            >
              Vše
            </button>
            {UNIQUE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                aria-pressed={filters.category === cat}
                className="kf-chip"
                onClick={() =>
                  setFilters((f) => ({ ...f, category: f.category === cat ? null : cat }))
                }
                type="button"
              >
                {CATEGORY_EMOJI[cat] ?? ""} {CATEGORY_LABEL[cat]}
              </button>
            ))}
            <button
              aria-expanded={filtersOpen}
              aria-pressed={hasSecondaryFilters}
              className="kf-chip"
              onClick={() => setFiltersOpen((v) => !v)}
              type="button"
            >
              Další filtry{hasSecondaryFilters ? " ●" : ""}
            </button>
            <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>
              {filteredPlaces.length} z {PLACES.length}
            </span>
          </div>

          {filtersOpen && (
            <div
              aria-label="Další filtry katalogu"
              className="kf-card mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
              role="group"
            >
              <SelectFilter
                label="Oblast"
                labelMap={AREA_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, area: v }))}
                options={UNIQUE_AREAS}
                value={filters.area}
              />
              <SelectFilter
                label="Priorita"
                labelMap={TIER_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
                options={TIERS}
                value={filters.priority}
              />
              <SelectFilter
                label="Náročnost"
                labelMap={DIFFICULTY_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, difficulty: v }))}
                options={UNIQUE_DIFFICULTIES}
                value={filters.difficulty}
              />
              <SelectFilter
                label="Doprava"
                labelMap={TRANSPORT_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, transport: v }))}
                options={UNIQUE_TRANSPORTS}
                value={filters.transport}
              />
              <SelectFilter
                label="Počasí"
                labelMap={WEATHER_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, weather: v }))}
                options={UNIQUE_WEATHERS}
                value={filters.weather}
              />
              {(hasSecondaryFilters || filters.category) && (
                <div className="flex items-end">
                  <button
                    className="kf-btn kf-btn-ghost"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    type="button"
                  >
                    Zrušit filtry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {filteredPlaces.length === 0 ? (
          <p className="py-10 text-center" style={{ color: "var(--muted)" }}>
            Žádné výsledky. Zkuste změnit nebo zrušit filtry.
          </p>
        ) : (
          <div className="space-y-4">
            {filteredPlaces.map((place) => (
              <PlaceCard
                key={place.id}
                onSelectionChange={updateSelection}
                place={place}
                selectionStatus={selectionStatusFor(place.id)}
                showSources={showSources}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  // ── Možnosti tab — parts E, F, G, H ────────────────────────────────────────
  function renderMoznosti() {
    return (
      <div className="space-y-8">
        <section aria-labelledby="combos-heading">
          <h2 id="combos-heading" className="kf-sectionhdr">
            🧩 Geografické balíčky
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Co lze přirozeně spojit. Nejde o dny — jen geografická blízkost.
          </p>
          <ul className="mt-3 space-y-2">
            {COMBOS.map((combo) => (
              <li key={combo.id} className="kf-card !p-3">
                <p className="text-sm" style={{ color: "var(--ink)" }}>
                  {combo.title}
                </p>
                <SpLine show={showSources} sp={combo.sp} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="horses-heading">
          <h2 id="horses-heading" className="kf-sectionhdr">
            🐴 Jízda na koni
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Katreena — první volba přímo v Rodě. Ceny a termíny ověřit aktuálně.
          </p>
          <div className="mt-3 space-y-4">
            {[...HORSE_OPERATORS, ...HORSE_LEADS].map((op) => (
              <OperatorCard key={op.id} op={op} showSources={showSources} />
            ))}
          </div>
        </section>

        <section aria-labelledby="boats-heading">
          <h2 id="boats-heading" className="kf-sectionhdr">
            ⛵ Lodě a mořské možnosti
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Ceny, termíny a počasí ověřit aktuálně.
          </p>
          <div className="mt-3 space-y-4">
            {BOAT_OPERATORS.map((op) => (
              <OperatorCard key={op.id} op={op} showSources={showSources} />
            ))}
          </div>
        </section>

        <section aria-labelledby="diving-heading">
          <h2 id="diving-heading" className="kf-sectionhdr">
            🤿 Potápění
          </h2>
          <div className="mt-3 space-y-4">
            {DIVING_OPERATORS.map((op) => (
              <OperatorCard key={op.id} op={op} showSources={showSources} />
            ))}
          </div>
        </section>

        <section aria-labelledby="quad-heading">
          <h2 id="quad-heading" className="kf-sectionhdr">
            🏍️ Quad a terénní aktivity
          </h2>
          <div className="mt-3 space-y-4">
            {QUAD_OPERATORS.map((op) => (
              <OperatorCard key={op.id} op={op} showSources={showSources} />
            ))}
          </div>
        </section>

        {CHECKLISTS.length > 0 && (
          <section aria-labelledby="checklists-heading">
            <h2 id="checklists-heading" className="kf-sectionhdr">
              ✅ Checklisty
            </h2>
            <div className="mt-3 space-y-4">
              {CHECKLISTS.map((cl) => (
                <div key={cl.id} className="kf-card">
                  <h3 className="font-semibold" style={{ color: "var(--ink)" }}>
                    {cl.title}
                  </h3>
                  <ul className="mt-2 list-disc pl-4 text-sm" style={{ color: "var(--ink)" }}>
                    {cl.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <SpLine show={showSources} sp={cl.sp} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="templates-heading">
          <h2 id="templates-heading" className="kf-sectionhdr">
            ✉️ Kontaktní šablony
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Připravené zprávy pro koně, potápění a quad safari.
          </p>
          <div className="mt-3 space-y-4">
            {CONTACT_TEMPLATES.map((template) => (
              <CopyTemplate key={template.id} showSources={showSources} template={template} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ── Mapa tab ─────────────────────────────────────────────────────────────
  function renderMapa() {
    return (
      <div className="pb-4">
        <KorfuMap filteredPlaces={filteredPlaces} />
      </div>
    );
  }

  // ── Můj výběr tab ───────────────────────────────────────────────────────────
  function renderMujVyber() {
    if (selectedPlaces.length === 0) {
      return (
        <div className="py-16 text-center">
          <p style={{ color: "var(--muted)" }}>Zatím žádný výběr.</p>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Na kartách vyberte stav <strong>Oblíbené</strong>, <strong>Chceme navštívit</strong>
            {" "}nebo <strong>Navštíveno</strong>.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Výběr je uložený v prohlížeči ({SELECTION_KEY}).
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {selectedPlaces.length}{" "}
            {selectedPlaces.length === 1
              ? "místo"
              : selectedPlaces.length < 5
                ? "místa"
                : "míst"}{" "}
            ve výběru
          </p>
          <button
            className="kf-btn kf-btn-ghost"
            onClick={() => {
              try {
                localStorage.removeItem(SELECTION_KEY);
              } catch {
                // localStorage nedostupné
              }
              setSelection(EMPTY_SELECTION);
            }}
            type="button"
          >
            Vymazat výběr
          </button>
        </div>
        {selectedPlaces.map((place) => (
          <PlaceCard
            key={place.id}
            onSelectionChange={updateSelection}
            place={place}
            selectionStatus={selectionStatusFor(place.id)}
            showSources={showSources}
          />
        ))}
      </div>
    );
  }

  // ── Praktické tab — parts I, J, K, L, M, N, O, R, S ───────────────────────
  function renderPrakticke() {
    return (
      <div className="space-y-8">
        <section aria-labelledby="trip-heading">
          <h2 id="trip-heading" className="kf-sectionhdr">
            🧳 Fakta o zájezdu
          </h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {(
              [
                ["Termín", TRIP_FACTS.termin],
                ["Hotel", TRIP_FACTS.hotel],
                ["Ubytování", TRIP_FACTS.ubytovani],
                ["Strava", TRIP_FACTS.strava],
                ["Transfer", TRIP_FACTS.transfer],
                ["Let tam", TRIP_FACTS.letTam],
                ["Let zpět", TRIP_FACTS.letZpet],
                ["Zavazadla", TRIP_FACTS.zavazadla],
                ["Catering v letadle", TRIP_FACTS.cateringLetadlo],
                ["Odbavení", TRIP_FACTS.odbaveni],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-36 shrink-0 font-semibold" style={{ color: "var(--muted)" }}>
                  {k}:
                </dt>
                <dd style={{ color: "var(--ink)" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="kf-warn mt-3">{TRIP_FACTS.praktickyDopad}</div>
          <SpLine show={showSources} sp={TRIP_FACTS.sp} />
        </section>

        <section aria-labelledby="roda-heading">
          <h2 id="roda-heading" className="kf-sectionhdr">
            🏘️ Roda — co dělat ze základny
          </h2>
          <ul className="mt-3 space-y-2">
            {RODA_PRAKTIKA.map((item) => (
              <li key={item.id} className="kf-card !p-3 text-sm">
                <span className="font-semibold" style={{ color: "var(--ink)" }}>
                  {item.label}
                </span>
                {item.freshness && (
                  <span className="kf-verify-chip ml-2">{FRESHNESS_LABEL[item.freshness]}</span>
                )}
                {item.verify && (
                  <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    {item.verify}
                  </p>
                )}
                <SpLine show={showSources} sp={item.sp} />
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-semibold" style={{ color: "var(--ink)" }}>
            Večerní podniky v Rodě
          </h3>
          <ul className="mt-2 space-y-2">
            {VECERNI_PODNIKY.map((p) => (
              <li key={p.id} className="kf-card !p-3 text-sm">
                <span className="font-semibold" style={{ color: "var(--ink)" }}>
                  {p.name}
                </span>
                {" — "}
                <span style={{ color: "var(--ink)" }}>{p.description}</span>{" "}
                <span className="kf-verify-chip">{FRESHNESS_LABEL[p.freshness]}</span>
                <SpLine show={showSources} sp={p.sp} />
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-semibold" style={{ color: "var(--ink)" }}>
            Večerní alternativy mimo Rodu
          </h3>
          <ul className="mt-2 space-y-2">
            {VECERNI_ALTERNATIVY.map((p) => (
              <li key={p.id} className="kf-card !p-3 text-sm">
                <span className="font-semibold" style={{ color: "var(--ink)" }}>
                  {p.name}
                </span>
                {" — "}
                <span style={{ color: "var(--ink)" }}>{p.description}</span>{" "}
                <span className="kf-verify-chip">{FRESHNESS_LABEL[p.freshness]}</span>
                <SpLine show={showSources} sp={p.sp} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="jidlo-heading">
          <h2 id="jidlo-heading" className="kf-sectionhdr">
            🍽️ Jídlo a pití
          </h2>

          <h3 className="mt-3 font-semibold" style={{ color: "var(--ink)" }}>
            Restaurace v Rodě
          </h3>
          <ul className="mt-2 space-y-2">
            {RESTAURACE_RODA.map((r) => (
              <li key={r.id} className="kf-card !p-3 text-sm">
                <span className="font-semibold" style={{ color: "var(--ink)" }}>
                  {r.name}
                </span>
                {" — "}
                <span style={{ color: "var(--ink)" }}>{r.description}</span>{" "}
                <span className="kf-verify-chip">{FRESHNESS_LABEL[r.freshness]}</span>
                {"source" in r && r.source && (
                  <>
                    {" "}
                    <a
                      className="text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      href={r.source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {r.source.label}
                    </a>
                  </>
                )}
                <SpLine show={showSources} sp={r.sp} />
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-semibold" style={{ color: "var(--ink)" }}>
            Co ochutnat
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {WHAT_TO_TRY.map((item) => (
              <li key={item} className="kf-fact">
                {item}
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-semibold" style={{ color: "var(--ink)" }}>
            Zásoby a tipy
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--ink)" }}>
            {ZASOBY_TIPY.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="events-heading">
          <h2 id="events-heading" className="kf-sectionhdr">
            🎉 Události
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Program ověřit aktuálně.
          </p>
          <div className="mt-3 space-y-3">
            {EVENTS.map((ev) => (
              <div key={ev.id} className="kf-card">
                <h3 className="font-semibold" style={{ color: "var(--ink)" }}>
                  {ev.title}
                </h3>
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  {ev.date} · {ev.location}
                </p>
                <p className="mt-1.5 text-sm" style={{ color: "var(--ink)" }}>
                  {ev.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="kf-verify-chip">{FRESHNESS_LABEL[ev.freshness]}</span>
                  {ev.source && (
                    <a
                      className="text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      href={ev.source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {ev.source.label}
                    </a>
                  )}
                </div>
                <SpLine show={showSources} sp={ev.sp} />
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="transport-heading">
          <h2 id="transport-heading" className="kf-sectionhdr">
            🚗 Doprava a půjčovny
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Ceny a dostupnost ověřit aktuálně.
          </p>
          <div className="mt-3 space-y-4">
            {TRANSPORT_OPTIONS.map((opt) => (
              <div key={opt.id} className="kf-card">
                <h3 className="font-semibold" style={{ color: "var(--ink)" }}>
                  {opt.mode}
                </h3>
                <p className="mt-1 text-sm" style={{ color: "var(--ink)" }}>
                  {opt.description}
                </p>
                {opt.facts.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {opt.facts.map((fact) => (
                      <li key={fact.label} className="text-sm">
                        <span className="font-medium" style={{ color: "var(--ink)" }}>
                          {fact.label}:
                        </span>{" "}
                        <span style={{ color: "var(--ink)" }}>{fact.value}</span>{" "}
                        <span className="kf-verify-chip">{FRESHNESS_LABEL[fact.freshness]}</span>{" "}
                        {fact.source && (
                          <a
                            className="text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                            href={fact.source.url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {fact.source.label}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {opt.candidates.length > 0 && (
                  <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    Kandidáti: {opt.candidates.join(", ")}
                  </p>
                )}
                {opt.warnings.length > 0 && (
                  <div className="kf-warn mt-2">
                    <ul className="list-disc pl-4">
                      {opt.warnings.map((w) => (
                        <li key={w}>{stripSp(w)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {opt.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {opt.sources.map((s) => (
                      <a
                        key={s.url}
                        className="text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                        href={s.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                )}
                <SpLine show={showSources} sp={opt.sp} />
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="pocasi-heading">
          <h2 id="pocasi-heading" className="kf-sectionhdr">
            ☀️ Počasí — pravidla
          </h2>
          <div className="kf-card mt-3">
            <p className="text-sm font-semibold" style={{ color: "var(--acc2)" }}>
              Snapshot {POCASI_SNAPSHOT.datum}: {POCASI_SNAPSHOT.text}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--warn)" }}>
              {POCASI_SNAPSHOT.upozorneni}
            </p>
            <SpLine show={showSources} sp={POCASI_SNAPSHOT.sp} />
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm" style={{ color: "var(--ink)" }}>
            {POCASI_PRAVIDLA.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="nouze-heading">
          <h2 id="nouze-heading" className="kf-sectionhdr">
            🚨 Nouzové kontakty
          </h2>
          <ul className="mt-3 space-y-2">
            {EMERGENCY_CONTACTS.map((c) => (
              <li key={c.phone} className="kf-card flex flex-wrap items-center gap-2 !p-3">
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {c.label}
                </span>
                {c.note && (
                  <span className="text-xs" style={{ color: "var(--warn)" }}>
                    {c.note}
                  </span>
                )}
                <div className="ml-auto flex gap-1.5">
                  <a
                    aria-label={`Zavolat na ${c.phone} — ${c.label}`}
                    className="kf-btn !px-2.5 !py-1 !text-xs"
                    href={`tel:${c.phone.replace(/\s/g, "")}`}
                  >
                    Volat {c.phone}
                  </a>
                  <CopyButton phone={c.phone} />
                </div>
                <SpLine show={showSources} sp={c.sp} />
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-semibold" style={{ color: "var(--ink)" }}>
            Peníze, data a zdraví
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--ink)" }}>
            {PENIZE_DATA.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="zdroje-heading">
          <h2 id="zdroje-heading" className="kf-sectionhdr">
            🔗 Zdroje a aktuálnost
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {SOURCES_SECTION.sp}
          </p>

          <h3 className="mt-4 font-semibold" style={{ color: "var(--ink)" }}>
            Autoritativní zdroje
          </h3>
          <ul className="mt-2 space-y-1">
            {SOURCES_SECTION.autoritativni.map((s) => (
              <li key={s.url}>
                <a
                  className="text-sm underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  href={s.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 font-semibold" style={{ color: "var(--ink)" }}>
            Koně a aktivity
          </h3>
          <ul className="mt-2 space-y-1">
            {SOURCES_SECTION.koneAktivity.map((s) => (
              <li key={s.url}>
                <a
                  className="text-sm underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  href={s.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 font-semibold" style={{ color: "var(--ink)" }}>
            Lodě, auta a gastronomie
          </h3>
          <ul className="mt-2 space-y-1">
            {SOURCES_SECTION.lodeAutaGastronomie.map((s) => (
              <li key={s.url}>
                <a
                  className="text-sm underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  href={s.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="korfu2026-root flex min-h-screen flex-col">
      {/* Sea hero — bez osobní fotografie, jen text a fakta o zájezdu */}
      <header className="kf-seahero">
        <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16 sm:px-6">
          <div className="kf-seahero-text">
            <div className="kf-kicker">Katalog možností · Good Inventions</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">
              Korfu 2026
            </h1>
            <p className="kf-tagline mt-1 text-base sm:text-lg">
              Léto na Silver Beach Hotel, Roda 🌊
            </p>
            <p className="kf-sub mt-2 text-sm leading-relaxed sm:text-base">
              Katalog možností, ne hotový plán. Nic tu není přidělené ke
              konkrétnímu dni — skládejte program modulárně podle chuti a
              počasí.
            </p>
            <div className="kf-factrow mt-4">
              <span className="kf-fact">🏨 {TRIP_FACTS.hotel}</span>
              <span className="kf-fact">🍽️ {TRIP_FACTS.strava}</span>
              <span className="kf-fact">🚌 {TRIP_FACTS.transfer}</span>
              <span className="kf-fact">📅 {TRIP_FACTS.termin}</span>
            </div>
          </div>
        </div>
        <svg
          aria-hidden="true"
          className="kf-wave"
          preserveAspectRatio="none"
          viewBox="0 0 1440 64"
        >
          <path d="M0,32 C240,64 480,64 720,40 C960,16 1200,16 1440,40 L1440,64 L0,64 Z" />
        </svg>
      </header>

      {/* Main scrollable content — pb-28 leaves room for footer + bottom nav */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28 sm:px-6">
        {activeTab === "prehled" && renderPrehled()}
        {activeTab === "moznosti" && renderMoznosti()}
        {activeTab === "mapa" && renderMapa()}
        {activeTab === "muj-vyber" && renderMujVyber()}
        {activeTab === "prakticke" && renderPrakticke()}
      </main>

      {/* ── Patička s přepínačem Zdroje, nad spodní navigací ── */}
      <div
        className="fixed right-0 bottom-[52px] left-0 z-20 border-t"
        style={{ borderColor: "var(--line)", background: "var(--bg)" }}
      >
        <div className="kf-footer mx-auto flex max-w-3xl items-center justify-between px-4 py-1.5 sm:px-6">
          <span>Katalog — ne itinerář. Ceny a časy ověřujte u provozovatele.</span>
          <button
            aria-pressed={showSources}
            className="kf-chip !py-1 !text-xs"
            onClick={() => setShowSources((v) => !v)}
            type="button"
          >
            Zdroje{showSources ? " ✓" : ""}
          </button>
        </div>
      </div>

      {/* ── Bottom mobile navigation — fixed at bottom ── */}
      <nav
        aria-label="Hlavní navigace"
        className="fixed right-0 bottom-0 left-0 z-30 border-t"
        style={{ borderColor: "var(--line)", background: "var(--card)" }}
      >
        <ul className="mx-auto flex max-w-3xl" role="list">
          {(
            [
              ["prehled", "Přehled"],
              ["moznosti", "Možnosti"],
              ["mapa", "Mapa"],
              ["muj-vyber", "Můj výběr"],
              ["prakticke", "Praktické"],
            ] as [Tab, string][]
          ).map(([tab, label]) => (
            <li key={tab} className="flex-1">
              <button
                aria-current={activeTab === tab ? "page" : undefined}
                className="flex w-full flex-col items-center justify-center gap-0.5 py-2.5 text-[0.6rem] font-semibold tracking-wide uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700"
                style={{ color: activeTab === tab ? "var(--acc)" : "var(--muted)" }}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {tab === "prehled" && "☰"}
                  {tab === "moznosti" && "⚓"}
                  {tab === "mapa" && "🗺"}
                  {tab === "muj-vyber" &&
                    `★${selectedPlaces.length > 0 ? ` ${selectedPlaces.length}` : ""}`}
                  {tab === "prakticke" && "ℹ"}
                </span>
                <span>{label}</span>
                {activeTab === tab && (
                  <span className="mt-0.5 h-0.5 w-4 rounded-full" style={{ background: "var(--acc)" }} />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

// ─── Local helper (inline SP strip for free-standing warning strings) ─────────

function stripSp(text: string): string {
  return text.replace(/\s*\(SP:[\d–\-, ]+\)\s*$/i, "").trim();
}

// ─── Helper: Kopírovat číslo standalone button ────────────────────────────────

function CopyButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard může být v omezeném režimu prohlížeče nedostupný.
    }
  }

  return (
    <button
      aria-label={`Kopírovat číslo ${phone}`}
      className="kf-btn kf-btn-ghost !px-2.5 !py-1 !text-xs"
      onClick={handleCopy}
      type="button"
    >
      {copied ? "Zkopírováno!" : "Kopírovat číslo"}
    </button>
  );
}

function CopyTemplate({
  template,
  showSources,
}: {
  template: (typeof CONTACT_TEMPLATES)[number];
  showSources: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(template.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard může být v omezeném režimu prohlížeče nedostupný.
    }
  }

  return (
    <article className="kf-card">
      <h3 className="font-semibold" style={{ color: "var(--ink)" }}>
        {template.title}
      </h3>
      <pre
        className="mt-2 overflow-x-auto rounded-lg p-3 text-sm whitespace-pre-wrap"
        style={{ background: "var(--chip)", color: "var(--ink)" }}
      >
        {template.body}
      </pre>
      <div className="mt-3 flex items-center gap-3">
        <button className="kf-btn kf-btn-ghost" onClick={handleCopy} type="button">
          {copied ? "Zkopírováno!" : "Kopírovat zprávu"}
        </button>
        <SpLine show={showSources} sp={template.sp} />
      </div>
    </article>
  );
}
