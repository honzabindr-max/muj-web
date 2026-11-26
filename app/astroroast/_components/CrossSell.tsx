"use client";

import Link from "next/link";
import { track } from "@/astroroast/analytics";

/** Jemný cross-sell na MEZI VÁMI. Jen na stránkách párů a jen jako opt-in odkaz. */
export function CrossSell() {
  return (
    <aside className="ar-cross" aria-labelledby="ar-cross-title">
      <p className="ar-cross-eyebrow">Vteřinu vážně</p>
      <h2 id="ar-cross-title">To byla nadsázka.</h2>
      <p>Chcete vidět, jaké vztahové motivy nabízí hlubší výklad?</p>
      <Link
        href="/mezi-vami"
        className="ar-btn ar-btn-ghost"
        onClick={() => track("crosssell", { target: "mezi-vami" })}
      >
        Prohlédnout MEZI VÁMI <span aria-hidden="true">→</span>
      </Link>
      <p className="ar-hint">Jen odkaz. Nic se neodesílá a nic se po vás nechce.</p>
    </aside>
  );
}
