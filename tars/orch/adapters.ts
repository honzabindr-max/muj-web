// Model adapters (§7): claude -p (opus|sonnet), codex exec, ai-chain run.sh.
// All run on subscriptions: API-key env vars are stripped so no CLI silently falls back
// to paid API billing (paid API calls = 0 without owner GO).
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { currentAttempt, killGroup, settleGroup } from "./attempts";
import { reportLimitWarning } from "./limit-guard";
import { limitWarning } from "./reset";
import { redactSecretsUnbounded } from "./secret-scan";
import type { ModelFamily } from "./types";
import { writeSchemaFile, type JsonSchema } from "./verdict";
import { claudeCliVersion, isVerifiedClaudeVersion, WATCHDOG_ENV_RE, watchdogEnv } from "./watchdog";

export interface RunOpts {
  cwd: string;
  timeoutMs?: number;
  /** claude only: exact tool allowlist (e.g. Notion MCP). Empty = no tools. */
  allowedTools?: string[];
  /** claude only: run with exactly this MCP config file (--mcp-config + --strict-mcp-config, no other servers). */
  mcpConfig?: string;
  /** claude only: no built-in tools at all (--tools ""), only MCP tools remain; --allowedTools alone does not remove them. */
  noBuiltinTools?: boolean;
  /** claude only: inline --settings JSON replacing ORCH_CLAUDE_SETTINGS (e.g. adds a PreToolUse hook). */
  settings?: string;
  /** claude only: extra environment of the `claude -p` process (e.g. TARS_RUNS_DIR for its hooks). */
  env?: Record<string, string>;
  /** codex only: JSON Schema for `codex exec --output-schema` (structured verdict). Other adapters ignore it. */
  outputSchema?: JsonSchema;
  /**
   * codex only: pure text review without side channels (Konzilium Lite): no user config.toml (its MCP servers, plugins,
   * hooks, profiles), no session files, and apps/plugins/hooks/browser/computer use/shell/web search switched off
   * (CODEX_ISOLATION_ARGS). Other adapters ignore it.
   */
  isolated?: boolean;
  /**
   * codex only (dodatek PR 5, DR-030): `-c model_reasoning_effort=<…>` podle třídy zakázky (`codexEffort`). Bez hodnoty
   * `xhigh` (fail-closed: neurčená třída = B).
   */
  reasoningEffort?: CodexEffort;
  /**
   * ChatGPT web only: durable directory of the journal of sent prompts (P16, Codex review kolo 1 nález 5). Default cwd
   * (the order dir); Konzilium Lite gives its run dir, because its cwd is a temporary dir that is removed.
   */
  journalDir?: string;
}

/** Dodatek PR 5 (DR-030 doplněk): model Codexu v adaptéru TARS je výslovný, ne výchozí z config.toml. */
export const CODEX_MODEL = "gpt-6.1-sol";
export type CodexEffort = "xhigh" | "high";
/** Diff nad touto velikostí (znaky celého diffu) je „větší diff“: 1. kolo kontroly třídy A pak běží na xhigh. */
export const CODEX_LARGE_DIFF_CHARS = 20_000;

/**
 * Intenzita kontroly Codexu podle třídy zakázky (DR-030 doplněk): třída B (i neurčená, fail-closed) nebo 1. kolo
 * většího diffu = `xhigh`; třída A s malým diffem nebo 2. a další kolo = `high`.
 */
export function codexEffort(c: {
  prClass?: string;
  /** kolo kontroly od 1 (1 = první kontrola, 2 = po první opravě …) */
  round: number;
  diffChars?: number;
}): CodexEffort {
  if (c.prClass !== "A") return "xhigh";
  if (c.round <= 1 && (c.diffChars ?? Infinity) > CODEX_LARGE_DIFF_CHARS) return "xhigh";
  return "high";
}

/** Popis modelu kontroly do záznamu kroku a do pole „Kontrolor (model)“. */
export function codexModelLabel(model: string, effort: CodexEffort): string {
  return `${model}, effort ${effort}`;
}

/**
 * `codex exec` flags of an isolated run. `--ignore-user-config` drops ~/.codex/config.toml (MCP servers such as Notion,
 * plugins, hooks); `--disable plugins/apps` also drops bundled plugin servers and ChatGPT connectors (`-c mcp_servers={}`
 * alone does not: it is merged, checked with `codex mcp list`). Auth still comes from CODEX_HOME.
 */
export const CODEX_ISOLATION_ARGS: readonly string[] = [
  "--ignore-user-config",
  "--ephemeral",
  ...["plugins", "apps", "hooks", "remote_plugin", "browser_use", "browser_use_external", "in_app_browser", "computer_use", "image_generation", "multi_agent", "shell_tool", "unified_exec", "tool_suggest", "skill_mcp_dependency_install"].flatMap((f) => ["--disable", f]),
  "-c",
  "web_search=disabled",
];

