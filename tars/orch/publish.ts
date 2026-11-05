// Etapa 4 PR 3 (mapa inboxu v6 §3.3a, N-09; GPT kolo 6 N-11): publikace záznamu „jen jednou“ a jeho přijetí jiným
// procesem až po doložené trvanlivosti. Vedle `writeDurable` (store.ts), ten se nemění a pro ledgery inboxu je zakázaný:
// končí `rename`, který existující cíl nahradí. Tady cíl vzniká jen `link()` z dopsaného a fsyncnutého tmp souboru.
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { mkdirDurable } from "./store";

/** Souborové operace publikace. Výchozí je `node:fs`; testy dosadí model s pádem napájení nebo `link`, který vrátí EPERM. */
export interface PublishFs {
  openSync(p: string, flags: string): number;
  writeSync(fd: number, buf: Buffer, off: number, len: number): number;
  fsyncSync(fd: number): void;
  closeSync(fd: number): void;
  linkSync(existing: string, target: string): void;
  /** jen pro tmp soubory, nikdy pro cíl */
  rmTmp(p: string): void;
  readFileSync(p: string): Buffer;
  existsSync(p: string): boolean;
  fsyncDir(dir: string): void;
  mkdirDurable(dir: string): void;
}

function fsyncDirNode(dir: string): void {
  const dfd = fs.openSync(dir, "r");
  try {
    fs.fsyncSync(dfd);
  } finally {
    fs.closeSync(dfd);
  }
}

export const nodePublishFs: PublishFs = {
  openSync: (p, flags) => fs.openSync(p, flags),
  writeSync: (fd, buf, off, len) => fs.writeSync(fd, buf, off, len),
  fsyncSync: (fd) => fs.fsyncSync(fd),
  closeSync: (fd) => fs.closeSync(fd),
  linkSync: (a, b) => fs.linkSync(a, b),
  rmTmp: (p) => fs.rmSync(p, { force: true }),
  readFileSync: (p) => fs.readFileSync(p),
  existsSync: (p) => fs.existsSync(p),
  fsyncDir: (d) => fsyncDirNode(d),
  mkdirDurable: (d) => mkdirDurable(d),
};

/** Body, ve kterých testy simulují pád nebo zastavení (bariéra). Produkční kód háčky nepředává. */
export type PublishPoint =
  | "tmp-synced"
  | "linked"
  | "dir-synced"
  | "marked"
  | "barrier-synced";

export interface PublishOptions {
  fs?: PublishFs;
  point?: (p: PublishPoint, file: string) => void;
  /**
   * FIX1 (Codex kolo 1, nález 1): kořen trvalé cesty, typicky `runs/`. Před přijetím záznamu se fsyncne každý adresář
   * od adresáře záznamu až po kořen a nakonec i rodič kořene (položka `runs/` v něm), i když adresáře už existovaly.
   * Bez kořene se synchronizuje celá cesta až k `/` (přísnější, nikdy slabší).
   */
  root?: string;
}

/** Volby publikace s kořenem trvalé cesty `runsDir` (FIX1 nález 1); kořen předaný volajícím (testy) má přednost. */
export const rooted = (
  runsDir: string,
  opts: PublishOptions | undefined,
): PublishOptions => ({ ...opts, root: opts?.root ?? runsDir });

/**
 * FIX1 nález 1: trvanlivost celé cesty k záznamu. `mkdirDurable` synchronizuje jen nově vytvořené adresáře; adresář,
 * který založil jiný proces a spadl před fsync rodiče, by výpadek mohl smazat i s ledgerem. Proto se před každým
 * přijetím záznamu (publikace i čtení bez značky) fsyncne každý rodič od adresáře záznamu po kořen a rodič kořene.
 * Záznam mimo kořen = `DurabilityHold`.
 */
