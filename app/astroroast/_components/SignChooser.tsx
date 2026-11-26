"use client";

import { useId, useState } from "react";
import { SIGN_LIST, resolveSign } from "@/astroroast/engine";
import type { SignId, SignResolution } from "@/astroroast/types";
import { formatRange, signOf } from "../_lib/helpers";

const MONTHS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

// Počet dní v měsíci. Únor bereme jako přestupný (29), rok nezjišťujeme.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

interface SignChooserProps {
  value: SignId | null;
  onChange: (sign: SignId | null) => void;
  legend: string;
  /** Začátek věty u hraničního data: "Jsi" / "Je kámoš" / "Je to". */
  cuspLead: string;
  defaultMode?: "date" | "pick";
  tone?: "pink" | "lime";
}

/**
 * Výběr znamení: datum narození (den + měsíc, rok se nezjišťuje) nebo přímo 12 znamení.
 * Datum žije jen v lokálním stavu komponenty. Nikam se neposílá ani neukládá.
 */
export function SignChooser({
  value,
  onChange,
  legend,
  cuspLead,
  defaultMode = "date",
  tone = "pink",
}: SignChooserProps) {
  const uid = useId();
  const [mode, setMode] = useState<"date" | "pick">(defaultMode);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [cusp, setCusp] = useState<SignResolution | null>(null);

  function handleDate(nextDay: string, nextMonth: string) {
    let d = nextDay;
    const m = Number(nextMonth);
    if (m && Number(d) > DAYS_IN_MONTH[m - 1]) d = "";
    setDay(d);
    setMonth(nextMonth);
    if (!d || !m) {
      setCusp(null);
      onChange(null);
      return;
    }
    const res = resolveSign(m, Number(d));
    if (res.cuspWith) {
      setCusp(res);
      onChange(null);
    } else {
      setCusp(null);
      onChange(res.sign);
    }
  }

  /** Přepnutí způsobu zadání zahodí rozpracované datum i hraniční dotaz, aby zobrazené datum a znamení nikdy nesouhlasily. */
  function switchMode(next: "date" | "pick") {
    if (next === mode) return;
    setMode(next);
    setCusp(null);
    setDay("");
    setMonth("");
    onChange(null);
  }

  function pickCusp(id: SignId) {
    setCusp(null);
    onChange(id);
  }

  const maxDay = month ? DAYS_IN_MONTH[Number(month) - 1] : 31;
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const chosen = value ? signOf(value) : null;
  const cuspPair: [SignId, SignId] | null = cusp?.cuspWith
    ? ([cusp.sign, cusp.cuspWith].sort(
        (a, b) => SIGN_LIST.findIndex((s) => s.id === a) - SIGN_LIST.findIndex((s) => s.id === b),
      ) as [SignId, SignId])
    : null;

  return (
    <fieldset className="ar-chooser" data-tone={tone}>
      <legend className="ar-label">{legend}</legend>

      <div className="ar-seg ar-seg-sm" role="group" aria-label="Způsob zadání">
        <button
          type="button"
          aria-pressed={mode === "date"}
          className="ar-seg-btn"
          onClick={() => switchMode("date")}
        >
          <span aria-hidden="true">📅</span> Datum narození
        </button>
        <button
          type="button"
          aria-pressed={mode === "pick"}
          className="ar-seg-btn"
          onClick={() => switchMode("pick")}
        >
          <span aria-hidden="true">✨</span> Vyberu znamení
        </button>
      </div>

      {mode === "date" ? (
        <div className="ar-date">
          <div className="ar-date-row">
            <label className="ar-field" htmlFor={`${uid}-d`}>
              <span>Den</span>
              <select
                id={`${uid}-d`}
                className="ar-select"
                value={day}
                autoComplete="off"
                onChange={(e) => handleDate(e.target.value, month)}
              >
                <option value="">–</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}.
                  </option>
                ))}
              </select>
            </label>
            <label className="ar-field ar-field-wide" htmlFor={`${uid}-m`}>
              <span>Měsíc</span>
              <select
                id={`${uid}-m`}
                className="ar-select"
                value={month}
                autoComplete="off"
                onChange={(e) => handleDate(day, e.target.value)}
              >
                <option value="">–</option>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="ar-hint">🔒 Rok nepotřebujeme. Datum zůstává ve tvém prohlížeči.</p>
        </div>
      ) : (
        <div className="ar-signgrid" role="radiogroup" aria-label="Znamení zvěrokruhu">
          {SIGN_LIST.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={value === s.id}
              className="ar-signbtn"
              onClick={() => {
                setCusp(null);
                onChange(s.id);
              }}
            >
              <span className="ar-signbtn-glyph" aria-hidden="true">
                {s.glyph}
              </span>
              <span className="ar-signbtn-name">{s.name}</span>
            </button>
          ))}
        </div>
      )}

      {mode === "date" && cuspPair && (
        <div className="ar-cusp" role="group" aria-label="Hraniční datum">
          <p className="ar-cusp-q">
            <span aria-hidden="true">⚖️</span> Datum je na hraně dvou znamení. {cuspLead} spíš{" "}
            <b>{signOf(cuspPair[0]).name}</b>, nebo <b>{signOf(cuspPair[1]).name}</b>?
          </p>
          <div className="ar-cusp-btns">
            {cuspPair.map((id) => (
              <button key={id} type="button" className="ar-btn ar-btn-ghost" onClick={() => pickCusp(id)}>
                <span aria-hidden="true">{signOf(id).glyph}</span> {signOf(id).name}
              </button>
            ))}
          </div>
        </div>
      )}

      {chosen && (
        <p className="ar-chosen" role="status">
          <span className="ar-chosen-sticker">
            <span aria-hidden="true">{chosen.glyph}</span> {chosen.name}
          </span>
          <span className="ar-chosen-range">{formatRange(chosen)}</span>
        </p>
      )}
    </fieldset>
  );
}
