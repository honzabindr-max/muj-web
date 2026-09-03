import type { Pool } from "pg";

import { encryptPayload } from "@/h2/crypto/envelope";
import type { EncryptionKeyRegistry } from "@/h2/crypto/keys";
import { withOwnerScope } from "@/h2/db/with-owner-scope";
import { bumpOwnerControlEpochWithClient } from "@/h2/processing/control-epoch";

import type { FastPathControlCommand } from "./control-fast-path";
import { detectFastPathControlCommand } from "./control-fast-path";

/**
 * ingestMessage() — jediná doménová funkce, kterou volají Telegram i web
 * (Technical Architecture v1.2 §4.1, Build Spec BUILD-04 DoD AT-01/02/48/61).
 *
 * V jedné DB transakci (owner-scoped přes withOwnerScope, stejný RLS vzor
 * jako BUILD-03A hotfix):
 * 1. dedup podle (owner_id, channel, external_event_id) — AT-02,
 * 2. alokace conversation_sequence (+ input_sequence jen pro speaker=USER)
 *    pod advisory lockem per owner, aby konkurentní ingest ze dvou kanálů
 *    nekolidoval na unique constraint (§5),
 * 3. insert immutable raw_event se šifrovaným payloadem,
 * 4. message_processing_job vzniká VÝHRADNĚ pro speaker=USER — AT-61.
 *
 * Volající (webhook/route handler) smí vrátit ACK/200 teprve po úspěšném
 * návratu této funkce (§4.1: "Teprve po commitu smí Telegram webhook vrátit
 * HTTP 200") — AT-01.
 *
 * **DEC-007 (Sovereignty fast path, C2):** `ingestMessage()` zůstává
 * jediným vstupem a VŽDY vytvoří raw_event i job i pro control command —
 * žádná zpráva nikdy nezmizí z lifecycle kvůli klasifikaci (I7.6).
 * Pokud text přesně odpovídá `/stop`/`/pause`/`/resume` (§8.1 exact-match,
 * `h2/ingestion/control-fast-path.ts`), navíc se ve STEJNÉ transakci
 * zavolá `bumpOwnerControlEpochWithClient()` — dědí dedup (krok 1 výše)
 * i per-owner ordering (advisory lock + sekvence), takže nevzniká druhá
 * transakce ani crash window (I7.3/I7.4). BUILD-10's Command Gate re-
 * detekuje stejnou funkcí a NESMÍ bumpnout znovu (viz komentář tam).
 */
export type IngestChannel = "telegram" | "web";
export type IngestSpeaker = "USER" | "BUDDY" | "SYSTEM";
export type IngestPayloadType = "TEXT" | "VOICE" | "SYSTEM_EVENT";

export type IngestMessageInput = {
  ownerId: string;
  channel: IngestChannel;
  speaker: IngestSpeaker;
  /** Externí dedup klíč (Telegram update_id, web clientMessageId). Buddy/system turns ho typicky nemají. */
  externalEventId: string | null;
  payloadType: IngestPayloadType;
  payloadPlaintext: Buffer;
};

export type IngestMessageResult =
  | { duplicate: true; rawEventId: string }
  | { duplicate: false; rawEventId: string; jobId: string | null; fastPathCommand: FastPathControlCommand | null };

export async function ingestMessage(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  input: IngestMessageInput,
): Promise<IngestMessageResult> {
  return withOwnerScope(pool, input.ownerId, async (client) => {
    // Serializuje konkurentní ingest transakce pro stejného ownera (Telegram
    // + web současně), aby alokace conversation_sequence/input_sequence
    // níže nekolidovala na unique constraint (§5). Plná lease/fencing
    // ordering garance je BUILD-05; tady jde jen o bezpečnou alokaci.
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`h2_ingest_owner:${input.ownerId}`]);

    if (input.externalEventId !== null) {
      const existing = await client.query<{ id: string }>(
        `select id from raw_events where owner_id = $1 and channel = $2 and external_event_id = $3`,
        [input.ownerId, input.channel, input.externalEventId],
      );
      if (existing.rows.length > 0) {
        return { duplicate: true, rawEventId: existing.rows[0].id };
      }
    }

    const conversationSequenceResult = await client.query<{ next: string }>(
      `select coalesce(max(conversation_sequence), 0) + 1 as next from raw_events where owner_id = $1`,
      [input.ownerId],
    );
    const conversationSequence = conversationSequenceResult.rows[0].next;

    let inputSequence: string | null = null;
    if (input.speaker === "USER") {
      const inputSequenceResult = await client.query<{ next: string }>(
        `select coalesce(max(input_sequence), 0) + 1 as next
         from raw_events where owner_id = $1 and input_sequence is not null`,
        [input.ownerId],
      );
      inputSequence = inputSequenceResult.rows[0].next;
    }

    const { ciphertext, keyVersion } = encryptPayload(input.payloadPlaintext, registry);

    const rawEventInsert = await client.query<{ id: string }>(
      `insert into raw_events
         (owner_id, conversation_sequence, input_sequence, channel, external_event_id, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id`,
      [
        input.ownerId,
        conversationSequence,
        inputSequence,
        input.channel,
        input.externalEventId,
        input.speaker,
        ciphertext,
        input.payloadType,
        keyVersion,
      ],
    );
    const rawEventId = rawEventInsert.rows[0].id;

    let jobId: string | null = null;
    if (input.speaker === "USER") {
      const jobInsert = await client.query<{ id: string }>(
        `insert into message_processing_jobs (owner_id, raw_event_id, status, available_at)
         values ($1, $2, 'PENDING', now())
         returning id`,
        [input.ownerId, rawEventId],
      );
      jobId = jobInsert.rows[0].id;
    }

    // DEC-007 (C2): fast path jako side effect ve STEJNÉ transakci, nikdy
    // jako exkluzivní routing — raw_event a job výše vznikly bez ohledu na
    // tohle. Jen USER + TEXT zprávy mají smysluplný plaintext k detekci.
    let fastPathCommand: FastPathControlCommand | null = null;
    if (input.speaker === "USER" && input.payloadType === "TEXT") {
      fastPathCommand = detectFastPathControlCommand(input.payloadPlaintext.toString("utf8"));
      if (fastPathCommand !== null) {
        await bumpOwnerControlEpochWithClient(client, input.ownerId);
      }
    }

    return { duplicate: false, rawEventId, jobId, fastPathCommand };
  });
}
