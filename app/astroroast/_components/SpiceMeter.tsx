"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import type { Level } from "@/astroroast/types";
import { useCopy } from "./ModelProvider";

const LEVELS: Level[] = [1, 2, 3, 4, 5];

interface SpiceMeterProps {
  value: Level;
  /** Nejvyšší povolená úroveň (kámoš a páry: 3). */
  max?: Level;
  onChange: (level: Level) => void;
  /** Voláno při kliknutí na zamčenou úroveň. */
  onBlocked?: () => void;
  label?: string;
}

export function SpiceMeter({ value, max = 5, onChange, onBlocked, label }: SpiceMeterProps) {
  const copy = useCopy();
  const names = copy.common.levelNames;
  const shownLabel = label ?? copy.spice.label;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const labelId = useId();

  function select(next: number) {
    if (next > max) onBlocked?.();
    const lvl = Math.max(1, Math.min(max, next)) as Level;
    onChange(lvl);
    refs.current[lvl - 1]?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        select(value + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        select(value - 1);
        break;
      case "Home":
        e.preventDefault();
        select(1);
        break;
      case "End":
        e.preventDefault();
        select(max);
        break;
    }
  }

  return (
    <div className="ar-spice" data-level={value}>
      <div className="ar-spice-head">
        <span className="ar-label" id={labelId}>
          {shownLabel}
        </span>
        <span className="ar-spice-readout" aria-live="polite">
          <b>{value}/5</b> {names[value]}
        </span>
      </div>
      <div
        className="ar-spice-track"
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKey}
      >
        {LEVELS.map((n) => {
          const locked = n > max;
          const lit = n <= value;
          return (
            <button
              key={n}
              ref={(el) => {
                refs.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-disabled={locked || undefined}
              aria-label={copy.spice.levelAria(n, names[n], locked)}
              tabIndex={value === n ? 0 : -1}
              className={`ar-chili${lit ? " is-lit" : ""}${locked ? " is-locked" : ""}`}
              data-n={n}
              onClick={() => {
                if (locked) {
                  onBlocked?.();
                  return;
                }
                onChange(n);
              }}
            >
              <span className="ar-chili-emoji" aria-hidden="true">
                {locked ? "🔒" : "🌶️"}
              </span>
              <span className="ar-chili-n" aria-hidden="true">
                {n}
              </span>
            </button>
          );
        })}
      </div>
      <p className="ar-spice-blurb">{copy.common.levelBlurb[value]}</p>
      {value === 5 && (
        <p className="ar-spice-doom" aria-hidden="true">
          <span>🔥</span> {copy.common.doom} <span>🔥</span>
        </p>
      )}
    </div>
  );
}