function syncPath(
  ops: PublishFs,
  file: string,
  root: string | undefined,
): void {
  const top = path.resolve(root ?? path.parse(path.resolve(file)).root);
  let d = path.resolve(path.dirname(file));
  const rel = path.relative(top, d);
  if (rel.startsWith("..") || path.isAbsolute(rel))
    throw new DurabilityHold(file, `záznam leží mimo kořen ${top}`);
  for (;;) {
    ops.fsyncDir(d);
    if (d === top) break;
    d = path.dirname(d);
  }
  const parent = path.dirname(top);
  if (parent !== top) ops.fsyncDir(parent);
}

/** CREATED = tento volající záznam založil; IDENTICAL = existuje se stejnými bajty; CONFLICT = existuje s jinými bajty. */
export type PublishResult = "CREATED" | "IDENTICAL" | "CONFLICT";

/** `link` selhal jinak než EEXIST (EPERM, ENOTSUP, EXDEV, EMLINK …): HOLD `LEDGER_PUBLISH_UNSUPPORTED`, žádná záložní cesta. */
export class LedgerPublishUnsupported extends Error {
  constructor(public readonly errno: string) {
    super(
      `LEDGER_PUBLISH_UNSUPPORTED: hard link selhal (${errno}), záznam se nepublikuje jinou cestou`,
    );
  }
}

/** N-11: trvanlivost publikovaného záznamu nelze doložit (bariéra selhala nebo značka nesedí): HOLD, záznam se nepoužije. */
export class DurabilityHold extends Error {
  constructor(
    public readonly file: string,
    reason: string,
  ) {
    super(`LEDGER_NOT_DURABLE: ${path.basename(file)}: ${reason}`);
  }
}

const sha256hex = (b: Buffer): string =>
  createHash("sha256").update(b).digest("hex");

/** Značka trvanlivosti vedle záznamu: `<file>.durable` s sha256 bajtů záznamu. Zapíše se až po fsync adresáře záznamu. */
export const durableMarker = (file: string): string => `${file}.durable`;

function writeTmpFully(ops: PublishFs, tmp: string, buf: Buffer): void {
  const fd = ops.openSync(tmp, "wx");
  try {
    let off = 0;
    while (off < buf.length) {
      const n = ops.writeSync(fd, buf, off, buf.length - off);
      if (!(n > 0))
        throw new Error(
          `publishOnce: krátký zápis ${off}/${buf.length} B do ${path.basename(tmp)}`,
        );
      off += n;
    }
    ops.fsyncSync(fd);
  } finally {
    ops.closeSync(fd);
  }
}

/**
 * Create-only přes tmp + link. Vrací CREATED/IDENTICAL/CONFLICT, cíl nikdy nepřepíše. Bez fsync adresáře (volající ho
 * dělá). U CREATED vrací i `tmp`: volající ho smaže až po fsync adresáře (mapa v6 T24 c), v ostatních větvích se smaže hned.
 */
function linkOnce(
  ops: PublishFs,
  file: string,
  buf: Buffer,
  point?: PublishOptions["point"],
): { result: PublishResult; existing?: Buffer; tmp?: string } {
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  let keepTmp = false;
  try {
    writeTmpFully(ops, tmp, buf);
    point?.("tmp-synced", file);
    try {
      ops.linkSync(tmp, file);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? "UNKNOWN";
      if (code !== "EEXIST") throw new LedgerPublishUnsupported(code);
      const existing = ops.readFileSync(file);
      return {
        result:
          existing.equals(buf) && sha256hex(existing) === sha256hex(buf)
            ? "IDENTICAL"
            : "CONFLICT",
        existing,
      };
    }
    point?.("linked", file);
    keepTmp = true;
    return { result: "CREATED", tmp };
  } finally {
    if (!keepTmp) ops.rmTmp(tmp); // jen tmp, nikdy cíl (P1)
  }
}

/**
 * N-11 (bariéra trvanlivosti): záznam, který viděl jiný proces (nebo tento po pádu), se přijme až po doložení, že jeho
 * položka adresáře je trvalá. Značka `<file>.durable` existuje jen tehdy, když už někdo provedl fsync adresáře po `link`.
 * Chybí-li, čtenář bariéru provede sám (fsync souboru + fsync adresáře) a teprve pak značku založí. Značka s jiným otiskem
 * nebo selhání bariéry = `DurabilityHold`, záznam se nepoužije.
 */
