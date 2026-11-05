// Etapa 4 PR 3: HTTP vrstva inboxu. Jediná cesta ven je REST s pinovanou `Notion-Version` a s tělem, které se posílá
// bajtově přesně (scope karta: bajty z ledgeru, mapa v5 L2/L5). Žádná záložní cesta přes MCP (mapa v5 L7).
import { NOTION_API_VERSION, NotionRestError, OwnerDecisionWriteError, SecretLeakError, setsOwnerDecision } from "../notion";
import { registerKnownSecret, scanSecrets } from "../secret-scan";

export type InboxMethod = "GET" | "POST" | "PATCH";

export interface InboxRequest {
  method: InboxMethod;
  path: string;
  /** přesné bajty těla; undefined = bez těla */
  body?: Buffer;
}

export interface InboxResponse {
  status: number;
  json: unknown;
}

/**
 * Klient inboxu. `apiVersion` je hodnota hlavičky `Notion-Version`, kterou klient u KAŽDÉHO požadavku pošle (V6).
 * `send` vrací odpověď 2xx; 4xx/5xx = `NotionRestError(status, code)`, síť/timeout = `NotionRestError(0, "network")`.
 */
export interface InboxHttp {
  readonly apiVersion: string;
  send(req: InboxRequest): Promise<InboxResponse>;
}

/** Tělo požadavku jako bajty: JSON.stringify pro běžné dotazy (ne pro scope kartu, ta posílá bajty ledgeru). */
export const jsonBytes = (v: unknown): Buffer => Buffer.from(JSON.stringify(v), "utf8");

const KNOWN_CODES = new Set([
  "invalid_json", "invalid_request_url", "invalid_request", "validation_error", "missing_version", "unauthorized", "restricted_resource",
  "object_not_found", "conflict_error", "rate_limited", "internal_server_error", "service_unavailable", "database_connection_unavailable", "gateway_timeout",
]);

/** Ochrany před odesláním (stejné jako `NotionRestApi.request`): P20 a secret scan nad přesnými bajty těla. */
export function guardBody(body: Buffer | undefined): void {
  if (!body) return;
  const text = body.toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("tělo požadavku inboxu není JSON");
  }
  if (setsOwnerDecision(parsed)) throw new OwnerDecisionWriteError();
  const s = scanSecrets(text);
  if (!s.clean) throw new SecretLeakError(`secret-scan: ${s.kinds.join(",")} — zápis do Notionu zastaven`);
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: Buffer; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Produkční REST klient inboxu (v PR 3 se nikde nevytváří; zapojení je PR 5 po GO). Token jen v hlavičce Authorization.
 * Bez pauzy a bez fallbacku: každá chyba se vrací volajícímu, který o ní rozhodne podle journalu.
 */
export class RestInboxHttp implements InboxHttp {
  readonly apiVersion = NOTION_API_VERSION;
  private auth: string;
  constructor(
    token: string,
    private fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {
    this.auth = `Bearer ${token}`;
    registerKnownSecret(token);
  }

  async send(req: InboxRequest): Promise<InboxResponse> {
    guardBody(req.body);
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`https://api.notion.com${req.path}`, {
        method: req.method,
        headers: { Authorization: this.auth, "Notion-Version": this.apiVersion, "Content-Type": "application/json" },
        body: req.body,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new NotionRestError(0, "network");
    }
    if (!res.ok) {
      let code = "error";
      let committed: string | undefined;
      try {
        const j = (await res.json()) as { code?: unknown; additional_data?: { committed_resource_id?: unknown } };
        if (typeof j.code === "string" && KNOWN_CODES.has(j.code)) code = j.code;
        const c = j.additional_data?.committed_resource_id;
        if (typeof c === "string" && /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(c)) committed = c.replace(/-/g, "");
      } catch {
        /* body není JSON */
      }
      throw new NotionRestError(res.status, code, committed);
    }
    try {
      return { status: res.status, json: await res.json() };
    } catch {
      throw new NotionRestError(res.status, "bad_response");
    }
  }
}
