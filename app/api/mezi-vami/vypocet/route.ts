import { LlmAstroEstimator } from "@/app/mezi-vami/_calc/astro";
import { handleCalc } from "@/app/mezi-vami/_calc/handler";
import { AnthropicLlm } from "@/app/mezi-vami/_calc/llm";
import { PipelineError } from "@/app/mezi-vami/_calc/types";
import { failureDoc } from "@/app/mezi-vami/_calc/views";

// Prototyp CTE-08: výpočet Vztahové DNA (astro krok odhaduje LLM). Bez ukládání osobních údajů.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  let llm: AnthropicLlm;
  try {
    llm = new AnthropicLlm();
  } catch (e) {
    const code =
      e instanceof PipelineError && e.kind.type === "FAIL"
        ? e.kind.code
        : "PROVIDER_UNAVAILABLE";
    return new Response(
      JSON.stringify({ type: "error", code: "FAIL", view: failureDoc(code) }) +
        "\n",
      { status: 200, headers: { "content-type": "application/x-ndjson" } },
    );
  }
  return handleCalc(req, { llm, estimator: new LlmAstroEstimator(llm) });
}
