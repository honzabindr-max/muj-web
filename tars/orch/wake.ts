// Etapa 4 PR 2 (NAVRH-v6 §10.2): životní cyklus `runs/next-wake` a výsledek ticku pro minutovou bránu
// `tars/orch/launchd/wake-gate.sh`.
//
// - `runs/next-wake` zapisuje jen tick, který drží lease (`reconcileNextWake` ve `finally` ticku). Brána ho jen čte.
// - Nic se nemaže: zkonzumovaný soubor se přejmenuje do `runs/wake/consumed/`, nahrazený do `runs/wake/superseded/`.
// - `runs/wake/outcomes/<gate_start>` zapisuje cli.ts po návratu `tick()` jednou (existuje = nic). Lease nepotřebuje,
//   protože se nedotýká `next-wake`, stavu zakázek ani journalu.
import fs from "node:fs";
import path from "node:path";

import { mkdirDurable, writeDurable } from "./store";
import type { Order } from "./types";

/** Backoff přeplánování a re-entry v sekundách: 1, 2, 5, 10, 30 min, dál 30 min (§10.2 body 3 a 4). */
export const WAKE_BACKOFF_S = [60, 120, 300, 600, 1800] as const;

export function backoffS(attempt: number): number {
  const i = Math.max(
    0,
    Math.min(Math.floor(attempt), WAKE_BACKOFF_S.length - 1),
  );
  return WAKE_BACKOFF_S[i];
}

/** Obsah `runs/next-wake`. `epoch` je první klíč a celé číslo v sekundách: brána ho čte bez parseru JSON. */
export interface NextWake {
  epoch: number;
  order_id: string;
  state_version: number;
  resume_after: string;
  written_fence: number | null;
  attempt: number;
}

export type WakeAction =
  | "none"
  | "written"
  | "kept"
  | "rescheduled"
  | "consumed"
  | "superseded";

export interface WakeReconcile {
  action: WakeAction;
  /** Platný `next-wake` po této funkci (undefined = soubor neexistuje). */
  next?: NextWake;
  /** Proč byl předchozí soubor zkonzumován nebo nahrazen. */
  reason?: string;
}

export function nextWakePath(runsDir: string): string {
  return path.join(runsDir, "next-wake");
}

export function wakeDir(runsDir: string): string {
  return path.join(runsDir, "wake");
}

/** Kanonický zápis: jeden řádek, `epoch` první (wake-gate.sh čte `{"epoch":<číslice>`). */
export function formatNextWake(nw: NextWake): string {
  return `${JSON.stringify({
    epoch: nw.epoch,
    order_id: nw.order_id,
    state_version: nw.state_version,
    resume_after: nw.resume_after,
    written_fence: nw.written_fence,
    attempt: nw.attempt,
  })}\n`;
}

/**
 * FIX1 nález 2: `order_id` jde do jména souboru v archivu, takže jen bezpečný název (bez `/`, `.` a `..`).
 * Stejný tvar jako ORDER_ID_RE v audit-health.ts. Jiný tvar = nečitelný next-wake (`invalid`).
 */
export const SAFE_ORDER_ID_RE = /^wo-[A-Za-z0-9_-]{1,100}$/;

export function parseNextWake(text: string): NextWake | undefined {
  try {
    const j = JSON.parse(text) as Partial<NextWake>;
    if (
      !j ||
      typeof j !== "object" ||
      !Number.isInteger(j.epoch) ||
      (j.epoch as number) < 0 ||
      typeof j.order_id !== "string" ||
      !SAFE_ORDER_ID_RE.test(j.order_id) ||
      !Number.isInteger(j.state_version) ||
      typeof j.resume_after !== "string" ||
      Number.isNaN(Date.parse(j.resume_after)) ||
      !Number.isInteger(j.attempt) ||
      (j.attempt as number) < 0 ||
      !(j.written_fence === null || Number.isInteger(j.written_fence))
    )
      return undefined;
    return j as NextWake;
  } catch {
    return undefined;
  }
}

/** Zakázka čeká na čas obnovy (§10.2 bod 3): `PAUSED`/`WAITING_REVIEW` s čitelným `resume_after`. */
function waitsForTime(o: Order): boolean {
  return (
    (o.state === "PAUSED" || o.state === "WAITING_REVIEW") &&
    typeof o.resume_after === "string" &&
    !Number.isNaN(Date.parse(o.resume_after))
  );
}

