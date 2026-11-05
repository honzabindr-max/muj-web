// Etapa 4 PR 5 (NAVRH-v6 §6.1, §6.4, N13, N14): brána efektu svázaná s journalem a s kontrolou.
//
// Každý vratný efekt (notion-draft, gh-push + gh-draft-pr, karta výsledku) a každý přechod do DONE projde touto bránou
// těsně před `EffectJournal.prepare` (efekt) nebo před přechodem (DONE):
//  - allowlist §6.4 podle třídy zakázky (`wo-r*` inbox / legacy `wo-*`), jinak HOLD `EFFECT_NOT_ALLOWED`,
//  - review receipt PASS nad přesně tímto artefaktem, kontrolor jiné rodiny než tvůrce (§6.2.3),
//  - čerstvá revalidace každého vyžadovaného receiptu rozhodnutí (scope / result, §3.3); chybí = `SCOPE_GO_MISSING` /
//    `RESULT_GO_MISSING`, nikdy revalidace jiného druhu,
//  - legacy bez review receiptu za kontrolou = HOLD `LEGACY_GATE` s migrační cestou,
//  - `notion-draft` jen pod rodiče z `private_draft_parents` a s `public_url === null` (GET těsně před POST), jinak
//    `EFFECT_NOT_ALLOWED`, 0 POST.
// Záznam brány `runs/<wo>/gate/<step>-r<n>.json` (writeDurable): READY → EFFECT_PREPARED → VERIFYING → DONE | HOLD.
// Neměnná pole se zapíší při READY; jiná hodnota při dalším průchodu = HOLD.
import fs from "node:fs";
import path from "node:path";

import type { DispatchRead } from "./dispatch";
import { readReviewReceipt } from "./reviews";
import { reissueRound } from "./state-machine";
import { writeDurable } from "./store";
import type { Department, ModelFamily, Order } from "./types";
import { sha256Hex, type LeaseView } from "./inbox/common";
import { readDecisionReceipt, type ResultBinding } from "./inbox/decision";
import type { InboxDispatcher } from "./inbox/dispatcher";
import {
  legacyStatus,
  orderClass,
  requiredFor,
  type EffectType,
  type RequiredReceipt,
} from "./inbox/policy";
import { revalidateDecision, type DecisionRowReader } from "./inbox/revalidate";

export type GateCode =
  | "EFFECT_NOT_ALLOWED"
  | "UNKNOWN"
  | "LEGACY_GATE"
  | "SCOPE_GO_MISSING"
  | "RESULT_GO_MISSING"
  | "REVIEW_MISMATCH"
  | "RECEIPT_KIND"
  | "REVOKED_OBSERVED"
  | "DECISION_UNREADABLE"
  | "LEASE_LOST"
  | "GATE_MISMATCH"
  | "READBACK_MISMATCH";

export type GateResult =
  | { ok: true; checks: string[] }
  | { ok: false; code: GateCode; detail: string; path?: string };

export type GateState =
  | "READY"
  | "EFFECT_PREPARED"
  | "VERIFYING"
  | "DONE"
  | "HOLD";

export interface GateImmutable {
  request_id: string | null;
  approved_payload_hash: string | null;
  operation_id: string;
  policy_revision: string;
  effect_type: EffectType[];
  required_receipts: RequiredReceipt[];
  scope_decision_id: string | null;
  result_decision_id: string | null;
  review_receipt_id: string | null;
  artifact_kind: "content" | "git";
  artifact_hash?: string;
  expected_git_commit_oid?: string;
}

export interface GateRecord {
  v: 1;
  state: GateState;
  fields: GateImmutable;
  resource_id?: string;
  readback_value?: string;
  hold?: string;
  history: Array<{ state: GateState; at: string }>;
}

/** Cíl DRAFTu přečtený přes REST (`GET /v1/pages/{parent}`); výjimka = chyba čtení. */
export type DraftTargetReader = (
  parentId: string,
) => Promise<{ public_url: string | null | undefined; complete: boolean }>;

