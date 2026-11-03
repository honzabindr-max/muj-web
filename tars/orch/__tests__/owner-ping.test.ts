// Plán B push (krok 4b): komentář se zmínkou přes Notion REST. Skutečný Notion se nevolá, fetch je mock.
import { afterEach, describe, expect, it } from "vitest";

import { NotionRestApi } from "../notion";
import {
  buildCommentBody,
  commentPlainText,
  DEFAULT_OWNER_NOTION_USER_ID,
  NO_COMMENT_PERMISSION_MESSAGE,
  NO_USER_READ_PERMISSION_MESSAGE,
  OVERVIEW_URL,
  PAGE_NOT_VISIBLE_MESSAGE,
  OwnerPing,
  ownerUserIdFromEnv,
  waitingOwnerTransitions,
} from "../owner-ping";
import { clearKnownSecrets } from "../secret-scan";

const TOKEN = ["ntn", "_", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3"].join("");
const PAGE = "40c0ae49f5078107b747c4c6d85abe2b";
const USER = "28ed872b-594c-813f-b94f-00025f08b7b6";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}
function mock(respond: (c: Call) => { status: number; json?: unknown } | Error) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    const c = { url, method: init.method, headers: init.headers, body: init.body };
    calls.push(c);
    const r = respond(c);
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json ?? {} };
  };
  return { calls, ping: new OwnerPing(new NotionRestApi(TOKEN, fetchImpl), { userId: USER }) };
}

afterEach(() => clearKnownSecrets());

describe("komentář se zmínkou", () => {
  it("text je přesně zadaný a zmínka míří na vlastníka", () => {
    expect(commentPlainText("Převod TARS – krok 4b")).toBe(` Čeká na tebe: Převod TARS – krok 4b. Přehled TARS: ${OVERVIEW_URL}`);
    expect(OVERVIEW_URL).toBe("https://claude.ai/artifact/DvYFryA3HCPTUrnNCv74Sj");
    const body = buildCommentBody(PAGE, USER, "Zakázka") as { parent: unknown; rich_text: Array<{ type: string; mention?: unknown; text?: { content: string } }> };
    expect(body.parent).toEqual({ page_id: PAGE });
    expect(body.rich_text[0]).toEqual({ type: "mention", mention: { user: { id: USER } } });
    expect(body.rich_text.map((r) => r.text?.content ?? "").join("")).toBe(commentPlainText("Zakázka"));
  });

  it("název zakázky se zploští do jedné řádky a zkrátí", () => {
    expect(commentPlainText("a\n\n  b")).toContain("Čeká na tebe: a b.");
    expect(commentPlainText("x".repeat(1000)).length).toBeLessThan(400);
  });
});

