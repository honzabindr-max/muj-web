// Effect journal (DR-039, etapa 3): every external write of an order (DRAFT page, owner card, PR, comment) is recorded
// durably BEFORE it is attempted and its receipt AFTER it succeeded. A tick that finds an attempt without a receipt
// (the process died between the write and the save of its result) never repeats it blindly: it first looks the effect
// up by the marker the write carries (`[op:<operation_id>]` in the page title / PR body). Exactly one hit → the receipt
// is recovered. Certainly no hit → a new attempt with the SAME operation_id. Anything unclear → EFFECT_UNKNOWN (HOLD).
import fs from "node:fs";
import path from "node:path";

import { isUncertainOutcome, OwnerDecisionWriteError, SecretLeakError, type NotionClient } from "./notion";
export { bodyCarriesMarker, titleCarriesMarker } from "./notion";
import { writeDurable } from "./store";

/**
 * PREPARED       the write is about to start or was started; its outcome is not known (yet).
 * EFFECT_DONE    the write succeeded; `receipt` names the created resource.
 * EFFECT_ABSENT  the last attempt certainly wrote nothing (clean refusal before any write); a new attempt is safe.
 * EFFECT_UNKNOWN the outcome could not be established (HOLD): no further write for this operation.
 */
export type EffectState = "PREPARED" | "EFFECT_DONE" | "EFFECT_ABSENT" | "EFFECT_UNKNOWN";

export interface EffectReceipt {
  url: string;
}

export interface EffectRecord {
  operation_id: string;
  order: string;
  /** deliver | owner-card | unknown-card | owner-ping */
  step: string;
  /** fix round (or the WAITING_OWNER transition number of a ping) the operation belongs to */
  round: number;
  state: EffectState;
  /** how many times the write itself was started under this operation_id */
  attempts: number;
  prepared_at: string;
  updated_at: string;
  receipt?: EffectReceipt;
  /** sha256 of what was sent / what the card was bound to (when known) */
  content_hash?: string;
  /** true when the receipt was found by the marker lookup after a crash */
  recovered?: boolean;
  reason?: string;
}

/** Deterministic: the same order, step and round always give the same id (a retry keeps it). */
export function operationId(orderId: string, step: string, round: number): string {
  return `${orderId}/${step}/r${round}`;
}

/** Marker embedded in the created object. The closing bracket keeps `…/r1]` from matching `…/r10]`. */
export function effectMarker(op: string): string {
  return `[op:${op}]`;
}

/** Notion keeps the first 2000 characters of a title: the human part is shortened so the marker always survives. */
export function titleWithMarker(title: string, op: string): string {
  const m = effectMarker(op);
  return `${title.slice(0, 1990 - m.length)} ${m}`;
}

/** Tag handed to the code that performs the write, so it can embed the marker. */
export interface EffectTag {
  operationId: string;
  marker: string;
}

export function effectTag(op: string): EffectTag {
  return { operationId: op, marker: effectMarker(op) };
}

export type EffectLookup = { status: "found"; url: string } | { status: "absent" } | { status: "uncertain"; reason: string };

/**
 * True only when the error proves nothing was written: a secret-scan or owner-decision block (nothing was sent) or a
 * clean REST refusal (4xx other than 408). Everything else — network, 5xx, timeouts, a model transport — may have written.
 */
export function effectSurelyAbsent(e: unknown): boolean {
  if (e instanceof SecretLeakError || e instanceof OwnerDecisionWriteError) return true;
  return !isUncertainOutcome(e);
}

/**
 * Looks a page up under its parent by the marker in its title (REST children listing, read in full; never the search
 * index, which lags behind fresh pages). 0 hits → absent, 1 → found, more, a trashed hit or an incomplete read → uncertain.
 */
