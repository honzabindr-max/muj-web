"use client";

import { useEffect, useRef } from "react";

// Deterministic Lissajous blob parameters — no Math.random()
const BLOBS = [
  { ax: 0.36, ay: 0.29, px: 0.00, py: 1.10, fx: 0.50, fy: 0.41, r: 0.32, a: 0.20 },
  { ax: 0.27, ay: 0.35, px: 1.30, py: 0.00, fx: 0.37, fy: 0.55, r: 0.27, a: 0.18 },
  { ax: 0.21, ay: 0.41, px: 0.70, py: 2.10, fx: 0.63, fy: 0.46, r: 0.24, a: 0.22 },
  { ax: 0.43, ay: 0.23, px: 2.00, py: 0.50, fx: 0.44, fy: 0.60, r: 0.29, a: 0.16 },
  { ax: 0.24, ay: 0.31, px: 3.10, py: 1.80, fx: 0.56, fy: 0.43, r: 0.21, a: 0.24 },
  { ax: 0.38, ay: 0.19, px: 1.60, py: 3.50, fx: 0.41, fy: 0.58, r: 0.26, a: 0.19 },
  { ax: 0.16, ay: 0.44, px: 4.20, py: 0.90, fx: 0.67, fy: 0.39, r: 0.22, a: 0.21 },
  { ax: 0.31, ay: 0.26, px: 2.80, py: 2.50, fx: 0.49, fy: 0.62, r: 0.19, a: 0.23 },
];

interface Props {
  c1: string;
  c2: string;
  c3: string;
}

export function CausticsCanvas({ c1, c2, c3 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const colorsRef = useRef([c1, c2, c3]);
  colorsRef.current = [c1, c2, c3];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Render at 50% resolution for performance — blurriness is intentional for caustics
    const SCALE = 0.5;

    function resize() {
      if (!canvas) return;
      canvas.width = Math.round(window.innerWidth * SCALE);
      canvas.height = Math.round(window.innerHeight * SCALE);
    }
    resize();

    const onResize = () => resize();
    window.addEventListener("resize", onResize, { passive: true });

    let startTime: number | null = null;

    function frame(ts: number) {
      if (!canvas || !ctx) return;
      if (!startTime) startTime = ts;

      const t = reduced ? 0 : (ts - startTime) * 0.001; // seconds
      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.5;
      const cy = h * 0.5;
      const colors = colorsRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < BLOBS.length; i++) {
        const b = BLOBS[i];
        const x = cx + b.ax * w * Math.cos(t * b.fx + b.px);
        const y = cy + b.ay * h * Math.sin(t * b.fy + b.py);
        const radius = b.r * Math.min(w, h);
        const color = colors[i % 3];

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(0.5, color.replace(/[\d.]+\)$/, "0.08)"));
        grad.addColorStop(1, "transparent");

        ctx.globalAlpha = b.a;
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (!reduced) {
        rafRef.current = requestAnimationFrame(frame);
      }
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []); // run once — colors are read from ref

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        imageRendering: "auto",
      }}
    />
  );
}
