// Dodatek PR 5 po auditu pravidel (DR-033): kontrola prostojů při ticku.
//
// Na začátku každého ticku (pod tick lease) vznikne read-only přehled: připravená práce, obsazené zámky zdrojů (§9),
// globální HOLD limitu, fronta max 1 (DR-040 Q3-A) a nevyřízená rozhodnutí vlastníka (vyplněné rozhodnutí, které TARS
// nepřevzal). Spouštění práce zůstává na stávající logice ticku (a v režimu run na dispatcheru inboxu); tento modul nic
// nespouští, jen zapíše, proč tick nic nedělal (`idle_reason`), a latenci převzetí GO.
//
// Soubory v runs/idle/: `status.json` (poslední tick, přepisuje se atomicky), `history.jsonl` (řádek jen při změně
// důvodu), `go-latency.jsonl` (řádek za každé převzaté rozhodnutí z panelu).
import fs from "node:fs";
import path from "node:path";

import { mkdirDurable, writeDurable } from "./store";
import type { TickResult } from "./orchestrator";

export type IdleReason =
  | "WAITING_OWNER"
  | "OWNER_DECISION_NOT_TAKEN"
  | "WAITING_REVIEW"
  | "PAUSED"
  | "LIMIT_HOLD"
  | "LIMIT_WARNING"
  | "QUEUE_FULL";

/** Rozhodnutí vyplněné v panelu, které TARS v tomto ticku nepřevzal (a proč). */
export interface PendingDecision {
  order: string;
  value: string;
  code: string;
  detail: string;
}

export interface IdleOverview {
  /** zakázky, se kterými tick smí pohnout (isActionable + mayAdvance) */
  runnable: string[];
  waiting_owner: string[];
  /** obsazené zámky zdrojů v runs/resources/ */
  resource_locks: number;
  limit_hold: boolean;
  dispatch_mode: "hold" | "run" | "unknown";
  pending_decisions: PendingDecision[];
}

export interface IdleStatus {
  v: 1;
  at: string;
  tick_status: TickResult["status"];
  /** null = tick pracoval (pohnul zakázkou) */
  idle_reason: IdleReason | null;
  detail: string;
  overview: IdleOverview;
}

export const idleDir = (runsDir: string): string => path.join(runsDir, "idle");

/** Počet zámků zdrojů na disku (jen čtení). Nečitelný adresář = -1 (neznámo). */
export function heldResourceLocks(runsDir: string): number {
  try {
    return fs
      .readdirSync(path.join(runsDir, "resources"))
      .filter((f) => f.endsWith(".lock")).length;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "ENOENT" ? 0 : -1;
  }
}

/**
 * Důvod nečinnosti z výsledku ticku a přehledu. `advanced` = tick pracoval (null). Nepřevzaté rozhodnutí vlastníka má
 * přednost před „čeká na vlastníka“: vlastník už rozhodl, TARS to ale nepřevzal (např. `OWNER_ORIGIN_UNVERIFIED`).
 */
export function idleReasonOf(
  r: TickResult,
  ov: IdleOverview,
): { reason: IdleReason | null; detail: string } {
  const pend = ov.pending_decisions;
  const pendText = pend
    .map((p) => `${p.order}: ${p.value} nepřevzato (${p.code}: ${p.detail})`)
    .join("; ");
  switch (r.status) {
    case "advanced":
      return { reason: null, detail: `zakázka ${r.order} → ${r.state}` };
    case "waiting_owner":
      return pend.length
        ? { reason: "OWNER_DECISION_NOT_TAKEN", detail: pendText }
        : {
            reason: "WAITING_OWNER",
            detail: `zakázka ${r.order} čeká na GO / REJECT vlastníka (fronta max 1)`,
          };
    case "waiting_review":
      return {
        reason: "WAITING_REVIEW",
        detail: `zakázka ${r.order} čeká na kontrolu${r.reason ? `: ${r.reason}` : ""}`,
      };
    case "paused":
      return {
        reason: "PAUSED",
        detail: `zakázka ${r.order} v pauze do ${r.resume_after}`,
      };
    case "limit_hold":
      return { reason: "LIMIT_HOLD", detail: r.reason };
    case "limit_warning":
      return {
        reason: "LIMIT_WARNING",
        detail: `nová zakázka nezačne do ${r.until}`,
      };
    default:
      return { reason: "QUEUE_FULL", detail: r.status };
  }
}

export class IdleRecorder {
  constructor(private runsDir: string) {}

  private file(name: string): string {
    return path.join(idleDir(this.runsDir), name);
  }

  last(): IdleStatus | undefined {
    try {
      return JSON.parse(
        fs.readFileSync(this.file("status.json"), "utf8"),
      ) as IdleStatus;
    } catch {
      return undefined;
    }
  }

  /** Zapíše stav ticku. Vrací true, když se důvod (nebo detail) změnil proti poslednímu záznamu. */
  record(s: IdleStatus): boolean {
    const prev = this.last();
    const changed =
      !prev || prev.idle_reason !== s.idle_reason || prev.detail !== s.detail;
    mkdirDurable(idleDir(this.runsDir));
    writeDurable(this.file("status.json"), JSON.stringify(s, null, 2) + "\n");
    if (changed)
      fs.appendFileSync(
        this.file("history.jsonl"),
        JSON.stringify({
          at: s.at,
          tick_status: s.tick_status,
          idle_reason: s.idle_reason,
          detail: s.detail,
        }) + "\n",
      );
    return changed;
  }

  /** Latence převzetí rozhodnutí: čas zápisu vlastníka (`last_edited_time` řádku) → převzetí TARS. */
  goLatency(e: {
    order: string;
    value: string;
    owner_written_at?: string;
    taken_at: string;
  }): number | undefined {
    const ms = e.owner_written_at
      ? Date.parse(e.taken_at) - Date.parse(e.owner_written_at)
      : NaN;
    const latency_ms = Number.isFinite(ms) ? ms : undefined;
    mkdirDurable(idleDir(this.runsDir));
    fs.appendFileSync(
      this.file("go-latency.jsonl"),
      JSON.stringify({ ...e, latency_ms: latency_ms ?? null }) + "\n",
    );
    return latency_ms;
  }
}
