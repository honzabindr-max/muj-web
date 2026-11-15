// Podpis dvojice (V): dvě světelné křivky, které se potkávají v sedmi místech vazeb.
// Deterministická funkce — přesně ta, ze které vznikly cesty v artboardech V-01 / V-02
// (viz kontrolní hodnoty v signature.test.ts: hero 375×190 začíná „M -10.0 58.1“).

import { VAZBY, type VazbaTyp } from "../_data/fixtures";

export type SignatureGeometry = {
  W: number;
  H: number;
  pathA: string;
  pathB: string;
  nodes: { x: number; y: number; typ: VazbaTyp; strong: boolean }[];
};

export function signature(W: number, H: number): SignatureGeometry {
  const c = H / 2;
  const k = (7 * Math.PI) / (W - 40);
  const ya = (x: number) =>
    c +
    H * 0.3 * (0.75 + 0.25 * Math.sin(x / 53)) * Math.sin(k * (x - 20));
  const yb = (x: number) =>
    c -
    H * 0.26 * (0.8 + 0.2 * Math.cos(x / 41)) * Math.sin(k * (x - 20));
  const path = (f: (x: number) => number) => {
    const pts: string[] = [];
    for (let x = -10; x < W + 11; x += 3)
      pts.push(`${x.toFixed(1)} ${f(x).toFixed(1)}`);
    return "M " + pts.join(" L ");
  };
  const xs = Array.from({ length: 7 }, (_, i) => 20 + ((i + 1) * Math.PI) / k);
  xs[6] = Math.min(xs[6], W - 14);
  return {
    W,
    H,
    pathA: path(ya),
    pathB: path(yb),
    nodes: VAZBY.map((v, i) => ({
      x: xs[i],
      y: c,
      typ: v.typ,
      strong: v.strong,
    })),
  };
}
