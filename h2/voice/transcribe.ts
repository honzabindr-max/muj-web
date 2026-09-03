import { H2VoiceTranscriptionError } from "./errors";

/**
 * OpenAI Whisper transkripce (BUILD-06 plán, Rozhodnutí 6). Pinned model
 * `whisper-1` (Technical Architecture v1.2: "Pinned transcription model
 * pro české hlasovky"). `AbortController` timeout 45s — stejný rozpočtový
 * důvod jako `telegram-download.ts`.
 */
const TRANSCRIBE_TIMEOUT_MS = 45_000;
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
export const WHISPER_MODEL_ID = "whisper-1";

export type TranscriptionResult = { text: string };

export async function transcribeAudio(audio: Buffer, mimeType: string, apiKey: string): Promise<TranscriptionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

  const form = new FormData();
  form.append("model", WHISPER_MODEL_ID);
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), "voice.ogg");

  let response: Response;
  try {
    response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
  } catch {
    throw new H2VoiceTranscriptionError("WHISPER_TIMEOUT");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new H2VoiceTranscriptionError("WHISPER_RATE_LIMITED");
  }
  if (!response.ok) {
    throw new H2VoiceTranscriptionError("WHISPER_HTTP_ERROR");
  }

  const body = (await response.json()) as { text?: string };
  if (typeof body.text !== "string") {
    throw new H2VoiceTranscriptionError("WHISPER_HTTP_ERROR");
  }
  return { text: body.text };
}
