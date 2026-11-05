// Etapa 4, PR 4a (NAVRH-v6 §7, §8): pokusy o krok a procesní reconciler.
//
// Každé spuštění kroku modelu (create / check / revise) má trvalý záznam runs/<wo>/attempts/<krok>-a<n>.json
// (writeDurable), jehož stav jde jen dopředu:
//   INTENT → STARTED → FINISHED | ABANDONED | HOLD      (HOLD → ABANDONED, když se konec později prokáže)
// INTENT se zapíše před spawn, STARTED hned po spawn (pid, pgid, lstart), FINISHED až po trvalém uložení výstupu.
// Opakování kroku (nový pokus stejného kroku) kód pustí jen tehdy, když předchozí pokus nese záznam reconcile
// (RESUME | RETRY_SAFE | UNKNOWN, §8). Bez záznamu = throw. Nic se nemaže.
//
// Procesy: dítě běží `detached` (vedoucí vlastní skupiny, pgid = pid), kill jde na -pgid a nikdy při pid/pgid ≤ 1.
// Dítě i jeho potomci dědí TARS_ATTEMPT_ID. Doloženo na macOS (Darwin 25.6, 2026-11-04): `ps -E` ukáže env jen u
// procesů, které nejsou systémové (node, claude, codex ano; /bin/bash, /bin/sleep ne). Env proto slouží jen jako
// doplňkový důkaz; konec skupiny se dokládá přes pgid + lstart vedoucího procesu (POSIX: PID se nerecykluje, dokud
// existuje skupina s tímto ID). Co doložit nejde, je HOLD.
import { AsyncLocalStorage } from "node:async_hooks";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { RemoteSnapshot } from "./remote-snapshot";
import { writeDurable } from "./store";

export type AttemptPhase =
  | "INTENT"
  | "STARTED"
  | "FINISHED"
  | "ABANDONED"
  | "HOLD";

/** §8: výsledek reconcile před opakováním kroku. */
export type RetryDecision = "RESUME" | "RETRY_SAFE" | "UNKNOWN";

export interface AttemptChild {
  pid: number;
  /** = pid: dítě je vedoucí vlastní skupiny (`detached`). */
  pgid: number;
  /** `ps -o lstart=` dítěte, mezery sjednocené; "" = nešlo přečíst. */
  lstart: string;
  cmd: string;
  at: string;
}

export interface AttemptRecord {
  v: 1;
  /** `<wo>/<krok>/a<n>`, předává se dítěti jako TARS_ATTEMPT_ID. */
  attempt_id: string;
  order: string;
  /** např. `create-r0`, `check-r1`, `check-r1-c0` (část review dev) */
  step: string;
  attempt: number;
  phase: AttemptPhase;
  fence?: number;
  input_sha256: string;
  /** relativně k adresáři zakázky */
  output_path: string;
  deadline: string;
  /** §7: kontrola rozhodnutí před INTENT. Do PR 5 jen legacy `wo-*` bez scope receiptu. */
  decision_check: string;
  intent_at: string;
  /** první spuštěný proces (vedoucí skupiny) */
  started?: AttemptChild;
  /** všechny procesy spuštěné pod tímto pokusem (víc volání modelu v jednom kroku) */
  children?: AttemptChild[];
  finished?: {
    exit: number | null;
    ok: boolean;
    output_sha256: string;
    at: string;
  };
  abandoned?: { reason: string; kill_evidence: string; at: string };
  hold?: { reason: string; at: string };
  /**
   * FIX2 nález 1: skupiny (pgid), jejichž zánik je doložen (žádný člen a vedoucí chybí nebo má jiný lstart). Takový
   * pgid se už nikdy nesignalizuje, i kdyby v něm později něco běželo (recyklace ID).
   */
  groups_ended?: number[];
  /** §8: zapíše se jednou, před dalším pokusem stejného kroku. */
  reconcile?: { result: RetryDecision; reason: string; at: string };
  /** PR 4b (§8.2): snímek vzdálených zápisů před INTENT (jen kroky s možným vzdáleným zápisem, dev create/revise). */
  remote_before?: RemoteSnapshot;
  /** PR 4b (§8.2): snímek po konci dítěte (FINISHED nebo ABANDONED); zapíše se jen jednou. */
  remote_after?: RemoteSnapshot;
  updated_at: string;
}

export class AttemptError extends Error {}

/** §8: opakování kroku bez záznamu reconcile, nebo reconcile odmítnutý adaptérem (dev do PR 4b). Fail-closed. */
export class RetryRefusedError extends AttemptError {}

/**
 * FIX1 nález 1: proces pokusu skončil, ale konec jeho skupiny procesů nejde doložit (člen bez doložené identity,
 * ps selhal, po SIGKILL stále běží, stdout drží proces mimo skupinu). Pokus jde do HOLD, ne do FINISHED.
 */
export class GroupNotEndedError extends AttemptError {}

