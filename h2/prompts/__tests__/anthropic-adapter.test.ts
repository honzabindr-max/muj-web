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

  it("maxOutputTokens parametr → max_tokens v request body odpovídá (BUILD-08 Rozhodnutí 4)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: "ahoj" }], usage: { input_tokens: 12, output_tokens: 34 } }),
        { status: 200 },
      ),
    );

    await callAnthropicModel("claude-haiku-4-5-20251001", "system prompt", "user input", "sk-ant-test", 2048);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBe(2048);
  });

  it("bez maxOutputTokens → default zůstává 4096 (Sonnet, beze změny chování)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: "ahoj" }], usage: { input_tokens: 12, output_tokens: 34 } }),
        { status: 200 },
      ),
    );

    await callAnthropicModel("claude-sonnet-5", "system prompt", "user input", "sk-ant-test");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBe(4096);
  });

  it("429 → H2AnthropicCallError ANTHROPIC_RATE_LIMITED", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_RATE_LIMITED",
    });
  });

  /**
   * BUILD-11 Rozhodnutí 3 — rozpad ANTHROPIC_HTTP_ERROR na retryovatelné
   * (500/529 server chyba) vs. neretryovatelné (400/401/403) třídy, plus
   * retry-after header propagovaný na 429. Honzíkova taxonomie: retryovat
   * 429/500/529/síť, nikdy 400/auth/token budget/schema violation/refuz.
   */
  it("500 → H2AnthropicCallError ANTHROPIC_SERVER_ERROR (retryovatelné)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("server error", { status: 500 }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_SERVER_ERROR",
    });
  });

  it("529 → H2AnthropicCallError ANTHROPIC_SERVER_ERROR (retryovatelné)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("overloaded", { status: 529 }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_SERVER_ERROR",
    });
  });

  it("400 → H2AnthropicCallError ANTHROPIC_BAD_REQUEST (neretryovatelné)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("bad request", { status: 400 }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_BAD_REQUEST",
    });
  });

  it("401 → H2AnthropicCallError ANTHROPIC_AUTH_ERROR (neretryovatelné)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_AUTH_ERROR",
    });
  });

  it("403 → H2AnthropicCallError ANTHROPIC_AUTH_ERROR (neretryovatelné)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_AUTH_ERROR",
    });
  });

  it("404 (neklasifikovaný status) → fallback ANTHROPIC_HTTP_ERROR (neretryovatelné, default-deny)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_HTTP_ERROR",
    });
  });

  it("429 s retry-after hlavičkou → retryAfterSeconds na chybě", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 429, headers: { "retry-after": "45" } }));

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_RATE_LIMITED",
      retryAfterSeconds: 45,
    });
  });

  it("429 bez retry-after hlavičky → retryAfterSeconds undefined", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

    const error = await callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(H2AnthropicCallError);
    expect((error as H2AnthropicCallError).retryAfterSeconds).toBeUndefined();
  });

  it("fetch selže (timeout/network) → H2AnthropicCallError ANTHROPIC_TIMEOUT", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const error = await callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(H2AnthropicCallError);
    expect((error as H2AnthropicCallError).code).toBe("ANTHROPIC_TIMEOUT");
  });

  /**
   * Structured Outputs (BUILD-11 rozhodnutí 2026-09-04) — `output_config.format`
   * jde do request body jen když volající předá schema (BUDDY_RESPONSE),
   * OPERATIONAL_EXTRACTION (Haiku) beze změny chování neschema volání.
   */
  it("outputSchema parametr → output_config.format v request body", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1, output_tokens: 1 } }),
        { status: 200 },
      ),
    );
    const schema = { type: "object", properties: { x: { type: "string" } }, required: ["x"], additionalProperties: false };

    await callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test", 4096, schema);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.output_config).toEqual({ format: { type: "json_schema", schema } });
  });

  it("bez outputSchema → žádné output_config v request body (OPERATIONAL_EXTRACTION beze změny)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: "ahoj" }], usage: { input_tokens: 12, output_tokens: 34 } }),
        { status: 200 },
      ),
    );

    await callAnthropicModel("claude-haiku-4-5-20251001", "s", "i", "sk-ant-test");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.output_config).toBeUndefined();
  });

  /**
   * `stop_reason` kontrola (Honzíkovo zadání 2026-09-04): refuz ani ořez na
   * max_tokens se nesmí tvářit jako platná odpověď — adaptér musí thrownout
   * dřív, než by volající (generateBuddyResponse) zkusil parsovat `text` jako
   * validní JSON a nahlásil zavádějící INVALID_MODEL_OUTPUT.
   */
  it("stop_reason='refusal' → H2AnthropicCallError ANTHROPIC_REFUSAL, ne text jako platná odpověď", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ content: [], stop_reason: "refusal" }), { status: 200 }),
    );

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_REFUSAL",
    });
  });

  it("stop_reason='max_tokens' → H2AnthropicCallError ANTHROPIC_MAX_TOKENS_TRUNCATED, ne oříznutý text jako platná odpověď", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: '{"responseText": "polovina odp' }],
          usage: { input_tokens: 10, output_tokens: 4096 },
          stop_reason: "max_tokens",
        }),
        { status: 200 },
      ),
    );

    await expect(callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test")).rejects.toMatchObject({
      code: "ANTHROPIC_MAX_TOKENS_TRUNCATED",
    });
  });

  it("stop_reason='end_turn' → beze změny chování, normální úspěšný návrat", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "ahoj" }],
          usage: { input_tokens: 12, output_tokens: 34 },
          stop_reason: "end_turn",
        }),
        { status: 200 },
      ),
    );

    const result = await callAnthropicModel("claude-sonnet-5", "s", "i", "sk-ant-test");
    expect(result).toEqual({ text: "ahoj", inputTokens: 12, outputTokens: 34 });
  });
});
