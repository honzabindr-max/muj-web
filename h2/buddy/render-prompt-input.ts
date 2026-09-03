import type { ResolvedContextItem } from "./resolve-manifest-content";

/**
 * Sestaví `input` (user message) pro `callAnthropicModel()` — vlastní
 * personalitu/instrukce/výstupní formát nese `promptContent` (autorovaný
 * `prompt_versions.content`, mimo scope Code, certifikace Honzíka).
 * Tady se jen deterministicky poskládá to, co se do jednoho volání
 * posílá jako data: aktuální zpráva + resolvovaný kontext v prioritním
 * pořadí (P0 first, ale P0/current message už je oddělený parametr).
 */
export function renderBuddyPromptInput(messageText: string, contextItems: readonly ResolvedContextItem[]): string {
  if (contextItems.length === 0) {
    return `AKTUÁLNÍ ZPRÁVA:\n${messageText}`;
  }

  const contextBlock = contextItems.map((item) => `- [${item.itemType}] ${item.contentText}`).join("\n");
  return `KONTEXT:\n${contextBlock}\n\nAKTUÁLNÍ ZPRÁVA:\n${messageText}`;
}
