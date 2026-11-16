"use client";

// Obrazovka výpočtu: skutečný běh výpočtu a textů (žádný pevný časovač). Stav, dlouhá prodleva,
// chyba s možností opakovat. Bez kompletních údajů vrací na formulář.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dual } from "../_lib/Dual";
import VypocetD from "../_dc/VypocetD";
import VypocetM from "../_dc/VypocetM";
import { getPersons } from "../_lib/persons-store";
import { isPersonComplete } from "../_lib/persons";
import { runDna, type Stage } from "../_lib/engine-client";
import { track } from "../_lib/track";

const STAGE_TEXT: Record<Stage, string> = {
  calc: "Počítáme polohy planet pro oba z vás…",
  text: "Píšeme vaši Vztahovou DNA…",
  done: "Hotovo.",
};

export function ComputeScreen({ re }: { re: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("calc");
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    // Next.js přenáší vlastní klíče history.state do dalších záznamů; značka kroku B nesmí
    // „prosáknout“ do pozdějšího vstupu na formulář (odkaz „Upravit údaje“ má začít první osobou)
    try {
      const st = { ...(window.history.state ?? {}) } as Record<string, unknown>;
      if ("mvStep" in st) {
        delete st.mvStep;
        window.history.replaceState(st, "");
      }
    } catch {
      /* ignorovat */
    }
    const s = getPersons();
    if (!s || !isPersonComplete(s.a) || !isPersonComplete(s.b)) {
      router.replace("/mezi-vami/osoba");
      return;
    }
    setError(null);
    setSlow(false);
    const t = window.setTimeout(() => setSlow(true), 25_000);
    runDna(s, setStage)
      .then((id) => {
        track("vysledek_ready");
        router.replace(re ? "/mezi-vami/objednavka" : `/mezi-vami/vysledek/${id}`);
      })
      .catch((e: { code?: string }) => setError(e?.code ?? "unknown"))
      .finally(() => window.clearTimeout(t));
    return () => window.clearTimeout(t);
  }, [attempt, re, router]);

  const props = { stav: re ? "Přepočet po úpravě" : "Výpočet", prodleva: slow };
  return (
    <>
      <Dual bg="#120A12" desktop={<VypocetD props={props} />} mobile={<VypocetM props={props} />} />
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          left: "50%",
          bottom: 28,
          transform: "translateX(-50%)",
          width: "min(92vw, 460px)",
          padding: "14px 18px",
          borderRadius: 16,
          border: "1px solid #5A3F53",
          background: "rgba(24, 13, 24, 0.94)",
          color: "#F4E9E4",
          fontFamily: "var(--font-mv-jost), system-ui, sans-serif",
          fontSize: 15,
          textAlign: "center",
          zIndex: 20,
        }}
      >
        {error ? (
          <>
            <p style={{ margin: 0 }}>
              {error === "rate_limited"
                ? "Výpočtů bylo teď příliš mnoho. Zkuste to prosím za pár minut."
                : "Výpočet se tentokrát nepovedl. Vaše údaje zůstaly zachované."}
            </p>
            <div style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                style={{ minHeight: 44, padding: "0 20px", borderRadius: 999, border: "1px solid #EDB894", background: "rgba(237,184,148,0.14)", color: "#F4E9E4", fontFamily: "inherit", fontSize: 15, cursor: "pointer" }}
              >
                Zkusit znovu
              </button>
              <a href="/mezi-vami/osoba" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "#EDB894", fontSize: 15 }}>
                Upravit údaje
              </a>
            </div>
          </>
        ) : (
          <p style={{ margin: 0 }}>{STAGE_TEXT[stage]}</p>
        )}
      </div>
    </>
  );
}
