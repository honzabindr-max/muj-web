import type { Pool } from "pg";

import { fitToBudget } from "./budget-fit";
import { persistContextRun } from "./persist-context-run";
import type { ContextCandidateItem, ContextPriority } from "./priority";
import { currentMessageItem } from "./priority";
import { passesRelevanceFloor } from "./relevance-floor";
import { resolveMessageEntities } from "./resolve-entities";
import { getThirdPartyEpisodeCandidates } from "./sources/episodes";
import { getExecutiveCandidates } from "./sources/executive";
import { getKnowledgeCandidates } from "./sources/knowledge";
import type { ContextPurpose } from "./token-budget";
import { CONTEXT_TOKEN_BUDGETS } from "./token-budget";

/**
 * `buildContextPack()` (BUILD-09 plán Krok 4) — orchestruje celý §7.1
 * pipeline od DETERMINISTIC RELEVANCE FLOOR po CONTEXT PACK RETRIEVAL:
 * entity resolution (Krok 2) → kandidáti ze všech source providerů
 * (Krok 3) → relevance floor filtr (Krok 2) → token budget fit (Krok 1)
 * → auditovaný zápis (Krok 1). Uzavírá DoD celého BUILD-09 (AT-21..25,
 * AT-58, AT-66).
 *
 * Žádný produkční trigger — volatelná přímo (testy, budoucí BUILD-10
 * Buddy runtime), stejný vzor jako BUILD-05 až BUILD-08.
 */
export type ContextManifestItem = {
  itemType: string;
  itemId: string;
  priority: ContextPriority;
  reason: string;
  personId?: string | null;
};

export type ContextManifest = {
  contextRunId: string;
  purpose: ContextPurpose;
  items: ContextManifestItem[];
  omittedCount: number;
  omissionReason: string | null;
};

function toManifestItem(item: ContextCandidateItem): ContextManifestItem {
  return {
    itemType: item.itemType,
    itemId: item.itemId,
    priority: item.priority,
    reason: item.reason,
    personId: item.personId ?? null,
  };
}

export async function buildContextPack(
  pool: Pool,
  ownerId: string,
  purpose: ContextPurpose,
  rawEventId: string,
  messageText: string,
): Promise<ContextManifest> {
  const budget = CONTEXT_TOKEN_BUDGETS[purpose];

  // Nezávislé owner-scoped dotazy (každý svůj vlastní DB klient z poolu),
  // bezpečné pustit souběžně.
  const [resolvedEntities, executive, knowledge, thirdPartyEpisodes] = await Promise.all([
    resolveMessageEntities(pool, ownerId, rawEventId),
    getExecutiveCandidates(pool, ownerId),
    getKnowledgeCandidates(pool, ownerId),
    getThirdPartyEpisodeCandidates(pool, ownerId, purpose),
  ]);

  const candidates = [...executive, ...knowledge, ...thirdPartyEpisodes];
  const relevant = candidates.filter((candidate) => passesRelevanceFloor(candidate, resolvedEntities, purpose));

  const p0Items = [currentMessageItem(rawEventId, messageText)];
  const fit = fitToBudget(p0Items, relevant, budget.maxInputTokens);

  const { contextRunId } = await persistContextRun(pool, {
    ownerId,
    purpose,
    maxInputTokens: budget.maxInputTokens,
    maxOutputTokens: budget.maxOutputTokens,
    fit,
  });

  return {
    contextRunId,
    purpose,
    items: fit.included.map(toManifestItem),
    omittedCount: fit.omitted.length,
    omissionReason: fit.omissionReason,
  };
}
