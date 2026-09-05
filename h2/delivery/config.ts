import { z } from "zod";

import { requireEnv } from "@/h2/config/schema";

/**
 * Fail-closed credentials pro Telegram outbound delivery (BUILD-11
 * Rozhodnutí 6). Stejný lazy `requireEnv()` vzor jako `h2/voice/config.ts`
 * a `h2/prompts/config.ts` — validace až při skutečném použití, ne při
 * importu/buildu. Sdílí `H2_TELEGRAM_BOT_TOKEN` s `h2/voice/config.ts`
 * (stejný bot, jiný účel — download vs. send), proto vlastní malý typ
 * místo přidávání pole do `VoiceProviderConfig`.
 */
export type DeliveryProviderConfig = {
  telegramBotToken: string;
};

export function loadDeliveryProviderConfig(source: Record<string, string | undefined> = process.env): DeliveryProviderConfig {
  const { H2_TELEGRAM_BOT_TOKEN } = requireEnv({ H2_TELEGRAM_BOT_TOKEN: z.string().min(1) }, source);
  return { telegramBotToken: H2_TELEGRAM_BOT_TOKEN };
}