const SAFE = /^[A-Za-z0-9._-]+$/;

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

const NEXT: Record<AttemptPhase, readonly AttemptPhase[]> = {
  INTENT: ["STARTED", "ABANDONED", "HOLD"],
  STARTED: ["STARTED", "FINISHED", "ABANDONED", "HOLD"],
  HOLD: ["HOLD", "ABANDONED"],
  FINISHED: [],
  ABANDONED: [],
};

export function isTerminalAttempt(r: AttemptRecord): boolean {
  return r.phase === "FINISHED" || r.phase === "ABANDONED";
}

export class AttemptJournal {
  constructor(
    private runsDir: string,
    private now: () => string = () => new Date().toISOString(),
  ) {}

  dir(order: string): string {
    if (!SAFE.test(order))
      throw new AttemptError(`neplatné ID zakázky: ${order}`);
    return path.join(this.runsDir, order, "attempts");
  }

  private file(order: string, step: string, n: number): string {
    if (!SAFE.test(step)) throw new AttemptError(`neplatný krok: ${step}`);
    return path.join(this.dir(order), `${step}-a${n}.json`);
  }

  static parseId(id: string): { order: string; step: string; attempt: number } {
    const m = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/a(\d+)$/.exec(id);
    if (!m) throw new AttemptError(`neplatné attempt_id: ${id}`);
    return { order: m[1], step: m[2], attempt: Number(m[3]) };
  }

  get(id: string): AttemptRecord | undefined {
    const { order, step, attempt } = AttemptJournal.parseId(id);
    const f = this.file(order, step, attempt);
    if (!fs.existsSync(f)) return undefined;
    return JSON.parse(fs.readFileSync(f, "utf8")) as AttemptRecord;
  }

