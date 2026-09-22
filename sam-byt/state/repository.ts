import type { Pool } from "pg";

import type { Decision, DecisionEvent, ListingId, ListingState, Username } from "@/sam-byt/types";

import { defaultState } from "./default-state";

export { defaultState };

const MUTABLE_FIELDS = [
  "favorite",
  "decision",
  "notes",
  "ratingPrice",
  "ratingPet",
  "ratingLocation",
  "ratingBalcony",
  "ratingFurnishing",
] as const;

export interface StatePatch {
  favorite?: boolean;
  decision?: Decision;
  notes?: string;
  ratingPrice?: number | null;
  ratingPet?: number | null;
  ratingLocation?: number | null;
  ratingBalcony?: number | null;
  ratingFurnishing?: number | null;
}

interface StateRow {
  user_id: string;
  listing_id: ListingId;
  favorite: boolean;
  decision: Decision;
  notes: string;
  rating_price: number | null;
  rating_pet: number | null;
  rating_location: number | null;
  rating_balcony: number | null;
  rating_furnishing: number | null;
  version: number;
  updated_at: string;
}

function rowToState(row: StateRow, username: Username): ListingState {
  return {
    userId: row.user_id,
    username,
    listingId: row.listing_id,
    favorite: row.favorite,
    decision: row.decision,
    notes: row.notes,
    ratingPrice: row.rating_price,
    ratingPet: row.rating_pet,
    ratingLocation: row.rating_location,
    ratingBalcony: row.rating_balcony,
    ratingFurnishing: row.rating_furnishing,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

export async function getStatesForUser(
  pool: Pool,
  userId: string,
  username: Username,
): Promise<Map<ListingId, ListingState>> {
  const { rows } = await pool.query<StateRow>("select * from sam_byt_user_listing_state where user_id = $1", [
    userId,
  ]);
  const map = new Map<ListingId, ListingState>();
  for (const row of rows) {
    map.set(row.listing_id, rowToState(row, username));
  }
  return map;
}

export async function getRecentEvents(pool: Pool, limit = 50): Promise<DecisionEvent[]> {
  const { rows } = await pool.query<{
    id: number;
    user_id: string;
    username: Username;
    listing_id: ListingId;
    field: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
  }>(
    `select e.id, e.user_id, u.username, e.listing_id, e.field, e.old_value, e.new_value, e.created_at
       from sam_byt_decision_events e
       join sam_byt_users u on u.id = e.user_id
      order by e.created_at desc
      limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    listingId: r.listing_id,
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    createdAt: r.created_at,
  }));
}

export type MutationResult =
  | { ok: true; state: ListingState }
  | { ok: false; reason: "version_conflict"; current: ListingState };

/**
 * Sloučí patch s aktuálním stavem (uvnitř transakce), vynutí pravidlo
 * "favorit + rozhodnutí nechci" (bod 3.2 zadání) a zapíše UPSERT s
 * optimistic-concurrency WHERE version = expectedVersion. Když se verze
 * neshoduje (souběžná úprava), UPDATE větev ON CONFLICT nic nezmění,
 * rowCount je 0 a volající dostane aktuální stav zpět místo přepsání.
 * Změněná pole se zapíšou do sam_byt_decision_events ve stejné transakci.
 */
export async function applyStateMutation(
  pool: Pool,
  userId: string,
  username: Username,
  listingId: ListingId,
  patch: StatePatch,
  expectedVersion: number,
): Promise<MutationResult> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const { rows: currentRows } = await client.query<StateRow>(
      "select * from sam_byt_user_listing_state where user_id = $1 and listing_id = $2",
      [userId, listingId],
    );
    const current = currentRows[0] ? rowToState(currentRows[0], username) : defaultState(userId, username, listingId);

    if (current.version !== expectedVersion) {
      await client.query("rollback");
      return { ok: false, reason: "version_conflict", current };
    }

    const merged: ListingState = { ...current };
    for (const field of MUTABLE_FIELDS) {
      if (field in patch && patch[field] !== undefined) {
        (merged as unknown as Record<string, unknown>)[field] = patch[field];
      }
    }

    // Nejednoznačný stav "srdíčko favorit + rozhodnutí nechci" nesmí nastat.
    // Pořadí záleží: favoritování dřív odmítnutého bytu ho nejdřív odrejektuje
    // (na "maybe"), teprve pak se aplikuje "reject => favorite=false" — jinak
    // by druhé pravidlo okamžitě smazalo favorit nastavený tím prvním.
    if (patch.favorite === true && merged.decision === "reject" && patch.decision === undefined) {
      merged.decision = "maybe";
    }
    if (merged.decision === "reject") {
      merged.favorite = false;
    }

    const { rows: upsertRows } = await client.query<StateRow>(
      `insert into sam_byt_user_listing_state
         (user_id, listing_id, favorite, decision, notes, rating_price, rating_pet, rating_location, rating_balcony, rating_furnishing, version, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,now())
       on conflict (user_id, listing_id) do update set
         favorite = excluded.favorite,
         decision = excluded.decision,
         notes = excluded.notes,
         rating_price = excluded.rating_price,
         rating_pet = excluded.rating_pet,
         rating_location = excluded.rating_location,
         rating_balcony = excluded.rating_balcony,
         rating_furnishing = excluded.rating_furnishing,
         version = sam_byt_user_listing_state.version + 1,
         updated_at = now()
       where sam_byt_user_listing_state.version = $11
       returning *`,
      [
        userId,
        listingId,
        merged.favorite,
        merged.decision,
        merged.notes,
        merged.ratingPrice,
        merged.ratingPet,
        merged.ratingLocation,
        merged.ratingBalcony,
        merged.ratingFurnishing,
        expectedVersion,
      ],
    );

    if (upsertRows.length === 0) {
      await client.query("rollback");
      const { rows: freshRows } = await pool.query<StateRow>(
        "select * from sam_byt_user_listing_state where user_id = $1 and listing_id = $2",
        [userId, listingId],
      );
      return {
        ok: false,
        reason: "version_conflict",
        current: freshRows[0] ? rowToState(freshRows[0], username) : defaultState(userId, username, listingId),
      };
    }

    const eventFields: Array<{ field: string; old: unknown; next: unknown }> = [
      { field: "favorite", old: current.favorite, next: merged.favorite },
      { field: "decision", old: current.decision, next: merged.decision },
      { field: "notes", old: current.notes, next: merged.notes },
      { field: "rating_price", old: current.ratingPrice, next: merged.ratingPrice },
      { field: "rating_pet", old: current.ratingPet, next: merged.ratingPet },
      { field: "rating_location", old: current.ratingLocation, next: merged.ratingLocation },
      { field: "rating_balcony", old: current.ratingBalcony, next: merged.ratingBalcony },
      { field: "rating_furnishing", old: current.ratingFurnishing, next: merged.ratingFurnishing },
    ];
    for (const { field, old, next } of eventFields) {
      if (old !== next) {
        await client.query(
          "insert into sam_byt_decision_events (user_id, listing_id, field, old_value, new_value) values ($1,$2,$3,$4,$5)",
          [userId, listingId, field, old == null ? null : String(old), next == null ? null : String(next)],
        );
      }
    }

    await client.query("commit");
    return { ok: true, state: rowToState(upsertRows[0], username) };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
