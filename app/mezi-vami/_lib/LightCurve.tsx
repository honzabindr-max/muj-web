import type { CSSProperties, ReactNode } from "react";

// Světelná křivka — hlavní vizuální motiv.
// Tři vrstvy: (1) záře = stejná cesta, tlustší tah, rozostřená přes CSS filter na vlastní
// vrstvě (ne SVG filtr), (2) ostrá linka s vector-effect: non-scaling-stroke (jinak se
// při preserveAspectRatio="none" tah deformuje), (3) putující světlo = stroke-dasharray
// + animovaný stroke-dashoffset (animaci dodává třída z design-a.css).
// Cesty (d) a gradienty se přebírají přesně z artboardu; desktop a mobil mají každý
// vlastní instanci s vlastním viewBox (dvě sady cest, ne škálování jedné).

type BoxProps = {
  /** polohování a rozměry boxu (z artboardu) */
  style?: CSSProperties;
  /** gradienty (<linearGradient> …) odkazované z cest */
  defs?: ReactNode;
  children: ReactNode;
};

export function LightCurve({ style, defs, children }: BoxProps) {
  return (
    <div
      aria-hidden="true"
      data-light-curve=""
      style={{
        position: "absolute",
        pointerEvents: "none",
        overflow: "hidden",
        ...style,
      }}
    >
      <svg
        width="0"
        height="0"
        style={{ position: "absolute" }}
        focusable="false"
      >
        <defs>{defs}</defs>
      </svg>
      {children}
    </div>
  );
}

type LayerProps = {
  viewBox: string;
  preserveAspectRatio?: string;
  /** poloměr rozostření v px; 0 = ostrá vrstva */
  blur?: number;
  children: ReactNode;
};

export function LightLayer({
  viewBox,
  preserveAspectRatio,
  blur = 0,
  children,
}: LayerProps) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      focusable="false"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        ...(blur > 0 ? { filter: `blur(${blur}px)` } : null),
      }}
    >
      {children}
    </svg>
  );
}

/** Tůně: rozmazané švestkové elipsy jako CSS radial-gradient (bez SVG filtru). */
export type PoolSpec = {
  /** poloha a velikost v % boxu */
  left: number;
  top: number;
  width: number;
  height: number;
  rgb: string;
  alpha: number;
};

export function Pools({
  pools,
  style,
}: {
  pools: PoolSpec[];
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      data-pools=""
      style={{
        position: "absolute",
        pointerEvents: "none",
        overflow: "hidden",
        ...style,
      }}
    >
      {pools.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.width}%`,
            height: `${p.height}%`,
            background: `radial-gradient(closest-side, rgb(${p.rgb} / ${p.alpha}) 0%, rgb(${p.rgb} / ${(p.alpha * 0.55).toFixed(3)}) 45%, rgb(${p.rgb} / 0) 100%)`,
          }}
        />
      ))}
    </div>
  );
}
