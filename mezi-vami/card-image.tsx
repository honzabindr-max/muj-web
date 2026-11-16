// Obrázek sdílecí karty (V-02, 9:16) a OG náhledu pro next/og. Fonty: EB Garamond + Jost (OFL),
// převedené z woff2 do TTF (satori neumí woff2). Na kartě nejsou data, časy ani místa narození.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { signature } from "@/app/mezi-vami/_lib/signature";
import type { VazbaTyp } from "@/app/mezi-vami/_data/fixtures";

const dir = path.join(process.cwd(), "mezi-vami", "fonts");

export async function cardFonts() {
  const [gar, garI, jost] = await Promise.all([
    readFile(path.join(dir, "EBGaramond.ttf")),
    readFile(path.join(dir, "EBGaramond-Italic.ttf")),
    readFile(path.join(dir, "Jost.ttf")),
  ]);
  return [
    { name: "Garamond", data: gar, style: "normal" as const, weight: 400 as const },
    { name: "Garamond", data: garI, style: "italic" as const, weight: 400 as const },
    { name: "Jost", data: jost, style: "normal" as const, weight: 400 as const },
  ];
}

type Vazba = { typ: VazbaTyp; strong: boolean };

function Curves({ W, H, vazby }: { W: number; H: number; vazby: Vazba[] }) {
  const g = signature(W, H, vazby);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={g.pathA} fill="none" stroke="#C98BC0" strokeWidth={2.2} />
      <path d={g.pathB} fill="none" stroke="#F2BE9C" strokeWidth={2.2} />
      {g.nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.strong ? 7 : 3.5} fill="#FFF1E6" />
      ))}
    </svg>
  );
}

const BG = "radial-gradient(120% 80% at 50% 30%, #3A1838 0%, #1A0C1B 55%, #0E070F 100%)";

/** Sdílecí karta 1080×1920 (karta 360×640 ×3). */
export function CardImage(k: {
  title: string;
  tema: string;
  veta: string;
  glyph: string;
  otazka: string;
  a: { jmeno: string; text: string };
  b: { jmeno: string; text: string };
  paticka: string;
  vazby: Vazba[];
}) {
  const S = 3;
  return (
    <div
      style={{
        width: 360 * S,
        height: 640 * S,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${36 * S}px ${26 * S}px`,
        background: BG,
        color: "#F4E9E4",
        fontFamily: "Jost",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: "Garamond", fontSize: 14 * S, letterSpacing: "0.18em", color: "#EADCE2" }}>MEZI VÁMI</div>
      <div style={{ marginTop: 34 * S, fontSize: 12 * S, letterSpacing: "0.18em", color: "#F0BEA5" }}>VZTAHOVÁ DNA</div>
      <div style={{ marginTop: 8 * S, fontFamily: "Garamond", fontSize: 40 * S, lineHeight: 1, color: "#F6E2D6" }}>{k.title}</div>
      <div style={{ marginTop: 22 * S, display: "flex" }}>
        <Curves W={360 * S} H={140 * S} vazby={k.vazby} />
      </div>
      <div style={{ marginTop: 26 * S, fontFamily: "Garamond", fontStyle: "italic", fontSize: 32 * S, lineHeight: 1.08, color: "#FFF1E8" }}>
        {k.tema}
      </div>
      <div style={{ marginTop: 12 * S, fontSize: 16 * S, lineHeight: 1.45, color: "#EADCE2" }}>{k.veta}</div>
      <div
        style={{
          marginTop: 24 * S,
          width: "100%",
          paddingTop: 16 * S,
          borderTop: `${S}px solid rgba(240, 190, 165, 0.2)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 12 * S, letterSpacing: "0.16em", color: "#F0BEA5" }}>
          {k.otazka.toUpperCase()}
        </div>
        <div style={{ marginTop: 8 * S, display: "flex", width: "100%", fontSize: 15 * S, lineHeight: 1.35 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", paddingRight: 7 * S }}>
            <span style={{ color: "#E7C2DD" }}>{k.a.jmeno}</span>
            <span style={{ color: "#F7EAE4", textAlign: "right" }}>{k.a.text}</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", paddingLeft: 7 * S }}>
            <span style={{ color: "#F6D2BB" }}>{k.b.jmeno}</span>
            <span style={{ color: "#F7EAE4", textAlign: "left" }}>{k.b.text}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: "auto", fontSize: 12 * S, letterSpacing: "0.03em", color: "#C2ACB7" }}>{k.paticka}</div>
    </div>
  );
}

/** OG náhled 1200×630 — bez jmen (odkaz může otevřít kdokoli). */
export function OgImage({ tema, veta, vazby }: { tema: string; veta: string; vazby: Vazba[] }) {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: BG,
        color: "#F4E9E4",
        fontFamily: "Jost",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: "Garamond", fontSize: 30, letterSpacing: "0.18em", color: "#EADCE2" }}>MEZI VÁMI</div>
      <div style={{ marginTop: 18, fontSize: 22, letterSpacing: "0.18em", color: "#F0BEA5" }}>VZTAHOVÁ DNA</div>
      <div style={{ marginTop: 18, display: "flex" }}>
        <Curves W={1100} H={160} vazby={vazby} />
      </div>
      <div style={{ marginTop: 18, fontFamily: "Garamond", fontStyle: "italic", fontSize: 64, color: "#FFF1E8" }}>{tema}</div>
      <div style={{ marginTop: 10, fontSize: 28, color: "#EADCE2" }}>{veta}</div>
    </div>
  );
}
