import type { Pool } from "pg";

import { decryptPayload } from "@/h2/crypto/envelope";
import type { EncryptionKeyRegistry } from "@/h2/crypto/keys";
import { withOwnerScope } from "@/h2/db/with-owner-scope";

/**
 * AT-09/AT-62 dedup pre-check (BUILD-10-PLAN.md "Rozhodnutí 1") —
 * `commitJobResult()` (BUILD-05) volá `work()` bezpodmínečně, takže samo
 * o sobě nezabrání druhému Sonnet volání při retry po commitu, který
 * proběhl (`responses.source_raw_event_id` UNIQUE by druhý insert
 * odmítlo, ale to je AŽ PO zaplacení za druhé Sonnet volání — přesně to,
 * co AT-62 zakazuje). Tenhle check běží PŘED sestavením `work()` closure:
 * pokud `responses` řádek pro `rawEventId` už existuje, `generateBuddy
 * Response()` Sonnet vůbec nevolá, jen dešifruje existující text.
 */
export type ExistingResponse = { responseId: string; responseText: string };

export async function findExistingResponse(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  ownerId: string,
  rawEventId: string,
): Promise<ExistingResponse | null> {
  return withOwnerScope(pool, ownerId, async (client) => {
    const result = await client.query<{ id: string; payload_ciphertext: Buffer; encryption_key_version: number }>(
      `select id, payload_ciphertext, encryption_key_version from responses where source_raw_event_id = $1`,
      [rawEventId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const plaintext = decryptPayload(row.payload_ciphertext, row.encryption_key_version, registry);
    return { responseId: row.id, responseText: plaintext.toString("utf8") };
  });
}
