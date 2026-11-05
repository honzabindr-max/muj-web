// Etapa 4, PR 4b, bod 1: známé riziko z PR 4a (Codex PR 4a kolo 5, karta fable-q-pr4a-merge).
//
// Scénář: tvůrce vrátí doložené varování CLI o blížícím se limitu (Q4-B), potom ENOSPC. Draft, limit-warning.json
// ani journal pokusu se neuloží. Po restartu (reconciler ABANDONED → RETRY_SAFE) nebo po HOLD → UNKNOWN by mohla
// začít nová zakázka dávno před resetem limitu.
//
// Návrh (jiný než FIX4 z PR 4a):
//  1. Sentinel PŘED voláním: `runs/limit-guard/<klíč>.pending.json` se vytvoří create-only (O_EXCL), malý, s fsync,
//     dokud je na disku místo. Když nejde vytvořit, volání modelu vůbec neproběhne.
//  2. Varování jako první věc po návratu procesu: adaptér (ClaudeCli) ho hned po rozboru stderr předá do sinku
//     (`reportLimitWarning`), který zapíše malý create-only záznam `<klíč>.w-<otisk>.json`. Nic nečeká na draft,
//     na výstup pokusu ani na velký soubor limit-warning.json.
//  3. Sentinel se odstraní (unlink, nepotřebuje volné místo) jen tehdy, když se uložila všechna varování volání.
//     Jinak zůstane na disku a orchestrátor drží stejnou blokaci i v paměti.
//  4. Nevyřešený sentinel = globální HOLD (ekvivalent runs/HOLD): tick nespustí žádný krok modelu, žádné opakování
//     ani novou zakázku. Nemá čas vypršení. Uvolní ho jen ruční ověření vlastníkem (`cli.ts owner limit-hold OVERENO`).
//     Pád procesu mezi sentinelem a jeho odstraněním (restart, HOLD → UNKNOWN, RETRY_SAFE) tedy blokaci nikdy neobejde.
// Uložený záznam varování blokuje jen novou zakázku do doloženého resetu + 1 min (Q4-B), jako limit-warning.json.
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { mkdirDurable } from "./store";

export const LIMIT_GUARD_DIR = "limit-guard";

/** Jedno doložené varování CLI o blížícím se limitu (stejný tvar jako LimitWarningNote v departments.ts). */
export interface LimitNote {
  source: string;
  text: string;
  received_at?: string;
  model?: string;
}

/** Blokace z uloženého varování: `until` = ISO konec blokace nové zakázky. */
export interface GuardWarning {
  v: 1;
  key: string;
  source: string;
  until: string;
  reset_source: string;
  evidence_hash: string;
  excerpt: string;
  received_at: string;
  observed_at: string;
  model?: string;
}

export interface PendingGuard {
  key: string;
  file: string;
  opened_at?: string;
}

function sha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Bezpečné jméno souboru z klíče (attempt_id obsahuje lomítka); otisk klíče brání kolizím. */
export function guardBase(key: string): string {
  return `${key.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120)}-${sha(key).slice(0, 12)}`;
}

function fsyncDir(dir: string): void {
  const fd = fs.openSync(dir, "r");
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Malý create-only zápis (O_EXCL) s fsync souboru i adresáře. EEXIST = throw s kódem EEXIST (volající rozhodne).
 * FIX1 (PR 4b) nález 4: `fs.writeSync` smí zapsat méně bajtů; zapisuje se ve smyčce, zápis bez postupu = chyba.
 * Chyba po vytvoření souboru = soubor se zkusí odstranit (neúplný záznam nesmí vypadat jako uložený) a throw.
 * Neodstraněný neúplný záznam varování je nečitelný = trvalá blokace (pending), ne obejití.
 */
function createOnly(file: string, text: string): void {
  const buf = Buffer.from(text, "utf8");
  const fd = fs.openSync(file, "wx", 0o600);
  try {
    let off = 0;
    while (off < buf.length) {
      const n = fs.writeSync(fd, buf, off, buf.length - off);
      if (!(n > 0)) throw new Error(`createOnly: krátký zápis ${off}/${buf.length} B do ${path.basename(file)}`);
      off += n;
    }
    fs.fsyncSync(fd);
  } catch (e) {
    fs.closeSync(fd);
    try {
      fs.unlinkSync(file);
    } catch {
      // neúplný soubor zůstal: u sentinelu to nevadí (existence = blokace), záznam varování je nečitelný = blokace
    }
    throw e;
  }
  fs.closeSync(fd);
  fsyncDir(path.dirname(file));
}

/** Uložený záznam jednoho varování `<klíč>.w-<otisk>.json`. */
const WARNING_FILE = /\.w-[0-9a-f]{16}\.json$/;

/** Čitelný záznam varování (JSON, `source`, platný čas `until`), jinak undefined = nečitelný. */
function readWarning(p: string): (Partial<GuardWarning> & { until: string; source: string }) | undefined {
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<GuardWarning>;
    if (!j || typeof j !== "object") return undefined;
    if (typeof j.until !== "string" || !Number.isFinite(Date.parse(j.until))) return undefined;
    if (typeof j.source !== "string") return undefined;
    return j as Partial<GuardWarning> & { until: string; source: string };
  } catch {
    return undefined;
  }
}

