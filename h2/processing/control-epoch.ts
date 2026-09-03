import type { Pool } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

/**
 * bumpOwnerControlEpoch() — primitiv pro budoucí explicitní PAUSE/STOP
 * command (BUILD-12). Zvýšení owner_control_epoch okamžitě invaliduje
 * jakýkoli rozpracovaný fencing token pro tohoto ownera — commitJobResult()
 * i recordJobFailure() kontrolují OBOU epoch (lease i control) atomicky
 * v jedné UPDATE ... WHERE (BUILD-05 plán, Rozhodnutí 4, AT-71).
 */
export async function bumpOwnerControlEpoch(pool: Pool, ownerId: string): Promise<bigint> {
  return withOwnerScope(pool, ownerId, async (client) => {
    await client.query(`insert into owner_processing_state (owner_id) values ($1) on conflict (owner_id) do nothing`, [
      ownerId,
    ]);
    const result = await client.query<{ owner_control_epoch: string }>(
      `update owner_processing_state
       set owner_control_epoch = owner_control_epoch + 1, updated_at = now()
       where owner_id = $1
       returning owner_control_epoch`,
      [ownerId],
    );
    return BigInt(result.rows[0].owner_control_epoch);
  });
}
