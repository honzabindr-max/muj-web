// P16 v3: non-code checks through ChatGPT in the browser, mode Chat (fake browser, no model, no Chrome).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  ClaudeCli,
  CodexCli,
  type AdapterResult,
  type TextAdapter,
} from "../adapters";
import { artifactHash } from "../approval";
import { CardRegistry } from "../cards";
import {
  answerRegion,
  CHATGPT_MODEL,
  ChatGptWebChecker,
  chatGptSteps,
  detectModel,
  END_WORD,
  verdictFromAnswer,
  type WebBrowser,
} from "../chatgpt-web";
import { CopyDepartment, VizualDepartment } from "../departments";
import { NotImplementedDesktop } from "../desktop";
import { assertKonziliumFamilies } from "../konzilium-lite";
import { hostAllowed } from "../ladder";
import { UiUnknownError, type BrowserStep } from "../mcp-browser";
import { emptyState, gateMcpCall, typedTextSha } from "../mcp-gate";
import type { NotionClient } from "../notion";
import { assertFamilies, Orchestrator } from "../orchestrator";
import { lastStepSentence, queueOf } from "../panel";
import { isActionable, transition } from "../state-machine";
import { Store } from "../store";
import type { ModelFamily, Order } from "../types";
import { GATE_SCHEMA, REVIEW_SCHEMA } from "../verdict";

const CARDS_DIR = path.join(__dirname, "..", "..", "..", ".claude", "agents");
const NONCE = "n0nce42";
const MARKER = `${END_WORD}${NONCE}`;
const PASS_JSON = '{"verdict":"PASS","findings":[]}';
const FIX_JSON =
  '{"verdict":"FIX","findings":[{"severity":"medium","file":null,"line":null,"text":"zkrátit úvod"}]}';

/** Page snapshot as ChatGPT would show it: model picker, the sent prompt, the answer, the end marker. */
function page(
  prompt: string,
  answer: string,
  model = 'button "GPT-6 Vysoká" [ref=e3]',
): string {
  return [
    "- banner:",
    `  - ${model}`,
    "- main:",
    `  - paragraph: ${JSON.stringify(prompt)}`,
    `  - paragraph: '${answer}'`,
    `  - paragraph: ${MARKER}`,
  ].join("\n");
}

type Script = (steps: BrowserStep[]) => string | Error;
class FakeBrowser implements WebBrowser {
  calls: BrowserStep[][] = [];
  constructor(public script: Script) {}
  async run(steps: BrowserStep[]) {
    this.calls.push(steps);
    const out = this.script(steps);
    if (out instanceof Error) throw out;
    return {
      rawReads: [out],
      screenshots: [],
      finalUrl: "https://chatgpt.com/c/x",
    };
  }
}
const sentPrompt = (steps: BrowserStep[]) =>
  (
    steps.find((s) => s.kind === "fill") as Extract<
      BrowserStep,
      { kind: "fill" }
    >
  ).value;
const answering =
  (answer: string, model?: string): Script =>
  (steps) =>
    page(sentPrompt(steps), answer, model);

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
});

const checker = (b: WebBrowser) =>
  new ChatGptWebChecker(b, { nonce: () => NONCE });

