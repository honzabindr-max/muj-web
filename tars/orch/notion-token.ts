// Notion integration token lives only in the macOS Keychain (DR-029 bod 2). It is read with
//   security find-generic-password -s tars-notion -a tars -w
// through execFile (no shell). The token is never read from .env or the environment, never
// placed on a command line, never logged. A missing token is not an error: the caller falls back.
import { execFileSync } from "node:child_process";

import { registerKnownSecret } from "./secret-scan";

export const KEYCHAIN_SERVICE = "tars-notion";
export const KEYCHAIN_ACCOUNT = "tars";

export const KEYCHAIN_ARGS: readonly string[] = ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w"];

export interface TokenDeps {
  platform?: NodeJS.Platform;
  /** Runs `security` with the given args and returns stdout. Throws on non-zero exit. */
  run?: (file: string, args: readonly string[]) => string;
}

const defaultRun = (file: string, args: readonly string[]): string =>
  execFileSync(file, [...args], { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] });

/** Returns the token, or undefined (not macOS, no Keychain item, locked Keychain, odd value). Never throws, never logs. */
export function readNotionToken(deps: TokenDeps = {}): string | undefined {
  if ((deps.platform ?? process.platform) !== "darwin") return undefined;
  let out: string;
  try {
    out = (deps.run ?? defaultRun)("security", KEYCHAIN_ARGS);
  } catch {
    return undefined;
  }
  const token = out.replace(/[\r\n]+$/, "");
  if (token.length < 20 || /\s/.test(token)) return undefined;
  registerKnownSecret(token);
  return token;
}