/** Odvození ze stavu: nejmenší `resume_after` ze všech čekajících zakázek, `epoch = max(resume_after, now)`. */
export function deriveNextWake(
  orders: Order[],
  now: Date,
  fence: number | undefined,
): NextWake | undefined {
  const nowS = Math.floor(now.getTime() / 1000);
  const waiting = orders
    .filter((o) => waitsForTime(o) && SAFE_ORDER_ID_RE.test(o.id))
    .sort(
      (a, b) =>
        Date.parse(a.resume_after!) - Date.parse(b.resume_after!) ||
        a.id.localeCompare(b.id),
    );
  const o = waiting[0];
  if (!o) return undefined;
  return {
    epoch: Math.max(Math.ceil(Date.parse(o.resume_after!) / 1000), nowS),
    order_id: o.id,
    state_version: o.version ?? 0,
    resume_after: o.resume_after!,
    written_fence: fence ?? null,
    attempt: 0,
  };
}

/**
 * Doložené převzetí: zakázka má na disku vyšší verzi než při zápisu a už nečeká se stejným `resume_after`.
 */
function takenOver(o: Order, nw: NextWake): boolean {
  if ((o.version ?? 0) <= nw.state_version) return false;
  return !(waitsForTime(o) && o.resume_after === nw.resume_after);
}

