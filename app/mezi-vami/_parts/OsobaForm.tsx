"use client";

// První a druhá osoba — funkční formulář podle artboardů D-03 (desktop) a Mobil-02 (mobil).
// Vzhled a texty 1:1 z artboardů; navíc: auto-posun a vložení data, combobox míst (WAI-ARIA),
// validace při opuštění pole, údaje v sessionStorage. Chybové texty polí v COPY v3.2 nejsou
// (K-17a), proto se zobrazí „[chybí copy K-17a]“.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { A } from "../_lib/A";
import { LightCurve, LightLayer, Pools } from "../_lib/LightCurve";
import {
  APPROX_LABELS,
  COPY_MISSING_K17A,
  PART_INFO,
  isPersonComplete,
  normalizeTime,
  parseDateInput,
  personErrors,
  type Approx,
  type Mode,
  type Part,
  type Person,
  type Styl,
} from "../_lib/persons";
import { setStep, updatePerson, usePersons } from "../_lib/persons-store";
import { loadPlaces, searchPlaces, type IndexedPlace } from "../_lib/places";
import { nbsp } from "../_lib/nbsp";

type Variant = {
  id: string;
  fs: number; // běžný text
  legend: number;
  inputH: number;
  timeH: number;
  timeW: number;
  modeH: number;
  modePad: string;
  modeFs: number;
  chipPad: string;
  chipFs: number;
  panelPad: string;
  panelRadius: number;
  partCols: number;
  partH: number;
  small: number;
  bigText: number;
};

const D: Variant = {
  id: "d3",
  fs: 15,
  legend: 15,
  inputH: 56,
  timeH: 52,
  timeW: 160,
  modeH: 52,
  modePad: "0 10px",
  modeFs: 15,
  chipPad: "0 18px",
  chipFs: 15,
  panelPad: "22px 24px",
  panelRadius: 16,
  partCols: 4,
  partH: 60,
  small: 15,
  bigText: 17,
};
const M: Variant = {
  id: "m2",
  fs: 14,
  legend: 14,
  inputH: 52,
  timeH: 50,
  timeW: 140,
  modeH: 48,
  modePad: "0 4px",
  modeFs: 14,
  chipPad: "0 14px",
  chipFs: 14,
  panelPad: "16px",
  panelRadius: 14,
  partCols: 2,
  partH: 56,
  small: 14,
  bigText: 15,
};

const ERR = "#F7B4A6";
const ON = { background: "#EDB894", color: "#2A1220", borderColor: "#EDB894" };
const OFF = {
  background: "transparent",
  color: "#F4E9E4",
  borderColor: "#6E5566",
};

const t = (s: string) => nbsp(s);

function inputStyle(
  v: Variant,
  invalid: boolean,
  extra?: CSSProperties,
): CSSProperties {
  return {
    width: "100%",
    height: v.inputH,
    boxSizing: "border-box",
    padding: "0 10px",
    borderRadius: 12,
    border: `1px solid ${invalid ? ERR : "#5A3F53"}`,
    background: "rgba(255, 240, 232, 0.04)",
    color: "#F4E9E4",
    fontFamily: "inherit",
    fontSize: 17,
    fontWeight: 400,
    ...extra,
  };
}

function FieldError({ id, show }: { id: string; show: boolean }) {
  if (!show) return null;
  return (
    <p id={id} style={{ margin: "4px 0 0", fontSize: 14, color: ERR }}>
      {COPY_MISSING_K17A}
    </p>
  );
}

/* ---------- radiogroup s roving tabindex a šipkami ---------- */

type Opt<T extends string> = { id: T; label: string; sub?: string };

