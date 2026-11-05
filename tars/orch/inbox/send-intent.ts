// Etapa 4 PR 3, N-12 (GPT kolo 6 §3.2): exkluzivita síťového zápisu mezi generacemi lease. Kontrola fence těsně před
// HTTP sama nestačí (není atomická s odesláním). Proto každý pokus o POST/PATCH operace inboxu musí nejdřív
// PUBLIKOVAT create-only záměr odeslání `runs/inbox/send/<order>/<step>-r<n>/a<pokus>.json`, vázaný na fence a token
// udělení. Kdo záměr pro pokus založil, jediný ho smí odeslat. Najde-li jiná generace cizí nevyřešený záměr (pokus,
// který journal ještě nezná), je to HOLD: nikdy souběžný retry. Po pádu záměr nikdo jiný nepřevezme (vlastník intentu
// je udělení lease, které po pádu neexistuje), takže cesta ven je rozhodnutí vlastníka.
//
// Pořadí v zapisujícím ticku: fence → claimSend (publikace záměru, trvalá) → fence → journal.prepare (attempts = pokus)
// → fence → HTTP. Druhá generace pak vždy najde buď cizí záměr bez záznamu v journalu (HOLD SEND_INTENT_FOREIGN),
// nebo journal PREPARED (cesta obnovy bez nového odeslání), takže na jeden pokus připadá nejvýš jeden HTTP zápis.
import fs from "node:fs";
import path from "node:path";

import type { EffectRecord } from "../effects";
import {
  DurabilityHold,
  LedgerPublishUnsupported,
  publishOnce,
  readPublished,
  rooted,
  type PublishOptions,
} from "../publish";
import { InboxHold, assertLease, type LeaseView } from "./common";

export interface SendIntent {
  v: 1;
  operation_id: string;
  attempt: number;
  fence: number;
  lease_token: string;
  content_hash: string;
  pid: number;
  created_at: string;
}

export function intentDir(runsDir: string, op: string): string {
  const [order, step, round] = op.split("/");
  return path.join(runsDir, "inbox", "send", order, `${step}-${round}`);
}

export const intentFile = (
  runsDir: string,
  op: string,
  attempt: number,
): string => path.join(intentDir(runsDir, op), `a${attempt}.json`);

/** Čísla pokusů, pro které existuje záměr (jen `a<n>.json`, tmp a značky se ignorují). */
export function intentAttempts(runsDir: string, op: string): number[] {
  const d = intentDir(runsDir, op);
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d)
    .map((f) => /^a([1-9][0-9]*)\.json$/.exec(f))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

function readIntent(
  runsDir: string,
  op: string,
  attempt: number,
  opts: PublishOptions,
): SendIntent | undefined {
  let r: ReturnType<typeof readPublished>;
  try {
    r = readPublished(intentFile(runsDir, op, attempt), rooted(runsDir, opts));
  } catch (e) {
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  if (r.state === "absent") return undefined;
  try {
    return JSON.parse(r.bytes.toString("utf8")) as SendIntent;
  } catch {
    return undefined;
  }
}

/**
 * Založí záměr pro další pokus operace (`journal.attempts + 1`) a vrátí jeho číslo. HOLD když: existuje záměr pro pokus,
 * který journal nezná a není náš (`SEND_INTENT_FOREIGN`), souběžná generace záměr založila dřív (`SEND_INTENT_CONFLICT`),
 * lease už neplatí (`LEASE_LOST`). Záměr se vrací až po doložené trvanlivosti (publishOnce, N-11).
 */
export function claimSend(inp: {
  runsDir: string;
  op: string;
  record: EffectRecord | undefined;
  lease: LeaseView;
  contentHash: string;
  now: () => string;
  publish?: PublishOptions;
}): number {
  const known = inp.record?.attempts ?? 0;
  const attempt = known + 1;
  for (const m of intentAttempts(inp.runsDir, inp.op)) {
    if (m <= known) continue;
    const x = readIntent(inp.runsDir, inp.op, m, inp.publish ?? {});
    const ours =
      m === attempt &&
      x?.lease_token === inp.lease.token &&
      x?.fence === inp.lease.fence &&
      x?.content_hash === inp.contentHash;
    if (!ours)
      throw new InboxHold(
        "SEND_INTENT_FOREIGN",
        `${inp.op}: pokus ${m} má záměr odeslání bez záznamu v journalu (jiná generace lease nebo pád), nový pokus nevznikne`,
      );
  }
  assertLease(inp.lease, "před záměrem odeslání");
  const intent: SendIntent = {
    v: 1,
    operation_id: inp.op,
    attempt,
    fence: inp.lease.fence,
    lease_token: inp.lease.token,
    content_hash: inp.contentHash,
    pid: process.pid,
    created_at: inp.now(),
  };
  let r: string;
  try {
    r = publishOnce(
      intentFile(inp.runsDir, inp.op, attempt),
      JSON.stringify(intent) + "\n",
      rooted(inp.runsDir, inp.publish),
    );
  } catch (e) {
    if (e instanceof LedgerPublishUnsupported)
      throw new InboxHold("LEDGER_PUBLISH_UNSUPPORTED", e.message);
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  if (r === "CONFLICT")
    throw new InboxHold(
      "SEND_INTENT_CONFLICT",
      `${inp.op}: záměr pokusu ${attempt} založila jiná generace lease`,
    );
  return attempt;
}

/** Po `journal.prepare`: journal musí nést právě náš pokus, jinak se mezi záměrem a prepare vmísil jiný zapisovatel. */
export function assertPreparedAttempt(
  rec: EffectRecord,
  attempt: number,
): void {
  if (rec.state !== "PREPARED" || rec.attempts !== attempt)
    throw new InboxHold(
      "SEND_INTENT_CONFLICT",
      `${rec.operation_id}: journal má pokus ${rec.attempts}, záměr ${attempt}`,
    );
}
