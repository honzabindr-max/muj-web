"use client";

// INTERNAL MODEL TOGGLE (Claude/Codex text comparison). Temporary: see "How to remove" in docs/astroroast/SPEC.md.
// Provides the active text model to client components and owns the `.ar` root element (data-model attribute).
// With MODEL_TOGGLE_ENABLED = false the model is always "claude" and nothing is persisted or read.

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { COPY, MODEL_TOGGLE_ENABLED, type UiCopy } from "@/astroroast/copy";
import { DEFAULT_MODEL, MODEL_IDS, type ModelId } from "@/astroroast/types";

const STORAGE_KEY = "ar-model";

function isModel(v: unknown): v is ModelId {
  return typeof v === "string" && (MODEL_IDS as readonly string[]).includes(v);
}

function persist(m: ModelId) {
  try {
    window.localStorage.setItem(STORAGE_KEY, m);
  } catch {
    // soukromý režim / zablokované úložiště: přepínač funguje dál jen v paměti
  }
}

/** ?m=claude|codex vyhrává, potom uložená volba, jinak výchozí. */
function readInitial(): ModelId {
  try {
    const q = new URLSearchParams(window.location.search).get("m");
    if (isModel(q)) {
      persist(q);
      return q;
    }
  } catch {
    // ignorováno
  }
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (isModel(v)) return v;
  } catch {
    // ignorováno
  }
  return DEFAULT_MODEL;
}

// Malé externí úložiště: server i první klientský render = "claude", po hydrataci se čte skutečná volba.
let current: ModelId | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("popstate", syncFromUrl);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("popstate", syncFromUrl);
  };
}
function getSnapshot(): ModelId {
  if (current === null) current = readInitial();
  return current;
}
function getServerSnapshot(): ModelId {
  return DEFAULT_MODEL;
}
function setStored(m: ModelId) {
  if (m === current) return;
  current = m;
  persist(m);
  listeners.forEach((l) => l());
}

/** ?m= v aktuální URL má přednost i po klientské navigaci (Zpět, odkaz s ?m=). */
function syncFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search).get("m");
    if (isModel(q)) setStored(q);
  } catch {
    // ignorováno
  }
}

interface ModelContextValue {
  model: ModelId;
  setModel: (m: ModelId) => void;
}

const ModelContext = createContext<ModelContextValue>({ model: DEFAULT_MODEL, setModel: () => {} });

// Nastaví data-model dřív, než se stránka vykreslí (bez probliknutí claude -> codex u uložené volby).
const EARLY_SCRIPT = `try{var m=new URLSearchParams(location.search).get("m");if(m!=="claude"&&m!=="codex")m=localStorage.getItem("${STORAGE_KEY}");if(m==="codex"){var e=document.querySelector(".ar");if(e)e.setAttribute("data-model","codex")}}catch(e){}`;

export function ModelProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const model: ModelId = MODEL_TOGGLE_ENABLED ? stored : DEFAULT_MODEL;
  const pathname = usePathname();
  useEffect(() => {
    if (MODEL_TOGGLE_ENABLED) syncFromUrl();
  }, [pathname]);
  const value = useMemo<ModelContextValue>(
    () => ({ model, setModel: MODEL_TOGGLE_ENABLED ? setStored : () => {} }),
    [model],
  );
  return (
    <ModelContext.Provider value={value}>
      <div className="ar" data-model={model} suppressHydrationWarning>
        {children}
        {MODEL_TOGGLE_ENABLED && (
          <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: EARLY_SCRIPT }} />
        )}
      </div>
    </ModelContext.Provider>
  );
}

export function useModel(): ModelContextValue {
  return useContext(ModelContext);
}

/** Texty UI aktivního modelu. */
export function useCopy(): UiCopy {
  return COPY[useModel().model];
}
