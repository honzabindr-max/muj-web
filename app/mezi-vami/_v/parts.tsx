"use client";

// Sdílené stavební kameny stránky V: podpis dvojice (světelné křivky), nitě „Kdo je kdo“,
// tečka osoby. Geometrie 1:1 z artboardů V-01 / V-02 (viz _lib/signature.ts).

import { useId, type CSSProperties } from "react";
import { signature } from "../_lib/signature";
import { useDna } from "./view";
import type { NitTyp } from "../_data/fixtures";

export const A_COL = "#C98BC0";
export const B_COL = "#F2BE9C";

export function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 10px ${color}`,
      }}
    />
  );
}

const LABEL =
  "Podpis dvojice: dvě světelné křivky, které se potkávají v sedmi místech vašich vazeb";

/** Podpis dvojice. `fluid` = šířka 100 % boxu (viewBox zůstává), jinak pevné px jako na plátně. */
export function Signature({
  W,
  H,
  fluid = false,
  style,
}: {
  W: number;
  H: number;
  fluid?: boolean;
  style?: CSSProperties;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { vazby } = useDna();
  const g = signature(W, H, vazby);
  const f1 = `${uid}b1`;
  const f2 = `${uid}b2`;
  const ga = `${uid}ga`;
  const gb = `${uid}gb`;
  return (
    <svg
      role="img"
      aria-label={LABEL}
      viewBox={`0 0 ${W} ${H}`}
      overflow="visible"
      style={{
        display: "block",
        width: fluid ? "100%" : W,
        height: fluid ? "auto" : H,
        ...style,
      }}
    >
      <defs>
        <filter id={f1} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={f2} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <linearGradient id={ga} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={A_COL} stopOpacity="0" />
          <stop offset="0.15" stopColor={A_COL} />
          <stop offset="0.85" stopColor="#E7A7CF" />
          <stop offset="1" stopColor="#E7A7CF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={gb} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={B_COL} stopOpacity="0" />
          <stop offset="0.15" stopColor={B_COL} />
          <stop offset="0.85" stopColor="#FFE3CF" />
          <stop offset="1" stopColor="#FFE3CF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={g.pathA} fill="none" stroke={`url(#${ga})`} strokeWidth="7" opacity="0.4" filter={`url(#${f1})`} />
      <path d={g.pathB} fill="none" stroke={`url(#${gb})`} strokeWidth="7" opacity="0.4" filter={`url(#${f1})`} />
      <path d={g.pathA} fill="none" stroke={`url(#${ga})`} strokeWidth="1.6" />
      <path d={g.pathB} fill="none" stroke={`url(#${gb})`} strokeWidth="1.6" />
      {g.nodes.map((nd, i) => {
        const { x, y } = nd;
        if (nd.typ === "square")
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="10" fill="#FFD9C2" opacity="0.18" filter={`url(#${f2})`} />
              <path
                d={`M ${(x - 5).toFixed(1)} ${y.toFixed(1)} L ${(x + 5).toFixed(1)} ${y.toFixed(1)} M ${x.toFixed(1)} ${(y - 5).toFixed(1)} L ${x.toFixed(1)} ${(y + 5).toFixed(1)}`}
                stroke="#FFE3D2"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </g>
          );
        if (nd.typ === "conj") {
          const r = nd.strong ? 16 : 9;
          return (
            <g key={i} className={nd.strong ? "mv-breathe" : undefined}>
              <circle cx={x} cy={y} r={Math.round(r * 2.2)} fill="#FFE6D6" opacity={nd.strong ? 0.35 : 0.2} filter={`url(#${f2})`} />
              <circle cx={x} cy={y} r={(r * 0.45).toFixed(1)} fill="#FFF6EF" />
            </g>
          );
        }
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="12" fill="#F4CDB6" opacity="0.22" filter={`url(#${f2})`} />
            <circle cx={x} cy={y} r="2.6" fill="#FBE7DA" />
          </g>
        );
      })}
    </svg>
  );
}

const NIT: Record<
  NitTyp,
  { a: string; b: string; halo: { r: number; fill: string; op: number }; core: "dot" | "plus" | "dotL"; coreR?: number }
> = {
  touch: {
    a: "M 12 0 C 12 32, 23 40, 23 48 C 23 56, 12 64, 12 96",
    b: "M 40 0 C 40 32, 29 40, 29 48 C 29 56, 40 64, 40 96",
    halo: { r: 10, fill: "#F4CDB6", op: 0.28 },
    core: "dot",
    coreR: 2.4,
  },
  cross: {
    a: "M 14 0 C 14 40, 38 56, 38 96",
    b: "M 38 0 C 38 40, 14 56, 14 96",
    halo: { r: 11, fill: "#FFD9C2", op: 0.25 },
    core: "plus",
  },
  merge: {
    a: "M 12 0 C 12 30, 26 38, 26 48 C 26 58, 12 66, 12 96",
    b: "M 40 0 C 40 30, 26 38, 26 48 C 26 58, 40 66, 40 96",
    halo: { r: 13, fill: "#FFE6D6", op: 0.38 },
    core: "dotL",
    coreR: 3.4,
  },
};

/** Nit mezi dvěma sloupci: dotek / zkřížení / splynutí (viewBox 52×96). */
export function Nit({ typ, scale = 1 }: { typ: NitTyp; scale?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const d = NIT[typ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 52 96"
      style={{ display: "block", width: 52 * scale, height: 96 * scale }}
    >
      <defs>
        <filter id={uid} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <path d={d.a} fill="none" stroke={A_COL} strokeWidth="1.5" opacity="0.9" />
      <path d={d.b} fill="none" stroke={B_COL} strokeWidth="1.5" opacity="0.9" />
      <circle cx="26" cy="48" r={d.halo.r} fill={d.halo.fill} opacity={d.halo.op} filter={`url(#${uid})`} />
      {d.core === "plus" ? (
        <path d="M 21 48 L 31 48 M 26 43 L 26 53" stroke="#FFE3D2" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <circle cx="26" cy="48" r={d.coreR} fill={d.core === "dotL" ? "#FFF6EF" : "#FBE7DA"} />
      )}
    </svg>
  );
}
