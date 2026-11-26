"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { encodeShare, generateRoast } from "@/astroroast/engine";
import { track } from "@/astroroast/analytics";
import type { Level, Roast, SignId } from "@/astroroast/types";
import { randomSeed, signOf } from "../_lib/helpers";
import { SignChooser } from "./SignChooser";
import { RoastCard } from "./RoastCard";
import { ShareBar } from "./ShareBar";
import { FakeDoors } from "./FakeDoors";

interface Props {
  /** Znamení ze sdíleného odkazu: předvybrané, příjemce ho může změnit. */
  defaultSign: SignId;
  /** Odkud příjemce přišel (měření k-faktoru). */
  source: "share_roast" | "share_couple";
}

interface Result {
  roast: Roast;
  code: string;
}

/**
 * Minimální generátor přímo na sdílené stránce: příjemce odkazu dostane vlastní roast bez přechodu jinam.
 * Úroveň 3, téma Život, cíl „já“. Delší nastavení je na hlavní stránce.
 */
export function ShareGenerator({ defaultSign, source }: Props) {
  const [sign, setSign] = useState<SignId | null>(defaultSign);
  const [level, setLevel] = useState<Level>(3);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const slotRef = useRef<HTMLDivElement>(null);
  const [fresh, setFresh] = useState(0);

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
      setError("Nejdřív vyber znamení. Hvězdy potřebují vědět, koho roastnout.");
      return;
    }
    setError("");
    setLevel(nextLevel);
    const input = { sign, level: nextLevel, topic: "zivot" as const, target: "self" as const, seed: randomSeed() };
    setResult({ roast: generateRoast(input), code: encodeShare(input) });
    setFresh((n) => n + 1);
    track("generate", { sign, level: nextLevel, topic: "zivot", target: "self", source });
  }

  const resultSign = result ? signOf(result.roast.input.sign) : null;

  return (
    <div className="ar-receiver" data-level={level}>
      <div className="ar-gen-panel">
        <SignChooser
          value={sign}
          onChange={(s) => {
            setSign(s);
            if (s) setError("");
          }}
          legend="A jaké je tvoje znamení?"
          cuspLead="Jsi"
          defaultMode="pick"
        />
        {error && (
          <p className="ar-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="ar-btn ar-btn-hero" onClick={() => run(3)}>
          Roastni mě <span aria-hidden="true">🔥</span>
        </button>
      </div>

      <p className="ar-vh" role="status">
        {result ? "Roast je hotový." : ""}
      </p>
      <div ref={slotRef} className="ar-result-slot">
        {result && resultSign && (
          <div key={result.code} className="ar-result" data-level={result.roast.input.level}>
            <RoastCard roast={result.roast} sign={resultSign} />
            <ShareBar kind="roast" code={result.code} headline={result.roast.headline} />
            <FakeDoors variant="inline" placement="share" />
            <div className="ar-again">
              <button
                type="button"
                className="ar-btn ar-btn-ghost"
                onClick={() => run(result.roast.input.level)}
              >
                <span aria-hidden="true">🎲</span> Ještě jednou
              </button>
              <button
                type="button"
                className="ar-btn ar-btn-hot"
                disabled={result.roast.input.level >= 5}
                onClick={() => run((result.roast.input.level + 1) as Level)}
              >
                {result.roast.input.level >= 5 ? (
                  <>
                    Víc už nejde <span aria-hidden="true">🔥</span>
                  </>
                ) : (
                  <>
                    Přitlač <span aria-hidden="true">🌶️</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <Link href={`/astroroast?z=${sign ?? defaultSign}#roast`} className="ar-textlink ar-receiver-more">
        Víc nastavení: pálivost, téma, kámoš →
      </Link>
    </div>
  );
}
