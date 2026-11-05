// Etapa 4 PR 3 (DR-042 v6.2, mapa v4 §5): identita producenta podání a autora scope karty. Page object nese u autora
// jen `{ object, id }`; typ autora zjistí jen resolver `GET /v1/users/{id}` pod tokenem TARS proti důvěryhodné mapě ID.
// Typ z page objectu se nikdy nečte a o původu nikdy nerozhoduje jméno, `Producent` ani `ID zakázky`.
import { NotionRestError } from "../notion";
import { InboxHold } from "./common";
import type { InboxHttp } from "./http";
import type { NotionPageObject } from "./read";

/** Důvěryhodná mapa ID (lokální konfigurace TARS, mimo repo): integrace TARS z `GET /v1/users/me`, vlastník z kroku 0. */
export interface TrustedIdentities {
  tars_bot_id: string;
  owner_id: string;
}

export const PRODUCERS = ["vlastník-ručně", "fable", "tars"] as const;
export type Producer = (typeof PRODUCERS)[number];

const normId = (s: string): string => s.replace(/-/g, "").toLowerCase();
const ID_RE = /^[0-9a-f]{32}$/;

/** Mapa musí mít dvě různá platná ID, jinak `INVALID_IDENTITY` (mapa chybí nebo je nečitelná). */
export function checkTrustedMap(m: Partial<TrustedIdentities> | undefined): TrustedIdentities {
  const bot = typeof m?.tars_bot_id === "string" ? normId(m.tars_bot_id) : "";
  const owner = typeof m?.owner_id === "string" ? normId(m.owner_id) : "";
  if (!ID_RE.test(bot) || !ID_RE.test(owner) || bot === owner) throw new InboxHold("INVALID_IDENTITY", "důvěryhodná mapa ID chybí nebo je neplatná");
  return { tars_bot_id: bot, owner_id: owner };
}

/** ID autora z page objectu; chybí = undefined. */
export function creatorId(page: Pick<NotionPageObject, "created_by">): string | undefined {
  const id = page.created_by?.id;
  if (typeof id !== "string") return undefined;
  const n = normId(id);
  return ID_RE.test(n) ? n : undefined;
}

export type ResolvedUser = { id: string; kind: "bot" | "person" };

/**
 * Resolver `GET /v1/users/{id}`. Chyba, timeout, jiný objekt, jiné ID nebo neznámý typ = `INVALID_IDENTITY`.
 * Vrací jen `bot`/`person` z odpovědi resolveru.
 */
export async function resolveUser(http: InboxHttp, id: string): Promise<ResolvedUser> {
  let j: unknown;
  try {
    j = (await http.send({ method: "GET", path: `/v1/users/${id}` })).json;
  } catch (e) {
    throw new InboxHold("INVALID_IDENTITY", e instanceof NotionRestError ? `resolver: HTTP ${e.status}` : "resolver selhal");
  }
  const u = j as { object?: unknown; id?: unknown; type?: unknown };
  if (u?.object !== "user" || typeof u.id !== "string" || normId(u.id) !== id) throw new InboxHold("INVALID_IDENTITY", "resolver: neúplná odpověď");
  if (u.type !== "bot" && u.type !== "person") throw new InboxHold("INVALID_IDENTITY", "resolver: neznámý typ");
  return { id, kind: u.type };
}

/**
 * Křížová kontrola producenta (v6.2 §11 bod 2, mapa v4 §5.3). `Producent = tars` vyžaduje ID integrace TARS
 * (resolver: bot), `vlastník-ručně`/`fable` ID vlastníka (resolver: person). Rozpor deklarace a ID = `PRODUCER_MISMATCH`.
 * ID mimo mapu, chybějící ID, chyba resolveru nebo typ, který nesedí na mapu = `INVALID_IDENTITY`.
 */
export async function checkProducer(http: InboxHttp, page: Pick<NotionPageObject, "created_by">, producer: string | null, trusted: TrustedIdentities): Promise<Producer> {
  if (!PRODUCERS.includes(producer as Producer)) throw new InboxHold("INVALID_IDENTITY", "Producent chybí nebo má neznámou hodnotu");
  const id = creatorId(page);
  if (!id) throw new InboxHold("INVALID_IDENTITY", "autor řádku chybí v page objectu");
  const role = id === trusted.tars_bot_id ? "tars" : id === trusted.owner_id ? "owner" : undefined;
  if (!role) throw new InboxHold("INVALID_IDENTITY", "autor řádku mimo důvěryhodnou mapu");
  const u = await resolveUser(http, id);
  if ((role === "tars" && u.kind !== "bot") || (role === "owner" && u.kind !== "person")) throw new InboxHold("INVALID_IDENTITY", "resolver nesedí na důvěryhodnou mapu");
  const declaredTars = producer === "tars";
  if (declaredTars !== (role === "tars")) throw new InboxHold("PRODUCER_MISMATCH", `Producent = ${producer}, autor = ${role}`);
  return producer as Producer;
}

/**
 * B8 (mapa v4 §3.5): autor scope karty S musí být integrace TARS. Chybí ID nebo selže resolver = `INVALID_IDENTITY`.
 * Jiné známé ID (vlastník, jiná integrace, kterou resolver zná) = `SCOPE_PROVENANCE_UNPROVEN`.
 */
export async function checkScopeAuthor(http: InboxHttp, page: Pick<NotionPageObject, "created_by">, trusted: TrustedIdentities): Promise<string> {
  const id = creatorId(page);
  if (!id) throw new InboxHold("INVALID_IDENTITY", "autor scope karty chybí v page objectu");
  if (id === trusted.owner_id) throw new InboxHold("SCOPE_PROVENANCE_UNPROVEN", "scope kartu založil vlastník");
  const u = await resolveUser(http, id);
  if (id !== trusted.tars_bot_id) throw new InboxHold("SCOPE_PROVENANCE_UNPROVEN", "scope kartu založil jiný autor než integrace TARS");
  if (u.kind !== "bot") throw new InboxHold("INVALID_IDENTITY", "resolver nesedí na důvěryhodnou mapu");
  return id;
}
