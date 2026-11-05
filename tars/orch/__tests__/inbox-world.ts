// Pomocník testů inboxu (etapa 4 PR 3): fake Notion + skutečný EffectJournal v dočasném runs/ + lease, který jde
// „ztratit“. Není to test sám o sobě.
import { EffectJournal } from "../effects";
import { ackOp, ackStep, type AckCtx } from "../inbox/ack";
import type { LeaseView } from "../inbox/common";
import { observeRow, type InboxEvent } from "../inbox/event";
import { readInboxIdentities, readSchema, scanDataSource } from "../inbox/read";
import { readScopeSnapshot, type ScopeCtx } from "../inbox/scope";
import {
  BOT,
  FakeNotion,
  INBOX_DS,
  OWNER,
  PANEL_DS,
  inboxProps,
} from "./inbox-fake";

export class TestLease implements LeaseView {
  ok = true;
  constructor(
    public fence = 1,
    public token = "tok-1",
  ) {}
  holds(): boolean {
    return this.ok;
  }
}

export function makeWorld(dir: string) {
  const fake = new FakeNotion();
  const http = fake.client();
  let t = Date.parse("2026-11-05T10:00:00.000Z");
  const now = () => new Date((t += 1000)).toISOString();
  const journal = new EffectJournal(dir, now);
  const lease = new TestLease();
  const trusted = { tars_bot_id: BOT, owner_id: OWNER };
  const panel = { data_source_id: PANEL_DS };

  const addRequest = (
    o: Parameters<typeof inboxProps>[0] = {},
    createdBy: string | undefined = OWNER,
  ) => fake.addRow(INBOX_DS, inboxProps(o), createdBy);

  async function observe(rowId: string, h = http) {
    const scan = await scanDataSource(h, INBOX_DS);
    const schema = await readSchema(h, INBOX_DS);
    const identities = await readInboxIdentities(h, scan, schema);
    const row = scan.rows.find((r) => r.id === rowId)!;
    return observeRow({
      http: h,
      runsDir: dir,
      row,
      schema,
      scan,
      identities,
      trusted,
      lease,
      now,
    });
  }

  const ackCtx = (ev: InboxEvent, o: Partial<AckCtx> = {}): AckCtx => ({
    http,
    runsDir: dir,
    journal,
    lease,
    mode: "run",
    event: ev,
    ackPropertyId: "ack",
    now,
    ...o,
  });

  const scopeCtx = (ev: InboxEvent, o: Partial<ScopeCtx> = {}): ScopeCtx => {
    const h = o.http ?? http;
    return {
      http: h,
      runsDir: dir,
      journal,
      lease,
      mode: "run",
      event: ev,
      panel,
      trusted,
      read: () =>
        readScopeSnapshot(h, {
          inboxDataSourceId: INBOX_DS,
          panel: o.panel ?? panel,
          event: ev,
        }),
      ackR0Done: () =>
        journal.get(ackOp(ev.event_id, 0))?.state === "EFFECT_DONE",
      codeVersion: "A",
      now,
      ...o,
    };
  };

  /** Podání pozorované a ACK r0 hotové (předpoklady 1–4 scope karty). */
  async function ready(o: Parameters<typeof inboxProps>[0] = {}) {
    const row = addRequest(o);
    const obs = await observe(row.id);
    const ev = obs.event;
    const a = await ackStep(ackCtx(ev), "ACKED");
    if (a.kind !== "done") throw new Error(`ACK r0: ${JSON.stringify(a)}`);
    fake.log.length = 0;
    return { row, ev };
  }

  return {
    fake,
    http,
    now,
    journal,
    lease,
    trusted,
    panel,
    addRequest,
    observe,
    ackCtx,
    scopeCtx,
    ready,
    dir,
  };
}
