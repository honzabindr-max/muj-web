// Převedeno skriptem z design/mezi-vami/Mobil-04-DNA.dc.html (řádky 30–118), pak ručně upraveno.
export function Dna() {
  return (
    <>
    <section style={{ position: "relative", padding: "52px 20px 44px", textAlign: "center", overflow: "hidden" }}>
      <svg aria-hidden="true" viewBox="0 0 375 300" preserveAspectRatio="none" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "300px", pointerEvents: "none" }}>
        <defs>
          <filter id="m4B1" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4">
            </feGaussianBlur>
          </filter>
          <filter id="m4B2" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="12">
            </feGaussianBlur>
          </filter>
          <filter id="m4B3" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="40">
            </feGaussianBlur>
          </filter>
          <linearGradient id="m4A" gradientUnits="userSpaceOnUse" x1="-20" y1="0" x2="400" y2="0">
            <stop offset="0" stopColor="#6E3C8A" stopOpacity="0">
            </stop>
            <stop offset="0.4" stopColor="#C77FAA">
            </stop>
            <stop offset="0.66" stopColor="#FFF1E6">
            </stop>
            <stop offset="1" stopColor="#EFB49A" stopOpacity="0.2">
            </stop>
          </linearGradient>
          <radialGradient id="m4Fl">
            <stop offset="0" stopColor="#FFFFFF">
            </stop>
            <stop offset="0.15" stopColor="#FFEBDD" stopOpacity="0.95">
            </stop>
            <stop offset="0.45" stopColor="#F2A98E" stopOpacity="0.3">
            </stop>
            <stop offset="1" stopColor="#F2A98E" stopOpacity="0">
            </stop>
          </radialGradient>
        </defs>
        <ellipse cx="260" cy="130" rx="150" ry="110" fill="#3A1838" opacity="0.6" filter="url(#m4B3)">
        </ellipse>
        <g className="mv-breathe-m4">
          <path d="M -20 240 C 100 140, 280 140, 400 40" fill="none" stroke="url(#m4A)" strokeWidth="22" opacity="0.22" filter="url(#m4B2)">
          </path>
          <path d="M -20 240 C 100 140, 280 140, 400 40" fill="none" stroke="url(#m4A)" strokeWidth="7" opacity="0.6" filter="url(#m4B1)">
          </path>
        </g>
        <path d="M -20 240 C 100 140, 280 140, 400 40" fill="none" stroke="url(#m4A)" strokeWidth="1.4">
        </path>
        <path d="M -20 247 C 100 148, 280 148, 400 48" fill="none" stroke="url(#m4A)" strokeWidth="0.6" opacity="0.55">
        </path>
        <path d="M -20 233 C 102 132, 282 132, 400 32" fill="none" stroke="url(#m4A)" strokeWidth="0.5" opacity="0.35">
        </path>
        <path className="mv-travel-m4" d="M -20 240 C 100 140, 280 140, 400 40" fill="none" stroke="#FFF3EA" strokeWidth="2" strokeLinecap="round" strokeDasharray="36 624" filter="url(#m4B1)">
        </path>
      </svg>
      <p style={{ position: "relative", margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "14px", letterSpacing: "0.26em", color: "#EADCE2" }}>
        MEZI VÁMI
      </p>
      <h2 style={{ position: "relative", margin: "22px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "300", fontSize: "58px", lineHeight: "0.98", background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
        Vztahová DNA
      </h2>
      <p style={{ position: "relative", margin: "12px 0 0", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "#C2ACB7" }}>
        první osoba · druhá osoba
      </p>
      <p style={{ position: "relative", margin: "30px auto 0", display: "inline-block", padding: "6px 12px", border: "1px dashed #6E5566", borderRadius: "999px", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#A8909D" }}>
        Ukázkový obsah · prototyp
      </p>
    </section>
    <div style={{ maxWidth: "720px", margin: "0 auto", position: "relative" }}>
    {/* 01 HLAVNÍ VZOREC */}
    <article id="blok-01" style={{ position: "relative", margin: "0 14px", padding: "30px 22px", borderRadius: "22px", border: "1px solid transparent", background: "linear-gradient(170deg, rgba(50, 26, 52, 0.96), rgba(22, 11, 24, 0.97)) padding-box, linear-gradient(140deg, rgba(255, 214, 190, 0.8), rgba(185, 138, 198, 0.2) 45%, rgba(255, 214, 190, 0.6)) border-box", boxShadow: "0 40px 90px rgba(0, 0, 0, 0.6), 0 0 80px rgba(220, 130, 150, 0.22), inset 0 1px 0 rgba(255, 230, 215, 0.15)", overflow: "hidden" }}>
      <svg aria-hidden="true" viewBox="0 0 347 420" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>
          <filter id="m4C" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5">
            </feGaussianBlur>
          </filter>
        </defs>
        <path d="M -10 120 C 90 60, 240 70, 360 10" fill="none" stroke="#F2C6A6" strokeWidth="6" opacity="0.3" filter="url(#m4C)">
        </path>
        <path d="M -10 120 C 90 60, 240 70, 360 10" fill="none" stroke="#FFE9DA" strokeWidth="0.8" opacity="0.7">
        </path>
      </svg>
      <p style={{ position: "relative", margin: "0", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "#F0BEA5" }}>
        <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "34px", letterSpacing: "0", background: "linear-gradient(135deg, #FFE7D6, #D9917C)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          01
        </span>
        Hlavní vzorec
      </p>
      <h2 style={{ position: "relative", margin: "18px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "33px", lineHeight: "1.1", color: "#FBEFE9" }}>
        Jeden otevře deset možností. Druhý z nich udělá dvě použitelné.
      </h2>
      <p style={{ position: "relative", margin: "18px 0 0", fontSize: "16px", lineHeight: "1.72", color: "#EADCE2" }}>
        Jednotlivě jsou to dvě docela běžné vlastnosti. Neobvyklé je, co se s nimi stane, když jste spolu: nápady přestanou být jen nápady a plány přestanou být nudné.
      </p>
      <p style={{ position: "relative", margin: "14px 0 0", fontSize: "16px", lineHeight: "1.72", color: "#EADCE2" }}>
        Nejlíp vám to jde ve chvílích, kdy si to nikdo z vás neuvědomuje — u plánování dovolené, u stěhování nábytku, u čehokoli, co má víc variant než jednu.
      </p>
      <p style={{ position: "relative", margin: "20px 0 0", paddingTop: "14px", borderTop: "1px solid rgba(240, 190, 165, 0.2)", display: "flex", gap: "10px", fontSize: "13px", lineHeight: "1.5", color: "#C2ACB7" }}>
        <span aria-hidden="true" style={{ flex: "0 0 auto", width: "6px", height: "6px", marginTop: "7px", borderRadius: "999px", background: "#F0B48F", boxShadow: "0 0 10px #F0B48F" }}>
        </span>
        Stojí na vazbě Měsíce první osoby a Venuše druhé osoby.
      </p>
    </article>
    {/* 02 */}
    <article id="blok-02" style={{ position: "relative", margin: "52px 20px 0" }}>
      <p style={{ margin: "0", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "#B49DAA" }}>
        <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "30px", letterSpacing: "0", background: "linear-gradient(135deg, #EBB3C2, #A987C4)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          02
        </span>
        Druhý výrazný vzorec
      </p>
      <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "29px", lineHeight: "1.12", color: "#F7EAE4" }}>
        Rozhodujete se ve dvou tempech.
      </h2>
      <p style={{ margin: "14px 0 0", fontSize: "16px", lineHeight: "1.72", color: "#EADCE2" }}>
        Jeden z vás potřebuje vědět hned, druhý potřebuje vědět jistě. Když se to potká v sobotu ráno nad výběrem výletu, vznikne malé divadlo, které oba znáte nazpaměť.
      </p>
      <p style={{ margin: "14px 0 0", display: "flex", gap: "10px", fontSize: "13px", lineHeight: "1.5", color: "#C2ACB7" }}>
        <span aria-hidden="true" style={{ flex: "0 0 auto", width: "6px", height: "6px", marginTop: "7px", borderRadius: "999px", background: "#E3A3BC", boxShadow: "0 0 10px #E3A3BC" }}>
        </span>
        Stojí na rozdílném postavení Merkuru u každého z vás.
      </p>
    </article>
    <svg aria-hidden="true" width="375" height="50" viewBox="0 0 375 50" style={{ position: "relative", display: "block", margin: "30px auto 0" }}>
      <defs>
        <linearGradient id="m4Sep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B66FA6" stopOpacity="0">
          </stop>
          <stop offset="0.5" stopColor="#F2B9A6">
          </stop>
          <stop offset="1" stopColor="#B66FA6" stopOpacity="0">
          </stop>
        </linearGradient>
        <radialGradient id="m4Dot">
          <stop offset="0" stopColor="#FFF4EC">
          </stop>
          <stop offset="1" stopColor="#F2A98E" stopOpacity="0">
          </stop>
        </radialGradient>
      </defs>
      <path d="M 30 36 C 130 10, 245 10, 345 36" fill="none" stroke="url(#m4Sep)" strokeWidth="1">
      </path>
      <circle cx="188" cy="17" r="10" fill="url(#m4Dot)">
      </circle>
    </svg>
    {/* 03 */}
    <article id="blok-03" style={{ position: "relative", margin: "14px 20px 0" }}>
      <p style={{ margin: "0", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "#B49DAA" }}>
        <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "30px", letterSpacing: "0", background: "linear-gradient(135deg, #EBB3C2, #A987C4)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          03
        </span>
        Co vás drží
      </p>
      <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "29px", lineHeight: "1.12", color: "#F7EAE4" }}>
        Smějete se stejným věcem dřív, než je stihnete vysvětlit.
      </h2>
      <p style={{ margin: "14px 0 0", fontSize: "16px", lineHeight: "1.72", color: "#EADCE2" }}>
        Sdílený humor tu není ozdoba, ale zkratka. Často jím vyřešíte víc než dlouhým rozhovorem — a oba to víte.
      </p>
      <p style={{ margin: "14px 0 0", display: "flex", gap: "10px", fontSize: "13px", lineHeight: "1.5", color: "#C2ACB7" }}>
        <span aria-hidden="true" style={{ flex: "0 0 auto", width: "6px", height: "6px", marginTop: "7px", borderRadius: "999px", background: "#E3A3BC", boxShadow: "0 0 10px #E3A3BC" }}>
        </span>
        Stojí na souzvuku Jupitera první osoby se Sluncem druhé osoby.
      </p>
    </article>
    <svg aria-hidden="true" width="375" height="50" viewBox="0 0 375 50" style={{ position: "relative", display: "block", margin: "30px auto 0" }}>
      <path d="M 30 36 C 130 10, 245 10, 345 36" fill="none" stroke="url(#m4Sep)" strokeWidth="1">
      </path>
      <circle cx="188" cy="17" r="10" fill="url(#m4Dot)">
      </circle>
    </svg>
    {/* 04 */}
    <article id="blok-04" style={{ position: "relative", margin: "14px 20px 0" }}>
      <p style={{ margin: "0", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "#B49DAA" }}>
        <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "30px", letterSpacing: "0", background: "linear-gradient(135deg, #EBB3C2, #A987C4)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          04
        </span>
        Kde se míjíte
      </p>
      <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "29px", lineHeight: "1.12", color: "#F7EAE4" }}>
        Po neshodě se vracíte různou rychlostí.
      </h2>
      <p style={{ margin: "14px 0 0", fontSize: "16px", lineHeight: "1.72", color: "#EADCE2" }}>
        Jeden chce věc vyřešit teď, druhý potřebuje chvíli ticha. Ani jedno není špatně. Jen každý z vás čte to druhé jako něco jiného, než to ve skutečnosti je.
      </p>
      <p style={{ margin: "14px 0 0", display: "flex", gap: "10px", fontSize: "13px", lineHeight: "1.5", color: "#C2ACB7" }}>
        <span aria-hidden="true" style={{ flex: "0 0 auto", width: "6px", height: "6px", marginTop: "7px", borderRadius: "999px", background: "#B98AC6", boxShadow: "0 0 10px #B98AC6" }}>
        </span>
        Stojí na vazbě Marsu první osoby a Saturnu druhé osoby.
      </p>
    </article>
    {/* 05 */}
    <article style={{ position: "relative", margin: "52px 14px 0", padding: "26px 22px", borderRadius: "20px", border: "1px solid transparent", background: "linear-gradient(160deg, rgba(70, 36, 50, 0.85), rgba(36, 18, 30, 0.9)) padding-box, linear-gradient(120deg, rgba(255, 214, 190, 0.7), rgba(240, 180, 143, 0.15) 50%, rgba(255, 214, 190, 0.55)) border-box", boxShadow: "0 30px 70px rgba(0, 0, 0, 0.5), 0 0 60px rgba(240, 160, 130, 0.18)" }}>
      <p style={{ margin: "0", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "#F0BEA5" }}>
        <span style={{ fontFamily: "var(--font-mv-garamond), serif", fontSize: "30px", letterSpacing: "0", background: "linear-gradient(135deg, #FFE7D6, #D9917C)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          05
        </span>
        Na zkoušku
      </p>
      <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "400", fontSize: "28px", lineHeight: "1.12", color: "#F7EAE4" }}>
        Domluvte si signál pro „potřebuju chvíli“.
      </h2>
      <p style={{ margin: "14px 0 0", fontSize: "16px", lineHeight: "1.72", color: "#EADCE2" }}>
        Slovo nebo gesto, které znamená: vrátím se, jen ne hned. Tomu rychlejšímu z vás ušetří nejistotu, tomu pomalejšímu tlak.
      </p>
    </article>
    {/* KONEC FREE PRODUKTU */}
    <section style={{ position: "relative", margin: "64px 20px 0", textAlign: "center" }}>
      <svg aria-hidden="true" width="140" height="80" viewBox="0 0 140 80" style={{ display: "block", margin: "0 auto" }}>
        <defs>
          <filter id="m4E" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4">
            </feGaussianBlur>
          </filter>
          <clipPath id="m4EC">
            <circle cx="56" cy="40" r="28">
            </circle>
          </clipPath>
          <radialGradient id="m4EF">
            <stop offset="0" stopColor="#FFFFFF">
            </stop>
            <stop offset="0.3" stopColor="#FFEBDD" stopOpacity="0.8">
            </stop>
            <stop offset="1" stopColor="#F2A98E" stopOpacity="0">
            </stop>
          </radialGradient>
        </defs>
        <circle cx="56" cy="40" r="28" fill="none" stroke="#E3A3BC" strokeWidth="6" opacity="0.35" filter="url(#m4E)">
        </circle>
        <circle cx="84" cy="40" r="28" fill="none" stroke="#F0B48F" strokeWidth="6" opacity="0.35" filter="url(#m4E)">
        </circle>
        <circle cx="56" cy="40" r="28" fill="none" stroke="#F2C3D2" strokeWidth="1">
        </circle>
        <circle cx="84" cy="40" r="28" fill="none" stroke="#FFDCC4" strokeWidth="1">
        </circle>
        <g clipPath="url(#m4EC)">
          <circle className="mv-breathe-m4" cx="84" cy="40" r="28" fill="#F2A98E" opacity="0.45" filter="url(#m4E)">
          </circle>
        </g>
        <g className="mv-pulse-m4">
          <circle cx="70" cy="40" r="14" fill="url(#m4EF)">
          </circle>
        </g>
      </svg>
      <p style={{ margin: "18px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "29px", lineHeight: "1.18", background: "linear-gradient(100deg, #FFE7D6, #E9AFC0)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
        Tady vaše Vztahová DNA končí.
        <br />
        Je celá.
      </p>
      <p style={{ margin: "12px 0 0", fontSize: "14px", lineHeight: "1.6", color: "#C2ACB7" }}>
        V tomto prohlížeči ji najdete ještě 72 hodin. Pak výsledek i údaje smažeme.
      </p>
    </section>
    <a href="#most" style={{ position: "relative", margin: "52px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", minHeight: "64px", textDecoration: "none" }}>
      <span style={{ fontSize: "14px", color: "#EADCE2" }}>
        Chcete jít hlouběji?
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
