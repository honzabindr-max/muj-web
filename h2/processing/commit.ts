import type { Pool } from "pg";

import { encryptPayload } from "@/h2/crypto/envelope";
import type { EncryptionKeyRegistry } from "@/h2/crypto/keys";
import { withOwnerScope } from "@/h2/db/with-owner-scope";

import { H2FencingError } from "./errors";
import type { FencingToken } from "./lease";

export type JobWorkResult = {
  responsePayloadPlaintext: Buffer;
  stance?: "BE_WITH" | "EXPLORE" | "ACT" | null;
};

/**
 * commitJobResult(pool, registry, token, work) — `work` je injektovaná
 * funkce (BUILD-05 negeneruje skutečnou Buddy odpověď, to je BUILD-07/10);
 * tahle funkce jen bezpečně commitne cokoliv `work` vrátí, přesně jednou,
 * fencing-chráněně (Technical Architecture v1.2 §4.4, BUILD-05 plán,
 * Rozhodnutí 4).
 *
 * Fencing NENÍ "přečti epoch v aplikaci, pak zapiš" (TOCTOU race okno) —
 * je to jedna atomická UPDATE ... WHERE s epoch podmínkou (lease i
 * control zároveň, AT-67/AT-71) přímo v SQL. Neaktuální token dostane
 * explicitní H2FencingError, nikdy tichý úspěch. `responses.source_
 * raw_event_id` je navíc UNIQUE — druhá vrstva obrany na DB úrovni, kdyby
 * fencing check sám selhal.
 *
 * Pokud `work()` selže (throwne), commitJobResult nic nemění v DB a chybu
 * propaguje — volající zavolá h2/processing/quarantine.ts recordJobFailure()
 * s touhle chybou (retry/backoff, nebo terminální karanténa).
 */
export async function commitJobResult(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  token: FencingToken,
  work: () => Promise<JobWorkResult>,
): Promise<{ responseId: string }> {
  const result = await work();
  const { ciphertext, keyVersion } = encryptPayload(result.responsePayloadPlaintext, registry);

  return withOwnerScope(pool, token.ownerId, async (client) => {
    const fencingCheck = await client.query(
      `update message_processing_jobs
       set status = 'RESPONSE_READY', finished_at = now(), updated_at = now()
       where id = $1
         and status = 'PROCESSING'
         and (select lease_epoch from owner_processing_state where owner_id = $2) = $3
         and (select owner_control_epoch from owner_processing_state where owner_id = $2) = $4
       returning id`,
      [token.jobId, token.ownerId, token.leaseEpoch, token.ownerControlEpoch],
    );
    if ((fencingCheck.rowCount ?? 0) === 0) {
      throw new H2FencingError("STALE_FENCING_TOKEN", token.jobId);
    }

    const responseInsert = await client.query<{ id: string }>(
      `insert into responses (owner_id, source_raw_event_id, source_input_sequence, payload_ciphertext, encryption_key_version, stance)
       values ($1, $2, (select input_sequence from raw_events where id = $2), $3, $4, $5)
       returning id`,
      [token.ownerId, token.rawEventId, ciphertext, keyVersion, result.stance ?? null],
    );

    await client.query(
      `update owner_processing_state
       set active_job_id = null,
           lease_until = null,
           last_settled_input_sequence = greatest(
             last_settled_input_sequence,
             (select input_sequence from raw_events where id = $2)
           ),
           updated_at = now()
       where owner_id = $1`,
      [token.ownerId, token.rawEventId],
    );

    return { responseId: responseInsert.rows[0].id };
  });
}