  /** Všechny pokusy zakázky (volitelně jen jednoho kroku), seřazené podle kroku a čísla pokusu. */
  list(order: string, step?: string): AttemptRecord[] {
    const d = this.dir(order);
    if (!fs.existsSync(d)) return [];
    return fs
      .readdirSync(d)
      .filter((f) => /-a\d+\.json$/.test(f))
      .map(
        (f) =>
          JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) as AttemptRecord,
      )
      .filter((r) => step === undefined || r.step === step)
      .sort((a, b) =>
        a.step === b.step ? a.attempt - b.attempt : a.step < b.step ? -1 : 1,
      );
  }

  latest(order: string, step: string): AttemptRecord | undefined {
    return this.list(order, step).at(-1);
  }

  private write(r: AttemptRecord): AttemptRecord {
    const f = this.file(r.order, r.step, r.attempt);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    writeDurable(f, JSON.stringify(r, null, 2) + "\n");
    return r;
  }

  private move(
    id: string,
    to: AttemptPhase,
    patch: Partial<AttemptRecord>,
  ): AttemptRecord {
    const prev = this.get(id);
    if (!prev) throw new AttemptError(`pokus ${id} nemá záznam`);
    if (!NEXT[prev.phase].includes(to))
      throw new AttemptError(
        `pokus ${id}: přechod ${prev.phase} → ${to} není povolen`,
      );
    return this.write({ ...prev, ...patch, phase: to, updated_at: this.now() });
  }

  /**
   * INTENT nového pokusu (před spawn). Předchozí pokus stejného kroku musí být ukončený (FINISHED / ABANDONED)
   * a nést záznam reconcile s výsledkem RESUME nebo RETRY_SAFE; jinak throw (§8, fail-closed).
   */
  intent(
    order: string,
    step: string,
    x: {
      input_sha256: string;
      deadline: string;
      decision_check: string;
      fence?: number;
      output_path?: string;
      remote_before?: RemoteSnapshot;
    },
  ): AttemptRecord {
    const prev = this.latest(order, step);
    if (prev) {
      if (!isTerminalAttempt(prev))
        throw new AttemptError(
          `pokus ${prev.attempt_id} je ve stavu ${prev.phase}, nový pokus zakázán`,
        );
      if (!prev.reconcile)
        throw new RetryRefusedError(
          `opakování kroku ${order}/${step} bez záznamu reconcile u ${prev.attempt_id}`,
        );
      if (prev.reconcile.result === "UNKNOWN")
        throw new RetryRefusedError(
          `opakování kroku ${order}/${step}: reconcile ${prev.attempt_id} = UNKNOWN`,
        );
    }
    const n = (prev?.attempt ?? 0) + 1;
    const at = this.now();
    const attempt_id = `${order}/${step}/a${n}`;
    if (fs.existsSync(this.file(order, step, n)))
      throw new AttemptError(`pokus ${attempt_id} už existuje`);
    return this.write({
      v: 1,
      attempt_id,
      order,
      step,
      attempt: n,
      phase: "INTENT",
      ...(x.fence !== undefined ? { fence: x.fence } : {}),
      input_sha256: x.input_sha256,
      output_path: x.output_path ?? `attempts/${step}-a${n}.out.json`,
      deadline: x.deadline,
      decision_check: x.decision_check,
      intent_at: at,
      ...(x.remote_before ? { remote_before: x.remote_before } : {}),
      updated_at: at,
    });
  }

  /** PR 4b (§8.2): snímek po konci dítěte. Jen u pokusu se snímkem před, jen jednou, bez změny fáze. */
  setRemoteAfter(id: string, snap: RemoteSnapshot): AttemptRecord {
    const prev = this.get(id);
    if (!prev) throw new AttemptError(`pokus ${id} nemá záznam`);
    if (!prev.remote_before) throw new AttemptError(`pokus ${id} nemá snímek před (§8.2)`);
    if (prev.remote_after) return prev;
    return this.write({ ...prev, remote_after: snap, updated_at: this.now() });
  }

  started(id: string, child: AttemptChild): AttemptRecord {
    const prev = this.get(id);
    const children = [...(prev?.children ?? []), child];
    return this.move(id, "STARTED", {
      started: prev?.started ?? child,
      children,
    });
  }

  finished(
    id: string,
    f: { exit: number | null; ok: boolean; output_sha256: string },
  ): AttemptRecord {
    const prev = this.get(id);
    // Krok bez vlastního procesu (deterministická kontrola, fake adaptér v testu) jde z INTENT rovnou do FINISHED
    // přes STARTED bez procesu: zapíše se, aby stav šel jen dopředu.
    if (prev?.phase === "INTENT") this.move(id, "STARTED", {});
    return this.move(id, "FINISHED", { finished: { ...f, at: this.now() } });
  }

  abandoned(id: string, reason: string, kill_evidence = ""): AttemptRecord {
    return this.move(id, "ABANDONED", {
      abandoned: {
        reason: reason.slice(0, 500),
        kill_evidence: kill_evidence.slice(0, 2000),
        at: this.now(),
      },
    });
  }

  holdAttempt(id: string, reason: string): AttemptRecord {
    return this.move(id, "HOLD", {
      hold: { reason: reason.slice(0, 500), at: this.now() },
    });
  }

  /**
   * FIX2 nález 1: trvalý záznam doloženého zániku skupin pokusu (bez změny fáze). Jen u neukončeného pokusu;
   * záznam se jen rozšiřuje.
   */
  groupsEnded(id: string, pgids: number[]): AttemptRecord {
    const prev = this.get(id);
    if (!prev) throw new AttemptError(`pokus ${id} nemá záznam`);
    const all = [...new Set([...(prev.groups_ended ?? []), ...pgids])];
    if (isTerminalAttempt(prev) || all.length === (prev.groups_ended ?? []).length) return prev;
    return this.write({ ...prev, groups_ended: all, updated_at: this.now() });
  }

  /** §8: záznam reconcile před opakováním. Jen jednou a jen u ukončeného pokusu. */
  setReconcile(
    id: string,
    result: RetryDecision,
    reason: string,
  ): AttemptRecord {
    const prev = this.get(id);
    if (!prev) throw new AttemptError(`pokus ${id} nemá záznam`);
    if (!isTerminalAttempt(prev))
      throw new AttemptError(`reconcile pokusu ${id} ve stavu ${prev.phase}`);
    if (prev.reconcile)
      throw new AttemptError(
        `pokus ${id} už má reconcile ${prev.reconcile.result}`,
      );
    return this.write({
      ...prev,
      reconcile: { result, reason: reason.slice(0, 500), at: this.now() },
      updated_at: this.now(),
    });
  }

  /** Výstup pokusu (JSON výsledku kroku) trvale, před FINISHED. Vrací sha256 uloženého textu. */
  writeOutput(rec: AttemptRecord, content: string): string {
    const f = path.join(this.runsDir, rec.order, rec.output_path);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    writeDurable(f, content);
    return sha256(content);
  }

  /** Výstup pokusu, jen když jeho sha256 sedí s FINISHED. Jinak undefined. */
  readOutput(rec: AttemptRecord): string | undefined {
    if (rec.phase !== "FINISHED" || !rec.finished) return undefined;
    const f = path.join(this.runsDir, rec.order, rec.output_path);
    if (!fs.existsSync(f)) return undefined;
    const t = fs.readFileSync(f, "utf8");
    return sha256(t) === rec.finished.output_sha256 ? t : undefined;
  }
}

// ───────────────────────────── kontext pokusu pro runProcess ─────────────────────────────

export interface AttemptScope {
  id: string;
  /** Volá runProcess hned po spawn. Vyhozená chyba = proces se ihned zabije (bez STARTED nejde sledovat). */
  onSpawn(pid: number, cmd: string): void;
  /** FIX1 nález 1: runProcess po `close` hlásí, zda je skupina dítěte doloženě prázdná. */
  onSettled?(pid: number, ended: boolean, note: string): void;
  /** Skupiny, jejichž konec se nepodařilo doložit (pid: důvod). Neprázdné = pokus nesmí do FINISHED. */
  unsettled?: string[];
}

