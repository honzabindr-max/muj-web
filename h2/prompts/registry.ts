import type { Pool } from "pg";

export type PromptVersionRow = {
  id: string;
  purpose: string;
  version: number;
  status: string;
  content: string;
  outputSchema: unknown;
};

/**
 * Vytvoří novou DRAFT verzi (další číslo verze pro daný purpose). Nízká
 * souběžnost očekávaná (admin/authoring akce, ne hot path) — `unique
 * (purpose, version)` constraint (BUILD-02) je druhá vrstva obrany proti
 * závodu na číslo verze.
 */
export async function createDraftPromptVersion(
  pool: Pool,
  purpose: string,
  content: string,
  outputSchema: unknown = null,
): Promise<{ id: string; version: number }> {
  const result = await pool.query<{ id: string; version: number }>(
    `insert into prompt_versions (purpose, version, status, content, output_schema)
     values ($1, coalesce((select max(version) from prompt_versions where purpose = $1), 0) + 1, 'DRAFT', $2, $3)
     returning id, version`,
    [purpose, content, outputSchema === null ? null : JSON.stringify(outputSchema)],
  );
  return result.rows[0];
}

export async function getActivePromptVersion(pool: Pool, purpose: string): Promise<PromptVersionRow | null> {
  const result = await pool.query<PromptVersionRow>(
    `select id, purpose, version, status, content, output_schema as "outputSchema"
     from prompt_versions where purpose = $1 and status = 'ACTIVE'`,
    [purpose],
  );
  return result.rows[0] ?? null;
}
