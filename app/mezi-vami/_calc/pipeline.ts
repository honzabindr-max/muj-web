// Orchestrace: vstup → AstroEstimator → Evidence Map → texty → FreeDnaResult → validace → revize.
// Každý krok je samostatný modul se vstupem a výstupem; průběh se hlásí přes emit() (skutečné události).

import { createHash } from "node:crypto";
import {
  coverageNote,
  assembleDocument,
  newAnalysisId,
  CONTRACT_VERSION,
} from "./assemble";
import type { AstroEstimator } from "./astro";
import { validateContractDoc } from "./contract";
import { buildEvidenceMap, evidenceMapHash, planSlots } from "./evidence";
import { normalizeInput } from "./input";
import { model, type StructuredLlm } from "./llm";
import {
  PipelineError,
  addUsage,
  emptyUsage,
  type AnalysisRevision,
  type StepEvent,
  type StepId,
} from "./types";
import { writeInsights } from "./writer";
import type { Persons } from "../_lib/persons";

export const MODULE_VERSIONS = {
  pipeline: "cte08-1",
  ui_data_contract: CONTRACT_VERSION,
  astro_estimator: "llm_estimate-1",
  evidence_map: "1",
  writer: "1",
} as const;

/** Celkový strop běhu (ms). Po něm se výpočet přeruší a vrátí S-FAIL(TIMEOUT). */
export const TOTAL_TIMEOUT_MS = 100_000;

export type PipelineDeps = {
  estimator: AstroEstimator;
  llm: StructuredLlm;
  now?: () => number;
  newId?: () => string;
};

export type PipelineResult = {
  document: ReturnType<typeof assembleDocument>;
  revision: AnalysisRevision;
};

export async function runPipeline(
  persons: Persons,
  deps: PipelineDeps,
  emit: (e: StepEvent) => void = () => {},
): Promise<PipelineResult> {
  const now = deps.now ?? Date.now;
  const started = now();
  const deadline = started + TOTAL_TIMEOUT_MS;
  const stepMs: Partial<Record<StepId, number>> = {};
  let usage = emptyUsage();

  async function step<T>(id: StepId, fn: () => Promise<T> | T): Promise<T> {
    const t0 = now();
    emit({ type: "step", id, status: "start" });
    const out = await fn();
    const ms = now() - t0;
    stepMs[id] = ms;
    emit({ type: "step", id, status: "done", ms });
    return out;
  }

  // 1+2: vstup, normalizace místa a času
  const norm = await step("input", () => normalizeInput(persons));
  const modes: [
    (typeof norm)[0]["person"]["time_mode"],
    (typeof norm)[1]["person"]["time_mode"],
  ] = [norm[0].person.time_mode, norm[1].person.time_mode];

  // 3: astro krok (LLM odhad za rozhraním AstroEstimator)
  const est = await step("astro", () =>
    deps.estimator.estimate(norm, deadline),
  );
  usage = addUsage(usage, est.usage);

  // 4: Evidence Map (deterministicky, bez LLM)
  const map = await step("evidence", () => buildEvidenceMap(est.astro, modes));
  const plans = planSlots(map);
  if (plans.length === 0) {
    throw new PipelineError({
      type: "FAIL",
      code: "INSUFFICIENT_EVIDENCE_FOR_R1",
    });
  }

  // 5: texty z Evidence Map (LLM), délky podle content budgets
  const written = await step("texts", () =>
    writeInsights(plans, {
      llm: deps.llm,
      coverageNote: coverageNote(map.cohort),
      deadline,
    }),
  );
  usage = addUsage(usage, written.usage);

  // 6: FreeDnaResult podle kontraktu, validace schématem + sémantikou
  const analysisId = (deps.newId ?? newAnalysisId)();
  const document = await step("validate", () => {
    const doc = assembleDocument({
      analysisId,
      persons: norm,
      insights: written.insights,
      evidenceCount: map.items.length,
    });
    const res = validateContractDoc(doc);
    if (!res.ok) {
      // Do logu jen vrstva a počet chyb (texty chyb mohou obsahovat data).
      console.error(
        JSON.stringify({
          mv_validate: "fail",
          layer: res.layer,
          n: res.errors.length,
        }),
      );
      throw new PipelineError(
        { type: "FAIL", code: "CALCULATION_FAILED" },
        "výstup nesplňuje kontrakt",
      );
    }
    return doc;
  });

  // 7: analysis revision (jen v odpovědi; nic se neukládá)
  const inputHash = createHash("sha256")
    .update(JSON.stringify(norm.map((n) => ({ p: n.person, o: n.okres }))))
    .digest("hex");
  const finished = now();
  const revision: AnalysisRevision = {
    analysis_id: analysisId,
    revision: 1,
    analysis_revision_ref: document.view.analysis.analysis_revision_ref,
    input_hash: inputHash,
    module_versions: {
      ...MODULE_VERSIONS,
      evidence_map_hash: evidenceMapHash(map).slice(0, 16),
    },
    provider: "llm_estimate",
    authoritative: false,
    model: model(),
    created_at: new Date(finished).toISOString(),
    duration_ms: finished - started,
    step_ms: stepMs,
    usage,
  };
  return { document, revision };
}
