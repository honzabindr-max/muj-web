"use client";

import { useEffect, useSyncExternalStore } from "react";
import { defaultPersons, type Person, type Persons } from "./persons";

// Údaje obou osob jen v paměti klienta (modul): přežijí přechody mezi kroky toku
// (klientská navigace), po obnovení stránky nebo zavření karty zmizí.
// Žádné sessionStorage/localStorage/cookies, nic se neposílá na server (hranice prototypu,
// hlídá ji _lib/boundaries.test.ts).

const listeners = new Set<() => void>();
const SERVER = defaultPersons();

let memory: Persons | null = null;

function read(): Persons | null {
  return memory;
}

function write(next: Persons) {
  memory = next;
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
    window.history.pushState({ mvStep: "B" }, "");
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
