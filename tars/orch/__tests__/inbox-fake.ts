// Fake Notion pro testy inboxu (etapa 4 PR 3). Není to test sám o sobě. Bez sítě: Inbox, panel, uživatelé, endpoint
// vlastností, query se stránkováním, POST/PATCH stránek. Každý požadavek se zaznamená (metoda, cesta, PŘESNÉ bajty těla,
// hlavička Notion-Version), aby orakl mohl porovnávat bajty, ne parsovaný objekt.
import { randomBytes } from "node:crypto";
import fs from "node:fs";

import { NOTION_API_VERSION, NotionRestError } from "../notion";
import {
  guardBody,
  type InboxHttp,
  type InboxRequest,
  type InboxResponse,
} from "../inbox/http";

export const INBOX_DS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PANEL_DS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const BOT = "b0".repeat(16);
export const OWNER = "0a".repeat(16);
export const OTHER_BOT = "cc".repeat(16);

type PropType =
  | "title"
  | "rich_text"
  | "number"
  | "select"
  | "url"
  | "checkbox";
type Val = string[] | number | string | boolean | null;

export const INBOX_SCHEMA: Record<string, { id: string; type: PropType }> = {
  Požadavek: { id: "title", type: "title" },
  request_id: { id: "rqid", type: "rich_text" },
  generation: { id: "gen", type: "number" },
  supersedes: { id: "sup", type: "rich_text" },
  Producent: { id: "prod", type: "select" },
  "Typ karty": { id: "typ", type: "select" },
  Zadání: { id: "zad", type: "rich_text" },
  Projekt: { id: "proj", type: "select" },
  "Přijetí TARS": { id: "ack", type: "rich_text" },
};

export const PANEL_SCHEMA: Record<string, { id: string; type: PropType }> = {
  Zakázka: { id: "title", type: "title" },
  "ID zakázky": { id: "oid", type: "rich_text" },
  "Karta rozhodnutí": { id: "karta", type: "url" },
  Stav: { id: "stav", type: "select" },
  Fronta: { id: "fronta", type: "select" },
  "Čeká na vlastníka": { id: "ceka", type: "checkbox" },
  "Kde běží": { id: "kde", type: "select" },
  "Rozhodnutí vlastníka": { id: "own", type: "select" },
};

export interface FakeRow {
  id: string;
  ds: string;
  created_by?: string;
  in_trash: boolean;
  props: Record<string, Val>;
}

export interface Logged {
  method: string;
  path: string;
  body?: Buffer;
  apiVersion: string;
}

const newId = (): string => randomBytes(16).toString("hex");

export class FakeNotion {
  rows: FakeRow[] = [];
  users = new Map<string, "bot" | "person">([
    [BOT, "bot"],
    [OWNER, "person"],
    [OTHER_BOT, "bot"],
  ]);
  usersDown = false;
  log: Logged[] = [];
  schemas: Record<string, Record<string, { id: string; type: PropType }>> = {
    [INBOX_DS]: INBOX_SCHEMA,
    [PANEL_DS]: PANEL_SCHEMA,
  };
  /** Háčky pro injekci chyb a závodů. Vrácený objekt nahradí odpověď, vyhozená chyba se propaguje. */
  onQuery?: (
    ds: string,
    page: number,
    resp: Record<string, unknown>,
  ) => Record<string, unknown> | void;
  onProp?: (
    pageId: string,
    propId: string,
    page: number,
    resp: Record<string, unknown>,
  ) => Record<string, unknown> | void;
  onPost?: (body: Record<string, unknown>, bytes: Buffer) => void;
  onPatch?: (pageId: string, body: Record<string, unknown>) => void;
  /** Ruční stopa POST pro víceprocesové testy (soubor, kam se připíše řádek za každý POST). */
  postLogFile?: string;
  /** Totéž pro PATCH (řádek: pid a zapsaný text Přijetí TARS). */
  patchLogFile?: string;

