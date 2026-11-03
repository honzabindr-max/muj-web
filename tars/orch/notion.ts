// Notion transport (DR-029 krok 5). Two paths, chosen deterministically:
//  1) integration token in the macOS Keychain (notion-token.ts) → official Notion REST API.
//     The integration is shared only with the TARS pages, so a page outside that share answers
//     404/403: that single call (and any 401/429/5xx/network error) falls back to path 2.
//  2) no token → official Notion MCP connector inside `claude -p` (subscription), with a
//     tool allowlist of exactly one Notion tool. The model only transports; code validates
//     the returned URL.
// The token is never read from .env/env, never put on a command line, never logged or written
// to Notion: every write is secret-scanned first (a hit aborts the write, no fallback).
import { NOTION_QUERY_TOOLS_DENIED, ORCH_CLAUDE_SETTINGS, runProcess, type TextAdapter } from "./adapters";
import { redactSecrets, registerKnownSecret, scanSecrets } from "./secret-scan";

export interface NotionPage {
  url: string;
}

export interface NotionClient {
  /** Raw page content (Notion-flavored markdown) exactly as the Notion tool returned it. */
  fetchPage?(pageId: string): Promise<string>;
  /** Create a child page with markdown content; returns its URL. */
  createPage(
    parentPageId: string,
    title: string,
    markdown: string,
  ): Promise<NotionPage>;
}

const NOTION_URL_RE =
  /https:\/\/(app\.notion\.com|www\.notion\.so)\/[^\s)"'>\]]+/;

export function extractNotionUrl(text: string): string | undefined {
  return NOTION_URL_RE.exec(text)?.[0];
}

/** Pulls the raw tool_result of the Notion fetch out of claude's stream-json (no model paraphrase). */
export function extractToolResult(streamJson: string): string | undefined {
  let out: string | undefined;
  for (const line of streamJson.split("\n")) {
    let e: { type?: string; message?: { content?: unknown } };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type !== "user" || !Array.isArray(e.message?.content)) continue;
    for (const c of e.message!.content as Array<{ type?: string; content?: unknown }>) {
      if (c.type !== "tool_result") continue;
      out = Array.isArray(c.content) ? (c.content as Array<{ text?: string }>).map((x) => x.text ?? "").join("") : String(c.content ?? "");
    }
  }
  if (out === undefined) return undefined;
  try {
    return (JSON.parse(out) as { text?: string }).text ?? out;
  } catch {
    return out;
  }
}

export class McpNotion implements NotionClient {
  constructor(
    private transport: TextAdapter,
    private cwd: string,
  ) {}

  async fetchPage(pageId: string): Promise<string> {
    const r = await runProcess(
      "claude",
      ["-p", "--model", "sonnet", "--settings", ORCH_CLAUDE_SETTINGS, "--allowedTools", "mcp__claude_ai_Notion__notion-fetch", "--disallowedTools", NOTION_QUERY_TOOLS_DENIED, "--output-format", "stream-json", "--verbose"],
      `Zavolej nástroj mcp__claude_ai_Notion__notion-fetch s id ${pageId} a odpověz jen slovem HOTOVO.`,
      this.cwd,
      5 * 60_000,
    );
    const text = extractToolResult(r.stdout);
    if (!text || text.length < 200) throw Object.assign(new Error(`notion fetch ${pageId} failed`), { limit: /limit/i.test(r.stdout + r.stderr) });
    if (!scanSecrets(text).clean) throw new Error(`notion fetch ${pageId}: secret-scan hit`);
    return text;
  }

  async createPage(
    parentPageId: string,
    title: string,
    markdown: string,
  ): Promise<NotionPage> {
    assertNoSecret(`${title}\n${markdown}`);
    const prompt = [
      "Jsi transportní vrstva, ne autor. Proveď přesně jedno volání nástroje mcp__claude_ai_Notion__notion-create-pages:",
      `- parent: {"type":"page_id","page_id":"${parentPageId}"}`,
      `- jedna stránka, properties.title = ${JSON.stringify(title)}`,
      "- content = PŘESNĚ text mezi značkami <<<OBSAH a OBSAH>>> beze změny (nic nepřidávej, nezkracuj, nepřepisuj).",
      "- allow_async: false",
      "Pak vrať JEN URL vytvořené stránky, nic jiného.",
      "<<<OBSAH",
      markdown,
      "OBSAH>>>",
    ].join("\n");
    const r = await this.transport.run(prompt, {
      cwd: this.cwd,
      allowedTools: ["mcp__claude_ai_Notion__notion-create-pages"],
      timeoutMs: 10 * 60_000,
    });
    const url = r.ok ? extractNotionUrl(r.text) : undefined;
    if (!url)
      throw Object.assign(
        new Error(
          `notion create failed: ${r.error ?? "no URL in transport output"}`,
        ),
        { limit: r.limit },
      );
    return { url };
  }
}

