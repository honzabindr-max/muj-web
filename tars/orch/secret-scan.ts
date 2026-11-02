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

export interface SecretScanResult {
  clean: boolean;
  /** Names of matched pattern kinds only — never the values. */
  kinds: string[];
}

export function scanSecrets(text: string): SecretScanResult {
  const kinds = PATTERNS.filter(([, re]) => re.test(text)).map(([k]) => k);
  return { clean: kinds.length === 0, kinds };
}
