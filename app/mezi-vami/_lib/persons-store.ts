"use client";

import { useSyncExternalStore } from "react";
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
  updatePersons((s) => ({ ...s, step }));
}
