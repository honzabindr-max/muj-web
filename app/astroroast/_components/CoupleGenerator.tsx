"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { generateCouple } from "@/astroroast/engine";
import { track } from "@/astroroast/analytics";
import type { CoupleRoast, Level, SignId } from "@/astroroast/types";
import { isSignId, randomSeed, signOf } from "../_lib/helpers";
import { coupleCode } from "../_lib/couple";
import { SignChooser } from "./SignChooser";
import { SpiceMeter } from "./SpiceMeter";
import { CoupleCard } from "./CoupleCard";
import { ShareBar } from "./ShareBar";

const LOADING_LINES = [
  "Svolávám kosmickou manželskou poradnu…",
  "Venuše a Mars si vyměňují pohledy…",
  "Počítám, kdo komu naposledy nepřipustil pravdu…",
  "Rozdávám obě strany rovným dílem…",
];

interface Result {
  couple: CoupleRoast;
  code: string;
}

const noopSubscribe = () => () => {};

/** Předvolba prvního znamení z URL (?a=znameni), uplatněná až po hydrataci. */
function usePresetA(): SignId | null {
  const search = useSyncExternalStore(
    noopSubscribe,
    () => window.location.search,
    () => "",
  );
  const a = new URLSearchParams(search).get("a");
  return isSignId(a) ? a : null;
}

export function CoupleGenerator() {
  const presetA = usePresetA();
  const [pickedA, setA] = useState<SignId | null | undefined>(undefined);
  const a = pickedA !== undefined ? pickedA : presetA;
  const [b, setB] = useState<SignId | null>(null);
  const [level, setLevel] = useState<Level>(3);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [line, setLine] = useState(LOADING_LINES[0]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const slotRef = useRef<HTMLDivElement>(null);
  const timers = useRef<{ tick?: ReturnType<typeof setInterval>; done?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const t = timers.current;
    return () => {
      if (t.tick) clearInterval(t.tick);
      if (t.done) clearTimeout(t.done);
    };
  }, []);

  useEffect(() => {
    if (phase === "loading") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      slotRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }
  }, [phase]);

  function run(nextLevel?: Level) {
    if (!a || !b) {
      setError("Potřebujeme oba. Hvězdy nerady vedou souboj s jedním účastníkem.");
      return;
    }
    setError("");
    const lvl = (nextLevel ?? level) as Level;
    setLevel(lvl);
    const seed = randomSeed();
    if (timers.current.tick) clearInterval(timers.current.tick);
    if (timers.current.done) clearTimeout(timers.current.done);
    let i = Math.floor(Math.random() * LOADING_LINES.length);
    setLine(LOADING_LINES[i]);
    setPhase("loading");
    timers.current.tick = setInterval(() => {
      i = (i + 1) % LOADING_LINES.length;
      setLine(LOADING_LINES[i]);
    }, 280);
    timers.current.done = setTimeout(() => {
      if (timers.current.tick) clearInterval(timers.current.tick);
      const couple = generateCouple(a, b, lvl, seed);
      setResult({ couple, code: coupleCode({ a, b, level: lvl, seed }) });
      setPhase("done");
      track("couple_generate", { a, b, level: lvl });
    }, 900);
  }

  const ra = result ? signOf(result.couple.a) : null;
  const rb = result ? signOf(result.couple.b) : null;

  return (
    <section id="duel" className="ar-gen ar-gen-couple" data-level={level} aria-labelledby="ar-couple-title">
      <div className="ar-gen-panel">
        <h2 id="ar-couple-title" className="ar-gen-title">
          <span className="ar-step">1</span> Dvě znamení, jeden souboj
        </h2>
        <div className="ar-couple-choosers">
          <SignChooser
            key={presetA ?? "none"}
            value={a}
            defaultMode={presetA ? "pick" : "date"}
            onChange={setA}
            legend="Ty (datum nebo znamení)"
            cuspLead="Jsi"
            tone="pink"
          />
          <div className="ar-vs" aria-hidden="true">
            VS
          </div>
          <SignChooser
            value={b}
            onChange={setB}
            legend="Tvůj protějšek"
            cuspLead="Je to"
            tone="lime"
          />
        </div>

        <h2 className="ar-gen-title ar-gen-title-2">
          <span className="ar-step">2</span> Pálivost (u párů max. 3)
        </h2>
        <div className="ar-gen-block">
          <SpiceMeter value={level} max={3} onChange={setLevel} label="Pálivost" />
          <p className="ar-note">Na oba padne stejně. Spravedlnost je to nejpálivější, co hvězdy mají.</p>
        </div>

        {error && (
          <p className="ar-error" role="alert">
            {error}
          </p>
        )}

        <button type="button" className="ar-btn ar-btn-hero" onClick={() => run()} disabled={phase === "loading"}>
          {phase === "loading" ? "Hvězdy se radí…" : "Roastni nás oba"}{" "}
          <span aria-hidden="true">{phase === "loading" ? "🔮" : "⚔️"}</span>
        </button>
        <p className="ar-hint ar-hint-center">Datum narození zůstává v prohlížeči. Sdílí se jen znamení.</p>
      </div>

      <div ref={slotRef} className="ar-result-slot" aria-live="polite">
        {phase === "loading" && (
          <div className="ar-loading" role="status">
            <span className="ar-orb" aria-hidden="true">
              🔮
            </span>
            <p>{line}</p>
          </div>
        )}
        {phase === "done" && result && ra && rb && (
          <div key={result.code} className="ar-result" data-level={result.couple.level}>
            <CoupleCard couple={result.couple} a={ra} b={rb} />
            <ShareBar kind="couple" code={result.code} headline={result.couple.title} />
            <div className="ar-again">
              <button type="button" className="ar-btn ar-btn-ghost" onClick={() => run()}>
                <span aria-hidden="true">🎲</span> Ještě jedna hádka
              </button>
              <button
                type="button"
                className="ar-btn ar-btn-hot"
                disabled={level >= 3}
                onClick={() => run((level + 1) as Level)}
              >
                {level >= 3 ? "U párů víc nejde" : "Zvyš pálivost"} <span aria-hidden="true">🌶️</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
