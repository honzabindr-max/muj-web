"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { encodeShare, generateRoast } from "@/astroroast/engine";
import { track } from "@/astroroast/analytics";
import type { Level, RoastInput, SignId } from "@/astroroast/types";
import { randomSeed, signOf } from "../_lib/helpers";
import { SignChooser } from "./SignChooser";
import { RoastCard } from "./RoastCard";
import { ShareBar } from "./ShareBar";
import { FakeDoors } from "./FakeDoors";
import { useCopy, useModel } from "./ModelProvider";

interface Props {
  /** Znamení ze sdíleného odkazu: předvybrané, příjemce ho může změnit. */
  defaultSign: SignId;
  /** Odkud příjemce přišel (měření k-faktoru). */
  source: "share_roast" | "share_couple";
}

/** Výsledek se drží jako vstup (bez textu), aby se při přepnutí modelu překreslil jeho verzí. */
interface Result {
  input: RoastInput;
  code: string;
}

/**
 * Minimální generátor přímo na sdílené stránce: příjemce odkazu dostane vlastní roast bez přechodu jinam.
 * Úroveň 3, téma Život, cíl „já“. Delší nastavení je na hlavní stránce.
 */
export function ShareGenerator({ defaultSign, source }: Props) {
  const { model } = useModel();
  const copy = useCopy();
  const c = copy.shareGen;
  const [sign, setSign] = useState<SignId | null>(defaultSign);
  const [level, setLevel] = useState<Level>(3);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const [fresh, setFresh] = useState(0);
  const roast = useMemo(
    () => (result ? generateRoast({ ...result.input, model }) : null),
    [result, model],
  );

  useEffect(() => {
    if (!fresh) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const heading = slotRef.current?.querySelector<HTMLElement>(".ar-card-headline");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, [fresh]);

  function run(nextLevel: Level) {
    if (!sign) {
      setError(true);
      return;
    }
    setError(false);
    setLevel(nextLevel);
    const input: RoastInput = { sign, level: nextLevel, topic: "zivot" as const, target: "self" as const, seed: randomSeed() };
    setResult({ input, code: encodeShare(input) });
    setFresh((n) => n + 1);
    track("generate", { sign, level: nextLevel, topic: "zivot", target: "self", source });
  }

  const resultSign = roast ? signOf(roast.input.sign) : null;

  return (
    <div className="ar-receiver" data-level={level}>
      <div className="ar-gen-panel">
        <SignChooser
          value={sign}
          onChange={(s) => {
            setSign(s);
            if (s) setError(false);
          }}
          legend={c.legend}
          cuspLead={c.cuspLead}
          defaultMode="pick"
        />
        {error && (
          <p className="ar-error" role="alert">
            {c.errNoSign}
          </p>
        )}
        <button type="button" className="ar-btn ar-btn-hero" onClick={() => run(3)}>
          {c.btn} <span aria-hidden="true">🔥</span>
        </button>
      </div>

      <p className="ar-vh" role="status">
        {result ? c.statusDone : ""}
      </p>
      <div ref={slotRef} className="ar-result-slot">
        {result && roast && resultSign && (
          <div key={result.code} className="ar-result" data-level={roast.input.level}>
            <RoastCard roast={roast} sign={resultSign} copy={copy} />
            <ShareBar kind="roast" code={result.code} headline={roast.headline} />
            <FakeDoors variant="inline" placement="share" />
            <div className="ar-again">
              <button
                type="button"
                className="ar-btn ar-btn-ghost"
                onClick={() => run(roast.input.level)}
              >
                <span aria-hidden="true">🎲</span> {c.again}
              </button>
              <button
                type="button"
                className="ar-btn ar-btn-hot"
                disabled={roast.input.level >= 5}
                onClick={() => run((roast.input.level + 1) as Level)}
              >
                {roast.input.level >= 5 ? (
                  <>
                    {c.maxed} <span aria-hidden="true">🔥</span>
                  </>
                ) : (
                  <>
                    {c.push} <span aria-hidden="true">🌶️</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <Link href={`/astroroast?z=${sign ?? defaultSign}#roast`} className="ar-textlink ar-receiver-more">
        {c.more}
      </Link>
    </div>
  );
}
