"use client";

// Kolečkový výběr ve stylu iOS: svislá kolečka se scroll-snap, střední řádek je vybraná hodnota.
// Dotyk/myš: tažení a kolečko myši (nativní scroll se snapem). Klávesnice (desktop): šipky ↑/↓
// o 1, PageUp/PageDown o 5, Home/End na kraj, Tab přechází mezi kolečky. Každé kolečko je
// role="spinbutton" s aria-valuetext. prefers-reduced-motion: bez plynulého dojezdu.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

export type WheelOption = { value: string; label: string };
export type WheelColumn = {
  key: string;
  /** krátký název kolečka pro čtečku („Den“, „Měsíc“…) */
  label: string;
  options: WheelOption[];
  value: string;
  /** relativní šířka */
  flex?: number;
  /** text pro čtečku k aktuální hodnotě (výchozí label volby) */
  valueText?: (o: WheelOption) => string;
};

const ROW = 40;
const VISIBLE = 5; // lichý počet → jeden střední řádek
const PAD = ((VISIBLE - 1) / 2) * ROW;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Wheel({
  col,
  onChange,
}: {
  col: WheelColumn;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | null>(null);
  const programmatic = useRef(false);
  const idx = Math.max(
    0,
    col.options.findIndex((o) => o.value === col.value),
  );

  const scrollToIndex = useCallback((i: number, smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTo({
      top: i * ROW,
      behavior: smooth && !reducedMotion() ? "smooth" : "auto",
    });
    window.setTimeout(() => (programmatic.current = false), smooth ? 350 : 30);
  }, []);

  // hodnota zvenku (nebo změna počtu dnů v měsíci) → dorovnat polohu kolečka
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (Math.round(el.scrollTop / ROW) !== idx) scrollToIndex(idx, false);
  }, [idx, col.options.length, scrollToIndex]);

  const commit = useCallback(
    (i: number) => {
      const o = col.options[Math.min(Math.max(i, 0), col.options.length - 1)];
      if (o && o.value !== col.value) {
        onChange(o.value);
        if (typeof navigator !== "undefined" && "vibrate" in navigator)
          navigator.vibrate?.(4);
      }
    },
    [col.options, col.value, onChange],
  );

  const onScroll = () => {
    if (programmatic.current) return;
    if (settle.current) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.round(el.scrollTop / ROW);
      commit(i);
      // dorovná případný nedojetý snap
      if (Math.abs(el.scrollTop - i * ROW) > 1) scrollToIndex(i, true);
    }, 90);
  };

  const step = (delta: number) => {
    const i = Math.min(Math.max(idx + delta, 0), col.options.length - 1);
    commit(i);
    scrollToIndex(i, true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      PageUp: -5,
      PageDown: 5,
      Home: -Infinity,
      End: Infinity,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    const d = map[e.key];
    if (d === -Infinity) step(-idx);
    else if (d === Infinity) step(col.options.length - 1 - idx);
    else step(d);
  };

  const current = col.options[idx];
  return (
    <div style={{ flex: col.flex ?? 1, minWidth: 0, position: "relative" }}>
      <div
        ref={ref}
        role="spinbutton"
        tabIndex={0}
        aria-label={col.label}
        aria-valuenow={idx}
        aria-valuemin={0}
        aria-valuemax={col.options.length - 1}
        aria-valuetext={
          current ? (col.valueText ? col.valueText(current) : current.label) : ""
        }
        className="mv-wheel"
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        style={{
          height: ROW * VISIBLE,
          overflowY: "auto",
          scrollSnapType: "y mandatory",
          overscrollBehavior: "contain",
          scrollbarWidth: "none",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 0, #000 34%, #000 66%, transparent 100%)",
          maskImage:
            "linear-gradient(180deg, transparent 0, #000 34%, #000 66%, transparent 100%)",
          borderRadius: 10,
          outlineOffset: 2,
          touchAction: "pan-y",
        }}
      >
        <div style={{ height: PAD }} aria-hidden="true" />
        {col.options.map((o, i) => (
          <div
            key={o.value}
            aria-hidden="true"
            onClick={() => {
              commit(i);
              scrollToIndex(i, true);
            }}
            style={{
              height: ROW,
              scrollSnapAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              fontVariantNumeric: "tabular-nums lining-nums",
              color: i === idx ? "#F4E9E4" : "#B9A1B0",
              cursor: "pointer",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </div>
        ))}
        <div style={{ height: PAD }} aria-hidden="true" />
      </div>
    </div>
  );
}

/** Rozbalovací pole s koly: tlačítko s hodnotou (nebo výzvou) + kolečka pod ním. */
export function WheelField({
  label,
  labelStyle,
  placeholder,
  display,
  columns,
  onChange,
  onOpen,
  onClose,
  invalid,
  describedBy,
  buttonStyle,
  idBase,
}: {
  label: string;
  labelStyle?: CSSProperties;
  placeholder: string;
  /** zobrazená hodnota; null = nic nevybráno */
  display: string | null;
  columns: WheelColumn[];
  onChange: (key: string, value: string) => void;
  /** při otevření (např. doplnit výchozí hodnoty, když je pole prázdné) */
  onOpen?: () => void;
  onClose?: () => void;
  invalid?: boolean;
  describedBy?: string;
  buttonStyle?: CSSProperties;
  idBase: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    onClose?.();
    btn.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // fokus na první kolečko, ať jdou hned šipky
    const first = panel.current?.querySelector<HTMLElement>('[role="spinbutton"]');
    first?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span id={`${idBase}-label`} style={labelStyle}>
        {label}
      </span>
      <button
        ref={btn}
        type="button"
        id={idBase}
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${idBase}-label ${idBase}`}
        data-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => {
          if (open) close();
          else {
            onOpen?.();
            setOpen(true);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 17,
          fontWeight: 400,
          color: display ? "#F4E9E4" : "#B9A1B0",
          ...buttonStyle,
        }}
      >
        <span>{display ?? placeholder}</span>
        <span aria-hidden="true" style={{ fontSize: 13, color: "#C9B0BE" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      <div
        ref={panel}
        id={panelId}
        hidden={!open}
        role="group"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && e.target !== e.currentTarget)) {
            e.preventDefault();
            close();
          }
        }}
        style={{
          marginTop: 4,
          padding: "10px 12px 12px",
          borderRadius: 14,
          border: "1px solid #7A5C70",
          background: "rgba(24, 13, 24, 0.96)",
        }}
      >
        {open ? (
          <>
            <div style={{ position: "relative", display: "flex", gap: 6 }}>
              {/* zvýrazněný střední řádek */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: PAD,
                  height: ROW,
                  borderRadius: 10,
                  background: "rgba(237, 184, 148, 0.12)",
                  border: "1px solid rgba(237, 184, 148, 0.35)",
                  pointerEvents: "none",
                }}
              />
              {columns.map((c) => (
                <Wheel key={c.key} col={c} onChange={(val) => onChange(c.key, val)} />
              ))}
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span className="mv-kbd-hint" style={{ fontSize: 13, color: "#B9A1B0" }} aria-hidden="true">
                ↑ ↓ na klávesnici
              </span>
              <button
                type="button"
                onClick={close}
                style={{
                  minHeight: 44,
                  padding: "0 22px",
                  borderRadius: 999,
                  border: "1px solid #EDB894",
                  background: "rgba(237, 184, 148, 0.14)",
                  color: "#F4E9E4",
                  fontFamily: "inherit",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Hotovo
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- hodnoty pro datum a čas ---------- */

export const MONTHS = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];
export const MONTHS_GEN = [
  "ledna",
  "února",
  "března",
  "dubna",
  "května",
  "června",
  "července",
  "srpna",
  "září",
  "října",
  "listopadu",
  "prosince",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

export function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year || 2000, month, 0)).getUTCDate();
}

export const DEFAULT_DATE = { den: "01", mesic: "01", rok: "1990" };
export const DEFAULT_TIME = "12:00";

export function dateColumns(
  p: { den: string; mesic: string; rok: string },
  minYear: number,
  today: Date = new Date(),
): WheelColumn[] {
  const y = Number(p.rok) || Number(DEFAULT_DATE.rok);
  const m = Number(p.mesic) || 1;
  const maxYear = today.getFullYear();
  let maxMonth = 12;
  let maxDay = daysInMonth(m, y);
  if (y === maxYear) {
    maxMonth = today.getMonth() + 1;
    if (m === maxMonth) maxDay = Math.min(maxDay, today.getDate());
  }
  const days = Array.from({ length: maxDay }, (_, i) => ({
    value: pad2(i + 1),
    label: String(i + 1),
  }));
  const months = MONTHS.slice(0, maxMonth).map((name, i) => ({
    value: pad2(i + 1),
    label: name,
  }));
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
    const v = String(minYear + i);
    return { value: v, label: v };
  });
  return [
    { key: "den", label: "Den", options: days, value: p.den || DEFAULT_DATE.den, flex: 0.8 },
    {
      key: "mesic",
      label: "Měsíc",
      options: months,
      value: p.mesic || DEFAULT_DATE.mesic,
      flex: 1.6,
    },
    { key: "rok", label: "Rok", options: years, value: p.rok || DEFAULT_DATE.rok, flex: 1.1 },
  ];
}

export function timeColumns(cas: string): WheelColumn[] {
  const [h, m] = (/^\d{2}:\d{2}$/.test(cas) ? cas : DEFAULT_TIME).split(":");
  return [
    {
      key: "h",
      label: "Hodiny",
      options: Array.from({ length: 24 }, (_, i) => ({ value: pad2(i), label: pad2(i) })),
      value: h,
      valueText: (o) => `${Number(o.value)} hodin`,
    },
    {
      key: "m",
      label: "Minuty",
      options: Array.from({ length: 60 }, (_, i) => ({ value: pad2(i), label: pad2(i) })),
      value: m,
      valueText: (o) => `${Number(o.value)} minut`,
    },
  ];
}

/** Po změně měsíce/roku srovná den, aby nepřetekl (31. 2. → 28./29. 2.; budoucnost → dnes). */
export function clampDate(
  p: { den: string; mesic: string; rok: string },
  today: Date = new Date(),
): { den: string; mesic: string; rok: string } {
  const y = Number(p.rok);
  let m = Number(p.mesic);
  let d = Number(p.den);
  if (y === today.getFullYear() && m > today.getMonth() + 1) m = today.getMonth() + 1;
  let max = daysInMonth(m, y);
  if (y === today.getFullYear() && m === today.getMonth() + 1) max = Math.min(max, today.getDate());
  if (d > max) d = max;
  return { den: pad2(d), mesic: pad2(m), rok: p.rok };
}

export function formatDateLong(p: { den: string; mesic: string; rok: string }): string | null {
  if (!p.den || !p.mesic || p.rok.length !== 4) return null;
  return `${Number(p.den)}. ${MONTHS_GEN[Number(p.mesic) - 1]} ${p.rok}`;
}
