// Vyměnitelná vrstva jazykových modelů pro MEZI VÁMI (server).
// Model se volí řetězcem „poskytovatel:model“ (např. "openai:gpt-5-codex",
// "anthropic:claude-haiku-5-5"). Nový poskytovatel = jeden adaptér v ADAPTERS.
// Bez SDK: čisté HTTP volání, ať nepřibývají závislosti.

export type JsonSchema = Record<string, unknown>;

export type StructuredRequest = {
  /** „poskytovatel:model“ */
  model: string;
  system: string;
  user: string;
  /** JSON Schema výstupu (striktní: vše required, additionalProperties false) */
  schema: JsonSchema;
  schemaName: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
};

export type Usage = { inputTokens: number; outputTokens: number };
export type StructuredResult = { data: unknown; usage: Usage; model: string };

type Adapter = (modelId: string, req: StructuredRequest) => Promise<StructuredResult>;

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function key(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new LlmError(`Chybí API klíč (${names.join(" / ")}).`);
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    // tělo chyby zkrátit; neobsahuje klíč
    throw new LlmError(`${url} → HTTP ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

/** OpenAI Responses API se strukturovaným výstupem (json_schema, strict). */
const openai: Adapter = async (modelId, req) => {
  const json = await post(
    `${process.env.MEZI_VAMI_OPENAI_BASE_URL || "https://api.openai.com"}/v1/responses`,
    { authorization: `Bearer ${key("MEZI_VAMI_OPENAI_API_KEY", "OPENAI_API_KEY")}` },
    {
      model: modelId,
      input: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      text: {
        format: { type: "json_schema", name: req.schemaName, schema: req.schema, strict: true },
      },
      max_output_tokens: req.maxOutputTokens ?? 16000,
    },
    req.timeoutMs ?? 240_000,
  );
  const output = (json.output as { type: string; content?: { type: string; text?: string }[] }[]) ?? [];
  const text = output
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("");
  if (!text) throw new LlmError(`OpenAI: prázdný výstup (status ${String(json.status)}).`);
  const u = (json.usage as { input_tokens?: number; output_tokens?: number }) ?? {};
  return {
    data: JSON.parse(text),
    usage: { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0 },
    model: String(json.model ?? modelId),
  };
};

/** Anthropic Messages API; strukturovaný výstup přes nástroj (vynucený, u modelů bez podpory „auto“). */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new LlmError("Anthropic: výstup neobsahuje JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

const anthropic: Adapter = async (modelId, req) => {
  const call = (forced: boolean) =>
    post(
      `${process.env.MEZI_VAMI_ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`,
      {
        "x-api-key": key("MEZI_VAMI_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY", "H2_ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      {
        model: modelId,
        max_tokens: req.maxOutputTokens ?? 8000,
        system: forced
          ? req.system
          : `${req.system}\n\nVýsledek vrať výhradně voláním nástroje „${req.schemaName}“.`,
        messages: [{ role: "user", content: req.user }],
        tools: [{ name: req.schemaName, description: "Vrať výsledek.", input_schema: req.schema }],
        tool_choice: forced ? { type: "tool", name: req.schemaName } : { type: "auto" },
      },
      req.timeoutMs ?? 240_000,
    );
  let json: Record<string, unknown>;
  try {
    json = await call(true);
  } catch (e) {
    // některé modely (s vždy zapnutým uvažováním) vynucený nástroj nepodporují
    if (e instanceof LlmError && e.status === 400 && /tool_choice/.test(e.message)) json = await call(false);
    else throw e;
  }
  const content = (json.content as { type: string; input?: unknown; text?: string }[]) ?? [];
  const tool = content.find((c) => c.type === "tool_use");
  const data =
    tool?.input ??
    extractJson(
      content
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join(""),
    );
  const u = (json.usage as { input_tokens?: number; output_tokens?: number }) ?? {};
  return {
    data,
    usage: { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0 },
    model: String(json.model ?? modelId),
  };
};

const ADAPTERS: Record<string, Adapter> = { openai, anthropic };

export function parseModelSpec(spec: string): { provider: string; model: string } {
  const i = spec.indexOf(":");
  if (i <= 0) throw new LlmError(`Neplatný model „${spec}“ (očekávám poskytovatel:model).`);
  const provider = spec.slice(0, i);
  if (!ADAPTERS[provider]) throw new LlmError(`Neznámý poskytovatel „${provider}“.`);
  return { provider, model: spec.slice(i + 1) };
}

export async function generateStructured(req: StructuredRequest): Promise<StructuredResult> {
  const { provider, model } = parseModelSpec(req.model);
  return ADAPTERS[provider](model, req);
}
