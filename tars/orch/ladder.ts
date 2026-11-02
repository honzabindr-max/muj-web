// Adapter ladder (TARS-ORCH-001 §2b): CLI/API → MCP → browser → desktop.
// Rungs 3–4 have hard rules; the orchestrator refuses to start a specialist whose adapter
// preconditions are not met. Rules are data here, enforcement lives in mcp-browser.ts (plan) + mcp-gate.ts (every MCP tool call) / desktop.ts.
import { spawnSync } from "node:child_process";

import type { Card } from "./cards";

/** Only these sites may be opened by rung 3–4 adapters. */
export const ALLOWED_HOSTS = [
  "claude.ai",
  "chatgpt.com",
  "notion.so",
  "www.notion.so",
  "app.notion.com",
] as const;

export function hostAllowed(url: string): boolean {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    host = u.hostname;
  } catch {
    return false;
  }
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * UI actions that are never allowed: purchase, payment, message to a stranger, public share,
 * account settings. Matched against the label/text of the element an action targets.
 */
export const FORBIDDEN_ACTION_RE =
  /(buy|purchase|checkout|upgrade|subscribe|billing|payment|pay now|add card|koupit|zaplatit|předplat|share|sdílet|publish|zveřejnit|invite|pozvat|send to|odeslat (e-?mail|zprávu)|settings|nastavení|delete account|log ?out|odhlásit|sign ?out)/i;

export function actionAllowed(targetLabel: string): boolean {
  return !FORBIDDEN_ACTION_RE.test(targetLabel);
}

/** Bot challenge pages (Cloudflare etc.). TARS never solves or evades them; it stops. */
export const BOT_CHALLENGE_RE =
  /(Verify you are human|Potvrďte, že jste člověk|bezpečnostního ověření|security verification|Just a moment|cf-challenge|challenges\.cloudflare\.com)/i;

export function isBotChallenge(pageText: string): boolean {
  return BOT_CHALLENGE_RE.test(pageText);
}

/** UI failure policy: 2 attempts, then UNKNOWN + owner card; never blind write retries. */
export const UI_MAX_ATTEMPTS = 2;

export interface PreflightResult {
  ok: boolean;
  reasons: string[];
}

export interface LadderEnv {
  /** Rung 3: is the TARS-agent profile present and logged in to the needed site? */
  browserReady: () => PreflightResult;
  /** Rung 4: desktop adapter implemented and allowed? */
  desktopReady: () => PreflightResult;
  /** Rung 1: is a CLI on PATH? */
  hasCli: (cmd: string) => boolean;
}

export function defaultHasCli(cmd: string): boolean {
  return (
    spawnSync("/bin/sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" })
      .status === 0
  );
}

const CLI_FOR_ADAPTER: Record<string, string> = {
  codex: "codex",
  "claude-opus": "claude",
  "ai-chain": "bash",
};

export function adapterPreflight(card: Card, env: LadderEnv): PreflightResult {
  switch (card.rung) {
    case 1:
    case 2: {
      const cli = CLI_FOR_ADAPTER[card.adapter];
      if (cli && !env.hasCli(cli))
        return { ok: false, reasons: [`CLI ${cli} není dostupné`] };
      return { ok: true, reasons: [] };
    }
    case 3:
      return env.browserReady();
    case 4:
      return env.desktopReady();
  }
}