export function ensureDurable(
  file: string,
  bytes: Buffer,
  opts: PublishOptions = {},
): void {
  const ops = opts.fs ?? nodePublishFs;
  const marker = durableMarker(file);
  const want = Buffer.from(`${sha256hex(bytes)}\n`, "utf8");
  try {
    if (ops.existsSync(marker)) {
      if (!ops.readFileSync(marker).equals(want))
        throw new DurabilityHold(
          file,
          "značka trvanlivosti nesedí na obsah záznamu",
        );
      return;
    }
    const fd = ops.openSync(file, "r");
    try {
      ops.fsyncSync(fd);
    } finally {
      ops.closeSync(fd);
    }
    syncPath(ops, file, opts.root);
    opts.point?.("barrier-synced", file);
    const m = linkOnce(ops, marker, want);
    try {
      if (m.result === "CONFLICT")
        throw new DurabilityHold(
          file,
          "značka trvanlivosti nesedí na obsah záznamu",
        );
      ops.fsyncDir(path.dirname(file));
    } finally {
      if (m.tmp) ops.rmTmp(m.tmp);
    }
  } catch (e) {
    if (e instanceof DurabilityHold) throw e;
    throw new DurabilityHold(
      file,
      `bariéra selhala: ${String((e as Error)?.message ?? e).slice(0, 120)}`,
    );
  }
}

/**
 * Mapa inboxu v6 §3.3a (N-09) + N-11: publikace záznamu „jen jednou“. tmp + úplný zápis + fsync tmp + `link(tmp, cíl)` +
 * fsync adresáře + značka trvanlivosti. `link` existující cíl nikdy nenahradí: EEXIST = přečíst a porovnat bajty
 * (shodné = IDENTICAL, jiné = CONFLICT). Jiná chyba `link` = `LedgerPublishUnsupported`. Žádný rename, žádný přímý
 * zápis, zkrácení ani smazání cíle v žádné větvi. Vrací se až po doložené trvanlivosti (CREATED i IDENTICAL).
 */
export function publishOnce(
  file: string,
  content: string,
  opts: PublishOptions = {},
): PublishResult {
  const ops = opts.fs ?? nodePublishFs;
  const buf = Buffer.from(content, "utf8");
  ops.mkdirDurable(path.dirname(file));
  const r = linkOnce(ops, file, buf, opts.point);
  if (r.result === "CONFLICT") return "CONFLICT";
  if (r.result === "IDENTICAL") {
    ensureDurable(file, r.existing!, opts);
    return "IDENTICAL";
  }
  try {
    syncPath(ops, file, opts.root); // adresář záznamu + všichni rodiče po kořen, i existující (FIX1 nález 1)
    opts.point?.("dir-synced", file);
    const m = linkOnce(
      ops,
      durableMarker(file),
      Buffer.from(`${sha256hex(buf)}\n`, "utf8"),
    );
    try {
      if (m.result === "CONFLICT")
        throw new DurabilityHold(
          file,
          "cizí značka trvanlivosti u nově založeného záznamu",
        );
      ops.fsyncDir(path.dirname(file));
    } finally {
      if (m.tmp) ops.rmTmp(m.tmp);
    }
    opts.point?.("marked", file);
  } finally {
    ops.rmTmp(r.tmp!); // až po fsync adresáře; pád před tímto bodem nechá tmp, který nikdo nečte (P7)
  }
  return "CREATED";
}

/** Čtení publikovaného záznamu (N-11): neexistuje = absent; existuje = bajty až po doložené trvanlivosti (jinak DurabilityHold). */
export function readPublished(
  file: string,
  opts: PublishOptions = {},
): { state: "absent" } | { state: "present"; bytes: Buffer } {
  const ops = opts.fs ?? nodePublishFs;
  if (!ops.existsSync(file)) return { state: "absent" };
  const bytes = ops.readFileSync(file);
  ensureDurable(file, bytes, opts);
  return { state: "present", bytes };
}
