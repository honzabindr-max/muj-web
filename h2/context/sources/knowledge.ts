import type { Pool } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

import type { ContextCandidateItem } from "../priority";
import { estimateTokens } from "../token-budget";

/**
 * P2 kandidáti z knowledge vrstvy — `claims`/`mechanisms` (BUILD-16
 * producent) + `experiments` jako P1 (BUILD-17 producent, AT-22 zdroj).
 * Dnes v produkci prázdné tabulky, testy seedují přímo.
 *
 * `claims.state='HYPOTEZA'` se vrací s `isHypothesis: true` — relevance
 * floor (Krok 2, AT-23) ho propustí jen při `purpose='BUDDY_DEEP_DIVE'`.
 * Ostatní stavy (`POZOROVANO`/`VZOREC`/`TESTOVANO`/`VALIDOVANO`/
 * `MECHANISMUS`/`LIVING_OS`) jsou běžné P2 kandidáty — BUILD-09 samo
 * nerozhoduje o promotion gates (BUILD-16), jen přenáší `state`.
 */
export async function getKnowledgeCandidates(pool: Pool, ownerId: string): Promise<ContextCandidateItem[]> {
  return withOwnerScope(pool, ownerId, async (client) => {
    // Sekvenční dotazy — jeden DB klient (owner-scoped transakce) nesmí
    // souběžně vyřizovat víc query najednou.
    const claims = await client.query<{ id: string; statement: string; state: string }>(
      `select id, statement, state from claims where owner_id = $1`,
      [ownerId],
    );
    const mechanisms = await client.query<{ id: string; statement: string }>(
      `select id, statement from mechanisms where owner_id = $1`,
      [ownerId],
    );
    const experiments = await client.query<{ id: string; question: string }>(
      `select id, question from experiments where owner_id = $1 and status != 'CANCELLED'`,
      [ownerId],
    );

    const items: ContextCandidateItem[] = [];
    for (const row of claims.rows) {
      const isHypothesis = row.state === "HYPOTEZA";
      items.push({
        itemType: "CLAIM",
        itemId: row.id,
        priority: "P2",
        reason: isHypothesis ? "hypothesis — requires explicit deep-dive (AT-23)" : "claim",
        tokensEstimated: estimateTokens(row.statement),
        matchLabel: row.statement,
        isHypothesis,
      });
    }
    for (const row of mechanisms.rows) {
      items.push({
        itemType: "MECHANISM",
        itemId: row.id,
        priority: "P2",
        reason: "mechanism",
        tokensEstimated: estimateTokens(row.statement),
        matchLabel: row.statement,
      });
    }
    for (const row of experiments.rows) {
      items.push({
        itemType: "EXPERIMENT",
        itemId: row.id,
        priority: "P1",
        reason: "active experiment",
        tokensEstimated: estimateTokens(row.question),
        matchLabel: row.question,
      });
    }
    return items;
  });
}
