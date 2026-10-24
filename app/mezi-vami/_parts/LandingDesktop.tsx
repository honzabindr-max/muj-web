// Převedeno skriptem z design/mezi-vami/Main.dc.html (řádky 42–337), pak ručně upraveno.
import Link from "next/link";
import { DnaCardsMobile } from "./DnaCardsMobile";
import { ReportMockMobile } from "./ReportMockMobile";

export function LandingDesktop() {
  return (
    <>
    <div className="mv-d">
    <section style={{ position: "relative", padding: "0 0 80px" }}>
      <svg aria-hidden="true" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>
          <filter id="hB1" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5">
            </feGaussianBlur>
          </filter>
          <filter id="hB2" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14">
            </feGaussianBlur>
          </filter>
          <linearGradient id="hA" gradientUnits="userSpaceOnUse" x1="1060" y1="-20" x2="1440" y2="480">
            <stop offset="0" stopColor="#F6C9A8" stopOpacity="0.5">
            </stop>
            <stop offset="0.25" stopColor="#FFEBDC">
            </stop>
            <stop offset="0.6" stopColor="#F3BE9E">
            </stop>
            <stop offset="1" stopColor="#D98FA6" stopOpacity="0.6">
            </stop>
          </linearGradient>
          <linearGradient id="hB" gradientUnits="userSpaceOnUse" x1="260" y1="0" x2="1460" y2="0">
            <stop offset="0" stopColor="#9C6A9C" stopOpacity="0">
            </stop>
            <stop offset="0.35" stopColor="#C995B0" stopOpacity="0.7">
            </stop>
            <stop offset="0.75" stopColor="#F2C2A8">
            </stop>
            <stop offset="1" stopColor="#F2C2A8" stopOpacity="0.7">
            </stop>
          </linearGradient>
          <linearGradient id="hC" gradientUnits="userSpaceOnUse" x1="-40" y1="0" x2="1480" y2="0">
            <stop offset="0" stopColor="#9C6A9C" stopOpacity="0">
            </stop>
            <stop offset="0.5" stopColor="#C995B0" stopOpacity="0.45">
            </stop>
            <stop offset="1" stopColor="#E5B49E" stopOpacity="0">
            </stop>
          </linearGradient>
        </defs>
        <g className="mv-breathe-d">
          <path d="M 1060 -20 C 1000 150, 1040 280, 1460 480" fill="none" stroke="#E9A08C" strokeWidth="30" opacity="0.22" filter="url(#hB2)">
          </path>
          <path d="M 1060 -20 C 1000 150, 1040 280, 1460 480" fill="none" stroke="#F6C2A4" strokeWidth="7" opacity="0.7" filter="url(#hB1)">
          </path>
          <path d="M 260 70 C 700 50, 1100 200, 1460 520" fill="none" stroke="#C98CAE" strokeWidth="18" opacity="0.18" filter="url(#hB2)">
          </path>
          <path d="M 260 70 C 700 50, 1100 200, 1460 520" fill="none" stroke="#E7B0B4" strokeWidth="4" opacity="0.5" filter="url(#hB1)">
          </path>
        </g>
        <path d="M 1060 -20 C 1000 150, 1040 280, 1460 480" fill="none" stroke="url(#hA)" strokeWidth="1.8">
        </path>
        <path d="M 260 70 C 700 50, 1100 200, 1460 520" fill="none" stroke="url(#hB)" strokeWidth="1.1">
        </path>
        <path className="mv-travel-d" d="M 260 70 C 700 50, 1100 200, 1460 520" fill="none" stroke="#FFF1E6" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="60 1640" opacity="0.7" filter="url(#hB1)">
        </path>
        <path d="M -40 860 C 420 720, 960 660, 1480 610" fill="none" stroke="url(#hC)" strokeWidth="1">
        </path>
        <path d="M -40 860 C 420 720, 960 660, 1480 610" fill="none" stroke="#C995B0" strokeWidth="6" opacity="0.15" filter="url(#hB1)">
        </path>
      </svg>
      <header style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "28px 40px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
        <a href="#" style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "25px", fontWeight: "400", letterSpacing: "0.22em", color: "#F2E8E4", textDecoration: "none" }}>
          MEZI VÁMI
        </a>
        <nav aria-label="Hlavní navigace" style={{ display: "flex", flexWrap: "wrap", gap: "34px", fontSize: "14px", letterSpacing: "0.02em" }}>
          <a href="#jak" style={{ color: "#E2D6DC", textDecoration: "none" }}>
            Jak to funguje
          </a>
          <a href="#dna" style={{ color: "#E2D6DC", textDecoration: "none" }}>
            Co získáte
          </a>
          <a href="#ukazka" style={{ color: "#E2D6DC", textDecoration: "none" }}>
            Ukázka
          </a>
          <a href="#cena" style={{ color: "#E2D6DC", textDecoration: "none" }}>
            Cena
          </a>
          <a href="#otazky" style={{ color: "#E2D6DC", textDecoration: "none" }}>
            Časté otázky
          </a>
        </nav>
        <Link href="/mezi-vami/osoba" prefetch={false} className="mv-btn-d" style={{ display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "46px", padding: "0 24px", borderRadius: "999px", border: "1.5px solid #E6D3CC", color: "#F2E8E4", textDecoration: "none", fontSize: "14px" }}>
          {"Zjistit vaši Vztahovou DNA zdarma "}
          <span aria-hidden="true">
            →
          </span>
        </Link>
      </header>
      <div style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "84px 40px 0", display: "flex", flexWrap: "wrap", gap: "48px", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 640px", minWidth: "0" }}>
          <h1 style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "clamp(62px, 8.2vw, 118px)", lineHeight: "0.98", letterSpacing: "-0.01em" }}>
            <span style={{ background: "linear-gradient(180deg, #F6E6DA 0%, #E9C8B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              Co vzniká
            </span>
            <br />
            <span style={{ background: "linear-gradient(180deg, #CDB2C0 0%, #A98FA2 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              mezi vámi?
            </span>
          </h1>
          <p style={{ margin: "26px 0 0", fontSize: "31px", lineHeight: "1.3", color: "#B9A8B5", maxWidth: "600px" }}>
            Dva lidé. Jeden vztah.
            <br />
            Vzorec, který uvidíte až spolu.
          </p>
          <div style={{ marginTop: "42px", display: "flex", flexWrap: "wrap", gap: "18px", alignItems: "center" }}>
            <Link href="/mezi-vami/osoba" prefetch={false} className="mv-btn-d" style={{ display: "inline-flex", alignItems: "center", gap: "12px", minHeight: "60px", padding: "0 36px", borderRadius: "999px", border: "1.5px solid #E6D3CC", color: "#F2E8E4", textDecoration: "none", fontSize: "17px", fontWeight: "400" }}>
              {"Zjistit vaši Vztahovou DNA zdarma "}
              <span aria-hidden="true">
                →
              </span>
            </Link>
            <a href="#jak" style={{ display: "inline-flex", alignItems: "center", gap: "14px", minHeight: "60px", padding: "0 24px 0 8px", borderRadius: "999px", border: "1px solid #3E3040", color: "#F2E8E4", textDecoration: "none", fontSize: "15px" }}>
              <span aria-hidden="true" style={{ display: "inline-flex", width: "42px", height: "42px", borderRadius: "999px", border: "1px solid #B9A8B5", alignItems: "center", justifyContent: "center" }}>
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M3 1.5 L10 6 L3 10.5 Z" fill="none" stroke="#F2E8E4" strokeWidth="1.2" strokeLinejoin="round">
                  </path>
                </svg>
              </span>
              Jak to funguje
            </a>
          </div>
          <p style={{ margin: "24px 0 0", fontSize: "14px", lineHeight: "1.6", color: "#A897A3", maxWidth: "540px" }}>
            {"Vztahová DNA je zdarma a kompletní. Hloubková analýza za "}
            <span style={{ color: "#E9C8B5" }}>
              1 990 Kč
            </span>
            {" je dobrovolná — nabídneme ji až po výsledku."}
          </p>
        </div>
        <ul style={{ flex: "0 1 240px", margin: "0", padding: "0", listStyle: "none", textAlign: "right", fontSize: "12px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#9E8D99", lineHeight: "2.5" }}>
          <li>
            Vztahová DNA zdarma
          </li>
          <li>
            Bez e-mailu a registrace
          </li>
          <li>
            Výsledek hned
          </li>
          <li aria-hidden="true" style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <span style={{ display: "block", width: "48px", height: "1px", background: "#8C7B88" }}>
            </span>
          </li>
        </ul>
      </div>
      <div style={{ position: "relative", maxWidth: "1280px", margin: "64px auto 0", padding: "0 40px" }}>
        <div style={{ position: "relative", borderRadius: "22px", border: "1px solid transparent", background: "linear-gradient(180deg, rgba(42, 32, 44, 0.82), rgba(26, 19, 28, 0.82)) padding-box, linear-gradient(180deg, rgba(236, 212, 200, 0.55), rgba(236, 212, 200, 0.14) 60%, rgba(236, 212, 200, 0.22)) border-box", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: "0 30px 80px rgba(0, 0, 0, 0.55)", padding: "28px", display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "stretch" }}>
          <div style={{ flex: "1 1 280px", minWidth: "0", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.09)", background: "linear-gradient(180deg, rgba(88, 74, 90, 0.5), rgba(58, 46, 60, 0.5))", boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.07)", padding: "22px 24px" }}>
            <p style={{ margin: "0", fontSize: "16px", fontWeight: "400", color: "#F2E8E4" }}>
              První osoba
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#B9A8B5" }}>
              Datum a místo narození, čas pokud ho znáte
            </p>
            <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
              <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", height: "42px", padding: "0 14px", borderRadius: "8px", background: "rgba(14, 10, 16, 0.55)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)", fontSize: "13px", color: "#8E7E8A" }}>
                Datum narození
              </span>
              <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", height: "42px", padding: "0 14px", borderRadius: "8px", background: "rgba(14, 10, 16, 0.55)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)", fontSize: "13px", color: "#8E7E8A" }}>
                Místo narození
              </span>
            </div>
          </div>
          <div style={{ flex: "1 1 280px", minWidth: "0", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.09)", background: "linear-gradient(180deg, rgba(88, 74, 90, 0.5), rgba(58, 46, 60, 0.5))", boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.07)", padding: "22px 24px" }}>
            <p style={{ margin: "0", fontSize: "16px", fontWeight: "400", color: "#F2E8E4" }}>
              Druhá osoba
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#B9A8B5" }}>
              Totéž pro druhého z vás, bez jména
            </p>
            <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
              <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", height: "42px", padding: "0 14px", borderRadius: "8px", background: "rgba(14, 10, 16, 0.55)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)", fontSize: "13px", color: "#8E7E8A" }}>
                Datum narození
              </span>
              <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", height: "42px", padding: "0 14px", borderRadius: "8px", background: "rgba(14, 10, 16, 0.55)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)", fontSize: "13px", color: "#8E7E8A" }}>
                Místo narození
              </span>
            </div>
          </div>
          <div style={{ flex: "1 1 250px", minWidth: "0", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "12px", padding: "6px 10px", textAlign: "center" }}>
            <Link href="/mezi-vami/osoba" prefetch={false} className="mv-btn-d" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "62px", width: "100%", maxWidth: "280px", padding: "0 22px", boxSizing: "border-box", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1622", textDecoration: "none", fontSize: "16px", fontWeight: "400", lineHeight: "1.25", boxShadow: "0 10px 34px rgba(232, 170, 135, 0.35), 0 0 60px rgba(232, 170, 135, 0.18), inset 0 1px 0 rgba(255, 244, 236, 0.6)" }}>
              {"Zjistit vaši Vztahovou DNA zdarma "}
              <span aria-hidden="true">
                →
              </span>
            </Link>
            <p style={{ margin: "0", fontSize: "13px", lineHeight: "1.5", color: "#A897A3" }}>
              Výsledek uvidíte hned.
              <br />
              Bez registrace.
            </p>
          </div>
        </div>
        <ul style={{ margin: "30px 0 0", padding: "0", listStyle: "none", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px 48px", fontSize: "12px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#9E8D99" }}>
          <li style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span aria-hidden="true" style={{ width: "32px", height: "1px", background: "#6A5866" }}>
            </span>
            Z údajů o narození obou
          </li>
          <li style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span aria-hidden="true" style={{ width: "32px", height: "1px", background: "#6A5866" }}>
            </span>
            Výsledek hned po výpočtu
          </li>
          <li style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span aria-hidden="true" style={{ width: "32px", height: "1px", background: "#6A5866" }}>
            </span>
            Údaje mažeme do 72 hodin
          </li>
        </ul>
      </div>
    </section>
    </div>
    {/* ============ VZTAHOVÁ DNA ============ */}
    <section id="dna" className="mv-dna" style={{ position: "relative", padding: "90px 0 120px" }}>
      <svg aria-hidden="true" viewBox="0 0 1440 700" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>
          <filter id="dB1" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="4">
            </feGaussianBlur>
          </filter>
          <filter id="dB2" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="16">
            </feGaussianBlur>
          </filter>
          <linearGradient id="dFloor" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9C6A9C" stopOpacity="0">
            </stop>
            <stop offset="0.3" stopColor="#C995B0" stopOpacity="0.8">
            </stop>
            <stop offset="0.6" stopColor="#F6C9AE">
            </stop>
            <stop offset="1" stopColor="#C995B0" stopOpacity="0.3">
            </stop>
          </linearGradient>
        </defs>
        <path className="mv-breathe-d" d="M -40 640 C 380 560, 900 560, 1480 470" fill="none" stroke="#D99AAE" strokeWidth="26" opacity="0.18" filter="url(#dB2)">
        </path>
        <path d="M -40 640 C 380 560, 900 560, 1480 470" fill="none" stroke="url(#dFloor)" strokeWidth="5" opacity="0.55" filter="url(#dB1)">
        </path>
        <path d="M -40 640 C 380 560, 900 560, 1480 470" fill="none" stroke="url(#dFloor)" strokeWidth="1.2">
        </path>
      </svg>
      <div className="mv-px" style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "0 40px", display: "flex", flexWrap: "wrap", gap: "40px", alignItems: "center" }}>
        <div style={{ flex: "1 1 380px", minWidth: "0", position: "relative", zIndex: "1" }}>
          <p style={{ margin: "0", fontSize: "12px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#9E8D99" }}>
            Co zjistíte zdarma
          </p>
          <h2 className="mv-h66" style={{ margin: "16px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "66px", lineHeight: "1", background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Vztahová DNA
          </h2>
          <p style={{ margin: "24px 0 0", fontSize: "18px", lineHeight: "1.65", color: "#C9B9C3", maxWidth: "460px" }}>
            Krátká, dokončená analýza vaší společné dynamiky. Hlavní vzorec, který mezi vámi vzniká, a k němu to, co váš výpočet podloží nejsilněji.
          </p>
          <p style={{ margin: "14px 0 0", fontSize: "18px", lineHeight: "1.65", color: "#C9B9C3", maxWidth: "460px" }}>
            Není to upoutávka. Je to celý výsledek — a u každého závěru uvidíte, na čem stojí.
          </p>
          <a href="#ukazka" className="mv-btn-d" style={{ marginTop: "32px", display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "50px", padding: "0 26px", borderRadius: "999px", border: "1.5px solid #E6D3CC", color: "#F2E8E4", textDecoration: "none", fontSize: "14px" }}>
            {"Ukázka výsledku "}
            <span aria-hidden="true">
              →
            </span>
          </a>
        </div>
        <div className="mv-d" style={{ flex: "1 1 640px", minWidth: "0" }}>
        <div aria-label="Ukázka Vztahové DNA" role="img" style={{ flex: "1 1 640px", minWidth: "0", position: "relative", height: "470px", perspective: "1500px" }}>
          {/* karta 3 — nejvzdálenější */}
          <div style={{ position: "absolute", left: "400px", top: "34px", width: "230px", height: "330px", transform: "rotateY(-16deg) rotateZ(1.5deg)", zIndex: "1" }}>
            <div style={{ width: "100%", height: "100%", boxSizing: "border-box", borderRadius: "12px", border: "1px solid rgba(236, 212, 200, 0.2)", background: "linear-gradient(170deg, #241A27, #140E16)", padding: "24px 22px", display: "flex", flexDirection: "column", boxShadow: "0 30px 70px rgba(0, 0, 0, 0.6)" }}>
              <p style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "22px", lineHeight: "1.15", color: "#EAD9CF" }}>
                Na čem
                <br />
                to stojí
              </p>
              <svg aria-hidden="true" width="140" height="104" viewBox="0 0 140 104" style={{ margin: "18px auto 0" }}>
                <defs>
                  <filter id="dRing" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3">
                    </feGaussianBlur>
                  </filter>
                </defs>
                <circle cx="54" cy="52" r="38" fill="none" stroke="#E8B391" strokeWidth="5" opacity="0.35" filter="url(#dRing)">
                </circle>
                <circle cx="86" cy="52" r="38" fill="none" stroke="#C995B0" strokeWidth="5" opacity="0.3" filter="url(#dRing)">
                </circle>
                <circle cx="54" cy="52" r="38" fill="none" stroke="#F3C9AD" strokeWidth="1.6">
                </circle>
                <circle cx="86" cy="52" r="38" fill="none" stroke="#D8AABE" strokeWidth="1.2">
                </circle>
              </svg>
              <p style={{ margin: "16px 0 0", fontSize: "12px", lineHeight: "1.55", color: "#A897A3" }}>
                Hlavní vzorec podpírá vazba Měsíce první osoby a Venuše druhé osoby.
              </p>
            </div>
          </div>
          {/* karta 2 */}
          <div style={{ position: "absolute", left: "215px", top: "18px", width: "250px", height: "360px", transform: "rotateY(-16deg) rotateZ(1deg)", zIndex: "2" }}>
            <div style={{ width: "100%", height: "100%", boxSizing: "border-box", borderRadius: "12px", border: "1px solid rgba(236, 212, 200, 0.22)", background: "linear-gradient(170deg, #281D2B, #160F18)", padding: "26px 22px", display: "flex", flexDirection: "column", boxShadow: "0 34px 80px rgba(0, 0, 0, 0.65)" }}>
              <p style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "23px", lineHeight: "1.12", color: "#EAD9CF" }}>
                Hlavní témata
                <br />
                vašeho vztahu
              </p>
              <div style={{ marginTop: "18px", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "10px 0", borderTop: "1px solid rgba(236, 212, 200, 0.12)" }}>
                  <p style={{ margin: "0", fontSize: "12px", fontWeight: "400", color: "#E8DDE2" }}>
                    Hlavní vzorec
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#9E8D99" }}>
                    Nápady a jejich dotažení
                  </p>
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid rgba(236, 212, 200, 0.12)" }}>
                  <p style={{ margin: "0", fontSize: "12px", fontWeight: "400", color: "#E8DDE2" }}>
                    Rytmus rozhodování
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#9E8D99" }}>
                    Dvě různá tempa
                  </p>
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid rgba(236, 212, 200, 0.12)" }}>
                  <p style={{ margin: "0", fontSize: "12px", fontWeight: "400", color: "#E8DDE2" }}>
                    Co vás drží
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#9E8D99" }}>
                    Společný humor
                  </p>
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid rgba(236, 212, 200, 0.12)" }}>
                  <p style={{ margin: "0", fontSize: "12px", fontWeight: "400", color: "#E8DDE2" }}>
                    Kde se míjíte
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#9E8D99" }}>
                    Návrat po neshodě
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* karta 1 — obálka vepředu */}
          <div className="mv-float-d" style={{ position: "absolute", left: "0", top: "0", width: "270px", height: "390px", transform: "rotateY(-16deg) rotateZ(-2.5deg)", zIndex: "3" }}>
            <div style={{ position: "relative", width: "100%", height: "100%", boxSizing: "border-box", borderRadius: "12px", border: "1px solid rgba(236, 212, 200, 0.3)", background: "linear-gradient(165deg, #2B1E2F, #120C14)", padding: "28px 22px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 40px 90px rgba(0, 0, 0, 0.7)" }}>
              <svg aria-hidden="true" viewBox="0 0 270 390" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}>
                <defs>
                  <filter id="cB1" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3">
                    </feGaussianBlur>
                  </filter>
                  <filter id="cB2" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="12">
                    </feGaussianBlur>
                  </filter>
                  <linearGradient id="cA" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0" stopColor="#9C6A9C" stopOpacity="0.2">
                    </stop>
                    <stop offset="0.55" stopColor="#FFE6D4">
                    </stop>
                    <stop offset="1" stopColor="#D99AAE" stopOpacity="0.5">
                    </stop>
                  </linearGradient>
                </defs>
                <path d="M -10 300 C 70 230, 170 220, 290 160" fill="none" stroke="#E9A08C" strokeWidth="22" opacity="0.25" filter="url(#cB2)">
                </path>
                <path d="M -10 300 C 70 230, 170 220, 290 160" fill="none" stroke="#F6C2A4" strokeWidth="5" opacity="0.7" filter="url(#cB1)">
                </path>
                <path d="M -10 300 C 70 230, 170 220, 290 160" fill="none" stroke="url(#cA)" strokeWidth="1.4">
                </path>
                <path d="M 20 340 C 100 250, 200 170, 280 70" fill="none" stroke="#C995B0" strokeWidth="0.8" opacity="0.6">
                </path>
              </svg>
              <p style={{ position: "relative", margin: "0", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "12px", letterSpacing: "0.26em", color: "#E2D6DC" }}>
                MEZI VÁMI
              </p>
              <p style={{ position: "relative", margin: "50px 0 0", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "32px", lineHeight: "1", color: "#F2DDD0" }}>
                Vztahová DNA
              </p>
              <p style={{ position: "relative", margin: "10px 0 0", textAlign: "center", fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#9E8D99" }}>
                vaše společná dynamika
              </p>
              <div style={{ position: "relative", marginTop: "auto", display: "flex", justifyContent: "space-between", fontSize: "11px", lineHeight: "1.5", color: "#B9A8B5" }}>
                <span>
                  První osoba
                  <br />
                  14. 5. 1990
                </span>
                <span style={{ textAlign: "right" }}>
                  Druhá osoba
                  <br />
                  23. 8. 1988
                </span>
              </div>
            </div>
          </div>
          <p style={{ position: "absolute", left: "0", right: "0", bottom: "0", margin: "0", textAlign: "center", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7E6E7A" }}>
            Ukázkový obsah · neodpovídá žádné skutečné dvojici
          </p>
        </div>
        </div>
        <div className="mv-m" style={{ flex: "1 1 280px", minWidth: "0" }}>
          <DnaCardsMobile />
        </div>
      </div>
    </section>
    {/* ============ JAK TO FUNGUJE ============ */}
    <section className="mv-px" id="jak" style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "20px 40px 110px" }}>
      <p style={{ margin: "0", fontSize: "12px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#9E8D99" }}>
        Jak to funguje
      </p>
      <h2 className="mv-h50" style={{ margin: "16px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "50px", lineHeight: "1.05", color: "#F2E8E4", maxWidth: "720px" }}>
        Tři kroky. Žádný kvíz.
      </h2>
      <ol style={{ margin: "48px 0 0", padding: "0", listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "28px" }}>
        <li style={{ borderTop: "1px solid rgba(236, 212, 200, 0.18)", paddingTop: "24px" }}>
          <p style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "40px", color: "#E8B391" }}>
            1
          </p>
          <p style={{ margin: "10px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "25px", color: "#F2E8E4" }}>
            Zadáte údaje obou
          </p>
          <p style={{ margin: "10px 0 0", fontSize: "15px", lineHeight: "1.65", color: "#A897A3" }}>
            Datum, místo a — pokud ho znáte — čas narození. Zvlášť pro první a pro druhou osobu.
          </p>
        </li>
        <li style={{ borderTop: "1px solid rgba(236, 212, 200, 0.18)", paddingTop: "24px" }}>
          <p style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "40px", color: "#E8B391" }}>
            2
          </p>
          <p style={{ margin: "10px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "25px", color: "#F2E8E4" }}>
            Spočítáme vás dva najednou
          </p>
          <p style={{ margin: "10px 0 0", fontSize: "15px", lineHeight: "1.65", color: "#A897A3" }}>
            Ne dvě kartičky vedle sebe, ale to, co vzniká mezi vámi. Výpočet trvá jen chvíli a nic neprodlužujeme.
          </p>
        </li>
        <li style={{ borderTop: "1px solid rgba(236, 212, 200, 0.18)", paddingTop: "24px" }}>
          <p style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "40px", color: "#E8B391" }}>
            3
          </p>
          <p style={{ margin: "10px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "25px", color: "#F2E8E4" }}>
            Přečtete si výsledek
          </p>
          <p style={{ margin: "10px 0 0", fontSize: "15px", lineHeight: "1.65", color: "#A897A3" }}>
            Celou Vztahovou DNA zdarma. Pokud budete chtít jít hlouběji, nabídneme Hloubkovou analýzu — až potom.
          </p>
        </li>
      </ol>
      <div style={{ marginTop: "44px", display: "flex", flexWrap: "wrap", gap: "16px 32px", alignItems: "center", borderRadius: "16px", border: "1px solid rgba(236, 212, 200, 0.16)", background: "rgba(42, 32, 44, 0.5)", padding: "22px 26px" }}>
        <p style={{ flex: "1 1 420px", margin: "0", fontSize: "15px", lineHeight: "1.65", color: "#C9B9C3" }}>
          <span style={{ color: "#E9C8B5" }}>
            Neznáte čas narození?
          </span>
          {" Nevadí. Vztahovou DNA spočítáme i bez něj — jen vynecháme to, co na přesném čase závisí, a řekneme vám přesně co."}
        </p>
        <a href="#otazky" style={{ fontSize: "14px" }}>
          Víc o čase narození
        </a>
      </div>
    </section>
    {/* ============ HLOUBKOVÁ ANALÝZA ============ */}
    <section id="cena" style={{ position: "relative", maxWidth: "1360px", margin: "0 auto", padding: "0 24px 110px" }}>
      <div className="mv-offer" style={{ position: "relative", borderRadius: "22px", border: "1px solid rgba(236, 212, 200, 0.16)", background: "linear-gradient(180deg, rgba(26, 19, 28, 0.92), rgba(18, 13, 20, 0.95))", boxShadow: "0 40px 100px rgba(0, 0, 0, 0.5)", padding: "56px 56px 48px", overflow: "hidden" }}>
        <svg aria-hidden="true" viewBox="0 0 1300 620" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <filter id="oPool" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="70">
              </feGaussianBlur>
            </filter>
          </defs>
          <ellipse cx="1110" cy="300" rx="240" ry="200" fill="#3A1838" opacity="0.6" filter="url(#oPool)">
          </ellipse>
        </svg>
        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: "48px", alignItems: "center" }}>
          <div style={{ flex: "1.2 1 380px", minWidth: "0" }}>
            <p style={{ margin: "0", fontSize: "12px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#9E8D99" }}>
              Pro hlubší porozumění
            </p>
            <h2 className="mv-h60" style={{ margin: "14px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "60px", lineHeight: "1", background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              Hloubková analýza
            </h2>
            <p className="mv-price46" style={{ margin: "6px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "46px", lineHeight: "1.1", color: "#C2A8B8" }}>
              1 990 Kč
            </p>
            <p style={{ margin: "18px 0 0", fontSize: "17px", lineHeight: "1.65", color: "#C9B9C3", maxWidth: "460px" }}>
              Rozsáhlá designovaná analýza vaší dvojice v PDF. Jednorázově, bez předplatného — od hlavních dynamik až po konkrétní věci, které můžete doma zkusit jinak.
            </p>
            <Link href="/mezi-vami/osoba" prefetch={false} className="mv-btn-d" style={{ marginTop: "32px", display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "58px", padding: "0 34px", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1622", textDecoration: "none", fontSize: "16px", fontWeight: "400", boxShadow: "0 10px 34px rgba(232, 170, 135, 0.35), 0 0 60px rgba(232, 170, 135, 0.18), inset 0 1px 0 rgba(255, 244, 236, 0.6)" }}>
              {"Nejdřív Vztahová DNA zdarma "}
              <span aria-hidden="true">
                →
              </span>
            </Link>
            <p style={{ margin: "12px 0 0", fontSize: "13px", color: "#A897A3" }}>
              Hloubkovou analýzu objednáte až po výsledku, pokud budete chtít.
            </p>
          </div>
          <ul style={{ flex: "1 1 280px", minWidth: "0", margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "24px" }}>
            <li style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <span aria-hidden="true" style={{ flex: "0 0 auto", width: "48px", height: "48px", borderRadius: "999px", border: "1px solid rgba(236, 212, 200, 0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#E2D6DC" strokeWidth="1.3">
                  <rect x="3.5" y="2" width="11" height="14" rx="1.5">
                  </rect>
                  <path d="M6.5 6h5M6.5 9h5M6.5 12h3">
                  </path>
                </svg>
              </span>
              <span>
                <span style={{ display: "block", fontSize: "15px", fontWeight: "400", color: "#F2E8E4" }}>
                  Devět částí
                </span>
                <span style={{ display: "block", marginTop: "3px", fontSize: "13px", color: "#9E8D99" }}>
                  Od podstatného po tipy na doma
                </span>
              </span>
            </li>
            <li style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <span aria-hidden="true" style={{ flex: "0 0 auto", width: "48px", height: "48px", borderRadius: "999px", border: "1px solid rgba(236, 212, 200, 0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#E2D6DC" strokeWidth="1.3">
                  <circle cx="7" cy="9" r="4.5">
                  </circle>
                  <circle cx="11" cy="9" r="4.5">
                  </circle>
                </svg>
              </span>
              <span>
                <span style={{ display: "block", fontSize: "15px", fontWeight: "400", color: "#F2E8E4" }}>
                  Podložené výpočtem
                </span>
                <span style={{ display: "block", marginTop: "3px", fontSize: "13px", color: "#9E8D99" }}>
                  Nic, co by vaše údaje neunesly
                </span>
              </span>
            </li>
            <li style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <span aria-hidden="true" style={{ flex: "0 0 auto", width: "48px", height: "48px", borderRadius: "999px", border: "1px solid rgba(236, 212, 200, 0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#E2D6DC" strokeWidth="1.3">
                  <circle cx="9" cy="9" r="6.5">
                  </circle>
                  <path d="M9 5v4l2.5 1.5">
                  </path>
                </svg>
              </span>
              <span>
                <span style={{ display: "block", fontSize: "15px", fontWeight: "400", color: "#F2E8E4" }}>
                  Do 48 hodin e-mailem
                </span>
                <span style={{ display: "block", marginTop: "3px", fontSize: "13px", color: "#9E8D99" }}>
                  Bezpečný odkaz, platný 30 dní
                </span>
              </span>
            </li>
            <li style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <span aria-hidden="true" style={{ flex: "0 0 auto", width: "48px", height: "48px", borderRadius: "999px", border: "1px solid rgba(236, 212, 200, 0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#E2D6DC" strokeWidth="1.3">
                  <path d="M9 15.5s-6-3.6-6-8a3.3 3.3 0 0 1 6-1.9A3.3 3.3 0 0 1 15 7.5c0 4.4-6 8-6 8z">
                  </path>
                </svg>
              </span>
              <span>
                <span style={{ display: "block", fontSize: "15px", fontWeight: "400", color: "#F2E8E4" }}>
                  Krásně zpracované PDF
                </span>
                <span style={{ display: "block", marginTop: "3px", fontSize: "13px", color: "#9E8D99" }}>
                  Na mobil i k vytištění
                </span>
              </span>
            </li>
          </ul>
          <div className="mv-d" style={{ flex: "0 1 320px", minWidth: "260px" }}>
          <div aria-hidden="true" style={{ flex: "0 1 320px", minWidth: "260px", position: "relative", height: "400px" }}>
            <div style={{ position: "absolute", left: "70px", top: "46px", width: "220px", height: "310px", borderRadius: "4px", background: "linear-gradient(170deg, #D9CBD5, #B9A6B5)", transform: "rotateZ(11deg)", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)" }}>
            </div>
            <div style={{ position: "absolute", left: "56px", top: "42px", width: "220px", height: "310px", borderRadius: "4px", background: "linear-gradient(170deg, #E6D9E1, #C8B6C3)", transform: "rotateZ(7.5deg)", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)" }}>
            </div>
            <div style={{ position: "absolute", left: "42px", top: "40px", width: "220px", height: "310px", borderRadius: "4px", background: "linear-gradient(170deg, #F1E7EC, #D6C6D0)", transform: "rotateZ(4deg)", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)" }}>
            </div>
            <div className="mv-float-d" style={{ position: "absolute", left: "22px", top: "40px", width: "220px", height: "310px", transform: "rotateZ(-3deg)" }}>
              <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "4px", background: "linear-gradient(165deg, #2B1E2F, #110B13)", overflow: "hidden", boxShadow: "0 40px 80px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(236, 212, 200, 0.22)" }}>
                <svg viewBox="0 0 220 310" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}>
                  <defs>
                    <filter id="rB1" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="3">
                      </feGaussianBlur>
                    </filter>
                    <filter id="rB2" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="11">
                      </feGaussianBlur>
                    </filter>
                    <linearGradient id="rA" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0" stopColor="#9C6A9C" stopOpacity="0.2">
                      </stop>
                      <stop offset="0.55" stopColor="#FFE6D4">
                      </stop>
                      <stop offset="1" stopColor="#D99AAE" stopOpacity="0.5">
                      </stop>
                    </linearGradient>
                  </defs>
                  <path d="M -10 290 C 60 220, 140 170, 235 80" fill="none" stroke="#E9A08C" strokeWidth="20" opacity="0.25" filter="url(#rB2)">
                  </path>
                  <path d="M -10 290 C 60 220, 140 170, 235 80" fill="none" stroke="#F6C2A4" strokeWidth="5" opacity="0.7" filter="url(#rB1)">
                  </path>
                  <path d="M -10 290 C 60 220, 140 170, 235 80" fill="none" stroke="url(#rA)" strokeWidth="1.3">
                  </path>
                  <path d="M 10 310 C 80 250, 150 240, 230 210" fill="none" stroke="#C995B0" strokeWidth="0.8" opacity="0.6">
                  </path>
                </svg>
                <p style={{ position: "absolute", left: "0", right: "0", top: "26px", margin: "0", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "11px", letterSpacing: "0.26em", color: "#E2D6DC" }}>
                  MEZI VÁMI
                </p>
                <p style={{ position: "absolute", left: "18px", right: "18px", top: "82px", margin: "0", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "31px", lineHeight: "1.05", color: "#F2DDD0" }}>
                  Hloubková
                  <br />
                  analýza
                </p>
              </div>
            </div>
          </div>
          </div>
          <div className="mv-m" style={{ flex: "1 1 100%", minWidth: "0" }}>
            <ReportMockMobile />
          </div>
        </div>
        <div style={{ position: "relative", marginTop: "44px", paddingTop: "30px", borderTop: "1px solid rgba(236, 212, 200, 0.12)" }}>
          <p style={{ margin: "0 0 18px", fontSize: "12px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#9E8D99" }}>
            Co analýza pokrývá
          </p>
          <ol style={{ margin: "0", padding: "0", listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "14px 36px", fontSize: "15px", color: "#C9B9C3" }}>
            <li style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
              <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "19px", color: "#E8B391" }}>
                01
              </span>
              Nejdřív to nejdůležitější
            </li>
            <li style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
              <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "19px", color: "#E8B391" }}>
                02
              </span>
              Jak každý z vás funguje ve vztahu
            </li>
            <li style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
              <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "19px", color: "#E8B391" }}>
                03
              </span>
              Pět vztahů uvnitř jednoho
            </li>
            <li style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
              <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "19px", color: "#E8B391" }}>
                04
              </span>
              Láska, přitažlivost a intimita
            </li>
            <li style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
              <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "19px", color: "#E8B391" }}>
                05
              </span>
              Emoce, komunikace a konflikt
            </li>
            <li style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
              <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "19px", color: "#E8B391" }}>
                06
              </span>
              Blízkost, svoboda a všední dny
            </li>
            <li style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
              <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "19px", color: "#E8B391" }}>
                07
              </span>
              Co v sobě probouzíte
            </li>
            <li style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
              <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "19px", color: "#E8B391" }}>
                08
              </span>
              Na doma
            </li>
            <li style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
              <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "19px", color: "#E8B391" }}>
                09
              </span>
              Pod kapotou
            </li>
          </ol>
        </div>
      </div>
    </section>
    {/* ============ UKÁZKA ============ */}
    <section className="mv-px" id="ukazka" style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "0 40px 110px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "24px" }}>
        <div style={{ flex: "1 1 480px", minWidth: "0" }}>
          <p style={{ margin: "0", fontSize: "12px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#9E8D99" }}>
            Ukázka
          </p>
          <h2 className="mv-h50" style={{ margin: "16px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "50px", lineHeight: "1.05", color: "#F2E8E4" }}>
            Podívejte se dovnitř dřív, než se rozhodnete.
          </h2>
        </div>
        <a href="#" className="mv-btn-d" style={{ display: "inline-flex", alignItems: "center", gap: "10px", minHeight: "50px", padding: "0 26px", borderRadius: "999px", border: "1.5px solid #E6D3CC", color: "#F2E8E4", textDecoration: "none", fontSize: "14px" }}>
          {"Celý vzorový report (PDF) "}
          <span aria-hidden="true">
            ↓
          </span>
        </a>
      </div>
      <div style={{ marginTop: "44px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "24px" }}>
        <figure style={{ margin: "0" }}>
          <div style={{ aspectRatio: "1 / 1.414", borderRadius: "6px", border: "1px solid rgba(236, 212, 200, 0.2)", background: "linear-gradient(170deg, #241A27, #120C14)", boxShadow: "0 30px 60px rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px", boxSizing: "border-box", fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8E7E8A" }}>
            [Náhled strany]
          </div>
          <figcaption style={{ marginTop: "12px", fontSize: "14px", color: "#A897A3" }}>
            Obsah reportu
          </figcaption>
        </figure>
        <figure style={{ margin: "0" }}>
          <div style={{ aspectRatio: "1 / 1.414", borderRadius: "6px", border: "1px solid rgba(236, 212, 200, 0.2)", background: "linear-gradient(170deg, #241A27, #120C14)", boxShadow: "0 30px 60px rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px", boxSizing: "border-box", fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8E7E8A" }}>
            [Náhled strany]
          </div>
          <figcaption style={{ marginTop: "12px", fontSize: "14px", color: "#A897A3" }}>
            Nejdřív to nejdůležitější
          </figcaption>
        </figure>
        <figure style={{ margin: "0" }}>
          <div style={{ aspectRatio: "1 / 1.414", borderRadius: "6px", border: "1px solid rgba(236, 212, 200, 0.2)", background: "linear-gradient(170deg, #241A27, #120C14)", boxShadow: "0 30px 60px rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px", boxSizing: "border-box", fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8E7E8A" }}>
            [Náhled strany]
          </div>
          <figcaption style={{ marginTop: "12px", fontSize: "14px", color: "#A897A3" }}>
            Emoce, komunikace a konflikt
          </figcaption>
        </figure>
        <figure style={{ margin: "0" }}>
          <div style={{ aspectRatio: "1 / 1.414", borderRadius: "6px", border: "1px solid rgba(236, 212, 200, 0.2)", background: "linear-gradient(170deg, #241A27, #120C14)", boxShadow: "0 30px 60px rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px", boxSizing: "border-box", fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8E7E8A" }}>
            [Náhled strany]
          </div>
          <figcaption style={{ marginTop: "12px", fontSize: "14px", color: "#A897A3" }}>
            Na doma
          </figcaption>
        </figure>
      </div>
      <p style={{ margin: "20px 0 0", fontSize: "13px", color: "#8E7E8A" }}>
        Vzorový report je zpracovaný pro smyšlenou dvojici. Bez e-mailu, rovnou ke stažení.
      </p>
    </section>
    {/* ============ OTÁZKY ============ */}
    <section className="mv-px" id="otazky" style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "0 40px 110px", display: "flex", flexWrap: "wrap", gap: "48px" }}>
      <div style={{ flex: "1 1 300px", minWidth: "0" }}>
        <p style={{ margin: "0", fontSize: "12px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#9E8D99" }}>
          Časté otázky
        </p>
        <h2 className="mv-h46" style={{ margin: "16px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "46px", lineHeight: "1.05", color: "#F2E8E4" }}>
          Co se lidé ptají, než začnou.
        </h2>
      </div>
      <div style={{ flex: "2 1 520px", minWidth: "0", display: "flex", flexDirection: "column" }}>
        <details open style={{ borderTop: "1px solid rgba(236, 212, 200, 0.16)", padding: "22px 0" }}>
          <summary style={{ display: "flex", justifyContent: "space-between", gap: "16px", minHeight: "28px", fontFamily: "var(--font-mv-garamond), serif", fontSize: "23px", color: "#F2E8E4" }}>
            Co když neznáme čas narození?
            <span aria-hidden="true" style={{ fontFamily: "var(--font-mv-jost), sans-serif", color: "#E8B391" }}>
              –
            </span>
          </summary>
          <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.7", color: "#A897A3", maxWidth: "620px" }}>
            Stačí datum a místo. Čas můžete zadat přesně, přibližně, nebo vůbec. Co na přesném čase závisí, vynecháme a ve výsledku to uvidíte.
          </p>
        </details>
        <details style={{ borderTop: "1px solid rgba(236, 212, 200, 0.16)", padding: "22px 0" }}>
          <summary style={{ display: "flex", justifyContent: "space-between", gap: "16px", minHeight: "28px", fontFamily: "var(--font-mv-garamond), serif", fontSize: "23px", color: "#F2E8E4" }}>
            Co se stane s našimi údaji?
            <span aria-hidden="true" style={{ fontFamily: "var(--font-mv-jost), sans-serif", color: "#E8B391" }}>
              +
            </span>
          </summary>
          <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.7", color: "#A897A3", maxWidth: "620px" }}>
            Nechceme jména ani kontakty. Pokud si nic neobjednáte, údaje o narození smažeme nejpozději do 72 hodin.
          </p>
        </details>
        <details style={{ borderTop: "1px solid rgba(236, 212, 200, 0.16)", padding: "22px 0" }}>
          <summary style={{ display: "flex", justifyContent: "space-between", gap: "16px", minHeight: "28px", fontFamily: "var(--font-mv-garamond), serif", fontSize: "23px", color: "#F2E8E4" }}>
            Předpovídáte budoucnost vztahu?
            <span aria-hidden="true" style={{ fontFamily: "var(--font-mv-jost), sans-serif", color: "#E8B391" }}>
              +
            </span>
          </summary>
          <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.7", color: "#A897A3", maxWidth: "620px" }}>
            Ne. Popisujeme dynamiku, která mezi vámi vzniká — ne to, co se stane. A nehodnotíme, kdo z vás má pravdu.
          </p>
        </details>
        <details style={{ borderTop: "1px solid rgba(236, 212, 200, 0.16)", borderBottom: "1px solid rgba(236, 212, 200, 0.16)", padding: "22px 0" }}>
          <summary style={{ display: "flex", justifyContent: "space-between", gap: "16px", minHeight: "28px", fontFamily: "var(--font-mv-garamond), serif", fontSize: "23px", color: "#F2E8E4" }}>
            Musím se registrovat?
            <span aria-hidden="true" style={{ fontFamily: "var(--font-mv-jost), sans-serif", color: "#E8B391" }}>
              +
            </span>
          </summary>
          <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.7", color: "#A897A3", maxWidth: "620px" }}>
            Ne. Vztahovou DNA uvidíte bez účtu i bez e-mailu. E-mail chceme až při objednávce, abychom měli kam poslat PDF.
          </p>
        </details>
      </div>
    </section>
    {/* ============ ZÁVĚREČNÉ CTA ============ */}
    <section className="mv-px" style={{ position: "relative", padding: "140px 40px 160px", textAlign: "center", overflow: "hidden" }}>
      <svg aria-hidden="true" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>
          <filter id="fB1" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5">
            </feGaussianBlur>
          </filter>
          <filter id="fB2" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14">
            </feGaussianBlur>
          </filter>
          <linearGradient id="fA" gradientUnits="userSpaceOnUse" x1="-40" y1="0" x2="1480" y2="0">
            <stop offset="0" stopColor="#9C6A9C" stopOpacity="0">
            </stop>
            <stop offset="0.35" stopColor="#C995B0" stopOpacity="0.8">
            </stop>
            <stop offset="0.55" stopColor="#FFEBDC">
            </stop>
            <stop offset="0.75" stopColor="#F3BE9E">
            </stop>
            <stop offset="1" stopColor="#9C6A9C" stopOpacity="0">
            </stop>
          </linearGradient>
        </defs>
        <path className="mv-breathe-d" d="M -40 470 C 420 170, 1020 170, 1480 470" fill="none" stroke="#E9A08C" strokeWidth="28" opacity="0.18" filter="url(#fB2)">
        </path>
        <path className="mv-breathe-d" d="M -40 470 C 420 170, 1020 170, 1480 470" fill="none" stroke="#F6C2A4" strokeWidth="6" opacity="0.55" filter="url(#fB1)">
        </path>
        <path d="M -40 470 C 420 170, 1020 170, 1480 470" fill="none" stroke="url(#fA)" strokeWidth="1.6">
        </path>
      </svg>
      <h2 style={{ position: "relative", margin: "0 auto", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "clamp(42px, 5vw, 66px)", lineHeight: "1.05", maxWidth: "860px" }}>
        <span style={{ background: "linear-gradient(180deg, #F6E6DA 0%, #E9C8B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          Ten vzorec už mezi vámi je.
        </span>
        <br />
        <span style={{ background: "linear-gradient(180deg, #CDB2C0 0%, #A98FA2 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          Stačí ho uvidět.
        </span>
      </h2>
      <Link href="/mezi-vami/osoba" prefetch={false} className="mv-btn-d" style={{ position: "relative", marginTop: "40px", display: "inline-flex", alignItems: "center", gap: "12px", minHeight: "60px", padding: "0 36px", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1622", textDecoration: "none", fontSize: "17px", fontWeight: "400", boxShadow: "0 10px 34px rgba(232, 170, 135, 0.35), 0 0 60px rgba(232, 170, 135, 0.18), inset 0 1px 0 rgba(255, 244, 236, 0.6)" }}>
        {"Zjistit vaši Vztahovou DNA zdarma "}
        <span aria-hidden="true">
          →
        </span>
      </Link>
      <p style={{ position: "relative", margin: "16px 0 0", fontSize: "14px", color: "#A897A3" }}>
        Zdarma a hned. Hloubková analýza 1 990 Kč až po výsledku.
      </p>
    </section>
    <footer style={{ position: "relative", borderTop: "1px solid rgba(236, 212, 200, 0.1)" }}>
      <div className="mv-px" style={{ maxWidth: "1280px", margin: "0 auto", padding: "36px 40px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "20px", alignItems: "center", fontSize: "13px", color: "#8E7E8A" }}>
        <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "20px", letterSpacing: "0.22em", color: "#E2D6DC" }}>
          MEZI VÁMI
        </span>
        <nav aria-label="Patička" style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
          <a href="#" style={{ color: "#A897A3" }}>
            Obchodní podmínky
          </a>
          <a href="#" style={{ color: "#A897A3" }}>
            Ochrana údajů
          </a>
          <a href="#" style={{ color: "#A897A3" }}>
            Reklamace a vrácení
          </a>
          <a href="#" style={{ color: "#A897A3" }}>
            Kontakt
          </a>
        </nav>
        <span>
          © 2026 [PRODEJCE] · [IČO]
        </span>
      </div>
    </footer>
    </>
  );
}
