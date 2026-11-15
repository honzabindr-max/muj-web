// V-01 · Výsledek (mobil, 375 px; na 390 se natahuje). Texty a hodnoty 1:1 z artboardu V-01
// (fixtures v _data/fixtures.ts). Pořadí: hero → Vaše dvě nebe → 5 vazeb → sdílení → Jak jsme
// k tomu došli → otevřené otázky → nabídka.

import type { CSSProperties } from "react";
import { A } from "../_lib/A";
import { SampleBadge } from "../_lib/SampleBadge";
import { Pools } from "../_lib/LightCurve";
import {
  n,
  JAK_JSME,
  KDO_JE_KDO,
  NABIDKA,
  OTEVRENE,
  PAIR,
  SDILENI,
  TEMATA,
  TEMATA_HEAD,
  type NoteTon,
} from "../_data/fixtures";
import { nbsp } from "../_lib/nbsp";
import { A_COL, B_COL, Dot, Nit, Signature } from "./parts";

export type SampleState = "s0" | "s1" | "s2";

const EYEBROW: CSSProperties = {
  margin: 0,
  fontSize: 14,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#F0BEA5",
};
const H2: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mv-garamond), serif",
  fontWeight: 400,
  fontSize: 34,
  lineHeight: 1.08,
  color: "#FBEFE9",
};
const BODY: CSSProperties = {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.68,
  color: "#EADCE2",
};
const MUTED = "#C2ACB7";
const CARD: CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(240, 190, 165, 0.22)",
  background:
    "linear-gradient(170deg, rgba(44, 22, 46, 0.92), rgba(22, 11, 24, 0.95))",
};
const HERO_CARD: CSSProperties = {
  borderRadius: 22,
  border: "1px solid transparent",
  background:
    "linear-gradient(170deg, rgba(50, 26, 52, 0.96), rgba(22, 11, 24, 0.97)) padding-box, linear-gradient(140deg, rgba(255, 214, 190, 0.8), rgba(185, 138, 198, 0.2) 45%, rgba(255, 214, 190, 0.6)) border-box",
  boxShadow:
    "0 40px 90px rgba(0, 0, 0, 0.6), 0 0 80px rgba(220, 130, 150, 0.2)",
};
const CTA: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 58,
  borderRadius: 999,
  background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)",
  color: "#2A1220",
  textDecoration: "none",
  fontSize: 16,
  fontWeight: 500,
  boxShadow:
    "0 12px 36px rgba(240, 160, 130, 0.35), inset 0 1px 0 rgba(255, 244, 236, 0.7)",
};
const GHOST: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 48,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(240, 190, 165, 0.45)",
  background: "transparent",
  color: "#F7EAE4",
  fontFamily: "inherit",
  fontSize: 15,
  textDecoration: "none",
};
const GARAMOND = "var(--font-mv-garamond), serif";

const TON_COLOR: Record<NoteTon, string> = {
  ladite: "#E9C6A9",
  trete: "#F2A98C",
  plynete: "#E9C6A9",
};

const PAGES: CSSProperties = {
  flex: "0 0 auto",
  width: 104,
  height: 148,
  borderRadius: 6,
  border: "1px solid rgba(240, 190, 165, 0.35)",
  padding: "12px 10px",
  boxSizing: "border-box",
};

