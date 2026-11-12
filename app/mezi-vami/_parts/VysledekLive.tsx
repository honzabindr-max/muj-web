"use client";

// /vysledek ze skutečného výpočtu: Proof → Vztahová DNA → Depth Bridge → nabídka.
// Zobrazuje FreeDnaResult z uloženého výsledku (sessionStorage). Bez uloženého výsledku zůstává ukázka z návrhu.

import { useState, type CSSProperties, type ReactNode } from "react";
import { A } from "../_lib/A";
import { nb } from "../_lib/nbsp";
import {
  clearResult,
  isPending,
  useStoredResult,
  type ResultDoc,
} from "../_calc/client";

type Person = ResultDoc["view"]["persons"][number];
type Insight = ResultDoc["view"]["free_dna"]["r1"];

const DAYPART_CS: Record<string, string> = {
  NOC: "noc 00:00–05:59",
  RANO: "ráno 06:00–11:59",
  ODPOLEDNE: "odpoledne 12:00–17:59",
  VECER: "večer 18:00–23:59",
};

function dateCs(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}
function timeCs(p: Person): string {
  if (p.time_mode === "UNKNOWN") return "čas neznámý";
  if (p.time_mode === "EXACT") return `čas ${p.exact_time}`;
  const a = p.approximate;
  if (!a) return "čas přibližný";
  return a.kind === "DAYPART"
    ? DAYPART_CS[a.daypart]
    : `čas ${a.center_time} · ±${a.window_minutes === 60 ? "1 h" : a.window_minutes === 120 ? "2 h" : "30 min"}`;
}

export default function VysledekLive({ fallback }: { fallback: ReactNode }) {
  const stored = useStoredResult();
  if (isPending(stored)) {
    return (
      <div
        style={{ minHeight: "100dvh", background: "#0E070F" }}
        aria-busy="true"
      />
    );
  }
  if (!stored) return <>{fallback}</>;
  return <Result doc={stored.document} />;
}

