// Etapa 4 PR 1, FIX2 (Codex kolo 2, otevřený zbytek nálezu 3): parser posuzuje CELÝ zbytek řádku za časem,
// ne jen bezprostřední token po oddělovači. Zóna, datum, rok, den v týdnu nebo „on/at/tomorrow“ za časem = nedoloženo.
import { describe, expect, it } from "vitest";

import { parseReset } from "../reset";

const PRAGUE = "Europe/Prague";
// received_at z nálezu review-out-2
const RECEIVED = "2026-11-04T13:58:00Z";

function ok(r: ReturnType<typeof parseReset>) {
  if (!r.ok)
    throw new Error(`čekal jsem doložený reset, dostal jsem: ${r.reason}`);
  return r;
}
function nedolozeno(r: ReturnType<typeof parseReset>) {
  if (r.ok)
    throw new Error(
      `čekal jsem nedoloženo, dostal jsem ${r.at_utc} (${r.matched})`,
    );
  expect(r.source).toBe("nedoloženo");
  return r;
}

const SEPARATORS = [
  " — ",
  " – ",
  " - ",
  ", ",
  "; ",
  " (",
  " ... ",
  "... ",
  ". ",
  " | ",
  " · ",
  ": ",
  " / ",
];

describe("FIX2: datum za oddělovačem se nezahodí", () => {
  it("příklad z nálezu: „resets at 15:00 CET — on Nov 20, 2026“ → nedoloženo (ne 2026-11-04T14:00Z)", () => {
    const r = nedolozeno(
      parseReset(
        "Usage limit reached; resets at 15:00 CET — on Nov 20, 2026",
        RECEIVED,
        PRAGUE,
      ),
    );
    expect(r.reason).toMatch(/nerozpoznaný zbytek/);
  });

  it.each(SEPARATORS)(
    "oddělovač %j + „on Nov 20, 2026“ → nedoloženo",
    (sep) => {
      const close = sep.trim() === "(" ? ")" : "";
      nedolozeno(
        parseReset(
          `Usage limit reached; resets at 15:00 CET${sep}on Nov 20, 2026${close}`,
          RECEIVED,
          PRAGUE,
        ),
      );
      nedolozeno(
        parseReset(`resets at 3pm${sep}Nov 20${close}`, RECEIVED, PRAGUE),
      );
      nedolozeno(
        parseReset(
          `try again in 2 hours${sep}on Nov 20${close}`,
          RECEIVED,
          PRAGUE,
        ),
      );
    },
  );

  it("rok, den v týdnu, tomorrow, at/on, ISO datum za oddělovačem → nedoloženo", () => {
    for (const tail of [
      " — 2026",
      ", tomorrow",
      " (tomorrow)",
      " — Friday",
      "; Fri",
      " — on Friday",
      ", at noon",
      " ... next week",
      " — 2026-11-20",
      " (20.11.)",
      ", 20 Nov",
      " today",
      " local time",
    ]) {
      nedolozeno(parseReset(`resets at 15:00 CET${tail}`, RECEIVED, PRAGUE));
    }
  });

  it("80znakové okno neschová datum: dlouhá výplň před „on Nov 20“ → nedoloženo", () => {
    nedolozeno(
      parseReset(
        `resets at 15:00 CET${" ".repeat(100)}— on Nov 20, 2026`,
        RECEIVED,
        PRAGUE,
      ),
    );
    nedolozeno(
      parseReset(
        `resets at 15:00 CET ${"— ".repeat(60)}on Nov 20`,
        RECEIVED,
        PRAGUE,
      ),
    );
  });
});

describe("FIX2: zóna za oddělovačem se nezahodí", () => {
  it("příklad z nálezu: „resets at 3pm — PST“ → nedoloženo (ne pražský čas)", () => {
    nedolozeno(parseReset("resets at 3pm — PST", RECEIVED, PRAGUE));
  });

  it.each(SEPARATORS)("oddělovač %j + zóna → nedoloženo", (sep) => {
    const close = sep.trim() === "(" ? ")" : "";
    for (const zone of [
      "PST",
      "PT",
      "EST",
      "Pacific Time",
      "America/Los_Angeles",
      "UTC",
      "+01:00",
    ]) {
      const r = parseReset(
        `resets at 3pm${sep}${zone}${close}`,
        RECEIVED,
        PRAGUE,
      );
      // „3pm (UTC)“, „3pm (+01:00)“, „3pm (America/Los_Angeles)“ jsou zóny v závorce, které parser zpracuje správně:
      // pak musí platit zóna z textu, nikdy výchozí Praha (14:00Z).
      if (r.ok) {
        expect(close).toBe(")");
        expect(r.raw_zone).toBe(zone);
        expect(r.at_utc).toBe(
          {
            UTC: "2026-11-04T15:00:00.000Z",
            "+01:00": "2026-11-04T14:00:00.000Z",
            "America/Los_Angeles": "2026-11-04T23:00:00.000Z",
          }[zone],
        );
      } else nedolozeno(r);
    }
  });

  it("zóna za zónou nebo za ISO → nedoloženo", () => {
    nedolozeno(
      parseReset("resets at 15:00 CET (Europe/Prague)", RECEIVED, PRAGUE),
    );
    nedolozeno(
      parseReset("resets at 2026-11-04T16:00:00Z — PST", RECEIVED, PRAGUE),
    );
    nedolozeno(
      parseReset("resets at 2026-11-04T16:00:00Z, on Nov 20", RECEIVED, PRAGUE),
    );
  });

  it("epoch: zbytek za epochou se posuzuje stejně", () => {
    const epoch = Date.parse("2026-11-04T15:00:00Z") / 1000;
    nedolozeno(parseReset(`retry at ${epoch} — on Nov 20`, RECEIVED, PRAGUE));
    expect(ok(parseReset(`retry at ${epoch}.`, RECEIVED, PRAGUE)).at_utc).toBe(
      "2026-11-04T15:00:00.000Z",
    );
  });
});

