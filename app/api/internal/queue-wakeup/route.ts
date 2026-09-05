import { NextResponse } from "next/server";

import { H2ConfigError } from "@/h2/config";
import { loadEncryptionKeyRegistry } from "@/h2/crypto/keys";
import { getH2Pool } from "@/h2/db/pool";
import { loadDeliveryProviderConfig } from "@/h2/delivery/config";
import { H2_QUEUE_WAKE_SECRET_HEADER, verifyQueueWakeSecret } from "@/h2/internal/wake-auth";
import { logH2Event } from "@/h2/logging/logger";
import { loadPromptProviderConfig } from "@/h2/prompts/config";
import { computeQueueDeadline, processOwnerQueueBounded } from "@/h2/processing/process-owner-queue";
import type { ProcessQueueCredentials } from "@/h2/processing/process-owner-queue";

export const dynamic = "force-dynamic";

/**
 * Route `maxDuration` — BUILD-11 Rozhodnutí 8/Krok 4 "Vyžaduje živé
 * ověření před GO na merge". Vercelova AKTUÁLNÍ dokumentace (ověřeno
 * 2026-09-05, https://vercel.com/docs/functions/configuring-functions/duration)
 * uvádí pro Hobby plán s Fluid Compute (dnes "enabled by default" napříč
 * platformou) Default=Maximum=300s. Nešlo ověřit přes Vercel API/CLI
 * (`get_project`/`get_deployment`/`vercel project inspect` tenhle flag
 * nevrací), jestli je Fluid Compute skutečně zapnutý konkrétně pro
 * `muj-web` — explicitní export tady PINuje předpoklad, místo aby zůstal
 * implicitní/neověřený. Honzík: potvrď v Dashboardu (muj-web → Settings →
 * Functions → "Fluid Compute" toggle + "Function Max Duration") PŘED
 * mergem, viz BUILD-STATUS.md.
 */
export const maxDuration = 300;

async function recordSystemIncident(incidentType: string, detail: string, ownerId: string | null): Promise<void> {
  try {
    const pool = getH2Pool();
    await pool.query(
      `insert into incidents (owner_id, incident_type, severity, detail_code) values ($1, $2, 'CRITICAL', $3)`,
      [ownerId, incidentType, detail.slice(0, 200)],
    );
  } catch {
    // DB nedostupná i pro tenhle insert — endpoint stejně vrátí 5xx,
    // tohle je jen best-effort audit stopa navíc, ne primární signál.
  }
}

/**
 * BUILD-11 Rozhodnutí 8 — nezávislý control-plane wake endpoint
 * (cron-job.org, 30 min pevně, ROZHODNUTO Honzík 2026-09-04). Enumeruje
 * ownery přes `owners` (BEZ RLS, jen GRANT — ověřeno `verify-ingestion.ts`'s
 * komentářem), pak pro KAŽDÉHO ownera zavolá `processOwnerQueueBounded()`
 * — ta si teprve SPRÁVNĚ scoped nastaví `app.owner_id` přes
 * `withOwnerScope()` (Pravidlo 9 readback guard, `h2/db/with-owner-scope.ts`).
 * NIKDY select napříč `message_processing_jobs` přímo zde — ta tabulka má
 * FORCE RLS (migrace 0011) a bez scope by tiše vrátila nulu bez ohledu na
 * to, co ve frontě skutečně je (stejná třída bugu jako Pravidlo 9).
 *
 * Musí selhat HLASITĚ, ne prázdně: `204` smí znamenat jen "probudil jsem
 * frontu pro všechny ownery, žádný neměl co dělat", nikdy "nepodařilo se
 * mi ani zjistit, koho probudit". Selhání jednoho ownera zastaví celý
 * request (500 + incident) místo tichého přeskočení — dnes jeden owner
 * (single-owner systém), takže tohle nezpůsobí ztrátu pokrytí ostatních;
 * kdyby H2 v budoucnu podporoval víc ownerů, "pokračovat na dalším
 * ownerovi" by potřebovalo vlastní rozhodnutí (mimo scope Kroku 4).
 */
export async function POST(request: Request) {
  const startedAt = Date.now();

  const headerValue = request.headers.get(H2_QUEUE_WAKE_SECRET_HEADER);
  let authorized: boolean;
  try {
    authorized = verifyQueueWakeSecret(headerValue);
  } catch (error) {
    logH2Event({
      purpose: "job",
      status: "error",
      errorCode: error instanceof H2ConfigError ? "H2_CONFIG_INVALID" : "H2_WAKE_UNKNOWN_ERROR",
    });
    return new NextResponse(null, { status: 500 });
  }
  if (!authorized) {
    logH2Event({ purpose: "job", status: "error", errorCode: "H2_WAKE_UNAUTHORIZED" });
    return new NextResponse(null, { status: 401 });
  }

  const pool = getH2Pool();

  let ownerIds: string[];
  try {
    const ownersResult = await pool.query<{ id: string }>("select id from owners");
    ownerIds = ownersResult.rows.map((row) => row.id);
  } catch (error) {
    logH2Event({ purpose: "job", status: "error", errorCode: "H2_WAKE_OWNER_ENUMERATION_FAILED" });
    await recordSystemIncident("QUEUE_WAKE_ENUMERATION_FAILED", String(error), null);
    return new NextResponse(null, { status: 500 });
  }

  let registry;
  let credentials: ProcessQueueCredentials;
  try {
    registry = loadEncryptionKeyRegistry();
    credentials = { ...loadPromptProviderConfig(), ...loadDeliveryProviderConfig() };
  } catch (error) {
    logH2Event({
      purpose: "job",
      status: "error",
      errorCode: error instanceof H2ConfigError ? "H2_CONFIG_INVALID" : "H2_WAKE_UNKNOWN_ERROR",
    });
    return new NextResponse(null, { status: 500 });
  }

  const deadlineAt = computeQueueDeadline(startedAt, maxDuration);

  for (const ownerId of ownerIds) {
    try {
      const outcome = await processOwnerQueueBounded(pool, registry, credentials, ownerId, deadlineAt);
      logH2Event({ purpose: "job", status: "ok", ownerId, latencyMs: Date.now() - startedAt, attempt: outcome.jobsProcessed });
    } catch (error) {
      logH2Event({ purpose: "job", status: "error", ownerId, errorCode: "H2_WAKE_OWNER_PROCESSING_FAILED" });
      await recordSystemIncident("QUEUE_WAKE_OWNER_FAILED", String(error), ownerId);
      return new NextResponse(null, { status: 500 });
    }
  }

  return new NextResponse(null, { status: 204 });
}
