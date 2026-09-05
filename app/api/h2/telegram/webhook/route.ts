import { after, NextResponse } from "next/server";

import { getH2Config, H2ConfigError } from "@/h2/config";
import { loadEncryptionKeyRegistry } from "@/h2/crypto/keys";
import { getH2Pool } from "@/h2/db/pool";
import { loadDeliveryProviderConfig } from "@/h2/delivery/config";
import { recordIdentityEvent } from "@/h2/identity/audit";
import { ingestMessage, type IngestPayloadType } from "@/h2/ingestion/ingest-message";
import {
  isAllowlistedTelegramSender,
  linkTelegramUserId,
  resolveEnrolledOwnerId,
  verifyTelegramWebhookSecret,
} from "@/h2/ingestion/telegram-auth";
import { logH2Event } from "@/h2/logging/logger";
import { loadPromptProviderConfig } from "@/h2/prompts/config";
import { computeQueueDeadline, processOwnerQueueBounded } from "@/h2/processing/process-owner-queue";
import { encodeVoiceReferenceHandle } from "@/h2/voice/reference-handle";

export const dynamic = "force-dynamic";

/**
 * BUILD-11 Rozhodnutí 1/Krok 4 — `after()` dědí tenhle `maxDuration`
 * (`processOwnerQueueBounded()`'s `deadlineAt` je odvozený odsud, ne z
 * neověřeného platformového defaultu). Viz `app/api/internal/queue-wakeup/
 * route.ts` pro plné zdůvodnění hodnoty 300 (Vercel dokumentace, Hobby +
 * Fluid Compute, ověřeno 2026-09-05 — Fluid Compute status konkrétně pro
 * tenhle projekt NEOVĚŘEN přes API, potvrdit v Dashboardu před mergem).
 */
export const maxDuration = 300;

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    voice?: { file_id: string; duration: number };
    from?: { id: number };
  };
};

/**
 * Telegram webhook (Technical Architecture v1.2 §3, §4.1, §31.1).
 *
 * Failure model (§27): "Webhook crash před DB commit → bez ACK; kanál může
 * event zopakovat." "Wh[ook non-200] → Telegram opakuje doručení
 * donekonečna." Proto cizí/nepodporovaný update vrací 200 (validní provoz,
 * jen zahozený), zatímco chybějící/neplatný webhook secret vrací 401 —
 * takový request není prokazatelně od Telegramu, žádný retry loop nehrozí.
 */
export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const config = getH2Config();
  if (!config.featureFlags.telegramIngest) {
    return NextResponse.json({ status: "disabled" }, { status: 404 });
  }

  try {
    const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
    if (!verifyTelegramWebhookSecret(secretHeader)) {
      logH2Event({ purpose: "ingest", status: "error", errorCode: "TELEGRAM_SECRET_MISMATCH" });
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = await request.json();
    } catch {
      return NextResponse.json({ status: "error" }, { status: 400 });
    }

    const message = update.message;
    const text = message?.text;
    const voice = message?.voice;
    const fromId = message?.from?.id;

    if (!message || fromId === undefined) {
      logH2Event({ purpose: "ingest", status: "skipped" });
      return NextResponse.json({ status: "ignored" });
    }

    let payloadType: IngestPayloadType;
    let payloadPlaintext: Buffer;
    if (text !== undefined) {
      payloadType = "TEXT";
      payloadPlaintext = Buffer.from(text, "utf8");
    } else if (config.featureFlags.telegramVoice && voice?.file_id !== undefined && typeof voice.duration === "number") {
      // Voice flow krok 1 (Technical Architecture v1.2 §5): reference handle,
      // ne audio — stažení/transkripce jsou BUILD-06 processing, ne ingest.
      payloadType = "VOICE";
      payloadPlaintext = encodeVoiceReferenceHandle({ telegramFileId: voice.file_id, durationSeconds: voice.duration });
    } else {
      // Nepodporovaný typ update (photo/…), nebo voice s vypnutým feature
      // flagem. Validní Telegram provoz, jen no-op.
      logH2Event({ purpose: "ingest", status: "skipped" });
      return NextResponse.json({ status: "ignored" });
    }

    const pool = getH2Pool();

    if (!isAllowlistedTelegramSender(fromId)) {
      await recordIdentityEvent(pool, null, "TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER");
      logH2Event({ purpose: "ingest", status: "error", errorCode: "TELEGRAM_UNKNOWN_SENDER" });
      return NextResponse.json({ status: "ignored" });
    }

    const ownerId = await resolveEnrolledOwnerId(pool);
    if (!ownerId) {
      logH2Event({ purpose: "ingest", status: "error", errorCode: "NO_ENROLLED_OWNER" });
      return NextResponse.json({ status: "ignored" });
    }

    await linkTelegramUserId(pool, ownerId, fromId);

    const registry = loadEncryptionKeyRegistry();
    const result = await ingestMessage(pool, registry, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId: String(update.update_id),
      payloadType,
      payloadPlaintext,
    });

    logH2Event({
      purpose: "ingest",
      status: "ok",
      ownerId,
      rawEventId: result.rawEventId,
      ...(!result.duplicate && result.jobId ? { jobId: result.jobId } : {}),
    });

    // BUILD-11 Rozhodnutí 1 — after() fast path, hned po ACK, ohraničený
    // rozpočtem času (processOwnerQueueBounded() samo zkontroluje zbývající
    // budget PŘED každým claimNextJob()). Optimalizace latence, NIKDY
    // liveness mechanismus — pokud tahle invokace timeoutne uprostřed,
    // wake endpoint (Rozhodnutí 8) frontu i tak časem probudí. Přeskočeno
    // pro duplicitní Telegram redelivery (result.duplicate) — fronta se
    // tím nezmění, spouštět smyčku znovu je zbytečné.
    //
    // Vnější try/catch kolem samotného after() volání (ne jen kolem jeho
    // callbacku): after() vyžaduje Next.js request-scoped async context —
    // mimo něj (testy volající route handler přímo, budoucí edge případ)
    // by throwlo synchronně a strhlo by celý ACK na 500. ACK nesmí nikdy
    // záviset na tom, jestli se podařilo naplánovat optimalizaci latence.
    if (!result.duplicate) {
      try {
        after(async () => {
          try {
            const credentials = { ...loadPromptProviderConfig(), ...loadDeliveryProviderConfig() };
            const deadlineAt = computeQueueDeadline(requestStartedAt, maxDuration);
            await processOwnerQueueBounded(pool, registry, credentials, ownerId, deadlineAt);
          } catch {
            logH2Event({ purpose: "job", status: "error", ownerId, errorCode: "H2_AFTER_QUEUE_PROCESSING_FAILED" });
          }
        });
      } catch {
        logH2Event({ purpose: "job", status: "error", ownerId, errorCode: "H2_AFTER_SCHEDULE_FAILED" });
      }
    }

    // ACK teprve po commitu ingestMessage() — AT-01.
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const errorCode = error instanceof H2ConfigError ? "H2_CONFIG_INVALID" : "H2_INGEST_UNKNOWN_ERROR";
    logH2Event({ purpose: "ingest", status: "error", errorCode });
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
