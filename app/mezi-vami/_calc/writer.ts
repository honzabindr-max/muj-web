// Krok 5: texty bloků Vztahové DNA. LLM píše výhradně z Evidence Map (každé tvrzení = odkaz na evidence id).
// Délky hlídá kód podle content budgets kontraktu. Přetečení = přepis modelem, nikdy oříznutí.

import { z } from "zod";
import type { Evidence, Realisation, SlotName, SlotPlan } from "./evidence";
import { THEME_CS } from "./evidence";
import type { StructuredLlm } from "./llm";
import { PipelineError, addUsage, emptyUsage, type Usage } from "./types";

export const BUDGET = { headline: 70, body: 620 } as const;
/** Cíl, který dostane model; tvrdý limit je BUDGET (rezerva proti přetečení). */
const TARGET = { headline: 60, body: 480 } as const;
const MAX_REWRITE_ROUNDS = 2;

export const WriterOutputSchema = z.object({
  blocks: z.array(
    z.object({
      slot: z.enum(["R1", "R2", "R3", "R4", "R5"]),
      headline: z.string(),
      body: z.string(),
      /** krátký neutrální název tématu (pro navázání v Depth Bridge), ≤ 60 znaků */
      theme_label: z.string(),
      /** evidence id, o která se text opírá (podmnožina přidělených) */
      cited: z.array(z.string()),
    }),
  ),
});
export type WriterOutput = z.infer<typeof WriterOutputSchema>;

export type WrittenInsight = {
  slot: SlotName;
  realisation: Realisation;
  headline: string;
  body: string;
  themeLabel: string;
  evidence: Evidence[];
};

const SYSTEM = `Píšeš krátké bloky bezplatné Vztahové DNA pro dvojici lidí. Píšeš česky, vykáš, kolektivní rámec („mezi vámi“, „ve vašem spojení“, „první z vás“, „druhý z vás“).

Zdroj faktů: jediný zdroj je seznam podkladů (evidence) u každého bloku. Nepřidávej žádná astrologická tvrzení, která v podkladech nejsou. Každé tvrzení v textu musí vycházet z některého podkladu. Ve výstupu uveď v poli cited id podkladů, o které se blok opírá (aspoň jedno, jen ze seznamu přiděleného tomu bloku).

Hlas: tichý, sebejistý, věcný. Krátké věty, jedna myšlenka na větu. První věta nese hlavní sdělení. Síla tvrzení odpovídá podkladu: formulace jako „může se“, „vystupuje do popředí“, „mezi vámi se objevuje“. Popisuj dynamiku bez hodnocení, kdo je lepší nebo kdo za co může. Asymetrie není konflikt, rozdílný rytmus neznamená menší zájem. Neobviňuj, nic neslibuj.

Struktura: nadpis o 3–8 slovech pojmenuje jedno konkrétní téma (dobrý příklad: „Rozdílné tempo odpovědi“). Text má 2–3 věty: zjištění, pak význam nebo projev. Blok R5 je jedno pozorování pro každodennost („všimnout si…“), nikdy slib nápravy vztahu.

Příklad tónu: „Ve vašem spojení se může potkávat chuť být spolu s potřebou zachovat si vlastní prostor. Společné chvíle a samostatnost tu nemusí představovat dvě opačné volby.“

Zakázáno: „vždy“, „nikdy“, „navždy“, „nevyhnutelně“, „jediný důvod“; „dokázáno“, „vědecky“, „výpočet prokázal“; fatalismus a osud; diagnózy, čtení skrytých úmyslů, předpověď budoucnosti vztahu; tajemství a umělé napětí. Nepoužívej odborné a interní termíny: synastrie, orb, aspekt, evidence, dům, R1–R5. Nepoužívej počty a čísla stupňů. Planety a znamení smíš zmínit jen výjimečně a srozumitelně, převažovat má lidský popis dynamiky.

Je-li zadána singulární varianta (jediný blok), používej „tento pohled“, „toto téma“, „tento motiv“; nepoužívej množné „vzorce“, „dynamiky“.

Limity délky jsou tvrdé: nadpis nejvýše ${TARGET.headline} znaků, text nejvýše ${TARGET.body} znaků. Je-li text delší, přepiš ho stručněji, nezkracuj uprostřed věty.
Vrať pro každý zadaný blok přesně jeden objekt.`;

const FORBIDDEN =
  /(?<![\p{L}\d])(vždy|nikdy|navždy|nevyhnutelně|jediný důvod|dokázán\p{L}*|vědecky|prokázal\p{L}*|osudov\p{L}*|předurčen\p{L}*|synastri\p{L}*|orb\p{L}*|aspekt\p{L}*|evidence|R[1-5])(?![\p{L}\d])/iu;

