"use client";

// Data stránky V (výsledek). Bez kontextu = ukázka z fixtures (/vysledek, /vzorek). Se skutečným
// výpočtem (/vysledek/[id]) přichází DnaView ze serveru: texty mají místo jmen značky {A1}…{B7},
// které se tady nahradí oslovením z tohoto prohlížeče (sessionStorage), jinak „první/druhá osoba“.

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { FIXTURE_VIEW, type DnaView } from "./view-data";
export { FIXTURE_VIEW, type DnaView } from "./view-data";
import { loadNames, type NameForms } from "../_lib/persons-store";

export { FALLBACK_FORMS, fillNames } from "../_lib/names";
import { FALLBACK_FORMS, fillNames } from "../_lib/names";

function deepFill<T>(value: T, forms: NameForms): T {
  if (typeof value === "string") return fillNames(value, forms) as T;
  if (Array.isArray(value)) return value.map((v) => deepFill(v, forms)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepFill(v, forms)])) as T;
  return value;
}

const Ctx = createContext<DnaView>(FIXTURE_VIEW);

const noop = () => () => {};

export function DnaViewProvider({ view, children }: { view: DnaView; children: ReactNode }) {
  const id = view.id;
  const raw = useSyncExternalStore(
    noop,
    () => (id ? JSON.stringify(loadNames(id)) : "null"),
    () => "null",
  );
  const resolved = useMemo(() => {
    const names = JSON.parse(raw) as NameForms | null;
    const forms: NameForms = {
      a: names?.a?.length === 7 ? names.a : FALLBACK_FORMS.a,
      b: names?.b?.length === 7 ? names.b : FALLBACK_FORMS.b,
    };
    return deepFill(view, forms);
  }, [view, raw]);
  return <Ctx.Provider value={resolved}>{children}</Ctx.Provider>;
}

export function useDna(): DnaView {
  return useContext(Ctx);
}