export class LimitGuard {
  constructor(
    private runsDir: string,
    private o: {
      now: () => Date;
      /** konec blokace z varování (doložený reset + rezerva, jinak pauseMinutes od přijetí) */
      untilOf: (n: LimitNote, received: string) => { until: string; reset_source: string };
    },
  ) {}

  dir(): string {
    return path.join(this.runsDir, LIMIT_GUARD_DIR);
  }

  /** FIX1 (PR 4b) nález 5: nový adresář limit-guard trvale (fsync rodiče runs/ i dalších nově vzniklých úrovní). */
  private ensureDir(): void {
    mkdirDurable(this.dir());
  }

  private pendingFile(key: string): string {
    return path.join(this.dir(), `${guardBase(key)}.pending.json`);
  }

  /** Sentinel před voláním modelu. Throw = volání se nesmí spustit (nic se nezapsalo, nebo existuje cizí sentinel). */
  open(key: string): void {
    this.ensureDir();
    createOnly(
      this.pendingFile(key),
      JSON.stringify({ v: 1, key, opened_at: this.o.now().toISOString(), pid: process.pid }) + "\n",
    );
  }

  /** Create-only záznam jednoho varování. Stejné varování podruhé (EEXIST) = už uloženo. Jiná chyba = throw. */
  record(key: string, n: LimitNote): void {
    const received = n.received_at ?? this.o.now().toISOString();
    const evidence_hash = sha(n.text);
    const f = path.join(
      this.dir(),
      `${guardBase(key)}.w-${sha(`${n.source}|${received}|${evidence_hash}`).slice(0, 16)}.json`,
    );
    const u = this.o.untilOf(n, received);
    const rec: GuardWarning = {
      v: 1,
      key,
      source: n.source,
      until: u.until,
      reset_source: u.reset_source,
      evidence_hash,
      excerpt: n.text.slice(0, 300),
      received_at: received,
      observed_at: this.o.now().toISOString(),
      ...(n.model ? { model: n.model } : {}),
    };
    try {
      this.ensureDir();
      createOnly(f, JSON.stringify(rec) + "\n");
    } catch (e) {
      // Stejné varování podruhé: platí jen čitelný záznam (neúplný blokuje trvale přes pending()).
      if ((e as NodeJS.ErrnoException)?.code === "EEXIST" && readWarning(f)) return;
      throw e;
    }
  }

  /** Volání skončilo a všechna jeho varování jsou uložena: sentinel pryč (unlink nepotřebuje volné místo). */
  resolve(key: string): void {
    fs.unlinkSync(this.pendingFile(key));
    try {
      fsyncDir(this.dir());
    } catch {
      // Neuložený unlink se po pádu OS vrátí jako sentinel = blokace (fail-closed), ne obejití.
    }
  }

