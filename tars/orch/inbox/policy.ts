// Etapa 4 PR 5 (NAVRH-v6 §6.4, N10–N14): allowlist „který receipt potřebuje který efekt“, třída zakázky (inbox `wo-r*`
// vs. legacy `wo-*`), legacy brána s migrační cestou a pravidla merge podle DR-024. Čistý kód bez I/O.
//
// Tabulka §6.4 je allowlist: efekt nebo přechod, který v ní není, = HOLD `EFFECT_NOT_ALLOWED`. Owner GO nikdy nevznikne
// automaticky; tady se jen určuje, které receipty se musí čerstvě revalidovat (§3.3) těsně před efektem nebo přechodem.
import { artifactHash } from "../approval";
import type { Department, Order } from "../types";

/** Efekty a přechody z tabulky §6.4. */
export type EffectType =
  | "panel-ack"
  | "notion-draft"
  | "gh-push"
  | "gh-draft-pr"
  | "owner-card"
  | "done"
  | "merge";

export type RequiredReceipt = "scope" | "review" | "result";

/** Typy podání inboxu, které umí dispatcher (Typ karty → oddělení). */
export const INBOX_TYPE_DEPARTMENT: Readonly<Record<string, Department>> = {
  fable: "copy",
  dev: "dev",
};

/**
 * Plán efektů typu zakázky (§6.4 pravidla): jeden scope GO povoluje jen tyto operace, každou nejvýš jednou na kolo
 * (journal podle `operation_id`). Cokoli jiného = `EFFECT_NOT_ALLOWED`.
 */
export const EFFECT_PLAN: Readonly<Record<Department, readonly EffectType[]>> =
  {
    copy: ["notion-draft"],
    vizual: ["notion-draft"],
    dev: ["gh-push", "gh-draft-pr"],
  };

export type OrderClass = "inbox" | "legacy" | "unknown";

/**
 * N13: `wo-r*` vzniklá claimem má `meta.request_event_id`. Zakázka s prefixem `wo-r` bez něj se za inbox jen vydává
 * = `unknown` (HOLD `UNKNOWN`, nikdy dispatch). Ostatní (`wo-<čas>` supervizora) = legacy.
 */
export function orderClass(o: Pick<Order, "id" | "meta">): OrderClass {
  const ev = o.meta?.request_event_id;
  if (ev !== undefined)
    return /^[0-9a-f]{32}$/.test(ev) && o.id === `wo-r${ev.slice(0, 12)}`
      ? "inbox"
      : "unknown";
  return o.id.startsWith("wo-r") ? "unknown" : "legacy";
}

export type Requirement =
  | { allowed: true; required: RequiredReceipt[] }
  | { allowed: false; code: "EFFECT_NOT_ALLOWED" | "UNKNOWN"; detail: string };

const deny = (
  detail: string,
  code: "EFFECT_NOT_ALLOWED" | "UNKNOWN" = "EFFECT_NOT_ALLOWED",
): Requirement => ({
  allowed: false,
  code,
  detail,
});

/**
 * Tabulka §6.4. `ownerNeeded` se počítá jako dnes (alwaysOwner, owner_decisions, reservedDecisionHits). Q9 = A
 * (rozhodnutí vlastníka 4. 11.): fable bez důvodu jde do DONE se scope GO + PASS + read-back, bez result GO.
 */