/** Notion REST API version (2026-03-11: `archived` → `in_trash`; we use neither). */
export const NOTION_API_VERSION = "2026-03-11";
/** „TARS META OS — Bootstrap“: the one page the integration is shared with. */
export const BOOTSTRAP_PAGE_ID = "4070ae49f5078162bcbfd77800b421ec";

/** Notion's documented error codes. Anything else is reported as „error“, so a response body can never carry a secret into a message. */
const KNOWN_ERROR_CODES = new Set([
  "invalid_json", "invalid_request_url", "invalid_request", "invalid_grant", "validation_error", "missing_version", "unauthorized", "restricted_resource",
  "object_not_found", "directory_not_found", "conflict_error", "rate_limited", "internal_server_error", "service_unavailable", "database_connection_unavailable", "gateway_timeout",
]);

/** status 0 = network/timeout. */
export class NotionRestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    /** Notion answered 503 but the write was committed (`additional_data.committed_resource_id`). */
    public readonly committedId?: string,
    /** Known classification of the answer derived from its text; the text itself is never kept. */
    public readonly hint?: NotionErrorHint,
  ) {
    super(`notion REST ${status} ${code}`);
  }
}

/** `read_user_information`: Notion could not resolve a mentioned user because the integration lacks „Read user information“. */
export type NotionErrorHint = "read_user_information";

/** Maps the answer's message to a known hint. Only the verdict leaves this function, never the message. */
function hintFromMessage(message: unknown): NotionErrorHint | undefined {
  if (typeof message !== "string") return undefined;
  if (/could not find user/i.test(message) && /read user information/i.test(message)) return "read_user_information";
  return undefined;
}

const COMMITTED_ID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** Content that would reach Notion contains a secret. Never retried through another path. */
export class SecretLeakError extends Error {}