export interface AdapterResult {
  ok: boolean;
  text: string;
  /** Subscription/usage limit detected → orchestrator PAUSEs instead of failing. */
  limit: boolean;
  /**
   * P16 v2: the review could not happen (browser, login, limit, timeout, unclear answer). The orchestrator moves the
   * order to WAITING_REVIEW with the same artifact; nothing is ever PASS without a real answer.
   */
  waitReview?: boolean;
  error?: string;
  duration_ms: number;
  /** Etapa 4 PR 1: ISO okamžik konce runProcess; od něj se počítá relativní reset (§10.3). */
  received_at?: string;
  /**
   * Etapa 4 PR 1: hláška limitu (jen při limit), vstup pro parseReset. FIX1 nález 1: jen ze strukturované chybové
   * obálky CLI (claude -p JSON s `is_error: true`), nikdy z textu modelu, stdout ani přepisu promptu. Bez obálky
   * pole chybí a reset je „nedoloženo“ (pauseMinutes).
   */
  limit_text?: string;
  /** Etapa 4 PR 1, Q4-B: doložené varování CLI o blížícím se limitu (řádek ze stderr), jen když limit není. */
  limit_warning?: string;
  /** FIX1 nález 6: zdroj limitu/varování (účet CLI: "claude", "codex", …); blokace Q4-B se vedou po zdrojích. */
  limit_source?: string;
  /**
   * Etapa 4 PR 4c (DR-027 §6): důvod, proč čas resetu z hlášky nejde brát (verze CLI jiná, než pro kterou prošly
   * fixture tvarů). Při něm `limit_text` chybí a orchestrátor zapíše „nedoloženo“ → PAUSED s pauseMinutes.
   */
  reset_unverified?: string;
  /** PR 4c: zjištěná verze CLI (claude --version), jen claude. */
  cli_version?: string;
}

export interface TextAdapter {
  name: string;
  model: string;
  family: ModelFamily;
  /** true = honours RunOpts.outputSchema, so its output is exactly one schema-valid JSON object. */
  readonly supportsOutputSchema?: boolean;
  run(prompt: string, opts: RunOpts): Promise<AdapterResult>;
}

const LIMIT_RE =
  /(usage limit|rate[ _-]?limit|limit reached|hit your (usage )?limit|out of (credits|messages)|quota exceeded|too many requests|\b429\b|resets? at \d|try again (at|in)\b)/i;

/**
 * `system/api_retry` z claude stream-json s chybou rate_limit (§10.3): doklad, že jde o limit, ne čas resetu.
 * Čas resetu z něj nikdy nebereme (parseReset jeho řádky ignoruje).
 */
export function isApiRetryRateLimit(streamJson: string): boolean {
  for (const line of streamJson.split("\n")) {
    if (!line.includes("api_retry")) continue;
    let e: { type?: unknown; subtype?: unknown; error?: unknown; error_type?: unknown };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e?.type !== "system" || e.subtype !== "api_retry") continue;
    if (/rate[ _-]?limit/i.test(`${JSON.stringify(e.error ?? "")} ${JSON.stringify(e.error_type ?? "")}`)) return true;
  }
  return false;
}

export function looksLikeLimit(text: string): boolean {
  return LIMIT_RE.test(text) || isApiRetryRateLimit(text);
}

/**
 * Pole limitu pro AdapterResult (FIX1 nálezy 1 a 2). `envelopeError` = text strukturované chybové obálky CLI, jinak
 * undefined (žádný doložený čas resetu). `warning` = varování už ověřené `limitWarning` nad stderr bez promptu a textu
 * modelu, jinak undefined. Při limitu se varování nezapisuje (pauzu řídí limit).
 */
function limitFields(
  limit: boolean,
  envelopeError: string | undefined,
  warning: string | undefined,
  receivedAt: string,
  source: string,
): Pick<AdapterResult, "limit_text" | "received_at" | "limit_warning" | "limit_source"> {
  return {
    received_at: receivedAt,
    limit_source: source,
    ...(limit && envelopeError ? { limit_text: envelopeError.slice(-4000) } : {}),
    ...(!limit && warning ? { limit_warning: warning } : {}),
  };
}

/** SQL/rows queries on Notion databases are rate-limited per workspace hour; no TARS call may ever make them. */
export const NOTION_QUERY_TOOLS_DENIED = "mcp__claude_ai_Notion__notion-query-data-sources,mcp__claude_ai_Notion__notion-query-multiple-data-sources";

const STRIP_ENV = [
  "NOTION_TOKEN",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "OPENAI_API_KEY",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  // Etapa 4 PR 4b (§8.1, třída B): žádný token GitHubu z env pro žádné dítě. Vlastní volání gh/git orchestrátoru
  // (deliver, snímky §8.2) běží v prostředí orchestrátoru, ne přes childEnv.
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GH_ENTERPRISE_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
  // FIX1 (PR 4b): žádné dítě nepotřebuje agenta SSH ani vlastní SSH příkaz gitu; bez nich nemá cestu push přes SSH
  // ani při porušení I5 (klíč v agentovi). Vlastní git orchestrátoru běží v jeho prostředí.
  "SSH_AUTH_SOCK",
  "SSH_AGENT_PID",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
];