function Result({ doc }: { doc: ResultDoc }) {
  const v = doc.view;
  const fd = v.free_dna;
  const insights: Insight[] = [fd.r1, ...fd.optional_insights];
  const [open, setOpen] = useState(false);

  return (
    <main className="xm04" style={shell}>
      <div style={col}>
        <header style={head}>
          <span style={logo}>MEZI VÁMI</span>
          <span style={badge}>Ukázkový výpočet — prototyp</span>
        </header>

        {/* Proof of Computation */}
        <section style={{ padding: "48px 20px 0" }}>
          <h1 style={h1(36)}>Na čem stojí vaše Vztahová DNA</h1>
          <p style={lead}>
            Podívejte se na oporu výkladu ve výpočtu, jeho rozsah a meze.
          </p>
          <div style={card}>
            {v.persons.map((p, i) => (
              <div
                key={p.slot}
                style={{
                  ...row,
                  borderTop: i ? "1px solid rgba(240,190,165,0.14)" : "none",
                }}
              >
                <span style={{ fontSize: 14, color: "#C2ACB7" }}>
                  {p.ui_label}
                </span>
                <span
                  style={{ fontSize: 14, color: "#F7EAE4", textAlign: "right" }}
                >
                  {nb(
                    `${dateCs(p.birth_date)} · ${p.birth_place.display_name}`,
                  )}
                  <br />
                  <span style={{ color: "#C2ACB7" }}>{timeCs(p)}</span>
                </span>
              </div>
            ))}
          </div>
          <div style={callout}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: "#EADCE2",
              }}
            >
              {nb(fd.coverage.coverage_line)}
            </p>
          </div>
          <button
            type="button"
            style={summary}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open
              ? "Skrýt podrobnosti výpočtu"
              : "Zobrazit podrobnosti výpočtu"}
            <span aria-hidden="true" style={{ color: "#F0B48F" }}>
              {open ? "−" : "+"}
            </span>
          </button>
          {open && (
            <div
              style={{
                padding: "16px 0",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <Detail title="Opora výkladu ve výpočtu">
                {insights
                  .flatMap((i) => i.evidence_anchors)
                  .map((a) => (
                    <p
                      key={`${a.supports_insight_id}-${a.anchor_id}`}
                      style={dp}
                    >
                      {nb(a.customer_label)}
                    </p>
                  ))}
              </Detail>
              <Detail title="Rozsah analýzy">
                <p style={dp}>{nb(fd.coverage.coverage_line)}</p>
                {fd.coverage.layers_unavailable.map((l) => (
                  <p key={l} style={{ ...dp, color: "#C2ACB7" }}>
                    Není zahrnuto: {nb(l)}
                  </p>
                ))}
              </Detail>
              {fd.limitations.length > 0 && (
                <Detail title="Meze výkladu">
                  {fd.limitations.map((l) => (
                    <p key={l.code} style={dp}>
                      {nb(l.customer_text)}
                    </p>
                  ))}
                </Detail>
              )}
            </div>
          )}
          <A href="#dna" style={arrow}>
            <span style={{ ...h2g, fontSize: 26 }}>Vztahová DNA</span>
            <span aria-hidden="true" style={{ color: "#F0B48F" }}>
              ↓
            </span>
          </A>
        </section>

        {/* Vztahová DNA */}
        <section id="dna" style={{ padding: "40px 0 0" }}>
          <div style={{ textAlign: "center", padding: "0 20px" }}>
            <h2 style={h1(52)}>Vztahová DNA</h2>
            <p style={{ ...lead, textAlign: "center" }}>
              {fd.r1_only
                ? "Jedno hlavní téma s oporou ve vašem výpočtu."
                : "Témata, která mají oporu ve vašem výpočtu."}
            </p>
          </div>
          {insights.map((ins, idx) => (
            <article key={ins.insight_id} style={idx === 0 ? mainCard : block}>
              <p
                style={{
                  ...num,
                  ...(idx === 0
                    ? {
                        fontSize: 14,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase" as const,
                      }
                    : {}),
                }}
              >
                {idx === 0 ? "Hlavní téma" : String(idx + 1).padStart(2, "0")}
              </p>
              <h3 style={{ ...h3, fontSize: idx === 0 ? 30 : 26 }}>
                {nb(ins.headline)}
              </h3>
              <p style={body}>{nb(ins.body)}</p>
              <p style={support}>
                Opora tohoto závěru ve vašem výpočtu:{" "}
                <span style={{ color: "#F7EAE4" }}>
                  {nb(
                    ins.evidence_anchors
                      .map((a) => a.customer_label)
                      .join(" · "),
                  )}
                </span>
              </p>
            </article>
          ))}
          <p
            style={{
              ...h2g,
              textAlign: "center",
              fontSize: 30,
              margin: "52px 20px 0",
            }}
          >
            To je vaše Vztahová DNA.
          </p>
        </section>

        {/* Depth Bridge */}
        <section style={{ padding: "56px 20px 0" }}>
          <h2 style={h1(36)}>{v.depth_bridge.headline}</h2>
          <p style={lead}>
            {nb(
              fd.r1_only
                ? "Hloubková analýza MEZI VÁMI nabízí širší pohled. Níže si můžete prohlédnout její rozsah."
                : "Na zachycená témata může navázat Hloubková analýza MEZI VÁMI.",
            )}
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "20px 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {v.depth_bridge.detected_themes.map((t) => (
              <li key={t.supports_insight_id} style={bridgeItem}>
                <p style={{ margin: 0, fontSize: 15, color: "#F7EAE4" }}>
                  {nb(t.theme_label)}
                </p>
              </li>
            ))}
          </ul>
          <p style={{ ...lead, fontSize: 14 }}>
            Hloubka jednotlivých částí se řídí tím, co má pro vás dva oporu ve
            výpočtu.
          </p>
          <A href="#nabidka" style={ghost}>
            Prohlédnout Hloubkovou analýzu ↓
          </A>
        </section>

        {/* Nabídka (zkrácená, stejný obsah jako v návrhu) */}
        <section id="nabidka" style={offer}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#C9B0BE",
            }}
          >
            Hloubková analýza MEZI VÁMI
          </p>
          <h2 style={{ ...h1(34), marginTop: 12 }}>
            Váš vztah v širších souvislostech.
          </h2>
          <p style={{ ...lead, color: "#EADCE2" }}>
            Hloubková analýza nabízí podrobnější pohled na potřeby každého z vás
            i na společné fungování.
          </p>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 14,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#C9B0BE",
            }}
          >
            Pracovní cena prototypu
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontFamily: "var(--font-mv-garamond), serif",
              fontSize: 40,
            }}
          >
            {nb(v.offer.price.display)}{" "}
            <span
              style={{
                fontFamily: "var(--font-mv-jost), sans-serif",
                fontSize: 14,
                color: "#C2ACB7",
              }}
            >
              vč. DPH
            </span>
          </p>
          <A href="/mezi-vami/objednavka" style={cta}>
            Pokračovat k objednávce
          </A>
        </section>

        <footer style={{ padding: "28px 20px 48px", textAlign: "center" }}>
          <A
            href="/mezi-vami/osoba"
            onClick={() => clearResult()}
            style={{ fontSize: 14, color: "#C2ACB7" }}
          >
            Upravit údaje a přepočítat
          </A>
        </footer>
      </div>
    </main>
  );
}

