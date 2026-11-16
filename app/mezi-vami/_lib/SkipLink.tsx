"use client";

import type { MouseEvent } from "react";

// Skip-link „Přeskočit na obsah“: vizuálně skrytý, zobrazí se při zaostření (viz .mv-skip).
// Cíl je <main> viditelné větve stránky (po hydrataci je v DOM jediný; do hydratace se hledá
// první viditelný), proto odkaz řeší handler, ne pevné id.
export function SkipLink() {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    const mains = Array.from(document.querySelectorAll<HTMLElement>("main"));
    const target = mains.find((m) => m.offsetParent !== null) ?? mains[0];
    if (!target) return;
    e.preventDefault();
    if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus();
    target.scrollIntoView();
  };
  return (
    <a href="#obsah" className="mv-skip" onClick={go}>
      Přeskočit na obsah
    </a>
  );
}
