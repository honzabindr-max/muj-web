// Etapa 4 PR 3 (návrh v6 §3.2, mapa v2 §3.1 krok (7), v4 §3.5): neměnný receipt rozhodnutí `runs/inbox/decisions/
// <decision_id>.json`, dva druhy `scope` a `result`. Receipt vzniká jen z REST čtení hodnoty selectu „Rozhodnutí
// vlastníka“, kterou TARS nikdy nezapisuje (P20). Je to záznam pozorování (`provenance: observed`), sám nic neodemyká:
// revalidace, claim a brána jsou PR 5. Scope receipt jen po úplné vazbě S ↔ R (B1–B9).
import path from "node:path";

import type { EffectRecord } from "../effects";
import { NotionRestError, pageIdFromUrl } from "../notion";
import { OWNER_DECISION_PROPERTY } from "../panel";
import {
  DurabilityHold,
  LedgerPublishUnsupported,
  publishOnce,
  readPublished,
  rooted,
  type PublishOptions,
} from "../publish";
import { InboxHold, canonicalJson, sha256Hex, type LeaseView } from "./common";
import type { InboxEvent } from "./event";
import type { InboxHttp } from "./http";
import { checkTrustedMap, type TrustedIdentities } from "./identity";
import {
  bindScopeCard,
  loadVerifiedScopeLedger,
  scopeCandidates,
  type CardProvenance,
  type PanelConfig,
  type ScopeSnapshot,
} from "./scope";

export type ReceiptKind = "scope" | "result";

export interface ScopeBinding {
  request_id: string;
  generation: number;
  event_id: string;
  payload_hash: string;
}
export interface ResultBinding {
  order_id: string;
  artifact_kind: "content" | "git";
  approved_hash: string;
}

export interface DecisionReceipt {
  v: 2;
  receipt_kind: ReceiptKind;
  decision_id: string;
  binding: ScopeBinding | ResultBinding;
  card_url: string;
  card_round: number;
  value: "GO" | "REJECT";
  source: {
    data_source_id: string;
    page_id: string;
    property: typeof OWNER_DECISION_PROPERTY;
  };
  observed_at: string;
  observed_fence: number;
  provenance: "observed";
  provenance_note: string;
  /** jen scope: řádek podání R (mapa v4 §3.5) */
  source_request_page_id?: string;
  /** jen scope: původ S ověřený B8 a B9 (mapa v4 §3.5 „provenance“; jiný název, aby nekolidoval s `provenance: observed`) */
  card_provenance?: CardProvenance;
}

export const decisionsDir = (runsDir: string): string =>
  path.join(runsDir, "inbox", "decisions");
export const decisionFile = (runsDir: string, id: string): string =>
  path.join(decisionsDir(runsDir), `${id}.json`);