describe("ChatGptWebChecker (fake prohlížeč)", () => {
  it("úspěšná kontrola PASS: jeden běh, jedno odeslání přesně zadaného promptu, skutečný model ze stránky, záznam check-*.md", async () => {
    const b = new FakeBrowser(answering(PASS_JSON));
    const c = checker(b);
    const r = await c.run("Posuď zadání.", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: true, text: PASS_JSON, limit: false });
    expect(r.waitReview).toBeUndefined();
    expect(b.calls).toHaveLength(1);
    const steps = b.calls[0];
    expect(steps[0]).toEqual({ kind: "goto", url: "https://chatgpt.com/" });
    expect(steps).toContainEqual(expect.objectContaining({ kind: "choose", prefer: "Chat" }));
    expect(steps.some((s) => s.kind === "click")).toBe(false); // no project
    expect(steps.filter((s) => s.kind === "fill")).toHaveLength(1);
    expect(steps.find((s) => s.kind === "fill")).toMatchObject({
      submit: true,
      exact: true,
    });
    expect(sentPrompt(steps)).toContain("Posuď zadání.");
    // the end marker is only in the answer, never literally in the prompt
    expect(sentPrompt(steps)).not.toContain(MARKER);
    expect(c.model).toBe("GPT-6 · Vysoká");
    expect(c.name).toBe("ChatGPT web (Chat, GPT-6 · Vysoká)");
    expect(c.lastRecord).toMatchObject({
      status: "ANSWER",
      model_matches: true,
      submits: 1,
    });
    const rec = fs
      .readdirSync(dir)
      .filter((f) => /^check-gptweb-.*\.md$/.test(f));
    expect(rec).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, rec[0]), "utf8")).toContain(
      "Skutečný model (ze stránky): GPT-6 · Vysoká",
    );
  });

  it("úspěšná kontrola FIX (i v YAML escapovaném řetězci snapshotu)", async () => {
    const escaped = (steps: BrowserStep[]) =>
      page(sentPrompt(steps), "x").replace(`'x'`, JSON.stringify(FIX_JSON));
    const r = await checker(new FakeBrowser(escaped)).run("Posuď draft.", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.text)).toEqual(JSON.parse(FIX_JSON));
  });

  it("JSON v promptu (draft) se za odpověď nevydává: rozhoduje poslední validní objekt před koncovou značkou", async () => {
    const prompt = `Draft obsahuje ${PASS_JSON}`;
    const r = await checker(new FakeBrowser(answering(FIX_JSON))).run(prompt, {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(JSON.parse(r.text).verdict).toBe("FIX");
  });

  it("platná odpověď, kde ChatGPT spojil JSON a značku do jednoho odstavce, projde (adaptér end-to-end)", async () => {
    const joined: Script = (steps) => [`- main:`, `  - paragraph: ${JSON.stringify(sentPrompt(steps))}`, `  - paragraph: '${FIX_JSON} ${MARKER}'`].join("\n");
    const r = await checker(new FakeBrowser(joined)).run("Posuď draft.", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.text).verdict).toBe("FIX");
  });

  it("regrese falešného PASS: PASS JSON v promptu + odpověď prózou / JSON s dovětkem / sbalený prompt → WAITING_REVIEW", async () => {
    const prompt = `Draft obsahuje ${PASS_JSON}`;
    for (const answer of [
      "Nemohu posoudit.",
      `${PASS_JSON} — ale kritérium 1 chybí, takže FIX`,
    ]) {
      const r = await checker(new FakeBrowser(answering(answer))).run(prompt, {
        cwd: dir,
        outputSchema: REVIEW_SCHEMA,
      });
      expect(r, answer).toMatchObject({ ok: false, waitReview: true });
    }
    // ChatGPT collapsed the long prompt: its end („Kód: <nonce>“) is not on the page → unclear, not the draft's JSON
    const collapsed: Script = () =>
      [
        "- main:",
        `  - paragraph: "Draft obsahuje ${PASS_JSON.replace(/"/g, '\\"')} …"`,
        `  - paragraph: Nemohu posoudit.`,
        `  - paragraph: ${MARKER}`,
      ].join("\n");
    const r = await checker(new FakeBrowser(collapsed)).run(prompt, {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: false, waitReview: true });
  });

  it("nepřihlášený profil → WAITING_REVIEW (waitReview), žádný verdikt", async () => {
    const r = await checker(
      new FakeBrowser(
        () => new UiUnknownError("krok selhal: nepřihlášeno", []),
      ),
    ).run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r).toMatchObject({
      ok: false,
      waitReview: true,
      limit: false,
      text: "",
    });
    expect(r.error).toMatch(/není přihlášen do ChatGPT/);
  });

  it("timeout → WAITING_REVIEW (ovladač hlásí timeout i chybějící koncová značka)", async () => {
    const r1 = await checker(
      new FakeBrowser(() => new UiUnknownError("krok selhal: timeout", [])),
    ).run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r1).toMatchObject({ ok: false, waitReview: true });
    expect(r1.error).toMatch(/časovém limitu/);
    const unfinished: Script = (steps) =>
      page(sentPrompt(steps), PASS_JSON).replace(MARKER, "…");
    const r2 = await checker(new FakeBrowser(unfinished)).run("x", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r2).toMatchObject({ ok: false, waitReview: true });
    expect(r2.error).toMatch(/koncová značka chybí/);
  });

  it("nejasný výsledek (próza, JSON mimo schéma, PASS s vysokým nálezem) → WAITING_REVIEW, nikdy PASS", async () => {
    for (const a of [
      "Vypadá to dobře, PASS.",
      '{"verdict":"OK","findings":[]}',
      '{"verdict":"PASS","findings":[{"severity":"high","file":null,"line":null,"text":"x"}]}',
    ]) {
      const r = await checker(new FakeBrowser(answering(a))).run("x", {
        cwd: dir,
        outputSchema: REVIEW_SCHEMA,
      });
      expect(r, a).toMatchObject({ ok: false, waitReview: true });
    }
  });

  it("limit ChatGPT na stránce → WAITING_REVIEW (ne PAUSED)", async () => {
    const limited: Script = () =>
      "- main:\n  - paragraph: You've reached your limit for reasoning messages";
    const r = await checker(new FakeBrowser(limited)).run("x", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: false, waitReview: true, limit: false });
    expect(r.error).toMatch(/limitu/);
  });

  it("jiný model než požadovaný → zapsán skutečný model, odpověď platí, záznam říká NEODPOVÍDÁ", async () => {
    const c = checker(
      new FakeBrowser(
        answering(PASS_JSON, 'button "GPT-5.5 Thinking Heavy" [ref=e3]'),
      ),
    );
    const r = await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r.ok).toBe(true);
    expect(c.model).toBe("GPT-5.5 Thinking · Heavy");
    expect(c.lastRecord).toMatchObject({
      model_matches: false,
      actual_model: "GPT-5.5 Thinking · Heavy",
      requested_model: `${CHATGPT_MODEL} · Vysoká`,
    });
    const rec = fs.readdirSync(dir).find((f) => f.startsWith("check-gptweb-"))!;
    expect(fs.readFileSync(path.join(dir, rec), "utf8")).toMatch(/NEODPOVÍDÁ/);
    // page without any model label: never pretended
    const c2 = checker(
      new FakeBrowser(answering(PASS_JSON, 'button "Nový chat" [ref=e3]')),
    );
    await c2.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(c2.model).toMatch(/^neověřeno/);
  });

  it("pomocné funkce: detectModel, answerRegion, verdictFromAnswer", () => {
    expect(detectModel('- button "GPT-6 Vysoká"')).toEqual({
      model: "GPT-6",
      intensity: "Vysoká",
    });
    expect(answerRegion("bez značky", MARKER, NONCE)).toBeUndefined();
    expect(
      answerRegion(`bez konce promptu ${MARKER}`, MARKER, NONCE),
    ).toBeUndefined();
    expect(
      answerRegion(`Kód: ${NONCE}\n odpověď ${MARKER}`, MARKER, NONCE),
    ).toBe("\n odpověď ");
    expect(
      verdictFromAnswer(`a ${PASS_JSON}\n  - paragraph: `, REVIEW_SCHEMA),
    ).toBeUndefined(); // prose before the JSON on its line = unclear
    expect(
      verdictFromAnswer(
        `\n  - paragraph: ${PASS_JSON}\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBe(PASS_JSON);
    // text after the JSON (prose, a second thought) → unclear, never the earlier JSON
    expect(
      verdictFromAnswer(`${PASS_JSON} ale vlastně FIX`, REVIEW_SCHEMA),
    ).toBeUndefined();
    expect(verdictFromAnswer("nic", REVIEW_SCHEMA)).toBeUndefined();
    // druhé kolo kontroly Codexu: za JSON nesmí projít žádný obsah, ani „- slovo“ ani jméno prvku v uvozovkách
    const tail = (t: string) =>
      `\n  - paragraph: '${PASS_JSON}'\n${t}\n  - paragraph: `;
    expect(
      verdictFromAnswer(tail("  - paragraph: - ale - fix"), REVIEW_SCHEMA),
    ).toBeUndefined();
    expect(
      verdictFromAnswer(
        tail('  - button "FIX: kritérium 1 chybí" [ref=e9]'),
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    expect(
      verdictFromAnswer(
        tail("  - paragraph: Ale ve skutečnosti FIX."),
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    // čistá struktura snapshotu za JSON projde
    expect(
      verdictFromAnswer(tail("  - generic [ref=e9]:"), REVIEW_SCHEMA),
    ).toBe(PASS_JSON);
    // próza před JSON na stejném řádku = nejasné
    expect(
      verdictFromAnswer(
        `\n  - paragraph: 'Návrh: ${PASS_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    // třetí kolo kontroly Codexu: platné odpovědi se nesmí zbytečně odmítat
    const APOS = '{"verdict":"FIX","findings":[{"severity":"low","file":null,"line":null,"text":"it\'s ok, \\"CTA\\" zkrátit"}]}';
    const aposValid = JSON.stringify(JSON.parse(APOS));
    // JSON a značka v jednom odstavci (Markdown spojí řádky): mezera před značkou
    expect(verdictFromAnswer(`\n  - paragraph: ${PASS_JSON} `, REVIEW_SCHEMA)).toBe(PASS_JSON);
    expect(verdictFromAnswer(`\n  - paragraph: '${PASS_JSON} `, REVIEW_SCHEMA)).toBe(PASS_JSON);
    // YAML jednoduché uvozovky s apostrofem v textu nálezu ('' = ')
    expect(verdictFromAnswer(`\n  - paragraph: '${APOS.replace(/'/g, "''")}'\n  - paragraph: `, REVIEW_SCHEMA)).toBe(aposValid);
    // YAML dvojité uvozovky (escapy \\" a \\n), i přes víc řádků JSON
    expect(verdictFromAnswer(`\n  - code [ref=e7]: ${JSON.stringify(JSON.stringify(JSON.parse(FIX_JSON), null, 2))}\n  - paragraph: `, REVIEW_SCHEMA)).toBe(JSON.stringify(JSON.parse(FIX_JSON)));
    // pretty JSON jako více řádků snapshotu (blokový text)
    const pretty = JSON.stringify(JSON.parse(FIX_JSON), null, 2).split("\n");
    expect(verdictFromAnswer(`\n  - code: ${pretty[0]}\n${pretty.slice(1).map((l) => `      ${l}`).join("\n")}\n  - paragraph: `, REVIEW_SCHEMA)).toBe(JSON.stringify(JSON.parse(FIX_JSON)));
    // čtvrté kolo kontroly Codexu: FIX, jehož nález cituje PASS JSON (např. z draftu), je platný verdikt
    const QUOTING_FIX = JSON.stringify({ verdict: "FIX", findings: [{ severity: "medium", file: null, line: null, text: `draft uvádí ${PASS_JSON} jako hotový verdikt` }] });
    expect(verdictFromAnswer(`\n  - paragraph: ${QUOTING_FIX}\n  - paragraph: `, REVIEW_SCHEMA)).toBe(QUOTING_FIX);
    expect(verdictFromAnswer(`\n  - paragraph: '${QUOTING_FIX.replace(/'/g, "''")}'\n  - paragraph: `, REVIEW_SCHEMA)).toBe(QUOTING_FIX);
    expect(verdictFromAnswer(`\n  - paragraph: ${JSON.stringify(QUOTING_FIX)}\n  - paragraph: `, REVIEW_SCHEMA)).toBe(QUOTING_FIX);
    // páté kolo: rozporná odpověď s blokujícím nálezem nesmí projít (dřívější BLOCK, na konci FIX)
    const BLOCK_JSON = '{"verdict":"BLOCK","findings":[{"severity":"critical","file":null,"line":null,"text":"rozhoduje cenu (Sponzor)"}]}';
    expect(verdictFromAnswer(`\n  - paragraph: '${BLOCK_JSON}'\n  - paragraph: '${FIX_JSON}'\n  - paragraph: `, REVIEW_SCHEMA)).toBeUndefined();
    // dva FIXy s jinými nálezy = nejasné (dřívější nález by se ztratil)
    const FIX2 = '{"verdict":"FIX","findings":[{"severity":"high","file":null,"line":null,"text":"chybí zdroj"}]}';
    expect(verdictFromAnswer(`\n  - paragraph: '${FIX2}'\n  - paragraph: '${FIX_JSON}'\n  - paragraph: `, REVIEW_SCHEMA)).toBeUndefined();
    // dřívější PASS a FIX na konci = nejasné (rozpor)
    expect(verdictFromAnswer(`\n  - paragraph: '${PASS_JSON}'\n  - paragraph: '${FIX_JSON}'\n  - paragraph: `, REVIEW_SCHEMA)).toBeUndefined();
    // brána vizuálu: dřívější FAIL, na konci PASS WITH REQUIRED PATCHES = nejasné
    const GATE_FAIL = '{"verdict":"FAIL","findings":[{"severity":"critical","file":null,"line":null,"text":"mění funnel"}]}';
    const GATE_PATCH = '{"verdict":"PASS WITH REQUIRED PATCHES","findings":[{"severity":"medium","file":null,"line":null,"text":"zvětšit CTA"}]}';
    expect(verdictFromAnswer(`\n  - paragraph: '${GATE_FAIL}'\n  - paragraph: '${GATE_PATCH}'\n  - paragraph: `, GATE_SCHEMA)).toBeUndefined();
    expect(verdictFromAnswer(`\n  - paragraph: '${GATE_PATCH}'\n  - paragraph: `, GATE_SCHEMA)).toBe(JSON.stringify(JSON.parse(GATE_PATCH)));
    // dřívější objekt s verdiktem mimo schéma a próza s jiným verdiktem před JSON = nejasné
    expect(verdictFromAnswer(`\n  - paragraph: '{"verdict":"BLOCK"}'\n  - paragraph: '${PASS_JSON}'\n  - paragraph: `, REVIEW_SCHEMA)).toBeUndefined();
    expect(verdictFromAnswer(`\n  - paragraph: "BLOCK: rozhoduje cenu."\n  - paragraph: '${PASS_JSON}'\n  - paragraph: `, REVIEW_SCHEMA)).toBeUndefined();
    // UI řádky ChatGPT před odpovědí (nadpis, souhrn přemýšlení) nevadí
    expect(verdictFromAnswer(`\n  - heading "ChatGPT řekl:" [level=6]\n  - button "Přemýšlení trvalo 2 min" [ref=e8]\n  - paragraph: '${PASS_JSON}'\n  - paragraph: `, REVIEW_SCHEMA)).toBe(PASS_JSON);
    // brána: „PASS“ uvnitř zvoleného „PASS WITH REQUIRED PATCHES“ není jiný verdikt
    expect(verdictFromAnswer(`\n  - paragraph: "Verdikt: PASS WITH REQUIRED PATCHES"\n  - paragraph: '${GATE_PATCH}'\n  - paragraph: `, GATE_SCHEMA)).toBe(JSON.stringify(JSON.parse(GATE_PATCH)));
    // stejný verdikt zopakovaný beze změny = platný
    expect(verdictFromAnswer(`\n  - paragraph: '${FIX_JSON}'\n  - paragraph: '${FIX_JSON}'\n  - paragraph: `, REVIEW_SCHEMA)).toBe(JSON.stringify(JSON.parse(FIX_JSON)));
    // rozporné verdikty v odpovědi (dřívější FIX, na konci PASS) = nejasné
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${FIX_JSON}'\n  - paragraph: '${PASS_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    // poslední objekt mimo schéma rozhoduje: dřívější PASS se nevezme
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${PASS_JSON}'\n  - paragraph: '{"verdict":"OK"}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
  });
});

describe("P16 v3: režim Chat (paušál), nikdy Work", () => {
  it("kroky neobsahují Work jako volbu ani projekt; režim Chat, model GPT-6 / GPT-5.6 Sol, intenzita Vysoká", () => {
    const steps = chatGptSteps("prompt", MARKER);
    const chooses = steps.filter((s): s is Extract<BrowserStep, { kind: "choose" }> => s.kind === "choose");
    expect(chooses.map((s) => s.prefer)).toEqual(["Chat", "GPT-6", "Vysoká"]);
    expect(chooses[0].fallback).toMatch(/RESULT: UNKNOWN chat-nedostupny/);
    expect(chooses[1].fallback).toMatch(/GPT-5\.6 Sol/);
    expect(chooses[2].fallback).toMatch(/nejvyšší stupeň/);
    for (const s of steps) {
      expect(s.kind).not.toBe("click");
      if (s.kind === "choose") expect(s.prefer).not.toMatch(/Work/);
    }
    // Work appears only as a prohibition ("nikdy"), never as something to pick
    for (const s of chooses) if (/Work/.test(s.fallback)) expect(s.fallback).toMatch(/nikdy[^;]*„Work“/);
    expect(JSON.stringify(steps)).not.toMatch(/projekt|Analýzy|GPT-6\.1|Max\./);
  });

  it("stránka v režimu Work (model GPT-6.1 Sol / Max. nebo zvolený přepínač Work) → WAITING_REVIEW „běží v režimu Work místo Chat“, odpověď se nepoužije", async () => {
    for (const model of [
      'button "GPT-6.1 Sol Max." [ref=e3]',
      'button "GPT-6 Max." [ref=e3]',
      'tab "Work" [selected] [ref=e2]\n  - button "GPT-6 Vysoká" [ref=e3]',
    ]) {
      const c = checker(new FakeBrowser(answering(PASS_JSON, model)));
      const r = await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
      expect(r, model).toMatchObject({ ok: false, waitReview: true, text: "" });
      expect(r.error, model).toMatch(/běží v režimu Work místo Chat/);
      expect(c.lastRecord, model).toMatchObject({ status: "WAITING_REVIEW", model_matches: false });
    }
    // the switch always shows both labels: a not-selected Work is not Work mode
    const c = checker(
      new FakeBrowser(answering(PASS_JSON, 'tab "Chat" [selected] [ref=e1]\n  - tab "Work" [ref=e2]\n  - button "GPT-6 Vysoká" [ref=e3]')),
    );
    expect(await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA })).toMatchObject({ ok: true });
    expect(c.lastRecord?.model_matches).toBe(true);
  });

  it("záložní GPT-5.6 Sol + Vysoká → shoda", async () => {
    const c = checker(new FakeBrowser(answering(PASS_JSON, 'button "GPT-5.6 Sol Vysoká" [ref=e3]')));
    const r = await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r.ok).toBe(true);
    expect(c.model).toBe("GPT-5.6 Sol · Vysoká");
    expect(c.lastRecord).toMatchObject({ status: "ANSWER", model_matches: true });
  });

  it("GPT-6 + Střední → neshoda (zapsáno NEODPOVÍDÁ), nikdy předstíraná shoda", async () => {
    const c = checker(new FakeBrowser(answering(PASS_JSON, 'button "GPT-6 Střední" [ref=e3]')));
    await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(c.model).toBe("GPT-6 · Střední");
    expect(c.lastRecord).toMatchObject({ model_matches: false, actual_model: "GPT-6 · Střední" });
    const rec = fs.readdirSync(dir).find((f) => f.startsWith("check-gptweb-"))!;
    expect(fs.readFileSync(path.join(dir, rec), "utf8")).toMatch(/NEODPOVÍDÁ/);
  });

  it("detectModel rozliší GPT-6 od GPT-6.1 Sol a GPT-5.6 Sol (i intenzitu hned za názvem)", () => {
    expect(detectModel('- button "GPT-6 Vysoká" [ref=e3]')).toEqual({ model: "GPT-6", intensity: "Vysoká" });
    expect(detectModel('- button "GPT-6.1 Sol Max." [ref=e3]')).toEqual({ model: "GPT-6.1 Sol", intensity: "Max." });
    expect(detectModel('- button "GPT-5.6 Sol Vysoká" [ref=e3]')).toEqual({ model: "GPT-5.6 Sol", intensity: "Vysoká" });
    expect(detectModel('- button "GPT-6 · Střední"')).toEqual({ model: "GPT-6", intensity: "Střední" });
    expect(detectModel('- button "GPT-6 High"')).toEqual({ model: "GPT-6", intensity: "High" });
    expect(detectModel('- button "GPT-6.1"').model).toBe("GPT-6.1");
    expect(detectModel('- button "GPT-6"').model).toBe("GPT-6");
  });
});

