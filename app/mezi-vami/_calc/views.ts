// Chybové a hraniční stavy podle ui_data_contract_v1 (ANALYSIS_FAILED_RECOVERABLE, TIME_INPUT_RESOLUTION_REQUIRED).
// Texty jsou pracovní (COPY_SYSTEM_V1 DRAFT v3.2 pro S-FAIL nedodává finální znění); nic neslibují o uchování údajů.

import { CONTRACT_VERSION } from "./assemble";
import { validateContractDoc } from "./contract";
import type { FailureCode, Slot } from "./types";

const FAIL_TEXT: Record<FailureCode, string> = {
  CALCULATION_FAILED: "Výpočet se nepodařilo dokončit. Můžete to zkusit znovu.",
  INSUFFICIENT_EVIDENCE_FOR_R1:
    "Pro vás dva se nepodařilo najít dostatečnou oporu pro hlavní téma. Můžete zkusit výpočet znovu, nebo zkontrolovat zadané údaje.",
  PROVIDER_UNAVAILABLE:
    "Výpočet je dočasně nedostupný. Zkuste to prosím za chvíli znovu.",
  TIMEOUT: "Výpočet trval déle, než jsme čekali. Můžete to zkusit znovu.",
};

const baseDoc = (tag: string, view: Record<string, unknown>) => ({
  contract_version: CONTRACT_VERSION,
  fixture_id: `FX-LLM-${tag}`,
  locale: "cs-CZ",
  copy_provenance: "PROTOTYPE_FIXTURE_COPY",
  view,
});

export function failureDoc(code: FailureCode) {
  const doc = baseDoc("FAIL", {
    state: "ANALYSIS_FAILED_RECOVERABLE",
    failure: {
      failure_code: code,
      recoverable: true,
      customer_text: FAIL_TEXT[code],
      retry_action:
        code === "INSUFFICIENT_EVIDENCE_FOR_R1"
          ? "REVIEW_INPUTS"
          : "RETRY_CALCULATION",
      persistence_promise: "INPUTS_NOT_GUARANTEED",
    },
    analytics: { event_name: "analysis_failed_view", unit: "ATTEMPT" },
  });
  assertValid(doc);
  return doc;
}

const TIRR_TEXT: Record<string, string> = {
  NONEXISTENT_EXACT_LOCAL_TIME:
    "Zadaný čas na tomto místě a v tento den podle hodin neexistoval. Upravte čas, nebo zvolte přibližný či neznámý čas.",
  AMBIGUOUS_EXACT_LOCAL_TIME:
    "Zadaný čas na tomto místě a v tento den nastal podle hodin dvakrát. Upravte čas, nebo zvolte přibližný či neznámý čas.",
  UNRESOLVED_HISTORICAL_OFFSET:
    "Pro toto místo a datum nedokážeme čas bezpečně určit. Upravte čas, nebo zvolte přibližný či neznámý čas.",
};

export function timeResolutionDoc(slot: Slot, reason: keyof typeof TIRR_TEXT) {
  const doc = baseDoc("TIRR", {
    state: "TIME_INPUT_RESOLUTION_REQUIRED",
    slot,
    reason,
    resolution_options: [
      "CORRECT_TIME",
      "SWITCH_TO_APPROXIMATE",
      "SWITCH_TO_UNKNOWN",
    ],
    guessed_offset_used: false,
    customer_text: TIRR_TEXT[reason],
    analytics: { event_name: "time_resolution_view", unit: "ATTEMPT" },
  });
  assertValid(doc);
  return doc;
}

function assertValid(doc: unknown) {
  const r = validateContractDoc(doc);
  if (!r.ok) throw new Error(`neplatný pohled: ${r.layer}`);
}