  client(apiVersion = NOTION_API_VERSION): InboxHttp & { calls: Logged[] } {
    const calls: Logged[] = [];
    return {
      apiVersion,
      calls,
      send: async (req: InboxRequest): Promise<InboxResponse> => {
        guardBody(req.body);
        const l = {
          method: req.method,
          path: req.path,
          body: req.body,
          apiVersion,
        };
        calls.push(l);
        this.log.push(l);
        return { status: 200, json: this.handle(req) };
      },
    };
  }

  posts(): Logged[] {
    return this.log.filter(
      (l) => l.method === "POST" && l.path === "/v1/pages",
    );
  }
  patches(): Logged[] {
    return this.log.filter((l) => l.method === "PATCH");
  }

  addRow(
    ds: string,
    props: Record<string, Val>,
    created_by: string | undefined = OWNER,
    id = newId(),
  ): FakeRow {
    const r: FakeRow = {
      id,
      ds,
      created_by,
      in_trash: false,
      props: { ...props },
    };
    this.rows.push(r);
    return r;
  }

  row(id: string): FakeRow {
    const r = this.rows.find((x) => x.id === id.replace(/-/g, ""));
    if (!r) throw new Error(`fake: řádek ${id} neexistuje`);
    return r;
  }

  pageObject(r: FakeRow): Record<string, unknown> {
    const schema = this.schemas[r.ds];
    const properties: Record<string, unknown> = {};
    for (const [name, s] of Object.entries(schema)) {
      const v = r.props[name];
      let val: unknown;
      // page object nese u title/rich_text jen první segment (simulace zkrácení, U3)
      if (s.type === "title" || s.type === "rich_text")
        val = Array.isArray(v) && v.length ? [{ plain_text: v[0] }] : [];
      else if (s.type === "select")
        val = typeof v === "string" ? { name: v } : null;
      else if (s.type === "checkbox") val = v === true;
      else val = v ?? null;
      properties[name] = { id: s.id, type: s.type, [s.type]: val };
    }
    return {
      object: "page",
      id: r.id,
      url: `https://www.notion.so/${r.id}`,
      in_trash: r.in_trash,
      created_by: r.created_by
        ? { object: "user", id: r.created_by }
        : undefined,
      properties,
    };
  }

