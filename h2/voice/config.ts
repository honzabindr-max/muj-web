import { z } from "zod";

import { requireEnv } from "@/h2/config/schema";

/**
 * Fail-closed credentials pro voice download/transkripci (BUILD-06 plán,
 * "Credentials / env proměnné"). Stejný lazy `requireEnv()` vzor jako
 * `h2/crypto/keys.ts` — validace až při skutečném použití (ruční
 * ověřovací skript, později BUILD-10 trigger), ne při importu/buildu.
 * Nic v automatických testech tohle nevolá (mockovaný `fetch`, žádné
 * reálné credentials potřeba).
 */
export type VoiceProviderConfig = {
  telegramBotToken: string;
  openaiApiKey: string;
};

export function loadVoiceProviderConfig(source: Record<string, string | undefined> = process.env): VoiceProviderConfig {
  const { H2_TELEGRAM_BOT_TOKEN, H2_OPENAI_API_KEY } = requireEnv(
    { H2_TELEGRAM_BOT_TOKEN: z.string().min(1), H2_OPENAI_API_KEY: z.string().min(1) },
    source,
  );
  return { telegramBotToken: H2_TELEGRAM_BOT_TOKEN, openaiApiKey: H2_OPENAI_API_KEY };
}
