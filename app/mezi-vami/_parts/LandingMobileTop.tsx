// Převedeno skriptem z design/mezi-vami/Mobil-01-Landing.dc.html (řádky 23–78), pak ručně upraveno.
import Link from "next/link";
import { MobileMenu } from "./MobileMenu";

export function LandingMobileTop() {
  return (
    <>
    <svg aria-hidden="true" viewBox="0 0 375 760" preserveAspectRatio="none" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "760px", pointerEvents: "none" }}>
      <defs>
        <filter id="m1B1" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3">
          </feGaussianBlur>
        </filter>
        <filter id="m1B2" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10">
          </feGaussianBlur>
        </filter>
        <filter id="m1Pool" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="50">
          </feGaussianBlur>
        </filter>
        <linearGradient id="m1A" gradientUnits="userSpaceOnUse" x1="270" y1="-20" x2="390" y2="330">
          <stop offset="0" stopColor="#F6C9A8" stopOpacity="0.5">
          </stop>
          <stop offset="0.3" stopColor="#FFEBDC">
          </stop>
          <stop offset="0.7" stopColor="#F3BE9E">
          </stop>
          <stop offset="1" stopColor="#D98FA6" stopOpacity="0.6">
          </stop>
        </linearGradient>
        <linearGradient id="m1B" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="400" y2="0">
          <stop offset="0" stopColor="#9C6A9C" stopOpacity="0">
          </stop>
          <stop offset="0.45" stopColor="#C995B0" stopOpacity="0.7">
          </stop>
          <stop offset="1" stopColor="#F2C2A8">
          </stop>
        </linearGradient>
      </defs>
      <ellipse cx="320" cy="140" rx="180" ry="160" fill="#3A1838" opacity="0.6" filter="url(#m1Pool)">
      </ellipse>
      <g className="mv-breathe-m1">
        <path d="M 280 -20 C 255 90, 270 190, 400 330" fill="none" stroke="#E9A08C" strokeWidth="20" opacity="0.22" filter="url(#m1B2)">
        </path>
        <path d="M 280 -20 C 255 90, 270 190, 400 330" fill="none" stroke="#F6C2A4" strokeWidth="5" opacity="0.7" filter="url(#m1B1)">
        </path>
        <path d="M 40 40 C 170 30, 300 120, 400 360" fill="none" stroke="#E7B0B4" strokeWidth="3" opacity="0.45" filter="url(#m1B1)">
        </path>
      </g>
      <path d="M 280 -20 C 255 90, 270 190, 400 330" fill="none" stroke="url(#m1A)" strokeWidth="1.5">
      </path>
      <path d="M 40 40 C 170 30, 300 120, 400 360" fill="none" stroke="url(#m1B)" strokeWidth="1">
      </path>
      <path className="mv-travel-m1" d="M 40 40 C 170 30, 300 120, 400 360" fill="none" stroke="#FFF1E6" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="36 724" opacity="0.7" filter="url(#m1B1)">
      </path>
      <path d="M -20 700 C 120 640, 260 620, 400 600" fill="none" stroke="#C995B0" strokeWidth="0.9" opacity="0.4">
      </path>
    </svg>
    <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 14px 20px" }}>
      <Link href="/mezi-vami" prefetch={false} style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "20px", letterSpacing: "0.22em", color: "#F2E8E4", textDecoration: "none" }}>
        MEZI VÁMI
      </Link>
      <MobileMenu />
    </header>
    <div style={{ position: "relative", padding: "52px 20px 0" }}>
      <h1 style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "58px", lineHeight: "1", letterSpacing: "-0.01em" }}>
        <span style={{ background: "linear-gradient(180deg, #F6E6DA 0%, #E9C8B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          Co vzniká
        </span>
        <br />
        <span style={{ background: "linear-gradient(180deg, #CDB2C0 0%, #A98FA2 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          mezi vámi?
        </span>
      </h1>
      <p style={{ margin: "20px 0 0", fontSize: "22px", lineHeight: "1.35", color: "#B9A8B5" }}>
        Dva lidé. Jeden vztah.
        <br />
        Vzorec, který uvidíte až spolu.
      </p>
      <Link href="/mezi-vami/osoba" prefetch={false} style={{ marginTop: "32px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "56px", borderRadius: "999px", border: "1.5px solid #E6D3CC", color: "#F2E8E4", textDecoration: "none", fontSize: "16px" }}>
        {"Zjistit vaši Vztahovou DNA zdarma "}
        <span aria-hidden="true">
          →
        </span>
      </Link>
      <p style={{ margin: "14px 0 0", fontSize: "13px", lineHeight: "1.55", color: "#A897A3", textAlign: "center" }}>
        Zdarma a hned, bez e-mailu.
        <br />
        {"Hloubková analýza "}
        <span style={{ color: "#E9C8B5" }}>
          1 990 Kč
        </span>
        {" je dobrovolná — až po výsledku."}
      </p>
    </div>
    <div style={{ position: "relative", margin: "36px 16px 0", borderRadius: "20px", border: "1px solid transparent", background: "linear-gradient(180deg, rgba(42, 32, 44, 0.85), rgba(26, 19, 28, 0.85)) padding-box, linear-gradient(180deg, rgba(236, 212, 200, 0.55), rgba(236, 212, 200, 0.14) 60%, rgba(236, 212, 200, 0.22)) border-box", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 30px 70px rgba(0, 0, 0, 0.55)", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.09)", background: "linear-gradient(180deg, rgba(88, 74, 90, 0.5), rgba(58, 46, 60, 0.5))", padding: "16px 16px" }}>
        <p style={{ margin: "0", fontSize: "15px", fontWeight: "400", color: "#F2E8E4" }}>
          První osoba
        </p>
        <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
          <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", height: "38px", padding: "0 12px", borderRadius: "8px", background: "rgba(14, 10, 16, 0.55)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)", fontSize: "12px", color: "#8E7E8A" }}>
            Datum narození
          </span>
          <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", height: "38px", padding: "0 12px", borderRadius: "8px", background: "rgba(14, 10, 16, 0.55)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)", fontSize: "12px", color: "#8E7E8A" }}>
            Místo
          </span>
        </div>
      </div>
      <div style={{ borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.09)", background: "linear-gradient(180deg, rgba(88, 74, 90, 0.5), rgba(58, 46, 60, 0.5))", padding: "16px 16px" }}>
        <p style={{ margin: "0", fontSize: "15px", fontWeight: "400", color: "#F2E8E4" }}>
          Druhá osoba
        </p>
        <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
          <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", height: "38px", padding: "0 12px", borderRadius: "8px", background: "rgba(14, 10, 16, 0.55)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)", fontSize: "12px", color: "#8E7E8A" }}>
            Datum narození
          </span>
          <span style={{ flex: "1 1 0", display: "flex", alignItems: "center", height: "38px", padding: "0 12px", borderRadius: "8px", background: "rgba(14, 10, 16, 0.55)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)", fontSize: "12px", color: "#8E7E8A" }}>
            Místo
          </span>
        </div>
      </div>
      <Link href="/mezi-vami/osoba" prefetch={false} style={{ marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", minHeight: "56px", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1622", textDecoration: "none", fontSize: "16px", boxShadow: "0 10px 30px rgba(232, 170, 135, 0.35), 0 0 50px rgba(232, 170, 135, 0.18), inset 0 1px 0 rgba(255, 244, 236, 0.6)" }}>
        {"Začít první osobou "}
        <span aria-hidden="true">
          →
        </span>
      </Link>
      <p style={{ margin: "2px 0 4px", textAlign: "center", fontSize: "12px", color: "#A897A3" }}>
        Výsledek hned. Bez registrace.
      </p>
    </div>
    <ul style={{ position: "relative", margin: "26px 0 0", padding: "0 20px", listStyle: "none", display: "flex", flexDirection: "column", gap: "12px", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#9E8D99" }}>
      <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span aria-hidden="true" style={{ width: "24px", height: "1px", background: "#6A5866" }}>
        </span>
        Z údajů o narození obou
      </li>
      <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span aria-hidden="true" style={{ width: "24px", height: "1px", background: "#6A5866" }}>
        </span>
        Bez registrace
      </li>
      <li style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span aria-hidden="true" style={{ width: "24px", height: "1px", background: "#6A5866" }}>
        </span>
        Údaje mažeme do 72 hodin
      </li>
    </ul>
    </>
  );
}