function Detail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#F0B48F",
        }}
      >
        {title}
      </p>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const shell: CSSProperties = {
  minHeight: "100dvh",
  background: "#0E070F",
  color: "#F4E9E4",
  fontFamily: "var(--font-mv-jost), system-ui, sans-serif",
  fontVariantNumeric: "lining-nums",
  overflowX: "hidden",
};
const col: CSSProperties = {
  maxWidth: 560,
  margin: "0 auto",
  paddingBottom: 40,
};
const head: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px 0 20px",
  gap: 8,
};
const logo: CSSProperties = {
  fontFamily: "var(--font-mv-garamond), serif",
  fontSize: 18,
  letterSpacing: "0.14em",
  color: "#EADCE2",
};
const badge: CSSProperties = {
  padding: "5px 10px",
  border: "1px dashed #6E5566",
  borderRadius: 999,
  fontSize: 12,
  letterSpacing: "0.06em",
  color: "#C9B0BE",
};
const h1 = (size: number): CSSProperties => ({
  margin: 0,
  fontFamily: "var(--font-mv-garamond), serif",
  fontWeight: 400,
  fontSize: size,
  lineHeight: 1.04,
  background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});
const h2g: CSSProperties = {
  fontFamily: "var(--font-mv-garamond), serif",
  background: "linear-gradient(100deg, #FFE7D6, #E9AFC0)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};
const lead: CSSProperties = {
  margin: "12px 0 0",
  fontSize: 15,
  lineHeight: 1.6,
  color: "#C2ACB7",
};
const card: CSSProperties = {
  marginTop: 24,
  borderRadius: 16,
  border: "1px solid rgba(240,190,165,0.25)",
  background:
    "linear-gradient(160deg, rgba(48,26,46,0.8), rgba(28,14,30,0.72))",
  overflow: "hidden",
};
const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "15px 16px",
};
const callout: CSSProperties = {
  marginTop: 14,
  padding: 16,
  borderRadius: 16,
  background:
    "linear-gradient(160deg, rgba(240,180,143,0.1), rgba(240,180,143,0.03))",
  border: "1px solid rgba(240,190,165,0.25)",
};
const summary: CSSProperties = {
  marginTop: 16,
  width: "100%",
  minHeight: 52,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "none",
  color: "#EADCE2",
  fontSize: 14,
  fontFamily: "inherit",
  border: "none",
  borderTop: "1px solid rgba(240,190,165,0.16)",
  borderBottom: "1px solid rgba(240,190,165,0.16)",
  cursor: "pointer",
  padding: 0,
};
const dp: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: "#EADCE2",
};
const arrow: CSSProperties = {
  marginTop: 36,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  minHeight: 64,
  textDecoration: "none",
};
const mainCard: CSSProperties = {
  margin: "28px 14px 0",
  padding: "28px 22px",
  borderRadius: 22,
  border: "1px solid rgba(255,214,190,0.5)",
  background:
    "linear-gradient(170deg, rgba(50,26,52,0.96), rgba(22,11,24,0.97))",
  boxShadow: "0 40px 90px rgba(0,0,0,0.6), 0 0 80px rgba(220,130,150,0.22)",
};
const block: CSSProperties = { margin: "44px 20px 0" };
const num: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mv-garamond), serif",
  fontSize: 30,
  color: "#EBB3C2",
};
const h3: CSSProperties = {
  margin: "8px 0 0",
  fontFamily: "var(--font-mv-garamond), serif",
  fontWeight: 400,
  lineHeight: 1.12,
  color: "#FBEFE9",
};
const body: CSSProperties = {
  margin: "14px 0 0",
  fontSize: 16,
  lineHeight: 1.72,
  color: "#EADCE2",
};
const support: CSSProperties = {
  margin: "16px 0 0",
  fontSize: 14,
  lineHeight: 1.5,
  color: "#C2ACB7",
};
const bridgeItem: CSSProperties = {
  padding: "16px 18px",
  borderRadius: 16,
  border: "1px solid rgba(255,214,190,0.3)",
  background:
    "linear-gradient(170deg, rgba(46,24,48,0.92), rgba(24,12,26,0.94))",
};
const ghost: CSSProperties = {
  marginTop: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 50,
  borderRadius: 999,
  border: "1px solid rgba(240,190,165,0.45)",
  color: "#F7EAE4",
  textDecoration: "none",
  fontSize: 14,
};
const offer: CSSProperties = {
  margin: "52px 14px 0",
  padding: "30px 20px 26px",
  borderRadius: 24,
  border: "1px solid rgba(255,214,190,0.4)",
  background:
    "linear-gradient(165deg, rgba(44,22,44,0.96), rgba(16,8,18,0.98))",
};
const cta: CSSProperties = {
  marginTop: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 56,
  borderRadius: 999,
  background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)",
  color: "#2A1220",
  textDecoration: "none",
  fontSize: 16,
  fontWeight: 500,
};
