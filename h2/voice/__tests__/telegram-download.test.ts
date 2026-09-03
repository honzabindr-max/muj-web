import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { H2VoiceDownloadError } from "../errors";
import { downloadTelegramVoiceAudio } from "../telegram-download";

/**
 * Mockovaný `fetch` — žádné reálné Telegram volání (BUILD-06 plán,
 * Rozhodnutí 3). Ověřuje request shape a chybové stavy, ne skutečnou síť.
 */
describe("downloadTelegramVoiceAudio()", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getFile → stažení souboru, správné URL a mimeType", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { file_path: "voice/file_1.oga" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const result = await downloadTelegramVoiceAudio("file-id-1", "bot-token-1");

    expect(result.mimeType).toBe("audio/ogg");
    expect(Buffer.from(result.audio)).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.telegram.org/botbot-token-1/getFile?file_id=file-id-1");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.telegram.org/file/botbot-token-1/voice/file_1.oga");
  });

  it("getFile vrátí ok:false → H2VoiceDownloadError TELEGRAM_DOWNLOAD_HTTP_ERROR", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 200 }));

    const error = await downloadTelegramVoiceAudio("file-id-2", "bot-token-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(H2VoiceDownloadError);
    expect((error as H2VoiceDownloadError).code).toBe("TELEGRAM_DOWNLOAD_HTTP_ERROR");
  });

  it("non-200 na getFile → H2VoiceDownloadError TELEGRAM_DOWNLOAD_HTTP_ERROR", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("server error", { status: 500 }));

    await expect(downloadTelegramVoiceAudio("file-id-3", "bot-token-1")).rejects.toMatchObject({
      code: "TELEGRAM_DOWNLOAD_HTTP_ERROR",
    });
  });

  it("fetch selže (timeout/network) → H2VoiceDownloadError TELEGRAM_DOWNLOAD_TIMEOUT", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(downloadTelegramVoiceAudio("file-id-4", "bot-token-1")).rejects.toMatchObject({
      code: "TELEGRAM_DOWNLOAD_TIMEOUT",
    });
  });
});
