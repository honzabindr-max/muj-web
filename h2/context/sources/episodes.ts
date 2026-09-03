import type { Pool } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

import type { ContextCandidateItem } from "../priority";

/**
 * Third-party episode cap (Technical Architecture v1.2 §31.10, BUILD-09
 * plán Rozhodnutí 4, AT-24/AT-25/AT-66). BUILD-14 producent
 * (`evidence_items`), dnes v produkci prázdná tabulka — testy seedují
 * přímo.
 *
 * Cap je PER OSOBU (`person_id`), ne globální součet napříč třetími
 * stranami — přesně 2 nejnovější epizody normální runtime, max 10 při
 * explicitním `purpose='BUDDY_DEEP_DIVE'`. `third_party_aggregation_
 * allowed=false` (invariant I5) je strukturální záruka tohoto modulu:
 * vrací výhradně per-episode kandidáty (`item_type='THIRD_PARTY_
 * EPISODE'`), nikdy agregát/summary/pattern objekt o osobě — cap sám o
 * sobě JE relevance mechanismus pro tuhle třídu kandidátů (žádný
 * name→person_id lookup dnes v schématu neexistuje, entity matching
 * přes `matchLabel` proto nedává smysl — viz plán, Krok 3).
 */
const THIRD_PARTY_CAP_NORMAL = 2;
const THIRD_PARTY_CAP_DEEP_DIVE = 10;

/**
 * `evidence_items` nenese vlastní text payload (obsah je šifrovaný v
 * navázaném `raw_events`, dešifrovat ho tady by bylo mimo scope Context
 * Enginu) — fixní placeholder do doby, než BUILD-14/19 dodá lepší odhad.
 */
const PLACEHOLDER_EPISODE_TOKENS = 50;

export async function getThirdPartyEpisodeCandidates(
  pool: Pool,
  ownerId: string,
  purpose: string,
): Promise<ContextCandidateItem[]> {
  const capPerPerson = purpose === "BUDDY_DEEP_DIVE" ? THIRD_PARTY_CAP_DEEP_DIVE : THIRD_PARTY_CAP_NORMAL;

  return withOwnerScope(pool, ownerId, async (client) => {
    const result = await client.query<{ id: string; person_id: string }>(
      `select id, person_id from evidence_items
       where owner_id = $1 and person_id is not null
       order by person_id, created_at desc`,
      [ownerId],
    );

    const perPersonCount = new Map<string, number>();
    const items: ContextCandidateItem[] = [];
    for (const row of result.rows) {
      const count = perPersonCount.get(row.person_id) ?? 0;
      if (count >= capPerPerson) continue;
      perPersonCount.set(row.person_id, count + 1);
      items.push({
        itemType: "THIRD_PARTY_EPISODE",
        itemId: row.id,
        priority: "P3",
        reason: `third-party episode, capped at ${capPerPerson} per person (§31.10)`,
        tokensEstimated: PLACEHOLDER_EPISODE_TOKENS,
        personId: row.person_id,
        requiredForAction: true,
      });
    }
    return items;
  });
}
