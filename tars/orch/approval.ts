// GO vlastníka vázané na obsah (DR-039, etapa 1). Čistý kód bez I/O: otisk artefaktu, záznam read-backu
// a podmínka, za které smí GO převést zakázku do DONE. Stavový automat ji vynucuje sám (state-machine.ts),
// takže ji neobejde žádná cesta (Notion, `owner()`, přímé `transition`).
import { createHash } from "node:crypto";

import type { Order } from "./types";

/**
 * Kanonický tvar textu před otiskem: jednotné konce řádků, Unicode NFC, bez mezer na konci řádků,
 * bez prázdných řádků navíc a bez okrajových mezer. Změna slova nebo znaku otisk vždy změní.
 */
export function canonicalArtifact(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** sha256 (hex) kanonického tvaru artefaktu. */
export function artifactHash(text: string): string {
  return createHash("sha256")
    .update(canonicalArtifact(text), "utf8")
    .digest("hex");
}

export interface ReadbackRecord {
  url: string;
  hash: string;
  verified_at: string;
}

/** `meta` drží jen řetězce, proto je `meta.readback` JSON {url, hash, verified_at}. Cokoli jiného = žádný read-back. */
export function parseReadback(
  raw: string | undefined,
): ReadbackRecord | undefined {
  if (!raw) return undefined;
  try {
    const j = JSON.parse(raw) as Partial<ReadbackRecord>;
    if (
      typeof j.url !== "string" ||
      typeof j.hash !== "string" ||
      typeof j.verified_at !== "string"
    )
      return undefined;
    if (
      !/^[0-9a-f]{64}$/.test(j.hash) ||
      Number.isNaN(Date.parse(j.verified_at))
    )
      return undefined;
    return { url: j.url, hash: j.hash, verified_at: j.verified_at };
  } catch {
    return undefined;
  }
}

/**
 * Důvod, proč GO nesmí do DONE (undefined = smí). Platí současně:
 *  - existuje `delivered_url` a `approved_hash`,
 *  - `artifact_hash === approved_hash` (vlastník schválil právě tento obsah),
 *  - existuje read-back stejné URL, jehož otisk se rovná `approved_hash` (= otisk DRAFTu přečteného při vydání karty,
 *    tedy přesně to, co vlastník na stránce viděl). Žádný jiný otisk (odeslaný obsah, „rendered“ podoba) neplatí.
 */
export function goBlocker(
  o: Pick<Order, "meta" | "delivered_url">,
): string | undefined {
  if (!o.delivered_url) return "chybí delivered_url";
  const approved = o.meta.approved_hash;
  if (!approved) return "chybí approved_hash (karta bez otisku artefaktu)";
  if (o.meta.artifact_hash !== approved)
    return "artifact_hash ≠ approved_hash (GO patří k jinému obsahu)";
  const rb = parseReadback(o.meta.readback);
  if (!rb) return "čeká na read-back";
  if (rb.url !== o.delivered_url) return "read-back jiné URL než delivered_url";
  if (!/^[0-9a-f]{64}$/.test(approved) || rb.hash !== approved)
    return "obsah se po vydání karty změnil";
  return undefined;
}

/**
 * Etapa 4 PR 2 (NAVRH-v6 §6.1, §6.4): důvod, proč `delivered` s `owner_needed = false` nesmí do DONE (undefined = smí).
 * Platí současně:
 *  - existuje `delivered_url` a `delivered_hash` (64 hex, otisk obsahu přesně tak, jak byl odeslán),
 *  - existuje read-back stejné URL a jeho otisk se rovná `delivered_hash`.
 * Žádná „skoro shoda“: jiný otisk = HOLD (READBACK_MISMATCH). Výsledek pro vlastníka (`owner_needed = true`) jde dál
 * přes kartu a `goBlocker`.
 */
export function readbackBlocker(
  o: Pick<Order, "meta" | "delivered_url">,
): string | undefined {
  if (!o.delivered_url) return "chybí delivered_url";
  const sent = o.meta.delivered_hash;
  if (!sent || !/^[0-9a-f]{64}$/.test(sent))
    return "chybí delivered_hash (otisk odeslaného obsahu)";
  const rb = parseReadback(o.meta.readback);
  if (!rb) return "čeká na read-back";
  if (rb.url !== o.delivered_url) return "read-back jiné URL než delivered_url";
  if (rb.hash !== sent) return "read-back se neshoduje s odeslaným obsahem";
  return undefined;
}
