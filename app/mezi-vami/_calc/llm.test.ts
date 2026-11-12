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
const usage = {
  input_tokens: 100,
  output_tokens: 50,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};
const res = (text: string, stop_reason = "end_turn") => ({
  usage,
  stop_reason,
  content: [{ type: "text", text }],
});
const okRes = res('{"ok":true}');
const fake = (create: ReturnType<typeof vi.fn>) =>
  new AnthropicLlm(undefined, {
    messages: { create },
  } as unknown as Anthropic);

class AnthropicError extends Error {
  name = "AnthropicError"; // jako v SDK (obecná chyba bez HTTP statusu)
}
const apiError = (status: number) =>
  Object.assign(new Error(`http ${status}`), { status, name: "APIError" });
const quiet = () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
};

describe("AnthropicLlm: chyby modelu a opakování", () => {
  it("platný výstup: data + usage + cena", async () => {
    quiet();
    const r = await fake(vi.fn().mockResolvedValue(okRes)).call(req());
    expect(r.data).toEqual({ ok: true });
    expect(r.usage).toMatchObject({
      inputTokens: 100,
      outputTokens: 50,
      calls: 1,
    });
    vi.restoreAllMocks();
  });

  it("useknutý JSON: opakování a spotřeba obou pokusů se sečte", async () => {
    quiet();
    const create = vi
      .fn()
      .mockResolvedValueOnce(res('{"ok":tr')) // useknutý JSON, tokeny už spotřebovány
      .mockResolvedValueOnce(okRes);
    const r = await fake(create).call(req());
    expect(create).toHaveBeenCalledTimes(2);
    expect(r.data).toEqual({ ok: true });
    expect(r.usage.inputTokens).toBe(200);
    expect(r.usage.outputTokens).toBe(100);
    expect(r.usage.calls).toBe(2);
    expect(r.usage.costUsd).toBeCloseTo(
      2 *
        costOf({
          inputTokens: 100,
          outputTokens: 50,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
        }),
    );
    vi.restoreAllMocks();
  });

  it("JSON neodpovídá schématu: stejné opakování a součet spotřeby", async () => {
    quiet();
    const create = vi
      .fn()
      .mockResolvedValueOnce(res('{"ok":"ano"}'))
      .mockResolvedValueOnce(okRes);
    const r = await fake(create).call(req());
    expect(r.usage.calls).toBe(2);
    expect(r.usage.outputTokens).toBe(100);
    vi.restoreAllMocks();
  });

  it("trvalý neplatný JSON: PipelineError, 2 pokusy, chyba nese spotřebu obou", async () => {
    quiet();
    const create = vi.fn().mockResolvedValue(res("není json"));
    const err = await fake(create)
      .call(req())
      .catch((e) => e);
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.kind).toMatchObject({
      type: "FAIL",
      code: "CALCULATION_FAILED",
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(err.usage.inputTokens).toBe(200);
    expect(err.usage.calls).toBe(2);
    vi.restoreAllMocks();
  });

  it("obecná SDK chyba bez statusu: jedno opakování, pak CALCULATION_FAILED", async () => {
    quiet();
    const create = vi.fn().mockRejectedValue(new AnthropicError("boom"));
    await expect(fake(create).call(req())).rejects.toMatchObject({
      kind: { type: "FAIL", code: "CALCULATION_FAILED" },
    });
    expect(create).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it("5xx a 429 = PROVIDER_UNAVAILABLE bez dalšího opakování v aplikaci (retry s backoffem dělá SDK)", async () => {
    quiet();
    for (const s of [503, 429]) {
      const create = vi.fn().mockRejectedValue(apiError(s));
      await expect(fake(create).call(req())).rejects.toMatchObject({
        kind: { type: "FAIL", code: "PROVIDER_UNAVAILABLE" },
      });
      expect(create).toHaveBeenCalledTimes(1);
    }
    vi.restoreAllMocks();
  });

  it("timeout = TIMEOUT; max_tokens = CALCULATION_FAILED bez opakování, s usage", async () => {
    quiet();
    const t = Object.assign(new Error("Request timed out."), {
      name: "APIConnectionTimeoutError",
    });
    await expect(
      fake(vi.fn().mockRejectedValue(t)).call(req()),
    ).rejects.toMatchObject({ kind: { code: "TIMEOUT" } });
    const mt = vi.fn().mockResolvedValue(res('{"ok":', "max_tokens"));
    const err = await fake(mt)
      .call(req())
      .catch((e) => e);
    expect(err).toBeInstanceOf(PipelineError);
    expect(mt).toHaveBeenCalledTimes(1);
    expect(err.usage.outputTokens).toBe(50);
    vi.restoreAllMocks();
  });

  it("do logu jde jen diagnostika (název, status, krátká zpráva), nikdy prompt", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation(
      (...a: unknown[]) => void logs.push(a.join(" ")),
    );
    const create = vi.fn().mockRejectedValue(apiError(400));
    await fake(create)
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
