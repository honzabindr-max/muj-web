import type { PoolClient, Pool } from "pg";

import type { ContextManifest, ContextManifestItem } from "@/h2/context/build-context-pack";
import type { ContextPriority } from "@/h2/context/priority";
import { decryptPayload } from "@/h2/crypto/envelope";
import type { EncryptionKeyRegistry } from "@/h2/crypto/keys";
import { withOwnerScope } from "@/h2/db/with-owner-scope";

import { H2BuddyRuntimeError } from "./errors";

/**
 * Epistemic + privacy filter nad manifestem (BUILD-10 plán §7.1, nová
 * vrstva — I4/I5 enforcement). `buildContextPack()` (BUILD-09) vrací jen
 * metadata (`itemType`/`itemId`/`priority`/`reason`), ne obsah — je to
 * audit/selekční artefakt, ne rovnou promptovatelný blob (viz
 * `h2/context/build-context-pack.ts`). Tenhle modul dořeší `itemId` zpět
 * na plaintext obsah PRO KAŽDÝ typ zvlášť a zároveň je jediné místo, kde
 * se I4 (epistemic honesty — hypotéza se nikdy nesmí prezentovat jako
 * fakt) a I5 (`third_party_aggregation_allowed=false`) prakticky vynucují
 * nad konkrétním textem, který uvidí Sonnet.
 *
 * I4/I5 jsou už strukturálně zajištěné o krok dřív (`relevance-floor.ts`
 * vyřadí `isHypothesis` mimo `BUDDY_DEEP_DIVE`, `sources/episodes.ts`
 * vrací striktně per-episode kandidáty, nikdy agregát) — kontroly tady
 * jsou defense-in-depth (stejná disciplína jako Pravidlo 9's readback
 * guard), ne primární mechanismus. Pokud by přesto prošla `CLAIM` se
 * `state='HYPOTEZA'` mimo deep-dive, je to natolik vážné porušení I4, že
 * se to má nahlas rozbít (`H2BuddyRuntimeError`), ne tiše prokličkovat.
 *
 * `CURRENT_MESSAGE` (P0) se tady neřeší — volající už má `messageText`
 * přímo (bylo vstupem do `buildContextPack()`), duplicitní refetch by byl
 * zbytečný.
 */
export type ResolvedContextItem = {
  itemType: string;
  itemId: string;
  priority: ContextPriority;
  contentText: string;
};

function groupIdsByType(items: readonly ContextManifestItem[]): Map<string, string[]> {
  const byType = new Map<string, string[]>();
  for (const item of items) {
    if (item.itemType === "CURRENT_MESSAGE") continue;
    const ids = byType.get(item.itemType) ?? [];
    ids.push(item.itemId);
    byType.set(item.itemType, ids);
  }
  return byType;
}

async function resolveProjects(client: PoolClient, ownerId: string, ids: string[]): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; name: string }>(
    `select id, name from projects where owner_id = $1 and id = any($2::uuid[])`,
    [ownerId, ids],
  );
  return new Map(result.rows.map((row) => [row.id, row.name]));
}

async function resolveCommitments(client: PoolClient, ownerId: string, ids: string[]): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; statement: string }>(
    `select id, statement from commitments where owner_id = $1 and id = any($2::uuid[])`,
    [ownerId, ids],
  );
  return new Map(result.rows.map((row) => [row.id, row.statement]));
}

async function resolveTasks(client: PoolClient, ownerId: string, ids: string[]): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; title: string }>(
    `select id, title from tasks where owner_id = $1 and id = any($2::uuid[])`,
    [ownerId, ids],
  );
  return new Map(result.rows.map((row) => [row.id, row.title]));
}

async function resolveOpenLoops(client: PoolClient, ownerId: string, ids: string[]): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; title: string }>(
    `select id, title from open_loops where owner_id = $1 and id = any($2::uuid[])`,
    [ownerId, ids],
  );
  return new Map(result.rows.map((row) => [row.id, row.title]));
}

async function resolveReminders(client: PoolClient, ownerId: string, ids: string[]): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; label: string | null }>(
    `select r.id, coalesce(t.title, c.statement, o.title) as label
     from reminders r
     left join tasks t on t.id = r.task_id
     left join commitments c on c.id = r.commitment_id
     left join open_loops o on o.id = r.open_loop_id
     where r.owner_id = $1 and r.id = any($2::uuid[])`,
    [ownerId, ids],
  );
  const map = new Map<string, string>();
  for (const row of result.rows) if (row.label) map.set(row.id, row.label);
  return map;
}

