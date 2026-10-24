"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

type Step = "A" | "B";
type Mode = "exact" | "approx" | "unknown";
type Person = {
  datum: string;
  misto: string;
  mode: Mode;
  cas: string;
  approx: string;
  casPribl: string;
  part: string;
  styl: string;
};

const EMPTY: Record<Step, Person> = {
  A: { datum: "", misto: "", mode: "exact", cas: "", approx: "60", casPribl: "", part: "rano", styl: "neutral" },
  B: { datum: "", misto: "", mode: "unknown", cas: "", approx: "60", casPribl: "", part: "rano", styl: "neutral" },
};

const ON: CSSProperties = { background: "#EDB894", color: "#2A1220", borderColor: "#EDB894" };
const OFF: CSSProperties = { background: "transparent", color: "#F4E9E4", borderColor: "#6E5566" };

const MODES: [Mode, string][] = [["exact", "Vím přesně"], ["approx", "Přibližně"], ["unknown", "Nevím"]];
const APPROX: [string, string][] = [["30", "± 30 min"], ["60", "± 1 h"], ["120", "± 2 h"], ["part", "Jen část dne"]];
const DAYPARTS: [string, string, string][] = [
  ["noc", "Noc", "0:00–5:59"],
  ["rano", "Ráno", "6:00–11:59"],
  ["odpoledne", "Odpoledne", "12:00–17:59"],
  ["vecer", "Večer", "18:00–23:59"],
];
const STYLES: [string, string, boolean][] = [
  ["neutral", "Neutrálně", true],
  ["masc", "V mužském rodě", false],
  ["fem", "V ženském rodě", false],
];

const LABEL: CSSProperties = { fontSize: "14px", fontWeight: 400, color: "#E8DAE0" };
const INPUT: CSSProperties = {
  height: "52px", boxSizing: "border-box", padding: "0 16px", borderRadius: "12px", border: "1px solid #5A3F53",
  background: "rgba(255, 240, 232, 0.04)", color: "#F4E9E4", fontFamily: "inherit", fontSize: "17px", fontWeight: 300,
};
const BTN_GLOW =
  "0 12px 36px rgba(240, 160, 130, 0.4), 0 0 70px rgba(240, 160, 130, 0.22), inset 0 1px 0 rgba(255, 244, 236, 0.7)";
const BTN_CTA: CSSProperties = {
  width: "100%", minHeight: "56px", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)",
  color: "#2A1220", boxShadow: BTN_GLOW, fontFamily: "inherit", fontSize: "16px", fontWeight: 500,
};
const BACK: CSSProperties = {
  width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: "999px", border: "1px solid #4A3045",
};

function BackIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#F4E9E4" strokeWidth="1.4">
      <path d="M10 3L5 8l5 5"></path>
    </svg>
  );
}

