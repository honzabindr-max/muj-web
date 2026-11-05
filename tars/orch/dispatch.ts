// Etapa 4 PR 2 (NAVRH-v6 §6.3, §14): konfigurace dispatcheru `tars/orch/dispatch.json` a její režim.
//
// `mode` řídí jen NOVOU práci dispatcheru inboxu (claim zakázek `wo-r*`, PR 3 a PR 5). Stávající proces zakázek
// supervizora (`wo-<čas>`) se tímto souborem neřídí a jeho chování PR 2 nemění.
//
// Čtení je fail-closed: chybí soubor, nejde přečíst, není to JSON, má neznámý klíč nebo neplatnou hodnotu = `hold`.
// Existuje-li `runs/HOLD`, platí `hold` bez ohledu na soubor (§6.3). Režim `run` se nikdy neodvozuje, jen čte.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { mkdirDurable, writeDurable } from "./store";

export type DispatchMode = "hold" | "run";

export interface DispatchConfig {
  v: 1;
  mode: DispatchMode;
  /** §6.2.2 bod 3: nejvýš tolik částí review dev diffu (PR 4a). Výchozí 4. */
  max_chunks: number;
  /** §6.4 (N14): rodičovské stránky, pod které smí jít DRAFT jen se scope GO (PR 5). Výchozí žádná. */
  private_draft_parents: string[];
}

export interface DispatchRead {
  config: DispatchConfig;
  /** Proč platí `hold`, když soubor nebyl čitelný nebo platný (jinak undefined). */
  invalid?: string;
  /** `runs/HOLD` existuje: platí `hold` bez ohledu na soubor. */
  hold_file: boolean;
  /** sha256 bajtů souboru (vstup `policy_revision`, §6.1); undefined, když soubor chybí nebo nejde přečíst. */
  sha256?: string;
}

export const DISPATCH_DEFAULTS: DispatchConfig = {
  v: 1,
  mode: "hold",
  max_chunks: 4,
  private_draft_parents: [],
};

const KEYS = new Set(["v", "mode", "max_chunks", "private_draft_parents"]);
const PAGE_ID = /^[0-9a-f]{32}$/;

/** Ověří obsah `dispatch.json`. Vrací konfiguraci, nebo důvod, proč je neplatný (pak platí `hold`). */
export function parseDispatch(
  text: string,
): { ok: true; config: DispatchConfig } | { ok: false; reason: string } {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return { ok: false, reason: "dispatch.json není platný JSON" };
  }
  if (!j || typeof j !== "object" || Array.isArray(j))
    return { ok: false, reason: "dispatch.json není objekt" };
  const o = j as Record<string, unknown>;
  const extra = Object.keys(o).filter((k) => !KEYS.has(k));
  if (extra.length)
    return {
      ok: false,
      reason: `dispatch.json má neznámý klíč: ${extra.join(", ").slice(0, 80)}`,
    };
  if (o.v !== 1) return { ok: false, reason: "dispatch.json: v musí být 1" };
  if (o.mode !== "hold" && o.mode !== "run")
    return {
      ok: false,
      reason: 'dispatch.json: mode musí být "hold" nebo "run"',
    };
  const maxChunks = o.max_chunks ?? DISPATCH_DEFAULTS.max_chunks;
  if (
    typeof maxChunks !== "number" ||
    !Number.isInteger(maxChunks) ||
    maxChunks < 1 ||
    maxChunks > 16
  )
    return {
      ok: false,
      reason: "dispatch.json: max_chunks musí být celé číslo 1–16",
    };
  const parents = o.private_draft_parents ?? [];
  if (
    !Array.isArray(parents) ||
    !parents.every((p) => typeof p === "string" && PAGE_ID.test(p))
  )
    return {
      ok: false,
      reason:
        "dispatch.json: private_draft_parents musí být pole ID stránek (32 hex)",
    };
  return {
    ok: true,
    config: {
      v: 1,
      mode: o.mode,
      max_chunks: maxChunks,
      private_draft_parents: [...(parents as string[])],
    },
  };
}

/** Přečte `dispatch.json` (fail-closed) a `runs/HOLD`. Nikdy nevyhodí výjimku. */
export function readDispatch(file: string, runsDir: string): DispatchRead {
  let holdFile = false;
  try {
    holdFile = fs.existsSync(path.join(runsDir, "HOLD"));
  } catch {
    holdFile = true; // nejde zjistit = jako by existoval
  }
  let buf: Buffer;
  try {
    buf = fs.readFileSync(file);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return {
      config: { ...DISPATCH_DEFAULTS },
      invalid:
        code === "ENOENT"
          ? "dispatch.json chybí"
          : `dispatch.json nejde přečíst (${code ?? "chyba"})`,
      hold_file: holdFile,
    };
  }
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const p = parseDispatch(buf.toString("utf8"));
  if (!p.ok)
    return {
      config: { ...DISPATCH_DEFAULTS },
      invalid: p.reason,
      hold_file: holdFile,
      sha256,
    };
  return {
    config: holdFile ? { ...p.config, mode: "hold" } : p.config,
    hold_file: holdFile,
    sha256,
  };
}

/** Záznam posledního pozorovaného režimu: `runs/dispatch-mode.json` (zapisuje jen tick pod lease). */
export interface ModeRecord {
  mode: DispatchMode;
  observed_at: string;
  /** Kdy začal platit `run` (první tick, který ho viděl). */
  run_since?: string;
}

export interface ModeObservation {
  mode: DispatchMode;
  /**
   * Smí dispatcher v tomto ticku začít NOVOU práci (nový claim)? Jen v `run`, a ne v prvním ticku po přechodu
   * z `hold` (nebo z neznámého předchozího stavu): ten tick smí jen pokračovat v rozpracovaném (§14 PR 2, re-entry).
   */
  may_start_new: boolean;
  /** Režim se tímto tickem změnil (pro log). */
  changed: boolean;
  previous?: DispatchMode;
}

function readModeRecord(file: string): ModeRecord | undefined {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<ModeRecord>;
    if (j.mode !== "hold" && j.mode !== "run") return undefined;
    if (typeof j.observed_at !== "string") return undefined;
    return j as ModeRecord;
  } catch {
    return undefined;
  }
}

/**
 * Zaznamená režim, který tick právě přečetl, a vrátí, zda smí dispatcher začít novou práci. Volá se jen pod lease
 * ticku. Nečitelný předchozí záznam = jako `hold` (první tick v `run` nic nového nezačne).
 */
export function observeMode(
  runsDir: string,
  mode: DispatchMode,
  now: Date,
): ModeObservation {
  const file = path.join(runsDir, "dispatch-mode.json");
  const prev = readModeRecord(file);
  const at = now.toISOString();
  const continuing = mode === "run" && prev?.mode === "run";
  const rec: ModeRecord =
    mode === "run"
      ? {
          mode,
          observed_at: at,
          run_since: continuing ? (prev!.run_since ?? prev!.observed_at) : at,
        }
      : { mode, observed_at: at };
  mkdirDurable(runsDir);
  writeDurable(file, `${JSON.stringify(rec, null, 2)}\n`);
  return {
    mode,
    may_start_new: continuing,
    changed: prev?.mode !== mode,
    previous: prev?.mode,
  };
}
