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

/** inputTokens = nekešované vstupní tokeny; cache* jen u poskytovatelů, kteří je hlásí. */
export type Usage = { inputTokens: number; outputTokens: number; cacheWriteTokens?: number; cacheReadTokens?: number };
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
  // OpenAI kešuje stálý začátek promptu automaticky (od ~1024 tokenů); jen čteme, kolik se trefilo.
  const u =
    (json.usage as { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } }) ?? {};
  const cached = u.input_tokens_details?.cached_tokens ?? 0;
  return {
    data: JSON.parse(text),
    usage: { inputTokens: (u.input_tokens ?? 0) - cached, outputTokens: u.output_tokens ?? 0, cacheReadTokens: cached },
    model: String(json.model ?? modelId),
  };
};

/* Prompt caching (Anthropic): stálé části požadavku (nástroje + systémový prompt) se kešují
   bodem zlomu na systémovém bloku; proměnná data jsou až v uživatelské zprávě. Opakovaný pokus
   i další zákazník v okně TTL pak platí za tuto část jen zlomek. Vypnutí: MEZI_VAMI_PROMPT_CACHE=off,
   delší okno: MEZI_VAMI_PROMPT_CACHE_TTL=1h. */
function cachedSystem(text: string): string | { type: "text"; text: string; cache_control: Record<string, string> }[] {
  if (process.env.MEZI_VAMI_PROMPT_CACHE === "off") return text;
  const cache_control: Record<string, string> = { type: "ephemeral" };
  if (process.env.MEZI_VAMI_PROMPT_CACHE_TTL === "1h") cache_control.ttl = "1h";
  return [{ type: "text", text, cache_control }];
}

function anthropicUsage(json: Record<string, unknown>): Usage {
  const u =
    (json.usage as {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    }) ?? {};
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
  };
}

/** Anthropic Messages API; strukturovaný výstup přes nástroj (vynucený, u modelů bez podpory „auto“). */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new LlmError("Anthropic: výstup neobsahuje JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

const anthropic: Adapter = async (modelId, req) => {
  // Uvažování co nejmenší (rychlost, tokeny na výstup), podle toho, co model přijme:
  // vypnout (Haiku 5.5, Opus 5.5) → bez úvodního přemýšlení „between_tools“ (Sonnet 5.5)
  // → minimální rozpočet (starší modely) → výchozí. Vynucený nástroj jen bez přemýšlení;
  // modely, které ho nepodporují (Sonnet 5.5), dostanou „auto“ + pokyn v systémovém promptu.
  const THINKING = [{ type: "disabled" }, { type: "between_tools" }, { type: "enabled", budget_tokens: 1024 }, null];
  let ti = 0;
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
        system: cachedSystem(
          forced ? req.system : `${req.system}\n\nVýsledek vrať výhradně voláním nástroje „${req.schemaName}“.`,
        ),
        messages: [{ role: "user", content: req.user }],
        tools: [{ name: req.schemaName, description: "Vrať výsledek.", input_schema: req.schema }],
        tool_choice: forced ? { type: "tool", name: req.schemaName } : { type: "auto" },
        ...(THINKING[ti] ? { thinking: THINKING[ti] } : {}),
      },
      req.timeoutMs ?? 240_000,
    );
  let json: Record<string, unknown> | null = null;
  let forced = true;
  for (let i = 0; i < 8 && !json; i++) {
    try {
      json = await call(forced && ti < 2);
    } catch (e) {
      if (!(e instanceof LlmError) || e.status !== 400) throw e;
      console.info(`[llm] ${modelId} 400 (thinking=${JSON.stringify(THINKING[ti])}, forced=${forced}): ${e.message.slice(-220)}`);
      // nejdřív vzdát vynucení nástroje, teprve potom ustupovat v nastavení přemýšlení
      if (forced && ti < 2 && /tool_choice|forced tool|tool use/i.test(e.message)) forced = false;
      else if (ti < THINKING.length - 1 && /thinking|budget|between_tools|effort/i.test(e.message)) ti++;
      else throw e;
    }
  }
  console.info(
    `[llm] ${modelId}: thinking=${JSON.stringify(THINKING[ti])} forced=${forced && ti < 2} stop=${String(json?.stop_reason)}`,
  );
  if (!json) throw new LlmError(`Anthropic ${modelId}: požadavek se nepodařilo sestavit.`);
  const content = (json.content as { type: string; input?: unknown; text?: string }[]) ?? [];
  const tool = content.find((c) => c.type === "tool_use");
  let data: unknown = tool?.input;
  if (data === undefined) {
    try {
      data = extractJson(
        content
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join(""),
      );
    } catch {
      throw new LlmError(
        `Anthropic ${modelId}: bez strukturovaného výstupu (stop_reason=${String(json.stop_reason)}, bloky=${content.map((c) => c.type).join(",")})`,
      );
    }
  }
  return {
    data,
    usage: anthropicUsage(json),
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

/* ---------- Anthropic + spouštění kódu (server tool) ---------- */

// Verze nástroje se mění; zkouší se od nejnovější, model si ji vybere podle chybové hlášky API.
const CODE_TOOLS = [
  { tool: { type: "code_execution_20250825", name: "code_execution" }, beta: "code-execution-2025-08-25" },
  { tool: { type: "code_execution_20250522", name: "code_execution" }, beta: "code-execution-2025-05-22" },
];

/** Model napíše a spustí Python, výsledek vrátí jako JSON v závěrečném textu. Jen Anthropic. */
export async function generateJsonWithCode(req: Omit<StructuredRequest, "schema" | "schemaName">): Promise<StructuredResult> {
  const { provider, model } = parseModelSpec(req.model);
  if (provider !== "anthropic") throw new LlmError("Spouštění kódu je zapojené jen pro Anthropic.");
  const THINKING = [{ type: "disabled" }, { type: "enabled", budget_tokens: 1024 }, null];
  let ti = 0;
  let ci = 0;
  let lastErr: unknown;
  for (let i = 0; i < 6; i++) {
    const ct = CODE_TOOLS[ci];
    try {
      const json = await post(
        `${process.env.MEZI_VAMI_ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`,
        {
          "x-api-key": key("MEZI_VAMI_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY", "H2_ANTHROPIC_API_KEY"),
          "anthropic-version": "2023-06-01",
          "anthropic-beta": ct.beta,
        },
        {
          model,
          max_tokens: req.maxOutputTokens ?? 16000,
          system: cachedSystem(req.system),
          messages: [{ role: "user", content: req.user }],
          tools: [ct.tool],
          ...(THINKING[ti] ? { thinking: THINKING[ti] } : {}),
        },
        req.timeoutMs ?? 240_000,
      );
      const content = (json.content as { type: string; text?: string }[]) ?? [];
      const texts = content.filter((c) => c.type === "text").map((c) => c.text ?? "");
      const last = texts[texts.length - 1] ?? "";
      console.info(`[llm] ${model}+code(${ct.tool.type}) thinking=${JSON.stringify(THINKING[ti])} stop=${String(json.stop_reason)} bloky=${content.map((c) => c.type).join(",")}`);
      return {
        data: extractJson(last),
        usage: anthropicUsage(json),
        model: `${String(json.model ?? model)}+code`,
      };
    } catch (e) {
      lastErr = e;
      if (!(e instanceof LlmError) || e.status !== 400) throw e;
      if (ti < THINKING.length - 1 && /thinking|budget/i.test(e.message)) ti++;
      else if (ci < CODE_TOOLS.length - 1 && /code_execution|beta|tool/i.test(e.message)) ci++;
      else throw e;
    }
  }
  throw lastErr;
}