export interface GateEnv {
  runsDir: string;
  lease(): LeaseView | undefined;
  dispatch(): DispatchRead;
  /** git HEAD kódu `tars/orch` (vstup `policy_revision`) */
  codeRevision: string;
  inbox?: InboxDispatcher;
  /** REST čtení řádku panelu s rozhodnutím (result receipt) */
  readResultRow?: DecisionRowReader;
  /** řádek panelu je znehodnocený / SUPERSEDED (PanelIndex) */
  rowFlags?(
    orderId: string,
    pageId: string,
  ): { tainted: boolean; superseded: boolean };
  draftTarget?: DraftTargetReader;
  now(): string;
}

export interface EffectCtx {
  effects: EffectType[];
  step: string;
  dept: Department;
  creatorFamily: ModelFamily;
  ownerNeeded: boolean;
  draftParentId: string;
  artifact:
    | { kind: "content"; hash: string | undefined }
    | { kind: "git"; oid: string | undefined };
}

const HEX64 = /^[0-9a-f]{64}$/;
const OID = /^[0-9a-f]{40}$/;

export const gateFile = (
  runsDir: string,
  orderId: string,
  step: string,
  round: number,
): string => path.join(runsDir, orderId, "gate", `${step}-r${round}.json`);

export function readGate(f: string): GateRecord | undefined {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as GateRecord;
  } catch {
    return undefined;
  }
}

/** Sjednocení požadavků více efektů jedné operace (dev: push + draft PR). */
function requirementsOf(
  o: Order,
  effects: EffectType[],
  dept: Department,
  ownerNeeded: boolean,
): { required: RequiredReceipt[] } | { code: GateCode; detail: string } {
  const cls = orderClass(o);
  const req = new Set<RequiredReceipt>();
  for (const e of effects) {
    const r = requiredFor(e, cls, dept, ownerNeeded);
    if (!r.allowed) return { code: r.code, detail: r.detail };
    for (const x of r.required) req.add(x);
  }
  return { required: [...req].sort() };
}

export class EffectGate {
  constructor(private env: GateEnv) {}

  private policyRevision(): string {
    const d = this.env.dispatch();
    return sha256Hex(`${d.sha256 ?? "none"}|${this.env.codeRevision}`);
  }

  /** Review receipt (§6.2.3): PASS, druh a otisk artefaktu, kontrolor jiné rodiny než tvůrce. */
  reviewProblem(
    o: Order,
    ctx: Pick<EffectCtx, "artifact" | "creatorFamily">,
  ): string | undefined {
    const rc = readReviewReceipt(path.join(this.env.runsDir, o.id), {
      review_id: o.meta.review_receipt_id,
      sha256: o.meta.review_receipt_sha256,
    });
    if (!rc) return "chybí platný review receipt s odkazem ze state.json";
    if (rc.order_id !== o.id) return "review receipt patří jiné zakázce";
    if (rc.verdict !== "PASS") return `verdikt review receiptu ${rc.verdict}`;
    if (rc.reviewer_family === ctx.creatorFamily)
      return "reviewer_family = creatorFamily";
    if (ctx.artifact.kind === "content") {
      if (
        rc.reviewed_artifact_kind !== "content" ||
        !ctx.artifact.hash ||
        rc.reviewed_artifact_hash !== ctx.artifact.hash
      )
        return "review receipt patří k jinému obsahu";
    } else if (
      rc.reviewed_artifact_kind !== "git" ||
      !ctx.artifact.oid ||
      rc.reviewed_git_commit_oid !== ctx.artifact.oid
    )
      return "review receipt patří k jinému commitu";
    return undefined;
  }

