"use client";

import { useEffect, useSyncExternalStore } from "react";
import { defaultPersons, type Person, type Persons } from "./persons";

// Rozpracované údaje obou osob: paměť modulu + sessionStorage prohlížeče (kontrakt: raw draft
// jen v sessionStorage, 2 h nečinnosti / 12 h absolutně). Přežijí obnovení stránky i přímý
// vstup na /objednavka; zavřením karty zmizí. Žádné localStorage ani cookies.
// Na server jdou jen údaje pro výpočet (bez oslovení/jména), viz _lib/engine-client.ts.

const KEY = "mv:draft:v1";
const IDLE_MS = 2 * 60 * 60 * 1000;
const ABS_MS = 12 * 60 * 60 * 1000;

type Saved = { created: number; touched: number; data: Persons };

const listeners = new Set<() => void>();
const SERVER = defaultPersons();

let memory: Persons | null = null;
let loaded = false;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function load(): void {
  if (loaded) return;
  loaded = true;
  const s = storage();
  if (!s) return;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Saved;
    const now = Date.now();
    if (now - saved.touched > IDLE_MS || now - saved.created > ABS_MS) {
      s.removeItem(KEY);
      return;
    }
    memory = saved.data;
  } catch {
    /* poškozený záznam: ignorovat */
  }
}

function read(): Persons | null {
  if (typeof window !== "undefined") load();
  return memory;
}

function persist(next: Persons) {
  const s = storage();
  if (!s) return;
  try {
    const raw = s.getItem(KEY);
    const created = raw ? (JSON.parse(raw) as Saved).created : Date.now();
    s.setItem(KEY, JSON.stringify({ created, touched: Date.now(), data: next }));
  } catch {
    /* plné / zakázané úložiště: zůstane jen paměť */
  }
}

function write(next: Persons) {
  memory = next;
  persist(next);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Zadané údaje, nebo null (nic nezadáno / server). */
export function useStoredPersons(): Persons | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Údaje pro formulář: zadané, jinak výchozí. */
export function usePersons(): Persons {
  return useStoredPersons() ?? SERVER;
}

/** Aktuální údaje mimo React (výpočet). */
export function getPersons(): Persons | null {
  return read();
}

export function updatePersons(fn: (p: Persons) => Persons) {
  write(fn(read() ?? defaultPersons()));
}

export function updatePerson(which: "a" | "b", patch: Partial<Person>) {
  updatePersons((s) => ({ ...s, [which]: { ...s[which], ...patch } }));
}

export function setStep(step: "A" | "B") {
  if ((read()?.step ?? "A") === step) return;
  updatePersons((s) => ({ ...s, step }));
}

/* ---------- krok A/B v historii prohlížeče ---------- */
// Přechod na druhou osobu přidá záznam do historie (history.state.mvStep = "B"), takže tlačítko
// Zpět vrátí na první osobu. Vstup na stránku zvenku (odkazy „Upravit údaje…“) bez značky = krok A.

type HistState = { mvStep?: "A" | "B" } | null;
const histStep = (): "A" | "B" =>
  (window.history.state as HistState)?.mvStep === "B" ? "B" : "A";

/** Přejde na krok; „B“ přidá záznam do historie, „A“ z kroku B jde o krok zpět. */
export function goStep(step: "A" | "B") {
  if (step === "B") {
    window.history.pushState({ ...(window.history.state ?? {}), mvStep: "B" }, "");
    setStep("B");
  } else if (histStep() === "B") {
    window.history.back(); // krok srovná popstate (viz useStepHistory)
  } else {
    setStep("A");
  }
}

/** Srovná krok formuláře s historií: při vstupu a při Zpět/Vpřed. */
export function useStepHistory() {
  useEffect(() => {
    setStep(histStep());
    const sync = () => setStep(histStep());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
}

/* ---------- výsledek: oslovení a skloňování jen v prohlížeči ---------- */
// Server ukládá texty s místy pro jména ({A:1}…{B:7}); jména a jejich tvary zná jen tento prohlížeč.

export type { NameForms } from "./names";
import type { NameForms } from "./names";
const RKEY = (id: string) => `mv:names:${id}`;

export function saveNames(id: string, forms: NameForms) {
  const s = storage();
  try {
    s?.setItem(RKEY(id), JSON.stringify(forms));
  } catch {
    /* ignorovat */
  }
}

export function loadNames(id: string): NameForms | null {
  const s = storage();
  try {
    const raw = s?.getItem(RKEY(id));
    return raw ? (JSON.parse(raw) as NameForms) : null;
  } catch {
    return null;
  }
}

/** Poslední dokončený výpočet (pro odkazy z objednávky a „Upravit údaje“). */
export function setLastResult(id: string) {
  try {
    storage()?.setItem("mv:last", id);
  } catch {
    /* ignorovat */
  }
}
export function getLastResult(): string | null {
  try {
    return storage()?.getItem("mv:last") ?? null;
  } catch {
    return null;
  }
}