export function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of STRIP_ENV) delete env[k];
  // §8.1: GIT_CONFIG_* a GH_CONFIG_DIR orchestrátoru dítě nedědí; hranici skládá noRemoteWriteEnv.
  for (const k of Object.keys(env)) if (/^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+|PARAMETERS)$/.test(k) || k === "GH_CONFIG_DIR") delete env[k];
  // PR 4c: watchdog Claude Code se nikdy nedědí z prostředí orchestrátoru (mohl by být bez stropů); jen ClaudeCli ho
  // nastaví se stropy pod tvrdým limitem procesu (watchdogEnv).
  for (const k of Object.keys(env)) if (WATCHDOG_ENV_RE.test(k)) delete env[k];
  return env;
}

/** §8.1: cíl push, který nikdy neexistuje. */
export const PUSH_BLOCKED_URL = "file:///nonexistent/tars-push-blocked";

/**
 * Etapa 4 PR 4b (NAVRH-v6 §8.1, vrstva 1): prostředí dítěte dev create/revise bez prostředků k vzdálenému zápisu.
 * `gh` dostane prázdnou konfiguraci (není přihlášený), git nemá žádný credential helper (ani osxkeychain ze systémové
 * konfigurace, ani `gh auth git-credential` z ~/.gitconfig) a push míří na neexistující cíl. GIT_CONFIG_* mají přednost
 * před soubory konfigurace a dědí je každý vnuk. Hranice platí proti omylu, ne proti úmyslu (§8.1, §15 bod 6);
 * úmyslné obejití odhalí snímky §8.2. `ghEmptyDir` = attempts/<id>/gh-empty (vytvoří se 0700).
 *
 * FIX1 (PR 4b) nález 3: vícehodnotové klíče se nejdřív vyprázdní (prázdná hodnota = reset seznamu, git ≥ 2.46):
 * `remote.origin.pushurl` (jinak by git zkusil i dřívější pushurl ze souborů), `http.extraHeader`, credential helpery.
 * `url.<blokováno>.pushInsteadOf` přesměruje push na GitHub z jakéhokoli remote i z explicitní URL; SSH příkaz je
 * `/usr/bin/false`. Co env neumí vyřadit (URL-specifický extraHeader nebo helper, jiný pushurl, insteadOf ze souborů),
 * hlásí `remoteWriteConfigProblem` → HOLD před spuštěním dítěte.
 */
