"use client";

import { useState } from "react";

const LINKS = [
  ["#jak", "Jak to funguje"],
  ["#dna", "Co získáte"],
  ["#ukazka", "Ukázka"],
  ["#cena", "Cena"],
  ["#otazky", "Časté otázky"],
] as const;

// Tlačítko menu z Mobil-01 (v návrhu bez obsahu); otevře odkazy stejné jako desktopová navigace.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={open ? "Zavřít menu" : "Otevřít menu"}
        aria-expanded={open}
        aria-controls="mv-menu"
        onClick={() => setOpen((v) => !v)}
        style={{ width: "44px", height: "44px", borderRadius: "999px", border: "1px solid #5A4A58", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="#F2E8E4" strokeWidth="1.3">
          <path d="M1 2h16M1 10h16"></path>
        </svg>
      </button>
      {open && (
        <nav
          id="mv-menu"
          aria-label="Hlavní navigace"
          style={{ position: "absolute", top: "100%", right: "16px", zIndex: 5, display: "flex", flexDirection: "column", minWidth: "200px", padding: "8px 20px", borderRadius: "16px", border: "1px solid rgba(236, 212, 200, 0.16)", background: "rgba(26, 19, 28, 0.96)", boxShadow: "0 30px 70px rgba(0, 0, 0, 0.55)" }}
        >
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", minHeight: "44px", fontSize: "14px", color: "#E2D6DC", textDecoration: "none" }}>
              {label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
