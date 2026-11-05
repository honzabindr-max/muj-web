// Etapa 4, PR 4c (dodatek v6.1 řádek #2, DR-027 v2.1 §6 a W5, NAVRH-v6 §7 a §10; třída B): retry watchdog Claude Code
// v prostředí dítěte `claude -p`, vždy se stropy kratšími než tvrdý limit procesu TARS (W4, runProcess).
//
// Ověřeno proti nainstalované verzi (evidence: tars/orch/evidence/pr4c-versions.md):
// - názvy proměnných jsou v binárce 2.1.317 a v jejím changelogu (2.1.186 / 2.1.295 / 2.1.301);
// - `CLAUDE_CODE_RETRY_WATCHDOG` = bool, oba stropy = `int({min:1, digitsOnly})` (0 by byla neplatná hodnota);
// - bez stropu je čekání neomezené (`?? Infinity`): 429/529 až do vyčerpání `MAX_WAIT_MS`, limit předplatného
//   s resetem dál než zbývá z `MAX_USAGE_LIMIT_WAIT_MS` ukončí požadavek (`api_request_usage_limit_wait_too_long`)
//   a CLI vrátí běžnou chybu limitu (obálka `is_error`), kterou zpracuje parser resetu z PR 1.
//
// Fail-closed: jiná verze CLI než ověřená = watchdog se NEZAPNE (názvy ani význam nejsou doložené) a čas resetu
// z hlášky je „nedoloženo“ (tvary hlášek jsou fixture svázané s verzí, DR-027 §6) → PAUSED s pauseMinutes.
import { spawnSync } from "node:child_process";

/** Verze Claude Code, pro které jsou doložené názvy proměnných watchdogu i fixture tvarů hlášek (PR 4c, 5. 11. 2026). */
export const WATCHDOG_VERIFIED_CLAUDE_VERSIONS: readonly string[] = ["2.1.317"];

/**
 * Strop čekání watchdogu na 429/529 (kapacita, ne kvóta předplatného): 5 min. Zdroj: DR-027 §6 / dodatek v6.1 #2
 * (strop musí být kratší než tvrdý limit procesu TARS). Výchozí tvrdý limit `claude -p` je 20 min (ClaudeCli), deadline
 * pokusu 40 min (orchestrátor), proto 5 min nechá CLI vrátit chybu dřív, než TARS skupinu ukončí.
 */
export const WATCHDOG_MAX_WAIT_MS = 5 * 60_000;

/**
 * Strop čekání na reset limitu předplatného: 1 ms = prakticky nečekat (dítě nikdy nečeká na reset kvóty s drženým
 * lease, DR-027 §6). 0 CLI odmítá (`min: 1`), proto nejmenší platná hodnota. Reset hlídá TARS: PAUSED + next-wake.
 */
export const WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS = 1;

/** Strop watchdogu smí být nejvýš tento podíl tvrdého limitu procesu (zbytek = rezerva na dokončení odpovědi). */
export const WATCHDOG_HARD_LIMIT_SHARE = 0.5;

/** Proměnné watchdogu; z prostředí orchestrátoru se dítěti nikdy nedědí (childEnv), nastavuje je jen watchdogEnv. */
export const WATCHDOG_ENV_RE = /^CLAUDE_CODE_RETRY_WATCHDOG/;

/** `claude --version` → "2.1.317" (jen tvar „X.Y.Z (Claude Code)“), jinak undefined. */
export function parseClaudeVersion(out: string): string | undefined {
  return /^\s*(\d+\.\d+\.\d+) \(Claude Code\)\s*$/.exec(out)?.[1];
}

export function isVerifiedClaudeVersion(v: string | undefined): v is string {
  return v !== undefined && WATCHDOG_VERIFIED_CLAUDE_VERSIONS.includes(v);
}

const versionCache = new Map<string, string>();

/**
 * Verze `claude` z PATH (cache podle PATH, jen úspěšné zjištění). Volání `--version` nečerpá kvótu a nespouští model.
 * Nejde zjistit (chyba, timeout, jiný tvar) = undefined = neověřená verze.
 */
export function claudeCliVersion(env: NodeJS.ProcessEnv): string | undefined {
  const key = env.PATH ?? "";
  const hit = versionCache.get(key);
  if (hit) return hit;
  const r = spawnSync("claude", ["--version"], {
    env,
    encoding: "utf8",
    timeout: 10_000,
    input: "",
  });
  const v = r.status === 0 ? parseClaudeVersion(r.stdout ?? "") : undefined;
  if (v) versionCache.set(key, v);
  return v;
}

/** Jen pro testy: zapomene zjištěné verze. */
export function resetClaudeVersionCache(): void {
  versionCache.clear();
}

/**
 * Prostředí watchdogu pro jedno volání `claude -p` s tvrdým limitem `hardLimitMs`. Neověřená verze nebo limit příliš
 * krátký na smysluplný strop = prázdné env (watchdog vypnut) a důvod v `note`.
 */
export function watchdogEnv(
  version: string | undefined,
  hardLimitMs: number,
): { env: Record<string, string>; note: string } {
  if (!isVerifiedClaudeVersion(version))
    return {
      env: {},
      note: `watchdog vypnut: verze Claude Code ${version ?? "nezjištěna"} není ověřená (${WATCHDOG_VERIFIED_CLAUDE_VERSIONS.join(", ")})`,
    };
  const maxWait = Math.min(
    WATCHDOG_MAX_WAIT_MS,
    Math.floor(hardLimitMs * WATCHDOG_HARD_LIMIT_SHARE),
  );
  if (!(maxWait >= 1))
    return {
      env: {},
      note: `watchdog vypnut: tvrdý limit ${hardLimitMs} ms je příliš krátký`,
    };
  return {
    env: {
      CLAUDE_CODE_RETRY_WATCHDOG: "1",
      CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS: String(maxWait),
      CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS: String(
        Math.min(WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS, maxWait),
      ),
    },
    note: `watchdog zapnut (verze ${version}, strop ${maxWait} ms < tvrdý limit ${hardLimitMs} ms)`,
  };
}
