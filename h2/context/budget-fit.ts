import { H2ContextBudgetError } from "./errors";
import type { ContextCandidateItem, ContextPriority } from "./priority";
import { sumTokens } from "./priority";

/**
 * Deterministické odřezávání kontextu podle token budgetu (§7.4, AT-58,
 * BUILD-09 plán Krok 1, Rozhodnutí 2). P0 se nikdy neodřízne — pokud P0
 * samo přesáhne `maxInputTokens`, je to hlasitá `H2ContextBudgetError`
 * (Rozhodnutí 2), ne tiché zkrácení user zprávy. Ostatní položky se
 * greedy zařazují v pořadí priority P1→P4 (nejdřív nejdůležitější), dokud
 * se vejdou do zbývajícího budgetu; co se nevejde, jde do `omitted`.
 */
export type FitToBudgetResult = {
  included: ContextCandidateItem[];
  omitted: ContextCandidateItem[];
  omissionReason: string | null;
};

const PRIORITY_ORDER: Readonly<Record<ContextPriority, number>> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

export function fitToBudget(
  p0Items: readonly ContextCandidateItem[],
  otherItems: readonly ContextCandidateItem[],
  maxInputTokens: number,
): FitToBudgetResult {
  const p0Tokens = sumTokens(p0Items);
  if (p0Tokens > maxInputTokens) {
    throw new H2ContextBudgetError("P0_EXCEEDS_BUDGET");
  }

  const ordered = [...otherItems].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const included: ContextCandidateItem[] = [...p0Items];
  const omitted: ContextCandidateItem[] = [];
  let usedTokens = p0Tokens;

  for (const item of ordered) {
    if (usedTokens + item.tokensEstimated <= maxInputTokens) {
      included.push(item);
      usedTokens += item.tokensEstimated;
    } else {
      omitted.push(item);
    }
  }

  const omissionReason =
    omitted.length > 0
      ? `token budget ${maxInputTokens} exceeded — omitted ${omitted.length} item(s), lowest priority first`
      : null;

  return { included, omitted, omissionReason };
}
