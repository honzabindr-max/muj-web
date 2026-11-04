// Etapa 4, PR 1 (návrh v6 §10.3): parser času resetu limitu z hlášky CLI. Čistá funkce, jen Intl, bez závislostí.
//
// Pravidla §10.3:
// - Relativní čas („try again in 2 hours“) se počítá od `received_at` (konec runProcess), ne od „teď“.
// - Výstup zachová původní offset: { at_utc, at_local, raw_zone, source, evidence_hash }.
// - `CET`/`CEST` platí jen při shodě se skutečným offsetem Europe/Prague v daném okamžiku.
// - DST gap/fold bez offsetu, 12h čas bez AM/PM a výsledek dál než 7 dní (nebo v minulosti) = nedoloženo.
// - FIX1: nerozpoznaný zbytek za časem (zóna „PST“, datum „on Nov 20“, rok, offset) = nedoloženo, nikdy tiché zahození.
// - `system/api_retry` ze stream-json je jen doklad třídy limitu, nikdy čas resetu (jeho řádky se ignorují).
import { createHash } from "node:crypto";

export type ResetSource = "epoch" | "iso" | "relative" | "clock";

export type ResetResult =
  | {
      ok: true;
      /** okamžik resetu v UTC (ISO, Z) */
      at_utc: string;
      /** stejný okamžik s původním offsetem (z textu, nebo zóny, ve které byl čas uveden) */
      at_local: string;
      /** zóna tak, jak stála v textu (např. "Europe/Prague", "CET", "+01:00", "UTC"); null = text zónu neuvedl */
      raw_zone: string | null;
      source: ResetSource;
      /** sha256 hex vstupního textu: doklad, ze kterého čas vznikl */
      evidence_hash: string;
      /** úsek textu, ze kterého čas vznikl (max 120 znaků) */
      matched: string;
    }
  | { ok: false; source: "nedoloženo"; reason: string; evidence_hash: string };

const MAX_AHEAD_MS = 7 * 24 * 3600_000;

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Klíčová slova, za kterými v hlášce stojí čas resetu. */
const KEYWORD_RE = /\b(?:resets?[_ ]?at|resets?|try again|retry|available again)\b(?:\s+(at|in|on|after)\b)?/gi;