export function assertNoSecret(text: string): void {
  const s = scanSecrets(text);
  if (!s.clean) throw new SecretLeakError(`secret-scan: ${s.kinds.join(",")} — zápis do Notionu zastaven`);
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Thin REST client. The token lives only in the Authorization header of this one request. */
export class NotionRestApi {
  constructor(
    token: string,
    private fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {
    this.auth = `Bearer ${token}`;
    registerKnownSecret(token);
  }
  private auth: string;
  /**
   * Set by 401 (bad token) or 429 (rate limit shared by the whole workspace): from then on this client sends nothing
   * for the rest of the run. One client serves the page writer and the panel, so both stop together.
   */
  private pausedStatus: 401 | 429 | undefined;
  get paused(): boolean {
    return this.pausedStatus !== undefined;
  }

  async request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
    if (this.pausedStatus) throw new NotionRestError(this.pausedStatus, "paused");
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`https://api.notion.com${path}`, {
        method,
        headers: { Authorization: this.auth, "Notion-Version": NOTION_API_VERSION, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new NotionRestError(0, "network"); // the underlying error is dropped on purpose
    }
    if (!res.ok) {
      let code = "error";
      let committedId: string | undefined;
      let hint: NotionErrorHint | undefined;
      try {
        const j = (await res.json()) as { code?: unknown; message?: unknown; additional_data?: { committed_resource_id?: unknown } };
        if (typeof j.code === "string" && KNOWN_ERROR_CODES.has(j.code)) code = j.code;
        hint = hintFromMessage(j.message);
        const c = j.additional_data?.committed_resource_id;
        if (typeof c === "string" && COMMITTED_ID_RE.test(c)) committedId = c.replace(/-/g, "");
      } catch {
        /* body is not JSON */
      }
      if (res.status === 401 || res.status === 429) this.pausedStatus = res.status;
      throw new NotionRestError(res.status, code, committedId, hint);
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw new NotionRestError(res.status, "bad_response"); // body content is never echoed
    }
  }
}

export class RestNotion implements NotionClient {
  constructor(private api: NotionRestApi) {}

  async createPage(parentPageId: string, title: string, markdown: string): Promise<NotionPage> {
    assertNoSecret(`${title}\n${markdown}`);
    try {
      const j = await this.api.request<{ url?: string }>("POST", "/v1/pages", {
        parent: { type: "page_id", page_id: parentPageId },
        properties: { title: { title: [{ type: "text", text: { content: title.slice(0, 2000) } }] } },
        markdown,
      });
      if (!j.url) throw new NotionRestError(200, "no_url");
      return { url: j.url };
    } catch (e) {
      // Notion may answer 503 after it saved the page: the id says it exists, so never create it a second time.
      if (e instanceof NotionRestError && e.committedId) return { url: `https://www.notion.so/${e.committedId}` };
      throw e;
    }
  }
}

/**
 * Errors after which the old `claude -p` path may still do the job (not our bug, not a secret).
 * 401/403/404/429 mean Notion refused the request before doing anything, so any call may be repeated.
 * Network errors and 5xx are uncertain (the write may have been saved): only an idempotent call
 * (PATCH of a whole row, GET) may be repeated; a create is never repeated blindly, to avoid duplicates.
 */
export function isFallbackEligible(e: unknown, idempotent: boolean): e is NotionRestError {
  if (!(e instanceof NotionRestError)) return false;
  if (e.status === 401 || e.status === 403 || e.status === 404 || e.status === 429) return true;
  return idempotent && (e.status === 0 || e.status >= 500);
}

/**
 * A create whose result is unknown: it may have been saved although we got no usable answer. That is EVERYTHING except
 * a clean refusal (REST 4xx other than 408: nothing was written). Network errors, 5xx, unreadable or id-less answers,
 * plain Errors and failures of the claude -p fallback all count. Such a create is never repeated blindly; the order is
 * marked and its row looked up by order id first.
 */
export const isUncertainOutcome = (e: unknown): boolean =>
  !(e instanceof NotionRestError && e.status >= 400 && e.status < 500 && e.status !== 408);

/** REST first; MCP for pages outside the integration's share and whenever REST is unavailable. Reads stay on MCP. */
export class HybridNotion implements NotionClient {
  constructor(
    private rest: RestNotion,
    private mcp: McpNotion,
    private log: (message: string) => void,
  ) {}

  fetchPage(pageId: string): Promise<string> {
    return this.mcp.fetchPage(pageId);
  }

  async createPage(parentPageId: string, title: string, markdown: string): Promise<NotionPage> {
    assertNoSecret(`${title}\n${markdown}`); // before either path
    try {
      return await this.rest.createPage(parentPageId, title, markdown);
    } catch (e) {
      if (!isFallbackEligible(e, false)) throw e;
      this.log(`Notion REST: ${redactSecrets(e.message)}, používám fallback`);
    }
    return this.mcp.createPage(parentPageId, title, markdown);
  }
}

/** Panel sink and page writer share one decision: token present or not. */
export interface NotionStack {
  notion: NotionClient;
  /** Present only when a token was found. */
  rest?: NotionRestApi;
  mode: "rest" | "fallback";
}

export const NO_TOKEN_MESSAGE = "Notion REST: token chybí, používám fallback";

export function makeNotionStack(
  transport: TextAdapter,
  cwd: string,
  opts: { token?: string; log?: (message: string) => void; fetchImpl?: FetchLike } = {},
): NotionStack {
  const log = opts.log ?? (() => undefined);
  const mcp = new McpNotion(transport, cwd);
  if (!opts.token) {
    log(NO_TOKEN_MESSAGE);
    return { notion: mcp, mode: "fallback" };
  }
  const rest = new NotionRestApi(opts.token, opts.fetchImpl);
  return { notion: new HybridNotion(new RestNotion(rest), mcp, log), rest, mode: "rest" };
}

/** `cli.ts notion-check`: is the token valid and the Bootstrap page shared with the integration? Prints no secret. */
export async function checkRestAccess(api: NotionRestApi, pageId = BOOTSTRAP_PAGE_ID): Promise<{ ok: boolean; detail: string }> {
  try {
    await api.request("GET", `/v1/pages/${pageId}`);
    return { ok: true, detail: "Notion REST: token platný, stránka TARS META OS — Bootstrap je integraci sdílena" };
  } catch (e) {
    if (e instanceof NotionRestError) {
      if (e.status === 401) return { ok: false, detail: "Notion REST: token je neplatný (401). Vytvoř ho znovu a ulož do Klíčenky." };
      if (e.status === 404 || e.status === 403) return { ok: false, detail: `Notion REST: stránka Bootstrap není integraci sdílena (${e.status}). Připoj integraci TARS ke stránce.` };
      return { ok: false, detail: `Notion REST: ${redactSecrets(e.message)}` };
    }
    return { ok: false, detail: "Notion REST: neočekávaná chyba" };
  }
}