export function noRemoteWriteEnv(ghEmptyDir: string): Record<string, string> {
  fs.mkdirSync(ghEmptyDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(ghEmptyDir, 0o700);
  const cfg: Array<[string, string]> = [
    ["credential.helper", ""],
    ["credential.https://github.com.helper", ""],
    ["credential.https://gist.github.com.helper", ""],
    ["remote.origin.pushurl", ""],
    ["remote.origin.pushurl", PUSH_BLOCKED_URL],
    ["http.extraHeader", ""],
    ["http.https://github.com.extraHeader", ""],
    ...PUSH_REWRITE_PREFIXES.map((p): [string, string] => [`url.${PUSH_BLOCKED_URL}.pushInsteadOf`, p]),
    ["core.sshCommand", "/usr/bin/false"],
  ];
  const env: Record<string, string> = {
    GH_CONFIG_DIR: ghEmptyDir,
    GIT_CONFIG_COUNT: String(cfg.length),
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "/usr/bin/false",
    SSH_ASKPASS: "/usr/bin/false",
    GIT_SSH_COMMAND: "/usr/bin/false",
    GH_PROMPT_DISABLED: "1",
  };
  cfg.forEach(([k, v], i) => {
    env[`GIT_CONFIG_KEY_${i}`] = k;
    env[`GIT_CONFIG_VALUE_${i}`] = v;
  });
  return env;
}

/** Začátky URL GitHubu, jejichž push `pushInsteadOf` přesměruje na PUSH_BLOCKED_URL. */
export const PUSH_REWRITE_PREFIXES = [
  "https://github.com/",
  "http://github.com/",
  "git@github.com:",
  "ssh://git@github.com/",
  "https://gist.github.com/",
];

/** Credential helpery, které noRemoteWriteEnv vyprázdní stejným klíčem (stejná specifičnost URL = reset platí). */
const RESET_CREDENTIAL_KEYS = new Set([
  "credential.helper",
  "credential.https://github.com.helper",
  "credential.https://gist.github.com.helper",
]);

/** Rozsahy `git config --show-scope`; jiný text se do důvodu HOLD nepropíše. */
const GIT_CONFIG_SCOPES = new Set(["system", "global", "local", "worktree", "command"]);

/**
 * FIX1 (PR 4b) nález 3: ověření, že pod `env` (childEnv + noRemoteWriteEnv) v `cwd` nezbývá žádná funkční cesta
 * zápisu, kterou env nevyřadí. Čte jen JMÉNA klíčů (hodnoty mohou nést tajemství), mimo rozsah `command` (to je env):
 * - `http.*extraheader` v souboru (URL-specifický klíč s konkrétnější URL má přednost před resetem z env),
 * - `remote.<jiný než origin>.pushurl` (pushInsteadOf se na explicitní pushurl nepoužije),
 * - `url.*.insteadof` / `url.*.pushinsteadof` ze souborů (delší shoda by přebila přesměrování),
 * - `credential.<url>.helper` mimo klíče, které env vyprázdní,
 * a efektivní push URL originu musí být jen PUSH_BLOCKED_URL. Vrací důvod HOLD, jinak undefined.
 */
export function remoteWriteConfigProblem(cwd: string, env: NodeJS.ProcessEnv): string | undefined {
  const run = (args: string[]) => spawnSync("git", args, { cwd, env, encoding: "utf8", timeout: 30_000 });
  const c = run([
    "config",
    "--show-scope",
    "--name-only",
    "--get-regexp",
    "^(http\\..*extraheader|remote\\..*\\.pushurl|url\\..*insteadof|credential\\..*helper)$",
  ]);
  // exit 1 = žádný klíč nevyhovuje (v pořádku); jiná chyba = nejde ověřit
  if (c.status !== 0 && c.status !== 1) return `§8.1: konfiguraci gitu dítěte nejde ověřit (git config exit ${c.status ?? "?"})`;
  // FIX2 (PR 4b) nález 1: název klíče může nést tajemství (`url.https://<token>@github.com/.insteadOf`), proto důvod
  // HOLD nese jen pevnou kategorii a rozsah z pevného výčtu, nikdy název klíče ani hodnotu.
  const bad = new Set<string>();
  for (const line of (c.stdout ?? "").split("\n")) {
    const [scope, name] = line.trim().split(/\t/);
    if (!scope || !name || scope === "command") continue;
    const lower = name.toLowerCase();
    const where = GIT_CONFIG_SCOPES.has(scope) ? scope : "jiný rozsah";
    if (/^http\..*extraheader$/.test(lower)) bad.add(`${where}: http.*.extraHeader`);
    else if (/^url\..*insteadof$/.test(lower))
      bad.add(`${where}: url.*.insteadOf / pushInsteadOf (URL může nést přihlašovací údaj)`);
    else if (/^remote\..*\.pushurl$/.test(lower)) {
      if (lower !== "remote.origin.pushurl") bad.add(`${where}: remote.<jiný než origin>.pushurl`);
    } else if (/^credential\..*helper$/.test(lower) && !RESET_CREDENTIAL_KEYS.has(name))
      bad.add(`${where}: credential.<url>.helper mimo resetované klíče`);
  }
  if (bad.size)
    return redactSecretsUnbounded(
      `§8.1: konfigurace gitu nese cestu zápisu, kterou prostředí dítěte nevyřadí: ${[...bad].join(", ")}`,
    ).slice(0, 480);
  const u = run(["remote", "get-url", "--push", "--all", "origin"]);
  if (u.status !== 0) return `§8.1: push URL originu nejde ověřit (git remote exit ${u.status ?? "?"})`;
  const urls = (u.stdout ?? "").split("\n").filter((l) => l.trim());
  if (urls.length !== 1 || urls[0] !== PUSH_BLOCKED_URL)
    return `§8.1: efektivní push URL originu není jen blokovaný cíl (${urls.length} URL)`;
  return undefined;
}

interface ProcResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  duration_ms: number;
  /** ISO okamžik konce procesu (§10.3: od něj se počítá relativní reset). */
  received_at: string;
  /** FIX1 nález 1: false = konec skupiny dítěte nejde doložit (člen bez identity, po SIGKILL běží, ps selhal) */
  groupEnded: boolean;
}

