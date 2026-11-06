// Etapa 5, PR 2b: GO → takeover latency (runs/idle/go-latency.jsonl) in the health projection. Read only; missing
// data is NOT_INSTRUMENTED / UNKNOWN, never 0; the latency never changes `overall`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  auditHealth,
  collectSnapshot,
  formatHealth,
  formatHealthCompact,
} from "../audit-health";
import { collectGoLatency, projectGoLatency } from "../health-go";
import { IdleRecorder } from "../idle";

const now = Date.parse("2026-11-06T12:00:00Z");
const ago = (min: number) => new Date(now - min * 60_000).toISOString();

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "health-go-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function mtimes(root: string): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  const walk = (p: string) => {
    out[p] = fs.statSync(p, { bigint: true }).mtimeNs;
    if (fs.statSync(p).isDirectory())
      for (const c of fs.readdirSync(p)) walk(path.join(p, c));
  };
  walk(root);
  return out;
}

const line = (o: Record<string, unknown>) => JSON.stringify(o);
function writeLatency(runs: string, lines: string[]): void {
  fs.mkdirSync(path.join(runs, "idle"), { recursive: true });
  fs.writeFileSync(
    path.join(runs, "idle", "go-latency.jsonl"),
    lines.join("\n") + "\n",
  );
}

