import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { callAnthropicModel } from "../anthropic-adapter";
import { H2AnthropicCallError } from "../errors";

/**
 * Mockovaný `fetch` — žádné reálné Anthropic volání (BUILD-07 plán,
 * Rozhodnutí 6).
 */
describe("callAnthropicModel()", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("happy path → text + token counts z odpovědi, model/system/messages v request body", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: "ahoj" }], usage: { input_tokens: 12, output_tokens: 34 } }),
        { status: 200 },
      ),
    );

    const result = await callAnthropicModel("claude-sonnet-5", "system prompt", "user input", "sk-ant-test");

    expect(result).toEqual({ text: "ahoj", inputTokens: 12, outputTokens: 34 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-test");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.system).toBe("system prompt");
    expect(body.messages).toEqual([{ role: "user", content: "user input" }]);
  });

  it("429 → H2AnthropicCallError ANTHROPIC_RATE_LIMITED", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_RATE_LIMITED",
    });
  });

  it("500 → H2AnthropicCallError ANTHROPIC_HTTP_ERROR", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("server error", { status: 500 }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_HTTP_ERROR",
    });
  });

  it("fetch selže (timeout/network) → H2AnthropicCallError ANTHROPIC_TIMEOUT", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const error = await callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(H2AnthropicCallError);
    expect((error as H2AnthropicCallError).code).toBe("ANTHROPIC_TIMEOUT");
  });
});