/** `decision_id = sha256(receipt_kind | binding | card_url | card_round | value)` (v6 §3.2), binding v kanonickém JSON. */
export function decisionId(
  kind: ReceiptKind,
  binding: ScopeBinding | ResultBinding,
  cardUrl: string,
  cardRound: number,
  value: string,
): string {
  return sha256Hex(
    `${kind}|${canonicalJson(binding)}|${cardUrl}|${cardRound}|${value}`,
  );
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Tvar receiptu podle druhu. Jiný druh nebo míchání polí (`payload_hash` v result, `approved_hash` ve scope) = `RECEIPT_KIND`. */
export function checkReceipt(r: DecisionReceipt): void {
  const b = r.binding as unknown as Record<string, unknown>;
  if (r.v !== 2 || r.provenance !== "observed")
    throw new InboxHold("RECEIPT_KIND", "verze nebo provenience receiptu");
  if (r.receipt_kind === "scope") {
    const keys = Object.keys(b).sort().join(",");
    if (
      keys !== "event_id,generation,payload_hash,request_id" ||
      !HEX64.test(String(b.payload_hash)) ||
      !/^[0-9a-f]{32}$/.test(String(b.event_id))
    )
      throw new InboxHold(
        "RECEIPT_KIND",
        "scope receipt má binding jiného druhu",
      );
  } else if (r.receipt_kind === "result") {
    const keys = Object.keys(b).sort().join(",");
    if (
      keys !== "approved_hash,artifact_kind,order_id" ||
      !HEX64.test(String(b.approved_hash)) ||
      !["content", "git"].includes(String(b.artifact_kind))
    )
      throw new InboxHold(
        "RECEIPT_KIND",
        "result receipt má binding jiného druhu",
      );
    if (r.card_provenance || r.source_request_page_id)
      throw new InboxHold("RECEIPT_KIND", "result receipt s poli scope");
  } else
    throw new InboxHold(
      "RECEIPT_KIND",
      `neznámý druh ${String(r.receipt_kind)}`,
    );
  if (r.value !== "GO" && r.value !== "REJECT")
    throw new InboxHold("RECEIPT_KIND", "hodnota rozhodnutí");
  if (
    r.decision_id !==
    decisionId(r.receipt_kind, r.binding, r.card_url, r.card_round, r.value)
  )
    throw new InboxHold("RECEIPT_KIND", "decision_id nesedí");
}

/** Zápis jen jednou (publishOnce). Existuje se stejnými bajty = OK; s jinými = `RECEIPT_CONFLICT`, nikdy přepis. */
export function writeDecisionReceipt(
  runsDir: string,
  r: DecisionReceipt,
  opts: PublishOptions = {},
): "CREATED" | "IDENTICAL" {
  checkReceipt(r);
  let res: string;
  try {
    res = publishOnce(
      decisionFile(runsDir, r.decision_id),
      JSON.stringify(r, null, 2) + "\n",
      rooted(runsDir, opts),
    );
  } catch (e) {
    if (e instanceof LedgerPublishUnsupported)
      throw new InboxHold("LEDGER_PUBLISH_UNSUPPORTED", e.message);
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  if (res === "CONFLICT")
    throw new InboxHold(
      "RECEIPT_CONFLICT",
      `receipt ${r.decision_id} existuje s jiným obsahem`,
    );
  return res as "CREATED" | "IDENTICAL";
}

export function readDecisionReceipt(
  runsDir: string,
  id: string,
  opts: PublishOptions = {},
): DecisionReceipt | undefined {
  let got: ReturnType<typeof readPublished>;
  try {
    got = readPublished(decisionFile(runsDir, id), rooted(runsDir, opts));
  } catch (e) {
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  if (got.state === "absent") return undefined;
  const r = JSON.parse(got.bytes.toString("utf8")) as DecisionReceipt;
  checkReceipt(r);
  return r;
}

/** Hodnota selectu „Rozhodnutí vlastníka“ řádku S přes REST (jen čtení). Chyba, koš nebo jiný tvar = `DECISION_UNREADABLE`. */
export async function readOwnerDecision(
  http: InboxHttp,
  pageId: string,
): Promise<string | undefined> {
  let j: unknown;
  try {
    j = (await http.send({ method: "GET", path: `/v1/pages/${pageId}` })).json;
  } catch (e) {
    throw new InboxHold(
      "DECISION_UNREADABLE",
      e instanceof NotionRestError ? `HTTP ${e.status}` : "chyba čtení",
    );
  }
  const p = j as {
    object?: unknown;
    id?: unknown;
    in_trash?: unknown;
    properties?: Record<
      string,
      { type?: unknown; select?: { name?: unknown } | null }
    >;
  };
  if (
    p?.object !== "page" ||
    typeof p.id !== "string" ||
    p.id.replace(/-/g, "").toLowerCase() !== pageId ||
    p.in_trash === true
  )
    throw new InboxHold(
      "DECISION_UNREADABLE",
      "řádek S nejde spolehlivě přečíst",
    );
  const prop = p.properties?.[OWNER_DECISION_PROPERTY];
  if (!prop || prop.type !== "select")
    throw new InboxHold(
      "DECISION_UNREADABLE",
      "sloupec Rozhodnutí vlastníka chybí nebo není select",
    );
  const name = prop.select?.name;
  return typeof name === "string" && name ? name : undefined;
}

export interface ScopeDecisionInput {
  http: InboxHttp;
  runsDir: string;
  event: InboxEvent;
  /** journal efektu scope karty; musí být `EFFECT_DONE` s receiptem na S */
  scopeRecord: EffectRecord | undefined;
  panel: PanelConfig;
  trusted: Partial<TrustedIdentities> | undefined;
  /** nové úplné čtení Inboxu, R a panelu (pro B1–B9 těsně před zápisem receiptu) */
  read: () => Promise<ScopeSnapshot>;
  lease: LeaseView;
  now: () => string;
  publish?: PublishOptions;
}

export type ScopeDecisionOutcome =
  | { kind: "none" }
  | {
      kind: "receipt";
      receipt: DecisionReceipt;
      write: "CREATED" | "IDENTICAL" | "EXISTING";
    }
  | { kind: "hold"; code: InboxHold["code"]; detail: string };

/**
 * Krok (7) mapy v2 §3.1: pozorování GO/REJECT vlastníka na scope kartě S → scope receipt. Jen po úplné vazbě B1–B9
 * (mapa v4 §3.5) nad novým úplným čtením. Prázdná nebo jiná hodnota = žádný receipt. Nic se nezapisuje do Notionu.
 */
export async function observeScopeDecision(
  inp: ScopeDecisionInput,
): Promise<ScopeDecisionOutcome> {
  try {
    const ev = inp.event;
    const rec = inp.scopeRecord;
    if (rec?.state !== "EFFECT_DONE" || rec.subject !== ev.event_id)
      throw new InboxHold(
        "SCOPE_BINDING_MISMATCH",
        "scope karta nemá EFFECT_DONE této události",
      );
    const sId = pageIdFromUrl(rec.receipt?.url ?? "");
    if (!sId)
      throw new InboxHold(
        "SCOPE_BINDING_MISMATCH",
        "receipt scope karty bez stránky",
      );
    const trusted = checkTrustedMap(inp.trusted);
    const value = await readOwnerDecision(inp.http, sId);
    if (value !== "GO" && value !== "REJECT") return { kind: "none" };
    const L = loadVerifiedScopeLedger(
      inp.runsDir,
      ev,
      rec,
      inp.http,
      inp.panel,
      inp.publish,
    );
    const snap = await inp.read();
    const cands = scopeCandidates(snap.panelCards, ev, L.nonce);
    if (cands.length !== 1)
      throw new InboxHold(
        cands.length ? "DUPLICATE_SCOPE_CARD" : "SCOPE_CARD_UNKNOWN",
        `${cands.length} kandidátů`,
      );
    const prov = await bindScopeCard({
      card: cands[0],
      event: ev,
      snap,
      journal: rec,
      ledger: L,
      http: inp.http,
      trusted,
    });
    if (!inp.lease.holds())
      throw new InboxHold("LEASE_LOST", "před zápisem receiptu");
    const binding: ScopeBinding = {
      request_id: ev.request_id,
      generation: ev.generation,
      event_id: ev.event_id,
      payload_hash: ev.payload_hash,
    };
    const card_url = cands[0].karta_url!;
    const id = decisionId("scope", binding, card_url, 0, value);
    const prior = readDecisionReceipt(inp.runsDir, id, inp.publish);
    if (prior) return { kind: "receipt", receipt: prior, write: "EXISTING" }; // stejné pozorování dřív: receipt se nepřepisuje
    const receipt: DecisionReceipt = {
      v: 2,
      receipt_kind: "scope",
      decision_id: id,
      binding,
      card_url,
      card_round: 0,
      value,
      source: {
        data_source_id: inp.panel.data_source_id,
        page_id: sId,
        property: OWNER_DECISION_PROPERTY,
      },
      observed_at: inp.now(),
      observed_fence: inp.lease.fence,
      provenance: "observed",
      provenance_note: "DR-039: autor selectu neprokázán",
      source_request_page_id: ev.page_id,
      card_provenance: prov,
    };
    return {
      kind: "receipt",
      receipt,
      write: writeDecisionReceipt(inp.runsDir, receipt, inp.publish),
    };
  } catch (e) {
    if (e instanceof InboxHold)
      return { kind: "hold", code: e.code, detail: e.message };
    throw e;
  }
}
