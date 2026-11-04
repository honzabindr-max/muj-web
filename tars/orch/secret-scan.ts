// Secret scan over every model output before it is stored, committed or sent to Notion.
// Patterns mirror ai-chain (TARS-ORCH-001 §6). A hit never prints the matched value.

const PATTERNS: Array<[string, RegExp]> = [
  [
    "github_token",
    /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  ],
  ["openai_key", /\bsk-(proj-)?[A-Za-z0-9_-]{32,}\b/],
  ["anthropic_key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ["notion_token", /\b(secret_[A-Za-z0-9]{40,}|ntn_[A-Za-z0-9]{40,})\b/],
  ["aws_key", /\bAKIA[0-9A-Z]{16}\b/],
  ["slack_token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  [
    "jwt",
    /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  ],
  [
    "db_url_with_password",
    /\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^\s:@/]+:[^\s@/]{6,}@/,
  ],
  ["proxy_url_with_password", /\bhttps?:\/\/[^\s:@/]+:[^\s@/]{6,}@[^\s]+/],
  ["telegram_bot_token", /\b\d{8,10}:AA[A-Za-z0-9_-]{30,}\b/],
];

// Exact values of credentials this process has loaded (e.g. the Notion token from the Keychain).
// They are matched literally, independent of any token format, so a changed prefix can never
// let the loaded token slip into a log, a Notion page or a stored output.
const KNOWN_SECRETS = new Set<string>();
const MIN_KNOWN_SECRET = 12;

export function registerKnownSecret(value: string | undefined): void {
  if (value && value.length >= MIN_KNOWN_SECRET) KNOWN_SECRETS.add(value);
}

export function clearKnownSecrets(): void {
  KNOWN_SECRETS.clear();
}

function hasKnownSecret(text: string): boolean {
  for (const k of KNOWN_SECRETS) if (text.includes(k)) return true;
  return false;
}

export interface SecretScanResult {
  clean: boolean;
  /** Names of matched pattern kinds only — never the values. */
  kinds: string[];
}

export function scanSecrets(text: string): SecretScanResult {
  const kinds = PATTERNS.filter(([, re]) => re.test(text)).map(([k]) => k);
  if (hasKnownSecret(text)) kinds.push("loaded_credential");
  return { clean: kinds.length === 0, kinds };
}

export const REDACTED = "[skryto: citlivý údaj]";

/** Replaces every match of every pattern with REDACTED (last-line output guard for the panel). */
// A PEM block spans many lines: redact header, body and footer together (an unterminated block
// is redacted to the end of the text). Must run before the single-line patterns.
const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;

export function redactSecrets(text: string): string {
  let out = text.replace(PRIVATE_KEY_BLOCK, REDACTED);
  for (const k of KNOWN_SECRETS) out = out.split(k).join(REDACTED);
  for (const [, re] of PATTERNS) out = out.replace(new RegExp(re.source, `${re.flags.replace("g", "")}g`), REDACTED);
  return out;
}

// Same patterns without the word boundaries: a token glued to other word characters (e.g. "wo-copy_ghp_…")
// is still found. Over-redacts rather than leaks; meant for values read from data (ids, log fields).
const UNBOUNDED = PATTERNS.map(([, re]) => new RegExp(re.source.replaceAll("\\b", ""), `${re.flags.replace("g", "")}g`));

/** redactSecrets without word-boundary requirements: a token-like substring anywhere is replaced. */
export function redactSecretsUnbounded(text: string): string {
  let out = redactSecrets(text);
  for (const re of UNBOUNDED) out = out.replace(re, REDACTED);
  return out;
}

/** Deep copy of JSON-like data with every string passed through redactSecrets (keys included). */
export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redactSecrets(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[redactSecrets(k)] = redactDeep(v);
    return out as T;
  }
  return value;
}

export const PATH_HIDDEN = "[cesta skryta]";
// Absolute local paths (home, worktrees, temp) – the panel never shows where files live on disk.
// A path may follow any separator incl. „:“ (cwd:/Users/…); host names and route segments may not.
// System roots are listed explicitly so the panel's own routes (/role, /zakazka, /api …) stay intact.
const ROOTS = "Users|home|private|var|tmp|opt|Volumes|root|srv|mnt|etc|usr|Library|System|Applications|bin|sbin|dev|proc|run|nix|snap|lib|cores|Network";
const FILE_URI = /\bfile:\/\/[^\s"'<>)\]]*/gi;
const LOCAL_PATH = new RegExp(`(?<![\\w./~-])(?:~\\/|\\/(?:${ROOTS})(?=[/\\s"'<>)\\]]|$))[^\\s"'<>)\\]]*`, "g");
const WIN_PATH = /\b[A-Za-z]:\\[^\s"'<>)\]]*/g;

export function redactPaths(text: string): string {
  return text.replace(FILE_URI, PATH_HIDDEN).replace(LOCAL_PATH, PATH_HIDDEN).replace(WIN_PATH, PATH_HIDDEN);
}

/** Panel output filter: secrets first (whole PEM blocks), then local paths. */
export const scrub = (text: string): string => redactPaths(redactSecrets(text));

/** Deep copy of JSON-like data with every string (keys included) passed through scrub. */
export function scrubDeep<T>(value: T): T {
  if (typeof value === "string") return scrub(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[scrub(k)] = scrubDeep(v);
    return out as T;
  }
  return value;
}
