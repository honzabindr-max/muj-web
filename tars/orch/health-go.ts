// Etapa 5, PR 2b: GO → takeover latency in the health projection. Read only.
//
// Source: runs/idle/go-latency.jsonl. The existing writer is IdleRecorder.goLatency (idle.ts, DR-033): one line per
// owner decision taken over from the panel, `{order, value, owner_written_at?, taken_at, latency_ms|null}`, where
// latency = taken_at − last_edited_time of the panel row. This module only reads that file; nothing new is written.
//
// Missing data is never 0:
//   no file                          → NOT_INSTRUMENTED (no decision taken yet by a version that writes it)
//   file unreadable                  → UNKNOWN
//   lines, but no measured latency   → UNKNOWN (latency_ms null = owner write time missing, or corrupted lines)
//   at least one measured latency    → MEASURED
// The latency is an information metric. It does not change `overall` (no blocker, no PASS), it only shows up.
import fs from "node:fs";
import path from "node:path";

import { redactSecretsUnbounded } from "./secret-scan";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const time = (v: unknown): number =>
  typeof v === "string" ? Date.parse(v) : NaN;
const ORDER_ID_RE = /^wo-[A-Za-z0-9_-]{1,100}$/;
const orderId = (v: unknown): string =>
  typeof v === "string" && ORDER_ID_RE.test(v)
    ? redactSecretsUnbounded(v)
    : "<neplatné id>";
/** Decision values the panel poll takes over (P20); anything else goes out as "?". */
const KNOWN_VALUES = new Set(["GO", "GO A", "GO B", "REJECT"]);

/** One parsed line of go-latency.jsonl with bounded fields (the raw line is never echoed). */
export interface GoLatencyLine {
  order?: string;
  value?: string;
  taken_at?: string;
  /** null = the writer did not know the owner write time; undefined = field missing or not a number */
  latency_ms?: number | null;
}

export interface GoLatencySnapshot {
  /** false = runs/idle/go-latency.jsonl does not exist */
  present: boolean;
  readable?: boolean;
  lines?: GoLatencyLine[];
  /** lines that are not JSON objects */
  bad_lines?: number;
}

export function collectGoLatency(runsDir: string): GoLatencySnapshot {
  const f = path.join(runsDir, "idle", "go-latency.jsonl");
  let raw: string;
  try {
    raw = fs.readFileSync(f, "utf8");
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "ENOENT"
      ? { present: false }
      : { present: true, readable: false };
  }
  const lines: GoLatencyLine[] = [];
  let bad = 0;
  for (const l of raw.split("\n").filter((x) => x.trim())) {
    let v: unknown;
    try {
      v = JSON.parse(l);
    } catch {
      bad++;
      continue;
    }
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      bad++;
      continue;
    }
    const e = v as Obj;
    lines.push({
      order: typeof e.order === "string" ? e.order : undefined,
      value: typeof e.value === "string" ? e.value : undefined,
      taken_at: typeof e.taken_at === "string" ? e.taken_at : undefined,
      latency_ms:
        e.latency_ms === null
          ? null
          : typeof e.latency_ms === "number"
            ? e.latency_ms
            : undefined,
    });
  }
  return { present: true, readable: true, lines, bad_lines: bad };
}

export type GoLatencyStatus =
  | "MEASURED"
  | "NOT_INSTRUMENTED"
  | "UNKNOWN"
  | "NOT_MEASURED";

export interface GoLatencyReport {
  status: GoLatencyStatus;
  source: string;
  reason: string;
  /** decisions taken over (valid lines, not in the future) */
  decisions: number;
  /** of those with a measured latency */
  measured: number;
  /** of those without a known owner write time (latency_ms null): never counted as 0 */
  unknownLatency: number;
  /** corrupted lines, invalid latency (negative, not a number) or invalid time */
  invalid: number;
  futureIgnored: number;
  /** the newest measured takeover (write order) */
  last: { order: string; value: string; at: string; ms: number } | null;
  medianMs: number | null;
  maxMs: number | null;
  since: string | null;
}

const SOURCE = "runs/idle/go-latency.jsonl";

export function projectGoLatency(input: unknown, now: number): GoLatencyReport {
  const empty = {
    source: SOURCE,
    decisions: 0,
    measured: 0,
    unknownLatency: 0,
    invalid: 0,
    futureIgnored: 0,
    last: null,
    medianMs: null,
    maxMs: null,
    since: null,
  };
  if (input === undefined)
    return {
      ...empty,
      status: "NOT_MEASURED",
      reason: "zdroj nečten (runs/ nečitelný)",
    };
  const s = obj(input);
  if (s.present !== true)
    return {
      ...empty,
      status: "NOT_INSTRUMENTED",
      reason:
        "soubor neexistuje: žádné rozhodnutí zatím nepřevzala verze, která latenci zapisuje",
    };
  if (s.readable !== true)
    return { ...empty, status: "UNKNOWN", reason: "soubor nečitelný" };

  const lines = Array.isArray(s.lines) ? s.lines.map(obj) : [];
  let invalid = typeof s.bad_lines === "number" ? s.bad_lines : 0;
  let futureIgnored = 0,
    unknownLatency = 0,
    decisions = 0;
  let first: number | undefined;
  let last: GoLatencyReport["last"] = null;
  const ms: number[] = [];
  for (const e of lines) {
    const t = time(e.taken_at);
    if (!Number.isFinite(t)) {
      invalid++;
      continue;
    }
    if (t > now) {
      futureIgnored++;
      continue;
    }
    if (e.latency_ms === null) {
      decisions++;
      unknownLatency++;
      first = first === undefined ? t : Math.min(first, t);
      continue;
    }
    const l = e.latency_ms;
    if (typeof l !== "number" || !Number.isFinite(l) || l < 0) {
      invalid++; // negative = owner write time after takeover (clock moved): not a latency
      continue;
    }
    decisions++;
    first = first === undefined ? t : Math.min(first, t);
    ms.push(l);
    last = {
      order: orderId(e.order),
      value:
        typeof e.value === "string" && KNOWN_VALUES.has(e.value)
          ? e.value
          : "?",
      at: new Date(t).toISOString(),
      ms: l,
    };
  }
  const sorted = [...ms].sort((a, b) => a - b);
  const median =
    sorted.length === 0
      ? null
      : sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const base = {
    source: SOURCE,
    decisions,
    measured: ms.length,
    unknownLatency,
    invalid,
    futureIgnored,
    last,
    medianMs: median,
    maxMs: sorted.length ? sorted[sorted.length - 1] : null,
    since: first === undefined ? null : new Date(first).toISOString(),
  };
  if (ms.length > 0)
    return {
      ...base,
      status: "MEASURED",
      reason:
        invalid || unknownLatency
          ? `změřeno ${ms.length} z ${decisions + invalid} záznamů (bez času zápisu vlastníka ${unknownLatency}, neplatných ${invalid})`
          : `změřeno ${ms.length} převzetí`,
    };
  if (lines.length === 0 && invalid === 0)
    return {
      ...base,
      status: "NOT_INSTRUMENTED",
      reason: "soubor je prázdný: žádné převzaté rozhodnutí",
    };
  return {
    ...base,
    status: "UNKNOWN",
    reason:
      futureIgnored && decisions === 0 && invalid === 0
        ? "jen záznamy z budoucnosti (posun hodin)"
        : `žádná změřená latence (bez času zápisu vlastníka ${unknownLatency}, neplatných ${invalid})`,
  };
}
