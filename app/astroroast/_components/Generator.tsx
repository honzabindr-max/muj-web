"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { encodeShare, generateRoast } from "@/astroroast/engine";
import { track } from "@/astroroast/analytics";
import {
  TOPIC_IDS,
  type Level,
  type Roast,
  type SignId,
  type Target,
  type Topic,
} from "@/astroroast/types";
import {
  TOPIC_LABELS,
  clampLevel,
  isSignId,
  isTopic,
  maxLevelFor,
  randomSeed,
  signOf,
} from "../_lib/helpers";
import { SignChooser } from "./SignChooser";
import { SpiceMeter } from "./SpiceMeter";
import { RoastCard } from "./RoastCard";
import { ShareBar } from "./ShareBar";
import { FakeDoors } from "./FakeDoors";

const LOADING_LINES = [
  "Konzultuji Saturn…",
  "Merkur je zase retrográdní. Je to tvoje vina…",
  "Ptám se Měsíce, jestli ti to můžu říct…",
  "Vesmír si brousí jazyk…",
  "Sčítám tvoje kosmické prohřešky…",
  "Venuše se ušklíbla. Dobré znamení (pro mě)…",
];

interface Result {
  roast: Roast;
  code: string;
}

const noopSubscribe = () => () => {};

/**
 * Předvolba z URL (?z=znameni&t=tema). Čte se bez Suspense a useSearchParams: server (a statická stránka) vykreslí
 * celý formulář s výchozími hodnotami a předvolba se uplatní až po hydrataci, takže generátor je hned v HTML.
 */
function useUrlPreset(): { sign: SignId | null; topic: Topic | null } {
  const search = useSyncExternalStore(
    noopSubscribe,
    () => window.location.search,
    () => "",
  );
  return useMemo(() => {
    const p = new URLSearchParams(search);
    const z = p.get("z");
    const t = p.get("t");
    return { sign: isSignId(z) ? z : null, topic: isTopic(t) ? t : null };
  }, [search]);
}

