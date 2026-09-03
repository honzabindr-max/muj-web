import type { Pool } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

import type { FitToBudgetResult } from "./budget-fit";
import { sumTokens } from "./priority";

/**
 * Zapíše `context_runs` + `context_run_items` v jedné owner-scoped
 * transakci (§7.4 — `context_runs` povinně ukládá auditovatelné
 * `input_tokens_estimated`/`omitted_item_ids`/`omission_reason`).
 * `included`/`omitted` z `fitToBudget()` se zapíšou jako stejná sada
 * `context_run_items` řádků, jen s jiným `included` flagem — ať audit
 * vidí i to, co se zvažovalo a nedostalo se dovnitř.
 */
export type PersistContextRunInput = {
  ownerId: string;
  purpose: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  fit: FitToBudgetResult;
  llmRunId?: string | null;
};

export async function persistContextRun(pool: Pool, input: PersistContextRunInput): Promise<{ contextRunId: string }> {
  return withOwnerScope(pool, input.ownerId, async (client) => {
    const inputTokensEstimated = sumTokens(input.fit.included);

    const run = await client.query<{ id: string }>(
      `insert into context_runs (owner_id, llm_run_id, purpose, input_tokens_estimated, max_input_tokens, max_output_tokens, omission_reason)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [
        input.ownerId,
        input.llmRunId ?? null,
        input.purpose,
        inputTokensEstimated,
        input.maxInputTokens,
        input.maxOutputTokens,
        input.fit.omissionReason,
      ],
    );
    const contextRunId = run.rows[0].id;

    const rows = [
      ...input.fit.included.map((item) => ({ item, included: true })),
      ...input.fit.omitted.map((item) => ({ item, included: false })),
    ];

    for (const { item, included } of rows) {
      await client.query(
        `insert into context_run_items (owner_id, context_run_id, item_type, item_id, priority, included, person_id, reason)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [input.ownerId, contextRunId, item.itemType, item.itemId, item.priority, included, item.personId ?? null, item.reason],
      );
    }

    return { contextRunId };
  });
}
