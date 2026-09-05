/**
 * Telegram outbound `sendMessage` (BUILD-11 Rozhodnutí 6). Vrací
 * discriminovaný výsledek místo throwování typované chyby — `deliverResponse()`/
 * `sendQuarantineNotice()` potřebují jemné rozlišení network-timeout vs.
 * definitivní HTTP chyba, aby je mohly namapovat na přesně tři různé
 * `response_deliveries`/`system_notice_deliveries` stavy (AMBIGUOUS vs.
 * FAILED_RETRYABLE/DEAD_LETTER vs. DELIVERED) — throw+catch by tohle
 * rozlišení muselo znovu rekonstruovat z chyby.
 *
 * AT-10: network timeout/abort (fetch samo selže) → AMBIGUOUS. Non-ok HTTP
 * odpověď (Telegram REÁLNĚ odpověděl, jen odmítl request) → DEFINITIVE_ERROR,
 * NIKDY AMBIGUOUS — Telegram request prokazatelně přijal a zpracoval, žádná
 * síťová nejistota tam není.
 */
export const DELIVERY_CALL_TIMEOUT_MS = 15_000;
const TELEGRAM_API_BASE = "https://api.telegram.org";

export type TelegramSendResult =
  | { kind: "SUCCESS"; externalMessageId: string }
  | { kind: "DEFINITIVE_ERROR"; description: string }
  | { kind: "AMBIGUOUS" };

export type SendTelegramMessageFn = (chatId: string, text: string, botToken: string) => Promise<TelegramSendResult>;

type TelegramSendMessageResponse = { ok: boolean; result?: { message_id?: number }; description?: string };

export const sendTelegramMessage: SendTelegramMessageFn = async (chatId, text, botToken) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_CALL_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal,
    });
  } catch {
    return { kind: "AMBIGUOUS" };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let description = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as TelegramSendMessageResponse;
      if (body.description) description = body.description;
    } catch {
      // Nešlo naparsovat tělo — description zůstává statusem, pořád DEFINITIVE_ERROR.
    }
    return { kind: "DEFINITIVE_ERROR", description };
  }

  const body = (await response.json()) as TelegramSendMessageResponse;
  if (!body.ok || body.result?.message_id === undefined) {
    return { kind: "DEFINITIVE_ERROR", description: "malformed 200 response (missing result.message_id)" };
  }
  return { kind: "SUCCESS", externalMessageId: String(body.result.message_id) };
};
