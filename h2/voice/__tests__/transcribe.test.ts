import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { H2VoiceTranscriptionError } from "../errors";
import { transcribeAudio, WHISPER_MODEL_ID } from "../transcribe";

/**
 * Mockovaný `fetch` — žádné reálné OpenAI volání (BUILD-06 plán,
 * Rozhodnutí 3).
 */
describe("transcribeAudio()", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("happy path → text z odpovědi, model whisper-1 v request body", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: "ahoj Buddy" }), { status: 200 }));

    const result = await transcribeAudio(Buffer.from([1, 2, 3]), "audio/ogg", "sk-test-key");

    expect(result.text).toBe("ahoj Buddy");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test-key");
    const form = init.body as FormData;
    expect(form.get("model")).toBe(WHISPER_MODEL_ID);
  });

  it("429 → H2VoiceTranscriptionError WHISPER_RATE_LIMITED", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

    await expect(transcribeAudio(Buffer.from([1]), "audio/ogg", "sk-test-key")).rejects.toMatchObject({
      code: "WHISPER_RATE_LIMITED",
    });
  });

  it("500 → H2VoiceTranscriptionError WHISPER_HTTP_ERROR", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("server error", { status: 500 }));

    await expect(transcribeAudio(Buffer.from([1]), "audio/ogg", "sk-test-key")).rejects.toMatchObject({
      code: "WHISPER_HTTP_ERROR",
    });
  });

  it("fetch selže (timeout/network) → H2VoiceTranscriptionError WHISPER_TIMEOUT", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const error = await transcribeAudio(Buffer.from([1]), "audio/ogg", "sk-test-key").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(H2VoiceTranscriptionError);
    expect((error as H2VoiceTranscriptionError).code).toBe("WHISPER_TIMEOUT");
  });
});
