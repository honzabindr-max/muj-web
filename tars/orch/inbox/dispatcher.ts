// Etapa 4 PR 5 (NAVRH-v6 §5, §7, §9, §14): dispatcher inboxu fable/dev napojený na události, ACK a scope receipty z PR 3.
//
// Tick pod lease: (1) obnova všech rozpracovaných claimů podle tabulky §5 (i v režimu hold: jen lokální záznamy,
// ACK do Notionu v hold neodejde), (2) `wo-r*` bez prepare = HOLD UNKNOWN, (3) jen v režimu `run` a ne v prvním ticku po
// přechodu z hold (`may_start_new`) nejvýš jeden nový claim (fronta max 1, Q3-A). Před každým krokem zakázky `wo-r*`
// (INTENT, §7) a před každým efektem se scope receipt čerstvě revaliduje (§3.3). Dispatcher nikdy nezadá GO ani REJECT
// (P20), nikdy nevytvoří receipt a nikdy nemerguje.
import fs from "node:fs";
import path from "node:path";

import type { EffectJournal } from "../effects";
import { pageIdFromUrl } from "../notion";
import type { PublishOptions } from "../publish";
import type { Store } from "../store";
import type { Order } from "../types";
import { ackLedgerFile, ackOp, parseAckLedger, type AckState } from "./ack";
import { EVENT_ID_RE, InboxHold, type LeaseView } from "./common";
import {
  advanceClaim,
  claimEventIds,
  claimRunnable,
  claimView,
  eventOfOrder,
  orphanInboxOrders,
  revokeClaim,
  woIdFor,
  type ClaimDeps,
  type ClaimOutcome,
  type PayloadView,
} from "./claim";
import { readDecisionReceipt } from "./decision";
import { readEvent, type InboxEvent } from "./event";
import {
  revalidateDecision,
  scopeReceiptFor,
  type CardRef,
  type DecisionRowReader,
  type RequestStatus,
  type RevalidateResult,
} from "./revalidate";
import { scopeOp } from "./scope";

export interface DispatcherDeps {
  runsDir: string;
  store: Store;
  journal: EffectJournal;
  /** REST čtení „Rozhodnutí vlastníka“ řádku scope karty S (PR 3 `readOwnerDecision`) */
  readRow: DecisionRowReader;
  /** čerstvé čtení podání R (PR 3 `readInboxPayload`) */
  readPayload(ev: InboxEvent): Promise<PayloadView>;
  /** ACK do Notionu (PR 3 `ackStep`) */
  ack: ClaimDeps["ack"];
  now(): string;
  /** aktuální scope karta události (výchozí: z journalu scope karty PR 3 a receiptu) */
  scopeCard?(ev: InboxEvent): CardRef | undefined;
  crashAt?: ClaimDeps["crashAt"];
  publish?: PublishOptions;
}

export interface DispatchTickInput {
  lease: LeaseView;
  mode: "hold" | "run";
  may_start_new: boolean;
  dispatchSha256: string | undefined;
  allowedTypes: readonly string[];
}

export interface DispatchTickResult {
  recovered: Array<{ event_id: string; outcome: ClaimOutcome }>;
  orphans: string[];
  claimed?: { event_id: string; outcome: ClaimOutcome };
}

export type ScopeCheck =
  | { ok: true; check: string }
  | { ok: false; code: string; detail: string };

/** Poslední stav ACK události (r0, r1 … s EFFECT_DONE v journalu); undefined = ACK zatím žádný. */
export function lastAckState(
  runsDir: string,
  journal: EffectJournal,
  eventId: string,
): AckState | undefined {
  let last: AckState | undefined;
  for (let n = 0; n < 1000; n++) {
    if (journal.get(ackOp(eventId, n))?.state !== "EFFECT_DONE") break;
    const f = ackLedgerFile(runsDir, eventId, n);
    if (!fs.existsSync(f)) break;
    last = parseAckLedger(fs.readFileSync(f), eventId, n).state;
  }
  return last;
}

/** Uložené události (pro SUPERSEDED: vyšší generace stejného request_id, §2.1). */
export function storedEvents(
  runsDir: string,
  opts: PublishOptions = {},
): InboxEvent[] {
  const d = path.join(runsDir, "inbox", "events");
  if (!fs.existsSync(d)) return [];
  const out: InboxEvent[] = [];
  for (const f of fs.readdirSync(d).sort()) {
    const id = f.replace(/\.json$/, "");
    if (!f.endsWith(".json") || !EVENT_ID_RE.test(id)) continue;
    try {
      const ev = readEvent(runsDir, id, opts);
      if (ev) out.push(ev);
    } catch {
      /* nečitelná událost: claim ji nikdy nezpracuje (readEvent vyhodí znovu) */
    }
  }
  return out;
}