describe("žádné druhé odeslání a jen povolený host", () => {
  it("plán má právě jedno odeslání; brána po odeslání nic dalšího nevpíše ani neodešle; text musí odpovídat sha256", () => {
    const steps = chatGptSteps("prompt", MARKER);
    expect(steps.filter((s) => s.kind === "fill" && s.submit)).toHaveLength(1);
    expect(hostAllowed("https://chatgpt.com/")).toBe(true);
    const st = {
      ...emptyState(),
      submits: 1,
      refs: {
        e5: { label: 'textbox "Ask"', ok: true, submit: false },
        e6: { label: 'button "Send"', ok: true, submit: true },
      },
    };
    expect(
      gateMcpCall(
        "mcp__playwright__browser_type",
        { ref: "e5", text: "prompt", submit: true },
        st,
      ),
    ).toMatch(/po odeslání/);
    expect(
      gateMcpCall("mcp__playwright__browser_click", { ref: "e6" }, st),
    ).toMatch(/po odeslání/);
    const fresh = { ...st, submits: 0 };
    const sha = typedTextSha("prompt");
    expect(
      gateMcpCall(
        "mcp__playwright__browser_type",
        { ref: "e5", text: "prompt\r\n", submit: true },
        fresh,
        undefined,
        sha,
      ),
    ).toBeUndefined();
    expect(
      gateMcpCall(
        "mcp__playwright__browser_type",
        { ref: "e5", text: "jiný prompt", submit: true },
        fresh,
        undefined,
        sha,
      ),
    ).toMatch(/sha256/);
  });

  it("jedna kontrola = jeden běh prohlížeče, i když selže", async () => {
    const b = new FakeBrowser(() => new Error("chrome spadl"));
    const r = await checker(b).run("x", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r.waitReview).toBe(true);
    expect(b.calls).toHaveLength(1);
  });
});

