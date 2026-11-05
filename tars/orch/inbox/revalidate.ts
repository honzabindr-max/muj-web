// Etapa 4 PR 5 (NAVRH-v6 §3.3): revalidace rozhodnutí vlastníka `revalidateDecision(decision_id)`.
//
// Receipt (`runs/inbox/decisions/<id>.json`, PR 3) je jen záznam toho, co TARS kdysi viděl. Krok neodemyká. Odemyká ho
// až čerstvá revalidace těsně před krokem, pod platným lease:
//  1. lease musí platit (jinak `LEASE_LOST`, nic se nečte ani nezapisuje),
//  2. řádek `source.page_id` z receiptu se znovu přečte přes REST; chyba = `DECISION_UNREADABLE` (nikdy „stará hodnota platí“),
//  3. hodnota, karta a kolo, řádek (tainted, SUPERSEDED), záznam `REVOKED_OBSERVED` a vazba podle druhu receiptu,
//  4. výsledek se zapíše jako nový neměnný záznam `decisions/<id>/check-<fence>-<n>.json`; nesoulad navíc jednou
//     `decisions/<id>/REVOKED_OBSERVED.json`. Původní receipt zůstane.
// Funkce do Notionu nikdy nezapisuje (P20) a receipt nikdy nevytváří ani nepřepisuje.
import fs from "node:fs";
import path from "node:path";

import { artifactHash } from "../approval";
import {
  DurabilityHold,
  LedgerPublishUnsupported,
  publishOnce,
  readPublished,
  rooted,
  type PublishOptions,
} from "../publish";
import { ownerEventFor } from "../state-machine";
import { InboxHold, sha256Hex, type LeaseView } from "./common";
import {
  decisionsDir,
  readDecisionReceipt,
  type DecisionReceipt,
  type ReceiptKind,
  type ResultBinding,
  type ScopeBinding,
} from "./decision";

/** Čtení řádku s rozhodnutím (REST). `readable: false` = koš, chybějící sloupec nebo neúplná odpověď. */
export type DecisionRowReader = (
  pageId: string,
) => Promise<{ readable: boolean; value?: string }>;

export interface RevalidateCtx {
  runsDir: string;
  lease: LeaseView;
  readRow: DecisionRowReader;
  now: () => string;
  publish?: PublishOptions;
}

/** Stav podání pro scope receipt (§2.1): jen `OK` dovolí pokračovat. */
export type RequestStatus = "OK" | "SUPERSEDED" | "MUTATED" | "REJECTED_SCOPE";

export interface CardRef {
  url: string;
  round: number;
}

export type RevalidateExpect =
  | {
      kind: "scope";
      /** `payload_hash` uložené události (§2.1) */
      eventPayloadHash: string;
      /** `claim.prepare.payload_hash`, existuje-li prepare */
      claimPayloadHash?: string;
      /** `gate.approved_payload_hash`, volá-li se z brány */
      gatePayloadHash?: string;
      requestStatus: RequestStatus;
      /** aktuální scope karta a její kolo (undefined = karta neznámá → nesoulad) */
      currentCard: CardRef | undefined;
      rowTainted: boolean;
      rowSuperseded: boolean;
    }
  | {
      kind: "result";
      order_id: string;
      /** `meta.approved_hash` zakázky (zapisuje jen vydání karty výsledku) */
      approvedHash: string | undefined;
      /** content: `gate.artifact_hash` nebo `meta.artifact_hash`; git: nepoužije se */
      artifactHash?: string;
      /** git: `gate.expected_git_commit_oid` (40 hex) */
      gitOid?: string;
      /** volba GO A / GO B zaznamenaná při přijetí (musí sedět s aktuální hodnotou) */
      option?: "A" | "B";
      currentCard: CardRef | undefined;
      rowTainted: boolean;
      rowSuperseded: boolean;
    };

export type RevalidateCode =
  | "LEASE_LOST"
  | "DECISION_UNREADABLE"
  | "RECEIPT_MISSING"
  | "RECEIPT_KIND"
  | "REVOKED_OBSERVED";

export type RevalidateResult =
  | { ok: true; receipt: DecisionReceipt; check: string; check_sha256: string }
  | { ok: false; code: RevalidateCode; detail: string; check?: string };

export interface CheckRecord {
  v: 1;
  decision_id: string;
  receipt_kind: ReceiptKind;
  result: "OK" | "MISMATCH";
  /** přečtená hodnota selectu (bez interpretace) */
  read_value: string | null;
  /** sha256 kanonického tvaru přečtené odpovědi {readable, value} */
  read_sha256: string;
  mismatch?: string[];
  fence: number;
  at: string;
}

export const checksDir = (runsDir: string, id: string): string =>
  path.join(decisionsDir(runsDir), id);
export const revokedFile = (runsDir: string, id: string): string =>
  path.join(checksDir(runsDir, id), "REVOKED_OBSERVED.json");

