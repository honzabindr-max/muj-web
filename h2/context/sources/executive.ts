import type { Pool } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

import type { ContextCandidateItem } from "../priority";
import { estimateTokens } from "../token-budget";

/**
 * P1 kandidáti z executive tabulek (§7.4 — "aktivní entity/commitments/
 * experimenty" mají nejvyšší prioritu z P1-P4 skupiny). BUILD-12
 * producent — dnes v produkci prázdné tabulky (viz BUILD-09-PLAN.md
 * "Co BUILD-09 znovu nestaví"), testy seedují přímo.
 *
 * `matchLabel` = jméno/statement/title podkladového řádku, proti kterému
 * relevance floor (`h2/context/relevance-floor.ts`) porovnává
 * `resolveMessageEntities()` výsledky.
 */
function toCandidate(itemType: string, itemId: string, label: string): ContextCandidateItem {
  return {
    itemType,
    itemId,
    priority: "P1",
    reason: `active ${itemType.toLowerCase()}`,
    tokensEstimated: estimateTokens(label),
    matchLabel: label,
  };
}

export async function getExecutiveCandidates(pool: Pool, ownerId: string): Promise<ContextCandidateItem[]> {
  return withOwnerScope(pool, ownerId, async (client) => {
    // Sekvenční dotazy — jeden DB klient (owner-scoped transakce) nesmí
    // souběžně vyřizovat víc query najednou (pg to sice historicky
    // tiše fronoval, ale je to deprecated chování, ne garance).
    const projects = await client.query<{ id: string; name: string }>(
      `select id, name from projects where owner_id = $1 and status = 'ACTIVE'`,
      [ownerId],
    );
    const commitments = await client.query<{ id: string; statement: string }>(
      `select id, statement from commitments where owner_id = $1 and status = 'ACTIVE'`,
      [ownerId],
    );
    const tasks = await client.query<{ id: string; title: string }>(
      `select id, title from tasks where owner_id = $1 and status = 'OPEN'`,
      [ownerId],
    );
    const openLoops = await client.query<{ id: string; title: string }>(
      `select id, title from open_loops where owner_id = $1 and status in ('OPEN', 'PARKED', 'RESUMED')`,
      [ownerId],
    );
    // Reminders nemají vlastní text — label se dopočítá z navázaného tasku/commitmentu/open loopu.
    const reminders = await client.query<{ id: string; label: string | null }>(
      `select r.id, coalesce(t.title, c.statement, o.title) as label
       from reminders r
       left join tasks t on t.id = r.task_id
       left join commitments c on c.id = r.commitment_id
       left join open_loops o on o.id = r.open_loop_id
       where r.owner_id = $1 and r.status = 'PENDING'`,
      [ownerId],
    );

    const items: ContextCandidateItem[] = [];
    for (const row of projects.rows) items.push(toCandidate("PROJECT", row.id, row.name));
    for (const row of commitments.rows) items.push(toCandidate("COMMITMENT", row.id, row.statement));
    for (const row of tasks.rows) items.push(toCandidate("TASK", row.id, row.title));
    for (const row of openLoops.rows) items.push(toCandidate("OPEN_LOOP", row.id, row.title));
    for (const row of reminders.rows) {
      if (row.label) items.push(toCandidate("REMINDER", row.id, row.label));
    }
    return items;
  });
}
