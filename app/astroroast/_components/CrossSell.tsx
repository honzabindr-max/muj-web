"use client";

import Link from "next/link";
import { track } from "@/astroroast/analytics";
import { useCopy } from "./ModelProvider";

/** Jemný cross-sell na MEZI VÁMI. Jen na stránkách párů a jen jako opt-in odkaz. */
export function CrossSell() {
  const c = useCopy().crossSell;
  return (
    <aside className="ar-cross" aria-labelledby="ar-cross-title">
      <p className="ar-cross-eyebrow">{c.eyebrow}</p>
      <h2 id="ar-cross-title">{c.title}</h2>
      <p>{c.text}</p>
      <Link
        href="/mezi-vami"
        className="ar-btn ar-btn-ghost"
        onClick={() => track("crosssell", { target: "mezi-vami" })}
      >
        {c.cta} <span aria-hidden="true">→</span>
      </Link>
      <p className="ar-hint">{c.hint}</p>
    </aside>
  );
}
