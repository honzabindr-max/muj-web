// Etapa 4 PR 5 (NAVRH-v6 §5): claim jako trvalý protokol prepare/commit a jeho obnova.
//
// Všechno běží jen pod platným tick lease. Před každým zápisem (PREPARE, MANIFEST, COMMIT, ACK CLAIMED) se ověří
// fence a proběhne čerstvá revalidace scope receiptu (§3.3). Nesoulad = HOLD bez claimu: bez commitu vznikne
// `claim.hold.json`, s commitem `claim.revoked.json` (nic se nemaže). Záznamy jsou create-only (publishOnce, N-11),
// takže žádný krok nevznikne dvakrát a po pádu obnova pokračuje přesně od posledního trvalého záznamu.
//
//   runs/inbox/claims/<event_id>/claim.prepare.json   {event_id, request_id, generation, payload_hash, scope_decision_id, wo_id, fence, dispatch_sha256}
//   runs/<wo_id>/state.json                            verze 1 (Store.save, CAS z verze 0), meta.request_event_id, meta.claim_fence
//   runs/inbox/claims/<event_id>/claim.commit.json    {wo_id, state_version: 1, state_sha256, decision_check}
//   runs/inbox/claims/<event_id>/claim.ack.json       {commit_sha256, ack_n, readback_sha256}  (ACK CLAIMED doložený read-backem)
//   runs/inbox/claims/<event_id>/claim.{hold,revoked,aborted}.json   koncové záznamy s důvodem
import fs from "node:fs";
import path from "node:path";

import {
  DurabilityHold,
  LedgerPublishUnsupported,
  publishOnce,
  readPublished,
  rooted,
  type PublishOptions,
} from "../publish";
import { mkdirDurable, type Store } from "../store";
import type { Order } from "../types";
import { EVENT_ID_RE, InboxHold, sha256Hex, type LeaseView } from "./common";
import { readEvent, type InboxEvent } from "./event";
import { INBOX_TYPE_DEPARTMENT } from "./policy";
import { scopeReceiptFor, type RevalidateResult } from "./revalidate";

export type ClaimBoundary = "mkdir" | "prepare" | "manifest" | "commit" | "ack";

export const woIdFor = (eventId: string): string =>
  `wo-r${eventId.slice(0, 12)}`;
export const claimsRoot = (runsDir: string): string =>
  path.join(runsDir, "inbox", "claims");
export const claimDir = (runsDir: string, eventId: string): string =>
  path.join(claimsRoot(runsDir), eventId);
const F = {
  prepare: "claim.prepare.json",
  commit: "claim.commit.json",
  ack: "claim.ack.json",
  hold: "claim.hold.json",
  revoked: "claim.revoked.json",
  aborted: "claim.aborted.json",
} as const;
type ClaimFile = keyof typeof F;

export interface ClaimPrepare {
  v: 1;
  event_id: string;
  request_id: string;
  generation: number;
  payload_hash: string;
  scope_decision_id: string;
  wo_id: string;
  fence: number;
  dispatch_sha256: string;
}
export interface ClaimCommit {
  v: 1;
  wo_id: string;
  state_version: 1;
  state_sha256: string;
  decision_check: string;
  decision_check_sha256: string;
}
export interface ClaimAck {
  v: 1;
  commit_sha256: string;
  ack_n: number;
  readback_sha256: string;
}
export interface ClaimEnd {
  v: 1;
  reason: string;
  fence: number;
  at: string;
  check?: string;
}

/** Čerstvé přečtení podání (REST) pro kontrolu kroku 1. Chyba = výjimka (HOLD bez zápisu). */
export interface PayloadView {
  payload_hash: string;
  /** „Typ karty“ */
  type: string;
  /** titulek řádku („Požadavek“) */
  title: string;
  /** „Zadání“ */
  zadani: string;
}