  private handle(req: InboxRequest): unknown {
    const [p, qs] = req.path.split("?");
    const q = new URLSearchParams(qs ?? "");
    let m: RegExpExecArray | null;
    if (
      req.method === "POST" &&
      (m = /^\/v1\/data_sources\/([^/]+)\/query$/.exec(p))
    ) {
      const body = JSON.parse(req.body!.toString("utf8")) as {
        page_size?: number;
        start_cursor?: string;
      };
      const size = body.page_size ?? 100;
      const off = body.start_cursor ? Number(body.start_cursor) : 0;
      const all = this.rows.filter((r) => r.ds === m![1]);
      const slice = all.slice(off, off + size);
      const has_more = off + size < all.length;
      const resp: Record<string, unknown> = {
        object: "list",
        results: slice.map((r) => this.pageObject(r)),
        has_more,
        next_cursor: has_more ? String(off + size) : null,
      };
      return this.onQuery?.(m[1], Math.floor(off / size), resp) ?? resp;
    }
    if (req.method === "GET" && (m = /^\/v1\/data_sources\/([^/]+)$/.exec(p))) {
      const s = this.schemas[m[1]];
      if (!s) throw new NotionRestError(404, "object_not_found");
      return {
        object: "data_source",
        id: m[1],
        properties: Object.fromEntries(
          Object.entries(s).map(([n, x]) => [n, { id: x.id, type: x.type }]),
        ),
      };
    }
    if (
      req.method === "GET" &&
      (m = /^\/v1\/pages\/([0-9a-f]{32})\/properties\/([^/]+)$/.exec(p))
    ) {
      const r = this.row(m[1]);
      const propId = decodeURIComponent(m[2]);
      const entry = Object.entries(this.schemas[r.ds]).find(
        ([, s]) => s.id === propId,
      );
      if (!entry) throw new NotionRestError(404, "object_not_found");
      const [name, s] = entry;
      const segs = (r.props[name] as string[] | undefined) ?? [];
      const size = Number(q.get("page_size") ?? 100);
      const off = q.get("start_cursor") ? Number(q.get("start_cursor")) : 0;
      const slice = segs.slice(off, off + size);
      const has_more = off + size < segs.length;
      const resp: Record<string, unknown> = {
        object: "list",
        results: slice.map((t) => ({
          object: "property_item",
          id: propId,
          type: s.type,
          [s.type]: { type: "text", plain_text: t, text: { content: t } },
        })),
        has_more,
        next_cursor: has_more ? String(off + size) : null,
        type: "property_item",
      };
      return this.onProp?.(m[1], propId, Math.floor(off / size), resp) ?? resp;
    }
    if (req.method === "GET" && (m = /^\/v1\/users\/([0-9a-f]{32})$/.exec(p))) {
      if (this.usersDown) throw new NotionRestError(0, "network");
      const t = this.users.get(m[1]);
      if (!t) throw new NotionRestError(404, "object_not_found");
      return { object: "user", id: m[1], type: t };
    }
    if (req.method === "GET" && (m = /^\/v1\/pages\/([0-9a-f]{32})$/.exec(p))) {
      return this.pageObject(this.row(m[1]));
    }
    if (req.method === "POST" && p === "/v1/pages") {
      const body = JSON.parse(req.body!.toString("utf8")) as Record<
        string,
        unknown
      >;
      this.onPost?.(body, req.body!);
      if (this.postLogFile)
        fs.appendFileSync(
          this.postLogFile,
          `${process.pid} ${req.body!.length}\n`,
        );
      const parent = body.parent as { data_source_id: string };
      const props: Record<string, Val> = {};
      for (const [name, v] of Object.entries(
        body.properties as Record<string, Record<string, unknown>>,
      )) {
        if (Array.isArray(v.title))
          props[name] = (v.title as Array<{ text: { content: string } }>).map(
            (s) => s.text.content,
          );
        else if (Array.isArray(v.rich_text))
          props[name] = (
            v.rich_text as Array<{ text: { content: string } }>
          ).map((s) => s.text.content);
        else if ("url" in v) props[name] = v.url as string;
        else if ("select" in v)
          props[name] = (v.select as { name: string } | null)?.name ?? null;
        else if ("checkbox" in v) props[name] = v.checkbox as boolean;
      }
      const r = this.addRow(parent.data_source_id, props, BOT);
      return { object: "page", id: r.id };
    }
    if (
      req.method === "PATCH" &&
      (m = /^\/v1\/pages\/([0-9a-f]{32})$/.exec(p))
    ) {
      const body = JSON.parse(req.body!.toString("utf8")) as Record<
        string,
        unknown
      >;
      this.onPatch?.(m[1], body);
      const r = this.row(m[1]);
      for (const [name, v] of Object.entries(
        body.properties as Record<
          string,
          { rich_text: Array<{ text: { content: string } }> }
        >,
      ))
        r.props[name] = v.rich_text.map((s) => s.text.content);
      if (this.patchLogFile)
        fs.appendFileSync(
          this.patchLogFile,
          `${process.pid} ${JSON.stringify((r.props["Přijetí TARS"] as string[]).join(""))}\n`,
        );
      return { object: "page", id: r.id };
    }
    throw new NotionRestError(400, "invalid_request_url");
  }
}

/** Řádek Inboxu s výchozími hodnotami podání. */
export function inboxProps(
  o: {
    request_id?: string;
    generation?: number | null;
    producent?: string | null;
    title?: string;
    zadani?: string[];
    supersedes?: string;
  } = {},
): Record<string, Val> {
  return {
    Požadavek: [o.title ?? "Napsat test"],
    request_id: [o.request_id ?? "rq-20261105-test"],
    generation: o.generation === undefined ? 1 : o.generation,
    supersedes: o.supersedes ? [o.supersedes] : [],
    Producent: o.producent === undefined ? "vlastník-ručně" : o.producent,
    "Typ karty": "fable",
    Zadání: o.zadani ?? ["test, nic nedělat"],
    Projekt: null,
    "Přijetí TARS": [],
  };
}
