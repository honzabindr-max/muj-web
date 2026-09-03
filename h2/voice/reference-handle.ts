/**
 * Voice flow krok 1 (Technical Architecture v1.2 §5): "raw event uchová
 * metadata a dočasný reference handle." Malý JSON, zašifrovaný stejným
 * envelope jako jakýkoli jiný payload — ingest ho zapíše, `process-voice-
 * job.ts` ho přečte a přepíše transcriptem (BUILD-06 plán, Rozhodnutí 1).
 */
export type VoiceReferenceHandle = {
  telegramFileId: string;
  durationSeconds: number;
};

export function encodeVoiceReferenceHandle(handle: VoiceReferenceHandle): Buffer {
  return Buffer.from(JSON.stringify(handle), "utf8");
}

export function decodeVoiceReferenceHandle(plaintext: Buffer): VoiceReferenceHandle {
  const parsed = JSON.parse(plaintext.toString("utf8")) as Partial<VoiceReferenceHandle>;
  if (typeof parsed.telegramFileId !== "string" || typeof parsed.durationSeconds !== "number") {
    throw new Error("H2 voice: malformed reference handle");
  }
  return { telegramFileId: parsed.telegramFileId, durationSeconds: parsed.durationSeconds };
}
