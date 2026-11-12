// Validace dokumentu proti contracts/ui_data_contract_v1.json (JSON Schema 2020-12, format assertion)
// + TS port pravidel S1–S9 ze scripts/validate_fixture_semantics.py (stejná logika; Python běží v CI testu
// a hlídá shodu na fixtures, na Vercelu Python není).
// Kontrakt se nemění; sem se jen načítá.

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../../contracts/ui_data_contract_v1.json";

const ajv = new Ajv2020({ allErrors: false, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema as object);

const RANK = { EXACT: 0, APPROXIMATE: 1, UNKNOWN: 2 } as const;
const CH = { EXACT: "E", APPROXIMATE: "A", UNKNOWN: "U" } as const;
type Mode = keyof typeof RANK;

export function canonicalCohortOf(a: Mode, b: Mode): string {
  const [x, y] = [a, b].sort((m, n) => RANK[m] - RANK[n]);
  return CH[x] + CH[y];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

function isoDate(s: unknown): Date | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s
    ? null
    : d;
}

/** Port validate_fixture_semantics.check() — S1…S9. Vrací chyby (prázdné = OK). */
export function semanticCheck(doc: Json, today: Date = new Date()): string[] {
  const errs: string[] = [];
  const v = doc?.view ?? {};
  const state = v.state;

  const persons: Json[] | undefined = v.persons ?? v.birth_data_review;
  if (persons) {
    const slots = persons.map((p) => p.slot).sort();
    if (JSON.stringify(slots) !== JSON.stringify(["A", "B"]))
      errs.push(`S1 pair must contain exactly one A and one B, got ${slots}`);
    for (const p of persons) {
      const expected = p.slot === "A" ? "První osoba" : "Druhá osoba";
      if (p.ui_label !== expected)
        errs.push(`S1 ui_label mismatch for slot ${p.slot}`);
      const d = isoDate(p.birth_date);
      if (!d) errs.push(`S1 invalid calendar date ${p.birth_date}`);
      else {
        if (d < new Date("1900-01-01T00:00:00Z"))
          errs.push(
            `S1 birth_date ${p.birth_date} below locked supported_birth_date_min 1900-01-01`,
          );
        if (d > today)
          errs.push(`S1 future birth_date ${p.birth_date} not allowed`);
      }
    }
  }

  const fd = v.free_dna;
  const pairOk =
    persons &&
    JSON.stringify(persons.map((p) => p.slot).sort()) ===
      JSON.stringify(["A", "B"]);
  if (fd && pairOk) {
    const by: Record<string, Json> = {};
    for (const p of persons!) by[p.slot] = p;
    const expected = canonicalCohortOf(by.A.time_mode, by.B.time_mode);
    if (fd.time_coverage_class !== expected)
      errs.push(
        `S2 time_coverage_class ${fd.time_coverage_class} does not match person time modes (${by.A.time_mode},${by.B.time_mode}) -> canonical ${expected}`,
      );
  }

  if (fd) {
    const insights: Json[] = [fd.r1, ...(fd.optional_insights ?? [])];
    const slots = insights.map((i) => i.slot);
    if (slots.length !== new Set(slots).size)
      errs.push(`S3 duplicate insight slots: ${slots}`);
    const ids = insights.map((i) => i.insight_id);
    if (ids.length !== new Set(ids).size)
      errs.push(`S3 duplicate insight_id values: ${ids}`);

    const arr = v.analysis?.analysis_revision_ref;
    for (const ins of insights) {
      for (const a of ins.evidence_anchors ?? []) {
        if (a.supports_insight_id !== ins.insight_id)
          errs.push(
            `S4 anchor ${a.anchor_id} supports_insight_id does not match parent insight`,
          );
        if (arr && a.analysis_revision_ref !== arr)
          errs.push(
            `S4 anchor ${a.anchor_id} bound to foreign analysis revision`,
          );
      }
      const cb = ins.content_budget;
      if (ins.headline.length > cb.headline_max_chars)
        errs.push(
          `S5 ${ins.slot} headline exceeds budget (${ins.headline.length}>${cb.headline_max_chars})`,
        );
      if (ins.body.length > cb.body_max_chars)
        errs.push(
          `S5 ${ins.slot} body exceeds budget (${ins.body.length}>${cb.body_max_chars})`,
        );
    }

    const db = v.depth_bridge;
    if (db) {
      const detected = new Set(ids);
      for (const t of db.detected_themes)
        if (!detected.has(t.supports_insight_id))
          errs.push(
            `S6 depth_bridge theme references undetected insight ${t.supports_insight_id}`,
          );
    }

    if (
      fd.time_coverage_class !== "EE" &&
      fd.timed_layers === "AVAILABLE_STABLE"
    )
      errs.push("S7 timed_layers AVAILABLE_STABLE requires cohort EE");
  }

  const order = v.order;
  if (order) {
    if (state === "ORDER_DELIVERY_READY" && order.fulfillment_state !== "READY")
      errs.push("S8 ORDER_DELIVERY_READY requires fulfillment_state READY");
    if (
      state === "ORDER_CONFIRMED_GENERATING" &&
      !["CONFIRMED", "GENERATING"].includes(order.fulfillment_state)
    )
      errs.push(
        "S8 ORDER_CONFIRMED_GENERATING requires CONFIRMED or GENERATING",
      );
    const sl = order.signed_link;
    if (sl) {
      const exp = Date.parse(sl.expires_at);
      const pd = Date.parse(order.promised_delivery_at);
      if (Number.isNaN(exp) || Number.isNaN(pd))
        errs.push("S8 invalid date-time in order");
      else if (Math.floor((exp - pd) / 86_400_000) > 31)
        errs.push("S8 signed link window exceeds locked 30 day baseline");
    }
  }

  for (const holder of [v.offer, v]) {
    if (holder && typeof holder.price === "object" && holder.price) {
      if (holder.price.confirmation_status === "LAUNCH_PRICE_LOCKED")
        errs.push(
          "S9 LAUNCH_PRICE_LOCKED requires an explicit Control Tower decision before paid traffic",
        );
    }
  }
  return errs;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; layer: "schema" | "semantic"; errors: string[] };

/** Schema (včetně format assertion), pak sémantika (jen když schema projde, jako run_validation.py). */
export function validateContractDoc(doc: unknown): ValidationResult {
  if (!validateSchema(doc)) {
    return {
      ok: false,
      layer: "schema",
      errors: (validateSchema.errors ?? [])
        .slice(0, 5)
        .map((e) => `${e.instancePath || "/"} ${e.message}`),
    };
  }
  const sem = semanticCheck(doc);
  return sem.length
    ? { ok: false, layer: "semantic", errors: sem }
    : { ok: true };
}
