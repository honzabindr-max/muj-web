// `npx tsx tars/orch/cli.ts gpt-retry <id> fable|vlastnik <proč>` (Codex review kolo 3, nález 1).
// After a burned GPT check attempt (timeout, mismatch, crash) nothing is sent again automatically. This command is the
// only way to allow ONE new attempt (new chat, new nonce, at most one send) for an order or a Konzilium Lite run. It
// never sends anything itself: it writes one grant next to the journal of attempts and logs who, when and why into
// runs/log.jsonl; the next tick (or the next `konzilium` run) uses the grant. Sending a check prompt to a new chat is
// not an owner decision, so the command is not blocked by bash-preflight (unlike `cli.ts owner`, P20 / DR-039).
import fs from "node:fs";
import path from "node:path";

import { grantRetry, type GrantResult } from "./chatgpt-web";
import { KONZILIUM_DIR } from "./konzilium-lite";
import type { Store } from "./store";

/** Order ids (wo-…) and Konzilium Lite run ids (konz-…); never a path. */
const ID_RE = /^(?:wo|konz)-[A-Za-z0-9_-]+$/;

/** The dir holding the journal of attempts of `id`, or the reason it cannot be used. */
export function retryDir(
  runsDir: string,
  id: string,
): { dir: string } | { error: string } {
  if (!ID_RE.test(id))
    return {
      error: "id musí být zakázka (wo-…) nebo běh Konzilia Lite (konz-…)",
    };
  if (id.startsWith("konz-")) {
    const dir = path.join(runsDir, KONZILIUM_DIR, id);
    return fs.existsSync(dir) ? { dir } : { error: `běh ${id} neexistuje` };
  }
  const dir = path.join(runsDir, id);
  const st = path.join(dir, "state.json");
  if (!fs.existsSync(st)) return { error: `zakázka ${id} neexistuje` };
  const state = (JSON.parse(fs.readFileSync(st, "utf8")) as { state?: string })
    .state;
  if (state !== "WAITING_REVIEW")
    return {
      error: `zakázka ${id} není ve WAITING_REVIEW (je ${state ?? "?"}); nový pokus GPT se nepovoluje`,
    };
  return { dir };
}

/** Writes the grant and logs it (also a refusal). Returns the result for the CLI output. */
export function runGptRetry(
  store: Store,
  id: string,
  by: string,
  why: string,
  now: () => Date = () => new Date(),
): GrantResult {
  const where = retryDir(store.runsDir, id);
  const r: GrantResult =
    "error" in where
      ? { ok: false, reason: where.error }
      : grantRetry(where.dir, by, why, now);
  store.log({
    ts: now().toISOString(),
    order: ID_RE.test(id) ? id : "-",
    kind: r.ok ? "info" : "error",
    role: "orchestrator",
    event: "gpt-retry",
    result: r.ok
      ? `gpt-retry povolen: kdo=${r.grant.by}, kdy=${r.grant.at}, proč=${r.grant.why}; jeden nový pokus (nový chat, nový nonce, nejvýš jedno odeslání) v dalším běhu`
      : `gpt-retry odmítnut (kdo=${by}): ${r.reason}`,
    ...(r.ok ? { reason: `spálený pokus: ${r.burned.reason ?? "?"}` } : {}),
  });
  return r;
}