const ZONE_SRC = String.raw`\(?\s*([A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?|UTC|GMT|CEST|CET|Z|[+-]\d{2}:?\d{2})\s*\)?`;
const ISO_RE = new RegExp(String.raw`^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(?:${ZONE_SRC})?`, "i");
const MONTH_SRC = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?`;
const DATE_MD_RE = new RegExp(String.raw`^(?:on\s+)?(?:${MONTH_SRC}\s+(\d{1,2})|(\d{1,2})\.?\s+${MONTH_SRC})(?:,?\s+(\d{4}))?,?\s+(?:at\s+)?`, "i");
const CLOCK_RE = new RegExp(String.raw`^(?:at\s+)?(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([ap])\.?\s?m\.?(?![a-z])|^(?:at\s+)?(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?![\d:])`, "i");
const CLOCK_ZONE_RE = new RegExp(String.raw`^\s*${ZONE_SRC}`, "i");
const REL_RE = /^(?:in\s+)?((?:\d+\s*(?:days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b[\s,]*(?:and\s+)?)+)/i;
const REL_PART_RE = /(\d+)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/gi;
const EPOCH_RE = /limit reached\|(\d{10}|\d{13})\b/i;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Offset zóny `tz` v okamžiku `t` v minutách (Praha v zimě = 60). */
function offsetMinutes(tz: string, t: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(t));
  const p: Record<string, number> = {};
  for (const x of parts) if (x.type !== "literal") p[x.type] = Number(x.value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / 60_000);
}

function isIana(tz: string): boolean {
  if (!/^[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(tz) && tz !== "UTC") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Místní kalendářní datum okamžiku `t` v zóně. */
function localDate(z: Zone, t: number): { y: number; mo: number; d: number } {
  const off = z.kind === "iana" ? offsetMinutes(z.tz, t) : z.offset;
  const l = new Date(t + off * 60_000);
  return { y: l.getUTCFullYear(), mo: l.getUTCMonth() + 1, d: l.getUTCDate() };
}

type Zone =
  | { kind: "iana"; tz: string; raw: string | null }
  | { kind: "fixed"; offset: number; raw: string; prague?: boolean };

type Resolved = { ok: true; t: number; offset: number } | { ok: false; reason: string };

/** Zóna z tokenu v textu; undefined token = výchozí zóna. */
function resolveZone(token: string | undefined, defaultTz: string): Zone | string {
  if (!token) return isIana(defaultTz) ? { kind: "iana", tz: defaultTz, raw: null } : `neplatná výchozí zóna ${defaultTz}`;
  const t = token.trim();
  const up = t.toUpperCase();
  if (up === "Z" || up === "UTC" || up === "GMT") return { kind: "fixed", offset: 0, raw: t };
  if (up === "CET") return { kind: "fixed", offset: 60, raw: t, prague: true };
  if (up === "CEST") return { kind: "fixed", offset: 120, raw: t, prague: true };
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(t);
  if (m) {
    const off = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
    if (Math.abs(off) > 14 * 60) return `neplatný offset ${t}`;
    return { kind: "fixed", offset: off, raw: t };
  }
  if (isIana(t)) return { kind: "iana", tz: t, raw: t };
  return `neznámá zóna ${t}`;
}

/** Místní čas → okamžik. IANA: přesně jeden kandidát, jinak DST gap (0) nebo fold (2) = nedoloženo. */
function toInstant(z: Zone, y: number, mo: number, d: number, h: number, mi: number, s: number): Resolved {
  const w = Date.UTC(y, mo - 1, d, h, mi, s);
  const back = new Date(w);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return { ok: false, reason: "neplatné datum" };
  if (z.kind === "fixed") {
    const t = w - z.offset * 60_000;
    if (z.prague && offsetMinutes("Europe/Prague", t) !== z.offset)
      return { ok: false, reason: `${z.raw} neodpovídá skutečnému offsetu Europe/Prague v ${new Date(t).toISOString()}` };
    return { ok: true, t, offset: z.offset };
  }
  const offs = new Set([offsetMinutes(z.tz, w - 86_400_000), offsetMinutes(z.tz, w), offsetMinutes(z.tz, w + 86_400_000)]);
  const cands = [...new Set([...offs].map((o) => w - o * 60_000).filter((t) => offsetMinutes(z.tz, t) === Math.round((w - t) / 60_000)))];
  if (cands.length === 0) return { ok: false, reason: `DST gap: ${pad(h)}:${pad(mi)} v ${z.tz} ${y}-${pad(mo)}-${pad(d)} neexistuje` };
  if (cands.length > 1) return { ok: false, reason: `DST fold: ${pad(h)}:${pad(mi)} v ${z.tz} ${y}-${pad(mo)}-${pad(d)} je dvakrát` };
  const t = cands[0];
  return { ok: true, t, offset: Math.round((w - t) / 60_000) };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatLocal(t: number, offset: number): string {
  const l = new Date(t + offset * 60_000).toISOString().slice(0, 19);
  if (offset === 0) return `${l}Z`;
  const a = Math.abs(offset);
  return `${l}${offset < 0 ? "-" : "+"}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** Hodina z textu: 12h jen s AM/PM, 24h jen když je jednoznačná (13–23, 0, nebo dvoumístná s nulou na začátku). */
function hour24(hRaw: string, ampm: string | undefined, minutes: string | undefined): number | string {
  const h = Number(hRaw);
  if (ampm) {
    if (h < 1 || h > 12) return `neplatná hodina ${hRaw} ${ampm}m`;
    const pm = ampm.toLowerCase() === "p";
    return h === 12 ? (pm ? 12 : 0) : pm ? h + 12 : h;
  }
  if (minutes === undefined) return `čas ${hRaw} bez minut a bez AM/PM`;
  if (h > 23) return `neplatná hodina ${hRaw}`;
  if (h >= 13 || h === 0 || /^0\d$/.test(hRaw)) return h;
  return `12h čas ${hRaw}:${minutes} bez AM/PM`;
}

type Attempt = { ok: true; t: number; offset: number; raw_zone: string | null; source: ResetSource; matched: string } | { ok: false; reason: string } | undefined;

/** Spojky, kterými může hláška CLI za časem pokračovat (jen malá písmena: zkratka zóny jako „PT“ sem nepatří). */
const CONNECTOR_RE = /^(?:or|to|and|if|for|when|then|please|upgrade|you|your|so|but|until)\b/;
/** Za koncem věty/oddělovačem nesmí následovat číslo (den, rok) ani měsíc: to by bylo nezpracované datum. */
const DATEISH_RE = new RegExp(String.raw`^\s*(?:\d|${MONTH_SRC}(?![a-z]))`, "i");

/**
 * FIX1 nález 3: zbytek za rozpoznaným časem (a zónou) musí být konec hlášky, konec věty/oddělovač nebo spojka.
 * Cokoli jiného (neznámá zóna „PST“, datum „on Nov 20, 2026“, rok, offset, závorka) = nedoloženo.
 */
function tailProblem(rest: string): string | undefined {
  const r = rest.replace(/^[ \t]+/, "");
  if (r === "" || /^[\r\n]/.test(r)) return undefined;
  const bad = `nerozpoznaný zbytek za časem: "${r.slice(0, 40)}"`;
  // konec věty, oddělovač, nebo konec JSON řetězce/pole/závorky ("resetsAt":"…Z"})
  if (/^[.;!?·•|—–"'`)\]}]/.test(r)) return DATEISH_RE.test(r.slice(1)) ? bad : undefined;
  if (r.startsWith(",")) {
    const a = r.slice(1).replace(/^\s+/, "");
    return a === "" || CONNECTOR_RE.test(a) ? undefined : bad;
  }
  return CONNECTOR_RE.test(r) ? undefined : bad;
}

function parseTail(tail: string, prep: string | undefined, received: number, defaultTz: string): Attempt {
  const s = tail.replace(/^["'\s:=]+/, "");
  const ep = /^(\d{10}|\d{13})\b/.exec(s);
  if (ep) return epochAttempt(ep[1], ep[0]);
  if (prep?.toLowerCase() === "in" || prep?.toLowerCase() === "after" || /^in\s+\d/i.test(s)) {
    const r = REL_RE.exec(s);
    if (!r) return { ok: false, reason: "relativní čas bez čísla a jednotky" };
    const tp = tailProblem(s.slice(r[0].length));
    if (tp) return { ok: false, reason: tp };
    let ms = 0;
    const unit: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1000 };
    for (const p of r[1].matchAll(REL_PART_RE)) {
      const u = p[2].toLowerCase();
      const k = u.startsWith("d") ? "d" : u.startsWith("h") ? "h" : u.startsWith("m") ? "m" : "s";
      ms += Number(p[1]) * unit[k];
    }
    if (ms <= 0) return { ok: false, reason: "relativní čas 0" };
    const z = resolveZone(undefined, defaultTz);
    const t = received + ms;
    const offset = typeof z === "string" ? 0 : z.kind === "iana" ? offsetMinutes(z.tz, t) : z.offset;
    return { ok: true, t, offset, raw_zone: null, source: "relative", matched: r[0].trim() };
  }
  const iso = ISO_RE.exec(s);
  if (iso) {
    const z = resolveZone(iso[7], defaultTz);
    if (typeof z === "string") return { ok: false, reason: z };
    const tp = tailProblem(s.slice(iso[0].length));
    if (tp) return { ok: false, reason: tp };
    const r = toInstant(z, +iso[1], +iso[2], +iso[3], +iso[4], +iso[5], +(iso[6] ?? 0));
    if (!r.ok) return r;
    return { ok: true, t: r.t, offset: r.offset, raw_zone: z.raw, source: "iso", matched: iso[0].trim() };
  }
  let rest = s;
  let date: { y?: number; mo: number; d: number } | undefined;
  const md = DATE_MD_RE.exec(rest);
  if (md) {
    const mon = MONTHS[(md[1] ?? md[4]).slice(0, 3).toLowerCase()];
    date = { mo: mon, d: Number(md[2] ?? md[3]), y: md[5] ? Number(md[5]) : undefined };
    rest = rest.slice(md[0].length);
  }
  const c = CLOCK_RE.exec(rest);
  if (!c) return date ? { ok: false, reason: "datum bez času" } : undefined;
  const hRaw = c[1] ?? c[5];
  const mRaw = c[2] ?? c[6];
  const sRaw = c[3] ?? c[7];
  const h = hour24(hRaw, c[4], mRaw);
  if (typeof h === "string") return { ok: false, reason: h };
  const mi = Number(mRaw ?? 0);
  if (mi > 59) return { ok: false, reason: `neplatné minuty ${mRaw}` };
  const after = rest.slice(c[0].length);
  const zm = CLOCK_ZONE_RE.exec(after);
  const z = resolveZone(zm?.[1], defaultTz);
  if (typeof z === "string") return { ok: false, reason: z };
  const tp = tailProblem(after.slice(zm?.[0].length ?? 0));
  if (tp) return { ok: false, reason: tp };
  const matched = `${md?.[0] ?? ""}${c[0]}${zm?.[0] ?? ""}`.trim();
  if (date) {
    const y = date.y ?? localDate(z, received).y;
    const r = toInstant(z, y, date.mo, date.d, h, mi, Number(sRaw ?? 0));
    if (!r.ok) return r;
    return { ok: true, t: r.t, offset: r.offset, raw_zone: z.raw, source: "clock", matched };
  }
  // Jen čas dne: nejbližší výskyt po received_at (dnes, jinak zítra), v zóně z textu nebo ve výchozí.
  let day = localDate(z, received);
  for (let i = 0; i < 2; i++) {
    const r = toInstant(z, day.y, day.mo, day.d, h, mi, Number(sRaw ?? 0));
    if (!r.ok) return r;
    if (r.t > received) return { ok: true, t: r.t, offset: r.offset, raw_zone: z.raw, source: "clock", matched };
    const next = new Date(Date.UTC(day.y, day.mo - 1, day.d + 1));
    day = { y: next.getUTCFullYear(), mo: next.getUTCMonth() + 1, d: next.getUTCDate() };
  }
  return { ok: false, reason: "čas dne nelze umístit po received_at" };
}

function epochAttempt(digits: string, matched: string): Attempt {
  const n = Number(digits);
  const t = digits.length === 13 ? n : n * 1000;
  return { ok: true, t, offset: 0, raw_zone: "UTC", source: "epoch", matched };
}

/**
 * Čas resetu limitu z hlášky CLI (§10.3). `received_at` = ISO okamžik, kdy byla hláška přijata (konec runProcess);
 * `defaultTz` = IANA zóna pro čas bez zóny. Cokoli nejistého vrací `{ ok: false, source: "nedoloženo" }`.
 */
export function parseReset(text: string, received_at: string, defaultTz: string): ResetResult {
  const evidence_hash = sha256(text);
  const fail = (reason: string): ResetResult => ({ ok: false, source: "nedoloženo", reason, evidence_hash });
  const received = Date.parse(received_at);
  if (!Number.isFinite(received)) return fail(`neplatný received_at ${received_at}`);
  // system/api_retry je jen doklad třídy limitu (§10.3), čas z něj nikdy nebereme.
  const body = text
    .split("\n")
    .filter((l) => !/"subtype"\s*:\s*"api_retry"/.test(l))
    .join("\n");
  let attempt: Attempt = undefined;
  const ep = EPOCH_RE.exec(body);
  if (ep) attempt = epochAttempt(ep[1], ep[0]);
  let firstFail: string | undefined;
  if (!attempt) {
    for (const k of body.matchAll(KEYWORD_RE)) {
      const tail = body.slice(k.index! + k[0].length, k.index! + k[0].length + 80);
      const a = parseTail(tail, k[1], received, defaultTz);
      if (!a) continue;
      if (a.ok) {
        attempt = a;
        break;
      }
      firstFail ??= a.reason;
    }
  }
  if (!attempt) return fail(firstFail ?? "hláška neobsahuje čas resetu");
  if (!attempt.ok) return fail(attempt.reason);
  if (attempt.t <= received) return fail(`reset ${new Date(attempt.t).toISOString()} není po received_at`);
  if (attempt.t - received > MAX_AHEAD_MS) return fail(`reset ${new Date(attempt.t).toISOString()} je dál než 7 dní`);
  return {
    ok: true,
    at_utc: new Date(attempt.t).toISOString(),
    at_local: formatLocal(attempt.t, attempt.offset),
    raw_zone: attempt.raw_zone,
    source: attempt.source,
    evidence_hash,
    matched: attempt.matched.slice(0, 120),
  };
}

/**
 * Q4-B: doložené varování CLI o blížícím se limitu (ne limit sám). FIX1 nález 2: původ musí být ověřitelný.
 * Platí jen řádek stderr, který hláškou CLI ZAČÍNÁ (volitelně symbol ⚠/•/! a „Warning:“/„Heads up,“), je krátký
 * (≤ 300 znaků) a není obsažen v promptu ani v textu modelu (`exclude`). Citace uvnitř věty a přepis promptu nebo
 * odpovědi modelu proto varováním nejsou. Adaptér smí předat jen stderr CLI, které prompt ani průběh modelu nevypisuje
 * (claude -p); u CLI, které je vypisuje (codex exec, ai-chain), se varování nebere vůbec.
 * Vrací řádek varování (max 300 znaků), nebo undefined.
 */
const WARN_CORE = String.raw`(?:approaching (?:your |the )?(?:\S+ )?(?:usage |session |weekly )?limit|close to (?:your |the )?(?:\S+ )?(?:usage )?limit|(?:you'?ve |you have )?used (?:over |more than )?\d{2,3}\s?% of (?:your |the )?(?:\S+ )?(?:usage |session |weekly )?limit)`;
const WARN_LINE_RE = new RegExp(String.raw`^(?:[⚠⚡!*•·>-]\uFE0F?\s*)*(?:(?:warning|heads up|note)\s*[:,!]?\s*)?${WARN_CORE}`, "i");
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

export function limitWarning(cliStderr: string, exclude: string[] = []): string | undefined {
  const quoted = exclude.map((e) => e.replace(ANSI_RE, ""));
  for (const raw of cliStderr.split("\n")) {
    const line = raw.replace(ANSI_RE, "").trim();
    if (!line || line.length > 300) continue;
    if (quoted.some((e) => e.includes(line))) continue; // přepis promptu nebo textu modelu
    if (WARN_LINE_RE.test(line)) return line;
  }
  return undefined;
}
