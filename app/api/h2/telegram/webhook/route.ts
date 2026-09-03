import { NextResponse } from "next/server";

import { getH2Config, H2ConfigError } from "@/h2/config";
import { loadEncryptionKeyRegistry } from "@/h2/crypto/keys";
import { getH2Pool } from "@/h2/db/pool";
import { recordIdentityEvent } from "@/h2/identity/audit";
import { ingestMessage, type IngestPayloadType } from "@/h2/ingestion/ingest-message";
import {
  isAllowlistedTelegramSender,
  linkTelegramUserId,
  resolveEnrolledOwnerId,
  verifyTelegramWebhookSecret,
} from "@/h2/ingestion/telegram-auth";
import { logH2Event } from "@/h2/logging/logger";
import { encodeVoiceReferenceHandle } from "@/h2/voice/reference-handle";

export const dynamic = "force-dynamic";

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

    // ACK teprve po commitu ingestMessage() — AT-01.
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const errorCode = error instanceof H2ConfigError ? "H2_CONFIG_INVALID" : "H2_INGEST_UNKNOWN_ERROR";
    logH2Event({ purpose: "ingest", status: "error", errorCode });
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