export default function VysledekM({ sampleState = "s0" }: { sampleState?: SampleState }) {
  const sample = sampleState !== "s0";
  return (
    <div
      className="xv01"
      style={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        background: "#0E070F",
        color: "#F4E9E4",
        fontFamily: "var(--font-mv-jost), system-ui, sans-serif",
        fontVariantNumeric: "lining-nums",
        overflow: "hidden",
        paddingBottom: 1,
      }}
    >
      <Pools
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        pools={[
          { left: -5.333, top: 2.105, width: 112, height: 4.474, rgb: "58 24 56", alpha: 0.55 },
          { left: -26.667, top: 16.316, width: 85.333, height: 5.789, rgb: "42 18 48", alpha: 0.5 },
          { left: 40, top: 40.0, width: 90.667, height: 5.789, rgb: "52 21 51", alpha: 0.45 },
          { left: -8.667, top: 70.0, width: 117.333, height: 5.263, rgb: "58 24 56", alpha: 0.5 },
        ]}
      />
      <header
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "22px 20px 0",
          flexWrap: "wrap",
        }}
      >
        <A
          href="/mezi-vami"
          style={{
            margin: 0,
            fontFamily: GARAMOND,
            fontSize: 15,
            letterSpacing: "0.16em",
            color: "#EADCE2",
            textDecoration: "none",
          }}
        >
          MEZI VÁMI
        </A>
        <SampleBadge mobile />
      </header>

      {/* HERO */}
      <section style={{ position: "relative", padding: "34px 0 0", textAlign: "center" }}>
        <p style={EYEBROW}>Vztahová DNA</p>
        <h1
          style={{
            // rezerva pro descender/diakritiku (viz VysledekD), rozvržení beze změny
            margin: "calc(10px - 0.1em) 20px -0.16em",
            padding: "0.1em 0 0.16em",
            fontFamily: GARAMOND,
            fontWeight: 400,
            fontSize: 46,
            lineHeight: 1,
            background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {PAIR.title}
        </h1>
        <div style={{ margin: "18px 0 0" }}>
          <Signature W={375} H={190} fluid />
        </div>
        <p
          style={{
            margin: "6px 20px 0",
            display: "flex",
            justifyContent: "center",
            gap: 18,
            fontSize: 14,
            color: MUTED,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Dot color={A_COL} /> {PAIR.a}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Dot color={B_COL} /> {PAIR.b}
          </span>
          <span>{PAIR.nodesLabel}</span>
        </p>
        <p style={{ ...EYEBROW, margin: "30px 0 0" }}>Hlavní téma</p>
        <p
          style={{
            margin: "8px 24px 0",
            fontFamily: GARAMOND,
            fontStyle: "italic",
            fontSize: 40,
            lineHeight: 1.05,
            color: "#FFF1E8",
          }}
        >
          {PAIR.mainTheme.title}
        </p>
        <p style={{ margin: "12px 34px 0", fontSize: 17, lineHeight: 1.5, color: "#EADCE2" }}>
          {PAIR.mainTheme.line}
        </p>
        <p style={{ margin: "24px 24px 0", fontSize: 14, lineHeight: 1.5, color: MUTED }}>
          {PAIR.timeNote}
        </p>
      </section>

      {/* VAŠE DVĚ NEBE · KDO JE KDO */}
      <section
        id="dve-nebe"
        style={{ ...CARD, position: "relative", margin: "52px 14px 0", padding: "28px 18px 24px" }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={EYEBROW}>{KDO_JE_KDO.eyebrow}</p>
          <h2 style={{ ...H2, marginTop: 10 }}>{KDO_JE_KDO.title}</h2>
          <p style={{ margin: "10px 0 0", fontSize: 16, color: MUTED }}>{KDO_JE_KDO.lead}</p>
        </div>
        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "1fr 52px 1fr",
            alignItems: "center",
            fontSize: 16,
            color: "#F7EAE4",
          }}
        >
          <p style={{ margin: 0, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            {PAIR.a} <Dot color={A_COL} />
          </p>
          <span />
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Dot color={B_COL} /> {PAIR.b}
          </p>
        </div>
        <div style={{ marginTop: 14 }}>
          {KDO_JE_KDO.rows.map((r) => (
            <div
              key={r.planeta}
              style={{ padding: "20px 0 18px", borderTop: "1px solid rgba(240, 190, 165, 0.16)" }}
            >
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  fontSize: 14,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#D9C3CE",
                }}
              >
                <span aria-hidden="true" style={{ letterSpacing: 0, marginRight: 6, color: "#F0BEA5" }}>
                  {r.glyph}
                </span>
                {r.otazka}{" "}
                <span style={{ letterSpacing: 0, textTransform: "none", color: "#A98F9F" }}>
                  · {r.planeta}
                </span>
              </p>
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr 52px 1fr",
                  alignItems: "center",
                }}
              >
                <div style={{ textAlign: "right", minHeight: 96, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.35, color: "#F7EAE4" }}>{r.a.text}</p>
                  <p style={{ margin: "6px 0 0", fontFamily: GARAMOND, fontStyle: "italic", fontSize: 20, color: A_COL }}>
                    {r.a.znameni}
                  </p>
                </div>
                <Nit typ={r.nit} />
                <div style={{ textAlign: "left", minHeight: 96, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.35, color: "#F7EAE4" }}>{r.b.text}</p>
                  <p style={{ margin: "6px 0 0", fontFamily: GARAMOND, fontStyle: "italic", fontSize: 20, color: B_COL }}>
                    {r.b.znameni}
                  </p>
                </div>
              </div>
              <p style={{ margin: "10px 8px 0", textAlign: "center", fontSize: 15, lineHeight: 1.45, color: "#E3D2DA" }}>
                <span style={{ color: TON_COLOR[r.ton] }}>{r.verdikt}</span> {r.veta}
              </p>
            </div>
          ))}
        </div>
        <div
          style={{
            paddingTop: 22,
            borderTop: "1px solid rgba(240, 190, 165, 0.16)",
            textAlign: "center",
          }}
        >
          <BridgeMark />
          <p style={{ ...EYEBROW, margin: "10px 0 0", fontSize: 14, letterSpacing: "0.12em" }}>
            {KDO_JE_KDO.zaver.eyebrow}
          </p>
          <p style={{ margin: "8px 6px 0", fontFamily: GARAMOND, fontSize: 24, lineHeight: 1.2, color: "#FBEFE9" }}>
            {KDO_JE_KDO.zaver.veta}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 14, fontStyle: "italic", color: MUTED }}>
            {KDO_JE_KDO.zaver.astro}
          </p>
          <p style={{ margin: "14px 0 0", fontSize: 15, color: "#EADCE2" }}>
            {KDO_JE_KDO.zaver.proto} <A href="#t01">{KDO_JE_KDO.zaver.odkaz}</A>
          </p>
          <p style={{ margin: "18px 0 0", fontSize: 14, lineHeight: 1.5, color: MUTED }}>
            {KDO_JE_KDO.zaver.poznamka}
          </p>
        </div>
      </section>

      {/* PĚT VAZEB */}
      <section style={{ position: "relative", margin: "56px 20px 0", textAlign: "center" }}>
        <h2 style={H2}>{TEMATA_HEAD.title}</h2>
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.55, color: MUTED }}>{TEMATA_HEAD.lead}</p>
        <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "#B9A1B0" }}>{TEMATA_HEAD.note}</p>
      </section>
      {TEMATA.map((t, i) => (
        <article
          key={t.id}
          id={t.id}
          style={{
            ...(i === 0 ? HERO_CARD : CARD),
            position: "relative",
            margin: i === 0 ? "28px 14px 0" : "16px 14px 0",
            padding: "26px 22px 22px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: GARAMOND,
              fontSize: 26,
              background: "linear-gradient(135deg, #FFE7D6, #D9917C)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {t.cislo}
          </p>
          <h3
            style={{
              margin: "6px 0 0",
              fontFamily: GARAMOND,
              fontWeight: 400,
              fontSize: i === 0 ? 32 : 28,
              lineHeight: 1.1,
              color: "#FBEFE9",
            }}
          >
            {t.nadpis}
          </h3>
          <p style={{ ...BODY, marginTop: 14 }}>{t.text}</p>
          {t.schvalne && (
            <p
              style={{
                margin: "16px 0 0",
                fontFamily: GARAMOND,
                fontStyle: "italic",
                fontSize: 20,
                lineHeight: 1.3,
                color: "#F6D9C8",
              }}
            >
              {t.schvalne}
            </p>
          )}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(240, 190, 165, 0.2)" }}>
            <p style={{ margin: 0, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C9B0BE" }}>
              {nbsp("Z čeho to čteme")}
            </p>
            {t.dukazy.map((d) => (
              <p key={d.meta} style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.4, color: "#F3E3DC" }}>
                {d.text}{" "}
                <span style={{ fontSize: 14, fontStyle: "italic", color: "#B9A1B0" }}>· {d.meta}</span>
              </p>
            ))}
          </div>
        </article>
      ))}

      {/* SDÍLENÍ */}
      <section style={{ position: "relative", margin: "60px 20px 0", textAlign: "center" }}>
        <Signature W={335} H={110} fluid />
        <p style={{ margin: "18px 0 0", fontFamily: GARAMOND, fontSize: 36, lineHeight: 1.1, color: "#F6DCE6" }}>
          {SDILENI.title}
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.55, color: "#EADCE2" }}>{SDILENI.lead}</p>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {SDILENI.akce.map((a) => (
            <A key={a} href="/mezi-vami/vysledek/karta" style={GHOST}>
              {a}
            </A>
          ))}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 14, color: MUTED }}>{SDILENI.poznamka}</p>
      </section>

      {/* JAK JSME K TOMU DOŠLI */}
      <section
        style={{
          position: "relative",
          margin: "44px 20px 0",
          borderTop: "1px solid rgba(240, 190, 165, 0.2)",
          borderBottom: "1px solid rgba(240, 190, 165, 0.2)",
        }}
      >
        <JakJsme />
      </section>

      {/* OTEVŘENÉ OTÁZKY */}
      <section style={{ position: "relative", margin: "64px 20px 0" }}>
        <p style={EYEBROW}>{OTEVRENE.eyebrow}</p>
        <h2 style={{ ...H2, marginTop: 10 }}>{OTEVRENE.title}</h2>
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.55, color: MUTED }}>{OTEVRENE.lead}</p>
        <ol
          style={{
            margin: "18px 0 0",
            padding: 0,
            listStyle: "none",
            borderBottom: "1px solid rgba(240, 190, 165, 0.16)",
          }}
        >
          {OTEVRENE.polozky.map((p) => (
            <li
              key={p.cislo}
              style={{
                display: "grid",
                gridTemplateColumns: "34px 1fr",
                gap: 6,
                padding: "16px 0",
                borderTop: "1px solid rgba(240, 190, 165, 0.16)",
              }}
            >
              <span style={{ fontFamily: GARAMOND, fontSize: 20, color: "#E6B79C" }}>{p.cislo}</span>
              <span>
                <span style={{ display: "block", fontFamily: GARAMOND, fontSize: 21, lineHeight: 1.25, color: "#FBEFE9" }}>
                  {p.otazka}
                </span>
                <span style={{ display: "block", marginTop: 6, fontSize: 14, color: "#D9B29B" }}>{p.kapitola}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* NABÍDKA */}
      <section
        id="nabidka"
        style={{ ...HERO_CARD, position: "relative", margin: "44px 14px 0", padding: "30px 22px 26px" }}
      >
        <p style={EYEBROW}>{NABIDKA.eyebrow}</p>
        <h2 style={{ ...H2, marginTop: 12, fontSize: 36 }}>{NABIDKA.title}</h2>
        <p style={{ ...BODY, marginTop: 14 }}>{NABIDKA.lead}</p>
        <ul style={{ margin: "18px 0 0", padding: 0, listStyle: "none", fontSize: 15, lineHeight: 1.5, color: "#F7EAE4" }}>
          {NABIDKA.vyhody.map((v, i) => (
            <li key={v} style={{ display: "flex", gap: 10, marginTop: i ? 6 : 0 }}>
              <span style={{ color: "#E6B79C" }}>—</span>
              {v}
            </li>
          ))}
        </ul>
        <PagePreview />
        {sample && (
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.4, color: "#E2C9BC" }}>
            {sampleState === "s1" ? NABIDKA.stitekS1 : NABIDKA.stitekS2}
          </p>
        )}
        <p style={{ margin: "8px 0 0", fontSize: 14, color: MUTED }}>
          {NABIDKA.nahledPoznamka}
          {sample && (
            <>
              {" "}
              <A href="/mezi-vami/vzorek">{NABIDKA.nahledOdkaz}</A>
            </>
          )}
        </p>
        <p style={{ ...EYEBROW, margin: "22px 0 0", letterSpacing: "0.14em" }}>{NABIDKA.naduvodce}</p>
        <ol style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
          {NABIDKA.kapitoly.map((k, i) => (
            <li
              key={k}
              style={{
                display: "flex",
                gap: 12,
                padding: "9px 0",
                borderTop: "1px solid rgba(240, 190, 165, 0.12)",
                fontSize: 15,
                color: "#F3E3DC",
              }}
            >
              <span style={{ minWidth: 18, fontFamily: GARAMOND, color: "#E6B79C" }}>{i + 1}</span>
              {k}
            </li>
          ))}
        </ol>
        <p
          style={{
            margin: "18px 0 0",
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(240, 190, 165, 0.08)",
            fontSize: 14,
            lineHeight: 1.5,
            color: "#EADCE2",
          }}
        >
          {NABIDKA.timeNote} <A href="/mezi-vami/osoba">{NABIDKA.timeNoteOdkaz}</A>
        </p>
        <p style={{ margin: "24px 0 0", fontSize: 14, letterSpacing: "0.18em", textTransform: "uppercase", color: "#C9B0BE" }}>
          {NABIDKA.cenaLabel}
        </p>
        <p data-tabular="" style={{ margin: "2px 0 0", fontFamily: GARAMOND, fontSize: 40, lineHeight: 1, color: "#FFF1E8" }}>
          {NABIDKA.cena}{" "}
          <span style={{ fontFamily: "var(--font-mv-jost), sans-serif", fontSize: 15, color: MUTED }}>
            {NABIDKA.cenaPozn}
          </span>
        </p>
        <A href="/mezi-vami/objednavka" style={{ ...CTA, marginTop: 18 }}>
          {NABIDKA.cta}
        </A>
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.5, textAlign: "center", color: MUTED }}>
          {NABIDKA.paticka[0]} · {NABIDKA.paticka[1]} · <A href="#">{NABIDKA.paticka[2]}</A> ·{" "}
          <A href="#">{NABIDKA.paticka[3]}</A>
        </p>
      </section>
      <p style={{ position: "relative", margin: "30px 0 60px", textAlign: "center" }}>
        <A href="/mezi-vami/osoba" style={{ fontSize: 15 }}>
          {NABIDKA.uprava}
        </A>
      </p>
    </div>
  );
}

function BridgeMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 300 70" style={{ display: "block", margin: "0 auto", width: 300, height: 70 }}>
      <defs>
        <filter id="sbB" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <linearGradient id="sbG" x1="0" x2="1">
          <stop offset="0" stopColor={A_COL} />
          <stop offset="1" stopColor={B_COL} />
        </linearGradient>
      </defs>
      <path d="M 20 52 C 100 6, 200 64, 280 18" fill="none" stroke="url(#sbG)" strokeWidth="9" opacity="0.32" filter="url(#sbB)" />
      <path d="M 20 52 C 100 6, 200 64, 280 18" fill="none" stroke="url(#sbG)" strokeWidth="1.6" />
      <circle cx="150" cy="35" r="22" fill="#FFE6D6" opacity="0.4" filter="url(#sbB)" className="mv-breathe" />
      <circle cx="150" cy="35" r="5" fill="#FFF6EF" />
    </svg>
  );
}

/** „Jak jsme k tomu došli“: sbalené jako na plátně; rozbalený obsah je ODVOZENÝ (plátno ho nemá). */
export function JakJsme() {
  return (
    <details>
      <summary
        style={{
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          color: "#F7EAE4",
          fontSize: 16,
          textAlign: "left",
        }}
      >
        <span>
          {JAK_JSME.title}
          <span style={{ display: "block", marginTop: 2, fontSize: 14, color: MUTED }}>{JAK_JSME.sub}</span>
        </span>
        <span aria-hidden="true" style={{ fontSize: 22, color: "#F0BEA5" }}>
          +
        </span>
      </summary>
      <ol style={{ margin: 0, padding: "0 0 20px", listStyle: "none" }}>
        {TEMATA.flatMap((t) => t.dukazy).map((d) => (
          <li key={d.meta} style={{ padding: "9px 0", borderTop: "1px solid rgba(240, 190, 165, 0.12)", fontSize: 15, lineHeight: 1.4, color: "#F3E3DC" }}>
            {d.text} <span style={{ fontSize: 14, fontStyle: "italic", color: "#B9A1B0" }}>· {d.meta}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

const OBSAH_NAHLED = [
  "1&nbsp;&nbsp;Nejdřív to nejdůležitější",
  "2&nbsp;&nbsp;Jak každý funguje",
  "3&nbsp;&nbsp;Pět vztahů v jednom",
  "4&nbsp;&nbsp;Láska a přitažlivost",
  "5&nbsp;&nbsp;Emoce a konflikt",
  "6&nbsp;&nbsp;Blízkost a svoboda",
  "7&nbsp;&nbsp;Co v sobě probouzíte",
  "8&nbsp;&nbsp;Na doma: modelové situace a&nbsp;co zkusit jinak",
  "9&nbsp;&nbsp;Pod kapotou: z&nbsp;čeho analýza vychází",
].map((l) => nbsp(n(l)));

export function PagePreview() {
  const dark = "linear-gradient(170deg, #2B1430, #12080F)";
  const t6: CSSProperties = { display: "block", fontSize: 6, lineHeight: 1.6, color: "#3A2230" };
  return (
    <div aria-hidden="true" style={{ marginTop: 22, display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
      <div
        style={{
          ...PAGES,
          background: dark,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          textAlign: "center",
        }}
      >
        <span style={{ fontFamily: GARAMOND, fontSize: 7, letterSpacing: "0.2em", color: "#EADCE2" }}>MEZI VÁMI</span>
        <svg aria-hidden="true" viewBox="0 0 80 30" style={{ width: 80, height: 30, margin: "0 auto" }}>
          <path d="M 0 22 C 25 2, 55 28, 80 8" fill="none" stroke="#C98BC0" strokeWidth="1" />
          <path d="M 0 8 C 25 28, 55 2, 80 22" fill="none" stroke="#F2BE9C" strokeWidth="1" />
        </svg>
        <span style={{ fontFamily: GARAMOND, fontSize: 13, lineHeight: 1.1, color: "#F6E2D6" }}>{PAIR.title}</span>
      </div>
      <div style={{ ...PAGES, background: "#F7F0EA" }}>
        <span style={{ display: "block", fontFamily: GARAMOND, fontSize: 12, color: "#2A1220" }}>Obsah</span>
        <span style={{ display: "block", marginTop: 6 }}>
          {OBSAH_NAHLED.map((l) => (
            <span key={l} style={t6}>
              {l}
            </span>
          ))}
        </span>
      </div>
      <div
        style={{
          ...PAGES,
          background: dark,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <span style={{ fontFamily: GARAMOND, fontSize: 22, color: "#E6B79C" }}>5</span>
        <span style={{ fontFamily: GARAMOND, fontSize: 11, lineHeight: 1.15, color: "#F6E2D6" }}>
          {nbsp("Emoce, komunikace a konflikt")}
        </span>
      </div>
      <div style={{ ...PAGES, background: "#F7F0EA" }}>
        <span style={{ display: "block", fontFamily: GARAMOND, fontSize: 10, lineHeight: 1.2, color: "#2A1220" }}>
          {nbsp("Když je jednomu z vás těžko")}
        </span>
        <span style={{ display: "block", marginTop: 6, fontSize: 6, lineHeight: 1.55, color: "#4A3240" }}>
          {nbsp(
            "Po hádce chce Jana nejdřív klid. Tomáš potřebuje věc uzavřít hned, jinak mu nedá spát. Oba přitom chcete totéž: aby bylo zase dobře. Rozdíl je jen v tom, kudy k tomu vede cesta…",
          )}
        </span>
      </div>
    </div>
  );
}
