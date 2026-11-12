// Tenká vrstva nad Anthropic API: strukturovaný výstup (zod) + prompt caching + strop tokenů + cena.
// Klíč: process.env.H2_ANTHROPIC_API_KEY (Vercel Preview/Production), lokálně i ANTHROPIC_API_KEY.
// Do logů jdou jen tokeny, cena a časy. Nikdy prompt ani odpověď (obsahují údaje o narození).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { PipelineError, type Usage } from "./types";

export const DEFAULT_MODEL = "claude-haiku-5-5";
export const model = () => process.env.MEZI_VAMI_MODEL || DEFAULT_MODEL;

// $ / 1M tokenů, Claude Haiku 5.5 (do 100K promptu). Cache: zápis 1,25×, čtení 0,1×.
const PRICE_IN = 0.1;
const PRICE_OUT = 0.5;

export function costOf(u: {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}): number {
  return (
    (u.inputTokens * PRICE_IN +
      u.cacheWriteTokens * PRICE_IN * 1.25 +
      u.cacheReadTokens * PRICE_IN * 0.1 +
      u.outputTokens * PRICE_OUT) /
    1_000_000
  );
}

export type StructuredRequest<T> = {
  /** Jen pro log (bez osobních údajů). */
  name: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  /** Absolutní termín celého běhu (ms od epochy); volání se po něm přeruší. */
  deadline: number;
};

export interface StructuredLlm {
  call<T>(req: StructuredRequest<T>): Promise<{ data: T; usage: Usage }>;
}

/** Skutečný klient (Anthropic Messages API). */
export class AnthropicLlm implements StructuredLlm {
  private client: Anthropic;
  constructor(apiKey?: string) {
    const key =
      apiKey ??
      process.env.H2_ANTHROPIC_API_KEY ??
      process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new PipelineError(
        { type: "FAIL", code: "PROVIDER_UNAVAILABLE" },
        "chybí API klíč",
      );
    }
    this.client = new Anthropic({ apiKey: key, maxRetries: 1 });
  }

  async call<T>(req: StructuredRequest<T>): Promise<{ data: T; usage: Usage }> {
    const remaining = req.deadline - Date.now();
    if (remaining < 2_000) {
      throw new PipelineError({ type: "FAIL", code: "TIMEOUT" }, "timeout");
    }
    const t0 = Date.now();
    let res;
    try {
      res = await this.client.messages.parse(
        {
          model: model(),
          max_tokens: req.maxTokens,
          // Systémový prompt je stabilní → cache (u krátkých promptů se tiše nevyužije).
          system: [
            {
              type: "text",
              text: req.system,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: req.user }],
          output_config: {
            effort: "low",
            format: zodOutputFormat(req.schema),
          },
        },
        { timeout: remaining, signal: AbortSignal.timeout(remaining) },
      );
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      const status = (e as { status?: number })?.status;
      if (/Timeout|Abort/i.test(name) || /timed? ?out/i.test(String(e))) {
        throw new PipelineError({ type: "FAIL", code: "TIMEOUT" }, "timeout");
      }
      if (status === 429 || (status !== undefined && status >= 500)) {
        throw new PipelineError(
          { type: "FAIL", code: "PROVIDER_UNAVAILABLE" },
          `http ${status}`,
        );
      }
      throw new PipelineError(
        { type: "FAIL", code: "CALCULATION_FAILED" },
        `llm ${status ?? name}`,
      );
    }

    const u = res.usage;
    const usage: Usage = {
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      calls: 1,
      costUsd: 0,
    };
    usage.costUsd = costOf(usage);
    console.log(
      JSON.stringify({
        mv_llm: req.name,
        model: model(),
        ms: Date.now() - t0,
        in: usage.inputTokens,
        out: usage.outputTokens,
        cache_w: usage.cacheWriteTokens,
        cache_r: usage.cacheReadTokens,
        usd: Number(usage.costUsd.toFixed(6)),
        stop: res.stop_reason,
      }),
    );

    if (res.stop_reason === "max_tokens") {
      throw new PipelineError(
        { type: "FAIL", code: "CALCULATION_FAILED" },
        "max_tokens",
      );
    }
    const parsed = (res as { parsed_output?: T | null }).parsed_output;
    if (parsed == null) {
      throw new PipelineError(
        { type: "FAIL", code: "CALCULATION_FAILED" },
        "neplatný strukturovaný výstup",
      );
    }
    return { data: parsed, usage };
  }
}
