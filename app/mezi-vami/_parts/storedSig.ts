"use client";

// Podpis vstupu uloženého výsledku (pro rozhodnutí, zda nový výpočet vůbec spouštět).
export function readStoredSig(): string | null {
  try {
    const raw = window.sessionStorage.getItem("mv:result:v1");
    return raw ? ((JSON.parse(raw) as { sig?: string }).sig ?? null) : null;
  } catch {
    return null;
  }
}
