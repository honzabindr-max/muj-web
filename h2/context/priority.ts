import { estimateTokens } from "./token-budget";

/**
 * Priorita kontextové položky (Technical Architecture v1.2 §7.4). P0 se
 * nikdy neodřízne; P1→P4 se odřezávají deterministicky od nejnižší
 * priority při overflow (`h2/context/budget-fit.ts`).
 */
export type ContextPriority = "P0" | "P1" | "P2" | "P3" | "P4";

export type ContextCandidateItem = {
  itemType: string;
  itemId: string;
  priority: ContextPriority;
  reason: string;
  tokensEstimated: number;
  personId?: string | null;
  /**
   * Krok 2 (relevance floor, §7.3) — jméno/reference podkladového řádku
   * (např. `projects.name`, `experiments.question`), proti kterému se
   * porovnávají `resolveMessageEntities()` výsledky. Není persistované
   * (`persist-context-run.ts` ho ignoruje) — jen runtime matching.
   */
  matchLabel?: string | null;
  /** Condition 2 (§7.3) — operační stav nutný k požadované akci, floor vždy propustí. */
  requiredForAction?: boolean;
  /** AT-23 — nevalidovaná hypotéza/psychologická interpretace, floor propustí jen při `purpose='BUDDY_DEEP_DIVE'`. */
  isHypothesis?: boolean;
};

export function sumTokens(items: readonly ContextCandidateItem[]): number {
  return items.reduce((sum, item) => sum + item.tokensEstimated, 0);
}

/**
 * P0 reprezentace aktuální user zprávy (§7.4 "current user turn ... jsou
 * P0 a nesmí být odříznuty"). `item_id` je `raw_events.id` — jediný
 * přirozený identifikátor aktuálního tahu, žádná nová tabulka.
 */
export function currentMessageItem(rawEventId: string, messageText: string): ContextCandidateItem {
  return {
    itemType: "CURRENT_MESSAGE",
    itemId: rawEventId,
    priority: "P0",
    reason: "current user turn",
    tokensEstimated: estimateTokens(messageText),
  };
}
