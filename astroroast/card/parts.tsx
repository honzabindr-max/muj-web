// Stavební kameny karet. Satori: jen flexbox a inline styly, každý div s více dětmi má display:flex.
// Žádné emoji (satori je bez loaderu nevykreslí): paprička a hvězdy jsou kreslené z divů.
import type { CSSProperties, ReactNode } from "react";
import { C, FONT, FOOTER_TEXT, LEVEL_ACCENT, bold } from "./theme";
import type { Level } from "@/astroroast/types";

/** Nalepovací štítek (rotovaný, tlustý obrys, tvrdý stín). */
export function Sticker({
  children, bg, color = C.space, rotate = -3, size, pad, shadow = C.cream,
}: {
  children: ReactNode; bg: string; color?: string; rotate?: number; size: number; pad: number; shadow?: string;
}) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    background: bg,
    color,
    fontFamily: FONT,
    fontSize: size,
    letterSpacing: size * 0.04,
    textTransform: "uppercase",
    padding: `${pad}px ${pad * 1.7}px`,
    borderRadius: size * 0.35,
    border: `${Math.max(3, size * 0.1)}px solid ${C.space}`,
    boxShadow: `${size * 0.18}px ${size * 0.18}px 0 ${shadow}`,
    transform: `rotate(${rotate}deg)`,
  };
  // satori: boxShadow + textShadow na jednom prvku obarví text barvou stínu, proto vnitřní obal.
  return (
    <div style={style}>
      <div style={{ display: "flex", textShadow: bold(color, size * 0.025) }}>{children}</div>
    </div>
  );
}

/** Jedna kreslená paprička. */
export function Pepper({ size, on, accent }: { size: number; on: boolean; accent: string }) {
  const w = size * 0.42;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: size * 0.62, height: size }}>
      <div style={{ width: w * 0.28, height: size * 0.2, background: on ? C.lime : "rgba(255,246,233,0.25)", borderRadius: 4, transform: "rotate(14deg)", marginBottom: -size * 0.04 }} />
      <div
        style={{
          width: w,
          height: size * 0.8,
          background: on ? accent : "rgba(255,246,233,0.12)",
          border: `${Math.max(2, size * 0.05)}px solid ${on ? C.space : "rgba(255,246,233,0.35)"}`,
          borderRadius: `${w}px ${w}px ${w * 0.6}px ${w * 0.1}px`,
          transform: "rotate(-14deg)",
          boxShadow: on ? `${size * 0.05}px ${size * 0.05}px 0 ${C.cream}` : "none",
        }}
      />
    </div>
  );
}

/** Pálivost 1–5 jako řada papriček. */
export function SpiceMeter({ level, size }: { level: Level; size: number }) {
  const accent = LEVEL_ACCENT[level];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.14 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pepper key={i} size={size} on={i <= level} accent={accent} />
      ))}
    </div>
  );
}

/** Měřák spálení 0–100. */
export function BurnBar({ burn, width, height, label, showValue = true }: { burn: number; width: number; height: number; label: string; showValue?: boolean }) {
  const pct = Math.max(4, Math.min(100, Math.round(burn)));
  const fs = height * 0.95;
  return (
    <div style={{ display: "flex", flexDirection: "column", width, gap: height * 0.35 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontFamily: FONT, color: C.cream }}>
        <div style={{ display: "flex", fontSize: fs, letterSpacing: fs * 0.08, textTransform: "uppercase" }}>{label}</div>
        {showValue && <div style={{ display: "flex", fontSize: fs * 1.5, color: C.lime, textShadow: bold(C.lime, fs * 0.03) }}>{`${pct} %`}</div>}
      </div>
      <div
        style={{
          display: "flex",
          width,
          height,
          background: "rgba(255,246,233,0.1)",
          border: `${Math.max(3, height * 0.12)}px solid ${C.cream}`,
          borderRadius: height,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${C.violet}, ${C.pink}, ${C.flame})` }} />
      </div>
    </div>
  );
}

/** Kruh se jménem znamení místo glyfu (font glyfy znamení nemá). */
export function SignDisc({ name, d, accent }: { name: string; d: number; accent: string }) {
  const fs = fitName(name, d);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: d,
        height: d,
        borderRadius: d,
        background: `radial-gradient(circle at 30% 25%, ${C.violet}, ${C.space2} 75%)`,
        border: `${Math.max(4, d * 0.035)}px solid ${accent}`,
        boxShadow: `${d * 0.045}px ${d * 0.045}px 0 ${C.pink}`,
        color: C.cream,
        fontFamily: FONT,
        fontSize: fs,
        textTransform: "uppercase",
        letterSpacing: fs * 0.03,
      }}
    >
      <div style={{ display: "flex", textShadow: bold(C.cream, fs * 0.022) }}>{name}</div>
    </div>
  );
}

function fitName(name: string, d: number): number {
  const n = name.length;
  return Math.round(d * (n <= 4 ? 0.26 : n <= 6 ? 0.21 : 0.16));
}

export function Footer({ size }: { size: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        fontFamily: FONT,
        fontSize: size,
        color: "rgba(255,246,233,0.78)",
        letterSpacing: size * 0.02,
        textAlign: "center",
      }}
    >
      {FOOTER_TEXT}
    </div>
  );
}

export function Wordmark({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontFamily: FONT, fontSize: size, color: C.cream, textShadow: bold(C.cream, size * 0.03) }}>
      <div style={{ display: "flex", color: C.cream }}>Astro</div>
      <div style={{ display: "flex", color: C.pink, textShadow: bold(C.pink, size * 0.03) }}>Roast</div>
      <div style={{ display: "flex", color: C.lime, textShadow: bold(C.lime, size * 0.03) }}>.ai</div>
    </div>
  );
}
