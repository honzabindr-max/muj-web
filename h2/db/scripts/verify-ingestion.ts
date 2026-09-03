import { Client } from "pg";

/**
 * Standardní ad hoc produkční ověřovací nástroj pro ingest/processing stav
 * (BUILD-04+) pod skutečnou omezenou rolí h2_runtime — ne admin/owner, stejné
 * poučení jako BUILD-03A hotfix. Čte JEN counts/states/timestamps, nikdy
 * payload_ciphertext ani jeho obsah. Connection string ze .env.verify (přes
 * write-verify-env.sh, jednorázově zapsaný a natrvalo ponechaný, stejný
 * režim jako .env.local — 600, .gitignore).
 *
 * `raw_events`/`message_processing_jobs` mají FORCE RLS (§4.3, migrace 0011)
 * vyžadující `app.owner_id` v session — bez `set_config('app.owner_id', ...)`
 * vrací dotaz pod h2_runtime vždy 0 řádků bez ohledu na to, co v tabulce
 * skutečně je (stejná třída bugu jako chybějící `withOwnerScope()` u
 * BUILD-03A hotfixu, jen tentokrát v ověřovacím skriptu, ne v aplikaci).
 * `owners` RLS nemá (jen GRANT), takže single owner lze vyřešit bez scope.
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

    const owner = await client.query<{ id: string }>("select id from owners where google_sub is not null limit 1");
    const ownerId = owner.rows[0]?.id ?? null;

    await client.query("begin");
    if (ownerId) {
      await client.query("select set_config('app.owner_id', $1, true)", [ownerId]);
      // Loud fail-safe (ne jen spoléhat, že set_config proběhl): pokud se
      // scope reálně nenastavil, RLS níže TICHE vrátí 0 řádků na místo
      // chyby — přesně tenhle bug tenhle skript měl. Ověřovací nástroj,
      // který místo chyby vrátí nulu, je horší než žádný.
      const readback = await client.query<{ owner_id_setting: string | null }>(
        "select current_setting('app.owner_id', true) as owner_id_setting",
      );
      if (readback.rows[0]?.owner_id_setting !== ownerId) {
        throw new Error(
          `app.owner_id scope se nenastavil (očekáváno ${ownerId}, čteno ${readback.rows[0]?.owner_id_setting}) — ` +
            "dotazy na owner-scoped tabulky by dál běžely, ale RLS by je tiše vyprázdnila. STOP.",
        );
      }
    }

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

    // identity_audit_events povoluje owner_id IS NULL bez scope, ale řádky
    // S vyplněným owner_id (LOGIN_SUCCESS atd.) potřebují stejný set_config.
    const latestAuditEvents = await client.query<{ event_type: string; created_at: string; owner_id: string | null }>(
      `select event_type, created_at, owner_id
       from identity_audit_events
       order by created_at desc
       limit 20`,
    );

    await client.query("commit");

    console.log(
      JSON.stringify(
        {
          connectedAsExpected: currentUser === "h2_runtime",
          actualCurrentUser: currentUser,
          ownerResolved: ownerId !== null,
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
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
