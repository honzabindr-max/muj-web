// Journal efektu „nový řádek panelu po znovuvydání karty“ (DR-039, PR #99, kolo oprav 4). Stejný vzor jako journal
// efektů etapy 3 (PREPARED → receipt): záznam se uloží PŘED vytvořením řádku a receipt (row id) PO úspěchu. Pokus bez
// receiptu (pád procesu, nejasný výsledek POST) se naslepo neopakuje: nejdřív se řádek dohledá podle „ID zakázky“ a
// odkazu na aktuální kartu. Soubor runs/<id>/panel-effects.json se čte i mění jen pod stavovým zámkem.
import fs from "node:fs";
import path from "node:path";

import { writeDurable } from "./store";

/**
 * PREPARED       vytvoření řádku začíná nebo začalo, výsledek není známý.
 * EFFECT_DONE    řádek vznikl, `receipt.row_id` ho jmenuje.
 * EFFECT_ABSENT  poslední pokus jistě nic nezapsal (čisté odmítnutí); nový pokus je bezpečný.
 */
export type PanelEffectState = "PREPARED" | "EFFECT_DONE" | "EFFECT_ABSENT";

export interface PanelEffect {
  operation_id: string;
  order: string;
  step: "panel-row-reissue";
  /** kolo karty (`meta.reissue_round`) */
  round: number;
  state: PanelEffectState;
  attempts: number;
  prepared_at: string;
  updated_at: string;
  receipt?: { row_id: string };
  /** true, když se receipt našel dohledáním po pokusu bez odpovědi */
  recovered?: boolean;
  reason?: string;
}

const FILE = "panel-effects.json";

/** Deterministické id: stejná zakázka a kolo karty dávají vždy stejné id (opakování ho zachová). */
export function reissueRowOp(orderId: string, round: number): string {
  return `${orderId}/panel-row-reissue/r${round}`;
}

/** Nečitelný soubor vyhodí chybu: volající pak řádek nevytváří (čeká), nikdy naopak. */
function readAll(dir: string): Record<string, PanelEffect> {
  const f = path.join(dir, FILE);
  if (!fs.existsSync(f)) return {};
  return JSON.parse(fs.readFileSync(f, "utf8")) as Record<string, PanelEffect>;
}

export function readPanelEffect(
  dir: string,
  op: string,
): PanelEffect | undefined {
  return readAll(dir)[op];
}

export function writePanelEffect(dir: string, rec: PanelEffect): void {
  const all = readAll(dir);
  all[rec.operation_id] = rec;
  writeDurable(path.join(dir, FILE), JSON.stringify(all, null, 2) + "\n");
}
