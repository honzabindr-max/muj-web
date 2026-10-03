import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";

/**
 * READ-ONLY export uživatelského stavu sam-byt (audit 2026-10-03).
 *
 * Jen SELECT uvnitř `BEGIN ... READ ONLY` (konzistentní snapshot,
 * REPEATABLE READ) — Postgres sám odmítne jakýkoli zápis. Nečte
 * password_hash, token_hash, user_agent ani IP z login_attempts.
 *
 * Connection string jako ostatní sam-byt skripty z .env.migrate.sam-byt.<target>
 * (SAM_BYT_MIGRATOR_DATABASE_URL), nikdy z argumentu. Výstup obsahuje
 * poznámky Sama/Honzíka → zapisuje se do *.local.json (gitignored).
 *
 *   npx tsx sam-byt/audit/export-state-readonly.ts production
 */

const OUT_FILE = "CURRENT_SAM_BYT_USER_STATE.local.json";

interface CatalogItem {
  id: string;
}

async function main() {
  const target = process.argv[2];
  if (target !== "preview" && target !== "production") {
    throw new Error(
      "Použití: npx tsx sam-byt/audit/export-state-readonly.ts <preview|production>",
    );
  }
  const envFile = path.join(process.cwd(), `.env.migrate.sam-byt.${target}`);
  if (!existsSync(envFile)) {
    throw new Error(
      `${envFile} neexistuje. Vlož SAM_BYT_MIGRATOR_DATABASE_URL do tohoto souboru ručně.`,
    );
  }
  process.loadEnvFile(envFile);
  const databaseUrl = process.env.SAM_BYT_MIGRATOR_DATABASE_URL;
  if (!databaseUrl)
    throw new Error(`${envFile} neobsahuje SAM_BYT_MIGRATOR_DATABASE_URL.`);

  const catalog = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "data", "sam-byt", "listings.json"),
      "utf8",
    ),
  ) as CatalogItem[];
  const catalogIds = catalog.map((it) => it.id);

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query(
      "begin transaction isolation level repeatable read read only",
    );

    const snapshotAt = (
      await client.query<{ now: string }>("select now()::text as now")
    ).rows[0]!.now;
    const readOnly = (
      await client.query<{ transaction_read_only: string }>(
        "show transaction_read_only",
      )
    ).rows[0]!.transaction_read_only;
    if (readOnly !== "on")
      throw new Error("Transakce není read-only — přerušeno.");

    const counts: Record<string, number> = {};
    for (const table of [
      "sam_byt_users",
      "sam_byt_sessions",
      "sam_byt_login_attempts",
      "sam_byt_user_listing_state",
      "sam_byt_decision_events",
      "_sam_byt_migrations",
    ]) {
      const { rows } = await client.query<{ n: string }>(
        `select count(*)::text as n from ${table}`,
      );
      counts[table] = Number(rows[0]!.n);
    }

    const migrations = (
      await client.query(
        "select filename, applied_at from _sam_byt_migrations order by filename",
      )
    ).rows;

    const users = (
      await client.query<{
        id: string;
        username: string;
        display_name: string;
        created_at: string;
      }>(
        "select id, username, display_name, created_at from sam_byt_users order by username",
      )
    ).rows;
    const usernameById = new Map(users.map((u) => [u.id, u.username]));

    const sessions = (
      await client.query(
        `select u.username,
                count(*)::int as sessions_total,
                count(*) filter (where s.expires_at > now())::int as sessions_active,
                max(s.last_seen_at) as last_seen_at
           from sam_byt_sessions s join sam_byt_users u on u.id = s.user_id
          group by u.username order by u.username`,
      )
    ).rows;

    const stateRows = (
      await client.query<
        Record<string, unknown> & { user_id: string; listing_id: string }
      >("select * from sam_byt_user_listing_state order by listing_id, user_id")
    ).rows;

    const events = (
      await client.query<
        { user_id: string; listing_id: string } & Record<string, unknown>
      >(
        "select id, user_id, listing_id, field, old_value, new_value, created_at from sam_byt_decision_events order by id",
      )
    ).rows.map((e) => ({
      ...e,
      username: usernameById.get(e.user_id) ?? null,
    }));

    await client.query("commit");

    const byListing: Record<
      string,
      { sam: unknown; honzik: unknown; events_count: number }
    > = {};
    for (const id of catalogIds)
      byListing[id] = { sam: null, honzik: null, events_count: 0 };
    const orphanStates: unknown[] = [];
    for (const row of stateRows) {
      const username = usernameById.get(row.user_id);
      const entry = byListing[row.listing_id];
      const value = { ...row, username };
      if (!entry || (username !== "sam" && username !== "honzik")) {
        orphanStates.push(value);
        continue;
      }
      entry[username] = value;
    }
    const orphanEventListingIds = new Set<string>();
    for (const e of events) {
      const entry = byListing[e.listing_id];
      if (entry) entry.events_count += 1;
      else orphanEventListingIds.add(e.listing_id);
    }

    const isNonDefault = (s: Record<string, unknown> | null) =>
      !!s &&
      (s.favorite === true ||
        s.decision !== "unreviewed" ||
        (s.notes as string) !== "" ||
        [
          "rating_price",
          "rating_pet",
          "rating_location",
          "rating_balcony",
          "rating_furnishing",
        ].some((k) => s[k] != null));

    const summary = {
      listings_in_catalog: catalogIds.length,
      state_rows_total: stateRows.length,
      listings_with_sam_row: Object.values(byListing).filter((v) => v.sam)
        .length,
      listings_with_honzik_row: Object.values(byListing).filter((v) => v.honzik)
        .length,
      listings_with_sam_nondefault: Object.values(byListing).filter((v) =>
        isNonDefault(v.sam as never),
      ).length,
      listings_with_honzik_nondefault: Object.values(byListing).filter((v) =>
        isNonDefault(v.honzik as never),
      ).length,
      listings_with_sam_notes: Object.values(byListing).filter(
        (v) => ((v.sam as never)?.["notes"] ?? "") !== "",
      ).length,
      listings_with_honzik_notes: Object.values(byListing).filter(
        (v) => ((v.honzik as never)?.["notes"] ?? "") !== "",
      ).length,
      events_total: events.length,
      orphan_state_rows: orphanStates.length,
      orphan_event_listing_ids: [...orphanEventListingIds],
      decision_distribution: stateRows.reduce<Record<string, number>>(
        (acc, r) => {
          const key = `${usernameById.get(r.user_id)}:${r.decision as string}`;
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {},
      ),
    };

    const output = {
      snapshot: {
        target,
        db_snapshot_at: snapshotAt,
        generated_at: new Date().toISOString(),
        transaction: "REPEATABLE READ READ ONLY",
        excluded_fields: [
          "sam_byt_users.password_hash",
          "sam_byt_sessions.token_hash",
          "sam_byt_sessions.user_agent",
          "sam_byt_login_attempts.*",
        ],
      },
      table_counts: counts,
      migrations,
      users,
      sessions_summary: sessions,
      summary,
      by_listing: byListing,
      orphan_states: orphanStates,
      decision_events: events,
    };

    const outPath = path.join(process.cwd(), OUT_FILE);
    writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", {
      mode: 0o600,
    });

    // Do konzole jen agregáty — žádné poznámky, žádná ID uživatelů.
    console.log(
      JSON.stringify(
        {
          table_counts: counts,
          migrations: migrations.map((m) => m.filename),
          summary,
        },
        null,
        2,
      ),
    );
    console.log(
      `Plný export zapsán do ${outPath} (gitignored, nepřikládat do gitu).`,
    );
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
