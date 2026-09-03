import type { Pool } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

/**
 * Entity resolution v1 (BUILD-09 plán Krok 2, Rozhodnutí 1) — jediný
 * dnes živý zdroj "o čem je tahle zpráva" je BUILD-08
 * `operational_extractions` (`type='ENTITY'` kandidáti pro aktuální
 * `raw_event_id`). Skutečné pojmenované executive objekty vznikají až
 * BUILD-12 — tenhle resolver je záměrně hrubý, deterministický seam,
 * ne zamknutá implementace.
 */
export type ResolvedEntity = {
  refType: string;
  label: string;
};

type OperationalCandidate = {
  type: string;
  payload?: Record<string, unknown>;
};

const LABEL_KEYS = ["name", "label", "title", "text"] as const;

function extractLabel(payload: Record<string, unknown>): string | null {
  for (const key of LABEL_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function extractRefType(payload: Record<string, unknown>): string {
  const value = payload["refType"] ?? payload["entityType"];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "UNKNOWN";
}

export async function resolveMessageEntities(pool: Pool, ownerId: string, rawEventId: string): Promise<ResolvedEntity[]> {
  return withOwnerScope(pool, ownerId, async (client) => {
    const result = await client.query<{ output: { candidates?: OperationalCandidate[] } }>(
      `select output from operational_extractions
       where owner_id = $1 and raw_event_id = $2 and status = 'OK'
       order by created_at desc
       limit 1`,
      [ownerId, rawEventId],
    );

    const candidates = result.rows[0]?.output?.candidates ?? [];
    const byLabel = new Map<string, ResolvedEntity>();

    for (const candidate of candidates) {
      if (candidate.type !== "ENTITY") continue;
      const payload = candidate.payload ?? {};
      const label = extractLabel(payload);
      if (!label) continue;
      const key = label.toLowerCase();
      if (!byLabel.has(key)) {
        byLabel.set(key, { refType: extractRefType(payload), label });
      }
    }

    return [...byLabel.values()];
  });
}
