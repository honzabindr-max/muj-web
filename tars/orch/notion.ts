// Notion transport. Two paths, chosen deterministically:
//  1) NOTION_TOKEN in env → official REST API (fetch).
//  2) otherwise → official Notion MCP connector inside `claude -p` (subscription), with a
//     tool allowlist of exactly one Notion tool. The model only transports; code validates
//     the returned URL. No key is ever read from disk, printed or logged by this module.
import { ORCH_CLAUDE_SETTINGS, runProcess, type TextAdapter } from "./adapters";
import { scanSecrets } from "./secret-scan";

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
      ["-p", "--model", "sonnet", "--settings", ORCH_CLAUDE_SETTINGS, "--allowedTools", "mcp__claude_ai_Notion__notion-fetch", "--output-format", "stream-json", "--verbose"],
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

export class RestNotion implements NotionClient {
  constructor(private token: string) {}

  async createPage(
    parentPageId: string,
    title: string,
    markdown: string,
  ): Promise<NotionPage> {
    const children = markdown
      .split(/\n{2,}/)
      .filter((p) => p.trim())
      .slice(0, 100)
      .map((p) => {
        const h = /^(#{1,3}) (.*)$/.exec(p.trim());
        if (h) {
          const t = `heading_${h[1].length}` as const;
          return {
            object: "block",
            type: t,
            [t]: {
              rich_text: [
                { type: "text", text: { content: h[2].slice(0, 2000) } },
              ],
            },
          };
        }
        return {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: p.slice(0, 2000) } }],
          },
        };
      });
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { page_id: parentPageId },
        properties: { title: { title: [{ text: { content: title } }] } },
        children,
      }),
    });
    if (!res.ok) throw new Error(`notion REST ${res.status}`);
    const j = (await res.json()) as { url: string };
    return { url: j.url };
  }
}

export function makeNotion(transport: TextAdapter, cwd: string): NotionClient {
  const restCredential = readEnv("NOTION_TOKEN");
  return restCredential ? new RestNotion(restCredential) : new McpNotion(transport, cwd);
}

function readEnv(name: string): string | undefined {
  return process.env[name];
}
