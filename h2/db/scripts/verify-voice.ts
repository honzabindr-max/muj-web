import { Client } from "pg";

/**
 * Read-only ověření stavu hlasovek v produkci (audit 2026-10-07): běžel
 * někdy přepis? Pod rolí h2_runtime, `begin read only`, jen counts / stavy /
 * časy — nikdy payload_ciphertext ani obsah zpráv. Stejný režim připojení
 * a stejný povinný readback `app.owner_id` (Pravidlo 9) jako
 * `verify-ingestion.ts`. Connection string ze .env.verify.
 *
 * Použití: npx tsx h2/db/scripts/verify-voice.ts
 */
const TRANSCRIPTION_PURPOSE = "voice_transcription";

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
    const ownerId = owner.rows[0]?.id;
    if (!ownerId) {
      throw new Error("Owner se nevyřešil — dotazy na owner-scoped tabulky by tiše vrátily nuly. STOP.");
    }

    await client.query("begin read only");
    await client.query("select set_config('app.owner_id', $1, true)", [ownerId]);
    const readback = await client.query<{ owner_id_setting: string | null }>(
      "select current_setting('app.owner_id', true) as owner_id_setting",
    );
    if (readback.rows[0]?.owner_id_setting !== ownerId) {
      throw new Error(
        `app.owner_id scope se nenastavil (očekáváno ${ownerId}, čteno ${readback.rows[0]?.owner_id_setting}) — STOP.`,
      );
    }

    // Sanity: kolik řádků vůbec RLS pustí (tichá nula je horší než chyba).
    const totalRawEvents = await client.query<{ n: string }>("select count(*)::text as n from raw_events");

    const voiceByJobStatus = await client.query<{
      job_status: string;
      n: string;
      with_response: string;
      first_at: string;
      last_at: string;
    }>(
      `select mpj.status as job_status,
              count(*)::text as n,
              count(r.id)::text as with_response,
              min(re.created_at)::text as first_at,
              max(re.created_at)::text as last_at
       from raw_events re
       left join message_processing_jobs mpj on mpj.raw_event_id = re.id
       left join responses r on r.source_raw_event_id = re.id
       where re.payload_type = 'VOICE'
       group by mpj.status
       order by mpj.status`,
    );

    const voiceTotals = await client.query<{
      n: string;
      with_response: string;
      without_job: string;
      first_at: string | null;
      last_at: string | null;
    }>(
      `select count(*)::text as n,
              count(r.id)::text as with_response,
              count(*) filter (where mpj.id is null)::text as without_job,
              min(re.created_at)::text as first_at,
              max(re.created_at)::text as last_at
       from raw_events re
       left join message_processing_jobs mpj on mpj.raw_event_id = re.id
       left join responses r on r.source_raw_event_id = re.id
       where re.payload_type = 'VOICE'`,
    );

    // Skutečné hodnoty purpose (ne jen předpoklad z kódu) + počty přepisů.
    const llmRunsByPurpose = await client.query<{ purpose: string; model_id: string; status: string; n: string }>(
      `select purpose, model_id, status, count(*)::text as n
       from llm_runs group by purpose, model_id, status order by purpose, model_id, status`,
    );
    const usageByPurpose = await client.query<{ purpose: string; model_id: string | null; unit: string; n: string }>(
      `select purpose, model_id, unit, count(*)::text as n
       from usage_ledger group by purpose, model_id, unit order by purpose, model_id, unit`,
    );

    const transcription = await client.query<{
      llm_runs_n: string;
      llm_first: string | null;
      llm_last: string | null;
      usage_n: string;
      usage_first: string | null;
      usage_last: string | null;
    }>(
      `select (select count(*) from llm_runs where purpose = $1)::text as llm_runs_n,
              (select min(created_at) from llm_runs where purpose = $1)::text as llm_first,
              (select max(created_at) from llm_runs where purpose = $1)::text as llm_last,
              (select count(*) from usage_ledger where purpose = $1)::text as usage_n,
              (select min(occurred_at) from usage_ledger where purpose = $1)::text as usage_first,
              (select max(occurred_at) from usage_ledger where purpose = $1)::text as usage_last`,
      [TRANSCRIPTION_PURPOSE],
    );

    await client.query("commit");

    console.log(
      JSON.stringify(
        {
          connectedAsExpected: currentUser === "h2_runtime",
          actualCurrentUser: currentUser,
          scopeReadbackOk: true,
          rlsVisibleRawEventsTotal: Number(totalRawEvents.rows[0].n),
          voiceRawEventsTotals: voiceTotals.rows[0],
          voiceRawEventsByJobStatus: voiceByJobStatus.rows,
          transcriptionPurposeChecked: TRANSCRIPTION_PURPOSE,
          transcriptionRecords: transcription.rows[0],
          llmRunsByPurposeModelStatus: llmRunsByPurpose.rows,
          usageLedgerByPurposeModelUnit: usageByPurpose.rows,
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
