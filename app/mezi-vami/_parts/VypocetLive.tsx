"use client";

// /vypocet: skutečně čeká na odpověď API. Seznam kroků ukazuje jen události, které opravdu přišly
// (žádná procenta, žádný odhad času, žádné střídání hlášek: COPY_SYSTEM_V1 C1, fake_progress: false).

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { A } from "../_lib/A";
import { nb } from "../_lib/nbsp";
import { isPersonComplete } from "../_lib/persons";
import { getStoredPersons } from "../_lib/persons-store";
import { personsSig, runCalculation, type Outcome } from "../_calc/client";
import type { StepEvent, StepId } from "../_calc/types";
import { readStoredSig } from "./storedSig";

// Pracovní popisky kroků (C1 v3.2 popisky kroků nedodává; slovo „analýza“ se v C1 nepoužívá, K-12).
const STEPS: { id: StepId; label: string }[] = [
  { id: "input", label: "Údaje obou lidí" },
  { id: "astro", label: "Místo a čas narození, postavení při narození" },
  { id: "evidence", label: "Souvislosti mezi vámi dvěma" },
  { id: "texts", label: "Psaní Vztahové DNA" },
  { id: "validate", label: "Kontrola výsledku" },
];

const SLOW_AFTER_MS = 30_000;

type View =
  | { s: "wait" }
  | { s: "running" }
  | { s: "missing" }
  | ({ s: "out" } & Exclude<Outcome, { kind: "result" }>);