export function requiredFor(
  effect: EffectType,
  cls: OrderClass,
  dept: Department | undefined,
  ownerNeeded: boolean,
): Requirement {
  if (cls === "unknown")
    return deny(
      "zakázka wo-r bez meta.request_event_id (nebo s jiným ID)",
      "UNKNOWN",
    );
  if (!dept) return deny("zakázka bez oddělení");
  const plan = EFFECT_PLAN[dept];
  if (cls === "inbox") {
    if (dept === "vizual") return deny("inbox dispatcher typ vizual nemá");
    switch (effect) {
      case "panel-ack":
        return { allowed: true, required: [] };
      case "notion-draft":
      case "gh-push":
      case "gh-draft-pr":
        return plan.includes(effect)
          ? { allowed: true, required: ["scope", "review"] }
          : deny(`${effect} není v plánu typu ${dept}`);
      case "owner-card":
        return { allowed: true, required: ["scope", "review"] };
      case "done":
        if (ownerNeeded)
          return { allowed: true, required: ["scope", "review", "result"] };
        return dept === "copy"
          ? { allowed: true, required: ["scope", "review"] }
          : deny("DONE bez vlastníka jen pro fable (dev má alwaysOwner)");
      case "merge":
        return deny(
          "merge z inbox dispatch není v allowlistu (§6.4, DR-024 jen stávajícím procesem)",
        );
    }
  }
  // legacy (N13): scope receipt neexistuje a nevyžaduje se; review receipt ano; result GO pro každý přechod třídy B.
  // Výjimka vizual: oddělení review receipt nemá (PR 4a ho zavedl jen pro copy a dev); jeho efekt jde jako dnes
  // (GPT brána oddělení), přesto jen do soukromého cíle (N14) a DONE s vlastníkem jen po result GO. Známé riziko v reportu.
  const review: RequiredReceipt[] = dept === "vizual" ? [] : ["review"];
  switch (effect) {
    case "notion-draft":
    case "gh-push":
    case "gh-draft-pr":
      return plan.includes(effect)
        ? { allowed: true, required: review }
        : deny(`${effect} není v plánu oddělení ${dept}`);
    case "owner-card":
      return { allowed: true, required: review };
    case "done":
      return {
        allowed: true,
        required: ownerNeeded ? [...review, "result"] : review,
      };
    default:
      return deny(`${effect} není pro legacy zakázku v allowlistu`);
  }
}

/** Druh artefaktu efektu (§6.1). */
export const artifactKindOf = (dept: Department): "content" | "git" =>
  dept === "dev" ? "git" : "content";

// ───────────────────────────── legacy brána (N13) ─────────────────────────────

export type LegacyStatus =
  | { state: "OK" }
  | { state: "TERMINAL" }
  | { state: "HOLD"; code: "LEGACY_GATE"; detail: string; path: string };

/**
 * Splní rozpracovaná legacy `wo-*` bránu? Review receipt (§6.2) je nutný pro každý vratný efekt i pro DONE. Zakázka,
 * která ho nemá a už je za kontrolou (PASS vznikl před PR 4a), jde do HOLD `LEGACY_GATE` s migrační cestou.
 * Zakázka před kontrolou (NEW … CHECKING, FIXING) bránu zatím splňuje: receipt vznikne v běžném kole kontroly.
 */
export function legacyStatus(
  o: Pick<Order, "state" | "meta" | "brief" | "delivered_url">,
  /** oddělení podle runneru (orchestrátor `effectDept`); výchozí z briefu */
  effectDept?: Department,
): LegacyStatus {
  if (["DONE", "FAILED", "UNKNOWN"].includes(o.state))
    return { state: "TERMINAL" };
  const afterCheck = o.state === "DELIVERED" || o.state === "WAITING_OWNER";
  if (!afterCheck) return { state: "OK" };
  const hasReceipt = Boolean(
    o.meta.review_receipt_id && o.meta.review_receipt_sha256,
  );
  const dept = effectDept ?? o.brief?.department;
  // vizual review receipt ani finální tělo nemá (PR 4a je zavedl jen pro copy a dev): brána ho nevyžaduje, viz requiredFor.
  if (dept === "vizual") return { state: "OK" };
  const hasBody =
    dept === "dev" ||
    Boolean(o.meta.final_body_file && o.meta.final_body_sha256);
  if (hasReceipt && hasBody) return { state: "OK" };
  const missing = [
    !hasReceipt ? "review receipt" : "",
    !hasBody ? "finální tělo" : "",
  ]
    .filter(Boolean)
    .join(" a ");
  return {
    state: "HOLD",
    code: "LEGACY_GATE",
    detail: `legacy zakázka bez ${missing} (PASS vznikl před PR 4a)`,
    path:
      o.state === "WAITING_OWNER"
        ? 'nové kolo kontroly: `cli.ts abort <id> "LEGACY_GATE"` a novou zakázku založí supervizor (nové kolo kontroly vytvoří review receipt, nová karta výsledku nový result GO); bez result GO DONE nikdy'
        : 'nové kolo kontroly: `cli.ts abort <id> "LEGACY_GATE"` a novou zakázku založí supervizor (finální tělo + review receipt); doručení bez receiptu se nespustí',
  };
}