export class InboxDispatcher {
  constructor(private d: DispatcherDeps) {}

  /** Stav podání pro revalidaci scope (§2.1, §3.3): SUPERSEDED vyšší generací, MUTATED / REJECTED_SCOPE podle ACK. */
  requestStatus(ev: InboxEvent): RequestStatus {
    if (
      storedEvents(this.d.runsDir, this.d.publish).some(
        (x) => x.request_id === ev.request_id && x.generation > ev.generation,
      )
    )
      return "SUPERSEDED";
    let ack: AckState | undefined;
    try {
      ack = lastAckState(this.d.runsDir, this.d.journal, ev.event_id);
    } catch {
      return "MUTATED"; // nečitelný ACK = jako by podání nešlo potvrdit (fail-closed)
    }
    if (ack === "SUPERSEDED") return "SUPERSEDED";
    if (ack === "REJECTED_SCOPE") return "REJECTED_SCOPE";
    if (ack === "HOLD(MUTATED)") return "MUTATED";
    return "OK";
  }

  /** Aktuální scope karta: receipt scope karty v journalu PR 3 musí ukazovat na řádek receiptu. Kolo scope karty je 0. */
  private scopeCard(
    ev: InboxEvent,
    receiptPage: string,
    receiptCard: string,
  ): CardRef | undefined {
    if (this.d.scopeCard) return this.d.scopeCard(ev);
    const rec = this.d.journal.get(scopeOp(ev.event_id));
    if (rec?.state !== "EFFECT_DONE" || rec.subject !== ev.event_id)
      return undefined;
    return pageIdFromUrl(rec.receipt?.url ?? "") === receiptPage
      ? { url: receiptCard, round: 0 }
      : undefined;
  }

