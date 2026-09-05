import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendTelegramMessage } from "../telegram-send";

/**
 * sendTelegramMessage() — mockovaný `fetch`, žádné reálné Telegram volání
 * (stejná disciplína jako h2/prompts/__tests__/anthropic-adapter.test.ts).
 * AT-10's rozlišení network-timeout (AMBIGUOUS) vs. definitivní HTTP chyba
 * (DEFINITIVE_ERROR, Telegram request prokazatelně přijal) se rozhoduje
 * přesně tady.
 */
describe("sendTelegramMessage()", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("úspěch → SUCCESS s externalMessageId z result.message_id", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }), { status: 200 }));

    const result = await sendTelegramMessage("chat-1", "ahoj", "bot-token");
    expect(result).toEqual({ kind: "SUCCESS", externalMessageId: "123" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/botbot-token/sendMessage");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ chat_id: "chat-1", text: "ahoj" });
  });

  it("fetch selže (network timeout/abort) → AMBIGUOUS, ne DEFINITIVE_ERROR", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const result = await sendTelegramMessage("chat-1", "ahoj", "bot-token");
    expect(result).toEqual({ kind: "AMBIGUOUS" });
  });

  it("400 (Telegram prokazatelně odpověděl) → DEFINITIVE_ERROR, ne AMBIGUOUS", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), { status: 400 }),
    );

    const result = await sendTelegramMessage("chat-1", "ahoj", "bot-token");
    expect(result).toEqual({ kind: "DEFINITIVE_ERROR", description: "Bad Request: chat not found" });
  });

  it("200 ale ok:false/chybějící message_id → DEFINITIVE_ERROR (malformed success)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 200 }));

    const result = await sendTelegramMessage("chat-1", "ahoj", "bot-token");
    expect(result.kind).toBe("DEFINITIVE_ERROR");
  });
});