export interface ClaimDeps {
  runsDir: string;
  store: Store;
  lease: LeaseView;
  /** sha256 `dispatch.json` platný v tomto ticku (undefined = soubor nečitelný → žádný nový prepare) */
  dispatchSha256: string | undefined;
  /** typy podání povolené v `dispatch.json` (`inbox_types`) */
  allowedTypes: readonly string[];
  readPayload(ev: InboxEvent): Promise<PayloadView>;
  /** ACK r0 má EFFECT_DONE s read-backem (úroveň `NOTION_VISIBLE`, §4) */
  ackVisible(ev: InboxEvent): boolean;
  /** revalidace scope receiptu (§3.3), `claimPayloadHash` od PREPARE */
  revalidateScope(
    ev: InboxEvent,
    scopeDecisionId: string,
    claimPayloadHash?: string,
  ): Promise<RevalidateResult>;
  /** ACK do Notionu (PATCH „Přijetí TARS“, PR 3 `ackStep`); v režimu hold vrací ok:false */
  ack(
    ev: InboxEvent,
    state: "CLAIMED" | "HOLD(REVOKED)",
  ): Promise<
    | { ok: true; n: number; readback_sha256: string }
    | { ok: false; detail: string }
  >;
  now(): string;
  /** jen testy: simulovaný pád po hranici (vzor lease-child.ts) */
  crashAt?(b: ClaimBoundary): void;
  publish?: PublishOptions;
}

export type ClaimOutcome =
  | { kind: "skip"; reason: string }
  | { kind: "claimed"; wo_id: string }
  | { kind: "progress"; wo_id: string; at: ClaimBoundary }
  | { kind: "hold"; code: string; detail: string; written?: ClaimFile };

const file = (
  deps: Pick<ClaimDeps, "runsDir">,
  ev: string,
  f: ClaimFile,
): string => path.join(claimDir(deps.runsDir, ev), F[f]);

