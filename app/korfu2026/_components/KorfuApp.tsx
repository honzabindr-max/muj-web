"use client";

import { useState, useEffect, useCallback } from "react";
import { PLACES } from "../_data/places";
import { COMBOS } from "../_data/combos";
import {
  HORSE_OPERATORS,
  HORSE_LEADS,
  BOAT_OPERATORS,
  DIVING_OPERATORS,
  QUAD_OPERATORS,
  CHECKLISTS,
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
} from "../_data/types";
import type {
  Category,
  Area,
  Difficulty,
  TransportMode,
  WeatherFit,
  Tier,
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

const TAB_LABELS: Record<Tab, string> = {
  prehled: "Přehled",
  moznosti: "Možnosti",
  mapa: "Mapa",
  "muj-vyber": "Můj výběr",
  prakticke: "Praktické",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadSelection(): Set<string> {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
    return new Set();
  } catch {
    return new Set();
  }
}

function saveSelection(ids: Set<string>): void {
  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage nedostupné — tiché selhání
  }
}

// ─── Filter selects ───────────────────────────────────────────────────────────

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

// ─── FilterBar ────────────────────────────────────────────────────────────────

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
      <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </label>
      <select
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
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

// ─── Main component ───────────────────────────────────────────────────────────

export function KorfuApp() {
  const [activeTab, setActiveTab] = useState<Tab>("prehled");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Load selection from localStorage on mount
  useEffect(() => {
    setSelectedIds(loadSelection());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveSelection(next);
      return next;
    });
  }, []);

  // Filtered places
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

  const hasActiveFilters = Object.values(filters).some((v) => v !== null);
  const selectedPlaces = PLACES.filter((p) => selectedIds.has(p.id));

  // ── Přehled tab ────────────────────────────────────────────────────────────
  function renderPrehled() {
    return (
      <div className="space-y-4">
        {/* Trip summary from TRIP_FACTS (parts O) */}
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
          <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">
            {TRIP_FACTS.termin}
          </p>
          <p className="text-sm text-teal-900">{TRIP_FACTS.hotel}</p>
          <p className="mt-1 text-xs text-teal-700">
            {TRIP_FACTS.strava} · {TRIP_FACTS.transfer}
          </p>
          <p className="mt-1 text-xs text-teal-700">
            Let tam: {TRIP_FACTS.letTam}
          </p>
          <p className="text-xs text-teal-700">
            Let zpět: {TRIP_FACTS.letZpet}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {TRIP_FACTS.praktickyDopad}
          </p>
          <p className="text-xs text-slate-500">{TRIP_FACTS.sp}</p>
        </div>

        {/* Filters toggle */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Zobrazeno {filteredPlaces.length} z {PLACES.length} míst
              {hasActiveFilters && (
                <button
                  className="ml-2 text-teal-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  type="button"
                >
                  Zrušit filtry
                </button>
              )}
            </p>
            <button
              aria-expanded={filtersOpen}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              onClick={() => setFiltersOpen((v) => !v)}
              type="button"
            >
              {filtersOpen ? "Skrýt filtry" : "Filtry"}
              {hasActiveFilters && " ●"}
            </button>
          </div>

          {filtersOpen && (
            <div
              aria-label="Filtry katalogu"
              className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3"
              role="group"
            >
              {/* Kategorie */}
              <SelectFilter
                label="Kategorie"
                labelMap={CATEGORY_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
                options={UNIQUE_CATEGORIES}
                value={filters.category}
              />
              {/* Oblast */}
              <SelectFilter
                label="Oblast"
                labelMap={AREA_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, area: v }))}
                options={UNIQUE_AREAS}
                value={filters.area}
              />
              {/* Priorita */}
              <SelectFilter
                label="Priorita"
                labelMap={TIER_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
                options={TIERS}
                value={filters.priority}
              />
              {/* Náročnost */}
              <SelectFilter
                label="Náročnost"
                labelMap={DIFFICULTY_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, difficulty: v }))}
                options={UNIQUE_DIFFICULTIES}
                value={filters.difficulty}
              />
              {/* Doprava */}
              <SelectFilter
                label="Doprava"
                labelMap={TRANSPORT_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, transport: v }))}
                options={UNIQUE_TRANSPORTS}
                value={filters.transport}
              />
              {/* Počasí */}
              <SelectFilter
                label="Počasí"
                labelMap={WEATHER_LABEL}
                onChange={(v) => setFilters((f) => ({ ...f, weather: v }))}
                options={UNIQUE_WEATHERS}
                value={filters.weather}
              />
            </div>
          )}
        </div>

        {/* Place cards */}
        {filteredPlaces.length === 0 ? (
          <p className="py-10 text-center text-slate-500">
            Žádné výsledky. Zkuste změnit nebo zrušit filtry.
          </p>
        ) : (
          <div className="space-y-4">
            {filteredPlaces.map((place) => (
              <PlaceCard
                key={place.id}
                isSelected={selectedIds.has(place.id)}
                onToggleSelect={toggleSelect}
                place={place}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Možnosti tab — parts E, F, G, H ────────────────────────────────────────
  function renderMoznosti() {
    return (
      <div className="space-y-8">
        {/* Geografické balíčky (část E, combos) */}
        <section aria-labelledby="combos-heading">
          <h2 id="combos-heading" className="text-lg font-bold text-slate-900">
            Geografické balíčky
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Co lze přirozeně spojit (SP:113–127). Nejde o dny — jen geografická
            blízkost.
          </p>
          <ul className="mt-3 space-y-2">
            {COMBOS.map((combo) => (
              <li
                key={combo.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <span className="text-xs font-bold text-teal-700">
                  {combo.id}
                </span>
                <p className="mt-0.5 text-sm text-slate-800">{combo.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{combo.sp}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Koně — první volby (část F) */}
        <section aria-labelledby="horses-heading">
          <h2 id="horses-heading" className="text-lg font-bold text-slate-900">
            Jízda na koni
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            SP:129–179. Ceny a termíny ověřit aktuálně.
          </p>
          <div className="mt-3 space-y-4">
            {[...HORSE_OPERATORS, ...HORSE_LEADS].map((op) => (
              <OperatorCard key={op.id} op={op} />
            ))}
          </div>
        </section>

        {/* Lodě (část G) */}
        <section aria-labelledby="boats-heading">
          <h2 id="boats-heading" className="text-lg font-bold text-slate-900">
            Lodě a mořské možnosti
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            SP:181–229. Ceny, termíny a počasí ověřit aktuálně.
          </p>
          <div className="mt-3 space-y-4">
            {BOAT_OPERATORS.map((op) => (
              <OperatorCard key={op.id} op={op} />
            ))}
          </div>
        </section>

        {/* Potápění (část H) */}
        <section aria-labelledby="diving-heading">
          <h2 id="diving-heading" className="text-lg font-bold text-slate-900">
            Potápění
          </h2>
          <p className="mt-1 text-sm text-slate-500">SP:231–290.</p>
          <div className="mt-3 space-y-4">
            {DIVING_OPERATORS.map((op) => (
              <OperatorCard key={op.id} op={op} />
            ))}
          </div>
        </section>

        {/* Quad (část H) */}
        <section aria-labelledby="quad-heading">
          <h2 id="quad-heading" className="text-lg font-bold text-slate-900">
            Quad a terénní aktivity
          </h2>
          <p className="mt-1 text-sm text-slate-500">SP:231–290.</p>
          <div className="mt-3 space-y-4">
            {QUAD_OPERATORS.map((op) => (
              <OperatorCard key={op.id} op={op} />
            ))}
          </div>
        </section>

        {/* Kontaktní šablony (část F) */}
        {CHECKLISTS.length > 0 && (
          <section aria-labelledby="checklists-heading">
            <h2
              id="checklists-heading"
              className="text-lg font-bold text-slate-900"
            >
              Checklisty
            </h2>
            <div className="mt-3 space-y-4">
              {CHECKLISTS.map((cl) => (
                <div
                  key={cl.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <h3 className="font-semibold text-slate-900">{cl.title}</h3>
                  <ul className="mt-2 list-disc pl-4 text-sm text-slate-800">
                    {cl.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-slate-400">{cl.sp}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ── Mapa tab — empty container for next round ───────────────────────────────
  function renderMapa() {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div
          aria-label="Kontejner pro mapu — bude doplněn v příštím kole"
          className="flex h-48 w-full max-w-lg flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50"
          id="mapa-placeholder"
          role="region"
        >
          <p className="font-medium text-slate-500">Mapa</p>
          <p className="mt-1 text-sm text-slate-400">
            Interaktivní mapa s OpenStreetMap dlaždicemi a filtry.
          </p>
          <p className="mt-1 text-xs text-slate-400">Leaflet · příští kolo.</p>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Zatím použijte tlačítka <strong>Navigovat</strong> na kartách v
          Přehledu.
        </p>
      </div>
    );
  }

  // ── Můj výběr tab ───────────────────────────────────────────────────────────
  function renderMujVyber() {
    if (selectedPlaces.length === 0) {
      return (
        <div className="py-16 text-center">
          <p className="text-slate-500">Zatím žádný výběr.</p>
          <p className="mt-2 text-sm text-slate-400">
            Na kartách v Přehledu klikněte na <strong>☆ Výběr</strong> a místo
            se sem přidá.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Výběr je uložený v prohlížeči ({SELECTION_KEY}).
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {selectedPlaces.length}{" "}
            {selectedPlaces.length === 1
              ? "místo"
              : selectedPlaces.length < 5
                ? "místa"
                : "míst"}{" "}
            ve výběru
          </p>
          <button
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            onClick={() => {
              try {
                localStorage.removeItem(SELECTION_KEY);
              } catch {
                // localStorage nedostupné
              }
              setSelectedIds(new Set());
            }}
            type="button"
          >
            Vymazat výběr
          </button>
        </div>
        {selectedPlaces.map((place) => (
          <PlaceCard
            key={place.id}
            isSelected={true}
            onToggleSelect={toggleSelect}
            place={place}
          />
        ))}
      </div>
    );
  }

  // ── Praktické tab — parts I, J, K, L, M, N, O, R, S ───────────────────────
  function renderPrakticke() {
    return (
      <div className="space-y-8">
        {/* Locked fakta o zájezdu (část O) */}
        <section aria-labelledby="trip-heading">
          <h2 id="trip-heading" className="text-lg font-bold text-slate-900">
            Fakta o zájezdu
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">{TRIP_FACTS.sp}</p>
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
                <dt className="w-36 shrink-0 font-semibold text-slate-600">
                  {k}:
                </dt>
                <dd className="text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {TRIP_FACTS.praktickyDopad}
          </div>
        </section>

        {/* Roda jako základna (část I) */}
        <section aria-labelledby="roda-heading">
          <h2 id="roda-heading" className="text-lg font-bold text-slate-900">
            Roda — co dělat ze základny
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            SP:293–300. Aktivity dostupné bez přesunu.
          </p>
          <ul className="mt-3 space-y-2">
            {RODA_PRAKTIKA.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
              >
                <span className="font-semibold text-slate-900">
                  {item.label}
                </span>
                {item.freshness && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    {FRESHNESS_LABEL[item.freshness]}
                  </span>
                )}
                {item.verify && (
                  <p className="mt-0.5 text-xs text-slate-500">{item.verify}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-400">{item.sp}</p>
              </li>
            ))}
          </ul>

          {/* Večerní podniky v Rodě (část I) */}
          <h3 className="mt-5 font-semibold text-slate-900">
            Večerní podniky v Rodě
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">SP:301–306</p>
          <ul className="mt-2 space-y-2">
            {VECERNI_PODNIKY.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
              >
                <span className="font-semibold text-slate-900">{p.name}</span>
                {" — "}
                <span className="text-slate-700">{p.description}</span>{" "}
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                  {FRESHNESS_LABEL[p.freshness]}
                </span>
                <p className="mt-0.5 text-xs text-slate-400">{p.sp}</p>
              </li>
            ))}
          </ul>

          {/* Večerní alternativy mimo Rodu (část I) */}
          <h3 className="mt-5 font-semibold text-slate-900">
            Večerní alternativy mimo Rodu
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">SP:307–308</p>
          <ul className="mt-2 space-y-2">
            {VECERNI_ALTERNATIVY.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
              >
                <span className="font-semibold text-slate-900">{p.name}</span>
                {" — "}
                <span className="text-slate-700">{p.description}</span>{" "}
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                  {FRESHNESS_LABEL[p.freshness]}
                </span>
                <p className="mt-0.5 text-xs text-slate-400">{p.sp}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Jídlo a pití (část J) */}
        <section aria-labelledby="jidlo-heading">
          <h2 id="jidlo-heading" className="text-lg font-bold text-slate-900">
            Jídlo a pití
          </h2>

          <h3 className="mt-3 font-semibold text-slate-900">
            Restaurace v Rodě
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">SP:313–321</p>
          <ul className="mt-2 space-y-2">
            {RESTAURACE_RODA.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
              >
                <span className="font-semibold text-slate-900">{r.name}</span>
                {" — "}
                <span className="text-slate-700">{r.description}</span>{" "}
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                  {FRESHNESS_LABEL[r.freshness]}
                </span>
                {"source" in r && r.source && (
                  <>
                    {" "}
                    <a
                      className="text-xs text-teal-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      href={r.source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {r.source.label}
                    </a>
                  </>
                )}
                <p className="mt-0.5 text-xs text-slate-400">{r.sp}</p>
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-semibold text-slate-900">Co ochutnat</h3>
          <p className="mt-0.5 text-xs text-slate-400">SP:317–318</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {WHAT_TO_TRY.map((item) => (
              <li
                key={item}
                className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm text-teal-900"
              >
                {item}
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-semibold text-slate-900">Zásoby a tipy</h3>
          <p className="mt-0.5 text-xs text-slate-400">SP:320–321</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {ZASOBY_TIPY.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        {/* Události (část K) */}
        <section aria-labelledby="events-heading">
          <h2 id="events-heading" className="text-lg font-bold text-slate-900">
            Události
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            SP:323–330. Program ověřit aktuálně.
          </p>
          <div className="mt-3 space-y-3">
            {EVENTS.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="font-semibold text-slate-900">{ev.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {ev.date} · {ev.location}
                </p>
                <p className="mt-1.5 text-sm text-slate-800">
                  {ev.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    {FRESHNESS_LABEL[ev.freshness]}
                  </span>
                  {ev.source && (
                    <a
                      className="text-xs text-teal-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      href={ev.source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {ev.source.label}
                    </a>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">{ev.sp}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Doprava (část L) */}
        <section aria-labelledby="transport-heading">
          <h2
            id="transport-heading"
            className="text-lg font-bold text-slate-900"
          >
            Doprava a půjčovny
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            SP:332–346. Ceny a dostupnost ověřit aktuálně.
          </p>
          <div className="mt-3 space-y-4">
            {TRANSPORT_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="font-semibold text-slate-900">{opt.mode}</h3>
                <p className="mt-1 text-sm text-slate-800">{opt.description}</p>
                {opt.facts.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {opt.facts.map((fact) => (
                      <li key={fact.label} className="text-sm">
                        <span className="font-medium text-slate-700">
                          {fact.label}:
                        </span>{" "}
                        {fact.source ? (
                          <>
                            <span className="text-slate-700">{fact.value}</span>{" "}
                            <span className="rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-800">
                              {FRESHNESS_LABEL[fact.freshness]}
                            </span>{" "}
                            <a
                              className="text-xs text-teal-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                              href={fact.source.url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {fact.source.label}
                            </a>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-500 italic">
                              {fact.value}
                            </span>{" "}
                            <span className="rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-800">
                              {FRESHNESS_LABEL[fact.freshness]}
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {opt.candidates.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Kandidáti: {opt.candidates.join(", ")}
                  </p>
                )}
                {opt.warnings.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-amber-800">
                    {opt.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                {opt.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {opt.sources.map((s) => (
                      <a
                        key={s.url}
                        className="text-xs text-teal-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                        href={s.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-400">{opt.sp}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Počasí (část M) */}
        <section aria-labelledby="pocasi-heading">
          <h2 id="pocasi-heading" className="text-lg font-bold text-slate-900">
            Počasí — pravidla
          </h2>
          <p className="mt-1 text-sm text-slate-500">SP:348–355.</p>
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-900">
              Snapshot {POCASI_SNAPSHOT.datum}: {POCASI_SNAPSHOT.text}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              {POCASI_SNAPSHOT.upozorneni}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {POCASI_SNAPSHOT.sp}
            </p>
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-800">
            {POCASI_PRAVIDLA.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        {/* Zdraví, nouze a peníze (část N) */}
        <section aria-labelledby="nouze-heading">
          <h2 id="nouze-heading" className="text-lg font-bold text-slate-900">
            Nouzové kontakty
          </h2>
          <p className="mt-1 text-sm text-slate-500">SP:357–374.</p>
          <ul className="mt-3 space-y-2">
            {EMERGENCY_CONTACTS.map((c) => (
              <li
                key={c.phone}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <span className="text-sm font-semibold text-slate-900">
                  {c.label}
                </span>
                {c.note && (
                  <span className="text-xs text-amber-700">{c.note}</span>
                )}
                <div className="ml-auto flex gap-1.5">
                  {/* Volat */}
                  <a
                    aria-label={`Zavolat na ${c.phone} — ${c.label}`}
                    className="inline-flex items-center rounded-lg bg-teal-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    href={`tel:${c.phone.replace(/\s/g, "")}`}
                  >
                    Volat {c.phone}
                  </a>
                  <CopyButton phone={c.phone} />
                </div>
                <p className="w-full text-xs text-slate-400">{c.sp}</p>
              </li>
            ))}
          </ul>

          <h3 className="mt-5 font-semibold text-slate-900">
            Peníze, data a zdraví
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">SP:371–374</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {PENIZE_DATA.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        {/* Zdroje (část R) */}
        <section aria-labelledby="zdroje-heading">
          <h2 id="zdroje-heading" className="text-lg font-bold text-slate-900">
            Zdroje a aktuálnost
          </h2>
          <p className="mt-1 text-sm text-slate-500">{SOURCES_SECTION.sp}</p>

          <h3 className="mt-4 font-semibold text-slate-800">
            Autoritativní zdroje
          </h3>
          <ul className="mt-2 space-y-1">
            {SOURCES_SECTION.autoritativni.map((s) => (
              <li key={s.url}>
                <a
                  className="text-sm text-teal-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  href={s.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 font-semibold text-slate-800">Koně a aktivity</h3>
          <ul className="mt-2 space-y-1">
            {SOURCES_SECTION.koneAktivity.map((s) => (
              <li key={s.url}>
                <a
                  className="text-sm text-teal-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  href={s.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 font-semibold text-slate-800">
            Lodě, auta a gastronomie
          </h3>
          <ul className="mt-2 space-y-1">
            {SOURCES_SECTION.lodeAutaGastronomie.map((s) => (
              <li key={s.url}>
                <a
                  className="text-sm text-teal-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
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

        {/* Footer note */}
        <div className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
          <p>
            Dynamické údaje (ceny, otevírací doby, sezonní provoz) jsou označeny
            štítkem
            <span className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
              {FRESHNESS_LABEL["overit-aktualne"]}
            </span>
            — před použitím je ověřte u provozovatele. Zdroj pravidla: SP:28–30,
            SP:407.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Main scrollable content — pb-20 leaves room for bottom nav */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-24 sm:px-6">
        {/* Page header */}
        <header className="mb-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-teal-800 uppercase">
            {TRIP_FACTS.termin} · {TRIP_FACTS.hotel.split(",")[1]?.trim()}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Korfu 2026
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Katalog možností, ne hotový plán. Nic tu není přidělené ke
            konkrétnímu dni.
          </p>
        </header>

        {/* Tab content */}
        {activeTab === "prehled" && renderPrehled()}
        {activeTab === "moznosti" && renderMoznosti()}
        {activeTab === "mapa" && renderMapa()}
        {activeTab === "muj-vyber" && renderMujVyber()}
        {activeTab === "prakticke" && renderPrakticke()}
      </main>

      {/* ── Bottom mobile navigation — fixed at bottom ── */}
      <nav
        aria-label="Hlavní navigace"
        className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
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
                className={`flex w-full flex-col items-center justify-center gap-0.5 py-2.5 text-[0.6rem] font-semibold tracking-wide uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700 ${
                  activeTab === tab
                    ? "text-teal-800"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {tab === "prehled" && "☰"}
                  {tab === "moznosti" && "⚓"}
                  {tab === "mapa" && "🗺"}
                  {tab === "muj-vyber" &&
                    `★${selectedIds.size > 0 ? ` ${selectedIds.size}` : ""}`}
                  {tab === "prakticke" && "ℹ"}
                </span>
                <span>{label}</span>
                {activeTab === tab && (
                  <span className="mt-0.5 h-0.5 w-4 rounded-full bg-teal-700" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

// ─── Helper: Kopírovat číslo standalone button ────────────────────────────────

function CopyButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <button
      aria-label={`Kopírovat číslo ${phone}`}
      className="inline-flex items-center rounded-lg border border-teal-700 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      onClick={handleCopy}
      type="button"
    >
      {copied ? "Zkopírováno!" : "Kopírovat číslo"}
    </button>
  );
}