function fsyncDir(dir: string): void {
  const fd = fs.openSync(dir, "r");
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/** Volné jméno v `dir`: `<base>.json`, jinak `<base>-2.json`, … (nic se nepřepíše). */
function freeName(dir: string, base: string, ext: string): string {
  for (let i = 1; ; i++) {
    const f = path.join(dir, i === 1 ? `${base}${ext}` : `${base}-${i}${ext}`);
    if (!fs.existsSync(f)) return f;
  }
}

/** Přejmenuje `runs/next-wake` do archivu a doplní k němu záznam (rename, pak trvalý zápis doplněného obsahu). */
function archive(
  runsDir: string,
  sub: "consumed" | "superseded",
  raw: string,
  nw: NextWake | undefined,
  extra: Record<string, unknown>,
  nowS: number,
): void {
  const dir = path.join(wakeDir(runsDir), sub);
  mkdirDurable(dir);
  const safe = nw !== undefined && SAFE_ORDER_ID_RE.test(nw.order_id);
  const base = safe
    ? `${nw.epoch}-${nw.order_id}${sub === "superseded" ? `-${nowS}` : ""}`
    : `${nowS}-invalid`;
  const dst = freeName(dir, base, ".json");
  // Druhá pojistka: cíl musí ležet přímo v archivu, jinak se nepřejmenuje nic.
  if (path.dirname(path.resolve(dst)) !== path.resolve(dir))
    throw new Error(`next-wake: cíl archivu mimo ${sub}/ (${dst})`);
  fs.renameSync(nextWakePath(runsDir), dst);
  fsyncDir(runsDir);
  const body = nw
    ? { ...nw, ...extra }
    : { invalid_raw: raw.slice(0, 2000), ...extra };
  writeDurable(dst, `${JSON.stringify(body, null, 2)}\n`);
}

/**
 * §10.2 bod 3: na konci každého plného ticku, který získal lease, ve `finally` pod tímto lease (volající to zaručí).
 *  1. Doložené převzetí, chybějící zakázka (`orphan`) nebo nečitelný soubor (`invalid`) → zkonzumovat a odvodit znovu.
 *  2. Probuzení platí (`epoch ≤ now`), ale zakázka převzatá není a pořád čeká s `resume_after ≤ now` (neúspěch pod
 *     lease) → nový soubor s `epoch = now + backoff(attempt)`, `attempt + 1`, starý do `superseded/`.
 *  3. Probuzení ještě neplatí: shodný cíl (zakázka a `resume_after`) se ponechá, jiný se nahradí odvozeným.
 *  4. Bez souboru: odvodit ze stavu. Žádná čekající zakázka → soubor neexistuje.
 */
export function reconcileNextWake(
  runsDir: string,
  orders: Order[],
  now: Date,
  fence: number | undefined,
): WakeReconcile {
  const nowS = Math.floor(now.getTime() / 1000);
  const file = nextWakePath(runsDir);
  const at = now.toISOString();
  const derived = deriveNextWake(orders, now, fence);
  let raw: string | undefined;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  let consumedReason: string | undefined;
  if (raw !== undefined) {
    const nw = parseNextWake(raw);
    const consume = (reason: string, newState?: string) => {
      archive(
        runsDir,
        "consumed",
        raw!,
        nw,
        {
          consumed_at: at,
          consumed_fence: fence ?? null,
          new_state: newState ?? null,
          reason,
        },
        nowS,
      );
      consumedReason = reason;
    };
    const o = nw ? orders.find((x) => x.id === nw.order_id) : undefined;
    if (!nw) consume("invalid");
    else if (!o) consume("orphan");
    else if (takenOver(o, nw)) consume("taken_over", o.state);
    else if (nw.epoch <= nowS) {
      if (waitsForTime(o) && Date.parse(o.resume_after!) <= now.getTime()) {
        const next: NextWake = {
          epoch: Math.max(
            nowS + backoffS(nw.attempt),
            Math.ceil(Date.parse(o.resume_after!) / 1000),
          ),
          order_id: o.id,
          state_version: o.version ?? 0,
          resume_after: o.resume_after!,
          written_fence: fence ?? null,
          attempt: nw.attempt + 1,
        };
        archive(
          runsDir,
          "superseded",
          raw,
          nw,
          {
            superseded_at: at,
            superseded_fence: fence ?? null,
            reason: "not_taken_over",
          },
          nowS,
        );
        writeDurable(file, formatNextWake(next));
        return { action: "rescheduled", next, reason: "not_taken_over" };
      }
      consume("stale", o.state);
    } else if (
      derived &&
      derived.order_id === nw.order_id &&
      derived.resume_after === nw.resume_after
    ) {
      return { action: "kept", next: nw };
    } else if (derived) {
      archive(
        runsDir,
        "superseded",
        raw,
        nw,
        {
          superseded_at: at,
          superseded_fence: fence ?? null,
          reason: "rederived",
        },
        nowS,
      );
      writeDurable(file, formatNextWake(derived));
      return { action: "superseded", next: derived, reason: "rederived" };
    } else consume("no_waiting_order", o.state);
  }
  if (!derived)
    return consumedReason
      ? { action: "consumed", reason: consumedReason }
      : { action: "none" };
  writeDurable(file, formatNextWake(derived));
  return { action: "written", next: derived, reason: consumedReason };
}

/** Výsledek ticku pro bránu: první řádek souboru `runs/wake/outcomes/<gate_start>`. */
export type GateOutcome =
  | "ran"
  | "locked"
  | "guard_alarm"
  | "no_supervisor_card";

export function gateOutcomeFor(status: string): GateOutcome {
  if (status === "locked") return "locked";
  if (status === "guard_alarm") return "guard_alarm";
  if (status === "no_supervisor_card") return "no_supervisor_card";
  return "ran";
}

/** `TARS_GATE_START` z brány: jen epocha v sekundách (číslice, nejvýš 12). Jinak undefined (nic se nezapíše). */
export function parseGateStart(v: string | undefined): string | undefined {
  return v && /^[0-9]{1,12}$/.test(v) ? v : undefined;
}

/**
 * §10.2 bod 4: zapíše jednou `runs/wake/outcomes/<gate_start>` (existuje = nic, vrací false). Volá cli.ts po návratu
 * `tick()`, tedy u ticku s lease až po jeho `finally`.
 */
export function writeGateOutcome(
  runsDir: string,
  gateStart: string,
  status: string,
  now: Date = new Date(),
): boolean {
  const gs = parseGateStart(gateStart);
  if (!gs) return false;
  const dir = path.join(wakeDir(runsDir), "outcomes");
  mkdirDurable(dir);
  const f = path.join(dir, gs);
  if (fs.existsSync(f)) return false;
  writeDurable(
    f,
    `${gateOutcomeFor(status)}\n${status}\n${now.toISOString()}\n`,
  );
  return true;
}
