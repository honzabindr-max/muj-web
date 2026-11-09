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

/**
 * DC-17 — rozliší "VOICE řádek pořád drží reference handle" od "VOICE řádek
 * už drží přepis" (`commitVoiceTranscript()` záměrně nechává
 * `payload_type='VOICE'`, takže typ sám to nerozliší). Handle je JSON objekt
 * s klíčem `telegramFileId`; přepis z Whisperu takový objekt není. Detekce je
 * záměrně široká (stačí klíč, ne validní tvar) — i poškozený handle se musí
 * považovat za handle a NIKDY nesmí odejít do LLM jako text.
 */
export function isVoiceReferenceHandlePayload(plaintext: Buffer): boolean {
  try {
    const parsed: unknown = JSON.parse(plaintext.toString("utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) && "telegramFileId" in parsed;
  } catch {
    return false;
  }
}
