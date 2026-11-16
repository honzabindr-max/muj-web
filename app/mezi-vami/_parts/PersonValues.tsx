"use client";

import { track } from "../_lib/track";

// Zadané údaje osob ve shrnutí výsledku a v pokladně. Dokud osoba není kompletně vyplněná
// (např. přímý vstup na stránku), platí ukázka z návrhu (prototyp, ukázkový obsah).

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { nbsp } from "../_lib/nbsp";
import { ERROR_COPY, summaryOf, validateEmail, type EmailError as EmailErrorCode, type Styl } from "../_lib/persons";
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

const EMAIL_ERR = "#F7B4A6";

/** Stav chyby e-mailu v pokladně (po pokusu o „Přejít k platbě“); jen v paměti klienta. */
let emailErr: EmailErrorCode | null = null;
const emailListeners = new Set<() => void>();
const setEmailErr = (e: EmailErrorCode | null) => {
  if (e === emailErr) return;
  emailErr = e;
  emailListeners.forEach((l) => l());
};
const subscribeEmail = (l: () => void) => {
  emailListeners.add(l);
  return () => {
    emailListeners.delete(l);
  };
};

/** Vlastní hláška k poli e-mailu (K-17a): aria-invalid + aria-describedby, styl jako chyby osoby. */
export function EmailError({ emailId }: { emailId: string }) {
  const err = useSyncExternalStore(
    subscribeEmail,
    () => emailErr,
    () => null,
  );
  const errId = `${emailId}-err`;
  useEffect(() => {
    const input = document.getElementById(emailId) as HTMLInputElement | null;
    if (!input) return;
    if (err) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", errId);
      input.style.borderColor = EMAIL_ERR;
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      input.style.borderColor = "";
    }
    const onInput = () => {
      if (emailErr) setEmailErr(validateEmail(input.value));
    };
    input.addEventListener("input", onInput);
    return () => input.removeEventListener("input", onInput);
  }, [err, emailId, errId]);
  useEffect(() => () => setEmailErr(null), []);
  if (!err) return null;
  return (
    <p id={errId} style={{ margin: "4px 0 0", fontSize: 14, color: EMAIL_ERR }}>
      {ERROR_COPY.email[err]}
    </p>
  );
}

/**
 * „Přejít k platbě“: bez platného e-mailu pro doručení nepustí dál; zaostří pole a ukáže
 * vlastní hlášku K-17a (<EmailError>). Vzhled = odkaz z D-06.
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
  const [consent, setConsent] = useState(false);
  const [consentErr, setConsentErr] = useState(false);
  const cid = `${emailId}-souhlas`;
  useEffect(() => {
    track("order_view");
  }, []);
  return (
    <>
      {/* Souhlas se zahájením plnění před uplynutím lhůty k odstoupení (digitální obsah).
          Text: LEGAL_PENDING — finální znění dodá právní track. */}
      <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input
          id={cid}
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (e.target.checked) setConsentErr(false);
          }}
          aria-invalid={consentErr || undefined}
          aria-describedby={consentErr ? `${cid}-err` : undefined}
          style={{ width: 22, height: 22, marginTop: 2, accentColor: "#EDB894", flex: "0 0 auto" }}
        />
        <label htmlFor={cid} style={{ fontSize: 14, lineHeight: 1.5, color: "#E8DAE0" }}>
          Souhlasím, aby se Hloubková analýza začala připravovat hned po zaplacení, a beru na
          vědomí, že tím ztrácím právo od smlouvy odstoupit do 14 dnů. (LEGAL_PENDING)
        </label>
      </div>
      {consentErr ? (
        <p id={`${cid}-err`} role="alert" style={{ margin: "6px 0 0", fontSize: 14, color: "#F7B4A6" }}>
          Pro pokračování potvrďte souhlas.
        </p>
      ) : null}
      <a
        href={href}
        style={style}
        onClick={(e) => {
          e.preventDefault();
          const input = document.getElementById(emailId) as HTMLInputElement | null;
          const err = validateEmail(input?.value ?? "");
          if (input && err) {
            setEmailErr(err);
            input.focus();
            return;
          }
          if (!consent) {
            setConsentErr(true);
            document.getElementById(cid)?.focus();
            return;
          }
          track("payment_click");
          try {
            window.sessionStorage.setItem("mv:order", String(Date.now()));
          } catch {
            /* ignorovat */
          }
          router.push(href);
        }}
      >
        {children}
      </a>
    </>
  );
}
