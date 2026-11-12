// Typy výpočtu Vztahové DNA (CTE-08, prototyp: astro krok odhaduje LLM).
// Kontraktový tvar výstupu je v contracts/ui_data_contract_v1.json; tady jsou jen vnitřní typy kroků.

export type TimeMode = "EXACT" | "APPROXIMATE" | "UNKNOWN";
export type Slot = "A" | "B";

export type ContractPerson = {
  slot: Slot;
  ui_label: "První osoba" | "Druhá osoba";
  birth_date: string; // YYYY-MM-DD
  birth_place: {
    display_name: string;
    country_code: "CZ" | "SK";
    supported: true;
  };
  time_mode: TimeMode;
  exact_time?: string; // HH:MM
  approximate?:
    | {
        kind: "CENTERED_WINDOW";
        center_time: string;
        window_minutes: 30 | 60 | 120;
        cross_day_spill: false;
      }
    | {
        kind: "DAYPART";
        daypart: "NOC" | "RANO" | "ODPOLEDNE" | "VECER";
        daypart_interval_local: string;
        cross_day_spill: false;
      };
  reference_style: "masculine" | "feminine" | "neutral";
  presented_as_exact: boolean;
};

/** Vstup kroku 2 (místo a čas) = osoba + okres (okres do kontraktu nejde, jen do odhadu polohy). */
export type NormalizedPerson = {
  person: ContractPerson;
  okres: string;
  /** Efektivní okno lokálního času v rámci jednoho dne (bez přetečení do jiného dne), HH:MM–HH:MM. */
  localWindow: string | null;
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  calls: number;
  costUsd: number;
};

export const emptyUsage = (): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  calls: 0,
  costUsd: 0,
});

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    calls: a.calls + b.calls,
    costUsd: a.costUsd + b.costUsd,
  };
}

export type StepId = "input" | "astro" | "evidence" | "texts" | "validate";

export type StepEvent = {
  type: "step";
  id: StepId;
  status: "start" | "done";
  ms?: number;
};

/** Neměnná analysis revision (jen v odpovědi a v sessionStorage prohlížeče, nikam se neukládá). */
export type AnalysisRevision = {
  analysis_id: string;
  revision: 1;
  analysis_revision_ref: string;
  input_hash: string;
  module_versions: Record<string, string>;
  provider: "llm_estimate";
  authoritative: false;
  model: string;
  created_at: string;
  duration_ms: number;
  step_ms: Partial<Record<StepId, number>>;
  usage: Usage;
};

export type FailureCode =
  | "CALCULATION_FAILED"
  | "INSUFFICIENT_EVIDENCE_FOR_R1"
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT";

/** Chyby pipeline: S-FAIL (RecoverableFailure), TIRR, nebo neplatný vstup. */
export class PipelineError extends Error {
  /** Spotřeba tokenů neúspěšného volání, pokud API odpověď vrátilo (pro správné účtování opakování). */
  usage?: Usage;
  constructor(
    public kind:
      | { type: "FAIL"; code: FailureCode }
      | {
          type: "TIRR";
          slot: Slot;
          reason:
            | "NONEXISTENT_EXACT_LOCAL_TIME"
            | "AMBIGUOUS_EXACT_LOCAL_TIME"
            | "UNRESOLVED_HISTORICAL_OFFSET";
        }
      | { type: "INVALID_INPUT"; detail: string },
    message?: string,
  ) {
    super(message ?? kind.type);
  }
}