export function runProcess(
  cmd: string,
  args: string[],
  input: string,
  cwd: string,
  timeoutMs: number,
  extraEnv: Record<string, string> = {},
): Promise<ProcResult> {
  const t0 = Date.now();
  // Etapa 4 / PR 4a (§7): dítě je vedoucí vlastní skupiny (`detached`), timeout zabije celou skupinu (-pgid), takže
  // nepřežijí ani vnuci (bash run.sh → claude). Pod pokusem (runInAttempt) dítě dědí TARS_ATTEMPT_ID a hned po spawn
  // se zapíše STARTED (pid, pgid, lstart). Kill se nikdy nevolá při pid 0 / undefined (killGroup). Každé volání
  // `claude -p` (i vnuk z run.sh) běží s CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1: žádná úloha na pozadí mimo skupinu.
  const attempt = currentAttempt();
  return new Promise((resolve) => {
    const p = spawn(cmd, args, {
      cwd,
      env: { ...childEnv(), CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1", ...extraEnv, ...(attempt ? { TARS_ATTEMPT_ID: attempt.id } : {}) },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    if (attempt && p.pid) {
      try {
        attempt.onSpawn(p.pid, cmd);
      } catch (e) {
        // Bez trvalého STARTED nejde pokus sledovat: skupina se hned ukončí.
        stderr += `TARS: STARTED nezapsán (${String((e as Error)?.message ?? e).slice(0, 200)}), proces ukončen\n`;
        killGroup(p.pid, "SIGKILL");
      }
    }
    let closed = false;
    // FIX1 nález 1: čas `exit` vedoucího (Node ho v tu chvíli už sklidil). Do `exit` patří ID skupiny jistě nám.
    let exitAt: number | undefined;
    let strayPipe = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // FIX2 nález 1: signál skupině jen dokud vedoucí nebyl sklizen (`exit` nepřišel). Do té doby jeho PID, a tedy
      // ID skupiny, nemůže patřit nikomu jinému (identita ověřena přímo před signálem). Po `exit` se nesignalizuje nic.
      if (exitAt === undefined) killGroup(p.pid, "SIGTERM");
      setTimeout(() => {
        // Vedoucí ještě nesklizen = skupina je jistě naše: SIGKILL celé skupině. Po `exit` se nesignalizuje (settleGroup
        // jen čeká na konec skupiny). Drží-li proudy proces i 5 s po konci vedoucího, zavřou se (jinak `close`
        // nepřijde) a pokus nesmí do FINISHED.
        const unstick = () => {
          if (closed) return;
          strayPipe = true;
          p.stdout.destroy();
          p.stderr.destroy();
        };
        if (exitAt === undefined) {
          killGroup(p.pid, "SIGKILL");
          setTimeout(unstick, 5000).unref();
        } else unstick();
      }, 5000).unref();
    }, timeoutMs);
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", (e) => (stderr += String(e)));
    // A child that exits without reading stdin (e.g. codex failing fast) must not crash us with EPIPE.
    p.stdin.on("error", () => undefined);
    p.on("exit", () => {
      exitAt ??= Date.now();
    });
    p.on("close", (code) => {
      closed = true;
      clearTimeout(timer);
      const end = Date.now();
      // FIX1 nález 1: `close` hlavního dítěte nedokládá konec skupiny. Výsledek až po doloženém konci (settleGroup:
      // čeká, zda skupina sama zanikne; FIX2 nález 1: po `exit` vedoucího bez signálu). Nedoložený konec = HOLD.
      const done = (ended: boolean, note: string) => {
        if (!ended) stderr += `TARS: konec skupiny procesů nedoložen (${note.slice(0, 300)})\n`;
        if (attempt?.onSettled && p.pid) attempt.onSettled(p.pid, ended, note);
        resolve({ code, stdout, stderr, timedOut, duration_ms: Date.now() - t0, received_at: new Date(end).toISOString(), groupEnded: ended });
      };
      if (!p.pid) return done(true, "proces nevznikl");
      void settleGroup(p.pid)
        .then((s) => (strayPipe ? done(false, `stdout/stderr drženy po konci vedoucího (proces mimo skupinu); ${s.note}`) : done(s.ended, s.note)))
        .catch((e) => done(false, String((e as Error)?.message ?? e)));
    });
    p.stdin.end(input);
  });
}

/**
 * Orchestrator `claude -p` calls run in runs/<order>/ inside the muj-web repo. The Codex review gate
 * (plugin openai/codex-plugin-cc, Stop hook) is switched on per workspace for interactive work in that
 * repo; it must not fire on every headless call of the automat (extra GPT call + quota per transition,
 * the automat has its own other-family check). Inline --settings outranks project/user settings.
 */
export const ORCH_CLAUDE_SETTINGS = JSON.stringify({ enabledPlugins: { "codex@openai-codex": false } });

/**
 * ADP-K1-01: proměnné, které v Claude Code 2.1.317 zapínají debug log (DEBUG/DEBUG_SDK = pravdivá hodnota; log jde do
 * <config>/debug/<session>.txt a nese i celý stdout hooků, tedy prompt z `updatedInput`). Dítě je dostane vždy prázdné.
 */
export const CLAUDE_DEBUG_ENV_OFF: Record<string, string> = { DEBUG: "", DEBUG_SDK: "" };

