// Krok 6: sestavení FreeDnaResult (view RESULTS) přesně podle ui_data_contract_v1 v1.0.1.
// Statické části (coverage, limitations, nabídka) jsou deterministické; LLM text jen v blocích R1–R5.

import { createHash, randomBytes } from "node:crypto";
import { canonicalCohort } from "./evidence";
import type { WrittenInsight } from "./writer";
import { BUDGET } from "./writer";
import type { ContractPerson, NormalizedPerson } from "./types";

export const CONTRACT_VERSION = "1.0.1";

const SCOPE_IDS = [
  "PS1_MOST_IMPORTANT_FIRST",
  "PS2_HOW_EACH_FUNCTIONS",
  "PS3_FIVE_RELATIONSHIPS",
  "PS4_LOVE_ATTRACTION_INTIMACY",
  "PS5_EMOTIONS_COMMUNICATION_CONFLICT",
  "PS6_CLOSENESS_FREEDOM_EVERYDAY",
  "PS7_WHAT_YOU_AWAKEN_AND_HOLDS",
  "PS8_FOR_HOME_PRACTICAL",
  "PS9_UNDER_THE_HOOD_TECHNICAL",
] as const;

export function newAnalysisId(): string {
  return `an_${randomBytes(6).toString("hex")}`;
}

const h8 = (s: string) =>
  createHash("sha256").update(s).digest("hex").slice(0, 8);

function limitations(
  persons: ContractPerson[],
  cohort: string,
  evidenceCount: number,
) {
  const out: { code: string; customer_text: string }[] = [];
  for (const p of persons) {
    const who = p.slot === "A" ? "první osoby" : "druhé osoby";
    const code = p.slot === "A" ? "PERSON_A" : "PERSON_B";
    if (p.time_mode === "UNKNOWN") {
      out.push({
        code: `TIME_UNKNOWN_${code}`,
        customer_text: `Čas narození ${who} není znám. Části, které na něm závisejí, nejsou do výkladu zahrnuty.`,
      });
    } else if (p.time_mode === "APPROXIMATE") {
      out.push({
        code: `TIME_APPROXIMATE_${code}`,
        customer_text: `Čas narození ${who} je přibližný. Nezaměňujeme ho za přesný, proto části, které na přesném čase závisejí, nejsou do výkladu zahrnuty.`,
      });
    }
  }
  if (cohort !== "EE") {
    out.push({
      code: "TIMED_LAYERS_UNAVAILABLE",
      customer_text:
        "Části výkladu, které vyžadují přesný čas narození obou lidí, nejsou zahrnuty.",
    });
    out.push({
      code: "COMPOSITE_ANGLES_UNAVAILABLE",
      customer_text:
        "Ascendent a rozdělení do životních oblastí (domy) se bez přesného času narození obou lidí nepočítají a ve výkladu nejsou.",
    });
  }
  if (evidenceCount < 3) {
    out.push({
      code: "EVIDENCE_DENSITY_LOW",
      customer_text:
        "Pro vás dva se podařilo podložit jen omezený počet témat. Výklad je proto stručnější.",
    });
  }
  return out;
}

function coverage(cohort: string) {
  const base = [
    "Postavení při narození obou lidí",
    "Souvislosti mezi vámi dvěma",
  ];
  if (cohort === "EE") {
    return {
      coverage_line:
        "Výklad vychází z údajů o narození obou lidí včetně přesného času narození.",
      layers_available: [...base, "Části závislé na přesném čase"],
      layers_unavailable: [],
    };
  }
  return {
    coverage_line:
      cohort === "UU"
        ? "Výklad vychází z dostupných částí výpočtu, které nevyžadují čas narození."
        : "Výklad vychází z dostupných částí výpočtu. Části závislé na přesném čase narození nejsou zahrnuty.",
    layers_available: base,
    layers_unavailable: ["Části závislé na přesném čase narození"],
  };
}

export function coverageNote(cohort: string): string {
  return coverage(cohort).coverage_line;
}