export default function VypocetLive() {
  const router = useRouter();
  const [view, setView] = useState<View>({ s: "wait" });
  const [done, setDone] = useState<Set<StepId>>(new Set());
  const [active, setActive] = useState<StepId | null>(null);
  const [slow, setSlow] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const startedFor = useRef<string | null>(null);

  const start = useCallback(
    async (force: boolean) => {
      const persons = getStoredPersons();
      if (
        !persons ||
        !isPersonComplete(persons.a) ||
        !isPersonComplete(persons.b)
      ) {
        setView({ s: "missing" });
        return;
      }
      // Stejný vstup už má hotový výsledek → rovnou na výsledek, bez nového (placeného) výpočtu.
      if (!force && readStoredSig() === personsSig(persons)) {
        router.replace("/mezi-vami/vysledek");
        return;
      }
      setView({ s: "running" });
      setDone(new Set());
      setActive(null);
      setSlow(false);
      const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
      const onStep = (e: StepEvent) => {
        if (e.status === "start") setActive(e.id);
        else {
          setDone((d) => new Set(d).add(e.id));
          setActive((a) => (a === e.id ? null : a));
        }
      };
      const out = await runCalculation(persons, onStep);
      clearTimeout(timer);
      if (out.kind === "result") {
        router.push("/mezi-vami/vysledek");
        return;
      }
      if (out.kind === "rate") setCountdown(out.retryAfter);
      setView({ s: "out", ...out });
    },
    [router],
  );

  useEffect(() => {
    if (startedFor.current !== null) return;
    startedFor.current = "started";
    void start(false);
  }, [start]);

  // Odpočet při limitu 1 výpočet / 30 s
  useEffect(() => {
    if (view.s === "wait" || !("kind" in view) || view.kind !== "rate") return;
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [view, countdown]);

  const failText =
    "kind" in view && view.kind === "fail"
      ? view.text
      : "kind" in view && view.kind === "network"
        ? "Výpočet se nepodařilo dokončit. Můžete to zkusit znovu."
        : null;

  return (
    <div className="xm02b" style={shell}>
      <div style={col}>
        <header
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "22px 16px 0",
          }}
        >
          <span style={logo}>MEZI VÁMI</span>
        </header>
        <main style={{ padding: "40px 24px 56px", textAlign: "center" }}>
          <Orbs />
          <div role="status" aria-live="polite">
            <h1 style={h1}>
              {view.s === "missing"
                ? "Nejdřív zadejte údaje obou lidí"
                : "kind" in view && view.kind === "tirr"
                  ? "Čas narození potřebuje upravit"
                  : failText || ("kind" in view && view.kind === "rate")
                    ? "Výpočet se nepodařilo dokončit"
                    : "Počítáme vaši Vztahovou DNA"}
            </h1>
            {(view.s === "wait" || view.s === "running") && (
              <p style={p}>
                {nb(
                  "Výpočet vychází z údajů o narození obou lidí. Výsledek se zobrazí, jakmile bude hotový.",
                )}
              </p>
            )}
          </div>

          {view.s === "running" && (
            <>
              <ol style={list} aria-label="Průběh výpočtu">
                {STEPS.map((st) => {
                  const state = done.has(st.id)
                    ? "done"
                    : active === st.id
                      ? "active"
                      : "todo";
                  return (
                    <li key={st.id} style={li} data-state={state}>
                      <span aria-hidden="true" style={dot(state)}>
                        {state === "done" ? "✓" : ""}
                      </span>
                      <span
                        style={{
                          color: state === "todo" ? "#8C7886" : "#EADCE2",
                        }}
                      >
                        {st.label}
                        <span style={sr}>
                          {state === "done"
                            ? " (hotovo)"
                            : state === "active"
                              ? " (probíhá)"
                              : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              {slow && (
                <p style={note}>
                  Výpočet trvá déle než obvykle. Pokračuje dál.
                </p>
              )}
            </>
          )}

          {view.s === "missing" && (
            <A href="/mezi-vami/osoba" style={cta}>
              Zadat údaje
            </A>
          )}

          {"kind" in view && view.kind === "tirr" && (
            <>
              <p style={p}>{nb(view.text)}</p>
              <A href="/mezi-vami/osoba" style={cta}>
                Upravit údaje
              </A>
            </>
          )}

          {(failText || ("kind" in view && view.kind === "invalid")) && (
            <>
              <p style={p}>
                {nb(
                  failText ??
                    "Zadané údaje se nepodařilo zpracovat. Zkontrolujte je prosím.",
                )}
              </p>
              {failText ? (
                <button
                  type="button"
                  style={cta}
                  onClick={() => void start(true)}
                >
                  Zkusit znovu
                </button>
              ) : (
                <A href="/mezi-vami/osoba" style={cta}>
                  Upravit údaje
                </A>
              )}
            </>
          )}

          {"kind" in view && view.kind === "rate" && (
            <>
              <p style={p}>
                {nb("Další výpočet půjde spustit až za malou chvíli.")}
              </p>
              <button
                type="button"
                style={{ ...cta, opacity: countdown > 0 ? 0.55 : 1 }}
                disabled={countdown > 0}
                onClick={() => void start(true)}
              >
                {countdown > 0
                  ? `Zkusit znovu za ${countdown} s`
                  : "Zkusit znovu"}
              </button>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Orbs() {
  return (
    <svg
      aria-hidden="true"
      width="300"
      height="220"
      viewBox="0 0 375 300"
      style={{ maxWidth: "100%" }}
    >
      <defs>
        <filter id="vlB2" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <clipPath id="vlClip">
          <circle cx="160" cy="150" r="74" />
        </clipPath>
        <radialGradient id="vlFl">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.16" stopColor="#FFEBDD" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#F2A98E" stopOpacity="0.35" />
          <stop offset="1" stopColor="#F2A98E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vlRA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6C9D6" />
          <stop offset="1" stopColor="#9A74B8" />
        </linearGradient>
        <linearGradient id="vlRB" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE3CC" />
          <stop offset="1" stopColor="#D98E78" />
        </linearGradient>
      </defs>
      <circle
        cx="160"
        cy="150"
        r="74"
        fill="none"
        stroke="#E3A3BC"
        strokeWidth="10"
        opacity="0.35"
        filter="url(#vlB2)"
      />
      <circle
        cx="216"
        cy="150"
        r="74"
        fill="none"
        stroke="#F0B48F"
        strokeWidth="10"
        opacity="0.35"
        filter="url(#vlB2)"
      />
      <circle
        cx="160"
        cy="150"
        r="74"
        fill="none"
        stroke="url(#vlRA)"
        strokeWidth="1.4"
      />
      <circle
        cx="216"
        cy="150"
        r="74"
        fill="none"
        stroke="url(#vlRB)"
        strokeWidth="1.4"
      />
      <circle
        className="xm02b-spin"
        cx="160"
        cy="150"
        r="84"
        fill="none"
        stroke="#E3A3BC"
        strokeWidth="0.6"
        strokeDasharray="1 7"
        opacity="0.6"
      />
      <circle
        className="xm02b-spin"
        cx="216"
        cy="150"
        r="84"
        fill="none"
        stroke="#F0B48F"
        strokeWidth="0.6"
        strokeDasharray="1 7"
        opacity="0.6"
      />
      <g clipPath="url(#vlClip)">
        <circle
          className="xm02b-breathe"
          cx="216"
          cy="150"
          r="74"
          fill="#F2A98E"
          opacity="0.5"
          filter="url(#vlB2)"
        />
      </g>
      <g className="xm02b-pulse">
        <circle cx="188" cy="150" r="36" fill="url(#vlFl)" />
      </g>
    </svg>
  );
}

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  background: "#0E070F",
  color: "#F4E9E4",
  fontFamily: "var(--font-mv-jost), system-ui, sans-serif",
};
const col: React.CSSProperties = { maxWidth: 560, margin: "0 auto" };
const logo: React.CSSProperties = {
  fontFamily: "var(--font-mv-garamond), serif",
  fontSize: 17,
  letterSpacing: "0.14em",
  color: "#EADCE2",
};
const h1: React.CSSProperties = {
  margin: "26px 0 0",
  fontFamily: "var(--font-mv-garamond), serif",
  fontWeight: 400,
  fontSize: 36,
  lineHeight: 1.08,
  background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};
const p: React.CSSProperties = {
  margin: "14px 0 0",
  fontSize: 16,
  lineHeight: 1.6,
  color: "#C2ACB7",
};
const list: React.CSSProperties = {
  listStyle: "none",
  margin: "28px auto 0",
  padding: 0,
  maxWidth: 360,
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const li: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontSize: 15,
};
const dot = (state: string): React.CSSProperties => ({
  flex: "0 0 auto",
  width: 20,
  height: 20,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  color: "#2A1220",
  border: state === "todo" ? "1px solid #6E5566" : "1px solid #F0B48F",
  background: state === "done" ? "#F0B48F" : "transparent",
  boxShadow: state === "active" ? "0 0 10px rgba(240,180,143,0.8)" : "none",
});
const note: React.CSSProperties = {
  margin: "20px 0 0",
  padding: "10px 16px",
  borderRadius: 14,
  border: "1px solid rgba(240, 190, 165, 0.3)",
  fontSize: 14,
  color: "#EADCE2",
};
const cta: React.CSSProperties = {
  marginTop: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 52,
  padding: "0 28px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)",
  color: "#2A1220",
  textDecoration: "none",
  fontSize: 16,
  fontWeight: 500,
  cursor: "pointer",
};
const sr: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
};