describe("odeslání přes POST /v1/comments", () => {
  it("pošle jediné volání na /v1/comments s tokenem v hlavičce", async () => {
    const m = mock(() => ({ status: 200 }));
    expect(await m.ping.send(PAGE, "Zakázka")).toEqual({ outcome: "sent" });
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0].url).toBe("https://api.notion.com/v1/comments");
    expect(m.calls[0].method).toBe("POST");
    expect(m.calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(m.calls[0].body).not.toContain(TOKEN);
    expect(JSON.parse(m.calls[0].body!)).toEqual(buildCommentBody(PAGE, USER, "Zakázka"));
  });

  it("bez tokenu nic neposílá a vrátí no_token", async () => {
    const r = await new OwnerPing(undefined).send(PAGE, "Zakázka");
    expect(r.outcome).toBe("no_token");
    expect(r.detail).toMatch(/token Notion chybí/);
  });

  it("403 vrátí srozumitelnou hlášku místo chyby", async () => {
    const m = mock(() => ({ status: 403, json: { code: "restricted_resource", message: "tajné detaily" } }));
    const r = await m.ping.send(PAGE, "Zakázka");
    expect(r).toEqual({ outcome: "no_permission", detail: NO_COMMENT_PERMISSION_MESSAGE });
    expect(NO_COMMENT_PERMISSION_MESSAGE).toBe("Integrace TARS nemá oprávnění Insert comments");
    expect(JSON.stringify(r)).not.toContain("tajné");
  });

  it("secret v textu komentáře zastaví odeslání", async () => {
    const m = mock(() => ({ status: 200 }));
    const leaked = ["gh", "p_", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"].join("");
    const r = await m.ping.send(PAGE, `Zakázka ${leaked}`);
    expect(r.outcome).toBe("secret");
    expect(m.calls).toHaveLength(0);
    expect(JSON.stringify(r)).not.toContain(leaked);
  });

  it("načtený token v názvu zakázky se také nepošle", async () => {
    const m = mock(() => ({ status: 200 }));
    expect((await m.ping.send(PAGE, `Zakázka ${TOKEN}`)).outcome).toBe("secret");
    expect(m.calls).toHaveLength(0);
  });

  it("síť a 5xx jsou nejasný výsledek (neopakuje se naslepo), 503 s committed id je uloženo", async () => {
    expect((await mock(() => new Error("boom")).ping.send(PAGE, "Z")).outcome).toBe("uncertain");
    expect((await mock(() => ({ status: 502 })).ping.send(PAGE, "Z")).outcome).toBe("uncertain");
    const committed = mock(() => ({ status: 503, json: { code: "service_unavailable", additional_data: { committed_resource_id: "0123456789abcdef0123456789abcdef" } } }));
    expect((await committed.ping.send(PAGE, "Z")).outcome).toBe("sent");
  });

  it("O1: 404 „Could not find user … read user information“ → hláška o oprávnění Read user information, bez těla odpovědi", async () => {
    const body = { code: "object_not_found", message: "Could not find user with ID: 28ed872b-594c-813f-b94f-00025f08b7b6. Ensure the integration has read user information capability.", secret_field: "tajne" };
    const r = await mock(() => ({ status: 404, json: body })).ping.send(PAGE, "Z");
    expect(r).toEqual({ outcome: "failed", detail: NO_USER_READ_PERMISSION_MESSAGE });
    expect(NO_USER_READ_PERMISSION_MESSAGE).toBe("Integrace TARS nemá oprávnění Read user information (bez e-mailů)");
    expect(JSON.stringify(r)).not.toMatch(/Could not find|28ed872b|tajne/);
  });

  it("O1: jiná 404 → hláška o sdílení stránky TARS META OS — Bootstrap, bez těla odpovědi", async () => {
    const body = { code: "object_not_found", message: "Could not find page with ID: abc. Make sure the relevant pages and databases are shared with your integration." };
    const r = await mock(() => ({ status: 404, json: body })).ping.send(PAGE, "Z");
    expect(r).toEqual({ outcome: "failed", detail: PAGE_NOT_VISIBLE_MESSAGE });
    expect(PAGE_NOT_VISIBLE_MESSAGE).toBe("Integrace TARS nevidí stránku zakázky, zkontroluj sdílení stránky TARS META OS — Bootstrap");
    expect(JSON.stringify(r)).not.toMatch(/Could not find|abc/);
    // 404 bez čitelného těla je také „stránka není vidět“
    expect(await mock(() => ({ status: 404 })).ping.send(PAGE, "Z")).toEqual({ outcome: "failed", detail: PAGE_NOT_VISIBLE_MESSAGE });
    // zpráva o uživateli bez zmínky o Read user information není rozpoznána jako oprávnění
    const other = await mock(() => ({ status: 404, json: { code: "object_not_found", message: "Could not find user." } })).ping.send(PAGE, "Z");
    expect(other.detail).toBe(PAGE_NOT_VISIBLE_MESSAGE);
  });

  it("O1: 403 vždy hlásí Insert comments, i když tělo zmiňuje uživatele", async () => {
    const r = await mock(() => ({ status: 403, json: { code: "restricted_resource", message: "Could not find user … read user information" } })).ping.send(PAGE, "Z");
    expect(r).toEqual({ outcome: "no_permission", detail: NO_COMMENT_PERMISSION_MESSAGE });
  });

  it("ostatní 4xx (např. 400) je selhání bez značky, jen se známým kódem, ne tělem", async () => {
    const r = await mock(() => ({ status: 400, json: { code: "validation_error", message: "tajný text těla" } })).ping.send(PAGE, "Z");
    expect(r.outcome).toBe("failed");
    expect(r.detail).toContain("notion REST 400 validation_error");
    expect(JSON.stringify(r)).not.toContain("tajný text těla");
  });

  it("nikdy nevolá SQL ani rows (jen /v1/comments)", async () => {
    const m = mock(() => ({ status: 200 }));
    await m.ping.send(PAGE, "Z");
    expect(m.calls.every((c) => c.url === "https://api.notion.com/v1/comments")).toBe(true);
  });
});

describe("konfigurace a idempotence", () => {
  it("ID vlastníka má výchozí hodnotu a jde přepsat prostředím (neplatná hodnota se ignoruje)", () => {
    expect(DEFAULT_OWNER_NOTION_USER_ID).toBe(USER);
    expect(ownerUserIdFromEnv({})).toBe(USER);
    expect(ownerUserIdFromEnv({ TARS_OWNER_NOTION_USER_ID: "11111111-2222-3333-4444-555555555555" })).toBe("11111111-2222-3333-4444-555555555555");
    expect(ownerUserIdFromEnv({ TARS_OWNER_NOTION_USER_ID: "neplatné" })).toBe(USER);
    expect(new OwnerPing(undefined).userId).toBe(USER);
  });

  it("přechody do WAITING_OWNER se počítají z historie", () => {
    const h = (to: string) => ({ from: "DELIVERED", to, event: "delivered", at: "t" }) as never;
    expect(waitingOwnerTransitions({ history: [h("DELIVERED"), h("WAITING_OWNER")] })).toBe(1);
    expect(waitingOwnerTransitions({ history: [h("WAITING_OWNER"), h("DONE"), h("WAITING_OWNER")] })).toBe(2);
    expect(waitingOwnerTransitions({ history: [] })).toBe(0);
  });
});
