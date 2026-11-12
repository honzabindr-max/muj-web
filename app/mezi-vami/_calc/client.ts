"use client";

// Prohlížečová část výpočtu: volání API (NDJSON stream skutečných kroků) a výsledek v sessionStorage.
// Osobní údaje ani výsledek se nikam neukládají trvale: sessionStorage zmizí se zavřením karty.

import { useSyncExternalStore } from "react";
import type { Persons } from "../_lib/persons";
import type { assembleDocument } from "./assemble";
import type { AnalysisRevision, StepEvent } from "./types";

export type ResultDoc = ReturnType<typeof assembleDocument>;
export type StoredResult = {
  /** podpis vstupu (jen v prohlížeči): shoda = výsledek lze znovu zobrazit bez nového výpočtu */
  sig: string;
  document: ResultDoc;
  revision: AnalysisRevision;
};

export type Outcome =
  | { kind: "result"; result: StoredResult }
  | { kind: "fail"; text: string; retryAction: string }
  | { kind: "tirr"; text: string; slot: "A" | "B" }
  | { kind: "rate"; retryAfter: number }
  | { kind: "invalid" }
  | { kind: "network" };

const RESULT_KEY = "mv:result:v1";
const CLIENT_TIMEOUT_MS = 115_000;
const listeners = new Set<() => void>();

export const personsSig = (p: Persons) =>
  JSON.stringify([p.a, p.b].map((x) => ({ ...x, placeText: undefined })));

let lastRaw: string | null | undefined;
let lastParsed: StoredResult | null = null;
let memory: StoredResult | null = null;

function readStored(): StoredResult | null {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(RESULT_KEY);
  } catch {
    raw = null;
  }
  if (raw === lastRaw) return lastParsed;
  lastRaw = raw;
  try {
    lastParsed = raw ? (JSON.parse(raw) as StoredResult) : null;
  } catch {
    lastParsed = null;
  }
  return lastParsed;
}

export function storeResult(r: StoredResult) {
  try {
    window.sessionStorage.setItem(RESULT_KEY, JSON.stringify(r));
  } catch {
    memory = r;
  }
  listeners.forEach((l) => l());
}

export function clearResult() {
  memory = null;
  try {
    window.sessionStorage.removeItem(RESULT_KEY);
  } catch {
    /* nic */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === RESULT_KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const PENDING = Symbol("pending");
/** PENDING na serveru a při hydrataci; pak uložený výsledek nebo null. */
export function useStoredResult(): StoredResult | null | typeof PENDING {
  return useSyncExternalStore<StoredResult | null | typeof PENDING>(
    subscribe,
    readStored,
    () => PENDING,
  );
}
export const isPending = (v: unknown): v is typeof PENDING => v === PENDING;

let inflight: { sig: string; promise: Promise<Outcome> } | null = null;

/** Spustí výpočet; souběžné volání se stejným vstupem sdílí jeden běh (ochrana proti dvojímu spuštění). */
export function runCalculation(
  persons: Persons,
  onStep: (e: StepEvent) => void,
): Promise<Outcome> {
  const sig = personsSig(persons);
  if (inflight && inflight.sig === sig) return inflight.promise;
  const promise = doRun(persons, sig, onStep).finally(() => {
    inflight = null;
  });
  inflight = { sig, promise };
  return promise;
}

async function doRun(
  persons: Persons,
  sig: string,
  onStep: (e: StepEvent) => void,
): Promise<Outcome> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch("/api/mezi-vami/vypocet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ persons }),
      signal: ctrl.signal,
    });
    if (res.status === 429) {
      const b = (await res.json().catch(() => ({}))) as {
        retry_after_s?: number;
      };
      return { kind: "rate", retryAfter: b.retry_after_s ?? 30 };
    }
    if (res.status === 400) return { kind: "invalid" };
    if (!res.ok || !res.body) return { kind: "network" };

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let outcome: Outcome | null = null;
    const handle = (line: string) => {
      if (!line.trim()) return;
      const ev = JSON.parse(line);
      if (ev.type === "step") onStep(ev as StepEvent);
      else if (ev.type === "result") {
        const result: StoredResult = {
          sig,
          document: ev.document,
          revision: ev.revision,
        };
        storeResult(result);
        outcome = { kind: "result", result };
      } else if (ev.type === "error") {
        if (ev.code === "TIRR")
          outcome = {
            kind: "tirr",
            text: ev.view.view.customer_text,
            slot: ev.view.view.slot,
          };
        else if (ev.code === "FAIL")
          outcome = {
            kind: "fail",
            text: ev.view.view.failure.customer_text,
            retryAction: ev.view.view.failure.retry_action,
          };
        else outcome = { kind: "invalid" };
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    }
    handle(buf);
    return outcome ?? { kind: "network" };
  } catch {
    return { kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}