const scopeStore = new AsyncLocalStorage<AttemptScope>();

export function currentAttempt(): AttemptScope | undefined {
  return scopeStore.getStore();
}

export function runInAttempt<T>(
  scope: AttemptScope,
  fn: () => Promise<T>,
): Promise<T> {
  return scopeStore.run(scope, fn);
}

/** Scope, který po spawn zapíše STARTED (pid, pgid = pid, lstart) do journalu. */
export function journalScope(
  journal: AttemptJournal,
  id: string,
  startTime: (pid: number) => string | undefined,
): AttemptScope {
  const unsettled: string[] = [];
  return {
    id,
    unsettled,
    onSettled(pid, ended, note) {
      if (!ended) unsettled.push(`${pid}: ${note}`.slice(0, 300));
    },
    onSpawn(pid, cmd) {
      journal.started(id, {
        pid,
        pgid: pid,
        lstart: startTime(pid) ?? "",
        cmd: path.basename(cmd),
        at: new Date().toISOString(),
      });
    },
  };
}

let ownGroupCache: number | undefined;

/**
 * Skupina procesů tohoto procesu (`ps -o pgid= -p <pid>`), čtená jednou. undefined = nejde zjistit; killGroup pak
 * nic nesignalizuje (fail-closed: bez doložené vlastní skupiny nejde vyloučit, že signál zasáhne nás).
 */
export function ownProcessGroup(): number | undefined {
  if (ownGroupCache !== undefined) return ownGroupCache;
  const r = spawnSync("ps", ["-o", "pgid=", "-p", String(process.pid)], {
    encoding: "utf8",
    timeout: 5000,
  });
  const n = Number(typeof r.stdout === "string" ? r.stdout.trim() : "");
  if (r.status === 0 && Number.isInteger(n) && n > 0) ownGroupCache = n;
  return ownGroupCache;
}

/**
 * Signál celé skupině procesů. Nikdy pro pid/pgid ≤ 1 nebo nečíselný (nodejs/node#65052: kill(0) by zasáhl vlastní
 * skupinu, kill(-1) všechny procesy uživatele) a nikdy pro vlastní skupinu volajícího. Vrací true, když signál odešel.
 * FIX1 nález 2: vlastní skupina = předaný `ownPgid` i skutečná skupina procesu (ownProcessGroup), ne jen process.pid.
 * Když vlastní skupinu nejde zjistit, nesignalizuje se nic.
 */
