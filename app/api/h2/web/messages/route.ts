import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getH2Config, H2ConfigError } from "@/h2/config";
import { loadEncryptionKeyRegistry } from "@/h2/crypto/keys";
import { getH2Pool } from "@/h2/db/pool";
import { H2AuthError, H2CsrfError } from "@/h2/identity/errors";
import { requireOwnerSession } from "@/h2/identity/session";
import { assertSameOrigin } from "@/h2/identity/csrf";
import { ingestMessage } from "@/h2/ingestion/ingest-message";
import { resolveWebIngestAllowedOrigins } from "@/h2/ingestion/web-origin";
import { logH2Event } from "@/h2/logging/logger";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  text: z.string().min(1).max(8000),
  clientMessageId: z.string().uuid(),
});

/**
 * Web ingest endpoint (Technical Architecture v1.2 §3, §4.1). Volá stejnou
 * ingestMessage() jako Telegram webhook — AT-48. Auth přes requireOwnerSession()
 * + assertSameOrigin(), stejný write-endpoint kontrakt jako BUILD-03A
 * ("destructive/admin capabilities nesmějí implementovat vlastní alternativní
 * auth cestu" — ingest není destruktivní, ale identity boundary je stejná).
 */
export async function POST(request: Request) {
  const config = getH2Config();
  if (!config.featureFlags.webBuddyChat) {
    return NextResponse.json({ status: "disabled" }, { status: 404 });
  }

  try {
    assertSameOrigin(request, resolveWebIngestAllowedOrigins(config.environment));

    const pool = getH2Pool();
    const session = await auth();
    const ownerSession = await requireOwnerSession(pool, session?.googleSub);

    const bodyResult = BodySchema.safeParse(await request.json().catch(() => null));
    if (!bodyResult.success) {
      return NextResponse.json({ status: "error", errorCode: "H2_INGEST_INVALID_BODY" }, { status: 400 });
    }
    const { text, clientMessageId } = bodyResult.data;

    const registry = loadEncryptionKeyRegistry();
    const result = await ingestMessage(pool, registry, {
      ownerId: ownerSession.ownerId,
      channel: "web",
      speaker: "USER",
      externalEventId: clientMessageId,
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from(text, "utf8"),
    });

    logH2Event({
      purpose: "ingest",
      status: "ok",
      ownerId: ownerSession.ownerId,
      rawEventId: result.rawEventId,
      ...(!result.duplicate && result.jobId ? { jobId: result.jobId } : {}),
    });

    return NextResponse.json(
      { status: "ok", rawEventId: result.rawEventId, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof H2CsrfError) {
      return NextResponse.json({ status: "error", errorCode: "CSRF_REJECTED" }, { status: 403 });
    }
    if (error instanceof H2AuthError) {
      return NextResponse.json({ status: "error", errorCode: error.code }, { status: 401 });
    }
    const errorCode = error instanceof H2ConfigError ? "H2_CONFIG_INVALID" : "H2_INGEST_UNKNOWN_ERROR";
    logH2Event({ purpose: "ingest", status: "error", errorCode });
    return NextResponse.json({ status: "error", errorCode }, { status: 500 });
  }
}
