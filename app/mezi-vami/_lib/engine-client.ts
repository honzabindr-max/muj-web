"use client";

// Volání výpočtu z prohlížeče. Na server jdou jen údaje nutné pro výpočet (datum, obec, čas
// a jeho přesnost, gramatický rod). Oslovení jde jen do skloňování (neukládá se) — viz API.

import type { Person, Persons } from "./persons";
import { saveNames, setLastResult, type NameForms } from "./persons-store";

const toIso = (p: Person) => `${p.rok}-${p.mesic.padStart(2, "0")}-${p.den.padStart(2, "0")}`;

function timeOf(p: Person) {
  if (p.mode === "exact") return { mode: "exact", cas: p.cas };
  if (p.mode === "approx") {
    if (p.approx === "part") return { mode: "part", part: p.part };
    return { mode: "approx", cas: p.cas, plusMinusMin: Number(p.approx) };
  }
  return { mode: "unknown" };
}

export function toCalcInput(s: Persons) {
  const one = (p: Person) => ({
    datum: toIso(p),
    misto: { name: p.place!.name, okres: p.place!.okres, cc: p.place!.cc },
    cas: timeOf(p),
    styl: p.styl,
  });
  return { a: one(s.a), b: one(s.b) };
}

export class ComputeError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function post(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ComputeError(String(json.error ?? `http_${res.status}`));
  return json;
}

export type Stage = "calc" | "text" | "done";

/** Celý běh: výpočet → texty (+ skloňování oslovení souběžně). Vrací id výsledku. */
export async function runDna(s: Persons, onStage: (st: Stage) => void): Promise<string> {
  onStage("calc");
  const { id } = (await post("/api/mezi-vami/vypocet", toCalcInput(s))) as { id: string };
  onStage("text");
  const nickA = s.a.nick.trim();
  const nickB = s.b.nick.trim();
  const names =
    nickA || nickB
      ? post("/api/mezi-vami/jmena", {
          a: { nick: nickA, styl: s.a.styl },
          b: { nick: nickB, styl: s.b.styl },
        }).catch(() => null)
      : Promise.resolve(null);
  const [, forms] = await Promise.all([post("/api/mezi-vami/text", { id }), names]);
  const f = forms as NameForms | null;
  saveNames(id, {
    a: nickA && f?.a?.length === 7 ? f.a : [],
    b: nickB && f?.b?.length === 7 ? f.b : [],
  });
  setLastResult(id);
  onStage("done");
  return id;
}

/** Dopsání textů k existujícímu výpočtu (např. po výpadku pisatele). */
export async function ensureText(id: string): Promise<void> {
  await post("/api/mezi-vami/text", { id });
}