describe("FIX2: fail-closed při více výskytech", () => {
  it("doložený čas a vedle nedoložený výskyt → nedoloženo", () => {
    nedolozeno(
      parseReset("resets at 3pm PST\ntry again in 2 hours", RECEIVED, PRAGUE),
    );
  });

  it("dva různé doložené časy → nedoloženo", () => {
    const r = nedolozeno(
      parseReset("resets in 2 hours\ntry again in 3 hours", RECEIVED, PRAGUE),
    );
    expect(r.reason).toMatch(/rozporné/);
  });

  it("dva shodné doložené časy → doloženo", () => {
    expect(
      ok(parseReset("resets at 15:00 CET\nTry again at 3pm.", RECEIVED, PRAGUE))
        .at_utc,
    ).toBe("2026-11-04T14:00:00.000Z");
  });
});

describe("FIX2: regrese pozitivních tvarů", () => {
  it("konec textu, konec věty, interpunkce a neutrální slova zůstávají doložené", () => {
    const at = (t: string) => ok(parseReset(t, RECEIVED, PRAGUE)).at_utc;
    expect(at("resets at 15:00 CET")).toBe("2026-11-04T14:00:00.000Z");
    expect(at("Usage limit reached; resets at 15:00 CET.")).toBe(
      "2026-11-04T14:00:00.000Z",
    );
    expect(at("resets at 3pm (Europe/Prague)")).toBe(
      "2026-11-04T14:00:00.000Z",
    );
    expect(at("5-hour limit reached ∙ resets 3pm (Europe/Prague)")).toBe(
      "2026-11-04T14:00:00.000Z",
    );
    expect(at("resets at 3pm...")).toBe("2026-11-04T14:00:00.000Z");
    expect(at("resets at 3pm — ")).toBe("2026-11-04T14:00:00.000Z");
    expect(at("resets at 3pm!")).toBe("2026-11-04T14:00:00.000Z");
    expect(at("Try again at 5:13 PM or upgrade.")).toBe(
      "2026-11-04T16:13:00.000Z",
    );
    expect(
      at("Try again at 5:13 PM — or upgrade your plan for more usage."),
    ).toBe("2026-11-04T16:13:00.000Z");
    expect(at("limit · resets 3pm · /upgrade")).toBe(
      "2026-11-04T14:00:00.000Z",
    );
    expect(at('{"resetsAt":"2026-11-04T16:00:00Z"}')).toBe(
      "2026-11-04T16:00:00.000Z",
    );
    expect(at('{"error":"rate_limit","resetsAt":"2026-11-04T16:00:00Z"}')).toBe(
      "2026-11-04T16:00:00.000Z",
    );
    expect(at("try again in 20 minutes, please")).toBe(
      "2026-11-04T14:18:00.000Z",
    );
    expect(
      at("You've hit your usage limit. Try again in 2 hours 13 minutes."),
    ).toBe("2026-11-04T16:11:00.000Z");
    expect(at("resets at 15:00 CET\nnext line: on Nov 20, 2026")).toBe(
      "2026-11-04T14:00:00.000Z",
    );
    expect(at("resets Nov 6, 2026 at 15:00 CET")).toBe(
      "2026-11-06T14:00:00.000Z",
    );
  });

  it("tečka za „pm“ je konec věty (zbytek se posoudí), „p.m.“ je zkratka", () => {
    nedolozeno(parseReset("resets at 3pm. UTC", RECEIVED, PRAGUE));
    nedolozeno(parseReset("resets at 3pm. PST", RECEIVED, PRAGUE));
    expect(
      ok(parseReset("resets at 3 p.m. UTC", RECEIVED, PRAGUE)).at_utc,
    ).toBe("2026-11-04T15:00:00.000Z");
    expect(ok(parseReset("resets at 3 p.m.", RECEIVED, PRAGUE)).at_utc).toBe(
      "2026-11-04T14:00:00.000Z",
    );
    expect(ok(parseReset("resets at 3pm.", RECEIVED, PRAGUE)).at_utc).toBe(
      "2026-11-04T14:00:00.000Z",
    );
  });
});
