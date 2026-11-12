import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AnthropicLlm, costOf } from "./llm";
import { PipelineError } from "./types";

const schema = z.object({ ok: z.boolean() });
const req = () => ({
  name: "t",
  system: "s",
  user: "u",
  schema,
  maxTokens: 100,
  deadline: Date.now() + 60_000,
});
const okRes = {
  usage: {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  },
  stop_reason: "end_turn",
  parsed_output: { ok: true },
};
const fake = (parse: ReturnType<typeof vi.fn>) =>
  new AnthropicLlm(undefined, { messages: { parse } } as unknown as Anthropic);

class AnthropicError extends Error {
  name = "AnthropicError"; // jako v SDK (obecná chyba bez HTTP statusu)
}
const apiError = (status: number) =>
  Object.assign(new Error(`http ${status}`), { status, name: "APIError" });

describe("AnthropicLlm: chyby modelu a opakování", () => {
  it("přechodná chyba strukturovaného výstupu: jedno opakování a pak výsledek", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const parse = vi
      .fn()
      .mockRejectedValueOnce(new AnthropicError("Failed to parse"))
      .mockResolvedValueOnce(okRes);
    const r = await fake(parse).call(req());
    expect(parse).toHaveBeenCalledTimes(2);
    expect(r.data).toEqual({ ok: true });
    vi.restoreAllMocks();
  });

  it("trvalá chyba: PipelineError CALCULATION_FAILED, nejvýš 2 pokusy, bez pádu", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const parse = vi.fn().mockRejectedValue(new AnthropicError("boom"));
    await expect(fake(parse).call(req())).rejects.toMatchObject({
      kind: { type: "FAIL", code: "CALCULATION_FAILED" },
    });
    expect(parse).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it("5xx a 429 = PROVIDER_UNAVAILABLE bez dalšího opakování v aplikaci (retry s backoffem dělá SDK)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const s of [503, 429]) {
      const parse = vi.fn().mockRejectedValue(apiError(s));
      await expect(fake(parse).call(req())).rejects.toMatchObject({
        kind: { type: "FAIL", code: "PROVIDER_UNAVAILABLE" },
      });
      expect(parse).toHaveBeenCalledTimes(1);
    }
    vi.restoreAllMocks();
  });

  it("timeout = TIMEOUT; max_tokens = CALCULATION_FAILED", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const t = Object.assign(new Error("Request timed out."), {
      name: "APIConnectionTimeoutError",
    });
    await expect(
      fake(vi.fn().mockRejectedValue(t)).call(req()),
    ).rejects.toMatchObject({ kind: { code: "TIMEOUT" } });
    const mt = vi.fn().mockResolvedValue({
      ...okRes,
      stop_reason: "max_tokens",
      parsed_output: null,
    });
    await expect(fake(mt).call(req())).rejects.toBeInstanceOf(PipelineError);
    vi.restoreAllMocks();
  });

  it("do logu jde jen diagnostika (název, status, krátká zpráva), nikdy prompt", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation(
      (...a: unknown[]) => void logs.push(a.join(" ")),
    );
    const parse = vi.fn().mockRejectedValue(apiError(400));
    await fake(parse)
      .call({ ...req(), user: "TAJNE-DATUM-1990" })
      .catch(() => {});
    expect(logs.join("\n")).not.toContain("TAJNE-DATUM-1990");
    vi.restoreAllMocks();
  });
});

describe("cena", () => {
  it("Haiku 5.5: 0,10 / 0,50 USD za MTok, cache zápis 1,25×, čtení 0,1×", () => {
    expect(
      costOf({
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      }),
    ).toBeCloseTo(0.1);
    expect(
      costOf({
        inputTokens: 0,
        outputTokens: 1_000_000,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      }),
    ).toBeCloseTo(0.5);
    expect(
      costOf({
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
      }),
    ).toBeCloseTo(0.125 + 0.01);
  });
});
