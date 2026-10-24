// Převedeno skriptem z design/mezi-vami/Stavy.dc.html (řádky 21–134), pak ručně upraveno.
import Link from "next/link";

export function Stavy() {
  return (
    <>
    <h1 className="mv-stavy-h1" style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontWeight: "300", fontSize: "60px", background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", display: "inline-block" }}>
      Hraniční stavy
    </h1>
    <p style={{ margin: "10px 0 0", fontSize: "17px", color: "#BDA7B2" }}>
      Mobil 375 px. Každý stav mluví klidně, nikoho neobviňuje a neslibuje víc, než systém zaručí.
    </p>
    <div className="mv-stavy-grid">
      {/* 1 VÝPOČET */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#A48D99" }}>
          Výpočet probíhá
        </p>
        <div style={{ height: "560px", boxSizing: "border-box", borderRadius: "24px", border: "1px solid #3A2535", background: "#120A12", padding: "28px 22px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <svg aria-hidden="true" width="180" height="120" viewBox="0 0 180 120">
            <defs>
              <filter id="s1Blur" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="6">
                </feGaussianBlur>
              </filter>
              <clipPath id="s1Clip">
                <circle cx="70" cy="60" r="44">
                </circle>
              </clipPath>
            </defs>
            <circle cx="70" cy="60" r="44" fill="none" stroke="#C9A0B8" strokeWidth="1">
            </circle>
            <circle cx="110" cy="60" r="44" fill="none" stroke="#F2C6A6" strokeWidth="1">
            </circle>
            <g clipPath="url(#s1Clip)">
              <circle className="mv-glow-s" cx="110" cy="60" r="44" fill="#EDB894" filter="url(#s1Blur)">
              </circle>
            </g>
          </svg>
          <p role="status" style={{ margin: "28px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "30px", lineHeight: "1.1", color: "#F1D0BC" }}>
            Počítáme vás dva.
          </p>
          <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#BDA7B2" }}>
            Obvykle to trvá pár vteřin.
            <br />
            Nic uměle neprodlužujeme.
          </p>
        </div>
      </div>
      {/* 2 R1-ONLY */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#A48D99" }}>
          Vztahová DNA · jeden vzorec
        </p>
        <div style={{ height: "560px", boxSizing: "border-box", borderRadius: "24px", border: "1px solid #3A2535", background: "#120A12", padding: "28px 18px", display: "flex", flexDirection: "column" }}>
          <p style={{ margin: "0 4px", fontSize: "15px", lineHeight: "1.6", color: "#E8DAE0" }}>
            Výpočet podložil jeden výrazný vzorec. Tady je celý.
          </p>
          <div style={{ marginTop: "18px", padding: "22px 20px", borderRadius: "18px", border: "1px solid rgba(242, 198, 166, 0.3)", background: "#1E1120" }}>
            <p style={{ margin: "0", fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#EDB894" }}>
              Hlavní vzorec
            </p>
            <p style={{ margin: "12px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "26px", lineHeight: "1.12", color: "#F4E9E4" }}>
              Oba potřebujete mít poslední slovo. Jen každý v jiné místnosti.
            </p>
            <p style={{ margin: "12px 0 0", fontSize: "14px", lineHeight: "1.65", color: "#E8DAE0" }}>
              Jeden si hlídá velká rozhodnutí, druhý ta každodenní. Dokud se tyhle místnosti nepotkají, funguje to překvapivě hladce.
            </p>
          </div>
          <p style={{ margin: "18px 4px 0", fontSize: "13px", lineHeight: "1.6", color: "#A48D99" }}>
            Víc toho vaše údaje poctivě neunesou. Vymýšlet nebudeme.
          </p>
          <p style={{ margin: "auto 4px 0", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8F7884" }}>
            Ukázkový obsah · prototyp
          </p>
        </div>
      </div>
      {/* 3 STALE */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#A48D99" }}>
          Neaktuální po úpravě
        </p>
        <div style={{ height: "560px", boxSizing: "border-box", borderRadius: "24px", border: "1px solid #3A2535", background: "#120A12", padding: "24px 18px", display: "flex", flexDirection: "column" }}>
          <div role="status" style={{ padding: "18px", borderRadius: "16px", background: "#2A1826", border: "1px solid #6E5566" }}>
            <p style={{ margin: "0", fontSize: "15px", fontWeight: "400", color: "#F4E9E4" }}>
              Údaje se změnily.
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "14px", lineHeight: "1.55", color: "#E8DAE0" }}>
              Tenhle výsledek patří k původnímu zadání. Pro nové údaje je potřeba spočítat vás znovu.
            </p>
            <button type="button" style={{ marginTop: "14px", width: "100%", minHeight: "48px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1220", boxShadow: "0 12px 36px rgba(240, 160, 130, 0.4), 0 0 70px rgba(240, 160, 130, 0.22), inset 0 1px 0 rgba(255, 244, 236, 0.7)", fontFamily: "inherit", fontSize: "15px", fontWeight: "500", cursor: "pointer" }}>
              Spočítat znovu
            </button>
          </div>
          <div aria-hidden="true" style={{ marginTop: "20px", padding: "20px", borderRadius: "18px", border: "1px solid #3A2535", opacity: "0.4" }}>
            <p style={{ margin: "0", fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#BDA7B2" }}>
              01 · Hlavní vzorec · původní
            </p>
            <p style={{ margin: "10px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "22px", lineHeight: "1.15", color: "#E8DAE0" }}>
              Jeden otevře deset možností. Druhý z nich udělá dvě použitelné.
            </p>
          </div>
        </div>
      </div>
      {/* 4 TIRR */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#A48D99" }}>
          Upřesnění času
        </p>
        <div style={{ height: "560px", boxSizing: "border-box", borderRadius: "24px", border: "1px solid #3A2535", background: "#120A12", padding: "28px 20px", display: "flex", flexDirection: "column" }}>
          <p style={{ margin: "0", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "#A48D99" }}>
            První osoba · čas narození
          </p>
          <p style={{ margin: "14px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "28px", lineHeight: "1.12", color: "#F1D0BC" }}>
            Tenhle čas v ten den na tom místě neexistoval.
          </p>
          <p style={{ margin: "14px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#E8DAE0" }}>
            Tu noc se posouvaly hodiny a mezi 2:00 a 3:00 se přeskočilo. Hádat nechceme — vyberte prosím, jak dál.
          </p>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            <button type="button" style={{ minHeight: "52px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1220", boxShadow: "0 12px 36px rgba(240, 160, 130, 0.4), 0 0 70px rgba(240, 160, 130, 0.22), inset 0 1px 0 rgba(255, 244, 236, 0.7)", fontFamily: "inherit", fontSize: "15px", fontWeight: "500", cursor: "pointer" }}>
              Opravit čas
            </button>
            <button type="button" style={{ minHeight: "48px", border: "1px solid #7E6274", borderRadius: "999px", background: "transparent", color: "#F4E9E4", fontFamily: "inherit", fontSize: "15px", cursor: "pointer" }}>
              Zadat čas přibližně
            </button>
            <button type="button" style={{ minHeight: "48px", border: "1px solid #7E6274", borderRadius: "999px", background: "transparent", color: "#F4E9E4", fontFamily: "inherit", fontSize: "15px", cursor: "pointer" }}>
              Čas nevím
            </button>
          </div>
        </div>
      </div>
      {/* 5 GEO */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#A48D99" }}>
          Místo mimo podporu
        </p>
        <div style={{ height: "560px", boxSizing: "border-box", borderRadius: "24px", border: "1px solid #3A2535", background: "#120A12", padding: "28px 20px", display: "flex", flexDirection: "column" }}>
          <label htmlFor="s5-misto" style={{ fontSize: "14px", fontWeight: "400", color: "#E8DAE0" }}>
            Místo narození
          </label>
          <input id="s5-misto" type="text" defaultValue="Vídeň" aria-describedby="s5-msg" style={{ marginTop: "8px", height: "52px", boxSizing: "border-box", padding: "0 16px", borderRadius: "12px", border: "1px solid #C9A0B8", background: "rgba(255, 240, 232, 0.04)", color: "#F4E9E4", fontFamily: "inherit", fontSize: "17px", fontWeight: "300" }} />
          <div id="s5-msg" role="status" style={{ marginTop: "14px", padding: "16px", borderRadius: "14px", background: "#1E1120", border: "1px solid rgba(242, 198, 166, 0.2)" }}>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "#E8DAE0" }}>
              Zatím počítáme jen s místy narození v Česku a na Slovensku.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "14px", lineHeight: "1.6", color: "#BDA7B2" }}>
              Pokud jde o jiné místo, výsledek vám teď poctivě spočítat neumíme.
            </p>
          </div>
          <a href="#" style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "48px", border: "1px solid #7E6274", borderRadius: "999px", color: "#F4E9E4", textDecoration: "none", fontSize: "15px" }}>
            Zadat jiné místo
          </a>
        </div>
      </div>
      {/* 6 CHYBA */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#A48D99" }}>
          Obnovitelná chyba
        </p>
        <div style={{ height: "560px", boxSizing: "border-box", borderRadius: "24px", border: "1px solid #3A2535", background: "#120A12", padding: "28px 20px", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
          <svg aria-hidden="true" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="#C9A0B8" strokeWidth="1.2" style={{ margin: "0 auto" }}>
            <circle cx="28" cy="28" r="26">
            </circle>
            <path d="M28 16v15M28 38v.5">
            </path>
          </svg>
          <p role="alert" style={{ margin: "22px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "28px", lineHeight: "1.12", color: "#F1D0BC" }}>
            Výpočet se nepodařilo dokončit.
          </p>
          <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#E8DAE0" }}>
            Chyba je na naší straně. Údaje máte stále vyplněné v tomto okně.
          </p>
          <button type="button" style={{ marginTop: "28px", minHeight: "52px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1220", boxShadow: "0 12px 36px rgba(240, 160, 130, 0.4), 0 0 70px rgba(240, 160, 130, 0.22), inset 0 1px 0 rgba(255, 244, 236, 0.7)", fontFamily: "inherit", fontSize: "15px", fontWeight: "500", cursor: "pointer" }}>
            Zkusit znovu
          </button>
        </div>
      </div>
      {/* 7 PLATBA NEPROŠLA */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#A48D99" }}>
          Platba neproběhla
        </p>
        <div style={{ height: "560px", boxSizing: "border-box", borderRadius: "24px", border: "1px solid #3A2535", background: "#120A12", padding: "28px 20px", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
          <p role="alert" style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "30px", lineHeight: "1.1", color: "#F1D0BC" }}>
            Platba neproběhla.
          </p>
          <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#E8DAE0" }}>
            Nic jsme vám nestrhli. Můžete to zkusit znovu — druhou objednávku tím nevytvoříte.
          </p>
          <button type="button" style={{ marginTop: "28px", minHeight: "52px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)", color: "#2A1220", boxShadow: "0 12px 36px rgba(240, 160, 130, 0.4), 0 0 70px rgba(240, 160, 130, 0.22), inset 0 1px 0 rgba(255, 244, 236, 0.7)", fontFamily: "inherit", fontSize: "15px", fontWeight: "500", cursor: "pointer" }}>
            Zkusit platbu znovu
          </button>
          <Link href="/mezi-vami/objednavka" prefetch={false} style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "48px", fontSize: "14px" }}>
            Zpět k objednávce
          </Link>
        </div>
      </div>
      {/* 8 OBJEDNÁVKA PŘIJATA */}
      <div>
        <p style={{ margin: "0 0 12px", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#A48D99" }}>
          Objednávka přijata
        </p>
        <div style={{ position: "relative", height: "560px", boxSizing: "border-box", borderRadius: "24px", border: "1px solid rgba(242, 198, 166, 0.3)", background: "#120A12", padding: "28px 20px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <svg aria-hidden="true" viewBox="0 0 375 200" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "200px", pointerEvents: "none" }}>
            <path d="M -10 150 C 100 60, 260 50, 390 110" fill="none" stroke="#F6C9A8" strokeWidth="1" opacity="0.7">
            </path>
          </svg>
          <p style={{ position: "relative", margin: "40px 0 0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "32px", lineHeight: "1.08", color: "#F1D0BC" }}>
            Děkujeme.
            <br />
            Objednávka je přijatá.
          </p>
          <p style={{ position: "relative", margin: "14px 0 0", fontSize: "13px", color: "#BDA7B2" }}>
            {"Číslo objednávky "}
            <span style={{ color: "#F4E9E4" }}>
              MV-[REF]
            </span>
          </p>
          <div style={{ position: "relative", marginTop: "22px", padding: "16px", borderRadius: "14px", background: "#1E1120", border: "1px solid #3A2535" }}>
            <p style={{ margin: "0", fontSize: "14px", lineHeight: "1.55", color: "#E8DAE0" }}>
              Hloubkovou analýzu pošleme nejpozději do 48 hodin na:
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "16px", fontWeight: "400", color: "#F4E9E4", wordBreak: "break-all" }}>
              jana.novakova@email.cz
            </p>
            <a href="#" style={{ marginTop: "4px", display: "inline-flex", alignItems: "center", minHeight: "40px", fontSize: "13px" }}>
              Je e-mail špatně? Opravit
            </a>
          </div>
          <p style={{ position: "relative", margin: "auto 0 0", fontSize: "13px", lineHeight: "1.6", color: "#A48D99" }}>
            Potvrzení už máte v e-mailu. Pomoc: [PODPORA_EMAIL] — stačí uvést číslo objednávky.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
