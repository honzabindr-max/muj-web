"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { generateCouple } from "@/astroroast/engine";
import { track } from "@/astroroast/analytics";
import type { Level, SignId } from "@/astroroast/types";
import { isSignId, randomSeed, signOf } from "../_lib/helpers";
import { coupleCode } from "../_lib/couple";
import { SignChooser } from "./SignChooser";
import { SpiceMeter } from "./SpiceMeter";
import { CoupleCard } from "./CoupleCard";
import { ShareBar } from "./ShareBar";
import { useCopy, useModel } from "./ModelProvider";

/** Výsledek se drží jako vstup (bez textu), aby se při přepnutí modelu překreslil jeho verzí. */
interface Result {
  a: SignId;
  b: SignId;
  level: Level;
  seed: number;
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
  const { model } = useModel();
  const copy = useCopy();
  const c = copy.coupleGen;
  const [pickedA, setA] = useState<SignId | null | undefined>(undefined);
  const a = pickedA !== undefined ? pickedA : presetA;
  const [b, setB] = useState<SignId | null>(null);
  const [level, setLevel] = useState<Level>(3);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [lineIdx, setLineIdx] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(false);
  const couple = useMemo(
    () => (result ? generateCouple(result.a, result.b, result.level, result.seed, model) : null),
    [result, model],
  );
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
      setError(true);
      return;
    }
    setError(false);
    const lvl = (nextLevel ?? level) as Level;
    setLevel(lvl);
    const seed = randomSeed();
    if (timers.current.tick) clearInterval(timers.current.tick);
    if (timers.current.done) clearTimeout(timers.current.done);
    const lineCount = c.loadingLines.length;
    let i = Math.floor(Math.random() * lineCount);
    setLineIdx(i);
    setPhase("loading");
    timers.current.tick = setInterval(() => {
      i = (i + 1) % lineCount;
      setLineIdx(i);
    }, 280);
    timers.current.done = setTimeout(() => {
      if (timers.current.tick) clearInterval(timers.current.tick);
      const capped = generateCouple(a, b, lvl, seed, model).level;
      setResult({ a, b, level: capped, seed, code: coupleCode({ a, b, level: lvl, seed }) });
      setPhase("done");
      track("couple_generate", { a, b, level: lvl });
    }, 900);
  }

  const ra = couple ? signOf(couple.a) : null;
  const rb = couple ? signOf(couple.b) : null;

  return (
    <section id="duel" className="ar-gen ar-gen-couple" data-level={level} aria-labelledby="ar-couple-title">
      <div className="ar-gen-panel">
        <h2 id="ar-couple-title" className="ar-gen-title">
          <span className="ar-step">1</span> {c.step1}
        </h2>
        <div className="ar-couple-choosers">
          <SignChooser
            key={presetA ?? "none"}
            value={a}
            defaultMode={presetA ? "pick" : "date"}
            onChange={setA}
            legend={c.legendA}
            cuspLead={c.cuspA}
            tone="pink"
          />
          <div className="ar-vs" aria-hidden="true">
            VS
          </div>
          <SignChooser
            value={b}
            onChange={setB}
            legend={c.legendB}
            cuspLead={c.cuspB}
            tone="lime"
          />
        </div>

        <h2 className="ar-gen-title ar-gen-title-2">
          <span className="ar-step">2</span> {c.step2}
        </h2>
        <div className="ar-gen-block">
          <SpiceMeter value={level} max={3} onChange={setLevel} label={c.meterLabel} />
          <p className="ar-note">{c.fairNote}</p>
        </div>

        {error && (
          <p className="ar-error" role="alert">
            {c.errBoth}
          </p>
        )}

        <button type="button" className="ar-btn ar-btn-hero" onClick={() => run()} disabled={phase === "loading"}>
          {phase === "loading" ? c.btnLoading : c.btn}{" "}
          <span aria-hidden="true">{phase === "loading" ? "🔮" : "⚔️"}</span>
        </button>
        <p className="ar-hint ar-hint-center">{c.hint}</p>
      </div>

      <div ref={slotRef} className="ar-result-slot" aria-live="polite">
        {phase === "loading" && (
          <div className="ar-loading" role="status">
            <span className="ar-orb" aria-hidden="true">
              🔮
            </span>
            <p>{c.loadingLines[lineIdx % c.loadingLines.length]}</p>
          </div>
        )}
        {phase === "done" && result && couple && ra && rb && (
          <div key={result.code} className="ar-result" data-level={couple.level}>
            <CoupleCard couple={couple} a={ra} b={rb} copy={copy} />
            <ShareBar kind="couple" code={result.code} headline={couple.title} />
            <div className="ar-again">
              <button type="button" className="ar-btn ar-btn-ghost" onClick={() => run()}>
                <span aria-hidden="true">🎲</span> {c.again}
              </button>
              <button
                type="button"
                className="ar-btn ar-btn-hot"
                disabled={level >= 3}
                onClick={() => run((level + 1) as Level)}
              >
                {level >= 3 ? c.maxed : c.raise} <span aria-hidden="true">🌶️</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
