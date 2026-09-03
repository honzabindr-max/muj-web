import type { Pool } from "pg";

import { decryptPayload } from "@/h2/crypto/envelope";
import type { EncryptionKeyRegistry } from "@/h2/crypto/keys";
import { withOwnerScope } from "@/h2/db/with-owner-scope";
import type { FencingToken } from "@/h2/processing/lease";

import { commitVoiceTranscript } from "./commit-transcript";
import { decodeVoiceReferenceHandle, type VoiceReferenceHandle } from "./reference-handle";
import { downloadTelegramVoiceAudio, type DownloadedVoiceAudio } from "./telegram-download";
import { transcribeAudio, type TranscriptionResult } from "./transcribe";

export type VoiceDownloadFn = (fileId: string, botToken: string) => Promise<DownloadedVoiceAudio>;
export type VoiceTranscribeFn = (audio: Buffer, mimeType: string, apiKey: string) => Promise<TranscriptionResult>;

export type VoiceJobCredentials = { telegramBotToken: string; openaiApiKey: string };
export type VoiceJobAdapters = { download?: VoiceDownloadFn; transcribe?: VoiceTranscribeFn };

/**
 * Přečte referenční handle uložený při ingestu (BUILD-04 `ingestMessage()`,
 * beze změny) — dešifruje stejným `registry` jako zbytek payloadů.
 */
export async function readVoiceReferenceHandle(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  ownerId: string,
  rawEventId: string,
): Promise<VoiceReferenceHandle> {
  return withOwnerScope(pool, ownerId, async (client) => {
    const result = await client.query<{ payload_ciphertext: Buffer; encryption_key_version: number }>(
      `select payload_ciphertext, encryption_key_version from raw_events where id = $1 and payload_type = 'VOICE'`,
      [rawEventId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("H2 voice: raw_event not found or not VOICE payload_type");
    }
    const plaintext = decryptPayload(row.payload_ciphertext, row.encryption_key_version, registry);
    return decodeVoiceReferenceHandle(plaintext);
  });
}

/**
 * transcribeVoiceJob() — orchestrace: přečte reference handle → stáhne
 * audio → přepíše → commitne transcript in-place (BUILD-06 plán,
 * Rozhodnutí 1/4/5). NEVOLÁ `commitJobResult()` — skutečná Buddy odpověď
 * je BUILD-10 (stejný důvod jako BUILD-05 Rozhodnutí 2: placeholder
 * response v produkci by byl horší než žádný trigger). Volající (test,
 * ruční ověřovací skript, později BUILD-10 trigger), který chce zároveň
 * ověřit "odpověď bez duplicity" (AT-04), zavolá `commitJobResult()`
 * odděleně se svým vlastním `work` — přesně jako BUILD-05 AT-03 test.
 *
 * `download`/`transcribe` throwlé chyby se NEPOLYKAJÍ (Rozhodnutí 6) —
 * volající je odchytí a zavolá `h2/processing/quarantine.ts`
 * `recordJobFailure()`, beze změny kódu BUILD-05.
 */
export async function transcribeVoiceJob(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  token: FencingToken,
  credentials: VoiceJobCredentials,
  adapters: VoiceJobAdapters = {},
): Promise<{ transcriptText: string }> {
  const handle = await readVoiceReferenceHandle(pool, registry, token.ownerId, token.rawEventId);

  const download = adapters.download ?? downloadTelegramVoiceAudio;
  const transcribe = adapters.transcribe ?? transcribeAudio;

  const { audio, mimeType } = await download(handle.telegramFileId, credentials.telegramBotToken);
  const { text } = await transcribe(audio, mimeType, credentials.openaiApiKey);

  await commitVoiceTranscript(pool, registry, token, Buffer.from(text, "utf8"), handle.durationSeconds);

  return { transcriptText: text };
}
