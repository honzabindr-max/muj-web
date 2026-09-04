import { H2VoiceDownloadError } from "./errors";

/**
 * Telegram voice download (BUILD-06 plán, Rozhodnutí 6): `getFile` +
 * stažení audio bajtů. `AbortController` timeout 45s na КAŽDÉ síťové
 * volání — rozpočet pro 3 pokusy + backoff musí bezpečně vejít pod 300s
 * voice processing budget (BUILD-05/BUILD-11 `processingBudgetMsFor('VOICE')`).
 *
 * Telegram `message.voice` je vždy OGG/OPUS (na rozdíl od obecného
 * `audio`/`document`), mimeType je proto pevný.
 */
const DOWNLOAD_TIMEOUT_MS = 45_000;
const TELEGRAM_API_BASE = "https://api.telegram.org";
const VOICE_MIME_TYPE = "audio/ogg";

export type DownloadedVoiceAudio = { audio: Buffer; mimeType: string };

type TelegramGetFileResponse = { ok: boolean; result?: { file_path?: string } };

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    throw new H2VoiceDownloadError("TELEGRAM_DOWNLOAD_TIMEOUT");
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadTelegramVoiceAudio(fileId: string, botToken: string): Promise<DownloadedVoiceAudio> {
  const metaResponse = await fetchWithTimeout(`${TELEGRAM_API_BASE}/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!metaResponse.ok) {
    throw new H2VoiceDownloadError("TELEGRAM_DOWNLOAD_HTTP_ERROR");
  }
  const meta = (await metaResponse.json()) as TelegramGetFileResponse;
  const filePath = meta.result?.file_path;
  if (!meta.ok || !filePath) {
    throw new H2VoiceDownloadError("TELEGRAM_DOWNLOAD_HTTP_ERROR");
  }

  const fileResponse = await fetchWithTimeout(`${TELEGRAM_API_BASE}/file/bot${botToken}/${filePath}`);
  if (!fileResponse.ok) {
    throw new H2VoiceDownloadError("TELEGRAM_DOWNLOAD_HTTP_ERROR");
  }

  const audio = Buffer.from(await fileResponse.arrayBuffer());
  return { audio, mimeType: VOICE_MIME_TYPE };
}
