import { H2AnthropicCallError } from "./errors";

/**
 * Anthropic Messages API adapter (BUILD-07 plán, Rozhodnutí 2/6) — syrový
 * `fetch`, žádná `@anthropic-ai/sdk` závislost (stejný styl jako BUILD-06
 * OpenAI adaptér). `AbortController` timeout na síťové volání.
 */
const CALL_TIMEOUT_MS = 60_000;
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

export type AnthropicCallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * JSON Schema for `output_config.format` (Structured Outputs, GA) — passed
 * only for purposes that opt in (BUDDY_RESPONSE). Numeric/length constraints
 * (`minLength`, `minItems`, etc.) are not supported by the API and must
 * already be stripped from the schema by the caller; zod validation downstream
 * stays the enforcement point for those (AT-50 unchanged).
 */
export type AnthropicOutputSchema = Record<string, unknown>;

type AnthropicMessagesResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
};

export async function callAnthropicModel(
  modelId: string,
  promptContent: string,
  input: string,
  apiKey: string,
  maxOutputTokens: number = DEFAULT_MAX_OUTPUT_TOKENS,
  outputSchema?: AnthropicOutputSchema,
): Promise<AnthropicCallResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

  const requestBody: Record<string, unknown> = {
    model: modelId,
    max_tokens: maxOutputTokens,
    system: promptContent,
    messages: [{ role: "user", content: input }],
  };
  if (outputSchema) {
    requestBody.output_config = { format: { type: "json_schema", schema: outputSchema } };
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch {
    throw new H2AnthropicCallError("ANTHROPIC_TIMEOUT");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader !== null ? Number(retryAfterHeader) : undefined;
    throw new H2AnthropicCallError(
      "ANTHROPIC_RATE_LIMITED",
      retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    );
  }
  if (response.status === 400) {
    throw new H2AnthropicCallError("ANTHROPIC_BAD_REQUEST");
  }
  if (response.status === 401 || response.status === 403) {
    throw new H2AnthropicCallError("ANTHROPIC_AUTH_ERROR");
  }
  if (response.status === 500 || response.status === 529) {
    throw new H2AnthropicCallError("ANTHROPIC_SERVER_ERROR");
  }
  if (!response.ok) {
    throw new H2AnthropicCallError("ANTHROPIC_HTTP_ERROR");
  }

  const body = (await response.json()) as AnthropicMessagesResponse;

  // Refusal/truncation never gets to look like a valid response — both leave
  // `content`/`text` populated (partial or a refusal message), and letting
  // either fall through would misreport as INVALID_MODEL_OUTPUT (a schema
  // problem) instead of what actually happened.
  if (body.stop_reason === "refusal") {
    throw new H2AnthropicCallError("ANTHROPIC_REFUSAL");
  }
  if (body.stop_reason === "max_tokens") {
    throw new H2AnthropicCallError("ANTHROPIC_MAX_TOKENS_TRUNCATED");
  }

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