// Zadání osoby (Mobil-02). Rozpracované hodnoty žijí jen ve stavu komponenty – nic se neukládá ani neposílá.
export function Osoba() {
  const [step, setStep] = useState<Step>("A");
  const [people, setPeople] = useState(EMPTY);
  const p = people[step];
  const isA = step === "A";
  const set = (patch: Partial<Person>) => setPeople((prev) => ({ ...prev, [step]: { ...prev[step], ...patch } }));
  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };
  const chip = (on: boolean): CSSProperties => (on ? ON : OFF);

  return (
    <>
      {/* křivky přes celou šířku */}
      <svg aria-hidden="true" viewBox="0 0 375 300" preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "300px", pointerEvents: "none" }}>
        <defs>
          <filter id="m2Blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"></feGaussianBlur></filter>
          <linearGradient id="m2A" gradientUnits="userSpaceOnUse" x1="-20" y1="0" x2="400" y2="0">
            <stop offset="0" stopColor="#6E3C8A" stopOpacity="0"></stop>
            <stop offset="0.45" stopColor="#C77FAA"></stop>
            <stop offset="0.75" stopColor="#FFF1E6"></stop>
            <stop offset="1" stopColor="#EFB49A" stopOpacity="0.2"></stop>
          </linearGradient>
        </defs>
        <path d="M -20 150 C 120 70, 260 60, 400 120" fill="none" stroke="url(#m2A)" strokeWidth="8" opacity="0.5" filter="url(#m2Blur)"></path>
        <path d="M -20 150 C 120 70, 260 60, 400 120" fill="none" stroke="url(#m2A)" strokeWidth="1.2"></path>
        <path d="M -20 156 C 120 77, 260 67, 400 127" fill="none" stroke="url(#m2A)" strokeWidth="0.5" opacity="0.5"></path>
      </svg>
      {/* záře u pravého okraje sloupce */}
      <svg aria-hidden="true" viewBox="0 0 375 300" style={{ position: "absolute", left: "50%", marginLeft: "-187.5px", top: 0, width: "375px", height: "300px", overflow: "visible", pointerEvents: "none" }}>
        <defs>
          <filter id="m2BlurC" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"></feGaussianBlur></filter>
          <filter id="m2Pool" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="40"></feGaussianBlur></filter>
        </defs>
        <ellipse cx="300" cy="90" rx="140" ry="110" fill="#3A1838" opacity="0.6" filter="url(#m2Pool)"></ellipse>
        <circle cx="300" cy="84" r="20" fill="#FFEBDD" opacity="0.35" filter="url(#m2BlurC)"></circle>
      </svg>

      <div style={{ position: "relative", maxWidth: "560px", margin: "0 auto", paddingBottom: "56px" }}>
        <header style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px" }}>
          {isA ? (
            <Link href="/mezi-vami" prefetch={false} aria-label="Zpět na úvod" style={BACK}>
              <BackIcon />
            </Link>
          ) : (
            <button type="button" aria-label="Zpět na první osobu" onClick={() => go("A")} style={{ ...BACK, background: "transparent", cursor: "pointer" }}>
              <BackIcon />
            </button>
          )}
          <span style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "17px", letterSpacing: "0.22em", color: "#E8DAE0" }}>MEZI VÁMI</span>
          <span style={{ width: "44px", textAlign: "right", fontSize: "12px", color: "#BDA7B2" }}>{isA ? "1" : "2"} / 2</span>
        </header>
        <div aria-hidden="true" style={{ position: "relative", display: "flex", gap: "6px", padding: "0 20px" }}>
          <span style={{ flex: 1, height: "3px", borderRadius: "3px", background: "#EDB894" }}></span>
          <span style={{ flex: 1, height: "3px", borderRadius: "3px", background: isA ? "#3A2535" : "#EDB894" }}></span>
        </div>

        <main style={{ position: "relative", padding: "32px 20px 0" }}>
          <p style={{ margin: 0, fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "#A48D99" }}>Krok {isA ? "1" : "2"} ze 2</p>
          <h1 style={{ margin: "8px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: 300, fontSize: "48px", lineHeight: 1, background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            {isA ? "První osoba" : "Druhá osoba"}
          </h1>
          <p style={{ margin: "14px 0 0", fontSize: "15px", lineHeight: 1.6, color: "#BDA7B2" }}>
            {isA
              ? "Potřebujeme údaje o narození obou lidí — z nich spočítáme, co vzniká mezi vámi. Začneme kýmkoli z vás."
              : "Údaje druhé osoby použijeme jen pro tento výpočet. Bez jména a kontaktu — a pokud si nic neobjednáte, do 72 hodin je smažeme."}
          </p>

          <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <label htmlFor="m2-datum" style={LABEL}>Datum narození</label>
            <input id="m2-datum" type="text" inputMode="numeric" autoComplete="off" placeholder="např. 24. 12. 1990" value={p.datum} onChange={(e) => set({ datum: e.target.value })} style={INPUT} />
          </div>

          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <label htmlFor="m2-misto" style={LABEL}>Místo narození</label>
            <div style={{ position: "relative" }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#A48D99" strokeWidth="1.3" style={{ position: "absolute", left: "14px", top: "17px" }}>
                <path d="M9 16s5-4.6 5-8.5A5 5 0 0 0 4 7.5C4 11.4 9 16 9 16z"></path>
                <circle cx="9" cy="7.5" r="1.8"></circle>
              </svg>
              <input id="m2-misto" type="text" autoComplete="off" placeholder="Začněte psát obec" value={p.misto} onChange={(e) => set({ misto: e.target.value })} style={{ ...INPUT, width: "100%", padding: "0 16px 0 42px" }} />
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#A48D99" }}>Zatím počítáme s místy v Česku a na Slovensku.</p>
          </div>

          <fieldset style={{ margin: "24px 0 0", padding: 0, border: 0 }}>
            <legend style={{ padding: 0, ...LABEL }}>Čas narození</legend>
            <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
              {MODES.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={p.mode === id} onClick={() => set({ mode: id })} style={{ minHeight: "48px", padding: "0 6px", borderRadius: "12px", border: "1px solid", fontFamily: "inherit", fontSize: "14px", fontWeight: 400, cursor: "pointer", ...chip(p.mode === id) }}>
                  {label}
                </button>
              ))}
            </div>

            {p.mode === "exact" && (
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <label htmlFor="m2-cas" style={{ fontSize: "13px", color: "#BDA7B2" }}>Čas podle rodného listu nebo záznamu z porodnice</label>
                <input id="m2-cas" type="text" inputMode="numeric" placeholder="HH:MM" value={p.cas} onChange={(e) => set({ cas: e.target.value })} style={{ ...INPUT, width: "140px" }} />
              </div>
            )}

            {p.mode === "approx" && (
              <>
                <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {APPROX.map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={p.approx === id} onClick={() => set({ approx: id })} style={{ minHeight: "44px", padding: "0 16px", borderRadius: "999px", border: "1px solid", fontFamily: "inherit", fontSize: "14px", cursor: "pointer", ...chip(p.approx === id) }}>
                      {label}
                    </button>
                  ))}
                </div>
                {p.approx !== "part" ? (
                  <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label htmlFor="m2-cas-pribl" style={{ fontSize: "13px", color: "#BDA7B2" }}>Přibližně kolem</label>
                    <input id="m2-cas-pribl" type="text" inputMode="numeric" placeholder="HH:MM" value={p.casPribl} onChange={(e) => set({ casPribl: e.target.value })} style={{ ...INPUT, width: "140px" }} />
                  </div>
                ) : (
                  <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                    {DAYPARTS.map(([id, label, range]) => (
                      <button key={id} type="button" aria-pressed={p.part === id} onClick={() => set({ part: id })} style={{ minHeight: "56px", padding: "6px 12px", borderRadius: "12px", border: "1px solid", fontFamily: "inherit", textAlign: "left", cursor: "pointer", ...chip(p.part === id) }}>
                        <span style={{ display: "block", fontSize: "15px", fontWeight: 400 }}>{label}</span>
                        <span style={{ display: "block", fontSize: "12px", opacity: 0.8 }}>{range}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p style={{ margin: "14px 0 0", fontSize: "13px", lineHeight: 1.55, color: "#A48D99" }}>
                  Přibližný čas nikdy nevydáváme za přesný. Co by se v tom rozmezí mohlo změnit, raději vynecháme.
                </p>
              </>
            )}

            {p.mode === "unknown" && (
              <div style={{ marginTop: "16px", borderRadius: "14px", border: "1px solid rgba(242, 198, 166, 0.2)", background: "rgba(255, 240, 232, 0.035)", padding: "16px 18px" }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 400, color: "#F1D0BC" }}>Nevadí.</p>
                <p style={{ margin: "6px 0 0", fontSize: "14px", lineHeight: 1.6, color: "#E8DAE0" }}>
                  Vztahovou DNA spočítáme i bez času. Vynecháme jen to, co na přesném čase závisí — a ve výsledku uvidíte přesně co.
                </p>
              </div>
            )}
          </fieldset>

          <details style={{ marginTop: "24px", borderTop: "1px solid #3A2535", borderBottom: "1px solid #3A2535", padding: "4px 0" }}>
            <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: "48px", fontSize: "14px", color: "#E8DAE0" }}>
              <span>Jak o této osobě psát <span style={{ color: "#A48D99" }}>· nepovinné</span></span>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#EDB894" strokeWidth="1.4">
                <path d="M3 5l4 4 4-4"></path>
              </svg>
            </summary>
            <div role="radiogroup" aria-label="Jak o osobě psát" style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "4px 0 14px" }}>
              {STYLES.map(([id, label, isDefault]) => (
                <label key={id} style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "44px", fontSize: "15px", color: "#F4E9E4" }}>
                  <input type="radio" name={`m2-styl-${step}`} checked={p.styl === id} onChange={() => set({ styl: id })} style={{ width: "20px", height: "20px", accentColor: "#EDB894" }} />
                  {label}
                  {isDefault && <span style={{ color: "#A48D99" }}>(výchozí)</span>}
                </label>
              ))}
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#A48D99" }}>Jen kvůli češtině ve výsledku. Na výpočet nemá vliv.</p>
            </div>
          </details>

          <div style={{ marginTop: "28px" }}>
            {isA ? (
              <button type="button" onClick={() => go("B")} style={{ ...BTN_CTA, border: 0, cursor: "pointer" }}>
                Pokračovat na druhou osobu →
              </button>
            ) : (
              <Link href="/mezi-vami/vysledek" prefetch={false} style={{ ...BTN_CTA, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                Spočítat Vztahovou DNA →
              </Link>
            )}
            <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: "13px", color: "#A48D99" }}>Rozpracované údaje držíme jen v tomto okně prohlížeče.</p>
          </div>
        </main>
      </div>
    </>
  );
}