  /** Revalidace scope receiptu události (§3.3) s porovnáním payload_hash proti události, prepare a bráně. */
  async revalidateScope(
    lease: LeaseView,
    ev: InboxEvent,
    scopeDecisionId: string,
    opts: { claimPayloadHash?: string; gatePayloadHash?: string } = {},
  ): Promise<RevalidateResult> {
    let r: ReturnType<typeof readDecisionReceipt>;
    try {
      r = readDecisionReceipt(this.d.runsDir, scopeDecisionId, this.d.publish);
    } catch (e) {
      return {
        ok: false,
        code: "RECEIPT_KIND",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
    const card = r
      ? this.scopeCard(ev, r.source.page_id, r.card_url)
      : undefined;
    return revalidateDecision(
      {
        runsDir: this.d.runsDir,
        lease,
        readRow: this.d.readRow,
        now: () => this.d.now(),
        publish: this.d.publish,
      },
      scopeDecisionId,
      {
        kind: "scope",
        eventPayloadHash: ev.payload_hash,
        claimPayloadHash: opts.claimPayloadHash,
        gatePayloadHash: opts.gatePayloadHash,
        requestStatus: this.requestStatus(ev),
        currentCard: card,
        rowTainted: false,
        rowSuperseded: false,
      },
    );
  }

  private claimDeps(
    t: Omit<DispatchTickInput, "mode" | "may_start_new">,
  ): ClaimDeps {
    return {
      runsDir: this.d.runsDir,
      store: this.d.store,
      lease: t.lease,
      dispatchSha256: t.dispatchSha256,
      allowedTypes: t.allowedTypes,
      readPayload: (ev) => this.d.readPayload(ev),
      ackVisible: (ev) =>
        this.d.journal.get(ackOp(ev.event_id, 0))?.state === "EFFECT_DONE",
      revalidateScope: (ev, id, h) =>
        this.revalidateScope(t.lease, ev, id, { claimPayloadHash: h }),
      ack: (ev, s) => this.d.ack(ev, s),
      now: () => this.d.now(),
      crashAt: this.d.crashAt,
      publish: this.d.publish,
    };
  }

  /** Obnova claimů (vždy) a nejvýš jeden nový claim (jen `run` + `may_start_new`, fronta max 1). */
  async tick(t: DispatchTickInput): Promise<DispatchTickResult> {
    const deps = this.claimDeps(t);
    const res: DispatchTickResult = {
      recovered: [],
      orphans: orphanInboxOrders(deps),
    };
    if (!t.lease.holds()) return res;
    for (const id of claimEventIds(this.d.runsDir)) {
      let ev: InboxEvent | undefined;
      try {
        ev = readEvent(this.d.runsDir, id, this.d.publish);
      } catch (e) {
        res.recovered.push({
          event_id: id,
          outcome: {
            kind: "hold",
            code: e instanceof InboxHold ? e.code : "EVENT_CONFLICT",
            detail: "událost nečitelná",
          },
        });
        continue;
      }
      if (!ev) {
        res.recovered.push({
          event_id: id,
          outcome: {
            kind: "hold",
            code: "UNKNOWN",
            detail: "claim bez uložené události",
          },
        });
        continue;
      }
      res.recovered.push({
        event_id: id,
        // §5 obnova: „složka bez prepare“ = celá kontrola znovu a prepare; to je nová práce, tedy jen run + may_start_new.
        outcome: await advanceClaim(deps, ev, {
          allowNew: t.mode === "run" && t.may_start_new,
        }),
      });
    }
    if (t.mode !== "run" || !t.may_start_new) return res;
    // Fronta max 1 (Q3-A): nový claim jen když žádná claimnutá wo-r* ještě nezačala běžet ani neskončila.
    const queued = this.d.store
      .listOrders()
      .some(
        (o) =>
          o.meta?.request_event_id &&
          (o.state === "NEW" || o.state === "PLANNED"),
      );
    if (queued) return res;
    const claimed = new Set(claimEventIds(this.d.runsDir));
    for (const ev of storedEvents(this.d.runsDir, this.d.publish)) {
      if (claimed.has(ev.event_id)) continue;
      if (this.requestStatus(ev) !== "OK") continue;
      if (!scopeReceiptFor(this.d.runsDir, ev.event_id, this.d.publish))
        continue;
      const out = await advanceClaim(deps, ev, { allowNew: true });
      if (out.kind === "skip") continue;
      res.claimed = { event_id: ev.event_id, outcome: out };
      break;
    }
    return res;
  }

  /** Smí orchestrátor zakázku `wo-r*` posunout? Commit + ACK CLAIMED + bez revoked (§5). Jinak důvod. */
  runnable(
    o: Order,
  ): { ok: true; ev: InboxEvent } | { ok: false; detail: string } {
    let ev: InboxEvent | undefined;
    try {
      ev = eventOfOrder(this.d.runsDir, o, this.d.publish);
    } catch (e) {
      return {
        ok: false,
        detail: `událost nečitelná: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    if (!ev || woIdFor(ev.event_id) !== o.id)
      return { ok: false, detail: "UNKNOWN: zakázka bez platné události" };
    let v: ReturnType<typeof claimView>;
    try {
      v = claimView(
        { runsDir: this.d.runsDir, publish: this.d.publish },
        ev.event_id,
      );
    } catch (e) {
      return {
        ok: false,
        detail: `claim nečitelný: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    if (!v.prepare) return { ok: false, detail: "UNKNOWN: wo-r bez prepare" };
    if (v.terminal)
      return {
        ok: false,
        detail: `claim ${v.terminal}: ${v.terminal_reason ?? ""}`,
      };
    if (!claimRunnable(v))
      return { ok: false, detail: "claim bez commitu nebo bez ACK CLAIMED" };
    return { ok: true, ev };
  }

  /**
   * Čerstvá revalidace scope receiptu zakázky `wo-r*` před krokem (INTENT) nebo efektem. Nesoulad po commitu =
   * `claim.revoked.json` + ACK HOLD(REVOKED); nečitelné = HOLD bez zápisu (další tick znovu).
   */
  async checkScope(
    lease: LeaseView,
    o: Order,
    gatePayloadHash?: string,
  ): Promise<ScopeCheck> {
    const run = this.runnable(o);
    if (!run.ok)
      return { ok: false, code: "SCOPE_GO_MISSING", detail: run.detail };
    const ev = run.ev;
    const v = claimView(
      { runsDir: this.d.runsDir, publish: this.d.publish },
      ev.event_id,
    );
    const scopeId = v.prepare!.scope_decision_id;
    if (o.meta.scope_decision_id !== scopeId)
      return {
        ok: false,
        code: "SCOPE_GO_MISSING",
        detail: "meta.scope_decision_id ≠ prepare",
      };
    const r = await this.revalidateScope(lease, ev, scopeId, {
      claimPayloadHash: v.prepare!.payload_hash,
      gatePayloadHash,
    });
    if (r.ok) return { ok: true, check: r.check };
    if (r.code !== "DECISION_UNREADABLE" && r.code !== "LEASE_LOST")
      await revokeClaim(
        {
          ...this.claimDeps({
            lease,
            dispatchSha256: undefined,
            allowedTypes: [],
          }),
        },
        ev,
        `${r.code}: ${r.detail}`,
        r.check,
      );
    return { ok: false, code: r.code, detail: r.detail };
  }
}