/** Domovská složka Claude Code (`CLAUDE_CONFIG_DIR`, jinak ~/.claude); stejně ji určuje CLI. */
export function claudeConfigHome(env: Record<string, string | undefined> = process.env): string {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * ADP-K1-01: `--no-session-persistence` vypne přepis sezení (.jsonl), ale CLI 2.1.317 dál ukládá stdout hooku delší
 * než 10 000 znaků do <config>/projects/<klíč cwd>/<session>/tool-results/hook-…-stdout.txt (ověřeno živě i v binárce).
 * Proto TARS sezení pojmenuje (`--session-id`) a po pokusu smaže jeho složku i případný přepis ve všech klíčích
 * projektu (klíč cwd se nepočítá, hledá se přesné jméno UUID). Vrací smazané cesty.
 */
export function removeClaudeSessionArtifacts(
  sessionId: string,
  configHome = claudeConfigHome(),
): { removed: string[]; failed: string[] } {
  if (!UUID_RE.test(sessionId)) throw new Error(`neplatné session id: ${sessionId.slice(0, 60)}`);
  const removed: string[] = [];
  const failed: string[] = [];
  let projects: string;
  let keys: string[];
  try {
    projects = fs.realpathSync(path.join(configHome, "projects"));
    keys = fs.readdirSync(projects);
  } catch {
    return { removed, failed };
  }
  for (const k of keys)
    for (const name of [sessionId, `${sessionId}.jsonl`]) {
      const p = path.join(projects, k, name);
      try {
        // Symlink (klíče projektu i artefaktu) se nikdy nesleduje: přeskočit a nahlásit.
        const keySt = fs.lstatSync(path.join(projects, k));
        if (keySt.isSymbolicLink()) {
          if (fs.existsSync(p)) failed.push(`${p} (symlink klíče projektu, přeskočeno)`);
          continue;
        }
        if (!keySt.isDirectory()) continue;
        let st: fs.Stats;
        try {
          st = fs.lstatSync(p);
        } catch {
          continue; // chybějící artefakt není chyba
        }
        if (st.isSymbolicLink() || path.dirname(fs.realpathSync(p)) !== path.join(projects, k)) {
          failed.push(`${p} (symlink nebo realpath mimo projects/, přeskočeno)`);
          continue;
        }
        fs.rmSync(p, { recursive: true, force: true });
        removed.push(p);
      } catch (e) {
        failed.push(`${p} (${String((e as Error)?.message ?? e).slice(0, 100)})`);
      }
    }
  return { removed, failed };
}

export class ClaudeCli implements TextAdapter {
  family: ModelFamily = "claude";
  name: string;
  constructor(public model: "opus" | "sonnet" | "haiku") {
    this.name = `claude -p --model ${model}`;
  }
  async run(prompt: string, opts: RunOpts): Promise<AdapterResult> {
    // PR 4c: `stream-json` (+ `--verbose`, které CLI pro stream v `-p` vyžaduje), aby TARS viděl `system/api_retry`
    // (doklad třídy limitu i po ukončení tvrdým limitem). Výsledek je poslední událost `result` = stejná obálka jako
    // dřív `--output-format json` (`result`, `is_error`).
    // ADP-K1-01: bez přepisu sezení a s vlastním ID sezení, aby šla jeho zbylá složka (tool-results) po pokusu smazat.
    const sessionId = randomUUID();
    const args = [
      "-p",
      "--model",
      this.model,
      "--output-format",
      "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--session-id",
      sessionId,
      "--settings",
      opts.settings ?? ORCH_CLAUDE_SETTINGS,
    ];
    if (opts.mcpConfig) args.push("--mcp-config", opts.mcpConfig, "--strict-mcp-config");
    if (opts.noBuiltinTools) args.push("--tools", "");
    if (opts.allowedTools?.length) args.push("--allowedTools", opts.allowedTools.join(","));
    // Always, also for calls without an allowlist (supervisor, checkers): TARS never runs SQL/rows queries on Notion.
    args.push("--disallowedTools", NOTION_QUERY_TOOLS_DENIED);
    const hardLimitMs = opts.timeoutMs ?? CLAUDE_HARD_LIMIT_MS;
    // PR 4c (DR-027 §6, W5): watchdog jen pro ověřenou verzi CLI a se stropy pod tvrdým limitem procesu (W4 v
    // runProcess). Volající ho nesmí přepsat ani zapnout bez stropů: jeho proměnné z opts.env se zahodí, watchdogEnv
    // jde poslední.
    const version = claudeCliVersion(childEnv());
    const wd = watchdogEnv(version, hardLimitMs);
    const callerEnv = Object.fromEntries(Object.entries(opts.env ?? {}).filter(([k]) => !WATCHDOG_ENV_RE.test(k)));
    const childVars = { ...callerEnv, ...wd.env, ...CLAUDE_DEBUG_ENV_OFF };
    // Úklid míří do stejného CLAUDE_CONFIG_DIR, jaké dostane dítě (runProcess: childEnv() přepsané extraEnv).
    const configHome = claudeConfigHome({ ...childEnv(), ...childVars });
    let r: Awaited<ReturnType<typeof runProcess>>;
    let cleanupFailure: string | undefined;
    try {
      r = await runProcess("claude", args, prompt, opts.cwd, hardLimitMs, childVars);
    } finally {
      try {
        const c = removeClaudeSessionArtifacts(sessionId, configHome);
        if (c.failed.length) cleanupFailure = c.failed.join("; ").slice(0, 300);
      } catch (e) {
        cleanupFailure = String((e as Error)?.message ?? e).slice(0, 200);
      }
      if (cleanupFailure) process.stderr.write(`TARS: úklid sezení Claude ${sessionId} selhal (${cleanupFailure})\n`);
    }
    let text = "";
    let isError = r.code !== 0;
    // FIX1 nález 1: chybová obálka CLI (`is_error: true`) je jediný zdroj času resetu; text modelu ani stderr nejsou.
    let envelopeError: string | undefined;
    const out = parseClaudeStdout(r.stdout);
    if (out.envelope) {
      text = typeof out.envelope.result === "string" ? out.envelope.result : "";
      isError = isError || Boolean(out.envelope.is_error);
      if (out.envelope.is_error === true && typeof out.envelope.result === "string") envelopeError = out.envelope.result;
    } else {
      // Bez obálky (ukončení tvrdým limitem, pád CLI): ze streamu se text modelu nebere, jinak jako dřív celý stdout.
      text = out.stream ? "" : r.stdout;
      isError = true;
    }
    const limit = isError && (looksLikeLimit(`${text}\n${r.stderr}`) || isApiRetryRateLimit(r.stdout));
    // DR-027 §6: tvary hlášek jsou fixture svázané s verzí; jiná verze = čas resetu „nedoloženo“ (nikdy odhad).
    const resetUnverified =
      limit && envelopeError && !isVerifiedClaudeVersion(version)
        ? `verze Claude Code ${version ?? "nezjištěna"} není ověřená pro tvary hlášek limitu`
        : undefined;
    // Etapa 4 PR 4b, bod 1: doložené varování jde do sinku jako první věc po návratu procesu (malý create-only záznam),
    // dřív než volající zapíše draft, výstup pokusu nebo limit-warning.json.
    const warning = limit ? undefined : limitWarning(r.stderr, [prompt, text]);
    if (warning) reportLimitWarning({ source: "claude", text: warning, received_at: r.received_at, model: this.model });
    return {
      ok: !isError && !r.timedOut && text.trim().length > 0 && !cleanupFailure,
      text,
      limit,
      error: r.timedOut
        ? "timeout"
        : isError
          ? `exit ${r.code}: ${(text || r.stderr).slice(0, 300)}`
          : cleanupFailure
            ? `úklid sezení selhal: ${cleanupFailure}`
            : undefined,
      duration_ms: r.duration_ms,
      // FIX1 nález 2: claude -p nevypisuje na stderr prompt ani průběh modelu; přesto se řádek obsažený v promptu
      // nebo v odpovědi modelu nebere (citace) a varování musí hláškou CLI začínat (limitWarning).
      ...limitFields(limit, resetUnverified ? undefined : envelopeError, warning, r.received_at, "claude"),
      ...(resetUnverified ? { reset_unverified: resetUnverified } : {}),
      ...(version ? { cli_version: version } : {}),
    };
  }
}

/** Výchozí tvrdý limit procesu `claude -p` (W4: runProcess po něm ukončí celou skupinu -pgid). */
export const CLAUDE_HARD_LIMIT_MS = 20 * 60_000;

/**
 * Výstup `claude -p --output-format stream-json`: poslední událost `type: "result"` = obálka. Starší tvar (jeden JSON
 * objekt `--output-format json`) se přijme také. `stream` = stdout nese aspoň jednu událost streamu.
 */
export function parseClaudeStdout(stdout: string): { envelope?: { result?: unknown; is_error?: unknown }; stream: boolean } {
  let envelope: { result?: unknown; is_error?: unknown } | undefined;
  let stream = false;
  for (const line of stdout.split("\n")) {
    const l = line.trim();
    if (!l.startsWith("{")) continue;
    let e: unknown;
    try {
      e = JSON.parse(l);
    } catch {
      continue;
    }
    if (!e || typeof e !== "object" || Array.isArray(e)) continue;
    const t = (e as { type?: unknown }).type;
    if (typeof t === "string") stream = true;
    if (t === "result") envelope = e as { result?: unknown; is_error?: unknown };
  }
  if (envelope || stream) return { envelope, stream };
  try {
    const j = JSON.parse(stdout) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) return { envelope: j as { result?: unknown; is_error?: unknown }, stream: false };
  } catch {
    // není JSON
  }
  return { stream: false };
}

