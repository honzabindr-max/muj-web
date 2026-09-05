import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getH2Config, H2ConfigError } from "@/h2/config";
import { decryptPayload } from "@/h2/crypto/envelope";
import { loadEncryptionKeyRegistry } from "@/h2/crypto/keys";
import { getH2Pool } from "@/h2/db/pool";
import { withOwnerScope } from "@/h2/db/with-owner-scope";
import { H2AuthError } from "@/h2/identity/errors";
import { requireOwnerSession } from "@/h2/identity/session";
import { logH2Event } from "@/h2/logging/logger";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  after: z.coerce.bigint().nonnegative().optional(),
});

const PAGE_LIMIT = 50;

/**
 * Web polling route (BUILD-11 Rozhodnutí 6) — read-only projekce
 * `responses` pro přihlášeného ownera, cursor-based na
 * `source_input_sequence` (partial unique index `responses_owner_input_
 * sequence_buddy_unique`, BUILD-02, efektivní i pro range dotaz). Web
 * kanál nemá síťovou nejistotu ve stejném smyslu jako Telegram — tahle
 * routa NEVOLÁ `deliverResponse()` a nezapisuje `response_deliveries`;
 * to je samostatné rozhodnutí orchestrace (Krok 4), kdy/kdo dělá
 * "channel='web' → DELIVERED" bookkeeping. Tahle routa jen čte.
 */
export async function GET(request: Request) {
  const config = getH2Config();
  if (!config.featureFlags.webBuddyChat) {
    return NextResponse.json({ status: "disabled" }, { status: 404 });
  }

  try {
    const pool = getH2Pool();
    const session = await auth();
    const ownerSession = await requireOwnerSession(pool, session?.googleSub);

    const url = new URL(request.url);
    const queryResult = QuerySchema.safeParse({ after: url.searchParams.get("after") ?? undefined });
    if (!queryResult.success) {
      return NextResponse.json({ status: "error", errorCode: "H2_RESPONSES_INVALID_QUERY" }, { status: 400 });
    }
    const after = queryResult.data.after ?? BigInt(0);

    const registry = loadEncryptionKeyRegistry();

    const responses = await withOwnerScope(pool, ownerSession.ownerId, async (client) => {
      const result = await client.query<{
        id: string;
        source_input_sequence: string;
        payload_ciphertext: Buffer;
        encryption_key_version: number;
        stance: string | null;
        created_at: Date;
      }>(
        `select id, source_input_sequence, payload_ciphertext, encryption_key_version, stance, created_at
         from responses
         where owner_id = $1 and source_input_sequence > $2
         order by source_input_sequence asc
         limit $3`,
        [ownerSession.ownerId, after, PAGE_LIMIT],
      );
      return result.rows.map((row) => ({
        id: row.id,
        sourceInputSequence: row.source_input_sequence,
        text: decryptPayload(row.payload_ciphertext, row.encryption_key_version, registry).toString("utf8"),
        stance: row.stance,
        createdAt: row.created_at,
      }));
    });

    logH2Event({ purpose: "delivery", status: "ok", ownerId: ownerSession.ownerId });

    return NextResponse.json({ status: "ok", responses });
  } catch (error) {
    if (error instanceof H2AuthError) {
      return NextResponse.json({ status: "error", errorCode: error.code }, { status: 401 });
    }
    const errorCode = error instanceof H2ConfigError ? "H2_CONFIG_INVALID" : "H2_RESPONSES_UNKNOWN_ERROR";
    logH2Event({ purpose: "delivery", status: "error", errorCode });
    return NextResponse.json({ status: "error", errorCode }, { status: 500 });
  }
}
