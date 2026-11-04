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
  /**
   * Read-back (DR-039): current content of a page the orchestrator created, as markdown, straight from the Notion REST
   * API (no model in the path). Absent = no read-back available, so an owner GO never reaches DONE.
   */
  readPage?(url: string): Promise<string>;
  /**
   * Etapa 3 (effect journal): every child page of `parentPageId` whose title contains `marker`, read from the REST block
   * children listing in full (strongly consistent, unlike search). Throws when the listing cannot be read completely.
   * Absent = pages cannot be looked up (no token), so an attempt of unknown outcome is held, never repeated.
   */
  findChildPagesByMarker?(parentPageId: string, marker: string): Promise<Array<{ url: string; in_trash?: boolean }>>;
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

/** Name of the owner-only select, folded (same as panel.ts OWNER_DECISION_PROPERTY; kept here to avoid an import cycle). */
const OWNER_DECISION_KEY = "rozhodnuti vlastnika";

const foldKey = (k: string): string =>
  k.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** True when any object key of the payload (any depth) is the owner decision property (diacritics, case, whitespace folded). */
export function setsOwnerDecision(body: unknown, depth = 0): boolean {
  if (depth > 20 || body === null || typeof body !== "object") return false;
  if (Array.isArray(body)) return body.some((x) => setsOwnerDecision(x, depth + 1));
  return Object.entries(body as Record<string, unknown>).some(([k, v]) => foldKey(k) === OWNER_DECISION_KEY || setsOwnerDecision(v, depth + 1));
}

/** The orchestrator tried to write „Rozhodnutí vlastníka“. Nothing is sent and no other path is tried. */
export class OwnerDecisionWriteError extends Error {
  constructor() {
    super("zápis „Rozhodnutí vlastníka“ zablokován: agent nikdy nezadává GO ani REJECT za vlastníka (DR-039)");
  }
}

/** 32-hex Notion page id at the end of the URL path (plain or UUID form), undefined when there is none. */
export function pageIdFromUrl(url: string): string | undefined {
  let seg: string;
  try {
    const u = new URL(url);
    if (!/(^|\.)notion\.(so|com|site)$/.test(u.hostname)) return undefined;
    seg = u.pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    return undefined;
  }
  const m = /(?:^|-)([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(seg);
  return m ? m[1].replace(/-/g, "").toLowerCase() : undefined;
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
    // DR-039: „Rozhodnutí vlastníka“ belongs to the owner. No write of this client may set it (a key at any depth of the body).
    if (body !== undefined && setsOwnerDecision(body)) throw new OwnerDecisionWriteError();
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

  /**
   * Read-back (DR-039): `GET /v1/pages/{id}/markdown`. Only a complete answer counts: a truncated page, unknown blocks,
   * a missing `markdown` field or a URL without a page id throw, and the caller keeps the order in WAITING_OWNER.
   */
  async readPage(url: string): Promise<string> {
    const id = pageIdFromUrl(url);
    if (!id) throw new NotionRestError(0, "no_page_id");
    const j = await this.api.request<{ markdown?: unknown; truncated?: unknown; unknown_block_ids?: unknown }>("GET", `/v1/pages/${id}/markdown`);
    if (typeof j.markdown !== "string") throw new NotionRestError(200, "bad_response");
    if (j.truncated === true || (Array.isArray(j.unknown_block_ids) && j.unknown_block_ids.length > 0)) throw new NotionRestError(200, "incomplete");
    return j.markdown;
  }

  /**
   * Etapa 3: `GET /v1/blocks/{parent}/children`, every page of the listing (at most CHILDREN_MAX_PAGES × 100 blocks),
   * child pages whose title ENDS with exactly the marker (`titleCarriesMarker`). A listing that cannot be read to its end throws (never „not found“).
   */
  async findChildPagesByMarker(parentPageId: string, marker: string): Promise<Array<{ url: string; in_trash?: boolean }>> {
    const parent = parentPageId.replace(/-/g, "");
    const hits: Array<{ url: string; in_trash?: boolean }> = [];
    let cursor: string | undefined;
    for (let page = 0; page < CHILDREN_MAX_PAGES; page++) {
      const j = await this.api.request<{ results?: unknown; has_more?: unknown; next_cursor?: unknown }>(
        "GET",
        `/v1/blocks/${parent}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      if (!Array.isArray(j.results)) throw new NotionRestError(200, "bad_response");
      for (const b of j.results as Array<{ id?: unknown; type?: unknown; in_trash?: unknown; archived?: unknown; child_page?: { title?: unknown } }>) {
        // Exact token at the end of the title, never a substring: a title quoting another order's marker is not a hit.
        if (b.type !== "child_page" || typeof b.child_page?.title !== "string" || !titleCarriesMarker(b.child_page.title, marker)) continue;
        if (typeof b.id !== "string" || !COMMITTED_ID_RE.test(b.id)) throw new NotionRestError(200, "bad_response");
        hits.push({ url: `https://www.notion.so/${b.id.replace(/-/g, "")}`, ...(b.in_trash === true || b.archived === true ? { in_trash: true } : {}) });
      }
      if (j.has_more !== true) return hits;
      if (typeof j.next_cursor !== "string" || !j.next_cursor) break;
      cursor = j.next_cursor;
    }
    throw new NotionRestError(200, "incomplete"); // the listing has more than we read: never answer „not found“
  }
}

/**
 * Exact match (review kolo 1): a title carries the marker only when the marker is the whole token at its very end, where
 * `titleWithMarker` puts it. A title that merely quotes another order's marker (`… [op:wo-a/deliver/r0] … [op:wo-b/…]`)
 * belongs to the order whose marker ends it, never to the quoted one.
 */
export function titleCarriesMarker(title: string, marker: string): boolean {
  const t = title.trimEnd();
  if (!marker || !t.endsWith(marker)) return false;
  const before = t.length - marker.length;
  return before === 0 || /\s/.test(t[before - 1]); // a whole token, not the tail of a longer one
}

const BODY_MARKER_LINE_RE = /^Operace TARS: `(\[op:[^`\r\n]+\])`\r?$/gm;

/**
 * Exact match in a PR body: the LAST line of the exact form ``Operace TARS: `[op:…]` `` (the one `deliver` appends after
 * the brief) must equal the marker. A brief quoting another marker inline, or quoting such a line above it, never matches.
 */
export function bodyCarriesMarker(body: string, marker: string): boolean {
  const lines = [...body.matchAll(BODY_MARKER_LINE_RE)];
  return lines.length > 0 && lines[lines.length - 1][1] === marker;
}

/** 50 × 100 child blocks under the DRAFT parent; beyond that the lookup reports „cannot tell“ (HOLD). */
const CHILDREN_MAX_PAGES = 50;

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

  /** Read-back is REST only: a model in the path could not be trusted to report the page content (no MCP fallback). */
  readPage(url: string): Promise<string> {
    return this.rest.readPage(url);
  }

  /** Effect lookup is REST only (pages created through the MCP fallback are children of the same parent, so they are found too). */
  findChildPagesByMarker(parentPageId: string, marker: string): Promise<Array<{ url: string; in_trash?: boolean }>> {
    return this.rest.findChildPagesByMarker(parentPageId, marker);
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
