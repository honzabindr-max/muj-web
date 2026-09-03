import { Client } from "pg";

/**
 * Standardní ad hoc produkční ověřovací nástroj pro ingest/processing stav
 * (BUILD-04+) pod skutečnou omezenou rolí h2_runtime — ne admin/owner, stejné
 * poučení jako BUILD-03A hotfix. Čte JEN counts/states/timestamps, nikdy
 * payload_ciphertext ani jeho obsah. Connection string ze .env.verify (přes
 * write-verify-env.sh, jednorázově zapsaný a natrvalo ponechaný, stejný
 * režim jako .env.local — 600, .gitignore).
 *
 * Použití: npx tsx h2/db/scripts/verify-ingestion.ts
 */
async function main() {
  try {
    process.loadEnvFile(".env.verify");
  } catch {
    throw new Error(".env.verify neexistuje. Spusť nejdřív: bash h2/db/scripts/write-verify-env.sh");
  }

  const connectionString = process.env.H2_RUNTIME_DATABASE_URL;
  if (!connectionString) {
    throw new Error(".env.verify neobsahuje H2_RUNTIME_DATABASE_URL.");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const identity = await client.query<{ current_user: string }>("select current_user");
    const currentUser = identity.rows[0].current_user;

    const rawEventsByChannelSpeaker = await client.query<{ channel: string; speaker: string; n: string }>(
      `select channel, speaker, count(*)::text as n
       from raw_events
       group by channel, speaker
       order by channel, speaker`,
    );

    const latestRawEvents = await client.query<{
      channel: string;
      speaker: string;
      created_at: string;
      external_event_id: string | null;
    }>(
      `select channel, speaker, created_at, external_event_id
       from raw_events
       order by created_at desc
       limit 20`,
    );

    const jobsByStatus = await client.query<{ status: string; n: string }>(
      `select status, count(*)::text as n from message_processing_jobs group by status order by status`,
    );

    const latestAuditEvents = await client.query<{ event_type: string; created_at: string; owner_id: string | null }>(
      `select event_type, created_at, owner_id
       from identity_audit_events
       order by created_at desc
       limit 20`,
    );

    console.log(
      JSON.stringify(
        {
          connectedAsExpected: currentUser === "h2_runtime",
          actualCurrentUser: currentUser,
          rawEventsByChannelSpeaker: Object.fromEntries(
            rawEventsByChannelSpeaker.rows.map((r) => [`${r.channel}/${r.speaker}`, Number(r.n)]),
          ),
          latestRawEvents: latestRawEvents.rows,
          messageProcessingJobsByStatus: Object.fromEntries(jobsByStatus.rows.map((r) => [r.status, Number(r.n)])),
          latestIdentityAuditEvents: latestAuditEvents.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
