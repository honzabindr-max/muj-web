"use client";

import { useEffect, useRef } from "react";
import { playNewMarket, playStarted, playDone } from "../_lib/sounds";
import type { DashboardRow } from "../_lib/types";
import { isHeartbeatAlive } from "../_lib/types";

export function useSoundEvents(rows: DashboardRow[], enabled: boolean): void {
  const prevRef = useRef<Map<string, DashboardRow> | null>(null);

  useEffect(() => {
    // Skip until data actually loads
    if (rows.length === 0) return;

    const current = new Map(rows.map((r) => [`${r.gl}-${r.hl}`, r]));

    // First real snapshot — store as baseline, never play
    if (prevRef.current === null) {
      prevRef.current = current;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = current;

    if (!enabled) return;

    let hasNew = false;
    let hasStarted = false;
    let hasDone = false;

    for (const [key, row] of current) {
      const old = prev.get(key);

      if (!old) {
        hasNew = true;
        continue;
      }

      if (!isHeartbeatAlive(old.updated_at) && isHeartbeatAlive(row.updated_at)) {
        hasStarted = true;
      }

      if (old.status !== "done" && row.status === "done") {
        hasDone = true;
      }
    }

    // Max 1 zvuk per typ per polling tik, staggered aby se nepřekrývaly
    let offset = 0;
    if (hasNew) { playNewMarket(offset); offset += 0.55; }
    if (hasStarted) { playStarted(offset); offset += 0.30; }
    if (hasDone) playDone(offset);
  }, [rows, enabled]);
}
