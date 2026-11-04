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
  /** §8: zapíše se jednou, před dalším pokusem stejného kroku. */
  reconcile?: { result: RetryDecision; reason: string; at: string };
  updated_at: string;
}

export class AttemptError extends Error {}

/** §8: opakování kroku bez záznamu reconcile, nebo reconcile odmítnutý adaptérem (dev do PR 4b). Fail-closed. */
export class RetryRefusedError extends AttemptError {}

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
      updated_at: at,
    });
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
  return {
    id,
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

/**
 * Signál celé skupině procesů. Nikdy pro pid/pgid ≤ 1 nebo nečíselný (nodejs/node#65052: kill(0) by zasáhl vlastní
 * skupinu, kill(-1) všechny procesy uživatele) a nikdy pro vlastní skupinu volajícího. Vrací true, když signál odešel.
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
  kill: (pgid, sig) => killGroup(pgid, sig),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

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

/** Skupina pokusu: žije (members), je pryč (dead), nebo patří jinému procesu po recyklaci PID (recycled = mrtvá). */
function groupState(
  c: AttemptChild,
  procs: ProcInfo[],
): { alive: boolean; recycled: boolean; members: number[] } {
  const leader = procs.find((p) => p.pid === c.pgid);
  // Vedoucí PID existuje s jiným časem startu: PID byl recyklován. Podle POSIX se PID nerecykluje, dokud existuje
  // skupina s tímto ID, takže naše skupina už neexistuje. Nic se nezabíjí.
  if (leader && c.lstart && leader.lstart !== c.lstart)
    return { alive: false, recycled: true, members: [] };
  const members = procs.filter((p) => p.pgid === c.pgid).map((p) => p.pid);
  return { alive: members.length > 0, recycled: false, members };
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
    const since = Math.floor(Date.parse(rec.intent_at) / 1000) * 1000 - 1000;
    const pids = new Set(own.map((p) => p.pid));
    const unclear = own.filter(
      (p) =>
        p.envHidden &&
        !(p.startMs < since) &&
        (p.pid === p.pgid || !pids.has(p.pgid)),
    );
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

  let states = groups.map((c) => ({ c, ...groupState(c, own) }));
  const alive = states.filter((s) => s.alive);
  if (!alive.length) {
    if (tagged.length)
      return hold(
        `skupina pokusu skončila, ale běží proces s TARS_ATTEMPT_ID mimo ni (pid ${tagged.map((p) => p.pid).join(", ")})`,
      );
    const recycled = states.some((s) => s.recycled);
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
  // Deadline uplynul: SIGTERM -pgid, po ExitTimeOut SIGKILL -pgid, pak doložit, že nic neběží.
  const evidence: string[] = [];
  for (const s of alive)
    evidence.push(
      `SIGTERM -${s.c.pgid}: ${probe.kill(s.c.pgid, "SIGTERM") ? "odesláno" : "neodesláno"} (členové ${s.members.join(",")})`,
    );
  await probe.sleep(opts.exitTimeoutMs ?? 5000);
  let after = probe.list();
  if (!after) return hold(`ps selhal po SIGTERM; ${evidence.join("; ")}`);
  states = alive.map((s) => ({
    ...s,
    ...groupState(
      s.c,
      after!.filter((p) => p.uid === uid),
    ),
  }));
  const still = states.filter((s) => s.alive);
  if (still.length) {
    for (const s of still)
      evidence.push(
        `SIGKILL -${s.c.pgid}: ${probe.kill(s.c.pgid, "SIGKILL") ? "odesláno" : "neodesláno"} (členové ${s.members.join(",")})`,
      );
    await probe.sleep(1000);
    after = probe.list();
    if (!after) return hold(`ps selhal po SIGKILL; ${evidence.join("; ")}`);
  }
  const ownAfter = after.filter((p) => p.uid === uid);
  const left = alive.filter((s) => groupState(s.c, ownAfter).alive);
  const taggedAfter = ownAfter.filter((p) => p.attemptId === id);
  if (left.length || taggedAfter.length)
    return hold(
      `po kill stále běží: skupiny ${left.map((s) => s.c.pgid).join(",") || "-"}, TARS_ATTEMPT_ID ${taggedAfter.map((p) => p.pid).join(",") || "-"}; ${evidence.join("; ")}`,
    );
  evidence.push(
    "po kill: žádný proces se skupinou pokusu ani s TARS_ATTEMPT_ID",
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
