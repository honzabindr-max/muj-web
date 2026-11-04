// notion-owner-decision (DR-039): PreToolUse hook zamítá volání Notion MCP, které nastavuje „Rozhodnutí vlastníka“.
import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "..", "notion-owner-decision.py");
const REASON = /Agent nikdy nezadává GO ani REJECT za vlastníka \(DR-039\)/;

function run(stdin: string) {
  const r = spawnSync("python3", ["-I", SCRIPT], { input: stdin, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function decide(tool_name: string, tool_input: unknown) {
  const r = run(JSON.stringify({ tool_name, tool_input }));
  expect(r.status).toBe(0);
  if (r.stdout.trim() === "") return { decision: "allow" as const, reason: "" };
  const j = JSON.parse(r.stdout);
  expect(j.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  return { decision: j.hookSpecificOutput.permissionDecision as string, reason: j.hookSpecificOutput.permissionDecisionReason as string };
}

const UPDATE = "mcp__claude_ai_Notion__notion-update-page";
const CREATE = "mcp__claude_ai_Notion__notion-create-pages";

describe("notion-owner-decision: zamítnout", () => {
  it.each([
    ["update_properties GO", UPDATE, { page_id: "p", command: "update_properties", properties: { "Rozhodnutí vlastníka": "GO" } }],
    ["REJECT jako select objekt", UPDATE, { page_id: "p", command: "update_properties", properties: { "Rozhodnutí vlastníka": { select: { name: "REJECT" } } } }],
    ["bez diakritiky a jinými písmeny", UPDATE, { page_id: "p", properties: { "rozhodnuti  VLASTNIKA": "GO A" } }],
    ["mezera navíc", UPDATE, { page_id: "p", properties: { " Rozhodnutí vlastníka ": "GO B" } }],
    ["nový řádek s rozhodnutím", CREATE, { parent: { data_source_id: "d" }, pages: [{ properties: { Zakázka: "x", "Rozhodnutí vlastníka": "GO" } }] }],
    ["vlastnosti jako JSON řetězec", UPDATE, { page_id: "p", properties: JSON.stringify({ "Rozhodnutí vlastníka": "GO" }) }],
    ["jiný Notion konektor (plugin)", "mcp__plugin_notion_notion__notion-update-page", { page_id: "p", properties: { "Rozhodnutí vlastníka": "GO" } }],
  ])("%s", (_n, tool, input) => {
    const d = decide(tool, input);
    expect(d.decision).toBe("deny");
    expect(d.reason).toMatch(REASON);
  });
});

describe("notion-owner-decision: povolit", () => {
  it.each([
    ["zápis jiných sloupců panelu", UPDATE, { page_id: "p", command: "update_properties", properties: { Stav: "WAITING_OWNER", "Čeká na vlastníka": "__YES__" } }],
    ["karta, která o poli jen píše", CREATE, { pages: [{ properties: { title: "KARTA" }, content: "V poli „Rozhodnutí vlastníka“ vyber GO nebo REJECT." }] }],
    ["čtení stránky", "mcp__claude_ai_Notion__notion-fetch", { id: "p" }],
    ["dotaz s filtrem na pole (jen čtení)", "mcp__claude_ai_Notion__notion-query-data-sources", { filter: { "Rozhodnutí vlastníka": "GO" } }],
    ["jiný MCP nástroj", "mcp__claude_ai_Gmail__send_message", { properties: { "Rozhodnutí vlastníka": "GO" } }],
  ])("%s", (_n, tool, input) => {
    expect(decide(tool, input).decision).toBe("allow");
  });
});

describe("notion-owner-decision: okrajové chování", () => {
  it("neplatný JSON blokuje (fail-closed, exit 2) a hlásí chybu", () => {
    const r = run("tohle neni json");
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/ZABLOKOVÁNO \(fail-closed\)/);
  });
});
