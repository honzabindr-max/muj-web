// Zápisy řádku panelu, které právě běží (DR-039, znovuvydání karty, kolo oprav 3). Notion neumí podmíněný zápis:
// zápis, který odešel se starou kartou (např. souběžný `cli.ts panel-sync`), může doběhnout až po zápisu nové karty.
// Každý zápis se proto před odesláním ohlásí (token + odkaz karty, který zapisuje) a po odpovědi se odhlásí; `gen` se
// mění při každém ohlášení i odhlášení. Soubor runs/<id>/panel-writes.json se čte i mění jen pod stavovým zámkem.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface PanelWrite {
  /** Odkaz „Karta rozhodnutí“, který tento zápis do řádku posílá (null = prázdný). */
  card: string | null;
  since: string;
}

export interface PanelWrites {
  gen: string;
  inflight: Record<string, PanelWrite>;
}

/**
 * Ohlášený zápis bez odhlášení (pád procesu, nejasný výsledek) se po této době zahodí. Mohl ale v řádku ukázat
 * jinou kartu, proto se po jeho zahození výchozí hodnota rozhodnutí zjišťuje znovu.
 */
export const PANEL_WRITE_EXPIRY_MS = 15 * 60_000;

const FILE = "panel-writes.json";

/** Nečitelný soubor vyhodí chybu: volající pak nezapisuje ani nepřijímá (čeká), nikdy naopak. */
export function readPanelWrites(dir: string): PanelWrites {
  const f = path.join(dir, FILE);
  if (!fs.existsSync(f)) return { gen: "", inflight: {} };
  const j = JSON.parse(fs.readFileSync(f, "utf8")) as Partial<PanelWrites>;
  return {
    gen: typeof j.gen === "string" ? j.gen : "",
    inflight: j.inflight && typeof j.inflight === "object" ? j.inflight : {},
  };
}

function write(dir: string, w: PanelWrites): void {
  const f = path.join(dir, FILE);
  fs.writeFileSync(`${f}.tmp`, JSON.stringify(w, null, 2) + "\n");
  fs.renameSync(`${f}.tmp`, f); // atomic replace
}

/** Ohlásí zápis řádku s odkazem `card`; vrátí token pro `finishPanelWrite`. Volat pod stavovým zámkem. */
export function registerPanelWrite(dir: string, card: string | null, nowIso: string): string {
  const w = readPanelWrites(dir);
  const token = randomUUID();
  w.inflight[token] = { card, since: nowIso };
  w.gen = token;
  write(dir, w);
  return token;
}

/** Odhlásí doběhnutý zápis (odpověď přišla, nebo čisté odmítnutí). Volat pod stavovým zámkem. */
export function finishPanelWrite(dir: string, token: string): void {
  const w = readPanelWrites(dir);
  if (!(token in w.inflight)) return;
  delete w.inflight[token];
  w.gen = randomUUID();
  write(dir, w);
}

/** Zahodí ohlášení starší než `PANEL_WRITE_EXPIRY_MS` (gen se nemění) a vrátí je. Volat pod stavovým zámkem. */
export function dropExpiredPanelWrites(dir: string, nowMs: number): PanelWrite[] {
  const w = readPanelWrites(dir);
  const dropped: PanelWrite[] = [];
  for (const [k, v] of Object.entries(w.inflight)) {
    const since = Date.parse(v.since);
    if (Number.isNaN(since) || nowMs - since > PANEL_WRITE_EXPIRY_MS) {
      dropped.push(v);
      delete w.inflight[k];
    }
  }
  if (dropped.length) write(dir, w);
  return dropped;
}

/** Právě běžící zápisy, které mohou v řádku ukázat jinou kartu než `card`. */
export function foreignCardWrites(w: PanelWrites, card: string): PanelWrite[] {
  return Object.values(w.inflight).filter((v) => v.card !== card);
}
