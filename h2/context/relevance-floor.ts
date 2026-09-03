import type { ContextCandidateItem } from "./priority";
import type { ResolvedEntity } from "./resolve-entities";

/**
 * Deterministic relevance floor (Technical Architecture v1.2 §7.3,
 * BUILD-09 plán Krok 2) — kontextová položka smí do promptu jen když
 * platí jedna ze tří podmínek. LLM relevance může výběr dál zúžit,
 * nesmí tuhle podlahu obcházet (floor běží PŘED `fitToBudget()`).
 *
 * Hypotézy/kandidátní psychologické interpretace (AT-23) mají vlastní,
 * přísnější pravidlo nezávislé na entity matchi: projdou jen při
 * `purpose='BUDDY_DEEP_DIVE'` (Reasoning Lab, §7.3).
 */
export function passesRelevanceFloor(
  candidate: Pick<ContextCandidateItem, "matchLabel" | "requiredForAction" | "isHypothesis">,
  resolvedEntities: readonly ResolvedEntity[],
  purpose: string,
): boolean {
  if (candidate.isHypothesis) {
    return purpose === "BUDDY_DEEP_DIVE";
  }

  // Condition 2: operační stav nutný k požadované akci.
  if (candidate.requiredForAction) {
    return true;
  }

  // Condition 1: zpráva přímo odkazuje na entity/project/experiment/commitment.
  if (candidate.matchLabel) {
    const needle = candidate.matchLabel.toLowerCase();
    return resolvedEntities.some((entity) => entity.label.toLowerCase() === needle);
  }

  return false;
}