export function Generator() {
  const preset = useUrlPreset();

  const [target, setTarget] = useState<Target>("self");
  // undefined = zatím nic nevybráno ručně, platí předvolba z URL
  const [pickedSign, setPickedSign] = useState<SignId | null | undefined>(undefined);
  const [level, setLevel] = useState<Level>(3);
  const [pickedTopic, setPickedTopic] = useState<Topic | undefined>(undefined);
  const sign = pickedSign !== undefined ? pickedSign : preset.sign;
  const topic: Topic = pickedTopic ?? preset.topic ?? "zivot";
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [loadingLine, setLoadingLine] = useState(LOADING_LINES[0]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [lockNudge, setLockNudge] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const chooserRef = useRef<HTMLDivElement>(null);
  const timers = useRef<{ tick?: ReturnType<typeof setInterval>; done?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const t = timers.current;
    return () => {
      if (t.tick) clearInterval(t.tick);
      if (t.done) clearTimeout(t.done);
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = reduce ? "auto" : "smooth";
    if (phase === "loading") {
      resultRef.current?.scrollIntoView({ behavior, block: "center" });
    } else if (phase === "done") {
      // Hotová karta: přesun pohledu i fokusu na nadpis, aby čtečka četla jen kartu a ne celý blok znovu.
      const heading = resultRef.current?.querySelector<HTMLElement>(".ar-card-headline");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ behavior, block: "start" });
      }
    }
  }, [phase]);

  const max = maxLevelFor(target);
  const effectiveLevel = clampLevel(level, target);

  const run = (nextLevel: Level) => {
      if (!sign) {
        setError("Nejdřív vyber znamení. Hvězdy nejsou věštci, ale potřebují vědět, koho roastnout.");
        chooserRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      setError("");
      const lvl = clampLevel(nextLevel, target);
      setLevel(lvl);
      const input = { sign, level: lvl, topic, target, seed: randomSeed() };

      if (timers.current.tick) clearInterval(timers.current.tick);
      if (timers.current.done) clearTimeout(timers.current.done);

      let i = Math.floor(Math.random() * LOADING_LINES.length);
      setLoadingLine(LOADING_LINES[i]);
      setPhase("loading");
      timers.current.tick = setInterval(() => {
        i = (i + 1) % LOADING_LINES.length;
        setLoadingLine(LOADING_LINES[i]);
      }, 280);
      timers.current.done = setTimeout(() => {
        if (timers.current.tick) clearInterval(timers.current.tick);
        const roast = generateRoast(input);
        setResult({ roast, code: encodeShare(input) });
        setPhase("done");
        if (lvl === 5) setShaking(true);
        track("generate", { sign, level: lvl, topic, target, source: "landing" });
      }, 850);
  };

  function changeTarget(next: Target) {
    setTarget(next);
    setLockNudge(false);
    if (next === "friend" && level > 3) setLevel(3);
  }

  function changeLevel(next: Level) {
    setLevel(next);
    setLockNudge(false);
    if (next === 5) setShaking(true);
  }

  const resultSign = result ? signOf(result.roast.input.sign) : null;
  // Přitlačit jde podle aktuálně zvoleného cíle (run() ořezává úroveň podle něj), ne podle cíle starého výsledku.
  const canPush = result ? result.roast.input.level < maxLevelFor(target) : false;
  const friendLockedAtMax = target === "friend" && (result?.roast.input.level ?? 0) >= 3;

  return (
    <section
      id="roast"
      className={`ar-gen${shaking ? " ar-shake" : ""}`}
      data-level={effectiveLevel}
      aria-labelledby="ar-gen-title"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setShaking(false);
      }}
    >
      <div className="ar-gen-panel">
        <h2 id="ar-gen-title" className="ar-vh">
          Generátor roastů
        </h2>
        <h3 className="ar-gen-title">
          <span className="ar-step">1</span> Kdo půjde na gril?
        </h3>

        <div className="ar-seg" role="radiogroup" aria-label="Koho roastnout">
          <button
            type="button"
            role="radio"
            aria-checked={target === "self"}
            className="ar-seg-btn"
            onClick={() => changeTarget("self")}
          >
            <span aria-hidden="true">🙋</span> Mě
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={target === "friend"}
            className="ar-seg-btn"
            onClick={() => changeTarget("friend")}
          >
            <span aria-hidden="true">😈</span> Kámoše
          </button>
        </div>
        {target === "friend" && (
          <p className="ar-note" role="note">
            U kamaráda max. Sarkasmus. Kosmickou popravu si musí odkliknout sám.
          </p>
        )}

        <div ref={chooserRef} className="ar-gen-block">
          <SignChooser
            key={preset.sign ?? "none"}
            value={sign}
            onChange={(s) => {
              setPickedSign(s);
              if (s) setError("");
            }}
            legend={target === "friend" ? "Kdy se narodil kámoš?" : "Kdy ses narodil/a?"}
            cuspLead={target === "friend" ? "Je kámoš" : "Jsi"}
            defaultMode={preset.sign ? "pick" : "date"}
          />
        </div>

        <h3 className="ar-gen-title ar-gen-title-2">
          <span className="ar-step">2</span> Kolik pálivosti snesete?
        </h3>
        <div className="ar-gen-block">
          <SpiceMeter
            value={effectiveLevel}
            max={max}
            onChange={changeLevel}
            onBlocked={() => setLockNudge(true)}
          />
          {lockNudge && (
            <p className="ar-note" role="status">
              🔒 Na kámoše jen do úrovně 3. Vyšší pálivost si musí zapnout on sám.
            </p>
          )}
        </div>

        <h3 className="ar-gen-title ar-gen-title-2">
          <span className="ar-step">3</span> Do čeho se hvězdy zakousnou?
        </h3>
        <div className="ar-chips" role="radiogroup" aria-label="Téma">
          {TOPIC_IDS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={topic === t}
              className="ar-chip"
              onClick={() => setPickedTopic(t)}
            >
              <span aria-hidden="true">{TOPIC_LABELS[t].emoji}</span> {TOPIC_LABELS[t].label}
            </button>
          ))}
        </div>

        {error && (
          <p className="ar-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="ar-btn ar-btn-hero"
          onClick={() => run(effectiveLevel)}
          disabled={phase === "loading"}
        >
          {phase === "loading"
            ? "Hvězdy se soustředí…"
            : target === "friend"
              ? "Roastni kámoše"
              : "Roastni mě"}{" "}
          <span aria-hidden="true">{phase === "loading" ? "🔮" : "🔥"}</span>
        </button>
        <p className="ar-hint ar-hint-center">Zdarma. Bez registrace. Bez ukládání data narození.</p>
      </div>

      <p className="ar-vh" role="status">
        {phase === "loading" ? "Hvězdy se soustředí." : phase === "done" ? "Roast je hotový." : ""}
      </p>

      <div ref={resultRef} className="ar-result-slot">
        {phase === "loading" && (
          <div className="ar-loading" aria-hidden="true">
            <span className="ar-orb" aria-hidden="true">
              🔮
            </span>
            <p>{loadingLine}</p>
          </div>
        )}

        {phase === "done" && result && resultSign && (
          <div key={result.code} className="ar-result" data-level={result.roast.input.level}>
            <RoastCard roast={result.roast} sign={resultSign} />

            <ShareBar
              kind="roast"
              code={result.code}
              headline={result.roast.headline}
              target={result.roast.input.target}
            />
            <FakeDoors variant="inline" placement="result" />

            <div className="ar-again">
              <button type="button" className="ar-btn ar-btn-ghost" onClick={() => run(result.roast.input.level)}>
                <span aria-hidden="true">🎲</span> Ještě jednou
              </button>
              <button
                type="button"
                className="ar-btn ar-btn-hot"
                disabled={!canPush}
                onClick={() => run((result.roast.input.level + 1) as Level)}
              >
                {canPush ? (
                  <>
                    Přitlač <span aria-hidden="true">🌶️</span>
                  </>
                ) : friendLockedAtMax ? (
                  "U kámoše už víc nejde"
                ) : (
                  <>
                    Víc už nejde <span aria-hidden="true">🔥</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
