// Dekorativní hvězdičky na pozadí karet (deterministické, bez náhody).
import { C } from "./theme";

const PTS: [number, number, number, number][] = [
  [0.07, 0.05, 6, 0.9], [0.93, 0.04, 9, 0.7], [0.5, 0.025, 5, 0.6], [0.82, 0.17, 5, 0.5],
  [0.04, 0.3, 8, 0.6], [0.97, 0.42, 6, 0.8], [0.06, 0.62, 5, 0.5], [0.92, 0.75, 8, 0.6],
  [0.12, 0.9, 6, 0.8], [0.75, 0.55, 5, 0.6], [0.3, 0.34, 4, 0.5], [0.58, 0.12, 4, 0.5],
];

export function Stars({ W, H, scale = 1 }: { W: number; H: number; scale?: number }) {
  return (
    <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: W, height: H }}>
      {PTS.map(([x, y, r, o], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: Math.round(x * W),
            top: Math.round(y * H),
            width: r * scale,
            height: r * scale,
            borderRadius: r * scale,
            background: i % 3 === 0 ? C.lime : i % 3 === 1 ? C.cream : C.pink,
            opacity: o,
          }}
        />
      ))}
    </div>
  );
}