describe("health-go: projekce latence GO → převzetí", () => {
  it("bez souboru = NOT_INSTRUMENTED, latence null (ne 0)", () => {
    const g = projectGoLatency({ present: false }, now);
    expect(g.status).toBe("NOT_INSTRUMENTED");
    expect(g.last).toBe(null);
    expect(g.medianMs).toBe(null);
    const r = auditHealth({ go_latency: { present: false } }, now);
    expect(r.goToAckStatus).toBe("NOT_INSTRUMENTED");
    expect(r.goToAckMs).toBe(null);
  });

  it("zdroj nečten (runs/ nečitelný) = NOT_MEASURED; prázdný snapshot nikdy 0", () => {
    const r = auditHealth({}, now);
    expect(r.goToAckStatus).toBe("NOT_MEASURED");
    expect(r.goToAckMs).toBe(null);
  });

  it("nečitelný soubor = UNKNOWN", () => {
    const g = projectGoLatency({ present: true, readable: false }, now);
    expect(g.status).toBe("UNKNOWN");
    expect(g.last).toBe(null);
  });

  it("prázdný soubor = NOT_INSTRUMENTED (žádné převzetí)", () => {
    const g = projectGoLatency(
      { present: true, readable: true, lines: [], bad_lines: 0 },
      now,
    );
    expect(g.status).toBe("NOT_INSTRUMENTED");
    expect(g.decisions).toBe(0);
  });

  it("změřené záznamy: poslední v pořadí zápisu, medián, max, od kdy", () => {
    const g = projectGoLatency(
      {
        present: true,
        readable: true,
        bad_lines: 0,
        lines: [
          {
            order: "wo-a",
            value: "GO",
            taken_at: ago(300),
            latency_ms: 30_000,
          },
          {
            order: "wo-b",
            value: "REJECT",
            taken_at: ago(200),
            latency_ms: 600_000,
          },
          {
            order: "wo-c",
            value: "GO A",
            taken_at: ago(100),
            latency_ms: 90_000,
          },
        ],
      },
      now,
    );
    expect(g.status).toBe("MEASURED");
    expect(g.last).toEqual({
      order: "wo-c",
      value: "GO A",
      at: ago(100),
      ms: 90_000,
    });
    expect(g.medianMs).toBe(90_000);
    expect(g.maxMs).toBe(600_000);
    expect(g.decisions).toBe(3);
    expect(g.since).toBe(ago(300));
    const r = auditHealth(
      {
        go_latency: {
          present: true,
          readable: true,
          bad_lines: 0,
          lines: [
            {
              order: "wo-c",
              value: "GO",
              taken_at: ago(10),
              latency_ms: 45_000,
            },
          ],
        },
      },
      now,
    );
    expect(r.goToAckMs).toBe(45_000);
    expect(r.goToAckStatus).toBe("MEASURED");
  });

  it("sudý počet: medián je průměr dvou prostředních", () => {
    const g = projectGoLatency(
      {
        present: true,
        readable: true,
        lines: [10, 20, 30, 40].map((ms, i) => ({
          order: `wo-${i}`,
          value: "GO",
          taken_at: ago(50 - i),
          latency_ms: ms * 1000,
        })),
      },
      now,
    );
    expect(g.medianMs).toBe(25_000);
  });

  it("latency_ms null (čas zápisu vlastníka chybí) se nepočítá jako 0; jen null = UNKNOWN", () => {
    const only = projectGoLatency(
      {
        present: true,
        readable: true,
        lines: [
          { order: "wo-a", value: "GO", taken_at: ago(5), latency_ms: null },
        ],
      },
      now,
    );
    expect(only.status).toBe("UNKNOWN");
    expect(only.unknownLatency).toBe(1);
    expect(only.medianMs).toBe(null);
    expect(only.last).toBe(null);
    const mixed = projectGoLatency(
      {
        present: true,
        readable: true,
        lines: [
          { order: "wo-a", value: "GO", taken_at: ago(9), latency_ms: 60_000 },
          { order: "wo-b", value: "GO", taken_at: ago(5), latency_ms: null },
        ],
      },
      now,
    );
    expect(mixed.status).toBe("MEASURED");
    expect(mixed.medianMs).toBe(60_000); // null nestáhne medián k 0
    expect(mixed.last?.order).toBe("wo-a");
    expect(mixed.unknownLatency).toBe(1);
    expect(mixed.decisions).toBe(2);
  });

  it("záporná latence, chybějící čas, ne-číslo a poškozené řádky = neplatné; budoucí ignorovány", () => {
    const g = projectGoLatency(
      {
        present: true,
        readable: true,
        bad_lines: 2,
        lines: [
          { order: "wo-a", value: "GO", taken_at: ago(9), latency_ms: -5_000 },
          { order: "wo-b", value: "GO", latency_ms: 5_000 },
          { order: "wo-c", value: "GO", taken_at: ago(7) },
          { order: "wo-d", value: "GO", taken_at: ago(-10), latency_ms: 1_000 },
        ],
      },
      now,
    );
    expect(g.status).toBe("UNKNOWN");
    expect(g.invalid).toBe(5);
    expect(g.futureIgnored).toBe(1);
    expect(g.decisions).toBe(0);
  });

  it("neplatné id a neznámá hodnota rozhodnutí ven nejdou; CANARY se neobjeví", () => {
    const g = projectGoLatency(
      {
        present: true,
        readable: true,
        lines: [
          {
            order: "../CANARY_DO_NOT_ECHO",
            value: "CANARY",
            taken_at: ago(3),
            latency_ms: 1_000,
          },
        ],
      },
      now,
    );
    expect(g.last).toMatchObject({ order: "<neplatné id>", value: "?" });
    expect(JSON.stringify(g)).not.toContain("CANARY");
  });

  it("latence nemění overall (žádná blokace, žádný PASS)", () => {
    const base = auditHealth({}, now).overall;
    const r = auditHealth(
      {
        go_latency: {
          present: true,
          readable: true,
          lines: [
            { order: "wo-a", value: "GO", taken_at: ago(1), latency_ms: 1 },
          ],
        },
      },
      now,
    );
    expect(r.overall).toBe(base);
    const u = auditHealth(
      { go_latency: { present: true, readable: false } },
      now,
    );
    expect(u.overall).toBe(base);
  });

  it("výpis: změřeno / NOT INSTRUMENTED / UNKNOWN, nikdy „0 s“ z chybějících dat", () => {
    const m = auditHealth(
      {
        go_latency: {
          present: true,
          readable: true,
          lines: [
            {
              order: "wo-a",
              value: "GO",
              taken_at: ago(30),
              latency_ms: 42_000,
            },
          ],
        },
      },
      now,
    );
    expect(formatHealth(m)).toMatch(
      /GO→převzetí \(runs\/idle\/go-latency\.jsonl\): poslední 42 s \(wo-a GO, /,
    );
    expect(formatHealthCompact(m, now)).toMatch(/GO→převzetí 42 s/);
    const n = auditHealth({ go_latency: { present: false } }, now);
    expect(formatHealth(n)).toMatch(/GO→převzetí .*: NOT INSTRUMENTED/);
    expect(formatHealthCompact(n, now)).toMatch(/GO→převzetí NOT INSTRUMENTED/);
    const u = auditHealth(
      {
        go_latency: {
          present: true,
          readable: true,
          lines: [
            { order: "wo-a", value: "GO", taken_at: ago(30), latency_ms: null },
          ],
        },
      },
      now,
    );
    expect(formatHealth(u)).toMatch(/GO→převzetí .*: UNKNOWN/);
    expect(formatHealthCompact(u, now)).toMatch(/GO→převzetí UNKNOWN/);
    expect(formatHealthCompact(u, now)).not.toMatch(/GO→převzetí 0/);
    expect(formatHealthCompact(m, now).length).toBeLessThanOrEqual(600);
  });
});

describe("health-go: sběr z disku (jen čtení)", () => {
  it("soubor zapsaný skutečným zapisovačem (IdleRecorder.goLatency) se promítne", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(runs);
    const rec = new IdleRecorder(runs);
    rec.goLatency({
      order: "wo-x",
      value: "GO",
      owner_written_at: "2026-11-06T11:58:00.000Z",
      taken_at: "2026-11-06T12:00:00.000Z",
    });
    rec.goLatency({ order: "wo-y", value: "REJECT", taken_at: ago(0) });
    const snap = collectSnapshot(runs, {
      now: () => new Date(now),
      launchd: null,
      probe: null,
    });
    const r = auditHealth(snap, now);
    expect(r.goToAck).toMatchObject({
      status: "MEASURED",
      decisions: 2,
      measured: 1,
      unknownLatency: 1,
      last: { order: "wo-x", value: "GO", ms: 120_000 },
    });
    expect(r.goToAckMs).toBe(120_000);
  });

  it("chybějící soubor = present false; runs/idle se nevytvoří", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(runs);
    expect(collectGoLatency(runs)).toEqual({ present: false });
    expect(fs.readdirSync(runs)).toEqual([]);
    const r = auditHealth(
      collectSnapshot(runs, { launchd: null, probe: null }),
      now,
    );
    expect(r.goToAckStatus).toBe("NOT_INSTRUMENTED");
  });

  it("poškozené řádky se počítají, platné se čtou; mtime beze změny", () => {
    const runs = path.join(dir, "runs");
    writeLatency(runs, [
      "{broken",
      "[1,2]",
      line({ order: "wo-a", value: "GO", taken_at: ago(5), latency_ms: 7_000 }),
    ]);
    const before = mtimes(runs);
    const s = collectGoLatency(runs);
    expect(s).toMatchObject({ present: true, readable: true, bad_lines: 2 });
    expect(s.lines).toHaveLength(1);
    const r = auditHealth(
      collectSnapshot(runs, {
        now: () => new Date(now),
        launchd: null,
        probe: null,
      }),
      now,
    );
    expect(r.goToAck.status).toBe("MEASURED");
    expect(r.goToAck.invalid).toBe(2);
    expect(mtimes(runs)).toEqual(before);
  });

  it("soubor, který nejde přečíst (adresář místo souboru) = UNKNOWN", () => {
    const runs = path.join(dir, "runs");
    fs.mkdirSync(path.join(runs, "idle", "go-latency.jsonl"), {
      recursive: true,
    });
    expect(collectGoLatency(runs)).toEqual({ present: true, readable: false });
  });
});
