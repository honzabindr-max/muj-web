import type { Pool } from "pg";

import { encryptPayload } from "@/h2/crypto/envelope";
import type { EncryptionKeyRegistry } from "@/h2/crypto/keys";
import { withOwnerScope } from "@/h2/db/with-owner-scope";
import { H2FencingError } from "@/h2/processing/errors";
import type { FencingToken } from "@/h2/processing/lease";

import { recordWhisperUsage } from "./usage";

/**
 * commitVoiceTranscript() — materializuje transcript IN-PLACE do stejného
 * `raw_events` řádku, který při ingestu držel jen reference handle
 * (BUILD-06 plán, Rozhodnutí 1). `UPDATE` je z podstaty idempotentní
 * (retry přepíše na stejný výsledek, žádný duplicitní řádek), takže tu
 * není potřeba samostatný "transcript už hotový" guard navíc k fencingu.
 *
 * Šifrování: stejný envelope jako každý jiný payload (Rozhodnutí 5) —
 * `encryptPayload()`, vlastní `encryption_key_version` na řádku.
 *
 * Fencing: stejná atomická `UPDATE ... WHERE` epoch-check klauzule jako
 * `h2/processing/commit.ts` `commitJobResult()` — ne "přečti pak zapiš".
 *
 * Metering (Rozhodnutí 4): `recordWhisperUsage()` běží VE STEJNÉ transakci
 * jako transcript update — atomicky, buď oba zápisy, nebo žádný.
 */
export async function commitVoiceTranscript(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  token: FencingToken,
  transcriptPlaintext: Buffer,
  durationSeconds: number,
): Promise<void> {
  const { ciphertext, keyVersion } = encryptPayload(transcriptPlaintext, registry);

  return withOwnerScope(pool, token.ownerId, async (client) => {
    const fencingCheck = await client.query(
      `update raw_events
       set payload_ciphertext = $2, encryption_key_version = $3
       where id = $1
         and payload_type = 'VOICE'
         and (select lease_epoch from owner_processing_state where owner_id = $4) = $5
         and (select owner_control_epoch from owner_processing_state where owner_id = $4) = $6
       returning id`,
      [token.rawEventId, ciphertext, keyVersion, token.ownerId, token.leaseEpoch, token.ownerControlEpoch],
    );
    if ((fencingCheck.rowCount ?? 0) === 0) {
      throw new H2FencingError("STALE_FENCING_TOKEN", token.jobId);
    }

    await recordWhisperUsage(client, token.ownerId, durationSeconds);
  });
}