describe("rodiny: kontroly mimo kód = GPT v prohlížeči, kód = Codex", () => {
  it("copy Claude → GPT projde, GPT → GPT je odmítnuto; vizuál a Konzilium s webovým GPT projdou", () => {
    const web = checker(new FakeBrowser(answering(PASS_JSON)));
    expect(() =>
      assertFamilies({ copy: new CopyDepartment(new ClaudeCli("opus"), web) }),
    ).not.toThrow();
    expect(() =>
      assertFamilies({ copy: new CopyDepartment(new CodexCli(), web) }),
    ).toThrow(/tvůrce ≠ kontrolor/);
    expect(() =>
      assertFamilies({
        vizual: new VizualDepartment(
          new FakeVizBrowser(),
          web,
          "",
          "",
          new ClaudeCli("sonnet"),
        ),
      }),
    ).not.toThrow();
    expect(() =>
      assertKonziliumFamilies(new ClaudeCli("opus"), web),
    ).not.toThrow();
  });

  it("karta copy-studio: tvůrce Claude, kontrolor GPT; zapojení v cli.ts: dev review dál Codex, ostatní kontroly GPT v prohlížeči", () => {
    const card = new CardRegistry(CARDS_DIR).creatorFor("copy").card!;
    expect(card).toMatchObject({
      role: "copy-studio",
      family: "claude",
      checker_family: "gpt",
    });
    const cli = fs.readFileSync(path.join(__dirname, "..", "cli.ts"), "utf8");
    expect(cli).toMatch(/briefChecker: gptWeb\b/);
    expect(cli).toMatch(/copy: new CopyDepartment\(opus, gptWeb\b/);
    expect(cli).toMatch(
      /vizual: new VizualDepartment\(makeBrowser\(\), gptWeb\b/,
    );
    expect(cli).toMatch(
      /dev: new DevDepartment\(new AiChain\(aiChain\), codex\b/,
    );
    expect(cli).toMatch(/checker: makeGptWeb\(\)/); // Konzilium Lite oponent
  });
});

class FakeVizBrowser {
  async run() {
    return {
      reads: [],
      screenshots: [],
      finalUrl: "https://claude.ai/design/p/x",
    };
  }
}

// ─── WAITING_REVIEW v orchestrátoru ───
const BRIEF =
  "```json\n" +
  JSON.stringify({
    title: "Návrh mikrocopy formuláře",
    department: "copy",
    milestone: "3.1",
    why: "DALŠÍ KROK",
    goal: "Navrhnout texty chybových stavů",
    inputs: ["fakt A"],
    acceptance: ["kritérium 1"],
    owner_decisions: [],
    sources: [
      "handoff",
      "capsule",
      "buildos",
      "funnel",
      "ui_build_brief",
      "copy_handoff",
    ],
  }) +
  "\n```";
const DRAFT = `# Draft\n\n${"Tichý, sebejistý text. ".repeat(30)}\n\n## Kontrola kritérií\n- ok`;

class Mock implements TextAdapter {
  calls: string[] = [];
  name = "mock";
  constructor(
    public family: ModelFamily,
    public model: string,
    private text: string,
  ) {}
  async run(prompt: string): Promise<AdapterResult> {
    this.calls.push(prompt);
    return { ok: true, text: this.text, limit: false, duration_ms: 1 };
  }
}
class Pages implements NotionClient {
  pages: string[] = [];
  async createPage(_p: string, _t: string, md: string) {
    this.pages.push(md);
    return { url: `https://app.notion.com/p/mock${this.pages.length}` };
  }
}

function setup(o: { briefBrowser?: FakeBrowser; copyBrowser?: FakeBrowser }) {
  const store = new Store(dir);
  const supervisor = new Mock("claude", "opus", BRIEF);
  const creator = new Mock("claude", "opus", DRAFT);
  const okBrowser = () => new FakeBrowser(answering(PASS_JSON));
  const briefChecker = checker(o.briefBrowser ?? okBrowser());
  const copyChecker = checker(o.copyBrowser ?? okBrowser());
  const notion = new Pages();
  const orch = new Orchestrator({
    store,
    supervisor,
    briefChecker,
    departments: { copy: new CopyDepartment(creator, copyChecker) },
    cards: new CardRegistry(CARDS_DIR),
    ladder: {
      hasCli: () => true,
      browserReady: () => ({ ok: false, reasons: ["x"] }),
      desktopReady: () => new NotImplementedDesktop().preflight(),
    },
    notion,
    guard: () => ({ alarm: false, summary: "TARS-GUARD OK (8/8)" }),
    draftParentId: "parent",
    repoRoot: dir,
    capsulePath: path.join(dir, "capsule.md"),
  });
  return { store, orch, supervisor, creator, notion };
}

describe("WAITING_REVIEW (orchestrátor, fake prohlížeč)", () => {
  it("kontrola zadání bez GPT → WAITING_REVIEW se stejným zadáním a hashem; další tick nejvýš 1 pokus, supervizor se neopakuje; po odpovědi dál až DONE", async () => {
    let fail = true;
    const bb = new FakeBrowser((steps) =>
      fail
        ? new UiUnknownError("krok selhal: nepřihlášeno", [])
        : page(sentPrompt(steps), PASS_JSON),
    );
    const { store, orch, supervisor } = setup({ briefBrowser: bb });
    expect(await orch.tick()).toMatchObject({ status: "waiting_review" });
    let [o] = store.listOrders();
    expect(o.state).toBe("WAITING_REVIEW");
    expect(o.review_from).toBe("NEW");
    expect(o.review_hash).toBe(artifactHash(o.meta.pending_brief!));
    expect(queueOf(o)).toBe("2 · Čeká na kontrolu");
    expect(lastStepSentence(o)).toMatch(
      /Čeká na kontrolu \(GPT v prohlížeči\)/,
    );
    expect(supervisor.calls).toHaveLength(1);
    expect(bb.calls).toHaveLength(1);

    expect(await orch.tick()).toMatchObject({ status: "waiting_review" });
    expect(bb.calls).toHaveLength(2); // exactly one retry in this tick
    expect(supervisor.calls).toHaveLength(1); // the same brief, not rewritten
    [o] = store.listOrders();
    expect(o.state).toBe("WAITING_REVIEW");

    fail = false;
    expect(await orch.tick()).toMatchObject({
      status: "advanced",
      state: "DONE",
    });
    [o] = store.listOrders();
    expect(o.meta.pending_brief).toBeUndefined();
    expect(o.review_hash).toBeUndefined();
    expect(o.history.map((h) => h.to)).toEqual([
      "WAITING_REVIEW",
      "NEW",
      "WAITING_REVIEW",
      "NEW",
      "PLANNED",
      "DOING",
      "CHECKING",
      "DELIVERED",
      "DONE",
    ]);
  });

  it("kontrola copy bez GPT (timeout) → WAITING_REVIEW z CHECKING s hashem draftu; po odpovědi PASS → DONE, nikdy PASS bez odpovědi", async () => {
    let fail = true;
    const cb = new FakeBrowser((steps) =>
      fail
        ? new UiUnknownError("krok selhal: timeout", [])
        : page(sentPrompt(steps), PASS_JSON),
    );
    const { store, orch, notion } = setup({ copyBrowser: cb });
    expect(await orch.tick()).toMatchObject({ status: "waiting_review" });
    let [o] = store.listOrders();
    expect(o).toMatchObject({
      state: "WAITING_REVIEW",
      review_from: "CHECKING",
      review_hash: artifactHash(DRAFT),
    });
    expect(notion.pages).toHaveLength(0); // nothing delivered
    expect(isActionable(o.state)).toBe(true);
    fail = false;
    expect(await orch.tick()).toMatchObject({
      status: "advanced",
      state: "DONE",
    });
    [o] = store.listOrders();
    expect(cb.calls).toHaveLength(2);
    expect(notion.pages).toHaveLength(1);
  });

  it("artefakt změněný během čekání → UNKNOWN (GPT by kontroloval jiný obsah)", async () => {
    const cb = new FakeBrowser(
      () => new UiUnknownError("krok selhal: timeout", []),
    );
    const { store, orch } = setup({ copyBrowser: cb });
    await orch.tick();
    const [o] = store.listOrders();
    store.writeFile(o.id, o.draft_file!, `${DRAFT}\nzměna`);
    await orch.tick();
    const [after] = store.listOrders();
    expect(after.state).toBe("UNKNOWN");
    expect(after.failure_reason).toMatch(/změnil/);
    expect(cb.calls).toHaveLength(1);
  });

  it("stavový automat: wait_review jen z NEW/CHECKING, retry vrací review_from, abort z WAITING_REVIEW jde", () => {
    const base: Order = {
      id: "x",
      mission: "m",
      state: "CHECKING",
      created_at: "t",
      updated_at: "t",
      fix_rounds: 0,
      manual_interventions: 0,
      history: [],
      meta: {},
    };
    const w = transition(
      base,
      { type: "wait_review", reason: "r", hash: "h" },
      "t",
    );
    expect(w).toMatchObject({
      state: "WAITING_REVIEW",
      review_from: "CHECKING",
      review_hash: "h",
    });
    expect(transition(w, { type: "retry_review" }, "t").state).toBe("CHECKING");
    expect(
      transition(w, { type: "fail", reason: "manual abort" }, "t").state,
    ).toBe("FAILED");
    expect(() =>
      transition(
        { ...base, state: "DOING" },
        { type: "wait_review", reason: "r", hash: "h" },
        "t",
      ),
    ).toThrow();
  });
});