export async function lookupNotionMarker(notion: NotionClient, parentPageId: string, op: string): Promise<EffectLookup> {
  if (!notion.findChildPagesByMarker) return { status: "uncertain", reason: "dohledání podle značky není k dispozici (Notion REST bez tokenu)" };
  let hits: Array<{ url: string; in_trash?: boolean }>;
  try {
    hits = await notion.findChildPagesByMarker(parentPageId, effectMarker(op));
  } catch (e) {
    return { status: "uncertain", reason: `dohledání podle značky selhalo: ${String((e as Error)?.message ?? e).slice(0, 200)}` };
  }
  if (hits.length === 0) return { status: "absent" };
  if (hits.length > 1) return { status: "uncertain", reason: `nalezeno ${hits.length} objektů se značkou ${effectMarker(op)}` };
  if (hits[0].in_trash) return { status: "uncertain", reason: `objekt se značkou ${effectMarker(op)} je v koši` };
  return { status: "found", url: hits[0].url };
}

const SAFE_PART = /^[A-Za-z0-9._-]+$/;

/** One durable file per operation (tmp + fsync + rename + fsync of the directory): runs/<order>/effects/<step>-r<round>.json. */
export class EffectJournal {
  constructor(
    private runsDir: string,
    private now: () => string = () => new Date().toISOString(),
  ) {}

  private parts(op: string): { order: string; step: string; round: string } {
    const p = op.split("/");
    if (p.length !== 3 || !p.every((x) => SAFE_PART.test(x)) || !/^r\d+$/.test(p[2])) throw new Error(`neplatné operation_id: ${op}`);
    return { order: p[0], step: p[1], round: p[2] };
  }

  private file(op: string): string {
    const { order, step, round } = this.parts(op);
    return path.join(this.runsDir, order, "effects", `${step}-${round}.json`);
  }

  get(op: string): EffectRecord | undefined {
    const f = this.file(op);
    if (!fs.existsSync(f)) return undefined;
    return JSON.parse(fs.readFileSync(f, "utf8")) as EffectRecord;
  }

  list(orderId: string): EffectRecord[] {
    const d = path.join(this.runsDir, orderId, "effects");
    if (!fs.existsSync(d)) return [];
    return fs
      .readdirSync(d)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) as EffectRecord);
  }

  private write(r: EffectRecord): EffectRecord {
    const f = this.file(r.operation_id);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    writeDurable(f, JSON.stringify(r, null, 2) + "\n");
    return r;
  }

  /** Durable PREPARED before the write starts; a retry keeps the operation_id and counts the attempt. */
  prepare(op: string, extra: { content_hash?: string } = {}): EffectRecord {
    const { order, step, round } = this.parts(op);
    const prev = this.get(op);
    if (prev?.state === "EFFECT_DONE" || prev?.state === "EFFECT_UNKNOWN") throw new Error(`operace ${op} je ve stavu ${prev.state}, nový zápis zakázán`);
    const at = this.now();
    const hash = extra.content_hash ?? prev?.content_hash;
    return this.write({
      operation_id: op,
      order,
      step,
      round: Number(round.slice(1)),
      state: "PREPARED",
      attempts: (prev?.attempts ?? 0) + 1,
      prepared_at: prev?.prepared_at ?? at,
      updated_at: at,
      ...(hash ? { content_hash: hash } : {}),
    });
  }

  done(op: string, receipt: EffectReceipt, extra: { content_hash?: string; recovered?: boolean } = {}): EffectRecord {
    const { reason: _drop, ...prev } = this.require(op);
    return this.write({
      ...prev,
      state: "EFFECT_DONE",
      receipt,
      updated_at: this.now(),
      ...(extra.content_hash ? { content_hash: extra.content_hash } : {}),
      ...(extra.recovered ? { recovered: true } : {}),
    });
  }

  absent(op: string, reason: string): EffectRecord {
    return this.write({ ...this.require(op), state: "EFFECT_ABSENT", updated_at: this.now(), reason: reason.slice(0, 300) });
  }

  unknown(op: string, reason: string): EffectRecord {
    return this.write({ ...this.require(op), state: "EFFECT_UNKNOWN", updated_at: this.now(), reason: reason.slice(0, 300) });
  }

  /** The attempt failed but may have written: stays PREPARED (the next attempt looks it up first), reason recorded. */
  note(op: string, reason: string): EffectRecord {
    return this.write({ ...this.require(op), updated_at: this.now(), reason: reason.slice(0, 300) });
  }

  private require(op: string): EffectRecord {
    const r = this.get(op);
    if (!r) throw new Error(`operace ${op} nemá záznam PREPARED`);
    return r;
  }
}