function Radios<T extends string>({
  label,
  options,
  value,
  onChange,
  wrap,
  btn,
  btnStyle,
}: {
  label: string;
  options: Opt<T>[];
  value: T;
  onChange: (v: T) => void;
  wrap: CSSProperties;
  btn: CSSProperties;
  btnStyle?: (selected: boolean) => CSSProperties;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const n = options.length;
    let to = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (i + 1) % n;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (i - 1 + n) % n;
    if (e.key === "Home") to = 0;
    if (e.key === "End") to = n - 1;
    if (to < 0) return;
    e.preventDefault();
    onChange(options[to].id);
    refs.current[to]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} style={wrap}>
      {options.map((o, i) => {
        const sel = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => move(e, i)}
            style={{ ...btn, ...(btnStyle ? btnStyle(sel) : sel ? ON : OFF) }}
          >
            {o.sub ? (
              <>
                <span
                  style={{ display: "block", fontSize: 15, fontWeight: 400 }}
                >
                  {t(o.label)}
                </span>
                <span style={{ display: "block", fontSize: 14, opacity: 0.85 }}>
                  {o.sub}
                </span>
              </>
            ) : (
              t(o.label)
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- místo narození: WAI-ARIA combobox ---------- */

function PlaceCombobox({
  v,
  which,
  p,
  invalid,
  describedBy,
  onTouched,
}: {
  v: Variant;
  which: "a" | "b";
  p: Person;
  invalid: boolean;
  describedBy?: string;
  onTouched: () => void;
}) {
  const id = `${v.id}-${which}-misto`;
  const listId = `${id}-list`;
  const [results, setResults] = useState<IndexedPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);

  const run = (text: string) => {
    const my = ++seq.current;
    loadPlaces().then((idx) => {
      if (my !== seq.current) return;
      const r = searchPlaces(idx, text);
      setResults(r);
      setActive(-1);
      setOpen(r.length > 0);
    });
  };

  const choose = (r: IndexedPlace) => {
    updatePerson(which, {
      place: { name: r.name, okres: r.okres, cc: r.cc },
      placeText: r.name,
    });
    seq.current++;
    setOpen(false);
    setActive(-1);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        if (results.length) setOpen(true);
        else if (p.placeText) run(p.placeText);
        return;
      }
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      if (!open) return;
      e.preventDefault();
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(results.length - 1);
    } else if (e.key === "Enter") {
      if (open && active >= 0) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (p.placeText) {
        e.preventDefault();
        updatePerson(which, { placeText: "", place: null });
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && active >= 0 ? `${id}-opt-${active}` : undefined
        }
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Začněte psát obec"
        value={p.placeText}
        onChange={(e) => {
          const text = e.target.value;
          updatePerson(which, { placeText: text, place: null });
          if (text.trim()) run(text);
          else {
            seq.current++;
            setResults([]);
            setOpen(false);
          }
        }}
        onFocus={() => {
          void loadPlaces();
          if (p.placeText && !p.place) run(p.placeText);
        }}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
          onTouched();
        }}
        onKeyDown={onKey}
        style={inputStyle(v, invalid, { padding: "0 18px", textAlign: "left" })}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Místo narození"
        hidden={!open}
        style={{
          position: "absolute",
          zIndex: 20,
          left: 0,
          right: 0,
          top: "calc(100% + 6px)",
          margin: 0,
          padding: 6,
          listStyle: "none",
          maxHeight: 320,
          overflowY: "auto",
          borderRadius: 14,
          border: "1px solid #5A3F53",
          background: "#1E1120",
          boxShadow: "0 30px 70px rgba(0, 0, 0, 0.55)",
        }}
      >
        {results.map((r, i) => (
          <li
            key={`${r.name}|${r.okres}|${r.cc}`}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(r)}
            onMouseMove={() => setActive(i)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 16,
              color: "#F4E9E4",
              background:
                i === active ? "rgba(237, 184, 148, 0.16)" : "transparent",
            }}
          >
            <span>{r.name}</span>
            <span
              style={{ fontSize: 14, color: "#C9B0BE", textAlign: "right" }}
            >
              {r.okres}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- datum: 3 pole ---------- */

function DateFields({
  v,
  which,
  p,
  invalid,
  describedBy,
  onTouched,
}: {
  v: Variant;
  which: "a" | "b";
  p: Person;
  invalid: boolean;
  describedBy?: string;
  onTouched: () => void;
}) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const keys = ["den", "mesic", "rok"] as const;
  const specs = [
    {
      key: "den",
      label: "Den",
      ph: "DD",
      ac: "bday-day",
      max: 2,
      flex: "1 1 0",
    },
    {
      key: "mesic",
      label: "Měsíc",
      ph: "MM",
      ac: "bday-month",
      max: 2,
      flex: "1 1 0",
    },
    {
      key: "rok",
      label: "Rok",
      ph: "RRRR",
      ac: "bday-year",
      max: 4,
      flex: "1.6 1 0",
    },
  ] as const;

  const focus = (i: number) => {
    const el = refs[i].current;
    if (el) {
      el.focus();
      el.select();
    }
  };

  const applyParsed = (raw: string): boolean => {
    const parsed = parseDateInput(raw);
    if (!parsed) return false;
    updatePerson(which, parsed);
    focus(2);
    return true;
  };

  return (
    <fieldset
      style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          onTouched();
      }}
    >
      <legend
        style={{
          padding: 0,
          fontSize: v.legend,
          fontWeight: 400,
          color: "#E8DAE0",
        }}
      >
        Datum narození
      </legend>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        {specs.map((s, i) => (
          <div
            key={s.key}
            style={{
              flex: s.flex,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <label
              htmlFor={`${v.id}-${which}-${s.key}`}
              style={{ fontSize: v.fs, color: "#BDA7B2" }}
            >
              {s.label}
            </label>
            <input
              ref={refs[i]}
              id={`${v.id}-${which}-${s.key}`}
              type="text"
              inputMode="numeric"
              autoComplete={s.ac}
              maxLength={s.max}
              placeholder={s.ph}
              value={p[keys[i]]}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              onChange={(e) => {
                const raw = e.target.value;
                if (applyParsed(raw)) return;
                const digits = raw.replace(/\D/g, "").slice(0, s.max);
                updatePerson(which, { [s.key]: digits });
                if (i < 2 && digits.length === 2) focus(i + 1);
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (parseDateInput(text)) {
                  e.preventDefault();
                  applyParsed(text);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && p[keys[i]] === "" && i > 0) {
                  e.preventDefault();
                  focus(i - 1);
                }
              }}
              style={inputStyle(v, invalid, { textAlign: "center" })}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/* ---------- pole času HH:MM ---------- */

function TimeField({
  v,
  which,
  p,
  label,
  hint,
  idSuffix,
  invalid,
  describedBy,
  onTouched,
}: {
  v: Variant;
  which: "a" | "b";
  p: Person;
  label: string;
  hint?: string;
  idSuffix: string;
  invalid: boolean;
  describedBy?: string;
  onTouched: () => void;
}) {
  const id = `${v.id}-${which}-${idSuffix}`;
  return (
    <div
      style={{
        marginTop: 14,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <label htmlFor={id} style={{ fontSize: v.fs, color: "#E8DAE0" }}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
        value={p.cas}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) =>
          updatePerson(which, {
            cas: e.target.value.replace(/[^\d:.]/g, "").slice(0, 5),
          })
        }
        onBlur={() => {
          const n = normalizeTime(p.cas);
          if (n) updatePerson(which, { cas: n });
          onTouched();
        }}
        style={{
          width: v.timeW,
          height: v.timeH,
          boxSizing: "border-box",
          padding: "0 16px",
          borderRadius: 12,
          border: `1px solid ${invalid ? ERR : "#5A3F53"}`,
          background: "rgba(255, 240, 232, 0.04)",
          color: "#F4E9E4",
          fontFamily: "inherit",
          fontSize: 17,
          fontWeight: 400,
        }}
      />
      {hint ? (
        <p style={{ margin: 0, fontSize: v.small, color: "#C9B0BE" }}>{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------- jedna osoba ---------- */

function PersonForm({
  v,
  which,
  p,
}: {
  v: Variant;
  which: "a" | "b";
  p: Person;
}) {
  const [touched, setTouched] = useState({
    date: false,
    place: false,
    cas: false,
  });
  const err = personErrors(p);
  const touch = (k: "date" | "place" | "cas") =>
    setTouched((s) => (s[k] ? s : { ...s, [k]: true }));
  const pre = `${v.id}-${which}`;
  const dateInvalid = touched.date && !!err.date;
  const placeInvalid = touched.place && !!err.place;
  const timeInvalid = touched.cas && !!err.time;
  const panel: CSSProperties = {
    padding: v.panelPad,
    borderRadius: v.panelRadius,
    border: "1px solid rgba(242, 198, 166, 0.22)",
    background: "rgba(255, 240, 232, 0.035)",
  };
  const p1: CSSProperties = {
    margin: 0,
    fontSize: v.bigText,
    fontWeight: 400,
    color: "#F1D0BC",
  };
  const p2: CSSProperties = {
    margin: "4px 0 0",
    fontSize: v.fs,
    color: "#BDA7B2",
  };
  const body1: CSSProperties = {
    margin: v === D ? "14px 0 0" : "12px 0 0",
    fontSize: v.fs,
    lineHeight: 1.6,
    color: "#E8DAE0",
  };
  const body2: CSSProperties = {
    margin: "8px 0 0",
    fontSize: v.fs,
    lineHeight: 1.6,
    color: "#C9B0BE",
  };

  const modeBtn: CSSProperties = {
    minHeight: v.modeH,
    padding: v.modePad,
    borderRadius: 12,
    border: "1px solid",
    fontFamily: "inherit",
    fontSize: v.modeFs,
    fontWeight: 400,
    cursor: "pointer",
  };

  return (
    <>
      <div
        style={{
          marginTop: v === D ? 36 : 24,
          display: v === D ? "grid" : "flex",
          ...(v === D
            ? { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 }
            : { flexDirection: "column", gap: 18 }),
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <DateFields
            v={v}
            which={which}
            p={p}
            invalid={dateInvalid}
            describedBy={dateInvalid ? `${pre}-datum-err` : undefined}
            onTouched={() => touch("date")}
          />
          <FieldError id={`${pre}-datum-err`} show={dateInvalid} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            htmlFor={`${pre}-misto`}
            style={{ fontSize: v.legend, fontWeight: 400, color: "#E8DAE0" }}
          >
            Místo narození
          </label>
          <PlaceCombobox
            v={v}
            which={which}
            p={p}
            invalid={placeInvalid}
            describedBy={placeInvalid ? `${pre}-misto-err` : undefined}
            onTouched={() => touch("place")}
          />
          <FieldError id={`${pre}-misto-err`} show={placeInvalid} />
          <p style={{ margin: 0, fontSize: v.small, color: "#C9B0BE" }}>
            {t("Podporujeme místa narození v Česku a na Slovensku.")}
          </p>
        </div>
      </div>

      <fieldset
        style={{
          margin: v === D ? "28px 0 0" : "24px 0 0",
          padding: 0,
          border: 0,
        }}
      >
        <legend
          style={{
            padding: 0,
            fontSize: v.legend,
            fontWeight: 400,
            color: "#E8DAE0",
          }}
        >
          Znáte čas narození?
        </legend>
        <Radios<Mode>
          label="Znáte čas narození?"
          options={[
            { id: "exact", label: "Vím přesně" },
            { id: "approx", label: "Vím přibližně" },
            { id: "unknown", label: "Nevím" },
          ]}
          value={p.mode}
          onChange={(m) => updatePerson(which, { mode: m })}
          wrap={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: v === D ? 10 : 8,
          }}
          btn={modeBtn}
        />

        <div style={{ marginTop: v === D ? 18 : 14, ...panel }}>
          {p.mode === "exact" && (
            <>
              <p style={p1}>Přesný čas narození</p>
              <p style={p2}>Zadejte čas v hodinách a minutách.</p>
              <TimeField
                v={v}
                which={which}
                p={p}
                label="Čas narození"
                idSuffix="cas"
                invalid={timeInvalid}
                describedBy={timeInvalid ? `${pre}-cas-err` : undefined}
                onTouched={() => touch("cas")}
              />
              <FieldError id={`${pre}-cas-err`} show={timeInvalid} />
              <p style={body1}>
                {t(
                  "Přesný čas může rozšířit rozsah Vztahové DNA. Zahrneme pouze části, které jsou pro danou dvojici dostupné.",
                )}
              </p>
              <p style={body2}>
                {t(
                  "Pokud čas znáte jen přibližně, zvolte „Vím přibližně“. Pokud ho neznáte, zvolte „Nevím“.",
                )}
              </p>
            </>
          )}
          {p.mode === "approx" && (
            <>
              <p style={p1}>Přibližný čas narození</p>
              <p style={p2}>Uveďte odhad s rozmezím nebo část dne.</p>
              <div style={{ marginTop: v === D ? 14 : 12 }}>
                <Radios<Approx>
                  label="Rozmezí"
                  options={(Object.keys(APPROX_LABELS) as Approx[]).map(
                    (k) => ({ id: k, label: APPROX_LABELS[k] }),
                  )}
                  value={p.approx}
                  onChange={(a) => updatePerson(which, { approx: a })}
                  wrap={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                  btn={{
                    minHeight: 44,
                    padding: v.chipPad,
                    borderRadius: 999,
                    border: "1px solid",
                    fontFamily: "inherit",
                    fontSize: v.chipFs,
                    cursor: "pointer",
                  }}
                />
              </div>
              {p.approx !== "part" ? (
                <TimeField
                  v={v}
                  which={which}
                  p={p}
                  label="Přibližný čas narození"
                  idSuffix="cas-pribl"
                  hint="Uveďte místní čas v místě narození."
                  invalid={timeInvalid}
                  describedBy={timeInvalid ? `${pre}-cas-err` : undefined}
                  onTouched={() => touch("cas")}
                />
              ) : (
                <div style={{ marginTop: v === D ? 14 : 12 }}>
                  <Radios<Part>
                    label="Část dne"
                    options={(Object.keys(PART_INFO) as Part[]).map((k) => ({
                      id: k,
                      label: PART_INFO[k].label,
                      sub: PART_INFO[k].range,
                    }))}
                    value={p.part}
                    onChange={(x) => updatePerson(which, { part: x })}
                    wrap={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${v.partCols}, minmax(0, 1fr))`,
                      gap: 8,
                    }}
                    btn={{
                      minHeight: v.partH,
                      padding: "6px 12px",
                      borderRadius: 12,
                      border: "1px solid",
                      fontFamily: "inherit",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  />
                </div>
              )}
              <FieldError
                id={`${pre}-cas-err`}
                show={timeInvalid && p.approx !== "part"}
              />
              <p
                style={{ ...body1, margin: v === D ? "14px 0 0" : "12px 0 0" }}
              >
                Odhad nepovažujeme za přesný čas.
              </p>
              <p style={body2}>
                {t(
                  "Uveďte přibližný čas a vyberte rozmezí. Znáte-li jen část dne, zvolte „Jen část dne“.",
                )}
              </p>
            </>
          )}
          {p.mode === "unknown" && (
            <>
              <p style={p1}>Bez času narození</p>
              <p style={p2}>I bez něj můžete pokračovat.</p>
              <p
                style={{ ...body1, margin: v === D ? "12px 0 0" : "10px 0 0" }}
              >
                {t(
                  "Získáte plnohodnotnou Vztahovou DNA s menším rozsahem. Části, které bez času narození nelze vyhodnotit, vynecháme.",
                )}
              </p>
              <p style={body2}>Není potřeba zadávat náhradní čas.</p>
            </>
          )}
        </div>
      </fieldset>

      <details
        style={{
          marginTop: v === D ? 24 : 22,
          borderTop: "1px solid #3A2535",
          borderBottom: "1px solid #3A2535",
          padding: "4px 0",
        }}
      >
        <summary
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: v === D ? 52 : 48,
            fontSize: v.fs,
            color: "#E8DAE0",
          }}
        >
          <span>
            Gramatická podoba textu{" "}
            <span style={{ color: "#C9B0BE" }}>(nepovinné)</span>
          </span>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="#EDB894"
            strokeWidth="1.4"
          >
            <path d="M3 5l4 4 4-4" />
          </svg>
        </summary>
        <div
          role="radiogroup"
          aria-label="Gramatická podoba textu"
          style={{
            display: "flex",
            flexWrap: v === D ? "wrap" : undefined,
            flexDirection: v === D ? "row" : "column",
            gap: v === D ? "6px 28px" : 4,
            padding: v === D ? "4px 0 8px" : "4px 0 14px",
          }}
        >
          {(
            [
              ["neutral", "Neutrálně"],
              ["m", "V mužském rodě"],
              ["f", "V ženském rodě"],
            ] as [Styl, string][]
          ).map(([k, l]) => (
            <label
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: v === D ? 10 : 12,
                minHeight: 44,
                fontSize: 15,
                color: "#F4E9E4",
              }}
            >
              <input
                type="radio"
                name={`${pre}-styl`}
                checked={p.styl === k}
                onChange={() => updatePerson(which, { styl: k })}
                style={{ width: 20, height: 20, accentColor: "#EDB894" }}
              />
              {l}
            </label>
          ))}
        </div>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: v.fs,
            lineHeight: 1.55,
            color: "#C9B0BE",
          }}
        >
          {t(
            "Volba mění jen gramatiku textu o této osobě. Výpočet neovlivní. Bez výběru zůstává neutrální vyjadřování.",
          )}
        </p>
      </details>
    </>
  );
}

/* ---------- společné tlačítko a stránka ---------- */

const CTA_BG = "linear-gradient(180deg, #F7D5BB 0%, #E8B391 100%)";
const CTA_SHADOW =
  "0 12px 36px rgba(240, 160, 130, 0.4), 0 0 70px rgba(240, 160, 130, 0.22), inset 0 1px 0 rgba(255, 244, 236, 0.7)";

function useFocusOnStep(step: "A" | "B") {
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    ref.current?.focus({ preventScroll: true });
  }, [step]);
  return ref;
}

function Cta({
  valid,
  step,
  v,
}: {
  valid: boolean;
  step: "A" | "B";
  v: Variant;
}) {
  const base: CSSProperties =
    v === D
      ? { minHeight: 58, padding: "0 48px", borderRadius: 999, fontSize: 16 }
      : { width: "100%", minHeight: 56, borderRadius: 999, fontSize: 16 };
  const common: CSSProperties = {
    ...base,
    border: 0,
    background: CTA_BG,
    color: "#2A1220",
    boxShadow: CTA_SHADOW,
    fontFamily: "inherit",
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (!valid) {
    return (
      <button
        type="button"
        disabled
        style={{
          ...common,
          opacity: 0.4,
          boxShadow: "none",
          cursor: "not-allowed",
        }}
      >
        Pokračovat
      </button>
    );
  }
  if (step === "A") {
    return (
      <button
        type="button"
        onClick={() => setStep("B")}
        style={{ ...common, cursor: "pointer" }}
      >
        Pokračovat
      </button>
    );
  }
  return (
    <A
      href="/mezi-vami/vypocet"
      style={{ ...common, textDecoration: "none", color: "#2A1220" }}
    >
      Pokračovat
    </A>
  );
}

const titleStyle = (size: number): CSSProperties => ({
  margin: 0,
  fontFamily: "var(--font-mv-garamond), serif",
  fontWeight: 400,
  fontSize: size,
  lineHeight: 1,
  background: "linear-gradient(180deg, #F6E6DA 0%, #E5C6B5 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  outline: "none",
});

const GRAD_DEFS = (id: string, x1: number, x2: number): ReactNode => (
  <linearGradient
    id={id}
    gradientUnits="userSpaceOnUse"
    x1={x1}
    y1="0"
    x2={x2}
    y2="0"
  >
    <stop offset="0" stopColor="#6E3C8A" stopOpacity="0" />
    <stop offset="0.45" stopColor="#C77FAA" />
    <stop offset="0.75" stopColor="#FFF1E6" />
    <stop offset="1" stopColor="#EFB49A" stopOpacity="0.2" />
  </linearGradient>
);

export function OsobaD() {
  const s = usePersons();
  const step = s.step;
  const which = step === "A" ? "a" : "b";
  const p = s[which];
  const h1 = useFocusOnStep(step);
  const valid = isPersonComplete(p);
  const B = step === "B";
  return (
    <div
      className="xd03"
      style={{
        position: "relative",
        width: "100%",
        minHeight: 1180,
        background: "#120A12",
        color: "#F4E9E4",
        fontFamily: "var(--font-mv-jost), system-ui, sans-serif",
        fontVariantNumeric: "lining-nums",
        fontWeight: 400,
        overflow: "hidden",
      }}
    >
      <Pools
        style={{ left: 0, top: 0, width: "100%", height: 500 }}
        pools={[
          {
            left: 45.139,
            top: -40,
            width: 69.444,
            height: 144,
            rgb: "58 24 56",
            alpha: 0.6,
          },
        ]}
      />
      <LightCurve
        style={{ left: 0, top: 0, width: "100%", height: 500 }}
        defs={GRAD_DEFS("d3A", -40, 1480)}
      >
        <LightLayer
          viewBox="0 0 1440 500"
          preserveAspectRatio="xMidYMid slice"
          blur={5}
        >
          <path
            vectorEffect="non-scaling-stroke"
            d="M -40 300 C 400 160, 1000 140, 1480 240"
            fill="none"
            stroke="url(#d3A)"
            strokeWidth="8"
            opacity="0.4"
          />
        </LightLayer>
        <LightLayer viewBox="0 0 1440 500" preserveAspectRatio="xMidYMid slice">
          <path
            vectorEffect="non-scaling-stroke"
            d="M -40 300 C 400 160, 1000 140, 1480 240"
            fill="none"
            stroke="url(#d3A)"
            strokeWidth="1.1"
          />
        </LightLayer>
      </LightCurve>
      <header
        style={{
          position: "relative",
          maxWidth: 1280,
          margin: "0 auto",
          padding: "28px 40px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <A
          href="/mezi-vami"
          style={{
            fontFamily: "var(--font-mv-garamond), serif",
            fontSize: 23,
            letterSpacing: "0.14em",
            color: "#F4E9E4",
            textDecoration: "none",
          }}
        >
          MEZI VÁMI
        </A>
        <div
          aria-hidden="true"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 13,
            color: "#BDA7B2",
          }}
        >
          <span style={{ color: "#F1D0BC" }}>První osoba</span>
          <span
            style={{
              width: 60,
              height: 2,
              borderRadius: 2,
              background: B ? "#EDB894" : "#3A2535",
            }}
          />
          <span style={{ color: B ? "#F1D0BC" : "#A48D99" }}>Druhá osoba</span>
        </div>
      </header>
      <main
        style={{
          position: "relative",
          maxWidth: 1280,
          margin: "0 auto",
          padding: "64px 40px 96px",
          display: "flex",
          flexWrap: "wrap",
          gap: 64,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "1 1 620px", minWidth: 0, maxWidth: 680 }}>
          <h1 ref={h1} tabIndex={-1} style={titleStyle(72)}>
            {B ? "Druhá osoba" : "První osoba"}
          </h1>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 22,
              lineHeight: 1.4,
              color: "#E8DAE0",
            }}
          >
            {B
              ? "Teď údaje o narození druhé osoby."
              : "Začněte údaji o narození první osoby."}
          </p>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 16,
              lineHeight: 1.65,
              color: "#BDA7B2",
            }}
          >
            {t(
              "Vyplňte datum a místo narození. Potom zvolte, zda znáte čas narození přesně, přibližně, nebo ho neznáte.",
            )}
          </p>
          <PersonForm key={which} v={D} which={which} p={p} />
          <div
            style={{
              marginTop: 32,
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              alignItems: "center",
            }}
          >
            <Cta valid={valid} step={step} v={D} />
            {B ? (
              <button
                type="button"
                onClick={() => setStep("A")}
                style={{
                  minHeight: 58,
                  padding: "0 22px",
                  border: 0,
                  background: "transparent",
                  color: "#E8DAE0",
                  fontFamily: "inherit",
                  fontSize: 15,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Zpět k první osobě
              </button>
            ) : (
              <A
                href="/mezi-vami/start"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 58,
                  padding: "0 22px",
                  fontSize: 15,
                  color: "#E8DAE0",
                }}
              >
                Zpět
              </A>
            )}
          </div>
        </div>
        <aside style={{ flex: "0 1 340px", minWidth: 280, marginTop: 140 }}>
          {B && (
            <div
              style={{
                padding: 24,
                borderRadius: 18,
                border: "1px solid rgba(240, 190, 165, 0.2)",
                background: "rgba(255, 240, 232, 0.03)",
              }}
            >
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 20 20"
                fill="none"
                stroke="#E3A3BC"
                strokeWidth="1.3"
              >
                <circle cx="7.5" cy="10" r="5" />
                <circle cx="12.5" cy="10" r="5" />
              </svg>
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: "#EADCE2",
                }}
              >
                {t(
                  "Údaje druhé osoby slouží k vytvoření společné vztahové analýzy. Její jméno ani e-mail nejsou potřeba.",
                )}
              </p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export function OsobaM() {
  const s = usePersons();
  const step = s.step;
  const which = step === "A" ? "a" : "b";
  const p = s[which];
  const h1 = useFocusOnStep(step);
  const valid = isPersonComplete(p);
  const B = step === "B";
  const backBtn: CSSProperties = {
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: "1px solid #4A3045",
    background: "transparent",
    cursor: "pointer",
  };
  const chevron = (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#F4E9E4"
      strokeWidth="1.4"
    >
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
  return (
    <div
      className="xm02"
      style={{
        position: "relative",
        width: "100%",
        minHeight: 1400,
        boxSizing: "border-box",
        background: "#120A12",
        color: "#F4E9E4",
        fontFamily: "var(--font-mv-jost), system-ui, sans-serif",
        fontVariantNumeric: "lining-nums",
        fontWeight: 400,
        overflow: "hidden",
      }}
    >
      <Pools
        style={{ left: 0, top: 0, width: "100%", height: 300 }}
        pools={[
          {
            left: 26.667,
            top: -26.667,
            width: 106.667,
            height: 113.333,
            rgb: "58 24 56",
            alpha: 0.6,
          },
        ]}
      />
      <LightCurve
        style={{ left: 0, top: 0, width: "100%", height: 300 }}
        defs={GRAD_DEFS("m2A", -20, 400)}
      >
        <LightLayer viewBox="0 0 375 300" blur={5}>
          <path
            vectorEffect="non-scaling-stroke"
            d="M -20 150 C 120 70, 260 60, 400 120"
            fill="none"
            stroke="url(#m2A)"
            strokeWidth="8"
            opacity="0.5"
          />
        </LightLayer>
        <LightLayer viewBox="0 0 375 300">
          <path
            vectorEffect="non-scaling-stroke"
            d="M -20 150 C 120 70, 260 60, 400 120"
            fill="none"
            stroke="url(#m2A)"
            strokeWidth="1.2"
          />
        </LightLayer>
      </LightCurve>
      <header
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
        }}
      >
        {B ? (
          <button
            type="button"
            aria-label="Zpět k první osobě"
            onClick={() => setStep("A")}
            style={backBtn}
          >
            {chevron}
          </button>
        ) : (
          <A
            href="/mezi-vami/start"
            aria-label="Zpět"
            style={{ ...backBtn, textDecoration: "none" }}
          >
            {chevron}
          </A>
        )}
        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: "var(--font-mv-garamond), serif",
            fontSize: 17,
            letterSpacing: "0.14em",
            color: "#E8DAE0",
          }}
        >
          MEZI VÁMI
        </span>
        <span style={{ width: 44 }} />
      </header>
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          display: "flex",
          gap: 6,
          padding: "0 20px",
        }}
      >
        <span
          style={{ flex: 1, height: 3, borderRadius: 3, background: "#EDB894" }}
        />
        <span
          style={{
            flex: 1,
            height: 3,
            borderRadius: 3,
            background: B ? "#EDB894" : "#3A2535",
          }}
        />
      </div>
      <main style={{ position: "relative", padding: "30px 20px 0" }}>
        <h1 ref={h1} tabIndex={-1} style={titleStyle(46)}>
          {B ? "Druhá osoba" : "První osoba"}
        </h1>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 17,
            lineHeight: 1.45,
            color: "#E8DAE0",
          }}
        >
          {B
            ? "Teď údaje o narození druhé osoby."
            : "Začněte údaji o narození první osoby."}
        </p>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 14,
            lineHeight: 1.6,
            color: "#BDA7B2",
          }}
        >
          {t(
            "Vyplňte datum a místo narození. Potom zvolte, zda znáte čas narození přesně, přibližně, nebo ho neznáte.",
          )}
        </p>
        <PersonForm key={which} v={M} which={which} p={p} />
        {B && (
          <p
            style={{
              margin: "20px 0 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: "#BDA7B2",
            }}
          >
            {t(
              "Údaje druhé osoby slouží k vytvoření společné vztahové analýzy. Její jméno ani e-mail nejsou potřeba.",
            )}
          </p>
        )}
        <div style={{ marginTop: 24 }}>
          <Cta valid={valid} step={step} v={M} />
          {B ? (
            <button
              type="button"
              onClick={() => setStep("A")}
              style={{
                marginTop: 8,
                width: "100%",
                minHeight: 48,
                border: 0,
                background: "transparent",
                color: "#F1D0BC",
                fontFamily: "inherit",
                fontSize: 14,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Zpět k první osobě
            </button>
          ) : (
            <A
              href="/mezi-vami/start"
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                fontSize: 14,
              }}
            >
              Zpět
            </A>
          )}
        </div>
      </main>
    </div>
  );
}