  /**
   * Nevyřešené sentinely (i nečitelné: existence souboru stačí). FIX1 (PR 4b) nález 4: nečitelný záznam varování
   * (neúplný zápis, poškození) je taky nevyřešený = trvalá blokace do ručního ověření, ne výchozí hodina.
   */
  pending(): PendingGuard[] {
    const d = this.dir();
    if (!fs.existsSync(d)) return [];
    const files = fs.readdirSync(d).sort();
    const sentinels = files
      .filter((f) => f.endsWith(".pending.json"))
      .map((f) => {
        try {
          const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) as { key?: unknown; opened_at?: unknown };
          return {
            key: typeof j.key === "string" ? j.key : f,
            file: f,
            ...(typeof j.opened_at === "string" ? { opened_at: j.opened_at } : {}),
          };
        } catch {
          return { key: f, file: f };
        }
      });
    const unreadable = files
      .filter((f) => WARNING_FILE.test(f) && !readWarning(path.join(d, f)))
      .map((f) => ({ key: `nečitelný záznam varování ${f}`, file: f }));
    return [...sentinels, ...unreadable];
  }

  /**
   * FIX1 (PR 4b) nález 7: o klíči existuje stopa na disku (nevyřešený sentinel, nebo sentinel ověřený vlastníkem).
   * Throw = adresář nejde přečíst (volající rozhodne fail-closed).
   */
  knows(key: string): boolean {
    if (fs.existsSync(this.pendingFile(key))) return true;
    const d = this.dir();
    if (!fs.existsSync(d)) return false;
    const pre = `${guardBase(key)}.verified-`;
    return fs.readdirSync(d).some((f) => f.startsWith(pre));
  }

  /** FIX1 (PR 4b) nález 7: obnova chybějícího sentinelu (už existující = nic). Throw = nejde zapsat. */
  restore(key: string): void {
    try {
      this.open(key);
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== "EEXIST") throw e;
    }
  }

  /** Nevypršené blokace z uložených čitelných varování, po souborech. Nečitelný záznam blokuje přes pending(). */
  live(nowMs: number): Record<string, { until: string; source: string; reset_source: string }> {
    const d = this.dir();
    if (!fs.existsSync(d)) return {};
    const out: Record<string, { until: string; source: string; reset_source: string }> = {};
    for (const f of fs.readdirSync(d)) {
      if (!WARNING_FILE.test(f)) continue;
      const j = readWarning(path.join(d, f));
      if (!j) continue;
      const until = Date.parse(j.until);
      if (until > nowMs)
        out[f] = {
          until: new Date(until).toISOString(),
          source: j.source,
          reset_source: typeof j.reset_source === "string" ? j.reset_source : "nedoloženo",
        };
    }
    return out;
  }

  /**
   * Ruční ověření vlastníkem (stav účtu CLI zkontrolovaný mimo TARS): každý nevyřešený sentinel se přejmenuje na
   * `<jméno>.verified-<čas>.json`, nečitelný záznam varování na `<jméno>.unreadable.verified-<čas>.json` (nic se
   * nemaže, stopa zůstane). Vrací počet uvolněných položek.
   */
  verifyAll(): number {
    const stamp = this.o.now().toISOString().replace(/[-:.]/g, "");
    let n = 0;
    for (const p of this.pending()) {
      const from = path.join(this.dir(), p.file);
      fs.renameSync(
        from,
        WARNING_FILE.test(p.file)
          ? from.replace(/\.json$/, `.unreadable.verified-${stamp}.json`)
          : from.replace(/\.pending\.json$/, `.verified-${stamp}.json`),
      );
      n++;
    }
    if (n) fsyncDir(this.dir());
    return n;
  }
}

// ───────────────────────────── sink: varování hned po návratu procesu ─────────────────────────────

const sinkStore = new AsyncLocalStorage<(n: LimitNote) => void>();

/** Spustí `fn` tak, že každé varování nahlášené adaptérem (`reportLimitWarning`) jde hned do `sink`. */
export function runWithLimitSink<T>(sink: (n: LimitNote) => void, fn: () => Promise<T>): Promise<T> {
  return sinkStore.run(sink, fn);
}

let fallbackSink: ((n: LimitNote) => void) | undefined;

/**
 * FIX1 (PR 4b) nález 6: záložní sink pro varování z volání mimo hlídaný úsek (žádné aktivní `runWithLimitSink`).
 * Orchestrátor ho nastaví tak, že varování uloží (a když to nejde, zvedne blokaci); nic se tiše nezahodí.
 */
export function setFallbackLimitSink(s: ((n: LimitNote) => void) | undefined): void {
  fallbackSink = s;
}

/** Adaptér volá hned po rozboru výstupu procesu, před čímkoli dalším. Nikdy nevyhodí chybu. */
export function reportLimitWarning(n: LimitNote): void {
  const s = sinkStore.getStore() ?? fallbackSink;
  if (!s) return;
  try {
    s(n);
  } catch {
    // sink chyby sbírá sám (GuardSession.lost)
  }
}

/** Jedno hlídané volání (nebo krok s více voláními): sbírá chyby zápisu varování, na konci rozhodne o sentinelu. */
export class GuardSession {
  readonly lost: string[] = [];
  constructor(
    private g: LimitGuard,
    readonly key: string,
  ) {}

  readonly sink = (n: LimitNote): void => {
    try {
      this.g.record(this.key, n);
    } catch (e) {
      this.lost.push(`${n.source}: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
    }
  };

  /**
   * Konec volání: uloží zbylá varování z výsledku (fake adaptéry, výsledek kroku) a odstraní sentinel, jen když se
   * uložilo všechno. Vrací false = varování neuloženo, sentinel zůstal (globální HOLD do ručního ověření).
   */
  finish(notes: LimitNote[] = []): boolean {
    for (const n of notes) this.sink(n);
    if (this.lost.length) return false;
    try {
      this.g.resolve(this.key);
    } catch (e) {
      this.lost.push(`sentinel nejde odstranit: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
      return false;
    }
    return true;
  }
}
