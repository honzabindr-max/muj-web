import { Client } from "pg";

/**
 * Ruční odklizení stale PENDING/RETRY_PENDING jobů PŘED zapojením
 * BUILD-11's produkčního triggeru (Honzíkovo rozhodnutí 2026-09-03,
 * varianta B: ne zpracovat zpětně, ne nechat dry-run kód natrvalo v
 * delivery — jednorázová ruční operace, opakovatelná skriptem).
 *
 * Podmínky (Honzík, 2026-09-03), všechny dodrženy:
 * - raw_events se NEDOTKNE (I7.2, immutable audit) — mění se jen
 *   message_processing_jobs.status.
 * - terminální stav MANUALLY_CLEARED (migrace 0016), jasně odlišný od
 *   zpracování (RESPONSE_READY/DELIVERED) i od selhání (QUARANTINED).
 * - skript v repu, ne ad hoc SQL — dohledatelné a opakovatelné.
 * - default je DRY RUN (jen vypíše, co by se stalo); skutečný zápis až
 *   s --confirm, spustit až na Honzíkovo explicitní GO.
 *
 * Cílí PENDING i RETRY_PENDING — obojí je "not yet claimed", oboje by
 * BUILD-11's trigger jinak vyzvedl (`claimNextJob()`, h2/processing/
 * lease.ts, `status in ('PENDING', 'RETRY_PENDING')`). PROCESSING joby
 * (aktuálně zpracovávané) se nikdy nedotkne.
 *
 * Použití:
 *   npx tsx h2/db/scripts/clear-stale-pending-jobs.ts --reason "text" [--before <ISO timestamp>] [--confirm]
 *
 * --reason   povinné, jde do last_error_detail spolu s časem běhu (kdo/kdy/proč).
 * --before   volitelné, výchozí "teď" — vyčistí jen joby vzniklé PŘED timhle
 *            okamžikem (nechá projít cokoli nově příchozí po spuštění skriptu).
 * --confirm  bez něj skript jen vypíše, co by udělal, nic nezapíše.
 *
 * Vyžaduje .env.verify (viz write-verify-env.sh) — běží pod h2_runtime,
 * ne admin/owner (stejné poučení jako verify-ingestion.ts).
 */
function parseArgs(argv: string[]): { reason: string | null; before: string; confirm: boolean } {
  let reason: string | null = null;
  let before = new Date().toISOString();
  let confirm = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--reason") reason = argv[++i] ?? null;
    else if (argv[i] === "--before") before = argv[++i] ?? before;
    else if (argv[i] === "--confirm") confirm = true;
  }
  return { reason, before, confirm };
}

async function main() {
  const { reason, before, confirm } = parseArgs(process.argv.slice(2));
  if (!reason) {
    throw new Error('Chybí --reason "text". Skript vyžaduje důvod pro audit trail (last_error_detail).');
  }
  if (Number.isNaN(Date.parse(before))) {
    throw new Error(`--before "${before}" není platné ISO datum.`);
  }

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
    const owner = await client.query<{ id: string }>("select id from owners where google_sub is not null limit 1");
    const ownerId = owner.rows[0]?.id;
    if (!ownerId) throw new Error("Žádný owner v DB.");

    await client.query("begin");
    await client.query("select set_config('app.owner_id', $1, true)", [ownerId]);
    const readback = await client.query<{ v: string | null }>("select current_setting('app.owner_id', true) as v");
    if (readback.rows[0]?.v !== ownerId) {
      throw new Error(`app.owner_id scope se nenastavil (očekáváno ${ownerId}, čteno ${readback.rows[0]?.v}). STOP.`);
    }

    const candidates = await client.query<{ id: string; status: string; raw_event_id: string; created_at: string }>(
      `select mpj.id, mpj.status, mpj.raw_event_id, re.created_at
       from message_processing_jobs mpj
       join raw_events re on re.id = mpj.raw_event_id
       where mpj.owner_id = $1
         and mpj.status in ('PENDING', 'RETRY_PENDING')
         and re.created_at < $2
       order by re.created_at asc`,
      [ownerId, before],
    );

    console.log(`${confirm ? "ZAPISUJI" : "DRY RUN — nic se nezapisuje"}: ${candidates.rows.length} job(ů) odpovídá kritériím (before=${before}).`);
    for (const row of candidates.rows) {
      console.log(`  job ${row.id} status=${row.status} raw_event_created_at=${row.created_at}`);
    }

    if (!confirm) {
      await client.query("rollback");
      console.log("\nDry run hotový. Spusť znovu se stejnými argumenty + --confirm pro skutečný zápis.");
      return;
    }
    if (candidates.rows.length === 0) {
      await client.query("rollback");
      console.log("Nic k odklizení.");
      return;
    }

    const detail = `MANUALLY_CLEARED ${new Date().toISOString()} — ${reason}`.slice(0, 500);
    const cleared = await client.query<{ id: string }>(
      `update message_processing_jobs
       set status = 'MANUALLY_CLEARED', finished_at = now(), last_error_code = 'MANUALLY_CLEARED', last_error_detail = $3, updated_at = now()
       where owner_id = $1 and status in ('PENDING', 'RETRY_PENDING') and raw_event_id in (
         select raw_event_id from raw_events where created_at < $2
       )
       returning id`,
      [ownerId, before, detail],
    );
    await client.query("commit");
    console.log(`\nHOTOVO: ${cleared.rows.length} job(ů) přepnuto na MANUALLY_CLEARED. raw_events beze změny.`);
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
