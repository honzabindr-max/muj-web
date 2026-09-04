import { describe, expect, it } from "vitest";

import { parseBuddyResponseOutput } from "../parse-model-output";

const VALID_OBJECT_TEXT = '{"responseText": "ahoj", "stance": "BE_WITH", "intent": ["SHARE"]}';

/**
 * parseBuddyResponseOutput() — tolerantní parser (Honzíkovo rozhodnutí
 * 2026-09-04, odložená BUILD-11 otázka "repair retry vs. tolerantní
 * parser"): certifikace opakovaně (3 z 5 běhů) ukázala Sonnet psát prózu
 * PŘED jinak validním JSON objektem u tématu "posuzování třetí osoby".
 * Extrakce je deterministická a zdarma, retry by bylo další zaplacené
 * volání se stejnou tendencí modelu — proto extrakce, ne retry.
 *
 * Certifikační skript musí volat TENHLE modul (Honzíkovo explicitní
 * zadání) — jediná parse cesta pro produkci i certifikaci.
 */
describe("parseBuddyResponseOutput()", () => {
  it("čistý JSON bez extrakce → success, extractionUsed: false", () => {
    const result = parseBuddyResponseOutput(VALID_OBJECT_TEXT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responseText).toBe("ahoj");
      expect(result.extractionUsed).toBe(false);
    }
  });

  it("čistý JSON s obklopujícím whitespace → success bez extrakce (jen trim, ne extrakce)", () => {
    const result = parseBuddyResponseOutput(`\n  ${VALID_OBJECT_TEXT}  \n`);
    expect(result.success).toBe(true);
    if (result.success) expect(result.extractionUsed).toBe(false);
  });

  it("reálný pozorovaný případ (round 1/3/5 certifikace): próza PŘED JSON → extrakce uspěje, extractionUsed: true", () => {
    const rawText = `Z jedné epizody ti tohle neřeknu — dneska byla naštvaná kvůli zpoždění.\n\nCo tě k tý otázce vedlo?\n\n${VALID_OBJECT_TEXT}`;
    const result = parseBuddyResponseOutput(rawText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responseText).toBe("ahoj");
      expect(result.extractionUsed).toBe(true);
    }
  });

  it("próza PO JSON → extrakce funguje stejně (jeden kandidát, kdekoliv v textu)", () => {
    const result = parseBuddyResponseOutput(`${VALID_OBJECT_TEXT}\n\nDoufám, že to pomůže.`);
    expect(result.success).toBe(true);
    if (result.success) expect(result.extractionUsed).toBe(true);
  });

  it("markdown code fence kolem JSONu → extrakce ho najde (backticky nekolidují se scanem)", () => {
    const result = parseBuddyResponseOutput("```json\n" + VALID_OBJECT_TEXT + "\n```");
    expect(result.success).toBe(true);
    if (result.success) expect(result.extractionUsed).toBe(true);
  });

  it("dva různé top-level JSON objekty → neplatný výstup (nehádá, který je ten pravý)", () => {
    const result = parseBuddyResponseOutput(`${VALID_OBJECT_TEXT}\n\n{"responseText": "jiná odpověď", "stance": "ACT", "intent": ["TASK"]}`);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorSummary).toContain("2");
  });

  it("žádný JSON objekt v textu → neplatný výstup", () => {
    const result = parseBuddyResponseOutput("Nevím, co na to říct.");
    expect(result.success).toBe(false);
  });

  it("zdánlivě jeden objekt, ale nekompletní (chybí uzavírací závorka) → neplatný výstup, nula kandidátů", () => {
    const result = parseBuddyResponseOutput('{"responseText": "ahoj", "stance": "BE_WITH", "intent": ["SHARE"]');
    expect(result.success).toBe(false);
  });

  it("vnořené závorky uvnitř JEDNOHO objektu se nepočítají jako druhý kandidát", () => {
    // intent je pole, ne objekt, ale ověřujeme obecnou robustnost scanu vůči
    // znakům '{'/'}' UVNITŘ stringové hodnoty (např. Buddy cituje kód/JSON).
    const withBracesInString = '{"responseText": "vzorec vypadá takto: {x: 1}", "stance": "BE_WITH", "intent": ["SHARE"]}';
    const result = parseBuddyResponseOutput(`Tady to je:\n\n${withBracesInString}`);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responseText).toContain("{x: 1}");
      expect(result.extractionUsed).toBe(true);
    }
  });

  it("extrahovaný kandidát je syntakticky JSON, ale neprojde schema validací → neplatný výstup, extractionUsed: true", () => {
    const rawText = `Tak fajn:\n\n{"responseText": "ahoj", "stance": "NEEXISTUJICI_STANCE", "intent": ["SHARE"]}`;
    const result = parseBuddyResponseOutput(rawText);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.extractionUsed).toBe(true);
  });

  it("prázdné pole intent i po extrakci pořád spadne na AT-50 validaci (min 1 hodnota)", () => {
    const rawText = `Tak fajn:\n\n{"responseText": "ahoj", "stance": "BE_WITH", "intent": []}`;
    const result = parseBuddyResponseOutput(rawText);
    expect(result.success).toBe(false);
  });
});