export function violations(
  b: WriterOutput["blocks"][number],
  plan: SlotPlan,
): string[] {
  const v: string[] = [];
  if (!b.headline.trim()) v.push("prázdný nadpis");
  if (!b.body.trim()) v.push("prázdný text");
  if (b.headline.length > BUDGET.headline)
    v.push(
      `nadpis má ${b.headline.length} znaků, limit je ${BUDGET.headline}: přepiš ho kratší`,
    );
  if (b.body.length > BUDGET.body)
    v.push(
      `text má ${b.body.length} znaků, limit je ${BUDGET.body}: přepiš ho kratší`,
    );
  if (FORBIDDEN.test(b.headline) || FORBIDDEN.test(b.body))
    v.push("obsahuje zakázaný výraz");
  const allowed = new Set(plan.evidence.map((e) => e.id));
  if (b.cited.length === 0 || b.cited.some((id) => !allowed.has(id)))
    v.push("cited musí být neprázdná podmnožina přidělených id");
  return v;
}

function describePlan(plan: SlotPlan, r1Only: boolean): string {
  const ev = plan.evidence
    .map(
      (e) =>
        `  - id ${e.id} · téma: ${THEME_CS[e.theme]} · ${e.polarity === "support" ? "opora" : e.polarity === "tension" ? "rozdílnost" : "neutrální"} · ${e.fact}`,
    )
    .join("\n");
  const kind: Record<Realisation, string> = {
    CORE_SIGNATURE: "hlavní téma (nejsilnější zjištění)",
    PARADOX: "souběh dvou poloh v jednom tématu (podpora i rozdílnost)",
    SECOND_DISTINCTIVE_PATTERN: "druhý odlišující motiv",
    SUPPORTIVE_PATTERN: "podpůrná dynamika mezi vámi",
    SALIENT_NEUTRAL_PATTERN:
      "výrazný neutrální motiv (nepřevádět na dar, sílu ani výhodu)",
    STRONG_MISMATCH: "výrazná rozdílnost (bez konfliktního rámce)",
    ASYMMETRY_OR_DIFFERENT_RHYTHM: "asymetrie nebo rozdílný rytmus",
    OBSERVATIONAL_APPLICATION: "jedno pozorování pro každodennost",
  };
  return `Blok ${plan.slot} (${kind[plan.realisation]}${plan.slot === "R1" && r1Only ? "; singulární varianta, jediný blok" : ""}):\n${ev}`;
}

function userPrompt(
  plans: SlotPlan[],
  r1Only: boolean,
  coverageNote: string,
  feedback: Map<SlotName, string[]>,
): string {
  const parts = [
    `Rozsah výpočtu: ${coverageNote}`,
    ...plans.map((p) => describePlan(p, r1Only)),
  ];
  if (feedback.size) {
    parts.push(
      "Oprav tyto chyby z předchozího pokusu:\n" +
        [...feedback.entries()]
          .map(([s, v]) => `  - ${s}: ${v.join("; ")}`)
          .join("\n"),
    );
  }
  return parts.join("\n\n");
}

export async function writeInsights(
  plans: SlotPlan[],
  opts: { llm: StructuredLlm; coverageNote: string; deadline: number },
): Promise<{ insights: WrittenInsight[]; usage: Usage }> {
  const r1Only = plans.length === 1;
  const done = new Map<SlotName, WrittenInsight>();
  let usage = emptyUsage();
  let todo = plans;
  const feedback = new Map<SlotName, string[]>();

  for (let round = 0; round <= MAX_REWRITE_ROUNDS && todo.length; round++) {
    const res = await opts.llm.call({
      name: round === 0 ? "texts" : `texts_rewrite_${round}`,
      system: SYSTEM,
      user: userPrompt(todo, r1Only, opts.coverageNote, feedback),
      schema: WriterOutputSchema,
      maxTokens: 3000,
      deadline: opts.deadline,
    });
    usage = addUsage(usage, res.usage);
    feedback.clear();
    const next: SlotPlan[] = [];
    for (const plan of todo) {
      const b = res.data.blocks.find((x) => x.slot === plan.slot);
      const v = b ? violations(b, plan) : ["chybí blok"];
      if (!b || v.length) {
        feedback.set(plan.slot, v);
        next.push(plan);
        continue;
      }
      const cited = new Set(b.cited);
      done.set(plan.slot, {
        slot: plan.slot,
        realisation: plan.realisation,
        headline: b.headline.trim(),
        body: b.body.trim(),
        themeLabel: b.theme_label.trim().slice(0, 100) || b.headline.trim(),
        evidence: plan.evidence.filter((e) => cited.has(e.id)),
      });
    }
    todo = next;
  }

  if (!done.has("R1")) {
    throw new PipelineError(
      { type: "FAIL", code: "INSUFFICIENT_EVIDENCE_FOR_R1" },
      "R1 se nepodařilo napsat v limitech",
    );
  }
  // Volitelný blok, který ani po přepisech nesplnil limity, vypadne (neořezává se).
  const insights = plans
    .map((p) => done.get(p.slot))
    .filter((x): x is WrittenInsight => !!x);
  return { insights, usage };
}
