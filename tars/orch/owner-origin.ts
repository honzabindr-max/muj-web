// Dodatek PR 5 po auditu pravidel (P20, fail-closed): rozhodnutí vlastníka z panelu „TARS — Zakázky“ (pole „Rozhodnutí
// vlastníka“) se přijme jen tehdy, když Notion u posledního zápisu do stránky řádku (`last_edited_by.id`) ukazuje na
// ověřené ID uživatele vlastníka. Ověření = shoda s ID vlastníka z konfigurace + resolver `GET /v1/users/{id}` vrátí
// osobu (stejný resolver jako DR-042 v6.2 u `created_by.id`). Zápis od integrace/bota, jiného uživatele, chybějící
// údaj nebo chyba resolveru = HOLD `OWNER_ORIGIN_UNVERIFIED`, nikdy přijetí ani efekt.
//
// Kontrola běží jen při POZOROVÁNÍ rozhodnutí (vznik receiptu / přijetí). Revalidace před efektem dál porovnává
// hodnotu s receiptem: TARS sám zapisuje jiné sloupce řádku, takže `last_edited_by` po přijetí legitimně ukazuje na
// integraci; změnu samotné hodnoty revalidace zachytí jako odvolání.
import type { NotionRestApi } from "./notion";

/** Proměnná prostředí s Notion user ID vlastníka. Bez platné hodnoty se žádné GO z panelu nepřijme (fail-closed). */
export const OWNER_ORIGIN_ENV = "TARS_OWNER_NOTION_USER_ID";
export const OWNER_ORIGIN_UNVERIFIED = "OWNER_ORIGIN_UNVERIFIED";

const normId = (s: string): string => s.replace(/-/g, "").toLowerCase();
const ID_RE = /^[0-9a-f]{32}$/;

/** Normalizované ID (32 hex) nebo undefined. */
export function normUserId(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const n = normId(v.trim());
  return ID_RE.test(n) ? n : undefined;
}

/** ID vlastníka z konfigurace (prostředí). Žádná výchozí hodnota v kódu: chybí nebo je neplatné = undefined. */
export function ownerIdFromConfig(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return normUserId(env[OWNER_ORIGIN_ENV]);
}

export type OriginResult =
  | { ok: true; editor: string }
  | { ok: false; code: typeof OWNER_ORIGIN_UNVERIFIED; detail: string };

export interface OwnerOrigin {
  /** Ověří autora posledního zápisu řádku s rozhodnutím. Nikdy nevyhazuje: chyba = `ok: false`. */
  verify(editorId: string | undefined): Promise<OriginResult>;
}

export type UserKindResolver = (id: string) => Promise<"bot" | "person">;

const fail = (detail: string): OriginResult => ({
  ok: false,
  code: OWNER_ORIGIN_UNVERIFIED,
  detail,
});

/** Ověřovač: ID vlastníka z konfigurace + resolver typu uživatele. Bez ID vlastníka každé ověření selže. */
export class OwnerOriginVerifier implements OwnerOrigin {
  readonly ownerId: string | undefined;
  constructor(
    ownerId: string | undefined,
    private resolve: UserKindResolver | undefined,
  ) {
    this.ownerId = normUserId(ownerId);
  }

  async verify(editorId: string | undefined): Promise<OriginResult> {
    if (!this.ownerId)
      return fail(`ID vlastníka není v konfiguraci (${OWNER_ORIGIN_ENV})`);
    if (!this.resolve)
      return fail("resolver uživatelů Notionu není k dispozici (token chybí)");
    const editor = normUserId(editorId);
    if (!editor)
      return fail(
        "autor posledního zápisu řádku (last_edited_by) chybí v odpovědi Notionu",
      );
    if (editor !== this.ownerId)
      return fail(
        "poslední zápis řádku neudělal vlastník (integrace, bot nebo jiný uživatel)",
      );
    let kind: "bot" | "person";
    try {
      kind = await this.resolve(editor);
    } catch {
      return fail("resolver uživatele selhal");
    }
    if (kind !== "person") return fail("resolver: ID vlastníka nepatří osobě");
    return { ok: true, editor };
  }
}

/** Resolver nad Notion REST (`GET /v1/users/{id}`): jiný objekt, jiné ID nebo neznámý typ = chyba. */
export function restUserResolver(
  api: Pick<NotionRestApi, "request">,
): UserKindResolver {
  return async (id) => {
    const u = await api.request<{
      object?: unknown;
      id?: unknown;
      type?: unknown;
    }>("GET", `/v1/users/${id}`);
    if (u?.object !== "user" || normUserId(u.id) !== id)
      throw new Error("resolver: neúplná odpověď");
    if (u.type !== "bot" && u.type !== "person")
      throw new Error("resolver: neznámý typ");
    return u.type;
  };
}
