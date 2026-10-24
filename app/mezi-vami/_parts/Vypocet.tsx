// Převedeno skriptem z design/mezi-vami/Mobil-03-Vypocet.dc.html (řádky 31–112), pak ručně upraveno.
import Link from "next/link";

export function Vypocet() {
  return (
    <>
    <svg aria-hidden="true" viewBox="0 0 375 420" style={{ position: "absolute", left: "50%", marginLeft: "-187.5px", top: "0", width: "375px", height: "420px", overflow: "visible", pointerEvents: "none" }}>
      <defs>
        <filter id="m3B1" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5">
          </feGaussianBlur>
        </filter>
        <filter id="m3B2" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14">
          </feGaussianBlur>
        </filter>
        <filter id="m3B3" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="40">
          </feGaussianBlur>
        </filter>
        <clipPath id="m3Clip">
          <circle cx="160" cy="150" r="66">
          </circle>
        </clipPath>
        <radialGradient id="m3Fl">
          <stop offset="0" stopColor="#FFFFFF">
          </stop>
          <stop offset="0.16" stopColor="#FFEBDD" stopOpacity="0.95">
          </stop>
          <stop offset="0.45" stopColor="#F2A98E" stopOpacity="0.35">
          </stop>
          <stop offset="1" stopColor="#F2A98E" stopOpacity="0">
          </stop>
        </radialGradient>
        <linearGradient id="m3RingA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6C9D6">
          </stop>
          <stop offset="1" stopColor="#9A74B8">
          </stop>
        </linearGradient>
        <linearGradient id="m3RingB" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE3CC">
          </stop>
          <stop offset="1" stopColor="#D98E78">
          </stop>
        </linearGradient>
      </defs>
      <ellipse cx="188" cy="160" rx="170" ry="130" fill="#3A1838" opacity="0.65" filter="url(#m3B3)">
      </ellipse>
      <ellipse cx="188" cy="150" rx="60" ry="50" fill="#D9806C" opacity="0.3" filter="url(#m3B3)">
      </ellipse>
      <circle cx="160" cy="150" r="66" fill="none" stroke="#E3A3BC" strokeWidth="10" opacity="0.35" filter="url(#m3B2)">
      </circle>
      <circle cx="216" cy="150" r="66" fill="none" stroke="#F0B48F" strokeWidth="10" opacity="0.35" filter="url(#m3B2)">
      </circle>
      <circle cx="160" cy="150" r="66" fill="none" stroke="url(#m3RingA)" strokeWidth="1.4">
      </circle>
      <circle cx="216" cy="150" r="66" fill="none" stroke="url(#m3RingB)" strokeWidth="1.4">
      </circle>
      <circle className="mv-spin-m3" cx="160" cy="150" r="74" fill="none" stroke="#E3A3BC" strokeWidth="0.6" strokeDasharray="1 7" opacity="0.6">
      </circle>
      <circle className="mv-spin-m3" cx="216" cy="150" r="74" fill="none" stroke="#F0B48F" strokeWidth="0.6" strokeDasharray="1 7" opacity="0.6">
      </circle>
      <g clipPath="url(#m3Clip)">
        <circle className="mv-breathe-m3" cx="216" cy="150" r="66" fill="#F2A98E" opacity="0.5" filter="url(#m3B2)">
        </circle>
      </g>
      <g className="mv-pulse-m3">
        <circle cx="188" cy="150" r="34" fill="url(#m3Fl)">
        </circle>
      </g>
    </svg>
    <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 14px 20px" }}>
      <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "18px", letterSpacing: "0.24em", color: "#EADCE2" }}>
        MEZI VÁMI
      </span>
      <Link href="/mezi-vami/osoba" prefetch={false} style={{ display: "inline-flex", alignItems: "center", minHeight: "44px", padding: "0 16px", borderRadius: "999px", border: "1px solid rgba(240, 190, 165, 0.4)", background: "rgba(255, 225, 205, 0.04)", color: "#EADCE2", textDecoration: "none", fontSize: "13px" }}>
        Upravit údaje
      </Link>
    </header>
    <div style={{ position: "relative", padding: "196px 20px 0" }}>
      <p style={{ margin: "0", textAlign: "center", fontSize: "11px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#B49DAA" }}>
        Výpočet hotový
      </p>
      <h1 style={{ margin: "10px 0 0", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "300", fontSize: "44px", lineHeight: "1.02", background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
        Spočítali jsme
        <br />
        vás dva.
      </h1>
      <div style={{ marginTop: "28px", borderRadius: "16px", border: "1px solid transparent", background: "linear-gradient(160deg, rgba(48, 26, 46, 0.8), rgba(28, 14, 30, 0.72)) padding-box, linear-gradient(120deg, rgba(255, 214, 190, 0.45), rgba(185, 138, 198, 0.12) 50%, rgba(255, 214, 190, 0.35)) border-box", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "15px 16px" }}>
          <span style={{ fontSize: "13px", color: "#C2ACB7" }}>
            První osoba
          </span>
          <span style={{ fontSize: "13px", color: "#F7EAE4", textAlign: "right" }}>
            14. 5. 1990 · Brno
            <br />
            <span style={{ color: "#F0B48F" }}>
              7:40 přesně
            </span>
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "15px 16px", borderTop: "1px solid rgba(240, 190, 165, 0.14)" }}>
          <span style={{ fontSize: "13px", color: "#C2ACB7" }}>
            Druhá osoba
          </span>
          <span style={{ fontSize: "13px", color: "#F7EAE4", textAlign: "right" }}>
            23. 8. 1988 · Žilina
            <br />
            <span style={{ color: "#C2ACB7" }}>
              čas neznámý
            </span>
          </span>
        </div>
      </div>
      <div style={{ marginTop: "14px", display: "flex", gap: "12px", alignItems: "flex-start", padding: "16px", borderRadius: "16px", background: "linear-gradient(160deg, rgba(240, 180, 143, 0.1), rgba(240, 180, 143, 0.03))", border: "1px solid rgba(240, 190, 165, 0.25)" }}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#F0B48F" strokeWidth="1.3" style={{ flex: "0 0 auto", marginTop: "2px" }}>
          <circle cx="10" cy="10" r="8">
          </circle>
          <path d="M10 9v5M10 6.2v.1">
          </path>
        </svg>
        <p style={{ margin: "0", fontSize: "14px", lineHeight: "1.6", color: "#EADCE2" }}>
          U první osoby jsme počítali s přesným časem. U druhé čas chybí — vše, co na něm závisí, jsme proto vynechali.
        </p>
      </div>
      <h2 style={{ margin: "38px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "29px", lineHeight: "1.12", color: "#F7EAE4" }}>
        Na čem váš výsledek stojí
      </h2>
      <p style={{ margin: "8px 0 0", fontSize: "14px", lineHeight: "1.6", color: "#C2ACB7" }}>
        Dvě konkrétní opory z vašeho výpočtu. U každého bloku níže uvidíte, ke které patří.
      </p>
      <ol style={{ margin: "18px 0 0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
        <li style={{ position: "relative", padding: "18px 18px 18px 22px", borderRadius: "16px", border: "1px solid transparent", background: "linear-gradient(170deg, rgba(46, 24, 48, 0.95), rgba(24, 12, 26, 0.96)) padding-box, linear-gradient(140deg, rgba(255, 214, 190, 0.6), rgba(185, 138, 198, 0.12) 50%, rgba(255, 214, 190, 0.3)) border-box", boxShadow: "0 20px 50px rgba(0, 0, 0, 0.45)" }}>
          <span aria-hidden="true" style={{ position: "absolute", left: "0", top: "18px", bottom: "18px", width: "2px", borderRadius: "2px", background: "linear-gradient(180deg, #FFE3CF, #D9917C)", boxShadow: "0 0 10px #F0B48F" }}>
          </span>
          <p style={{ margin: "0", fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#F0B48F" }}>
            Opora hlavního vzorce
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: "1.55", color: "#F7EAE4" }}>
            Měsíc první osoby a Venuše druhé osoby jsou ve vazbě, která z vašeho výpočtu vystupuje nejsilněji.
          </p>
          <a href="#blok-01" style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", minHeight: "32px", fontSize: "13px" }}>
            Patří k bloku 01 ↓
          </a>
        </li>
        <li style={{ position: "relative", padding: "18px 18px 18px 22px", borderRadius: "16px", border: "1px solid transparent", background: "linear-gradient(170deg, rgba(46, 24, 48, 0.95), rgba(24, 12, 26, 0.96)) padding-box, linear-gradient(140deg, rgba(255, 214, 190, 0.45), rgba(185, 138, 198, 0.12) 50%, rgba(185, 138, 198, 0.4)) border-box", boxShadow: "0 20px 50px rgba(0, 0, 0, 0.45)" }}>
          <span aria-hidden="true" style={{ position: "absolute", left: "0", top: "18px", bottom: "18px", width: "2px", borderRadius: "2px", background: "linear-gradient(180deg, #EBB3C2, #A987C4)", boxShadow: "0 0 10px #CF9DC0" }}>
          </span>
          <p style={{ margin: "0", fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#E3A3BC" }}>
            Opora bloku 04
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: "1.55", color: "#F7EAE4" }}>
            Mars první osoby a Saturn druhé osoby — dvě různá tempa, kterými každý z vás jedná.
          </p>
          <a href="#blok-04" style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", minHeight: "32px", fontSize: "13px" }}>
            Patří k bloku 04 ↓
          </a>
        </li>
      </ol>
      <details style={{ marginTop: "16px", borderTop: "1px solid rgba(240, 190, 165, 0.16)", borderBottom: "1px solid rgba(240, 190, 165, 0.16)" }}>
        <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: "52px", fontSize: "14px", color: "#EADCE2" }}>
          Co přesně jsme spočítali
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#F0B48F" strokeWidth="1.4">
            <path d="M3 5l4 4 4-4">
            </path>
          </svg>
        </summary>
        <ul style={{ margin: "0", padding: "0 0 16px", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
          <li style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <span style={{ color: "#EADCE2" }}>
              Postavení planet u obou
            </span>
            <span style={{ color: "#F0B48F" }}>
              spočítáno
            </span>
          </li>
          <li style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <span style={{ color: "#EADCE2" }}>
              Vzájemné vazby mezi vámi
            </span>
            <span style={{ color: "#F0B48F" }}>
              spočítáno
            </span>
          </li>
          <li style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <span style={{ color: "#EADCE2" }}>
              Vrstvy závislé na čase · 1. osoba
            </span>
            <span style={{ color: "#F0B48F" }}>
              spočítáno
            </span>
          </li>
          <li style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <span style={{ color: "#EADCE2" }}>
              Vrstvy závislé na čase · 2. osoba
            </span>
            <span style={{ color: "#C2ACB7" }}>
              vynecháno
            </span>
          </li>
        </ul>
      </details>
      <p style={{ margin: "20px 0 0", textAlign: "center", fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8F7884" }}>
        Ukázkový obsah · prototyp
      </p>
      <a href="#dna" style={{ marginTop: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", minHeight: "64px", textDecoration: "none" }}>
        <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "26px", background: "linear-gradient(100deg, #FFE7D6, #E9AFC0)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          Vaše Vztahová DNA
        </span>
        <svg aria-hidden="true" width="16" height="22" viewBox="0 0 16 22" fill="none" stroke="#F0B48F" strokeWidth="1.3">
          <path d="M8 1v19M2 14l6 6 6-6">
          </path>
        </svg>
      </a>
    </div>
    </>
  );
}
