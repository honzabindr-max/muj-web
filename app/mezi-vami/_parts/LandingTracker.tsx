"use client";

// Měření kliknutí na vstup do formuláře z landingu (bez osobních údajů).
import { useEffect } from "react";
import { track } from "../_lib/track";

export function LandingTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (a?.getAttribute("href") === "/mezi-vami/osoba") track("landing_cta");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