  /** Revalidace result receiptu zakázky (§3.3 result). Chybí = RESULT_GO_MISSING. */
  async checkResult(
    o: Order,
    ctx: Pick<EffectCtx, "artifact">,
  ): Promise<GateResult> {
    const lease = this.env.lease();
    if (!lease) return { ok: false, code: "LEASE_LOST", detail: "bez lease" };
    const id = o.meta.result_decision_id;
    if (!id || !HEX64.test(id))
      return {
        ok: false,
        code: "RESULT_GO_MISSING",
        detail: "chybí result receipt (GO vlastníka na kartě výsledku)",
      };
    if (!this.env.readResultRow)
      return {
        ok: false,
        code: "DECISION_UNREADABLE",
        detail: "REST čtení řádku panelu není k dispozici",
      };
    let rec: ReturnType<typeof readDecisionReceipt>;
    try {
      rec = readDecisionReceipt(this.env.runsDir, id);
    } catch (e) {
      return {
        ok: false,
        code: "RECEIPT_KIND",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
    const flags =
      rec && this.env.rowFlags
        ? this.env.rowFlags(o.id, rec.source.page_id)
        : { tainted: false, superseded: false };
    let round: number;
    try {
      round = reissueRound(o);
    } catch {
      return {
        ok: false,
        code: "RESULT_GO_MISSING",
        detail: "kolo karty nečitelné",
      };
    }
    const b = rec?.binding as ResultBinding | undefined;
    const r = await revalidateDecision(
      {
        runsDir: this.env.runsDir,
        lease,
        readRow: this.env.readResultRow,
        now: this.env.now,
      },
      id,
      {
        kind: "result",
        order_id: o.id,
        approvedHash: o.meta.approved_hash,
        // content: wo-r* váže result GO na otisk finálního těla brány (render musí být identický, §6.2.1 bod 7);
        // legacy na `meta.artifact_hash` = otisk read-backu, který vlastník na kartě viděl (DR-039, jako dnes).
        artifactHash:
          ctx.artifact.kind === "content"
            ? orderClass(o) === "inbox"
              ? ctx.artifact.hash
              : o.meta.artifact_hash
            : undefined,
        gitOid: ctx.artifact.kind === "git" ? ctx.artifact.oid : undefined,
        option:
          o.meta.owner_option === "A" || o.meta.owner_option === "B"
            ? o.meta.owner_option
            : undefined,
        currentCard: o.owner_card_url
          ? { url: o.owner_card_url, round }
          : undefined,
        rowTainted: flags.tainted,
        rowSuperseded: flags.superseded,
      },
    );
    if (!r.ok)
      return {
        ok: false,
        code: r.code === "RECEIPT_MISSING" ? "RESULT_GO_MISSING" : r.code,
        detail: r.detail,
      };
    if (b && b.artifact_kind !== ctx.artifact.kind)
      return {
        ok: false,
        code: "RECEIPT_KIND",
        detail: "druh artefaktu result receiptu nesedí",
      };
    return { ok: true, checks: [r.check] };
  }

  /** Společné kontroly efektu i přechodu: allowlist, legacy brána, review, scope, result. */
  private async common(
    o: Order,
    ctx: EffectCtx,
    gatePayloadHash?: string,
  ): Promise<GateResult & { required?: RequiredReceipt[] }> {
    const req = requirementsOf(o, ctx.effects, ctx.dept, ctx.ownerNeeded);
    if ("code" in req) return { ok: false, code: req.code, detail: req.detail };
    const cls = orderClass(o);
    const checks: string[] = [];
    if (cls === "legacy") {
      const ls = legacyStatus(o, ctx.dept);
      if (ls.state === "HOLD")
        return {
          ok: false,
          code: "LEGACY_GATE",
          detail: ls.detail,
          path: ls.path,
        };
    }
    if (req.required.includes("review")) {
      const p = this.reviewProblem(o, ctx);
      if (p)
        return cls === "legacy"
          ? { ok: false, code: "LEGACY_GATE", detail: p, path: legacyPath(o) }
          : { ok: false, code: "REVIEW_MISMATCH", detail: p };
    }
    if (req.required.includes("scope")) {
      const lease = this.env.lease();
      if (!lease) return { ok: false, code: "LEASE_LOST", detail: "bez lease" };
      if (!this.env.inbox)
        return {
          ok: false,
          code: "SCOPE_GO_MISSING",
          detail: "dispatcher inboxu není zapojený",
        };
      const s = await this.env.inbox.checkScope(lease, o, gatePayloadHash);
      if (!s.ok)
        return { ok: false, code: s.code as GateCode, detail: s.detail };
      checks.push(s.check);
    }
    if (req.required.includes("result")) {
      const r = await this.checkResult(o, ctx);
      if (!r.ok) return r;
      checks.push(...r.checks);
    }
    return { ok: true, checks, required: req.required };
  }

  /** N14: rodič DRAFTu z allowlistu a `public_url === null` (čerstvé REST čtení). */
  private async privateTarget(parentId: string): Promise<GateResult> {
    const id = parentId.replace(/-/g, "").toLowerCase();
    const allow = this.env.dispatch().config.private_draft_parents;
    if (!allow.includes(id))
      return {
        ok: false,
        code: "EFFECT_NOT_ALLOWED",
        detail: "cílová stránka DRAFTu není v private_draft_parents",
      };
    if (!this.env.draftTarget)
      return {
        ok: false,
        code: "EFFECT_NOT_ALLOWED",
        detail: "kontrola public_url není k dispozici (Notion REST)",
      };
    let t: Awaited<ReturnType<DraftTargetReader>>;
    try {
      t = await this.env.draftTarget(id);
    } catch {
      return {
        ok: false,
        code: "EFFECT_NOT_ALLOWED",
        detail: "cílovou stránku DRAFTu nejde přečíst",
      };
    }
    if (!t.complete || t.public_url !== null)
      return {
        ok: false,
        code: "EFFECT_NOT_ALLOWED",
        detail: t.complete
          ? "cílová stránka je publikovaná na web (public_url)"
          : "neúplná odpověď",
      };
    return { ok: true, checks: [] };
  }

  /**
   * Brána před efektem (těsně před `EffectJournal.prepare`). Zapíše READY (neměnná pole) a po všech kontrolách
   * EFFECT_PREPARED. Jakýkoli nesoulad = HOLD (záznam `HOLD`), 0 efekt.
   */
  async beforeEffect(o: Order, ctx: EffectCtx): Promise<GateResult> {
    const round = o.fix_rounds;
    const f = gateFile(this.env.runsDir, o.id, ctx.step, round);
    const cls = orderClass(o);
    const scopeId = cls === "inbox" ? (o.meta.scope_decision_id ?? null) : null;
    const scopeRc =
      scopeId && HEX64.test(scopeId)
        ? safeReceipt(this.env.runsDir, scopeId)
        : undefined;
    const payloadHash =
      scopeRc?.receipt_kind === "scope"
        ? ((scopeRc.binding as { payload_hash: string }).payload_hash ?? null)
        : null;
    const req = requirementsOf(o, ctx.effects, ctx.dept, ctx.ownerNeeded);
    const fields: GateImmutable = {
      request_id: cls === "inbox" ? (o.meta.request_id ?? null) : null,
      approved_payload_hash: payloadHash,
      operation_id: `${o.id}/${ctx.step}/r${round}`,
      policy_revision: this.policyRevision(),
      effect_type: [...ctx.effects],
      required_receipts: "required" in req ? req.required : [],
      scope_decision_id: scopeId,
      result_decision_id:
        "required" in req && req.required.includes("result")
          ? (o.meta.result_decision_id ?? null)
          : null,
      review_receipt_id: o.meta.review_receipt_id ?? null,
      artifact_kind: ctx.artifact.kind,
      ...(ctx.artifact.kind === "content"
        ? { artifact_hash: ctx.artifact.hash }
        : { expected_git_commit_oid: ctx.artifact.oid }),
    };
    // §6.1: formát identity artefaktu (64 hex vs. 40 hex), git OID se nikdy neporovnává se SHA-256.
    // Legacy vizual finální tělo nemá (viz policy.requiredFor): identita se u něj nevyžaduje.
    const needIdentity = !(cls === "legacy" && ctx.dept === "vizual");
    if (
      needIdentity &&
      (ctx.artifact.kind === "content"
        ? !HEX64.test(ctx.artifact.hash ?? "")
        : !OID.test(ctx.artifact.oid ?? ""))
    )
      return this.hold(
        f,
        fields,
        cls === "legacy"
          ? {
              ok: false,
              code: "LEGACY_GATE",
              detail:
                "legacy zakázka bez finálního těla nebo zkontrolovaného commitu",
              path: legacyPath(o),
            }
          : {
              ok: false,
              code: "GATE_MISMATCH",
              detail: "identita artefaktu chybí nebo má špatný formát",
            },
      );
    const prev = readGate(f);
    if (prev) {
      if (prev.state === "HOLD")
        return {
          ok: false,
          code: "GATE_MISMATCH",
          detail: `brána ${path.basename(f)} je HOLD: ${prev.hold ?? ""}`,
        };
      if (JSON.stringify(prev.fields) !== JSON.stringify(fields))
        return this.hold(f, prev.fields, {
          ok: false,
          code: "GATE_MISMATCH",
          detail: "neměnná pole brány se změnila",
        });
    } else
      this.write(f, {
        v: 1,
        state: "READY",
        fields,
        history: [{ state: "READY", at: this.env.now() }],
      });
    const c = await this.common(o, ctx, payloadHash ?? undefined);
    if (!c.ok) return this.hold(f, fields, c);
    if (ctx.effects.includes("notion-draft")) {
      const t = await this.privateTarget(ctx.draftParentId);
      if (!t.ok) return this.hold(f, fields, t);
    }
    const cur = readGate(f)!;
    if (cur.state === "READY")
      this.write(f, {
        ...cur,
        state: "EFFECT_PREPARED",
        history: [
          ...cur.history,
          { state: "EFFECT_PREPARED", at: this.env.now() },
        ],
      });
    return { ok: true, checks: c.checks };
  }

  /**
   * PR 5 FIX1 (5-K1-3): čerstvá revalidace uvnitř efektu, který má víc externích kroků (gh-push, pak gh-draft-pr).
   * Volá se těsně před každým krokem; brána musí být EFFECT_PREPARED z `beforeEffect` téhož kola. Kontroly jako
   * `beforeEffect` (allowlist, legacy, review, scope, result) s neměnnými poli ze záznamu. Nesoulad = HOLD, 0 krok.
   */
  async recheck(o: Order, ctx: EffectCtx): Promise<GateResult> {
    const f = gateFile(this.env.runsDir, o.id, ctx.step, o.fix_rounds);
    const cur = readGate(f);
    if (!cur || cur.state !== "EFFECT_PREPARED")
      return {
        ok: false,
        code: "GATE_MISMATCH",
        detail: `brána ${path.basename(f)} není EFFECT_PREPARED (${cur?.state ?? "chybí"})`,
      };
    const c = await this.common(
      o,
      ctx,
      cur.fields.approved_payload_hash ?? undefined,
    );
    if (!c.ok) return this.hold(f, cur.fields, c);
    return { ok: true, checks: c.checks };
  }

  /** Po efektu: VERIFYING s `resource_id` (z receiptu EFFECT_DONE). */
  afterEffect(o: Order, step: string, resourceId: string): void {
    const f = gateFile(this.env.runsDir, o.id, step, o.fix_rounds);
    const cur = readGate(f);
    if (!cur || cur.state !== "EFFECT_PREPARED") return;
    this.write(f, {
      ...cur,
      state: "VERIFYING",
      resource_id: resourceId,
      history: [...cur.history, { state: "VERIFYING", at: this.env.now() }],
    });
  }

  /** Read-back: DONE jen při přesné shodě s identitou artefaktu, jinak HOLD `READBACK_MISMATCH`. */
  verify(o: Order, step: string, readback: string): GateResult {
    const f = gateFile(this.env.runsDir, o.id, step, o.fix_rounds);
    const cur = readGate(f);
    if (!cur)
      return { ok: false, code: "GATE_MISMATCH", detail: "záznam brány chybí" };
    if (cur.state === "DONE")
      return cur.readback_value === readback
        ? { ok: true, checks: [] }
        : {
            ok: false,
            code: "READBACK_MISMATCH",
            detail: "read-back se změnil",
          };
    if (cur.state !== "VERIFYING")
      return {
        ok: false,
        code: "GATE_MISMATCH",
        detail: `brána ve stavu ${cur.state}`,
      };
    const want =
      cur.fields.artifact_kind === "content"
        ? cur.fields.artifact_hash
        : cur.fields.expected_git_commit_oid;
    if (readback !== want) {
      this.write(f, {
        ...cur,
        state: "HOLD",
        readback_value: readback,
        hold: "READBACK_MISMATCH",
        history: [...cur.history, { state: "HOLD", at: this.env.now() }],
      });
      return {
        ok: false,
        code: "READBACK_MISMATCH",
        detail: "read-back ≠ identita artefaktu brány",
      };
    }
    this.write(f, {
      ...cur,
      state: "DONE",
      readback_value: readback,
      history: [...cur.history, { state: "DONE", at: this.env.now() }],
    });
    return { ok: true, checks: [] };
  }

  /** Brána před přechodem (owner-card, DONE). Bez záznamu operace; revalidace čerstvě před přechodem. */
  async beforeTransition(
    o: Order,
    ctx: Omit<EffectCtx, "step" | "draftParentId">,
  ): Promise<GateResult> {
    const scopeId =
      orderClass(o) === "inbox" ? o.meta.scope_decision_id : undefined;
    const rc =
      scopeId && HEX64.test(scopeId)
        ? safeReceipt(this.env.runsDir, scopeId)
        : undefined;
    const ph =
      rc?.receipt_kind === "scope"
        ? (rc.binding as { payload_hash: string }).payload_hash
        : undefined;
    return this.common(
      o,
      { ...ctx, step: "transition", draftParentId: "" },
      ph,
    );
  }

  private hold(
    f: string,
    fields: GateImmutable,
    r: Extract<GateResult, { ok: false }>,
  ): GateResult {
    // Přechodná nečitelnost nebo ztráta lease: HOLD bez záznamu, 0 efekt; další tick se zeptá znovu.
    if (isTransient(r.code)) return r;
    const cur = readGate(f);
    const base: GateRecord = cur ?? {
      v: 1,
      state: "READY",
      fields,
      history: [],
    };
    if (base.state !== "HOLD" && base.state !== "DONE")
      this.write(f, {
        ...base,
        state: "HOLD",
        hold: `${r.code}: ${r.detail}`.slice(0, 300),
        history: [...base.history, { state: "HOLD", at: this.env.now() }],
      });
    return r;
  }

  private write(f: string, r: GateRecord): void {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    writeDurable(f, JSON.stringify(r, null, 2) + "\n");
  }
}

/**
 * N14: produkční čtení cílové stránky DRAFTu přes REST (`GET /v1/pages/{id}`, jen čtení). Úplná odpověď = objekt
 * `page` se stejným ID, mimo koš, s polem `public_url`. TARS nikdy nevolá operaci, která mění sdílení nebo publikaci.
 */
export function restDraftTarget(api: {
  request<T>(method: "GET", path: string): Promise<T>;
}): DraftTargetReader {
  return async (parentId) => {
    const j = await api.request<{
      object?: unknown;
      id?: unknown;
      in_trash?: unknown;
      public_url?: unknown;
    }>("GET", `/v1/pages/${parentId}`);
    const complete =
      j?.object === "page" &&
      typeof j.id === "string" &&
      j.id.replace(/-/g, "").toLowerCase() === parentId &&
      j.in_trash !== true &&
      "public_url" in j &&
      (j.public_url === null || typeof j.public_url === "string");
    return {
      complete,
      public_url: complete ? (j.public_url as string | null) : undefined,
    };
  };
}

/** Nečitelné rozhodnutí a ztráta lease nejsou nesoulad: zakázka zůstává, další tick zkusí znovu (nikdy efekt). */
export const isTransient = (code: string): boolean =>
  code === "DECISION_UNREADABLE" || code === "LEASE_LOST";

function safeReceipt(runsDir: string, id: string) {
  try {
    return readDecisionReceipt(runsDir, id);
  } catch {
    return undefined;
  }
}

function legacyPath(o: Order): string {
  const s = legacyStatus({
    ...o,
    meta: { ...o.meta, review_receipt_id: "", review_receipt_sha256: "" },
  });
  return s.state === "HOLD"
    ? s.path
    : "nové kolo kontroly vytvoří review receipt";
}
