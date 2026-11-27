"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { encodeShare, generateRoast } from "@/astroroast/engine";
import { track } from "@/astroroast/analytics";
import {
  TOPIC_IDS,
  type Level,
  type RoastInput,
  type SignId,
  type Target,
  type Topic,
} from "@/astroroast/types";
import {
  TOPIC_EMOJI,
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
import { useCopy, useModel } from "./ModelProvider";

/** Výsledek se drží jako vstup (bez textu), aby se při přepnutí modelu překreslil jeho verzí. */
interface Result {
  input: RoastInput;
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
  const { model } = useModel();
  const copy = useCopy();
  const c = copy.generator;

  const [target, setTarget] = useState<Target>("self");
  // undefined = zatím nic nevybráno ručně, platí předvolba z URL
  const [pickedSign, setPickedSign] = useState<SignId | null | undefined>(undefined);
  const [level, setLevel] = useState<Level>(3);
  const [pickedTopic, setPickedTopic] = useState<Topic | undefined>(undefined);
  const sign = pickedSign !== undefined ? pickedSign : preset.sign;
  const topic: Topic = pickedTopic ?? preset.topic ?? "zivot";
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(false);
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
  const roast = useMemo(
    () => (result ? generateRoast({ ...result.input, model }) : null),
    [result, model],
  );

  const run = (nextLevel: Level) => {
      if (!sign) {
        setError(true);
        chooserRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      setError(false);
      const lvl = clampLevel(nextLevel, target);
      setLevel(lvl);
      const input: RoastInput = { sign, level: lvl, topic, target, seed: randomSeed() };
      const lineCount = c.loadingLines.length;

      if (timers.current.tick) clearInterval(timers.current.tick);
      if (timers.current.done) clearTimeout(timers.current.done);

      let i = Math.floor(Math.random() * lineCount);
      setLoadingIdx(i);
      setPhase("loading");
      timers.current.tick = setInterval(() => {
        i = (i + 1) % lineCount;
        setLoadingIdx(i);
      }, 280);
      timers.current.done = setTimeout(() => {
        if (timers.current.tick) clearInterval(timers.current.tick);
        const normalized = generateRoast({ ...input, model }).input;
        setResult({ input: normalized, code: encodeShare(normalized) });
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

  const resultSign = roast ? signOf(roast.input.sign) : null;
  // Přitlačit jde podle aktuálně zvoleného cíle (run() ořezává úroveň podle něj), ne podle cíle starého výsledku.
  const canPush = roast ? roast.input.level < maxLevelFor(target) : false;
  const friendLockedAtMax = target === "friend" && (roast?.input.level ?? 0) >= 3;

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
          {c.panelTitle}
        </h2>
        <h3 className="ar-gen-title">
          <span className="ar-step">1</span> {c.step1}
        </h3>

        <div className="ar-seg" role="radiogroup" aria-label={c.targetAria}>
          <button
            type="button"
            role="radio"
            aria-checked={target === "self"}
            className="ar-seg-btn"
            onClick={() => changeTarget("self")}
          >
            <span aria-hidden="true">🙋</span> {c.targetSelf}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={target === "friend"}
            className="ar-seg-btn"
            onClick={() => changeTarget("friend")}
          >
            <span aria-hidden="true">😈</span> {c.targetFriend}
          </button>
        </div>
        {target === "friend" && (
          <p className="ar-note" role="note">
            {c.friendNote}
          </p>
        )}

        <div ref={chooserRef} className="ar-gen-block">
          <SignChooser
            key={preset.sign ?? "none"}
            value={sign}
            onChange={(s) => {
              setPickedSign(s);
              if (s) setError(false);
            }}
            legend={target === "friend" ? c.legendFriend : c.legendSelf}
            cuspLead={target === "friend" ? c.cuspLeadFriend : c.cuspLeadSelf}
            defaultMode={preset.sign ? "pick" : "date"}
          />
        </div>

        <h3 className="ar-gen-title ar-gen-title-2">
          <span className="ar-step">2</span> {c.step2}
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
              {c.lockNudge}
            </p>
          )}
        </div>

        <h3 className="ar-gen-title ar-gen-title-2">
          <span className="ar-step">3</span> {c.step3}
        </h3>
        <div className="ar-chips" role="radiogroup" aria-label={c.topicsAria}>
          {TOPIC_IDS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={topic === t}
              className="ar-chip"
              onClick={() => setPickedTopic(t)}
            >
              <span aria-hidden="true">{TOPIC_EMOJI[t]}</span> {copy.common.topics[t]}
            </button>
          ))}
        </div>

        {error && (
          <p className="ar-error" role="alert">
            {c.errNoSign}
          </p>
        )}

        <button
          type="button"
          className="ar-btn ar-btn-hero"
          onClick={() => run(effectiveLevel)}
          disabled={phase === "loading"}
        >
          {phase === "loading" ? c.btnLoading : target === "friend" ? c.btnFriend : c.btnSelf}{" "}
          <span aria-hidden="true">{phase === "loading" ? "🔮" : "🔥"}</span>
        </button>
        <p className="ar-hint ar-hint-center">{c.hint}</p>
      </div>

      <p className="ar-vh" role="status">
        {phase === "loading" ? c.statusLoading : phase === "done" ? c.statusDone : ""}
      </p>

      <div ref={resultRef} className="ar-result-slot">
        {phase === "loading" && (
          <div className="ar-loading" aria-hidden="true">
            <span className="ar-orb" aria-hidden="true">
              🔮
            </span>
            <p>{c.loadingLines[loadingIdx % c.loadingLines.length]}</p>
          </div>
        )}

        {phase === "done" && result && roast && resultSign && (
          <div key={result.code} className="ar-result" data-level={roast.input.level}>
            <RoastCard roast={roast} sign={resultSign} copy={copy} />

            <ShareBar
              kind="roast"
              code={result.code}
              headline={roast.headline}
              target={roast.input.target}
            />
            <FakeDoors variant="inline" placement="result" />

            <div className="ar-again">
              <button type="button" className="ar-btn ar-btn-ghost" onClick={() => run(roast.input.level)}>
                <span aria-hidden="true">🎲</span> {c.again}
              </button>
              <button
                type="button"
                className="ar-btn ar-btn-hot"
                disabled={!canPush}
                onClick={() => run((roast.input.level + 1) as Level)}
              >
                {canPush ? (
                  <>
                    {c.push} <span aria-hidden="true">🌶️</span>
                  </>
                ) : friendLockedAtMax ? (
                  c.friendMax
                ) : (
                  <>
                    {c.maxed} <span aria-hidden="true">🔥</span>
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