async function resolveClaims(
  client: PoolClient,
  ownerId: string,
  ids: string[],
  purpose: string,
): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; statement: string; state: string }>(
    `select id, statement, state from claims where owner_id = $1 and id = any($2::uuid[])`,
    [ownerId, ids],
  );
  const map = new Map<string, string>();
  for (const row of result.rows) {
    if (row.state === "HYPOTEZA" && purpose !== "BUDDY_DEEP_DIVE") {
      // I4 defense-in-depth — relevance floor už tohle mělo vyřadit dřív.
      throw new H2BuddyRuntimeError("UNEXPECTED_HYPOTHESIS_LEAK");
    }
    map.set(row.id, row.state === "HYPOTEZA" ? `[nepotvrzená hypotéza] ${row.statement}` : row.statement);
  }
  return map;
}

async function resolveMechanisms(client: PoolClient, ownerId: string, ids: string[]): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; statement: string }>(
    `select id, statement from mechanisms where owner_id = $1 and id = any($2::uuid[])`,
    [ownerId, ids],
  );
  return new Map(result.rows.map((row) => [row.id, row.statement]));
}

async function resolveExperiments(client: PoolClient, ownerId: string, ids: string[]): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; question: string }>(
    `select id, question from experiments where owner_id = $1 and id = any($2::uuid[])`,
    [ownerId, ids],
  );
  return new Map(result.rows.map((row) => [row.id, row.question]));
}

/**
 * I5 — third-party obsah se dešifruje ze spojeného `raw_events`
 * (`evidence_items` sám o sobě text nenese, `h2/context/sources/
 * episodes.ts`). Každý řádek se explicitně orámuje jako izolovaná
 * epizoda, aby prompt input nešel číst jako pattern/agregát o osobě —
 * strukturální I5 záruka episode capu (BUILD-09) se tak nese i do textu,
 * který Sonnet skutečně uvidí.
 */
async function resolveThirdPartyEpisodes(
  client: PoolClient,
  registry: EncryptionKeyRegistry,
  ownerId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const evidence = await client.query<{ id: string; raw_event_id: string | null }>(
    `select id, raw_event_id from evidence_items where owner_id = $1 and id = any($2::uuid[])`,
    [ownerId, ids],
  );
  const map = new Map<string, string>();
  for (const row of evidence.rows) {
    if (!row.raw_event_id) continue;
    const rawEvent = await client.query<{ payload_ciphertext: Buffer; encryption_key_version: number }>(
      `select payload_ciphertext, encryption_key_version from raw_events where id = $1`,
      [row.raw_event_id],
    );
    const rawEventRow = rawEvent.rows[0];
    if (!rawEventRow) continue;
    const plaintext = decryptPayload(rawEventRow.payload_ciphertext, rawEventRow.encryption_key_version, registry);
    map.set(row.id, `[třetí strana, izolovaná epizoda — NEAGREGOVAT do vzorce o osobě] ${plaintext.toString("utf8")}`);
  }
  return map;
}

export async function resolveManifestContent(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  ownerId: string,
  manifest: ContextManifest,
): Promise<ResolvedContextItem[]> {
  const byType = groupIdsByType(manifest.items);
  if (byType.size === 0) return [];

  const content = await withOwnerScope(pool, ownerId, async (client) => {
    const byTypeContent = new Map<string, Map<string, string>>();
    for (const [itemType, ids] of byType) {
      switch (itemType) {
        case "PROJECT":
          byTypeContent.set(itemType, await resolveProjects(client, ownerId, ids));
          break;
        case "COMMITMENT":
          byTypeContent.set(itemType, await resolveCommitments(client, ownerId, ids));
          break;
        case "TASK":
          byTypeContent.set(itemType, await resolveTasks(client, ownerId, ids));
          break;
        case "OPEN_LOOP":
          byTypeContent.set(itemType, await resolveOpenLoops(client, ownerId, ids));
          break;
        case "REMINDER":
          byTypeContent.set(itemType, await resolveReminders(client, ownerId, ids));
          break;
        case "CLAIM":
          byTypeContent.set(itemType, await resolveClaims(client, ownerId, ids, manifest.purpose));
          break;
        case "MECHANISM":
          byTypeContent.set(itemType, await resolveMechanisms(client, ownerId, ids));
          break;
        case "EXPERIMENT":
          byTypeContent.set(itemType, await resolveExperiments(client, ownerId, ids));
          break;
        case "THIRD_PARTY_EPISODE":
          byTypeContent.set(itemType, await resolveThirdPartyEpisodes(client, registry, ownerId, ids));
          break;
        default:
          // Neznámý/budoucí itemType (§7.4 P4 apod.) — deterministicky
          // přeskočit, ne uhodnout obsah. Manifest je jediný zdroj pravdy
          // o TOM, ŽE je položka relevantní; jak ji vyrenderovat je na
          // resolveru, který zatím neexistuje.
          break;
      }
    }
    return byTypeContent;
  });

  const resolved: ResolvedContextItem[] = [];
  for (const item of manifest.items) {
    if (item.itemType === "CURRENT_MESSAGE") continue;
    const contentText = content.get(item.itemType)?.get(item.itemId);
    if (contentText) resolved.push({ itemType: item.itemType, itemId: item.itemId, priority: item.priority, contentText });
  }
  return resolved;
}
