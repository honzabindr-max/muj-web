// V-02 · Sdílecí karta 9:16 (360×640). Záměrně jen jména, téma a jeden řádek —
// žádná data, časy ani místa narození (viz KARTA ve fixtures).

import { KARTA } from "../_data/fixtures";
import { Signature } from "./parts";

export default function Karta() {
  const GAR = "var(--font-mv-garamond), serif";
  return (
    <div
      style={{
        position: "relative",
        width: 360,
        height: 640,
        boxSizing: "border-box",
        padding: "36px 26px",
        background: "radial-gradient(120% 80% at 50% 30%, #3A1838 0%, #1A0C1B 55%, #0E070F 100%)",
        color: "#F4E9E4",
        fontFamily: "var(--font-mv-jost), system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      <p style={{ margin: 0, fontFamily: GAR, fontSize: 14, letterSpacing: "0.18em", color: "#EADCE2" }}>{KARTA.znacka}</p>
      <p style={{ margin: "34px 0 0", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#F0BEA5" }}>{KARTA.eyebrow}</p>
      <h1 style={{ margin: "8px 0 0", fontFamily: GAR, fontSize: 40, fontWeight: 400, lineHeight: 1, color: "#F6E2D6" }}>{KARTA.title}</h1>
      <div style={{ margin: "22px -26px 0" }}>
        <Signature W={360} H={140} />
      </div>
      <p style={{ margin: "26px 0 0", fontFamily: GAR, fontStyle: "italic", fontSize: 32, lineHeight: 1.08, color: "#FFF1E8" }}>{KARTA.tema}</p>
      <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.45, color: "#EADCE2" }}>{KARTA.veta}</p>
      <div style={{ marginTop: 24, width: "100%", paddingTop: 16, borderTop: "1px solid rgba(240, 190, 165, 0.2)" }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#F0BEA5" }}>
          {KARTA.jakMiluje.glyph} {KARTA.jakMiluje.otazka}
        </p>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 15, lineHeight: 1.35 }}>
          <span style={{ textAlign: "right", color: "#E7C2DD" }}>
            {KARTA.jakMiluje.a.jmeno}
            <br />
            <span style={{ color: "#F7EAE4" }}>{KARTA.jakMiluje.a.text}</span>
          </span>
          <span style={{ textAlign: "left", color: "#F6D2BB" }}>
            {KARTA.jakMiluje.b.jmeno}
            <br />
            <span style={{ color: "#F7EAE4" }}>{KARTA.jakMiluje.b.text}</span>
          </span>
        </div>
      </div>
      <p style={{ margin: "auto 0 0", fontSize: 13, letterSpacing: "0.08em", color: "#C2ACB7" }}>{KARTA.paticka}</p>
    </div>
  );
}
