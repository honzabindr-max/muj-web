"use client";

import { useDna } from "./view";
import { ShareActions } from "./ShareActions";
// V · Výsledek (desktop 1440) — ODVOZENO. Plátno má V jen mobilně; mřížka, okraje, velikosti
// písma a karty jsou z D-05-Vysledek (max-width 1280, okraje 40 px, nadpisy 64/96 px,
// karta „hlavní“ 900 px, 26/22 px radius), obsah a pořadí bloků z V-01 (fixtures).

import type { CSSProperties } from "react";
import { A } from "../_lib/A";
import { SampleBadge } from "../_lib/SampleBadge";
import { Pools } from "../_lib/LightCurve";
import {
  JAK_JSME,
  ZDROJ_ANALYZY,
  SDILENI,
  TEMATA_HEAD,
  temataTitle,
  type NoteTon,
} from "../_data/fixtures";
import type { Tema as TemaT } from "../_data/fixtures";
import { A_COL, B_COL, Dot, Nit, Signature } from "./parts";
import { nbsp } from "../_lib/nbsp";
import { PagePreview, type SampleState } from "./VysledekM";

const GARAMOND = "var(--font-mv-garamond), serif";
const MUTED = "#C2ACB7";
const WRAP: CSSProperties = { position: "relative", maxWidth: 1280, margin: "0 auto", padding: "0 40px" };
const EYEBROW: CSSProperties = {
  margin: 0,
  fontSize: 15,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#F0BEA5",
};
const H2: CSSProperties = {
  margin: 0,
  fontFamily: GARAMOND,
  fontWeight: 400,
  fontSize: 56,
  lineHeight: 1.04,
  color: "#F7EAE4",
};
const CARD_MAIN: CSSProperties = {
  borderRadius: 26,
  border: "1px solid transparent",
  background:
    "linear-gradient(170deg, rgba(50, 26, 52, 0.96), rgba(22, 11, 24, 0.97)) padding-box, linear-gradient(140deg, rgba(255, 214, 190, 0.8), rgba(185, 138, 198, 0.2) 45%, rgba(255, 214, 190, 0.6)) border-box",
  boxShadow:
    "0 40px 90px rgba(0, 0, 0, 0.6), 0 0 80px rgba(220, 130, 150, 0.22), inset 0 1px 0 rgba(255, 230, 215, 0.15)",
};
const CARD: CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(240, 190, 165, 0.22)",
  background: "linear-gradient(170deg, rgba(44, 22, 46, 0.92), rgba(22, 11, 24, 0.95))",
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
  fontSize: 17,
  fontWeight: 500,
  boxShadow: "0 12px 36px rgba(240, 160, 130, 0.35), inset 0 1px 0 rgba(255, 244, 236, 0.7)",
};
const GHOST: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 54,
  padding: "0 30px",
  borderRadius: 999,
  border: "1px solid rgba(240, 190, 165, 0.5)",
  background: "rgba(255, 225, 205, 0.04)",
  color: "#F7EAE4",
  fontSize: 15,
  textDecoration: "none",
};
const TON: Record<NoteTon, string> = { ladite: "#E9C6A9", trete: "#F2A98C", plynete: "#E9C6A9" };
const NUM: CSSProperties = {
  margin: 0,
  fontFamily: GARAMOND,
  background: "linear-gradient(135deg, #FFE7D6, #D9917C)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default function VysledekD({ sampleState = "s0" }: { sampleState?: SampleState }) {
  const { pair: PAIR, kdoJeKdo: KDO_JE_KDO, temata: TEMATA, otevrene: OTEVRENE, nabidka: NABIDKA } = useDna();
  const sample = sampleState !== "s0";
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
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
          { left: 52, top: 0, width: 62, height: 7, rgb: "58 24 56", alpha: 0.55 },
          { left: -10, top: 18, width: 58, height: 8, rgb: "42 18 48", alpha: 0.5 },
          { left: 50, top: 44, width: 58, height: 8, rgb: "49 20 49", alpha: 0.45 },
          { left: -8, top: 72, width: 64, height: 8, rgb: "58 24 56", alpha: 0.45 },
        ]}
      />
      <header style={{ ...WRAP, padding: "28px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <A href="/mezi-vami" style={{ fontFamily: GARAMOND, fontSize: 23, letterSpacing: "0.14em", color: "#EADCE2", textDecoration: "none" }}>
          MEZI VÁMI
        </A>
        <SampleBadge />
      </header>

      {/* HERO */}
      <section style={{ ...WRAP, padding: "40px 40px 0", textAlign: "center" }}>
        <p style={EYEBROW}>Vztahová DNA</p>
        <h1
          style={{
            // box se zvětší o rezervu pro descender/diakritiku (background-clip:text ořezává
            // vše mimo box), vyrovná ji záporný margin → rozvržení beze změny
            margin: "calc(14px - 0.1em) 0 -0.16em",
            padding: "0.1em 0 0.16em",
            fontFamily: GARAMOND,
            fontWeight: 400,
            fontSize: 96,
            lineHeight: 0.98,
            background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {PAIR.title}
        </h1>
        <div style={{ margin: "28px auto 0", maxWidth: 1000 }}>
          <Signature W={1000} H={200} fluid />
        </div>
        <p style={{ margin: "10px 0 0", display: "flex", justifyContent: "center", gap: 28, fontSize: 16, color: MUTED }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Dot color={A_COL} /> {PAIR.a}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Dot color={B_COL} /> {PAIR.b}
          </span>
          <span>{PAIR.nodesLabel}</span>
        </p>
        <p style={{ ...EYEBROW, margin: "48px 0 0" }}>Hlavní téma</p>
        <p style={{ margin: "10px 0 0", fontFamily: GARAMOND, fontStyle: "italic", fontSize: 72, lineHeight: 1.02, color: "#FFF1E8" }}>
          {PAIR.mainTheme.title}
        </p>
        <p style={{ margin: "18px 0 0", fontSize: 22, lineHeight: 1.5, color: "#EADCE2" }}>{PAIR.mainTheme.line}</p>
        <p style={{ margin: "28px auto 0", maxWidth: 620, fontSize: 15, lineHeight: 1.6, color: MUTED }}>{PAIR.timeNote}</p>
      </section>

      {/* VAŠE DVĚ NEBE */}
      <section id="dve-nebe" style={{ ...WRAP, padding: "100px 40px 0" }}>
        <div style={{ ...CARD_MAIN, maxWidth: 960, margin: "0 auto", padding: "48px 56px 44px" }}>
          <div style={{ textAlign: "center" }}>
            <p style={EYEBROW}>{KDO_JE_KDO.eyebrow}</p>
            <h2 style={{ ...H2, marginTop: 12, color: "#FBEFE9" }}>{KDO_JE_KDO.title}</h2>
            <p style={{ margin: "14px 0 0", fontSize: 18, color: MUTED }}>{KDO_JE_KDO.lead}</p>
          </div>
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 96px 1fr", alignItems: "center", fontSize: 18, color: "#F7EAE4" }}>
            <p style={{ margin: 0, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
              {PAIR.a} <Dot color={A_COL} />
            </p>
            <span />
            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <Dot color={B_COL} /> {PAIR.b}
            </p>
          </div>
          <div style={{ marginTop: 18 }}>
            {KDO_JE_KDO.rows.map((r) => (
              <div key={r.planeta} style={{ padding: "26px 0 24px", borderTop: "1px solid rgba(240, 190, 165, 0.16)" }}>
                <p style={{ margin: 0, textAlign: "center", fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase", color: "#D9C3CE" }}>
                  <span aria-hidden="true" style={{ letterSpacing: 0, marginRight: 8, color: "#F0BEA5" }}>{r.glyph}</span>
                  {r.otazka}{" "}
                  <span style={{ letterSpacing: 0, textTransform: "none", color: "#A98F9F" }}>· {r.planeta}</span>
                </p>
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 96px 1fr", alignItems: "center" }}>
                  <div style={{ textAlign: "right", minHeight: 120, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ margin: 0, fontSize: 19, lineHeight: 1.35, color: "#F7EAE4" }}>{r.a.text}</p>
                    <p style={{ margin: "8px 0 0", fontFamily: GARAMOND, fontStyle: "italic", fontSize: 26, color: A_COL }}>{r.a.znameni}</p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Nit typ={r.nit} scale={1.25} />
                  </div>
                  <div style={{ textAlign: "left", minHeight: 120, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ margin: 0, fontSize: 19, lineHeight: 1.35, color: "#F7EAE4" }}>{r.b.text}</p>
                    <p style={{ margin: "8px 0 0", fontFamily: GARAMOND, fontStyle: "italic", fontSize: 26, color: B_COL }}>{r.b.znameni}</p>
                  </div>
                </div>
                <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 17, lineHeight: 1.45, color: "#E3D2DA" }}>
                  <span style={{ color: TON[r.ton] }}>{r.verdikt}</span> {r.veta}
                </p>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 30, borderTop: "1px solid rgba(240, 190, 165, 0.16)", textAlign: "center" }}>
            <p style={{ ...EYEBROW, margin: 0 }}>{KDO_JE_KDO.zaver.eyebrow}</p>
            <p style={{ margin: "12px auto 0", maxWidth: 640, fontFamily: GARAMOND, fontSize: 34, lineHeight: 1.2, color: "#FBEFE9" }}>
              {KDO_JE_KDO.zaver.veta}
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 15, fontStyle: "italic", color: MUTED }}>{KDO_JE_KDO.zaver.astro}</p>
            <p style={{ margin: "16px 0 0", fontSize: 17, color: "#EADCE2" }}>
              {KDO_JE_KDO.zaver.proto} <A href="#t01">{KDO_JE_KDO.zaver.odkaz}</A>
            </p>
            <p style={{ margin: "18px 0 0", fontSize: 15, color: MUTED }}>{KDO_JE_KDO.zaver.poznamka}</p>
          </div>
        </div>
      </section>

      {/* PĚT VAZEB */}
      <section style={{ ...WRAP, padding: "110px 40px 0" }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={H2}>{temataTitle(TEMATA.length)}</h2>
          <p style={{ margin: "16px 0 0", fontSize: 18, color: MUTED }}>{TEMATA_HEAD.lead}</p>
          <p style={{ margin: "10px 0 0", fontSize: 15, color: "#B9A1B0" }}>{TEMATA_HEAD.note}</p>
        </div>
        {TEMATA.slice(0, 1).map((t) => (
          <Tema key={t.id} t={t} main />
        ))}
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 28 }}>
          {TEMATA.slice(1).map((t) => (
            <Tema key={t.id} t={t} />
          ))}
        </div>
      </section>

      {/* SDÍLENÍ */}
      <section style={{ ...WRAP, padding: "110px 40px 0", textAlign: "center" }}>
        <div style={{ margin: "0 auto", maxWidth: 560 }}>
          <Signature W={560} H={140} fluid />
        </div>
        <p style={{ margin: "22px 0 0", fontFamily: GARAMOND, fontSize: 56, lineHeight: 1.1, color: "#F6DCE6" }}>{SDILENI.title}</p>
        <p style={{ margin: "14px 0 0", fontSize: 18, color: "#EADCE2" }}>{SDILENI.lead}</p>
        <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <ShareActions labels={SDILENI.akce} style={GHOST} />
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 15, color: MUTED }}>{SDILENI.poznamka}</p>
      </section>

      <section style={{ ...WRAP, padding: "56px 40px 0" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", borderTop: "1px solid rgba(240, 190, 165, 0.2)", borderBottom: "1px solid rgba(240, 190, 165, 0.2)" }}>
          <details>
            <summary style={{ minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: "#F7EAE4", fontSize: 18 }}>
              <span>
                {JAK_JSME.title}
                <span style={{ display: "block", marginTop: 2, fontSize: 15, color: MUTED }}>{JAK_JSME.sub}</span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 26, color: "#F0BEA5" }}>+</span>
            </summary>
            <ol style={{ margin: 0, padding: "0 0 24px", listStyle: "none" }}>
              {TEMATA.flatMap((t) => t.dukazy).map((d, di) => (
                <li key={di} style={{ padding: "10px 0", borderTop: "1px solid rgba(240, 190, 165, 0.12)", fontSize: 16, lineHeight: 1.45, color: "#F3E3DC" }}>
                  {d.text} <span style={{ fontSize: 15, fontStyle: "italic", color: "#B9A1B0" }}>· {d.meta}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </section>

      {/* OTEVŘENÉ OTÁZKY + NABÍDKA */}
      <section style={{ ...WRAP, padding: "110px 40px 0", display: "flex", flexWrap: "wrap", gap: 56, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 440px", minWidth: 0 }}>
          <p style={EYEBROW}>{OTEVRENE.eyebrow}</p>
          <h2 style={{ ...H2, marginTop: 14, fontSize: 52 }}>{OTEVRENE.title}</h2>
          <p style={{ margin: "16px 0 0", fontSize: 18, lineHeight: 1.65, color: MUTED, maxWidth: 520 }}>{OTEVRENE.lead}</p>
        </div>
        <ol style={{ flex: "1 1 520px", minWidth: 0, margin: 0, padding: 0, listStyle: "none", borderBottom: "1px solid rgba(240, 190, 165, 0.16)" }}>
          {OTEVRENE.polozky.map((p) => (
            <li key={p.cislo} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 8, padding: "20px 0", borderTop: "1px solid rgba(240, 190, 165, 0.16)" }}>
              <span style={{ fontFamily: GARAMOND, fontSize: 24, color: "#E6B79C" }}>{p.cislo}</span>
              <span>
                <span style={{ display: "block", fontFamily: GARAMOND, fontSize: 26, lineHeight: 1.25, color: "#FBEFE9" }}>{p.otazka}</span>
                <span style={{ display: "block", marginTop: 6, fontSize: 15, color: "#D9B29B" }}>{p.kapitola}</span>
              </span>
            </li>
          ))}
        </ol>
        <p style={{ margin: "22px 0 0" }}>
          <A href="#nabidka" style={GHOST}>
            {NABIDKA.eyebrow} <span aria-hidden="true">↓</span>
          </A>
        </p>
      </section>

      <section id="nabidka" style={{ position: "relative", maxWidth: 1360, margin: "80px auto 0", padding: "0 24px" }}>
        <div style={{ ...CARD_MAIN, borderRadius: 28, padding: "64px 64px 56px", overflow: "hidden", display: "flex", flexWrap: "wrap", gap: 56, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 460px", minWidth: 0 }}>
            <p style={EYEBROW}>{NABIDKA.eyebrow}</p>
            <h2 style={{ ...H2, marginTop: 14, fontSize: 56, color: "#FBEFE9" }}>{NABIDKA.title}</h2>
            <p style={{ margin: "18px 0 0", fontSize: 18, lineHeight: 1.65, color: "#EADCE2", maxWidth: 520 }}>{NABIDKA.lead}</p>
            <ul style={{ margin: "22px 0 0", padding: 0, listStyle: "none", fontSize: 17, lineHeight: 1.5, color: "#F7EAE4" }}>
              {NABIDKA.vyhody.map((v, i) => (
                <li key={v} style={{ display: "flex", gap: 10, marginTop: i ? 8 : 0 }}>
                  <span style={{ color: "#E6B79C" }}>–</span>
                  {v}
                </li>
              ))}
            </ul>
            <PagePreview />
            {sample && (
              <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.4, color: "#E2C9BC" }}>
                {sampleState === "s1" ? NABIDKA.stitekS1 : NABIDKA.stitekS2}
              </p>
            )}
            <p style={{ margin: "10px 0 0", fontSize: 15, color: MUTED }}>
              {NABIDKA.nahledPoznamka}
          {sample && (
            <>
              {" "}
              <A href="/mezi-vami/vzorek">{NABIDKA.nahledOdkaz}</A>
            </>
          )}
            </p>
          </div>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <p style={{ ...EYEBROW, letterSpacing: "0.14em" }}>{NABIDKA.naduvodce}</p>
            <ol style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
              {NABIDKA.kapitoly.map((k, i) => (
                <li key={k} style={{ display: "flex", gap: 14, padding: "10px 0", borderTop: "1px solid rgba(240, 190, 165, 0.12)", fontSize: 16, color: "#F3E3DC" }}>
                  <span style={{ minWidth: 20, fontFamily: GARAMOND, color: "#E6B79C" }}>{i + 1}</span>
                  {k}
                </li>
              ))}
            </ol>
            {NABIDKA.timeNote ? (
<p style={{ margin: "20px 0 0", padding: "14px 18px", borderRadius: 14, background: "rgba(240, 190, 165, 0.08)", fontSize: 15, lineHeight: 1.5, color: "#EADCE2" }}>
              {NABIDKA.timeNote} <A href="/mezi-vami/osoba">{NABIDKA.timeNoteOdkaz}</A>
            </p>
) : null}
            <p style={{ margin: "28px 0 0", fontSize: 15, letterSpacing: "0.18em", textTransform: "uppercase", color: "#C9B0BE" }}>
              {NABIDKA.cenaLabel}
            </p>
            <p data-tabular="" style={{ margin: "4px 0 0", fontFamily: GARAMOND, fontSize: 56, lineHeight: 1, color: "#FFF1E8" }}>
              {NABIDKA.cena}{" "}
              <span style={{ fontFamily: "var(--font-mv-jost), sans-serif", fontSize: 16, color: MUTED }}>{NABIDKA.cenaPozn}</span>
            </p>
            <section aria-labelledby="zdroj-analyzy" style={{ margin: "24px 0 0", padding: "16px 18px", borderRadius: 14, background: "rgba(240, 190, 165, 0.08)", fontSize: 15, lineHeight: 1.5, color: "#EADCE2" }}>
              <h3 id="zdroj-analyzy" style={{ margin: 0, fontSize: 15, fontWeight: 400, color: "#F7EAE4" }}>{ZDROJ_ANALYZY.title}</h3>
              {ZDROJ_ANALYZY.odstavce.map((t) => (
                <p key={t} style={{ margin: "10px 0 0" }}>{t}</p>
              ))}
            </section>
            <A href="/mezi-vami/objednavka" style={{ ...CTA, marginTop: 20 }}>
              {NABIDKA.cta}
            </A>
            <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.5, textAlign: "center", color: MUTED }}>
              {NABIDKA.paticka[0]} · {NABIDKA.paticka[1]} · <A href="#">{NABIDKA.paticka[2]}</A> · <A href="#">{NABIDKA.paticka[3]}</A>
            </p>
          </div>
        </div>
      </section>
      <p style={{ position: "relative", margin: "36px 0 80px", textAlign: "center" }}>
        <A href="/mezi-vami/osoba" style={{ fontSize: 16 }}>{NABIDKA.uprava}</A>
      </p>
    </div>
  );
}

function Tema({ t, main = false }: { t: TemaT; main?: boolean }) {
  return (
    <article
      id={t.id}
      style={{
        ...(main ? CARD_MAIN : CARD),
        position: "relative",
        margin: main ? "40px auto 0" : 0,
        maxWidth: main ? 900 : undefined,
        padding: main ? "44px 48px" : "34px 36px",
      }}
    >
      <p style={{ ...NUM, fontSize: main ? 40 : 34 }}>{t.cislo}</p>
      <h3 style={{ margin: "8px 0 0", fontFamily: GARAMOND, fontWeight: 400, fontSize: main ? 46 : 30, lineHeight: main ? 1.08 : 1.12, color: main ? "#FBEFE9" : "#F7EAE4" }}>
        {t.nadpis}
      </h3>
      <p style={{ margin: main ? "18px 0 0" : "14px 0 0", fontSize: main ? 19 : 17, lineHeight: 1.7, color: "#EADCE2", maxWidth: 720 }}>{t.text}</p>
      {t.schvalne && (
        <p style={{ margin: "20px 0 0", fontFamily: GARAMOND, fontStyle: "italic", fontSize: main ? 26 : 22, lineHeight: 1.3, color: "#F6D9C8" }}>{t.schvalne}</p>
      )}
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(240, 190, 165, 0.2)" }}>
        <p style={{ margin: 0, fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C9B0BE" }}>{nbsp("Z čeho to čteme")}</p>
        {t.dukazy.map((d, di) => (
          <p key={di} style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.45, color: "#F3E3DC" }}>
            {d.text} <span style={{ fontSize: 15, fontStyle: "italic", color: "#B9A1B0" }}>· {d.meta}</span>
          </p>
        ))}
      </div>
    </article>
  );
}
