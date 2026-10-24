"use client";

import { useState } from "react";
// Převedeno skriptem z design/mezi-vami/Mobil-06-Pokladna.dc.html (řádky 21–89), pak ručně upraveno.
import Link from "next/link";

export function Pokladna() {
  return (
    <>
    <svg aria-hidden="true" viewBox="0 0 375 360" preserveAspectRatio="none" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "360px", pointerEvents: "none" }}>
      <defs>
        <filter id="m6Pool" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="40">
          </feGaussianBlur>
        </filter>
        <filter id="m6B" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5">
          </feGaussianBlur>
        </filter>
        <linearGradient id="m6A" gradientUnits="userSpaceOnUse" x1="-20" y1="0" x2="400" y2="0">
          <stop offset="0" stopColor="#6E3C8A" stopOpacity="0">
          </stop>
          <stop offset="0.5" stopColor="#C77FAA">
          </stop>
          <stop offset="0.8" stopColor="#FFF1E6">
          </stop>
          <stop offset="1" stopColor="#EFB49A" stopOpacity="0.2">
          </stop>
        </linearGradient>
      </defs>
      <ellipse cx="300" cy="120" rx="150" ry="120" fill="#3A1838" opacity="0.6" filter="url(#m6Pool)">
      </ellipse>
      <path d="M -20 200 C 120 100, 270 90, 400 40" fill="none" stroke="url(#m6A)" strokeWidth="8" opacity="0.45" filter="url(#m6B)">
      </path>
      <path d="M -20 200 C 120 100, 270 90, 400 40" fill="none" stroke="url(#m6A)" strokeWidth="1.1">
      </path>
    </svg>
    <header style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px" }}>
      <Link href="/mezi-vami/vysledek#nabidka" prefetch={false} aria-label="Zpět na nabídku" style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", border: "1px solid #4A3045" }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#F4E9E4" strokeWidth="1.4">
          <path d="M10 3L5 8l5 5">
          </path>
        </svg>
      </Link>
      <span style={{ flex: "1", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "17px", letterSpacing: "0.22em", color: "#E8DAE0" }}>
        MEZI VÁMI
      </span>
      <span style={{ width: "44px" }}>
      </span>
    </header>
    <main style={{ position: "relative", padding: "20px 20px 0" }}>
      <h1 style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "300", fontSize: "46px", lineHeight: "1", background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
        Objednávka
      </h1>
      <div style={{ marginTop: "22px", padding: "20px", borderRadius: "16px", border: "1px solid rgba(242, 198, 166, 0.3)", background: "#1E1120" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
          <p style={{ margin: "0", fontSize: "16px", fontWeight: "400", color: "#F4E9E4" }}>
            Hloubková analýza
            <br />
            <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "18px", fontWeight: "300", color: "#C9A0B8" }}>
              MEZI VÁMI
            </span>
          </p>
          <p style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "30px", color: "#F4E9E4", whiteSpace: "nowrap" }}>
            1 990 Kč
          </p>
        </div>
        <p style={{ margin: "14px 0 0", paddingTop: "14px", borderTop: "1px solid #3A2535", fontSize: "13px", lineHeight: "1.6", color: "#BDA7B2" }}>
          PDF do 48 hodin e-mailem · odkaz platný 30 dní · jednorázová platba, bez předplatného
        </p>
      </div>
      <h2 style={{ margin: "34px 0 0", fontSize: "15px", fontWeight: "400", color: "#E8DAE0" }}>
        Zkontrolujte údaje
      </h2>
      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ padding: "16px", borderRadius: "14px", border: "1px solid #3A2535", background: "#180D18" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <p style={{ margin: "0", fontSize: "14px", fontWeight: "400", color: "#F4E9E4" }}>
              První osoba
            </p>
            <Link href="/mezi-vami/osoba" prefetch={false} style={{ display: "inline-flex", alignItems: "center", minHeight: "44px", fontSize: "13px" }}>
              Upravit
            </Link>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: "14px", color: "#BDA7B2" }}>
            14. 5. 1990 · Brno · 7:40 přesně
          </p>
          <StylePicker name="m6-a" />
        </div>
        <div style={{ padding: "16px", borderRadius: "14px", border: "1px solid #3A2535", background: "#180D18" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <p style={{ margin: "0", fontSize: "14px", fontWeight: "400", color: "#F4E9E4" }}>
              Druhá osoba
            </p>
            <Link href="/mezi-vami/osoba" prefetch={false} style={{ display: "inline-flex", alignItems: "center", minHeight: "44px", fontSize: "13px" }}>
              Upravit
            </Link>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: "14px", color: "#BDA7B2" }}>
            23. 8. 1988 · Žilina · čas neznámý
          </p>
          <StylePicker name="m6-b" />
        </div>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: "13px", lineHeight: "1.55", color: "#A48D99" }}>
        Úprava údajů spustí nový výpočet — vaše Vztahová DNA se pak může změnit.
      </p>
      <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <label htmlFor="m6-email" style={{ fontSize: "15px", fontWeight: "400", color: "#E8DAE0" }}>
          E-mail pro doručení
        </label>
        <input id="m6-email" type="email" autoComplete="email" placeholder="vas@email.cz" style={{ height: "52px", boxSizing: "border-box", padding: "0 16px", borderRadius: "12px", border: "1px solid #5A3F53", background: "rgba(255, 240, 232, 0.04)", color: "#F4E9E4", fontFamily: "inherit", fontSize: "17px", fontWeight: "300" }} />
        <p style={{ margin: "0", fontSize: "13px", color: "#A48D99" }}>
          Sem pošleme odkaz na PDF. Nic jiného.
        </p>
      </div>
      <div style={{ marginTop: "26px", display: "flex", flexDirection: "column", gap: "4px" }}>
        <label style={{ display: "flex", gap: "12px", alignItems: "flex-start", minHeight: "44px", padding: "6px 0", fontSize: "14px", lineHeight: "1.5", color: "#E8DAE0" }}>
          <input type="checkbox" style={{ flex: "0 0 auto", width: "20px", height: "20px", margin: "1px 0 0", accentColor: "#EDB894" }} />
          <span>
            {"Souhlasím s "}
            <a href="#">
              obchodními podmínkami
            </a>
            {". "}
            <span style={{ color: "#8F7884" }}>
              [LEGAL_PENDING]
            </span>
          </span>
        </label>
        <label style={{ display: "flex", gap: "12px", alignItems: "flex-start", minHeight: "44px", padding: "6px 0", fontSize: "14px", lineHeight: "1.5", color: "#E8DAE0" }}>
          <input type="checkbox" style={{ flex: "0 0 auto", width: "20px", height: "20px", margin: "1px 0 0", accentColor: "#EDB894" }} />
          <span>
            {"[Potvrzení k zahájení plnění a odstoupení od smlouvy] "}
            <span style={{ color: "#8F7884" }}>
              [LEGAL_PENDING]
            </span>
          </span>
        </label>
        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#A48D99" }}>
          {"Jak nakládáme s údaji: "}
          <a href="#">
            Ochrana údajů
          </a>
          {" · "}
          <a href="#">
            Reklamace a vrácení
          </a>
        </p>
      </div>
      <button type="button" disabled aria-describedby="m6-proto" style={{ marginTop: "28px", width: "100%", minHeight: "58px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1220", boxShadow: "0 12px 36px rgba(240, 160, 130, 0.4), 0 0 70px rgba(240, 160, 130, 0.22), inset 0 1px 0 rgba(255, 244, 236, 0.7)", fontFamily: "inherit", fontSize: "17px", fontWeight: "500", cursor: "not-allowed", opacity: "0.55" }}>
        Zaplatit 1 990 Kč
      </button>
      <p id="m6-proto" role="status" style={{ margin: "12px 0 0", textAlign: "center", fontSize: "13px", color: "#BDA7B2" }}>
        Prototyp — platby zatím nejsou aktivní.
      </p>
      <p style={{ margin: "12px 0 0", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontSize: "13px", color: "#BDA7B2" }}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#BDA7B2" strokeWidth="1.2">
          <rect x="2.5" y="6" width="9" height="6.5" rx="1">
          </rect>
          <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6">
          </path>
        </svg>
        Platbu zpracuje [PSP]. Údaje karty nevidíme.
      </p>
      <p style={{ margin: "28px 0 0", textAlign: "center", fontSize: "12px", color: "#8F7884" }}>
        Prodávající: [PRODEJCE] · IČO [IČO]
      </p>
    </main>
    </>
  );
}

const STYLES = ["Neutrálně", "Muž. rod", "Žen. rod"];

// Volba „Jak psát“ – stav jen v komponentě, nic se neukládá.
function StylePicker({ name }: { name: string }) {
  const [sel, setSel] = useState(0);
  return (
    <fieldset style={{ margin: "12px 0 0", padding: "0", border: "0" }}>
      <legend style={{ padding: "0", fontSize: "12px", color: "#A48D99" }}>Jak psát</legend>
      <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" }}>
        {STYLES.map((label, i) => (
          <label
            key={label}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", minHeight: "44px", borderRadius: "10px", fontSize: "13px", cursor: "pointer",
              border: `1px solid ${sel === i ? "#EDB894" : "#5A3F53"}`,
              background: sel === i ? "rgba(237, 184, 148, 0.12)" : undefined,
              color: sel === i ? "#F4E9E4" : "#E8DAE0",
            }}
          >
            <input type="radio" name={name} checked={sel === i} onChange={() => setSel(i)} style={{ position: "absolute", opacity: "0", width: "1px", height: "1px" }} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