const HEX64 = /^[0-9a-f]{64}$/;
const OID = /^[0-9a-f]{40}$/;

/** Existuje pro receipt záznam `REVOKED_OBSERVED`? Nečitelný nebo nedoložený záznam = ano (fail-closed). */
export function isRevoked(
  runsDir: string,
  id: string,
  opts: PublishOptions = {},
): boolean {
  try {
    return (
      readPublished(revokedFile(runsDir, id), rooted(runsDir, opts)).state ===
      "present"
    );
  } catch {
    return true;
  }
}

function publish(
  runsDir: string,
  file: string,
  content: string,
  opts?: PublishOptions,
): "CREATED" | "IDENTICAL" | "CONFLICT" {
  try {
    return publishOnce(file, content, rooted(runsDir, opts));
  } catch (e) {
    if (e instanceof LedgerPublishUnsupported)
      throw new InboxHold("LEDGER_PUBLISH_UNSUPPORTED", e.message);
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
}

/** Další volné `check-<fence>-<n>.json` (create-only; souběžný zápis stejného n vyhraje jen jeden). */
function writeCheck(ctx: RevalidateCtx, rec: CheckRecord): string {
  const dir = checksDir(ctx.runsDir, rec.decision_id);
  fs.mkdirSync(dir, { recursive: true });
  const body = JSON.stringify(rec, null, 2) + "\n";
  for (let n = 0; n < 10_000; n++) {
    const f = path.join(dir, `check-${rec.fence}-${n}.json`);
    if (fs.existsSync(f)) continue;
    const r = publish(ctx.runsDir, f, body, ctx.publish);
    if (r !== "CONFLICT") return f;
  }
  throw new InboxHold("RECEIPT_CONFLICT", "příliš mnoho záznamů revalidace");
}

function cardMismatch(
  r: DecisionReceipt,
  card: CardRef | undefined,
): string | undefined {
  if (!card) return "aktuální karta daného druhu není známá";
  if (card.url !== r.card_url) return "card_url ≠ aktuální karta";
  if (card.round !== r.card_round)
    return `card_round ${r.card_round} ≠ aktuální kolo ${card.round}`;
  return undefined;
}

/**
 * Čerstvá revalidace receiptu `decisionId` proti očekávání `expect` (druh receiptu určuje volající podle §6.4).
 * Vrací `ok: true` jen když platí všechny podmínky §3.3 bod 3. Nikdy nevyhodí výjimku kvůli nesouladu.
 */
export async function revalidateDecision(
  ctx: RevalidateCtx,
  decisionId: string,
  expect: RevalidateExpect,
): Promise<RevalidateResult> {
  if (!ctx.lease.holds())
    return {
      ok: false,
      code: "LEASE_LOST",
      detail: "lease neplatí, revalidace se neprovede",
    };
  let r: DecisionReceipt | undefined;
  try {
    r = /^[0-9a-f]{64}$/.test(decisionId)
      ? readDecisionReceipt(ctx.runsDir, decisionId, ctx.publish)
      : undefined;
  } catch (e) {
    return {
      ok: false,
      code: "RECEIPT_KIND",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
  if (!r)
    return {
      ok: false,
      code: "RECEIPT_MISSING",
      detail: `receipt ${decisionId.slice(0, 12)} neexistuje`,
    };
  if (r.receipt_kind !== expect.kind)
    return {
      ok: false,
      code: "RECEIPT_KIND",
      detail: `krok vyžaduje ${expect.kind} receipt, předložen ${r.receipt_kind}`,
    };
  // 2. Čerstvé čtení řádku z receiptu (ne řádku aktuální karty zakázky).
  let row: { readable: boolean; value?: string };
  try {
    row = await ctx.readRow(r.source.page_id);
  } catch (e) {
    return {
      ok: false,
      code: "DECISION_UNREADABLE",
      detail: `řádek ${r.source.page_id.slice(0, 8)}: ${String((e as Error)?.message ?? e).slice(0, 120)}`,
    };
  }
  if (!row || row.readable !== true)
    return {
      ok: false,
      code: "DECISION_UNREADABLE",
      detail: "řádek nejde spolehlivě přečíst",
    };
  if (!ctx.lease.holds())
    return {
      ok: false,
      code: "LEASE_LOST",
      detail: "lease ztracen během čtení",
    };

  // 3. Podmínky.
  const why: string[] = [];
  const ev = ownerEventFor(row.value);
  if (r.value !== "GO") why.push(`receipt nese ${r.value}, ne GO`);
  if (!ev || ev.decision !== "GO")
    why.push(`aktuální hodnota ${row.value ?? "prázdná"} není GO`);
  if (isRevoked(ctx.runsDir, r.decision_id, ctx.publish))
    why.push("pro receipt existuje REVOKED_OBSERVED");
  const cm = cardMismatch(r, expect.currentCard);
  if (cm) why.push(cm);
  if (expect.rowTainted) why.push("řádek je tainted");
  if (expect.rowSuperseded) why.push("řádek je SUPERSEDED");
  if (expect.kind === "scope") {
    const b = r.binding as ScopeBinding;
    if (b.payload_hash !== expect.eventPayloadHash)
      why.push("binding.payload_hash ≠ payload_hash události");
    if (
      expect.claimPayloadHash !== undefined &&
      b.payload_hash !== expect.claimPayloadHash
    )
      why.push("binding.payload_hash ≠ claim.prepare.payload_hash");
    if (
      expect.gatePayloadHash !== undefined &&
      b.payload_hash !== expect.gatePayloadHash
    )
      why.push("binding.payload_hash ≠ gate.approved_payload_hash");
    if (expect.requestStatus !== "OK")
      why.push(`podání je ${expect.requestStatus}`);
  } else {
    const b = r.binding as ResultBinding;
    if (b.order_id !== expect.order_id) why.push("receipt patří jiné zakázce");
    if (!expect.approvedHash || b.approved_hash !== expect.approvedHash)
      why.push("binding.approved_hash ≠ meta.approved_hash");
    if (b.artifact_kind === "content") {
      if (
        !expect.artifactHash ||
        !HEX64.test(expect.artifactHash) ||
        expect.artifactHash !== b.approved_hash
      )
        why.push("binding.approved_hash ≠ artifact_hash");
    } else if (b.artifact_kind === "git") {
      if (
        !expect.gitOid ||
        !OID.test(expect.gitOid) ||
        artifactHash(expect.gitOid) !== b.approved_hash
      )
        why.push(
          "binding.approved_hash ≠ artifactHash(expected_git_commit_oid)",
        );
    }
    if ((ev?.option ?? undefined) !== expect.option)
      why.push("volba GO A/B se změnila");
  }

  // 4. Neměnný záznam výsledku (+ jednou REVOKED_OBSERVED při nesouladu).
  const rec: CheckRecord = {
    v: 1,
    decision_id: r.decision_id,
    receipt_kind: r.receipt_kind,
    result: why.length ? "MISMATCH" : "OK",
    read_value: row.value ?? null,
    read_sha256: sha256Hex(
      JSON.stringify({ readable: row.readable, value: row.value ?? null }),
    ),
    ...(why.length ? { mismatch: why } : {}),
    fence: ctx.lease.fence,
    at: ctx.now(),
  };
  let check: string;
  try {
    check = writeCheck(ctx, rec);
    if (why.length && !isRevokedStrict(ctx, r.decision_id))
      publish(
        ctx.runsDir,
        revokedFile(ctx.runsDir, r.decision_id),
        JSON.stringify(
          {
            v: 1,
            decision_id: r.decision_id,
            first_check: path.basename(check),
            reasons: why,
            at: rec.at,
          },
          null,
          2,
        ) + "\n",
        ctx.publish,
      );
  } catch (e) {
    return {
      ok: false,
      code: "REVOKED_OBSERVED",
      detail: `záznam revalidace nejde zapsat: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (why.length)
    return {
      ok: false,
      code: "REVOKED_OBSERVED",
      detail: why.join("; "),
      check,
    };
  return {
    ok: true,
    receipt: r,
    check,
    check_sha256: sha256Hex(fs.readFileSync(check)),
  };
}

/** Jen přítomnost souboru (pro rozhodnutí, zda REVOKED_OBSERVED ještě zapsat). */
function isRevokedStrict(ctx: RevalidateCtx, id: string): boolean {
  return fs.existsSync(revokedFile(ctx.runsDir, id));
}

/** Všechny receipty v `runs/inbox/decisions/` (nečitelný = výjimka InboxHold). */
export function listReceipts(
  runsDir: string,
  opts: PublishOptions = {},
): DecisionReceipt[] {
  const d = decisionsDir(runsDir);
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d)
    .filter((f) => /^[0-9a-f]{64}\.json$/.test(f))
    .sort()
    .map((f) => readDecisionReceipt(runsDir, f.slice(0, 64), opts))
    .filter((r): r is DecisionReceipt => Boolean(r));
}

/** Scope receipt GO pro událost (právě jeden; víc různých = HOLD). */
export function scopeReceiptFor(
  runsDir: string,
  eventId: string,
  opts: PublishOptions = {},
): DecisionReceipt | undefined {
  const hits = listReceipts(runsDir, opts).filter(
    (r) =>
      r.receipt_kind === "scope" &&
      r.value === "GO" &&
      (r.binding as ScopeBinding).event_id === eventId,
  );
  if (hits.length > 1)
    throw new InboxHold(
      "RECEIPT_CONFLICT",
      `${hits.length} scope receiptů pro událost ${eventId.slice(0, 8)}`,
    );
  return hits[0];
}