export class CodexCli implements TextAdapter {
  family: ModelFamily = "gpt";
  name = "codex exec";
  readonly supportsOutputSchema = true;
  /** Dodatek PR 5 (DR-030): model je vždy výslovný (`-m`), i v izolovaném běhu bez config.toml. */
  constructor(public model = CODEX_MODEL) {}
  /** Intenzita posledního volání (pro záznam kroku). */
  lastEffort: CodexEffort | undefined;
  async run(prompt: string, opts: RunOpts): Promise<AdapterResult> {
    const out = path.join(
      opts.cwd,
      `.codex-last-${process.pid}-${Date.now()}.md`,
    );
    const args = [
      "exec",
      "--skip-git-repo-check",
      "-s",
      "read-only",
      "-o",
      out,
    ];
    const effort: CodexEffort = opts.reasoningEffort ?? "xhigh";
    this.lastEffort = effort;
    args.push("-m", this.model, "-c", `model_reasoning_effort=${effort}`);
    if (opts.isolated) args.push(...CODEX_ISOLATION_ARGS);
    const schema = opts.outputSchema ? writeSchemaFile(opts.outputSchema) : undefined;
    if (schema) args.push("--output-schema", schema.file);
    args.push("-"); // prompt from stdin
    let r: ProcResult;
    try {
      r = await runProcess(
        "codex",
        args,
        prompt,
        opts.cwd,
        opts.timeoutMs ?? 30 * 60_000,
      );
    } finally {
      if (schema) fs.rmSync(schema.dir, { recursive: true, force: true });
    }
    let text = "";
    if (fs.existsSync(out)) {
      text = fs.readFileSync(out, "utf8");
      fs.rmSync(out, { force: true });
    }
    const failed = r.code !== 0 || r.timedOut || text.trim().length === 0;
    const limit = failed && looksLikeLimit(r.stderr + r.stdout);
    return {
      ok: !failed,
      text,
      limit,
      error: failed
        ? r.timedOut
          ? "timeout"
          : `exit ${r.code}: ${lastErrorLine(r.stderr + r.stdout)}`
        : undefined,
      duration_ms: r.duration_ms,
      // FIX1 nálezy 1 a 2: `codex exec` vypisuje na stderr i přepis promptu a průběh modelu (včetně výstupu příkazů),
      // takže původ žádného řádku nejde ověřit: čas resetu je vždy „nedoloženo“ a varování Q4-B se nebere.
      ...limitFields(limit, undefined, undefined, r.received_at, "codex"),
    };
  }
}

