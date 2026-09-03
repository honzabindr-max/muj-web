import { H2AnthropicCallError } from "./errors";

/**
 * Anthropic Messages API adapter (BUILD-07 plán, Rozhodnutí 2/6) — syrový
 * `fetch`, žádná `@anthropic-ai/sdk` závislost (stejný styl jako BUILD-06
 * OpenAI adaptér). `AbortController` timeout na síťové volání.
 */
const CALL_TIMEOUT_MS = 60_000;
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";
const MAX_OUTPUT_TOKENS = 4096;

export type AnthropicCallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

type AnthropicMessagesResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export async function callAnthropicModel(
  modelId: string,
  promptContent: string,
  input: string,
  apiKey: string,
): Promise<AnthropicCallResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: promptContent,
        messages: [{ role: "user", content: input }],
      }),
      signal: controller.signal,
    });
  } catch {
    throw new H2AnthropicCallError("ANTHROPIC_TIMEOUT");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new H2AnthropicCallError("ANTHROPIC_RATE_LIMITED");
  }
  if (!response.ok) {
    throw new H2AnthropicCallError("ANTHROPIC_HTTP_ERROR");
  }

  const body = (await response.json()) as AnthropicMessagesResponse;
  const text = body.content?.find((block) => block.type === "text")?.text;
  if (typeof text !== "string" || !body.usage) {
    throw new H2AnthropicCallError("ANTHROPIC_HTTP_ERROR");
  }

  return {
    text,
    inputTokens: body.usage.input_tokens ?? 0,
    outputTokens: body.usage.output_tokens ?? 0,
  };
}
