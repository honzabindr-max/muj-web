// Plán B upozornění na iPhone (krok 4b): když zakázka přejde do WAITING_OWNER, zapíše integrace „TARS“ na řádek zakázky
// v „TARS — Zakázky“ komentář se zmínkou vlastníka. Notion pošle push u @zmínky, kterou napsal někdo jiný než vlastník.
// Jediné volání je `POST /v1/comments` (žádné SQL ani rows dotazy). Token se bere z klienta NotionRestApi (Klíčenka),
// bez něj se nic neposílá. Text komentáře projde secret-scanem. Integrace musí mít zapnuté „Insert comments“.
import { assertNoSecret, NotionRestError, SecretLeakError, type NotionRestApi } from "./notion";
import type { Order } from "./types";

/** Notion user ID vlastníka (Jan Bindr). Přepíše se proměnnou prostředí TARS_OWNER_NOTION_USER_ID. */
export const DEFAULT_OWNER_NOTION_USER_ID = "28ed872b-594c-813f-b94f-00025f08b7b6";
export const OWNER_USER_ID_ENV = "TARS_OWNER_NOTION_USER_ID";
/** Přehled TARS, který komentář odkazuje. */
export const OVERVIEW_URL = "https://claude.ai/artifact/DvYFryA3HCPTUrnNCv74Sj";

export const NO_COMMENT_PERMISSION_MESSAGE = "Integrace TARS nemá oprávnění Insert comments";
export const NO_TOKEN_PING_MESSAGE = "Upozornění na iPhone: token Notion chybí, komentář se neposílá";

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** Konfigurovatelné ID vlastníka; neplatná hodnota v prostředí se ignoruje a platí výchozí. */
export function ownerUserIdFromEnv(env: Record<string, string | undefined> = process.env): string {
  const v = env[OWNER_USER_ID_ENV]?.trim();
  return v && UUID_RE.test(v) ? v : DEFAULT_OWNER_NOTION_USER_ID;
}

/** Kolikrát zakázka vstoupila do WAITING_OWNER. Značka v `meta.owner_ping` drží číslo přechodu, na který už komentář odešel. */
export function waitingOwnerTransitions(o: Pick<Order, "history">): number {
  return o.history.filter((h) => h.to === "WAITING_OWNER").length;
}

/** Název zakázky v jedné řádce, aby komentář zůstal čitelný a v limitu rich_text. */
function oneLine(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Text za zmínkou (bez zmínky samotné). */
export function commentTail(title: string): { before: string; link: string } {
  return { before: ` Čeká na tebe: ${oneLine(title)}. Přehled TARS: `, link: OVERVIEW_URL };
}

/** Celý text komentáře tak, jak ho vlastník uvidí (zmínka se zobrazí jako jeho jméno). */
export function commentPlainText(title: string): string {
  const t = commentTail(title);
  return `${t.before}${t.link}`;
}

export function buildCommentBody(pageId: string, userId: string, title: string): Record<string, unknown> {
  const t = commentTail(title);
  return {
    parent: { page_id: pageId },
    rich_text: [
      { type: "mention", mention: { user: { id: userId } } },
      { type: "text", text: { content: t.before } },
      { type: "text", text: { content: t.link, link: { url: t.link } } },
    ],
  };
}

export type PingOutcome = "sent" | "no_token" | "no_permission" | "secret" | "uncertain" | "failed";

export interface OwnerPingOptions {
  userId?: string;
}

/** Posílá komentář. Nikdy nevyhazuje chybu: výsledek je hodnota, volající ho zaloguje. */
export class OwnerPing {
  readonly userId: string;
  constructor(
    private api: Pick<NotionRestApi, "request"> | undefined,
    opts: OwnerPingOptions = {},
  ) {
    this.userId = opts.userId ?? DEFAULT_OWNER_NOTION_USER_ID;
  }

  async send(pageId: string, title: string): Promise<{ outcome: PingOutcome; detail?: string }> {
    if (!this.api) return { outcome: "no_token", detail: NO_TOKEN_PING_MESSAGE };
    try {
      assertNoSecret(`${title}\n${commentPlainText(title)}`);
    } catch (e) {
      if (e instanceof SecretLeakError) return { outcome: "secret", detail: "Upozornění na iPhone: text komentáře obsahuje citlivý údaj, komentář se neposílá" };
      throw e;
    }
    try {
      await this.api.request("POST", "/v1/comments", buildCommentBody(pageId, this.userId, title));
      return { outcome: "sent" };
    } catch (e) {
      if (!(e instanceof NotionRestError)) return { outcome: "failed", detail: "Upozornění na iPhone: neočekávaná chyba" };
      if (e.status === 403) return { outcome: "no_permission", detail: NO_COMMENT_PERMISSION_MESSAGE };
      // 503 s `committed_resource_id`: Notion komentář uložil, druhý se nesmí poslat.
      if (e.committedId) return { outcome: "sent" };
      // Síť a 5xx: komentář mohl vzniknout, naslepo se neopakuje (duplicitní push je horší než chybějící).
      if (e.status === 0 || e.status >= 500) return { outcome: "uncertain", detail: `Upozornění na iPhone: výsledek nejasný (${e.message}), neopakuje se` };
      return { outcome: "failed", detail: `Upozornění na iPhone: Notion odmítl komentář (${e.message})` };
    }
  }
}