export type AssembleInput = {
  analysisId: string;
  persons: [NormalizedPerson, NormalizedPerson];
  insights: WrittenInsight[]; // R1 první
  evidenceCount: number;
};

export function assembleDocument(inp: AssembleInput) {
  const { analysisId } = inp;
  const arr = `arr_${analysisId.replace(/^an_/, "")}_r1`;
  const persons = inp.persons.map((n) => n.person);
  const cohort = canonicalCohort(persons[0].time_mode, persons[1].time_mode);

  const toInsight = (i: WrittenInsight) => {
    const insight_id = `ins_${i.slot}_${h8(analysisId + i.slot)}`;
    return {
      insight_id,
      slot: i.slot,
      slot_realisation: i.realisation,
      headline: i.headline,
      body: i.body,
      evidence_anchors: i.evidence.map((e) => ({
        anchor_id: e.id,
        supports_insight_id: insight_id,
        analysis_revision_ref: arr,
        customer_label: e.label.slice(0, 180),
      })),
      content_budget: {
        headline_max_chars: BUDGET.headline,
        body_max_chars: BUDGET.body,
        overflow_policy: "REWRITE_OR_RECOMPOSE" as const,
        provisional: true as const,
      },
      themeLabel: i.themeLabel,
    };
  };
  const built = inp.insights.map(toInsight);
  const r1 = built.find((b) => b.slot === "R1")!;
  const optional = built.filter((b) => b.slot !== "R1");
  const strip = ({ themeLabel: _t, ...rest }: (typeof built)[number]) => {
    void _t;
    return rest;
  };
  const r1Only = optional.length === 0;

  const doc = {
    contract_version: CONTRACT_VERSION,
    fixture_id: `FX-LLM-${analysisId.replace(/^an_/, "").toUpperCase()}`,
    locale: "cs-CZ",
    copy_provenance: "PROTOTYPE_FIXTURE_COPY",
    view: {
      state: "RESULTS",
      analysis: {
        analysis_id: analysisId,
        revision: 1,
        analysis_revision_ref: arr,
      },
      persons,
      free_dna: {
        r1: strip(r1),
        optional_insights: optional.map(strip),
        r1_only: r1Only,
        ...(r1Only ? { singular_copy_required: true } : {}),
        time_coverage_class: cohort,
        timed_layers:
          cohort === "EE" ? "AVAILABLE_STABLE" : "UNAVAILABLE_TIME_UNCERTAINTY",
        coverage: coverage(cohort),
        limitations: limitations(persons, cohort, inp.evidenceCount),
      },
      depth_bridge: {
        headline: "Pro hlubší pohled",
        detected_themes: built.map((b) => ({
          theme_label: b.themeLabel.slice(0, 120),
          supports_insight_id: b.insight_id,
        })),
        fake_open_loop: false,
      },
      offer: {
        product_code: "DEEP_DIVE_V3",
        product_version: "v3.0.0-p1",
        scope_sections: SCOPE_IDS.map((section_id) => ({ section_id })),
        price: {
          amount_minor_units: 199000,
          currency: "CZK",
          display: "1 990 Kč",
          is_config: true,
          vat_included: true,
          one_time_purchase: true,
          confirmation_status: "P1_WORKING_DISPLAY_PRICE",
        },
        delivery_window_hours: 48,
        signed_link_validity_days: 30,
        length_claim_allowed: false,
        sample: {
          is_provisional: true,
          design_version: "PROVISIONAL_P1",
          preview_pages: [1, 2, 3].map((n) => ({
            page_slot: n,
            image_url: `/fixtures/sample/p${n}.png`,
            aspect: "A5_PORTRAIT_148x210",
          })),
          full_sample_pdf_url: "/fixtures/sample/sample.pdf",
          labelled_as_sample: true,
          email_gate: false,
        },
        sticky_cta_allowed: true,
      },
      stale: false,
      analytics: { event_name: "free_reveal_view", unit: "ATTEMPT" },
    },
  };
  return doc;
}