function read<T>(
  deps: Pick<ClaimDeps, "runsDir" | "publish">,
  ev: string,
  f: ClaimFile,
): { bytes: Buffer; v: T } | undefined {
  let r: ReturnType<typeof readPublished>;
  try {
    r = readPublished(file(deps, ev, f), rooted(deps.runsDir, deps.publish));
  } catch (e) {
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  if (r.state === "absent") return undefined;
  try {
    return { bytes: r.bytes, v: JSON.parse(r.bytes.toString("utf8")) as T };
  } catch {
    throw new InboxHold("LEDGER_NOT_DURABLE", `${F[f]} nejde přečíst`);
  }
}

function write(deps: ClaimDeps, ev: string, f: ClaimFile, v: unknown): void {
  if (!deps.lease.holds())
    throw new InboxHold("LEASE_LOST", `před zápisem ${F[f]}`);
  let r: string;
  try {
    r = publishOnce(
      file(deps, ev, f),
      JSON.stringify(v, null, 2) + "\n",
      rooted(deps.runsDir, deps.publish),
    );
  } catch (e) {
    if (e instanceof LedgerPublishUnsupported)
      throw new InboxHold("LEDGER_PUBLISH_UNSUPPORTED", e.message);
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  if (r === "CONFLICT")
    throw new InboxHold("RECEIPT_CONFLICT", `${F[f]} existuje s jiným obsahem`);
}

/** Koncový záznam (hold/revoked/aborted) jen jednou; existuje-li už některý koncový, nic dalšího se nepíše. */
function end(
  deps: ClaimDeps,
  ev: string,
  f: "hold" | "revoked" | "aborted",
  reason: string,
  check?: string,
): ClaimOutcome {
  const rec: ClaimEnd = {
    v: 1,
    reason: reason.slice(0, 500),
    fence: deps.lease.fence,
    at: deps.now(),
    ...(check ? { check: path.basename(check) } : {}),
  };
  try {
    if (!terminalOf(deps, ev)) write(deps, ev, f, rec);
  } catch (e) {
    if (!(e instanceof InboxHold)) throw e;
    return { kind: "hold", code: e.code, detail: e.message };
  }
  return {
    kind: "hold",
    code:
      f === "revoked" ? "REVOKED" : f === "aborted" ? "ABORTED" : "CLAIM_HOLD",
    detail: reason,
    written: f,
  };
}

/** Koncový stav claimu (hold / revoked / aborted), undefined = claim živý. */
export function terminalOf(
  deps: Pick<ClaimDeps, "runsDir" | "publish">,
  ev: string,
): "hold" | "revoked" | "aborted" | undefined {
  for (const f of ["revoked", "hold", "aborted"] as const)
    if (fs.existsSync(file(deps, ev, f))) return f;
  return undefined;
}

export interface ClaimView {
  event_id: string;
  prepare?: ClaimPrepare;
  commit?: ClaimCommit;
  commit_sha256?: string;
  ack?: ClaimAck;
  terminal?: "hold" | "revoked" | "aborted";
  terminal_reason?: string;
}

/** Stav claimu z disku (pro dispatcher, orchestrátor a `cli.ts status`). Nečitelný záznam = výjimka InboxHold. */
export function claimView(
  deps: Pick<ClaimDeps, "runsDir" | "publish">,
  eventId: string,
): ClaimView {
  const p = read<ClaimPrepare>(deps, eventId, "prepare");
  const c = read<ClaimCommit>(deps, eventId, "commit");
  const a = read<ClaimAck>(deps, eventId, "ack");
  const t = terminalOf(deps, eventId);
  let reason: string | undefined;
  if (t) {
    try {
      reason = (
        JSON.parse(fs.readFileSync(file(deps, eventId, t), "utf8")) as ClaimEnd
      ).reason;
    } catch {
      reason = "?";
    }
  }
  return {
    event_id: eventId,
    ...(p ? { prepare: p.v } : {}),
    ...(c ? { commit: c.v, commit_sha256: sha256Hex(c.bytes) } : {}),
    ...(a ? { ack: a.v } : {}),
    ...(t ? { terminal: t, terminal_reason: reason } : {}),
  };
}

/** Smí dispatcher zakázku spustit? Jen s commitem, ACK CLAIMED (vázaným na commit) a bez koncového záznamu (§5). */
export function claimRunnable(v: ClaimView): boolean {
  return Boolean(
    v.commit && v.ack && !v.terminal && v.ack.commit_sha256 === v.commit_sha256,
  );
}

/** Brief zakázky `wo-r*` z podání (jen čtené sloupce; nic se nedomýšlí). */
export function briefFromPayload(
  ev: InboxEvent,
  p: PayloadView,
  scopeDecisionId: string,
): Order["brief"] {
  const department = INBOX_TYPE_DEPARTMENT[p.type];
  return {
    title: p.title.slice(0, 200) || `${ev.request_id}#${ev.generation}`,
    department,
    milestone: "inbox",
    why: `podání ${ev.request_id}#${ev.generation} se scope GO vlastníka (${scopeDecisionId.slice(0, 12)}, provenance observed)`,
    goal: p.zadani,
    inputs: [],
    acceptance: [],
    owner_decisions: [],
    sources: [],
  };
}

async function revalidate(
  deps: ClaimDeps,
  ev: InboxEvent,
  scopeId: string,
  claimHash?: string,
): Promise<RevalidateResult> {
  return deps.revalidateScope(ev, scopeId, claimHash);
}

/** Výsledek neúspěšné revalidace → koncový záznam (bez commitu hold, s commitem revoked); nečitelné = HOLD bez zápisu. */
async function onRevalFail(
  deps: ClaimDeps,
  ev: InboxEvent,
  r: Extract<RevalidateResult, { ok: false }>,
  hasCommit: boolean,
): Promise<ClaimOutcome> {
  if (r.code === "DECISION_UNREADABLE" || r.code === "LEASE_LOST")
    return { kind: "hold", code: r.code, detail: r.detail }; // 0 zápisů, další tick zkusí znovu
  if (!hasCommit)
    return end(deps, ev.event_id, "hold", `${r.code}: ${r.detail}`, r.check);
  const out = end(
    deps,
    ev.event_id,
    "revoked",
    `${r.code}: ${r.detail}`,
    r.check,
  );
  await deps.ack(ev, "HOLD(REVOKED)").catch(() => undefined); // best effort; claim.revoked.json je autorita
  return out;
}

/** Krok 1 (kontrola): ACK NOTION_VISIBLE, typ v allowlistu, podání znovu přečteno se stejným payload_hash, scope GO. */
async function check1(
  deps: ClaimDeps,
  ev: InboxEvent,
): Promise<
  | { ok: true; scopeId: string; payload: PayloadView }
  | { ok: false; outcome: ClaimOutcome }
> {
  if (!deps.ackVisible(ev))
    return {
      ok: false,
      outcome: { kind: "skip", reason: "ACK není NOTION_VISIBLE" },
    };
  const scope = scopeReceiptFor(deps.runsDir, ev.event_id, deps.publish);
  if (!scope)
    return {
      ok: false,
      outcome: {
        kind: "skip",
        reason: "SCOPE_GO_MISSING: scope receipt GO zatím není",
      },
    };
  let p: PayloadView;
  try {
    p = await deps.readPayload(ev);
  } catch (e) {
    return {
      ok: false,
      outcome: {
        kind: "hold",
        code: "PAYLOAD_INCOMPLETE",
        detail: String((e as Error)?.message ?? e).slice(0, 200),
      },
    };
  }
  if (p.payload_hash !== ev.payload_hash)
    return {
      ok: false,
      outcome: {
        kind: "hold",
        code: "MUTATED",
        detail: "podání upraveno, založ nové kolo",
      },
    };
  if (!deps.allowedTypes.includes(p.type) || !INBOX_TYPE_DEPARTMENT[p.type])
    return {
      ok: false,
      outcome: {
        kind: "hold",
        code: "EFFECT_NOT_ALLOWED",
        detail: `typ ${p.type.slice(0, 20)} není v allowlistu dispatch.json`,
      },
    };
  return { ok: true, scopeId: scope.decision_id, payload: p };
}

/**
 * Jeden průchod claimu události: založí nový claim, nebo dokončí rozpracovaný podle tabulky obnovy §5. Vrátí stav po
 * průchodu. `allowNew = false` (režim hold, první tick po hold → run) = žádný nový prepare, jen obnova existujícího.
 */
export async function advanceClaim(
  deps: ClaimDeps,
  ev: InboxEvent,
  opts: { allowNew: boolean },
): Promise<ClaimOutcome> {
  try {
    return await advance(deps, ev, opts);
  } catch (e) {
    if (e instanceof InboxHold)
      return { kind: "hold", code: e.code, detail: e.message };
    throw e;
  }
}

async function advance(
  deps: ClaimDeps,
  ev: InboxEvent,
  opts: { allowNew: boolean },
): Promise<ClaimOutcome> {
  if (!deps.lease.holds())
    return { kind: "hold", code: "LEASE_LOST", detail: "claim bez lease" };
  const id = ev.event_id;
  const wo = woIdFor(id);
  const dir = claimDir(deps.runsDir, id);
  const t = terminalOf(deps, id);
  if (t) return { kind: "hold", code: t.toUpperCase(), detail: `claim ${t}` };

  // bez složky: jen nový claim (a jen s allowNew)
  if (!fs.existsSync(dir)) {
    if (!opts.allowNew) return { kind: "skip", reason: "režim bez nové práce" };
    const c = await check1(deps, ev);
    if (!c.ok) return c.outcome;
    const r = await revalidate(deps, ev, c.scopeId);
    if (!r.ok) {
      if (r.code === "DECISION_UNREADABLE" || r.code === "LEASE_LOST")
        return { kind: "hold", code: r.code, detail: r.detail };
      mkdirDurable(dir);
      return end(deps, id, "hold", `${r.code}: ${r.detail}`, r.check);
    }
    if (!deps.lease.holds())
      return { kind: "hold", code: "LEASE_LOST", detail: "před mkdir" };
    mkdirDurable(dir);
    deps.crashAt?.("mkdir");
    return prepare(deps, ev, c.scopeId, wo);
  }

  const P = read<ClaimPrepare>(deps, id, "prepare");
  if (!P) {
    // složka bez prepare: celá kontrola znovu; neprojde → claim.aborted.json
    if (!opts.allowNew)
      return {
        kind: "skip",
        reason: "složka bez prepare, režim bez nové práce",
      };
    const c = await check1(deps, ev);
    if (!c.ok) {
      if (
        c.outcome.kind === "skip" ||
        (c.outcome.kind === "hold" && c.outcome.code === "PAYLOAD_INCOMPLETE")
      )
        return c.outcome;
      return end(
        deps,
        id,
        "aborted",
        c.outcome.kind === "hold"
          ? `${c.outcome.code}: ${c.outcome.detail}`
          : "kontrola neprošla",
      );
    }
    const r = await revalidate(deps, ev, c.scopeId);
    if (!r.ok) return onRevalFail(deps, ev, r, false);
    return prepare(deps, ev, c.scopeId, wo);
  }
  const p = P.v;
  // prepare, ale hash, scope nebo dispatch_sha256 nesedí → HOLD; fence vyšší než aktuální lease → HOLD
  const scope = scopeReceiptFor(deps.runsDir, id, deps.publish);
  if (
    p.v !== 1 ||
    p.event_id !== id ||
    p.wo_id !== wo ||
    p.payload_hash !== ev.payload_hash ||
    p.request_id !== ev.request_id ||
    p.generation !== ev.generation
  )
    return end(
      deps,
      id,
      "hold",
      "prepare nesedí s událostí (hash, identita nebo wo_id)",
    );
  if (!scope || scope.decision_id !== p.scope_decision_id)
    return end(deps, id, "hold", "prepare: scope receipt nesedí");
  if (p.fence > deps.lease.fence)
    return end(
      deps,
      id,
      "hold",
      `prepare s fence ${p.fence} > aktuální lease ${deps.lease.fence}`,
    );

  const stateFile = path.join(deps.runsDir, wo, "state.json");
  const C = read<ClaimCommit>(deps, id, "commit");
  // Tabulka obnovy §5: dispatch_sha256 se porovná, dokud claim nemá commit (claim vzniká jen pod politikou, pod kterou
  // začal). Po commitu je claim hotový; efekty hlídá `policy_revision` brány (§6.1).
  if (!C && (!deps.dispatchSha256 || p.dispatch_sha256 !== deps.dispatchSha256))
    return end(
      deps,
      id,
      "hold",
      "prepare: dispatch_sha256 nesedí s aktuálním dispatch.json",
    );
  if (!C) {
    const r = await revalidate(deps, ev, p.scope_decision_id, p.payload_hash);
    if (!r.ok) return onRevalFail(deps, ev, r, false);
    if (!fs.existsSync(stateFile)) return manifest(deps, ev, p);
    // prepare + state.json, bez commitu: meta.request_event_id a payload_hash musí sedět
    let o: Order;
    try {
      o = deps.store.load(wo);
    } catch {
      return end(deps, id, "hold", "state.json nejde přečíst");
    }
    if (
      o.meta?.request_event_id !== id ||
      o.meta?.payload_hash !== p.payload_hash ||
      o.version !== 1
    )
      return end(
        deps,
        id,
        "hold",
        "state.json nesedí s prepare (request_event_id, payload_hash nebo verze)",
      );
    return commit(deps, ev, wo, r);
  }
  const c = C.v;
  const commitSha = sha256Hex(C.bytes);
  const A = read<ClaimAck>(deps, id, "ack");
  if (A) {
    if (A.v.commit_sha256 !== commitSha)
      return end(deps, id, "revoked", "claim.ack.json neodkazuje na commit");
    return { kind: "claimed", wo_id: c.wo_id };
  }
  // commit, ACK není CLAIMED → revalidace → ACK CLAIMED
  const r = await revalidate(deps, ev, p.scope_decision_id, p.payload_hash);
  if (!r.ok) return onRevalFail(deps, ev, r, true);
  const a = await deps.ack(ev, "CLAIMED");
  if (!a.ok) return { kind: "hold", code: "ACK_NOT_DONE", detail: a.detail };
  write(deps, id, "ack", {
    v: 1,
    commit_sha256: commitSha,
    ack_n: a.n,
    readback_sha256: a.readback_sha256,
  } satisfies ClaimAck);
  deps.crashAt?.("ack");
  return { kind: "claimed", wo_id: c.wo_id };
}

async function prepare(
  deps: ClaimDeps,
  ev: InboxEvent,
  scopeId: string,
  wo: string,
): Promise<ClaimOutcome> {
  if (!deps.dispatchSha256)
    return {
      kind: "hold",
      code: "MODE_HOLD",
      detail: "dispatch.json nečitelný, prepare se nezapíše",
    };
  const rec: ClaimPrepare = {
    v: 1,
    event_id: ev.event_id,
    request_id: ev.request_id,
    generation: ev.generation,
    payload_hash: ev.payload_hash,
    scope_decision_id: scopeId,
    wo_id: wo,
    fence: deps.lease.fence,
    dispatch_sha256: deps.dispatchSha256,
  };
  write(deps, ev.event_id, "prepare", rec);
  deps.crashAt?.("prepare");
  // pokračování ve stejném průchodu (každý další zápis má vlastní revalidaci)
  return advance(deps, ev, { allowNew: false });
}

async function manifest(
  deps: ClaimDeps,
  ev: InboxEvent,
  p: ClaimPrepare,
): Promise<ClaimOutcome> {
  let payload: PayloadView;
  try {
    payload = await deps.readPayload(ev);
  } catch (e) {
    return {
      kind: "hold",
      code: "PAYLOAD_INCOMPLETE",
      detail: String((e as Error)?.message ?? e).slice(0, 200),
    };
  }
  if (payload.payload_hash !== p.payload_hash)
    return end(
      deps,
      ev.event_id,
      "hold",
      "MUTATED: podání se po prepare změnilo",
    );
  if (!INBOX_TYPE_DEPARTMENT[payload.type])
    return end(deps, ev.event_id, "hold", "typ podání se po prepare změnil");
  const at = deps.now();
  const order: Order = {
    id: p.wo_id,
    version: 0,
    mission: "inbox",
    state: "NEW",
    created_at: at,
    updated_at: at,
    brief: briefFromPayload(ev, payload, p.scope_decision_id),
    fix_rounds: 0,
    manual_interventions: 0,
    history: [],
    meta: {
      request_event_id: ev.event_id,
      request_id: ev.request_id,
      request_generation: String(ev.generation),
      payload_hash: p.payload_hash,
      scope_decision_id: p.scope_decision_id,
      claim_fence: String(deps.lease.fence),
    },
  };
  if (!deps.lease.holds())
    return { kind: "hold", code: "LEASE_LOST", detail: "před manifestem" };
  // CAS z verze 0: souběžné založení (nebo cizí state.json) odmítne
  if (!deps.store.save(order))
    return end(
      deps,
      ev.event_id,
      "hold",
      "manifest: CAS z verze 0 odmítnut (state.json už existuje)",
    );
  deps.crashAt?.("manifest");
  return advance(deps, ev, { allowNew: false });
}

async function commit(
  deps: ClaimDeps,
  ev: InboxEvent,
  wo: string,
  r: Extract<RevalidateResult, { ok: true }>,
): Promise<ClaimOutcome> {
  const bytes = fs.readFileSync(path.join(deps.runsDir, wo, "state.json"));
  write(deps, ev.event_id, "commit", {
    v: 1,
    wo_id: wo,
    state_version: 1,
    state_sha256: sha256Hex(bytes),
    decision_check: path.basename(r.check),
    decision_check_sha256: r.check_sha256,
  } satisfies ClaimCommit);
  deps.crashAt?.("commit");
  return advance(deps, ev, { allowNew: false });
}

/** Odvolání po commitu (revalidace před krokem/efektem selhala): `claim.revoked.json` jednou + ACK HOLD(REVOKED). */
export async function revokeClaim(
  deps: ClaimDeps,
  ev: InboxEvent,
  reason: string,
  check?: string,
): Promise<void> {
  if (terminalOf(deps, ev.event_id)) return;
  try {
    write(deps, ev.event_id, "revoked", {
      v: 1,
      reason: reason.slice(0, 500),
      fence: deps.lease.fence,
      at: deps.now(),
      ...(check ? { check: path.basename(check) } : {}),
    } satisfies ClaimEnd);
  } catch (e) {
    if (!(e instanceof InboxHold)) throw e;
  }
  await deps.ack(ev, "HOLD(REVOKED)").catch(() => undefined);
}

/** Události se složkou claimu (pro obnovu a `cli.ts status`). */
export function claimEventIds(runsDir: string): string[] {
  const d = claimsRoot(runsDir);
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d)
    .filter((x) => EVENT_ID_RE.test(x))
    .sort();
}

/** `wo-r*` se `state.json`, ke kterým neexistuje prepare (→ HOLD UNKNOWN, nikdy dispatch). */
export function orphanInboxOrders(
  deps: Pick<ClaimDeps, "runsDir" | "publish">,
): string[] {
  const out: string[] = [];
  if (!fs.existsSync(deps.runsDir)) return out;
  const prepared = new Set(
    claimEventIds(deps.runsDir).flatMap((e) => {
      try {
        const p = read<ClaimPrepare>(deps, e, "prepare");
        return p ? [p.v.wo_id] : [];
      } catch {
        return [];
      }
    }),
  );
  for (const d of fs.readdirSync(deps.runsDir))
    if (
      d.startsWith("wo-r") &&
      fs.existsSync(path.join(deps.runsDir, d, "state.json")) &&
      !prepared.has(d)
    )
      out.push(d);
  return out.sort();
}

/** Uložená událost zakázky `wo-r*` (z `meta.request_event_id`). */
export function eventOfOrder(
  runsDir: string,
  o: Pick<Order, "meta">,
  opts: PublishOptions = {},
): InboxEvent | undefined {
  const id = o.meta?.request_event_id;
  if (!id || !EVENT_ID_RE.test(id)) return undefined;
  return readEvent(runsDir, id, opts);
}
