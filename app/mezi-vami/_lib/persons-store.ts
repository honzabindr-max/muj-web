"use client";

import { useSyncExternalStore } from "react";
import { defaultPersons, type Person, type Persons } from "./persons";

// Údaje obou osob v sessionStorage: přežijí návrat zpět i refresh, po zavření karty zmizí.
// Prototyp: nic se neposílá na server.

const KEY = "mv:persons:v1";
const listeners = new Set<() => void>();
const SERVER = defaultPersons();

let lastRaw: string | null | undefined;
let lastParsed: Persons | null = null;

let memory: Persons | null = null;

function read(): Persons | null {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === lastRaw) return lastParsed;
  lastRaw = raw;
  try {
    const p = raw ? (JSON.parse(raw) as Persons) : null;
    lastParsed = p && p.a && p.b ? p : null;
  } catch {
    lastParsed = null;
  }
  return lastParsed;
}

function write(next: Persons) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // úložiště nedostupné (privátní režim) — stav zůstane jen v paměti stránky
    memory = next;
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Uložené údaje, nebo null (nic nezadáno / server). */
export function useStoredPersons(): Persons | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Jednorázové přečtení (mimo render), jen v prohlížeči. */
export function getStoredPersons(): Persons | null {
  return read();
}

/** Údaje pro formulář: uložené, jinak výchozí. */
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