// ───────────────────────────── merge podle DR-024 (N12) ─────────────────────────────

export interface MergeRequest {
  /** třída PR podle obsahu (DR-024); undefined nebo sporná = B (fail-closed) */
  prClass: "A" | "B" | undefined;
  ciGreen: boolean;
  /** nezávislý PASS (review Codexu nad diffem, DR-031) nad přesným HEAD */
  reviewPass: boolean;
  reviewedHead: string;
  /** HEAD znovu přečtený těsně před merge (`gh pr view --json headRefOid`) */
  headNow: string;
  /** výsledek čerstvé revalidace result receiptu (approved_hash = artifactHash(headRefOid)), undefined = žádný */
  resultGo?: { ok: boolean; approvedHash: string };
  /** výjimka DR-034 deklarovaná v PR; automaticky se nikdy nepoužije */
  dr034Exception?: boolean;
  /** výslovné GO vlastníka na kartě k výjimce DR-034 */
  dr034OwnerGo?: boolean;
  /** merge žádá inbox dispatcher (`wo-r*`) */
  fromInbox?: boolean;
}

export type MergeVerdict =
  | { allow: true }
  | {
      allow: false;
      code:
        | "EFFECT_NOT_ALLOWED"
        | "RESULT_GO_MISSING"
        | "REVIEW_MISMATCH"
        | "CI_NOT_GREEN";
      detail: string;
    };

/**
 * DR-024 (§6.4 N12, §14): třída A = zelené CI + nezávislý PASS, bez result GO. Třída B (i neurčená) = navíc result GO
 * k přesnému HEAD. „Merge do main“ třídu A na B nepřevádí. Výjimka DR-034 bez výslovného GO = HOLD. Inbox = nikdy.
 * Čistá funkce: sama nic nemerguje (v kódu TARS žádný merge není).
 */
export function mergeVerdict(m: MergeRequest): MergeVerdict {
  if (m.fromInbox)
    return {
      allow: false,
      code: "EFFECT_NOT_ALLOWED",
      detail: "merge z inbox dispatch není v allowlistu",
    };
  if (!m.ciGreen)
    return { allow: false, code: "CI_NOT_GREEN", detail: "CI není zelené" };
  if (!m.reviewPass)
    return {
      allow: false,
      code: "REVIEW_MISMATCH",
      detail: "chybí nezávislý PASS",
    };
  if (!/^[0-9a-f]{40}$/.test(m.headNow) || m.reviewedHead !== m.headNow)
    return {
      allow: false,
      code: "REVIEW_MISMATCH",
      detail: "PASS patří k jinému HEAD",
    };
  const cls = m.prClass === "A" && !m.dr034Exception ? "A" : "B";
  if (m.dr034Exception && !m.dr034OwnerGo)
    return {
      allow: false,
      code: "RESULT_GO_MISSING",
      detail: "výjimka DR-034 bez výslovného GO vlastníka",
    };
  if (cls === "A") return { allow: true };
  if (!m.resultGo?.ok)
    return {
      allow: false,
      code: "RESULT_GO_MISSING",
      detail: "třída B bez platného result GO",
    };
  if (m.resultGo.approvedHash !== artifactHash(m.headNow))
    return {
      allow: false,
      code: "RESULT_GO_MISSING",
      detail: "result GO patří k jinému HEAD, nová karta",
    };
  return { allow: true };
}
