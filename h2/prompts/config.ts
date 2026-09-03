import { z } from "zod";

import { requireEnv } from "@/h2/config/schema";

/**
 * Fail-closed Anthropic credential (BUILD-07 plán, Rozhodnutí 2) — stejný
 * lazy `requireEnv()` vzor jako `h2/voice/config.ts`. Validace až při
 * skutečném použití (ruční certifikace promptu, později BUILD-10
 * trigger), ne při importu/buildu. Automatické testy tohle nevolají
 * (mockovaný `fetch`, Rozhodnutí 6).
 */
export type PromptProviderConfig = {
  anthropicApiKey: string;
};

export function loadPromptProviderConfig(source: Record<string, string | undefined> = process.env): PromptProviderConfig {
  const { H2_ANTHROPIC_API_KEY } = requireEnv({ H2_ANTHROPIC_API_KEY: z.string().min(1) }, source);
  return { anthropicApiKey: H2_ANTHROPIC_API_KEY };
}