export function killGroup(
  pgid: number | undefined,
  sig: NodeJS.Signals,
  ownPgid?: number,
): boolean {
  if (typeof pgid !== "number" || !Number.isInteger(pgid) || pgid <= 1)
    return false;
  if (pgid === process.pid || (ownPgid !== undefined && pgid === ownPgid))
    return false;
  const mine = ownProcessGroup();
  if (mine === undefined || pgid === mine) return false;
  try {
    process.kill(-pgid, sig);
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────── sonda procesů ─────────────────────────────

export interface ProcInfo {
  pid: number;
  pgid: number;
  uid: number;
  /** `ps -o lstart=`, mezery sjednocené */
  lstart: string;
  startMs: number;
  /** true = `ps -E` env neukázal (systémový binár nebo cizí proces): o TARS_ATTEMPT_ID nelze nic říct */
  envHidden: boolean;
  attemptId?: string;
}

export interface ProcessProbe {
  /** Všechny procesy; undefined = ps selhal (→ HOLD). */
  list(): ProcInfo[] | undefined;
  kill(pgid: number, sig: NodeJS.Signals): boolean;
  sleep(ms: number): Promise<void>;
  ownPgid?: number;
}

const LSTART = /(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})/;

export function parsePsLine(line: string): ProcInfo | undefined {
  const m = new RegExp(
    `^\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+${LSTART.source}\\s?(.*)$`,
  ).exec(line);
  if (!m) return undefined;
  const lstart = m[4].replace(/\s+/g, " ");
  const startMs = Date.parse(lstart);
  const rest = m[5] ?? "";
  const a = /(?:^|\s)TARS_ATTEMPT_ID=(\S+)/.exec(rest);
  return {
    pid: Number(m[1]),
    pgid: Number(m[2]),
    uid: Number(m[3]),
    lstart,
    startMs: Number.isFinite(startMs) ? startMs : NaN,
    // Env je vidět, když jsou v řádku běžné proměnné každého procesu uživatele.
    envHidden: !/(?:^|\s)(PATH|HOME)=/.test(rest),
    ...(a ? { attemptId: a[1] } : {}),
  };
}

export const psProbe: ProcessProbe = {
  list() {
    const r = spawnSync(
      "ps",
      ["-A", "-ww", "-E", "-o", "pid=,pgid=,uid=,lstart=,command="],
      { encoding: "utf8", timeout: 15_000, maxBuffer: 64 * 1024 * 1024 },
    );
    if (r.status !== 0 || typeof r.stdout !== "string" || !r.stdout.trim())
      return undefined;
    const out: ProcInfo[] = [];
    for (const l of r.stdout.split("\n")) {
      if (!l.trim()) continue;
      const p = parsePsLine(l);
      if (!p) return undefined; // nečitelný řádek = nelze nic prokázat
      out.push(p);
    }
    return out;
  },
  // FIX1 nález 2: produkční sonda předává vlastní skupinu; killGroup ji odmítne (a sám ji ověří i bez ní).
  get ownPgid() {
    return ownProcessGroup();
  },
  kill: (pgid, sig) => killGroup(pgid, sig, ownProcessGroup()),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

// ───────────────────────────── konec skupiny dítěte runProcess (FIX1 nález 1) ─────────────────────────────

export interface GroupMember {
  pid: number;
  /** začátek procesu z `ps -o lstart=` (rozlišení 1 s, oříznuto dolů); NaN = nečitelné */
  startMs: number;
}

/**
 * Členové skupiny `pgid` (`ps -A -o pid=,pgid=,lstart=`, bez env: funguje i tam, kde `ps -E` nejde). undefined =
 * ps selhal nebo řádek nejde přečíst (nic nejde doložit).
 */
export function listGroupMembers(pgid: number): GroupMember[] | undefined {
  const r = spawnSync("ps", ["-A", "-o", "pid=,pgid=,lstart="], {
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0 || typeof r.stdout !== "string" || !r.stdout.trim())
    return undefined;
  const re = new RegExp(`^\\s*(\\d+)\\s+(\\d+)\\s+${LSTART.source}\\s*$`);
  const out: GroupMember[] = [];
  for (const l of r.stdout.split("\n")) {
    if (!l.trim()) continue;
    const m = re.exec(l);
    if (!m) return undefined;
    if (Number(m[2]) !== pgid) continue;
    const ms = Date.parse(m[3].replace(/\s+/g, " "));
    out.push({ pid: Number(m[1]), startMs: Number.isFinite(ms) ? ms : NaN });
  }
  return out;
}

export interface SettleOpts {
  list?: (pgid: number) => GroupMember[] | undefined;
  sleep?: (ms: number) => Promise<void>;
  /** jak dlouho čekat, než skupina sama zanikne (výchozí 2 s); nic se nesignalizuje */
  waitMs?: number;
}

/**
 * FIX1 nález 1 + FIX2 nález 1: doloží konec skupiny dítěte po jeho `close`. `close` hlavního dítěte nic neříká o
 * zbytku skupiny (vnuk běží dál s přesměrovanými proudy).
 *
 * Identita skupiny = (pgid, lstart vedoucího). Node vedoucího sklidil už při `exit`, takže identitu od té chvíle nejde
 * ověřit: skupina mohla zaniknout a její ID připadnout nové skupině, do které vstoupí i starší cizí proces
 * (`setpgid`). Stáří člena proto nic nedokládá a po `exit` vedoucího se NIKDY nesignalizuje. Funkce jen čeká
 * (`waitMs`), zda skupina sama zanikne: prázdná skupina = `ended: true` (a dál se nic neověřuje ani nesignalizuje).
 * Členové po uplynutí čekání = `ended: false` (pokus do HOLD, ne FINISHED). Ukončení skupiny signálem smí jen
 * runProcess, dokud vedoucí nebyl sklizen (timeout).
 */
export async function settleGroup(
  pgid: number,
  o: SettleOpts = {},
): Promise<{ ended: boolean; note: string }> {
  const list = o.list ?? listGroupMembers;
  const sleep =
    o.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const until = Date.now() + (o.waitMs ?? 2000);
  for (;;) {
    const m = list(pgid);
    if (!m) return { ended: false, note: "ps selhal" };
    if (!m.length) return { ended: true, note: "skupina prázdná" };
    if (Date.now() >= until)
      return {
        ended: false,
        note: `po konci vedoucího běží členové skupiny ${pgid} (pid ${m
          .map((x) => x.pid)
          .slice(0, 20)
          .join(
            ",",
          )}) bez doložené identity skupiny (vedoucí sklizen): nic se nesignalizuje`,
      };
    await sleep(Math.min(100, Math.max(1, until - Date.now())));
  }
}

// ───────────────────────────── reconciler (§7) ─────────────────────────────

export type ReconcileAction =
  | "none"
  | "waiting_background"
  | "abandoned"
  | "hold";

export interface ReconcileResult {
  attempt_id: string;
  action: ReconcileAction;
  reason: string;
}

export interface ReconcileOpts {
  now: Date;
  /** čekání po SIGTERM skupiny (ExitTimeOut), výchozí 5 s */
  exitTimeoutMs?: number;
  uid?: number;
}

/**
 * Skupina pokusu (FIX1 nález 2). Signalizovat se smí jen skupina s doloženou identitou:
 * - `alive`: vedoucí (pid = pgid) běží se shodným lstart jako v STARTED. Dokud běží náš vedoucí, ID skupiny nemůže
 *   patřit nikomu jinému (novou skupinu s ID = X založí jen proces X).
 * - `dead`: žádný proces s tímto pgid ani vedoucí. Nic se nezabíjí.
 * - `recycled`: vedoucí PID existuje s jiným lstart. Podle POSIX se PID nerecykluje, dokud existuje skupina s tímto
 *   ID, takže naše skupina neexistuje; členové patří cizí skupině. Nic se nezabíjí.
 * - `unproven`: členové s tímto pgid běží, ale vedoucí chybí nebo lstart v STARTED chybí. Mohou to být naši přeživší
 *   vnuci i cizí procesy po recyklaci ID: nikdy se nesignalizují, výsledek je HOLD.
 * FIX2 nález 1: stáří procesu nedokládá, kdy vstoupil do skupiny (`setpgid`), proto se k identitě nepoužívá. Platí
 * jen shodný lstart vedoucího z čerstvého výpisu. Pgid v `ended` (doložený zánik dřív, `groups_ended`) = `dead`
 * napořád, ať v něm běží cokoli.
 */
type GroupKind = "alive" | "dead" | "recycled" | "unproven";

function groupState(
  c: AttemptChild,
  procs: ProcInfo[],
  ended: readonly number[] = [],
): { kind: GroupKind; alive: boolean; members: number[] } {
  if (ended.includes(c.pgid))
    return { kind: "dead", alive: false, members: [] };
  const leader = procs.find((p) => p.pid === c.pgid);
  const inGroup = procs.filter((p) => p.pgid === c.pgid);
  const members = inGroup.map((p) => p.pid);
  if (leader && c.lstart && leader.lstart !== c.lstart)
    return { kind: "recycled", alive: false, members: [] };
  if (leader && c.lstart && leader.lstart === c.lstart)
    return { kind: "alive", alive: true, members };
  if (!leader && !members.length)
    return { kind: "dead", alive: false, members: [] };
  return { kind: "unproven", alive: false, members };
}

/**
 * FIX1 nález 3: procesy uživatele, které mohou být potomky pokusu mimo jeho skupinu a nejde je vyloučit: env skrytý
 * (`ps -E` ho neukáže, TARS_ATTEMPT_ID nejde ověřit), spuštěné od INTENT a vedoucí vlastní skupiny nebo s
 * neexistujícím vedoucím (tak vypadá potomek po `setsid` / `setpgid`). Proces s čitelným env bez TARS_ATTEMPT_ID
 * pokusu se za potomka nepovažuje (env se dědí).
 */
function unclearProcesses(rec: AttemptRecord, own: ProcInfo[]): ProcInfo[] {
  const since = Math.floor(Date.parse(rec.intent_at) / 1000) * 1000 - 1000;
  const pids = new Set(own.map((p) => p.pid));
  return own.filter(
    (p) =>
      p.envHidden &&
      !(p.startMs < since) &&
      (p.pid === p.pgid || !pids.has(p.pgid)),
  );
}

function groupsOf(rec: AttemptRecord): AttemptChild[] {
  const all = rec.children?.length
    ? rec.children
    : rec.started
      ? [rec.started]
      : [];
  const seen = new Set<number>();
  return all.filter((c) =>
    seen.has(c.pgid) ? false : (seen.add(c.pgid), true),
  );
}

/**
 * Jeden pokus podle tabulky §7. Mění jen záznam pokusu (ABANDONED / HOLD) a případně zabíjí skupinu po deadline.
 * Ukončené pokusy (FINISHED, ABANDONED) se nemění.
 */
export async function reconcileAttempt(
  journal: AttemptJournal,
  rec: AttemptRecord,
  probe: ProcessProbe,
  opts: ReconcileOpts,
): Promise<ReconcileResult> {
  const id = rec.attempt_id;
  if (isTerminalAttempt(rec))
    return { attempt_id: id, action: "none", reason: rec.phase };
  const hold = (reason: string): ReconcileResult => {
    journal.holdAttempt(id, reason);
    return { attempt_id: id, action: "hold", reason };
  };
  const procs = probe.list();
  if (!procs) return hold("ps selhal: konec pokusu nelze prokázat");
  const uid =
    opts.uid ?? (typeof process.getuid === "function" ? process.getuid() : -1);
  const own = procs.filter((p) => p.uid === uid);
  const tagged = own.filter((p) => p.attemptId === id);
  const groups = groupsOf(rec);

  // Krok, jehož procesy běží jako vnitřní volání (kontrolor: `<krok>-a<n>-c<i>`), nemá vlastní skupinu. Rozhodují
  // vnitřní pokusy (reconcileAll je projde dřív): některý v HOLD = HOLD, některý běží = čekat, všechny ukončené = konec.
  const subs = journal
    .list(rec.order)
    .filter((r) => r.step.startsWith(`${rec.step}-a${rec.attempt}-c`));
  if (groups.length === 0 && subs.length) {
    const open = subs.filter((s) => !isTerminalAttempt(s));
    if (open.some((s) => s.phase === "HOLD"))
      return hold(
        `vnitřní volání v HOLD: ${open.map((s) => s.attempt_id).join(", ")}`,
      );
    if (open.length)
      return {
        attempt_id: id,
        action: "waiting_background",
        reason: `vnitřní volání běží: ${open.map((s) => s.attempt_id).join(", ")}`,
      };
    if (tagged.length)
      return hold(
        `běží proces s TARS_ATTEMPT_ID kroku (pid ${tagged.map((p) => p.pid).join(", ")})`,
      );
    const reason = "krok bez FINISHED, všechna vnitřní volání ukončena";
    journal.abandoned(id, reason);
    return { attempt_id: id, action: "abandoned", reason };
  }

  if (groups.length === 0) {
    // INTENT bez STARTED: proces s TARS_ATTEMPT_ID hledáme mezi procesy uživatele spuštěnými po INTENT. Proces se
    // skrytým env, který je vedoucím skupiny nebo jehož vedoucí už neexistuje, může být náš: nelze vyloučit → HOLD.
    if (tagged.length)
      return hold(
        `INTENT bez STARTED, běží proces s TARS_ATTEMPT_ID (pid ${tagged.map((p) => p.pid).join(", ")})`,
      );
    const unclear = unclearProcesses(rec, own);
    if (unclear.length)
      return hold(
        `INTENT bez STARTED, ${unclear.length} proces(ů) po INTENT se skrytým env: nelze vyloučit`,
      );
    journal.abandoned(
      id,
      "INTENT bez STARTED: žádný proces pokusu (prokázáno přes ps)",
    );
    return {
      attempt_id: id,
      action: "abandoned",
      reason: "INTENT bez STARTED",
    };
  }

  // FIX2 nález 1: doložený zánik skupiny se zapíše trvale; takový pgid se pak už nikdy nesignalizuje.
  let ended: number[] = [...(rec.groups_ended ?? [])];
  const noteEnded = (pgids: number[]) => {
    const add = pgids.filter((g) => !ended.includes(g));
    if (!add.length) return;
    ended = [...ended, ...add];
    journal.groupsEnded(id, add);
  };
  const isEnded = (kind: GroupKind) => kind === "dead" || kind === "recycled";
  const states = groups.map((c) => ({ c, ...groupState(c, own, ended) }));
  noteEnded(states.filter((s) => isEnded(s.kind)).map((s) => s.c.pgid));
  // FIX1 nález 2: členové skupiny bez doložené identity (vedoucí chybí, nebo STARTED nemá lstart) se nikdy
  // nesignalizují, ani po deadline: HOLD.
  const unproven = states.filter((s) => s.kind === "unproven");
  if (unproven.length)
    return hold(
      `skupina ${unproven.map((s) => `${s.c.pgid} (členové ${s.members.join(",")})`).join("; ")} bez doložené identity (vedoucí chybí nebo chybí lstart): nic se nesignalizuje`,
    );
  const alive = states.filter((s) => s.alive);
  if (!alive.length) {
    if (tagged.length)
      return hold(
        `skupina pokusu skončila, ale běží proces s TARS_ATTEMPT_ID mimo ni (pid ${tagged.map((p) => p.pid).join(", ")})`,
      );
    // FIX1 nález 3: konec skupiny ještě nedokládá konec potomků (setsid do jiné skupiny, env skrytý).
    const unclear = unclearProcesses(rec, own);
    if (unclear.length)
      return hold(
        `skupina pokusu skončila, ale ${unclear.length} proces(ů) po INTENT se skrytým env mimo ni (pid ${unclear
          .map((p) => p.pid)
          .slice(0, 20)
          .join(",")}): konec potomků nelze doložit`,
      );
    const recycled = states.some((s) => s.kind === "recycled");
    const reason = recycled
      ? "PID vedoucího recyklován (jiný lstart), skupina neexistuje, nic se nezabíjí"
      : "osiřelý pokus: nic neběží, bez FINISHED";
    journal.abandoned(id, reason);
    return { attempt_id: id, action: "abandoned", reason };
  }
  if (opts.now.getTime() < Date.parse(rec.deadline)) {
    return {
      attempt_id: id,
      action: "waiting_background",
      reason: `skupina ${alive.map((s) => s.c.pgid).join(", ")} běží, deadline ${rec.deadline}`,
    };
  }
  // FIX1 nález 2: vlastní skupina orchestrátoru se nikdy nesignalizuje; když ji nejde zjistit, nesignalizuje se nic.
  const ownPgid = probe.ownPgid;
  if (ownPgid === undefined)
    return hold("vlastní skupinu procesů nejde zjistit: nic se nesignalizuje");
  if (alive.some((s) => s.c.pgid === ownPgid))
    return hold(
      `skupina pokusu ${ownPgid} = vlastní skupina orchestrátoru: nic se nesignalizuje`,
    );
  // Deadline uplynul: SIGTERM -pgid, po ExitTimeOut SIGKILL -pgid, pak doložit, že nic neběží. FIX2 nález 1:
  // identita (pgid, lstart vedoucího) se ověřuje z čerstvého výpisu přímo před každým signálem. Vedoucí chybí a
  // členové běží = HOLD bez signálu (stáří členů nic nedokládá). Doložený zánik = pgid se už nikdy nesignalizuje.
  const evidence: string[] = [];
  /** Čerstvý výpis a stav skupin; undefined = ps selhal. */
  const look = (cs: typeof alive) => {
    const l = probe.list();
    if (!l) return undefined;
    const mine = l.filter((p) => p.uid === uid);
    const st = cs.map((s) => ({ ...s, ...groupState(s.c, mine, ended) }));
    noteEnded(st.filter((s) => isEnded(s.kind)).map((s) => s.c.pgid));
    return { mine, st };
  };
  const signal = (cs: typeof alive, sig: NodeJS.Signals, phase: string) => {
    const v = look(cs);
    if (!v) return { stop: hold(`ps selhal před ${sig}; ${evidence.join("; ")}`) };
    const lost = v.st.filter((s) => s.kind === "unproven");
    if (lost.length)
      return {
        stop: hold(
          `${phase}: skupina ${lost.map((s) => `${s.c.pgid} (členové ${s.members.join(",")})`).join("; ")} bez doložené identity (vedoucí chybí), ${sig} neodeslán; ${evidence.join("; ")}`,
        ),
      };
    const live = v.st.filter((s) => s.alive);
    for (const s of live)
      evidence.push(
        `${sig} -${s.c.pgid}: ${probe.kill(s.c.pgid, sig) ? "odesláno" : "neodesláno"} (vedoucí ${s.c.pgid} se shodným lstart ověřen těsně před signálem; členové ${s.members.join(",")})`,
      );
    return { live };
  };
  const t = signal(alive, "SIGTERM", "před SIGTERM");
  if (t.stop) return t.stop;
  if (t.live!.length) await probe.sleep(opts.exitTimeoutMs ?? 5000);
  const k = t.live!.length ? signal(t.live!, "SIGKILL", "po SIGTERM") : { live: [] };
  if (k.stop) return k.stop;
  if (k.live!.length) await probe.sleep(1000);
  const fin = look(alive);
  if (!fin) return hold(`ps selhal po kill; ${evidence.join("; ")}`);
  const ownAfter = fin.mine;
  const left = fin.st.filter((s) => s.alive || s.kind === "unproven");
  const taggedAfter = ownAfter.filter((p) => p.attemptId === id);
  if (left.length || taggedAfter.length)
    return hold(
      `po kill stále běží: skupiny ${left.map((s) => s.c.pgid).join(",") || "-"}, TARS_ATTEMPT_ID ${taggedAfter.map((p) => p.pid).join(",") || "-"}; ${evidence.join("; ")}`,
    );
  const unclearAfter = unclearProcesses(rec, ownAfter);
  if (unclearAfter.length)
    return hold(
      `po kill: skupina prázdná, ale ${unclearAfter.length} proces(ů) po INTENT se skrytým env mimo ni (pid ${unclearAfter
        .map((p) => p.pid)
        .slice(0, 20)
        .join(",")}): konec potomků nelze doložit; ${evidence.join("; ")}`,
    );
  evidence.push(
    "po kill: žádný proces se skupinou pokusu ani s TARS_ATTEMPT_ID, žádný nevyloučitelný proces mimo skupinu",
  );
  journal.abandoned(
    id,
    "deadline uplynul, skupina ukončena",
    evidence.join("; "),
  );
  return {
    attempt_id: id,
    action: "abandoned",
    reason: "deadline uplynul, skupina ukončena",
  };
}

/** Reconciler na začátku ticku (pod lease): všechny neukončené pokusy všech zakázek. */
export async function reconcileAll(
  journal: AttemptJournal,
  orderIds: string[],
  probe: ProcessProbe,
  opts: ReconcileOpts,
): Promise<ReconcileResult[]> {
  const out: ReconcileResult[] = [];
  for (const o of orderIds) {
    // Pozpátku: vnitřní volání (`check-r1-a1-c0`) před svým krokem (`check-r1`).
    for (const rec of journal.list(o).reverse()) {
      if (isTerminalAttempt(rec)) continue;
      out.push(await reconcileAttempt(journal, rec, probe, opts));
    }
  }
  return out;
}