function lastErrorLine(s: string): string {
  const lines = s.split("\n").filter((l) => /error/i.test(l));
  return (lines.at(-1) ?? s.slice(-300)).slice(0, 300);
}

/** Department Vývoj creator: existing ~/Projects/ai-chain/run.sh (not modified, only called). */
export class AiChain {
  family: ModelFamily = "claude"; // architect + implementer + final are Claude
  name = "ai-chain run.sh";
  model: string;
  /** §2: implementation runs on Sonnet (run.sh IMPLEMENTER_MODEL, ai-chain PR #2). */
  constructor(
    public runSh: string,
    public implementerModel = "sonnet",
  ) {
    this.model = `ai-chain (Opus architekt → ${implementerModel} implementer)`;
  }
  /**
   * cwd = order dir: ai-chain writes its runs/<ts>/ there. projectDir = git worktree. `env` = navíc prostředí dítěte
   * (PR 4b §8.1: noRemoteWriteEnv); IMPLEMENTER_MODEL ho nepřepíše.
   */
  async run(
    zadaniFile: string,
    projectDir: string,
    cwd: string,
    timeoutMs = 90 * 60_000,
    env: Record<string, string> = {},
  ): Promise<AdapterResult & { status: string }> {
    const r = await runProcess(
      "bash",
      [this.runSh, zadaniFile, projectDir],
      "",
      cwd,
      timeoutMs,
      { ...env, IMPLEMENTER_MODEL: this.implementerModel },
    );
    const final = latestFile(path.join(cwd, "runs"), "05-final.md");
    const text = final ? fs.readFileSync(final, "utf8") : "";
    const status = (/^STATUS:\s*(.+)$/m.exec(text)?.[1] ?? "UNKNOWN").trim();
    const failed = r.code !== 0 || r.timedOut || !final;
    const limit = failed && looksLikeLimit(r.stdout + r.stderr);
    return {
      ok: !failed,
      text,
      status,
      limit,
      error: failed ? (r.timedOut ? "timeout" : `exit ${r.code}`) : undefined,
      duration_ms: r.duration_ms,
      // FIX1 nálezy 1 a 2: run.sh míchá výstupy modelů a promptů; čas resetu „nedoloženo“, varování se nebere.
      ...limitFields(limit, undefined, undefined, r.received_at, "claude"),
    };
  }
}

function latestFile(runsDir: string, name: string): string | undefined {
  if (!fs.existsSync(runsDir)) return undefined;
  const dirs = fs
    .readdirSync(runsDir)
    .filter((d) => d !== "latest")
    .sort()
    .reverse();
  for (const d of dirs) {
    const f = path.join(runsDir, d, name);
    if (fs.existsSync(f)) return f;
  }
  return undefined;
}
