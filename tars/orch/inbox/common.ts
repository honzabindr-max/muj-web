// Etapa 4 PR 3 (DR-042, mapa inboxu v6): společné typy inboxu — kódy HOLD, kanonický JSON, otisky, lease a režim.
// Nic tady nezapisuje do Notionu ani na disk.
import { createHash } from "node:crypto";

import type { Store } from "../store";

/** Všechny důvody HOLD inboxu. Každý HOLD = 0 HTTP zápisů v tomto kroku, nic se nemaže ani nepřepisuje. */
export type InboxHoldCode =
  | "MODE_HOLD"
  | "INVALID_IDENTITY"
  | "PRODUCER_MISMATCH"
  | "DUPLICATE"
  | "MUTATED"
  | "EVENT_CONFLICT"
  | "EVENT8_COLLISION"
  | "INBOX_SCAN_INCOMPLETE"
  | "PAYLOAD_INCOMPLETE"
  | "LEASE_LOST"
  | "LEDGER_PUBLISH_UNSUPPORTED"
  | "LEDGER_NOT_DURABLE"
  | "SEND_INTENT_CONFLICT"
  | "SEND_INTENT_FOREIGN"
  | "ACK_LEDGER_CONFLICT"
  | "ACK_LEDGER_CORRUPT"
  | "ACK_LEDGER_MISSING"
  | "ACK_MISMATCH"
  | "ACK_UNREADABLE"
  | "ACK_TRANSITION"
  | "ACK_NOT_DONE"
  | "EFFECT_UNKNOWN"
  | "EFFECT_PENDING"
  | "EFFECT_RETRY"
  | "SCOPE_LEDGER_MISSING"
  | "SCOPE_LEDGER_CONFLICT"
  | "SCOPE_BODY_MISSING"
  | "SCOPE_BODY_CORRUPT"
  | "SCOPE_BODY_REJECTED"
  | "SCOPE_CONTEXT_MISMATCH"
  | "SCOPE_BODY_SEMANTIC_MISMATCH"
  | "SCOPE_BINDING_MISMATCH"
  | "SCOPE_PROVENANCE_UNPROVEN"
  | "SCOPE_CARD_UNKNOWN"
  | "DUPLICATE_SCOPE_CARD"
  | "FOREIGN_SCOPE_CARD"
  | "RECEIPT_KIND"
  | "RECEIPT_CONFLICT"
  | "DECISION_UNREADABLE"
  /** dodatek PR 5 (P20): poslední zápis řádku s rozhodnutím neudělal ověřený vlastník */
  | "OWNER_ORIGIN_UNVERIFIED";

export class InboxHold extends Error {
  constructor(
    public readonly code: InboxHoldCode,
    detail = "",
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export const sha256Hex = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

/** Porovnání podle kódových bodů (ne UTF-16 jednotek): kanonický tvar L2. */
function compareCodePoints(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

/**
 * Kanonický JSON (mapa v5 L2): klíče objektů seřazené podle kódových bodů, bez mezer, UTF-8, čísla jen celá.
 * Desetinné, nekonečné nebo nečíselné hodnoty = výjimka (tělo ani payload je nemá).
 */
export function canonicalJson(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw new Error(`kanonický JSON: číslo ${v} není celé`);
    return String(v);
  }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort(compareCodePoints);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  throw new Error(`kanonický JSON: nepodporovaný typ ${typeof v}`);
}

/**
 * Pohled na tick lease pro inbox (N-12): fence a token udělení + živá kontrola, že lock na disku pořád nese náš token.
 * Produkčně z `Store` (`leaseOfStore`); víceprocesové testy dosadí souborový lease.
 */
export interface LeaseView {
  readonly fence: number;
  readonly token: string;
  holds(): boolean;
}

export function leaseOfStore(store: Store): LeaseView | undefined {
  const fence = store.fence;
  const token = store.leaseToken;
  if (fence === undefined || !token) return undefined;
  return { fence, token, holds: () => store.holdsLease() };
}

/** Kontrola fence před publikací, po publikaci a před každým HTTP zápisem (mapa v6 §3.3 „Fence kolem publikace“). */
export function assertLease(lease: LeaseView, where: string): void {
  if (!lease.holds()) throw new InboxHold("LEASE_LOST", `lease ${lease.fence} už neplatí (${where})`);
}

/**
 * Režim inboxu (v6 §14 PR 2/PR 3). Výchozí `hold`: jen čtení a příprava v paměti, 0 zápisů na disk mimo události,
 * 0 HTTP zápisů. `run` zapíná zápisy; v PR 3 ho nastavují jen testy, v kódu TARS se nikde nezapíná.
 */
export type InboxMode = "hold" | "run";

export function assertRun(mode: InboxMode, what: string): void {
  if (mode !== "run") throw new InboxHold("MODE_HOLD", `${what}: režim hold, zápis se neprovede`);
}

/** Prvních 8 hex znaků event_id (klíč efektu `inbox-<e8>/…`). */
export const event8 = (eventId: string): string => eventId.slice(0, 8);

export const EVENT_ID_RE = /^[0-9a-f]{32}$/;
