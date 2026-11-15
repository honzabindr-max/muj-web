"use client";

// Zadané údaje osob ve shrnutí výsledku a v pokladně. Dokud osoba není kompletně vyplněná
// (např. přímý vstup na stránku), platí ukázka z návrhu (prototyp, ukázkový obsah).

import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { nbsp } from "../_lib/nbsp";
import { summaryOf, type Styl } from "../_lib/persons";
import { updatePerson, useStoredPersons } from "../_lib/persons-store";

type Which = "a" | "b";

function useSummary(p: Which) {
  const s = useStoredPersons();
  return s ? summaryOf(s[p]) : null;
}

/** Pravý sloupec shrnutí na výsledku: „14. 5. 1990 · Brno“ + druhý řádek s časem. */
export function PersonSummary({
  p,
  fb1,
  fb2,
  sub,
}: {
  p: Which;
  fb1: string;
  fb2: string;
  sub: CSSProperties;
}) {
  const sm = useSummary(p);
  return (
    <>
      {nbsp(sm ? `${sm.datum} · ${sm.misto}` : fb1)}
      <br />
      <span style={sub}>{nbsp(sm ? sm.casSummary : fb2)}</span>
    </>
  );
}

/** Jedna hodnota v pokladně (datum / místo / čas). */
export function PersonField({
  p,
  f,
  fb,
}: {
  p: Which;
  f: "datum" | "misto" | "cas";
  fb: string;
}) {
  const sm = useSummary(p);
  return <>{nbsp(sm ? sm[f] : fb)}</>;
}

const OPTIONS: [Styl, string][] = [
  ["neutral", "Neutrálně"],
  ["m", "V mužském rodě"],
  ["f", "V ženském rodě"],
];

/** Gramatická podoba textu v pokladně: sdílí volbu z formuláře osoby. */
export function StyleChoice({
  p,
  name,
  on,
  off,
}: {
  p: Which;
  name: string;
  on: CSSProperties;
  off: CSSProperties;
}) {
  const s = useStoredPersons();
  const cur: Styl = s ? s[p].styl : "neutral";
  return (
    <>
      {OPTIONS.map(([k, label]) => (
        <label key={k} className="mv-choice" style={cur === k ? on : off}>
          <input
            type="radio"
            name={name}
            checked={cur === k}
            onChange={() => updatePerson(p, { styl: k })}
            style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
          />
          {nbsp(label)}
        </label>
      ))}
    </>
  );
}

/**
 * „Přejít k platbě“: bez platného e-mailu pro doručení nepustí dál — zaostří pole a ukáže
 * nativní validační hlášku prohlížeče (COPY v3.2 text chyby e-mailu nemá, K-17a). Vzhled = odkaz z D-06.
 */
export function CheckoutCta({
  emailId,
  href,
  style,
  children,
}: {
  emailId: string;
  href: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        const input = document.getElementById(emailId) as HTMLInputElement | null;
        if (input && !input.checkValidity()) {
          input.setAttribute("aria-invalid", "true");
          input.focus();
          input.reportValidity();
          return;
        }
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}
