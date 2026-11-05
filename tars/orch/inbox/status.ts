// Etapa 4 PR 5 (NAVRH-v6 §14 řádek PR 5, sloupec „Nedokončené claimy“): výpisy `cli.ts status`. Jen čtení.
//  - claimy bez commitu, `claim.revoked.json` a ostatní koncové claimy,
//  - `wo-r*` mimo koncový stav (a `wo-r` bez prepare = HOLD UNKNOWN),
//  - brány efektu mimo `DONE`,
//  - legacy `wo-*` mimo koncový stav s legacy stavem (splněno, nebo HOLD `LEGACY_GATE` s migrační cestou).
import fs from "node:fs";
import path from "node:path";

import type { DispatchRead } from "../dispatch";
import type { Order } from "../types";
import { claimEventIds, claimView, orphanInboxOrders } from "./claim";
import { readGate } from "../effect-gate";
import { legacyStatus, orderClass } from "./policy";

const TERMINAL = new Set(["DONE", "FAILED", "UNKNOWN"]);

export function inboxStatusLines(
  runsDir: string,
  orders: Order[],
  dispatch: DispatchRead,
): string[] {
  const out: string[] = [];
  const c = dispatch.config;
  out.push(
    `DISPATCH: mode=${c.mode}${dispatch.invalid ? ` (${dispatch.invalid})` : ""}${dispatch.hold_file ? " (runs/HOLD)" : ""} inbox_types=[${c.inbox_types.join(",")}] private_draft_parents=${c.private_draft_parents.length}`,
  );
  for (const id of claimEventIds(runsDir)) {
    let v: ReturnType<typeof claimView>;
    try {
      v = claimView({ runsDir }, id);
    } catch (e) {
      out.push(
        `CLAIM ${id.slice(0, 8)}  NEČITELNÝ (${e instanceof Error ? e.message.slice(0, 80) : "?"})`,
      );
      continue;
    }
    if (v.terminal)
      out.push(
        `CLAIM ${id.slice(0, 8)}  ${v.terminal.toUpperCase()}  ${v.prepare?.wo_id ?? "-"}  ${v.terminal_reason ?? ""}`.trimEnd(),
      );
    else if (!v.commit)
      out.push(
        `CLAIM ${id.slice(0, 8)}  BEZ COMMITU (${v.prepare ? "prepare" : "jen složka"})  ${v.prepare?.wo_id ?? "-"}`,
      );
    else if (!v.ack)
      out.push(
        `CLAIM ${id.slice(0, 8)}  COMMIT, ACK CLAIMED čeká  ${v.commit.wo_id}`,
      );
  }
  for (const id of orphanInboxOrders({ runsDir }))
    out.push(
      `WO-R ${id}  HOLD UNKNOWN: state.json bez claim.prepare (nikdy dispatch)`,
    );
  for (const o of orders) {
    const cls = orderClass(o);
    if (cls !== "legacy" && !TERMINAL.has(o.state))
      out.push(
        `WO-R ${o.id}  ${o.state}${cls === "unknown" ? "  HOLD UNKNOWN (bez události)" : ""}`,
      );
    if (cls === "legacy" && !TERMINAL.has(o.state)) {
      const s = legacyStatus(o);
      out.push(
        s.state === "HOLD"
          ? `LEGACY ${o.id}  ${o.state}  HOLD LEGACY_GATE: ${s.detail} — cesta: ${s.path}`
          : `LEGACY ${o.id}  ${o.state}  legacy brána splněna${o.state === "WAITING_OWNER" ? " (DONE jen po result GO na kartě)" : ""}`,
      );
    }
    const gd = path.join(runsDir, o.id, "gate");
    if (!fs.existsSync(gd)) continue;
    for (const f of fs
      .readdirSync(gd)
      .filter((x) => x.endsWith(".json"))
      .sort()) {
      const g = readGate(path.join(gd, f));
      if (!g) out.push(`GATE ${o.id}/${f}  NEČITELNÁ`);
      else if (g.state !== "DONE")
        out.push(`GATE ${o.id}/${f}  ${g.state}${g.hold ? `  ${g.hold}` : ""}`);
    }
  }
  return out;
}
