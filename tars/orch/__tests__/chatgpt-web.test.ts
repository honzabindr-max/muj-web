// P16 v3: non-code checks through ChatGPT in the browser, mode Chat (fake browser, no model, no Chrome).
import { createHash } from "node:crypto";
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
  answerInstructions,
  answerRegion,
  CHATGPT_MODEL,
  CHATGPT_PICKER,
  GPT_SMOKE_PROMPT,
  smokeSaidOk,
  ChatGptWebChecker,
  chatGptSteps,
  detectModel,
  END_WORD,
  grantRetry,
  markerEndsAnswer,
  readJournal,
  readRetries,
  verdictFromAnswer,
  writeJournal,
  type SentEntry,
  type WebBrowser,
} from "../chatgpt-web";
import { CopyDepartment, VizualDepartment } from "../departments";
import { retryDir, runGptRetry } from "../gpt-retry";
import { NotImplementedDesktop } from "../desktop";
import { assertKonziliumFamilies } from "../konzilium-lite";
import { hostAllowed } from "../ladder";
import {
  buildTask,
  checkStep,
  PICKER_NOT_OPEN,
  PICKER_OPEN_ATTEMPTS,
  playwrightMcpConfig,
  UiUnknownError,
  type BrowserStep,
  type SentReport,
} from "../mcp-browser";
import {
  chatClickAllowed,
  countCall,
  emptyState,
  gateMcpCall,
  observeResponse,
  parseSnapshotRefs,
  typedTextSha,
} from "../mcp-gate";
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

/** The end marker of the attempt that sent `prompt` (its nonce is the last word of the prompt); MARKER otherwise. */
const markerOf = (prompt: string) => {
  const m = /Kód: (\S+)\s*$/.exec(prompt);
  return m ? `${END_WORD}${m[1]}` : MARKER;
};

/**
 * The open model picker as the snapshot shows it (smoke 4. 11.): `menu "Vybrat model ChatGPT"` with the slider status
 * and the checked model radio. One element line at the level of `  - …` (children indented below it). Model and
 * intensity count only from it (Codex review PR #101 kolo 1).
 */
const picker = (model = "GPT-6", intensity = "Vysoká", level = 3, levels = 3) =>
  [
    'menu "Vybrat model ChatGPT" [ref=e810]:',
    `  - status: ${intensity}, ${level} z(e) ${levels}.`,
    "  - menuitemradio [checked]:",
    `    - generic: ${model}`,
    "  - menuitemradio:",
    "    - generic: GPT-5.6 Sol",
  ].join("\n  ");

/** Page snapshot as ChatGPT would show it: model picker, the sent prompt, the answer, the end marker. */
function page(prompt: string, answer: string, model = picker()): string {
  return [
    "- banner:",
    `  - ${model}`,
    "- main:",
    `  - paragraph: ${JSON.stringify(prompt)}`,
    `  - paragraph: '${answer}'`,
    `  - paragraph: ${markerOf(prompt)}`,
  ].join("\n");
}

type Script = (steps: BrowserStep[]) => string | Error;
/** The prompt the fake browser last typed (a read-only run of the same chat shows it again). */
let lastFilled = "";
const CHAT = "https://chatgpt.com/c/abc-123";
class FakeBrowser implements WebBrowser {
  calls: BrowserStep[][] = [];
  /** The page of the read BEFORE the send (default: the same page as after the answer). */
  before?: string;
  /** `sent`: what the gate would report about sending; default: a fill step was sent, unless the run failed before it. */
  constructor(
    public script: Script,
    public sent?: (steps: BrowserStep[], out: string | Error) => SentReport,
  ) {}
  async run(
    steps: BrowserStep[],
    _shots?: string,
    onSent?: (s: SentReport) => void,
  ) {
    this.calls.push(steps);
    const fill = steps.find((s) => s.kind === "fill");
    if (fill) lastFilled = fill.value;
    const out = this.script(steps);
    onSent?.(
      this.sent?.(steps, out) ?? {
        submitted:
          Boolean(fill) &&
          !(
            out instanceof Error &&
            /nepřihlášeno|chrome spadl/.test(out.message)
          ),
        url: CHAT,
      },
    );
    if (out instanceof Error) throw out;
    // one read before the send (default: the same page, i.e. the same model) and one after the answer
    const reads = steps.filter((s) => s.kind === "read").length;
    return {
      rawReads: [
        ...Array<string>(Math.max(0, reads - 1)).fill(this.before ?? out),
        out,
      ],
      screenshots: [],
      finalUrl: CHAT,
    };
  }
}
const fills = (b: FakeBrowser) =>
  b.calls.flat().filter((s) => s.kind === "fill").length;
const sentPrompt = (steps: BrowserStep[]) =>
  (
    steps.find((s) => s.kind === "fill") as
      | Extract<BrowserStep, { kind: "fill" }>
      | undefined
  )?.value ?? lastFilled;
const answering =
  (answer: string, model?: string): Script =>
  (steps) =>
    page(sentPrompt(steps), answer, model);

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
});

/** The journal key of a prompt checked with REVIEW_SCHEMA (as ChatGptWebChecker computes it). */
const promptShaOf = (prompt: string) =>
  createHash("sha256")
    .update(`${prompt}\n${JSON.stringify(REVIEW_SCHEMA)}`)
    .digest("hex");

/** First attempt: NONCE; every later attempt of the same checker gets a new nonce (like random bytes). */
const checker = (b: WebBrowser) => {
  let n = 0;
  return new ChatGptWebChecker(b, {
    nonce: () => (n++ === 0 ? NONCE : `${NONCE}x${n}`),
  });
};

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
    expect(steps).toContainEqual(
      expect.objectContaining({ kind: "choose", prefer: "Chat" }),
    );
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
    // nález 1: the page must show the model (GPT-6 · Vysoká), else the answer is not used
    const joined: Script = (steps) =>
      [
        `- banner:\n  - ${picker()}`,
        `- main:`,
        `  - paragraph: ${JSON.stringify(sentPrompt(steps))}`,
        `  - paragraph: '${FIX_JSON} ${MARKER}'`,
      ].join("\n");
    const r = await checker(new FakeBrowser(joined)).run("Posuď draft.", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
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
      cwd: fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-")), // a new order dir (attempts are per dir)
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

  it("nález 1: jiný model než požadovaný → WAITING_REVIEW (nikdy PASS), zapsán skutečný model, záznam říká NEODPOVÍDÁ", async () => {
    const c = checker(
      new FakeBrowser(
        answering(PASS_JSON, picker("GPT-5.5 Thinking", "Heavy")),
      ),
    );
    const r = await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r).toMatchObject({ ok: false, waitReview: true, text: "" });
    expect(r.error).toMatch(/model nebo intenzita neodpovídá/);
    expect(c.model).toBe("GPT-5.5 Thinking · Heavy");
    expect(c.lastRecord).toMatchObject({
      status: "WAITING_REVIEW",
      model_matches: false,
      actual_model: "GPT-5.5 Thinking · Heavy",
      requested_model: `${CHATGPT_MODEL} · Vysoká`,
    });
    const rec = fs.readdirSync(dir).find((f) => f.startsWith("check-gptweb-"))!;
    expect(fs.readFileSync(path.join(dir, rec), "utf8")).toMatch(/NEODPOVÍDÁ/);
    // page without any model label: never pretended, never PASS
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
    const c2 = checker(
      new FakeBrowser(answering(PASS_JSON, 'button "Nový chat" [ref=e3]')),
    );
    const r2 = await c2.run("x", { cwd: dir2, outputSchema: REVIEW_SCHEMA });
    expect(r2).toMatchObject({ ok: false, waitReview: true });
    expect(c2.model).toMatch(/^neověřeno/);
  });

  it("pomocné funkce: detectModel, answerRegion, verdictFromAnswer", () => {
    // only the open picker counts; a button text is never read as the model (PR #101 kolo 1)
    expect(detectModel('- button "GPT-6 Vysoká"')).toEqual({});
    expect(detectModel(`- ${picker()}`)).toEqual({
      model: "GPT-6",
      intensity: "Vysoká",
      level: 3,
      levels: 3,
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
    const APOS =
      '{"verdict":"FIX","findings":[{"severity":"low","file":null,"line":null,"text":"it\'s ok, \\"CTA\\" zkrátit"}]}';
    const aposValid = JSON.stringify(JSON.parse(APOS));
    // JSON a značka v jednom odstavci (Markdown spojí řádky): mezera před značkou
    expect(
      verdictFromAnswer(`\n  - paragraph: ${PASS_JSON} `, REVIEW_SCHEMA),
    ).toBe(PASS_JSON);
    expect(
      verdictFromAnswer(`\n  - paragraph: '${PASS_JSON} `, REVIEW_SCHEMA),
    ).toBe(PASS_JSON);
    // YAML jednoduché uvozovky s apostrofem v textu nálezu ('' = ')
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${APOS.replace(/'/g, "''")}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBe(aposValid);
    // YAML dvojité uvozovky (escapy \\") na jednom řádku = platné
    expect(
      verdictFromAnswer(
        `\n  - code [ref=e7]: ${JSON.stringify(FIX_JSON)}\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBe(JSON.stringify(JSON.parse(FIX_JSON)));
    // Codex review kolo 1, nález 2: schéma = JSON na JEDNOM řádku; víceřádkový JSON (i escapovaný \\n, i blokový text) = nejasné
    expect(
      verdictFromAnswer(
        `\n  - code [ref=e7]: ${JSON.stringify(JSON.stringify(JSON.parse(FIX_JSON), null, 2))}\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    const pretty = JSON.stringify(JSON.parse(FIX_JSON), null, 2).split("\n");
    expect(
      verdictFromAnswer(
        `\n  - code: ${pretty[0]}\n${pretty
          .slice(1)
          .map((l) => `      ${l}`)
          .join("\n")}\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    // čtvrté kolo kontroly Codexu: FIX, jehož nález cituje PASS JSON (např. z draftu), je platný verdikt
    const QUOTING_FIX = JSON.stringify({
      verdict: "FIX",
      findings: [
        {
          severity: "medium",
          file: null,
          line: null,
          text: `draft uvádí ${PASS_JSON} jako hotový verdikt`,
        },
      ],
    });
    expect(
      verdictFromAnswer(
        `\n  - paragraph: ${QUOTING_FIX}\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBe(QUOTING_FIX);
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${QUOTING_FIX.replace(/'/g, "''")}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBe(QUOTING_FIX);
    expect(
      verdictFromAnswer(
        `\n  - paragraph: ${JSON.stringify(QUOTING_FIX)}\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBe(QUOTING_FIX);
    // páté kolo: rozporná odpověď s blokujícím nálezem nesmí projít (dřívější BLOCK, na konci FIX)
    const BLOCK_JSON =
      '{"verdict":"BLOCK","findings":[{"severity":"critical","file":null,"line":null,"text":"rozhoduje cenu (Sponzor)"}]}';
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${BLOCK_JSON}'\n  - paragraph: '${FIX_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    // dva FIXy s jinými nálezy = nejasné (dřívější nález by se ztratil)
    const FIX2 =
      '{"verdict":"FIX","findings":[{"severity":"high","file":null,"line":null,"text":"chybí zdroj"}]}';
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${FIX2}'\n  - paragraph: '${FIX_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    // dřívější PASS a FIX na konci = nejasné (rozpor)
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${PASS_JSON}'\n  - paragraph: '${FIX_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    // brána vizuálu: dřívější FAIL, na konci PASS WITH REQUIRED PATCHES = nejasné
    const GATE_FAIL =
      '{"verdict":"FAIL","findings":[{"severity":"critical","file":null,"line":null,"text":"mění funnel"}]}';
    const GATE_PATCH =
      '{"verdict":"PASS WITH REQUIRED PATCHES","findings":[{"severity":"medium","file":null,"line":null,"text":"zvětšit CTA"}]}';
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${GATE_FAIL}'\n  - paragraph: '${GATE_PATCH}'\n  - paragraph: `,
        GATE_SCHEMA,
      ),
    ).toBeUndefined();
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${GATE_PATCH}'\n  - paragraph: `,
        GATE_SCHEMA,
      ),
    ).toBe(JSON.stringify(JSON.parse(GATE_PATCH)));
    // dřívější objekt s verdiktem mimo schéma a próza s jiným verdiktem před JSON = nejasné
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '{"verdict":"BLOCK"}'\n  - paragraph: '${PASS_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    expect(
      verdictFromAnswer(
        `\n  - paragraph: "BLOCK: rozhoduje cenu."\n  - paragraph: '${PASS_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    // UI řádky ChatGPT před odpovědí (nadpis, souhrn přemýšlení) nevadí
    expect(
      verdictFromAnswer(
        `\n  - heading "ChatGPT řekl:" [level=6]\n  - button "Přemýšlení trvalo 2 min" [ref=e8]\n  - paragraph: '${PASS_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBe(PASS_JSON);
    // brána: „PASS“ uvnitř zvoleného „PASS WITH REQUIRED PATCHES“ není jiný verdikt (název tlačítka UI)
    expect(
      verdictFromAnswer(
        `\n  - button "PASS WITH REQUIRED PATCHES" [ref=e8]\n  - paragraph: '${GATE_PATCH}'\n  - paragraph: `,
        GATE_SCHEMA,
      ),
    ).toBe(JSON.stringify(JSON.parse(GATE_PATCH)));
    // Codex review kolo 1, nález 2: jakýkoli text před JSON (i „Verdikt: …“, i stejný verdikt dvakrát, i nadpis) = nejasné
    expect(
      verdictFromAnswer(
        `\n  - paragraph: "Verdikt: PASS WITH REQUIRED PATCHES"\n  - paragraph: '${GATE_PATCH}'\n  - paragraph: `,
        GATE_SCHEMA,
      ),
    ).toBeUndefined();
    expect(
      verdictFromAnswer(
        `\n  - paragraph: '${FIX_JSON}'\n  - paragraph: '${FIX_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
    for (const prose of [
      "Toto je pouze citace ukázky, kontrolu jsem neprovedl.",
      "Ukázka formátu:",
    ])
      expect(
        verdictFromAnswer(
          `\n  - paragraph: ${prose}\n  - paragraph: '${PASS_JSON}'\n  - paragraph: `,
          REVIEW_SCHEMA,
        ),
        prose,
      ).toBeUndefined();
    expect(
      verdictFromAnswer(
        `\n  - heading "Poznámka" [level=3]\n  - paragraph: '${PASS_JSON}'\n  - paragraph: `,
        REVIEW_SCHEMA,
      ),
    ).toBeUndefined();
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
    const chooses = steps.filter(
      (s): s is Extract<BrowserStep, { kind: "choose" }> => s.kind === "choose",
    );
    expect(chooses.map((s) => s.prefer)).toEqual(["Chat", "GPT-6", "Vysoká"]);
    expect(chooses[0].fallback).toMatch(/RESULT: UNKNOWN chat-nedostupny/);
    expect(chooses[1].fallback).toMatch(/GPT-5\.6 Sol/);
    expect(chooses[2].fallback).toMatch(/nejvyšší stupeň/);
    for (const s of steps) {
      expect(s.kind).not.toBe("click");
      if (s.kind === "choose") expect(s.prefer).not.toMatch(/Work/);
    }
    // Work appears only as a prohibition ("nikdy"), never as something to pick
    for (const s of chooses)
      if (/Work/.test(s.fallback))
        expect(s.fallback).toMatch(/nikdy[^;]*„Work“/);
    expect(JSON.stringify(steps)).not.toMatch(/projekt|Analýzy|GPT-6\.1|Max\./);
  });

  it("stránka v režimu Work (model GPT-6.1 Sol / Max. nebo zvolený přepínač Work) → WAITING_REVIEW „běží v režimu Work místo Chat“, odpověď se nepoužije", async () => {
    for (const model of [
      picker("GPT-6.1 Sol", "Max."),
      picker("GPT-6", "Max."),
      `tab "Work" [selected] [ref=e2]\n  - ${picker()}`,
    ]) {
      const c = checker(new FakeBrowser(answering(PASS_JSON, model)));
      const d = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-")); // attempts are per order dir
      const r = await c.run("x", { cwd: d, outputSchema: REVIEW_SCHEMA });
      expect(r, model).toMatchObject({ ok: false, waitReview: true, text: "" });
      expect(r.error, model).toMatch(/běží v režimu Work místo Chat/);
      expect(c.lastRecord, model).toMatchObject({
        status: "WAITING_REVIEW",
        model_matches: false,
      });
    }
    // the switch always shows both labels: a not-selected Work is not Work mode
    const c = checker(
      new FakeBrowser(
        answering(
          PASS_JSON,
          `tab "Chat" [selected] [ref=e1]\n  - tab "Work" [ref=e2]\n  - ${picker()}`,
        ),
      ),
    );
    expect(
      await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA }),
    ).toMatchObject({ ok: true });
    expect(c.lastRecord?.model_matches).toBe(true);
  });

  it("záložní GPT-5.6 Sol + Vysoká → shoda", async () => {
    const c = checker(
      new FakeBrowser(answering(PASS_JSON, picker("GPT-5.6 Sol"))),
    );
    const r = await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r.ok).toBe(true);
    expect(c.model).toBe("GPT-5.6 Sol · Vysoká");
    expect(c.lastRecord).toMatchObject({
      status: "ANSWER",
      model_matches: true,
    });
  });

  it("GPT-6 + Střední → neshoda (zapsáno NEODPOVÍDÁ), nikdy předstíraná shoda", async () => {
    const c = checker(
      new FakeBrowser(answering(PASS_JSON, picker("GPT-6", "Střední", 2))),
    );
    const r = await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r).toMatchObject({ ok: false, waitReview: true }); // nález 1: never PASS at the wrong intensity
    expect(c.model).toBe("GPT-6 · Střední (stupeň 2/3)");
    expect(c.lastRecord).toMatchObject({
      status: "WAITING_REVIEW",
      model_matches: false,
      actual_model: "GPT-6 · Střední (stupeň 2/3)",
    });
    const rec = fs.readdirSync(dir).find((f) => f.startsWith("check-gptweb-"))!;
    expect(fs.readFileSync(path.join(dir, rec), "utf8")).toMatch(/NEODPOVÍDÁ/);
  });

  it("detectModel čte jen otevřený výběr: rozliší GPT-6 od GPT-6.1 Sol a GPT-5.6 Sol; text tlačítka nebo stránky se nikdy nepočítá", () => {
    const top = { level: 3, levels: 3 };
    expect(detectModel(`- ${picker()}`)).toEqual({
      model: "GPT-6",
      intensity: "Vysoká",
      ...top,
    });
    expect(detectModel(`- ${picker("GPT-6.1 Sol", "Max.")}`)).toEqual({
      model: "GPT-6.1 Sol",
      intensity: "Max.",
      ...top,
    });
    expect(detectModel(`- ${picker("GPT-5.6 Sol")}`)).toEqual({
      model: "GPT-5.6 Sol",
      intensity: "Vysoká",
      ...top,
    });
    expect(detectModel(`- ${picker("GPT-6", "High")}`)).toEqual({
      model: "GPT-6",
      intensity: "High",
      ...top,
    });
    // PR #101 kolo 1: the old fallback read model and intensity from any text of the page; now nothing of it counts
    for (const t of [
      '- button "GPT-6 Vysoká" [ref=e3]',
      '- button "GPT-6 · Střední"',
      '- button "GPT-6 High"',
      '- link "GPT-6 High" [ref=e9]',
      '- paragraph: "GPT-6 High, 3 z(e) 3."',
    ])
      expect(detectModel(t), t).toEqual({});
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
    const fresh = {
      ...st,
      submits: 0,
      refs: { ...st.refs, e5: { ...st.refs.e5, content: "" } },
    };
    const sha = typedTextSha("prompt");
    expect(
      gateMcpCall(
        "mcp__playwright__browser_type",
        { ref: "e5", text: "prompt\r\n" },
        fresh,
        undefined,
        sha,
      ),
    ).toBeUndefined();
    expect(
      gateMcpCall(
        "mcp__playwright__browser_type",
        { ref: "e5", text: "jiný prompt" },
        fresh,
        undefined,
        sha,
      ),
    ).toMatch(/sha256/);
  });

  it("nález 4: rozepsaný text A v composeru → prompt se nepíše ani neodešle, dokud pole není prázdné a neobsahuje přesně prompt", () => {
    const sha = typedTextSha("prompt");
    const T = "mcp__playwright__browser_type";
    const C = "mcp__playwright__browser_click";
    const snap = (field: string) =>
      `### Page\n- Page URL: https://chatgpt.com/\n### Snapshot\n\`\`\`yaml\n- textbox "Ask" [ref=e5]:${field}\n- button "Send prompt" [ref=e6]\n\`\`\``;
    const st = emptyState();
    observeResponse(snap("\n  - paragraph: A rozepsáno"), st);
    expect(st.refs.e5.content).toBe("A rozepsáno");
    // pressSequentially (slowly) would append to A; submit on type would send without verification
    expect(
      gateMcpCall(
        T,
        { ref: "e5", text: "prompt", slowly: true },
        st,
        undefined,
        sha,
      ),
    ).toMatch(/slowly/);
    expect(
      gateMcpCall(
        T,
        { ref: "e5", text: "prompt", submit: true },
        st,
        undefined,
        sha,
      ),
    ).toMatch(/browser_type se nepovoluje/);
    // the field is not empty: typing the prompt is denied
    expect(
      gateMcpCall(T, { ref: "e5", text: "prompt" }, st, undefined, sha),
    ).toMatch(/není podle posledního snapshotu prázdné/);
    // a send without a typed and verified prompt is denied
    expect(gateMcpCall(C, { ref: "e6" }, st, undefined, sha)).toMatch(
      /neodpovídá zadanému textu/,
    );
    // clearing (empty text) is allowed; afterwards the content is unknown until a snapshot
    expect(
      gateMcpCall(T, { ref: "e5", text: "" }, st, undefined, sha),
    ).toBeUndefined();
    countCall(T, { ref: "e5", text: "" }, st);
    expect(
      gateMcpCall(T, { ref: "e5", text: "prompt" }, st, undefined, sha),
    ).toMatch(/prázdné/);
    observeResponse(snap("\n  - paragraph"), st);
    expect(
      gateMcpCall(T, { ref: "e5", text: "prompt" }, st, undefined, sha),
    ).toBeUndefined();
    countCall(T, { ref: "e5", text: "prompt" }, st);
    // before a new snapshot the content is unknown → no send
    expect(gateMcpCall(C, { ref: "e6" }, st, undefined, sha)).toMatch(
      /neodpovídá/,
    );
    // the field shows A + prompt (typing did not replace A) → no send
    observeResponse(
      snap("\n  - paragraph: A rozepsáno\n  - paragraph: prompt"),
      st,
    );
    expect(gateMcpCall(C, { ref: "e6" }, st, undefined, sha)).toMatch(
      /neodpovídá/,
    );
    // the field holds exactly the prompt → the one send is allowed
    observeResponse(snap(" prompt"), st);
    expect(gateMcpCall(C, { ref: "e6" }, st, undefined, sha)).toBeUndefined();
    countCall(C, { ref: "e6" }, st);
    expect(st.submits).toBe(1);
    // multi-line prompt: paragraphs joined by \n (empty paragraph = empty line), quoted text values decoded
    expect(
      parseSnapshotRefs(
        '- textbox [ref=e5]:\n  - paragraph: a\n  - paragraph\n  - paragraph: "Kód: c"',
      ).e5.content,
    ).toBe("a\n\nKód: c");
    // read-only run (noType): no typing, no send
    const ro = emptyState();
    observeResponse(snap(""), ro);
    expect(
      gateMcpCall(T, { ref: "e5", text: "x" }, ro, undefined, undefined, true),
    ).toMatch(/jen čte/);
    expect(
      gateMcpCall(C, { ref: "e6" }, ro, undefined, undefined, true),
    ).toMatch(/jen čte/);
    // the driver is told the order of steps the gate allows
    const task = buildTask(chatGptSteps("prompt", MARKER), "shots");
    expect(task).toMatch(/Vyčisti ho: browser_type do pole s text ""/);
    expect(task).toMatch(/bez submit, bez slowly/);
    expect(task).not.toMatch(/submit: true/);
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
    // whitespace-tolerant: cli.ts is formatted by prettier (arguments may wrap)
    expect(cli).toMatch(/briefChecker: gptWeb\b/);
    expect(cli).toMatch(/copy: new CopyDepartment\(\s*opus,\s*gptWeb\b/);
    expect(cli).toMatch(
      /vizual: new VizualDepartment\(\s*makeBrowser\(\),\s*gptWeb\b/,
    );
    expect(cli).toMatch(
      /dev: new DevDepartment\(\s*new AiChain\(aiChain\),\s*codex\b/,
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
    // Codex review kolo 3, nález 1: the burned attempt is retried only after an explicit gpt-retry
    expect(await orch.tick()).toMatchObject({ status: "waiting_review" });
    expect(cb.calls).toHaveLength(1);
    expect(runGptRetry(store, o.id, "vlastnik", "timeout").ok).toBe(true);
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

// ─── Codex review kolo 1 (PR #98): nálezy 2, 3, 5, 6 end-to-end ───
const TOKEN = `ghp_${"A1b2C3d4".repeat(5)}`;
const BANNER = `- banner:\n  - ${picker()}`;

describe("Codex review kolo 1: odpověď přesně podle schématu, značka = konec odpovědi", () => {
  it("nález 2: próza „jen citace ukázky, kontrolu jsem neprovedl“ + PASS JSON → WAITING_REVIEW (neplatný formát)", async () => {
    const quoted: Script = (steps) =>
      [
        BANNER,
        "- main:",
        `  - paragraph: ${JSON.stringify(sentPrompt(steps))}`,
        "  - paragraph: Toto je pouze citace ukázky, kontrolu jsem neprovedl.",
        `  - paragraph: '${PASS_JSON}'`,
        `  - paragraph: ${MARKER}`,
      ].join("\n");
    const r = await checker(new FakeBrowser(quoted)).run("x", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: false, waitReview: true, text: "" });
    expect(r.error).toMatch(/nejasný výsledek/);
  });

  it("nález 3: PASS JSON, značka a pak oprava na FIX v téže zprávě → WAITING_REVIEW; UI pod zprávou nevadí", async () => {
    const after =
      (tail: string[]): Script =>
      (steps) =>
        [
          BANNER,
          "- main:",
          "  - article:",
          `    - paragraph: ${JSON.stringify(sentPrompt(steps))}`,
          "  - article:",
          `    - paragraph: '${PASS_JSON}'`,
          `    - paragraph: ${MARKER}`,
          ...tail,
        ].join("\n");
    for (const tail of [
      [
        "    - paragraph: Oprava, správně je FIX.",
        `    - paragraph: '${FIX_JSON}'`,
      ],
      [`    - paragraph: '${MARKER} a ještě FIX'`],
      [
        '  - heading "ChatGPT řekl:" [level=6]',
        "    - paragraph: Další zpráva.",
      ],
    ]) {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
      const r = await checker(new FakeBrowser(after(tail))).run("x", {
        cwd: d,
        outputSchema: REVIEW_SCHEMA,
      });
      expect(r, tail.join(" | ")).toMatchObject({
        ok: false,
        waitReview: true,
      });
    }
    // text right after the marker on its line (same paragraph) = not the end
    expect(markerEndsAnswer(`  - paragraph: ${MARKER} ale FIX`, MARKER)).toBe(
      false,
    );
    // only UI of the message (copy / rate buttons) and the rest of the page (composer, footer) after it = the end
    const ok = after([
      '    - button "Kopírovat" [ref=e20]',
      '    - button "Dobrá odpověď" [ref=e21]',
      "- contentinfo:",
      "  - paragraph: ChatGPT může dělat chyby.",
    ]);
    const r = await checker(new FakeBrowser(ok)).run("x", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: true, text: PASS_JSON });
  });
});

describe("Codex review kolo 2, hlavní změna (nálezy 1, 3): jeden pokus = nový chat = nový nonce = jedno odeslání", () => {
  const sendsOf = (b: FakeBrowser) =>
    b.calls.filter((c) => c.some((s) => s.kind === "fill"));
  const nonceOf = (steps: BrowserStep[]) =>
    /Kód: (\S+)\s*$/.exec(sentPrompt(steps))![1];

  it("nález 1: PASS vytvořený při Střední → pokus spálen; bez gpt-retry se nic znovu neposílá; po gpt-retry se stará odpověď nikdy nepřijme, nový pokus jde do nového chatu s novým nonce; jedno povolení = jedno odeslání", async () => {
    let first = "";
    const b = new FakeBrowser((steps) => {
      if (!first) {
        first = sentPrompt(steps);
        return page(first, PASS_JSON, picker("GPT-6", "Střední", 2));
      }
      // the second run sees the OLD chat with its PASS, the picker now shows Vysoká (no new answer was generated)
      return page(first, PASS_JSON, picker());
    });
    const c = checker(b);
    const r1 = await c.run("Posuď.", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r1).toMatchObject({ ok: false, waitReview: true });
    expect(readJournal(dir)).toEqual([
      expect.objectContaining({
        state: "burned",
        nonce: NONCE,
        reason: expect.stringMatching(/neodpovídá/),
      }),
    ]);
    // Codex review kolo 3, nález 1: without gpt-retry no second send
    const blocked = await c.run("Posuď.", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(blocked.error).toMatch(/znovu se automaticky neposílá/);
    expect(b.calls).toHaveLength(1);
    expect(grantRetry(dir, "fable", "model byl na Střední").ok).toBe(true);
    const r2 = await c.run("Posuď.", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r2).toMatchObject({ ok: false, waitReview: true }); // the old PASS is never accepted
    expect(sendsOf(b)).toHaveLength(2);
    expect(b.calls[1][0]).toEqual({
      kind: "goto",
      url: "https://chatgpt.com/",
    }); // a new chat, never the old one
    expect(nonceOf(b.calls[1])).not.toBe(nonceOf(b.calls[0]));
    expect(readJournal(dir)!.map((e) => e.state)).toEqual(["burned", "burned"]);
    // the grant is used up: no third attempt without a new gpt-retry
    const r3 = await c.run("Posuď.", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r3.error).toMatch(/gpt-retry/);
    expect(b.calls).toHaveLength(2);
  });

  it("nález 1: model před odesláním jiný než po odpovědi (Střední → Vysoká) nebo čtení před odesláním chybí → spáleno, nikdy PASS", async () => {
    const b = new FakeBrowser(answering(PASS_JSON));
    b.before = `${BANNER.replace("Vysoká", "Střední")}\n- main:`;
    const r = await checker(b).run("x", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: false, waitReview: true });
    expect(r.error).toMatch(/před odesláním neodpovídá/);
    expect(readJournal(dir)).toEqual([
      expect.objectContaining({ state: "burned" }),
    ]);
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
    const b2 = new FakeBrowser(answering(PASS_JSON));
    b2.before = `- banner:\n  - tab "Work" [selected] [ref=e2]\n  - ${picker()}`;
    expect(
      (await checker(b2).run("x", { cwd: d, outputSchema: REVIEW_SCHEMA }))
        .error,
    ).toMatch(/před odesláním/);
    // the plan reads the page before the send, in the same run
    const steps = chatGptSteps("p", MARKER);
    const fillAt = steps.findIndex((s) => s.kind === "fill");
    expect(steps.slice(0, fillAt).some((s) => s.kind === "read")).toBe(true);
    expect(steps.at(-1)).toEqual({ kind: "read" });
  });

  describe("Codex review PR #101 kolo 3: uložená odpověď se z deníku nikdy neobnovuje", () => {
    const INTERRUPTED = "přerušený pokus, obnova z deníku se nepovoluje";
    const stored = (extra: Record<string, unknown>): SentEntry =>
      ({
        prompt_sha256: promptShaOf("Posuď."),
        nonce: "old",
        at: new Date().toISOString(),
        state: "answered",
        answer: PASS_JSON,
        model_before: "GPT-6 · Vysoká",
        model_after: "GPT-6 · Vysoká",
        ...extra,
      }) as SentEntry;
    const afterRestart = async (e: SentEntry) => {
      writeJournal(dir, [e]);
      const b = new FakeBrowser(answering(FIX_JSON));
      const c = checker(b);
      const r = await c.run("Posuď.", {
        cwd: dir,
        outputSchema: REVIEW_SCHEMA,
      });
      return { r, c, b };
    };
    const expectBurnedWaiting = (
      x: Awaited<ReturnType<typeof afterRestart>>,
    ) => {
      expect(x.r).toMatchObject({ ok: false, waitReview: true, text: "" });
      expect(x.r.error).toContain(INTERRUPTED);
      expect(x.r.error).toMatch(/gpt-retry/);
      expect(x.b.calls).toHaveLength(0);
      expect(x.c.lastRecord).toMatchObject({
        status: "WAITING_REVIEW",
        submits: 0,
      });
      expect(readJournal(dir)).toEqual([
        expect.objectContaining({ state: "burned", reason: INTERRUPTED }),
      ]);
    };

    it("pád po „answered“ před uložením výsledku → po restartu spáleno, WAITING_REVIEW, bez odeslání; gpt-retry pak právě jedno nové odeslání", async () => {
      // a real "answered" attempt written by a live run
      const b0 = new FakeBrowser(answering(PASS_JSON));
      expect(
        await checker(b0).run("Posuď.", {
          cwd: dir,
          outputSchema: REVIEW_SCHEMA,
        }),
      ).toMatchObject({ ok: true, text: PASS_JSON });
      const live = readJournal(dir)!;
      expect(live).toEqual([
        expect.objectContaining({
          state: "answered",
          answer: PASS_JSON,
          model_before: "GPT-6 · Vysoká",
          model_after: "GPT-6 · Vysoká",
          chat_url: CHAT,
        }),
      ]);
      // the caller crashed before storing the result: a new process (new checker) repeats the check
      const x = await afterRestart(live[0]);
      expectBurnedWaiting(x);
      // the next tick sends nothing on its own either
      const again = await checker(x.b).run("Posuď.", {
        cwd: dir,
        outputSchema: REVIEW_SCHEMA,
      });
      expect(again).toMatchObject({ ok: false, waitReview: true });
      expect(x.b.calls).toHaveLength(0);
      // gpt-retry: exactly one new send
      expect(grantRetry(dir, "vlastnik", "přerušená kontrola").ok).toBe(true);
      const b2 = new FakeBrowser(answering(FIX_JSON));
      const r2 = await new ChatGptWebChecker(b2, { nonce: () => "novy" }).run(
        "Posuď.",
        { cwd: dir, outputSchema: REVIEW_SCHEMA },
      );
      expect(r2).toMatchObject({ ok: true, text: FIX_JSON });
      expect(b2.calls).toHaveLength(1);
      expect(readJournal(dir)!.at(-1)).toMatchObject({
        nonce: "novy",
        state: "answered",
      });
    });

    it("syntetický záznam s kompletním „důkazem“ ovládacího prvku → také spálen, bez odeslání", async () => {
      const evidence = {
        menu: "Vybrat model ChatGPT",
        model: "GPT-6",
        intensity: "High",
        level: 3,
        levels: 3,
      };
      expectBurnedWaiting(
        await afterRestart(
          stored({
            verify: "picker-v1",
            picker_before: evidence,
            picker_after: evidence,
          }),
        ),
      );
    });

    it("starý záznam „answered“ s „GPT-6 · Střední“ → také spálen, bez odeslání", async () => {
      expectBurnedWaiting(
        await afterRestart(stored({ model_before: "GPT-6 · Střední" })),
      );
    });
  });

  it("nález 3: pád mezi odesláním a odpovědí („sending“/„sent“ v deníku) → pokus spálen, chat se neotevře; nový pokus jen po gpt-retry", async () => {
    const b = new FakeBrowser(answering(PASS_JSON));
    expect(
      await checker(b).run("Posuď.", { cwd: dir, outputSchema: REVIEW_SCHEMA }),
    ).toMatchObject({ ok: true });
    const sha = readJournal(dir)![0].prompt_sha256;
    for (const state of ["sending", "sent"] as const) {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
      writeJournal(d, [
        {
          prompt_sha256: sha,
          nonce: "crashed",
          at: new Date().toISOString(),
          state,
          chat_url: CHAT,
        },
      ]);
      const bb = new FakeBrowser(answering(PASS_JSON));
      const c = checker(bb);
      const r = await c.run("Posuď.", { cwd: d, outputSchema: REVIEW_SCHEMA });
      expect(r, state).toMatchObject({ ok: false, waitReview: true });
      expect(r.error).toMatch(/nebyl dokončen/);
      expect(bb.calls, state).toHaveLength(0); // the old chat is never opened
      expect(readJournal(d), state).toEqual([
        expect.objectContaining({ state: "burned", nonce: "crashed" }),
      ]);
      // Codex review kolo 3, nález 1: the next run sends nothing without gpt-retry
      const again = await c.run("Posuď.", {
        cwd: d,
        outputSchema: REVIEW_SCHEMA,
      });
      expect(again.error, state).toMatch(/gpt-retry/);
      expect(bb.calls, state).toHaveLength(0);
      expect(grantRetry(d, "vlastnik", "pád během kontroly").ok).toBe(true);
      const r2 = await c.run("Posuď.", { cwd: d, outputSchema: REVIEW_SCHEMA });
      expect(r2, state).toMatchObject({ ok: true, text: PASS_JSON });
      expect(sendsOf(bb)).toHaveLength(1);
      expect(bb.calls[0][0]).toEqual({
        kind: "goto",
        url: "https://chatgpt.com/",
      });
    }
  });

  it("timeout nebo neznámé odeslání → spáleno; prokazatelně neodesláno (nepřihlášeno) → záznam se smaže a nepočítá se", async () => {
    for (const sent of [
      { submitted: true, url: CHAT },
      { submitted: "unknown" },
    ] as SentReport[]) {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
      const b = new FakeBrowser(
        () => new UiUnknownError("krok selhal: timeout", []),
        () => sent,
      );
      const r = await checker(b).run("x", {
        cwd: d,
        outputSchema: REVIEW_SCHEMA,
      });
      expect(r).toMatchObject({ ok: false, waitReview: true });
      expect(readJournal(d), JSON.stringify(sent)).toEqual([
        expect.objectContaining({ state: "burned" }),
      ]);
    }
    let fail = true;
    const b = new FakeBrowser((steps) =>
      fail
        ? new UiUnknownError("krok selhal: nepřihlášeno", [])
        : page(sentPrompt(steps), PASS_JSON),
    );
    const c = checker(b);
    await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(readJournal(dir)).toEqual([]);
    fail = false;
    expect(
      await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA }),
    ).toMatchObject({ ok: true }); // unsent attempts do not count
    expect(fills(b)).toBe(3);
  });

  it("orchestrátor: timeout kontroly copy po odeslání → pokus spálen; další ticky nic neposílají; gpt-retry → právě jedno nové odeslání (nový chat, nový nonce) → DONE", async () => {
    let fail = true;
    const cb = new FakeBrowser((steps) =>
      fail
        ? new UiUnknownError("krok selhal: timeout", [])
        : page(sentPrompt(steps), PASS_JSON),
    );
    const { store, orch } = setup({ copyBrowser: cb });
    expect(await orch.tick()).toMatchObject({ status: "waiting_review" });
    const [o] = store.listOrders();
    // the brief check (answered) and the copy check (burned) share the order dir
    expect(readJournal(store.orderDir(o.id))!.map((e) => e.state)).toEqual([
      "answered",
      "burned",
    ]);
    fail = false;
    // Codex review kolo 3, nález 1: further ticks never send again on their own (no automatic retry)
    for (let i = 0; i < 3; i++) await orch.tick();
    expect(cb.calls).toHaveLength(1);
    expect(fills(cb)).toBe(1);
    expect(store.load(o.id).state).toBe("WAITING_REVIEW");
    // only the explicit command allows one new attempt; it logs who, when and why
    const g = runGptRetry(
      store,
      o.id,
      "fable",
      "timeout kontroly copy, artefakt beze změny",
    );
    expect(g.ok).toBe(true);
    const logLine = store
      .readLog(200)
      .filter((e) => e.event === "gpt-retry")
      .at(-1)!;
    expect(logLine).toMatchObject({ order: o.id, kind: "info" });
    expect(logLine.result).toMatch(
      /kdo=fable, kdy=\d{4}-\d\d-\d\dT.*proč=timeout kontroly copy/,
    );
    // a second grant before the first is used is refused (one command = at most one send)
    expect(runGptRetry(store, o.id, "vlastnik", "ještě jednou").ok).toBe(false);
    expect(await orch.tick()).toMatchObject({
      status: "advanced",
      state: "DONE",
    });
    expect(cb.calls).toHaveLength(2);
    expect(fills(cb)).toBe(2);
    expect(nonceOf(cb.calls[1])).not.toBe(nonceOf(cb.calls[0]));
    expect(readJournal(store.orderDir(o.id))!.map((e) => e.state)).toEqual([
      "answered",
      "burned",
      "answered",
    ]);
  });
});

describe("Codex review kolo 3, nález 1: po spáleném pokusu jen výslovný gpt-retry", () => {
  it("timeout po potvrzeném odeslání → žádné druhé odeslání ani další den; gpt-retry → právě jedno nové odeslání", async () => {
    let t = new Date("2026-11-04T10:00:00Z");
    let n = 0;
    let fail = true;
    const b = new FakeBrowser((steps) =>
      fail
        ? new UiUnknownError("krok selhal: timeout", [])
        : page(sentPrompt(steps), PASS_JSON),
    );
    const c = new ChatGptWebChecker(b, {
      now: () => t,
      nonce: () => `n${n++}`,
    });
    const run = () =>
      c.run("Posuď.", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect((await run()).error).toMatch(/časovém limitu/);
    fail = false;
    for (const day of ["2026-11-04T11:00:00Z", "2026-11-05T10:00:00Z"]) {
      t = new Date(day); // also the next day: no reset
      const r = await run();
      expect(r).toMatchObject({ ok: false, waitReview: true });
      expect(r.error).toMatch(
        /spálený .*odpověď ChatGPT nedorazila.*gpt-retry .*fable\|vlastnik/,
      );
    }
    expect(fills(b)).toBe(1);
    // refusals: wrong who, no reason
    expect(grantRetry(dir, "codex", "x")).toMatchObject({ ok: false });
    expect(grantRetry(dir, "fable", "  ")).toMatchObject({ ok: false });
    expect(readRetries(dir)).toEqual([]);
    const g = grantRetry(dir, "vlastnik", "zkusit znovu", () => t);
    expect(g).toMatchObject({
      ok: true,
      grant: { by: "vlastnik", why: "zkusit znovu", at: t.toISOString() },
    });
    expect(grantRetry(dir, "fable", "druhé")).toMatchObject({ ok: false }); // one unused grant at a time
    expect(await run()).toMatchObject({ ok: true, text: PASS_JSON });
    expect(fills(b)).toBe(2);
    expect(readRetries(dir)).toEqual([
      expect.objectContaining({
        by: "vlastnik",
        nonce: "n1",
        used_at: t.toISOString(),
      }),
    ]);
    // while the attempt is answered (not burned), no retry is allowed
    expect(grantRetry(dir, "fable", "x")).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/není spálený/),
    });
    // Codex review PR #101 kolo 3: a later run never restores the stored answer: burned, waits, nothing is sent
    const later = await run();
    expect(later).toMatchObject({ ok: false, waitReview: true, text: "" });
    expect(later.error).toMatch(
      /přerušený pokus, obnova z deníku se nepovoluje/,
    );
    expect(fills(b)).toBe(2);
  });

  it("povolení se spotřebuje před odesláním: i neúspěšný nový pokus potřebuje další gpt-retry", async () => {
    const b = new FakeBrowser(
      () => new UiUnknownError("krok selhal: timeout", []),
    );
    const c = checker(b);
    const run = () => c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    await run();
    expect(grantRetry(dir, "fable", "znovu").ok).toBe(true);
    await run();
    await run();
    await run();
    expect(fills(b)).toBe(2);
    expect(readJournal(dir)!.map((e) => e.state)).toEqual(["burned", "burned"]);
  });

  it("retryDir: jen id zakázky ve WAITING_REVIEW nebo běhu Konzilia, nikdy cesta", () => {
    const runs = fs.mkdtempSync(path.join(os.tmpdir(), "tars-runs-"));
    fs.mkdirSync(path.join(runs, "wo-1"));
    fs.writeFileSync(
      path.join(runs, "wo-1", "state.json"),
      JSON.stringify({ state: "WAITING_REVIEW" }),
    );
    fs.mkdirSync(path.join(runs, "wo-2"));
    fs.writeFileSync(
      path.join(runs, "wo-2", "state.json"),
      JSON.stringify({ state: "DONE" }),
    );
    fs.mkdirSync(path.join(runs, "konzilium", "konz-1"), { recursive: true });
    expect(retryDir(runs, "wo-1")).toEqual({ dir: path.join(runs, "wo-1") });
    expect(retryDir(runs, "konz-1")).toEqual({
      dir: path.join(runs, "konzilium", "konz-1"),
    });
    for (const bad of ["wo-2", "wo-3", "konz-2", "../wo-1", "wo-1/..", "x"])
      expect(retryDir(runs, bad), bad).toHaveProperty("error");
  });
});

describe("Codex review kolo 2, nález 2: oblast odpovědi = celá poslední zpráva asistenta (podle role)", () => {
  const turn =
    (answer: string[]): Script =>
    (steps) =>
      [
        BANNER,
        "- main:",
        "  - article:",
        `    - paragraph: ${JSON.stringify(sentPrompt(steps))}`,
        "  - article:",
        '    - heading "ChatGPT řekl:" [level=6]',
        ...answer.map((l) => l.replace("MARKER", markerOf(sentPrompt(steps)))),
        '    - button "Kopírovat" [ref=e20]',
        "- contentinfo:",
        "  - paragraph: ChatGPT může dělat chyby.",
      ].join("\n");

  it("PASS JSON a značka v blockquote, pak mimo citaci oprava na FIX ve stejné zprávě → WAITING_REVIEW", async () => {
    const r = await checker(
      new FakeBrowser(
        turn([
          "    - blockquote:",
          `      - paragraph: '${PASS_JSON}'`,
          "      - paragraph: MARKER",
          "    - paragraph: Oprava, správně je FIX s blokujícím nálezem.",
        ]),
      ),
    ).run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r).toMatchObject({ ok: false, waitReview: true });
    expect(r.error).toMatch(/za koncovou značkou/);
    // directly: the less indented line after the blockquote is still the same message
    const p = `  - article:\n    - blockquote:\n      - paragraph: ${MARKER}\n    - paragraph: Ale FIX.\n- contentinfo:`;
    expect(markerEndsAnswer(p, MARKER)).toBe(false);
  });

  it("citace (blockquote) s JSON a značkou a nic dalšího → neplatný formát; čistý jeden řádek JSON + značka → projde", async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
    const quoted = await checker(
      new FakeBrowser(
        turn([
          "    - blockquote:",
          `      - paragraph: '${PASS_JSON}'`,
          "      - paragraph: MARKER",
        ]),
      ),
    ).run("x", { cwd: d, outputSchema: REVIEW_SCHEMA });
    expect(quoted).toMatchObject({ ok: false, waitReview: true });
    expect(quoted.error).toMatch(/nejasný výsledek/);
    const ok = await checker(
      new FakeBrowser(
        turn([`    - paragraph: '${PASS_JSON}'`, "    - paragraph: MARKER"]),
      ),
    ).run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(ok).toMatchObject({ ok: true, text: PASS_JSON });
    // prose anywhere in the message (also before the JSON, in a deeper block) → unclear
    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
    const prose = await checker(
      new FakeBrowser(
        turn([
          "    - list:",
          "      - listitem: jen ukázka",
          `    - paragraph: '${PASS_JSON}'`,
          "    - paragraph: MARKER",
        ]),
      ),
    ).run("x", { cwd: d2, outputSchema: REVIEW_SCHEMA });
    expect(prose).toMatchObject({ ok: false, waitReview: true });
  });
});

describe("Codex review kolo 2, nález 5: tajemství → žádný soubor běhu s hodnotou (PNG, automatické snapshoty)", () => {
  const walk = (d: string): string[] =>
    fs.existsSync(d)
      ? fs
          .readdirSync(d, { withFileTypes: true })
          .flatMap((e) =>
            e.isDirectory()
              ? walk(path.join(d, e.name))
              : [path.join(d, e.name)],
          )
      : [];

  it("platný FIX s tokenem: automatický snapshot (.playwright-mcp v output-dir i vedle), PNG a čtení se smažou, zůstane jen redigovaný záznam", async () => {
    const leaky = JSON.stringify({
      verdict: "FIX",
      findings: [
        { severity: "medium", file: null, line: null, text: `token ${TOKEN}` },
      ],
    });
    const b = new FakeBrowser((steps) => page(sentPrompt(steps), leaky));
    const orig = b.run.bind(b);
    b.run = async (steps, shots, onSent) => {
      const out = await orig(steps, shots, onSent);
      // what the MCP server writes by itself: automatic snapshots (output dir = shots), screenshots, the reads
      fs.mkdirSync(path.join(shots!, "reads"), { recursive: true });
      fs.writeFileSync(
        path.join(shots!, "reads", "read-09.md"),
        out.rawReads.at(-1)!,
      );
      fs.writeFileSync(
        path.join(shots!, "page-2026-11-04T10-00-00.yml"),
        out.rawReads.at(-1)!,
      );
      fs.writeFileSync(
        path.join(shots!, "step-09-read.png"),
        Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          Buffer.from(TOKEN),
        ]),
      );
      fs.mkdirSync(path.join(dir, ".playwright-mcp"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, ".playwright-mcp", "page-1.yml"),
        out.rawReads.at(-1)!,
      );
      return out;
    };
    const c = checker(b);
    const r = await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA });
    expect(r).toMatchObject({ ok: false, text: "" });
    expect(r.waitReview).toBeUndefined();
    expect(r.error).toMatch(/secret-scan: github_token/);
    const files = walk(dir);
    expect(files.filter((f) => /check-gptweb-.*\.md$/.test(f))).toHaveLength(1);
    expect(
      files.filter(
        (f) =>
          /\.(png|yml)$/.test(f) || f.includes(`${path.sep}reads${path.sep}`),
      ),
    ).toEqual([]);
    for (const f of files)
      expect(fs.readFileSync(f).includes(TOKEN), f).toBe(false);
    expect(readJournal(dir)).toEqual([
      expect.objectContaining({
        state: "burned",
        reason: expect.stringMatching(/secret-scan/),
      }),
    ]);
    expect(JSON.stringify(readJournal(dir))).not.toContain(TOKEN);
  });

  it("tajemství v důvodu čekání (chybová hláška ovladače) → zapíše se jen redigovaně a odmítne, soubory běhu smazány", async () => {
    const b = new FakeBrowser(() => new Error(`chrome spadl ${TOKEN}`));
    const orig = b.run.bind(b);
    b.run = async (steps, shots, onSent) => {
      fs.mkdirSync(shots!, { recursive: true });
      fs.writeFileSync(
        path.join(shots!, "step-01-goto.png"),
        Buffer.from(`PNG ${TOKEN}`),
      );
      return orig(steps, shots, onSent);
    };
    const r = await checker(b).run("x", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/secret-scan/);
    const files = walk(dir);
    expect(files.some((f) => /check-gptweb-/.test(f))).toBe(true);
    for (const f of files)
      expect(fs.readFileSync(f).includes(TOKEN), f).toBe(false);
  });

  it("McpBrowser dá Playwright MCP --output-dir = složka shots běhu (automatické snapshoty nejdou do sdíleného .playwright-mcp)", () => {
    expect(
      playwrightMcpConfig("/s.sh", "/repo/runs", "/repo/runs/o/shots-x"),
    ).toEqual({
      mcpServers: {
        playwright: {
          command: "bash",
          args: ["/s.sh", "mcp"],
          env: {
            TARS_RUNS_DIR: "/repo/runs",
            TARS_MCP_OUTPUT_DIR: "/repo/runs/o/shots-x",
          },
        },
      },
    });
    const sh = fs.readFileSync(
      path.join(__dirname, "..", "guard", "tars-browser.sh"),
      "utf8",
    );
    expect(sh).toMatch(/args\+=\(--output-dir "\$out"\)/);
  });
});

describe("Codex review kolo 2, nález 4: brána nepustí klik, který spustí další generování", () => {
  const C = "mcp__playwright__browser_click";
  const sha = typedTextSha("prompt");
  const snap = [
    "### Page",
    "- Page URL: https://chatgpt.com/c/abc-123",
    "### Snapshot",
    "```yaml",
    '- button "Výběr modelu: GPT-6" [ref=e1]',
    '- menuitem "GPT-6" [ref=e2]',
    '- menuitem "GPT-5.6 Sol" [ref=e3]',
    '- radio "Vysoká" [ref=e4]',
    '- radio "Střední" [ref=e5]',
    '- tab "Chat" [ref=e6]',
    '- tab "Work" [ref=e7]',
    '- link "Nový chat" [ref=e8]',
    '- button "Regenerate" [ref=e10]',
    '- button "Retry" [ref=e11]',
    '- button "Znovu vygenerovat" [ref=e12]',
    '- button "Upravit zprávu" [ref=e13]',
    '- button "Pokračovat" [ref=e14]',
    '- button "Kopírovat" [ref=e15]',
    "- button [ref=e16]:",
    "  - img",
    "  - generic: Zkusit znovu",
    '- textbox "Ask" [ref=e20]',
    '- button "Send prompt" [ref=e21]',
    "```",
  ].join("\n");
  const state = () => {
    const st = emptyState();
    observeResponse(snap, st);
    return st;
  };

  it("po timeoutu v uloženém chatu: Regenerate / Retry / Znovu vygenerovat / Zkusit znovu se nepustí v žádném běhu (i jen čtecím)", () => {
    for (const ref of ["e10", "e11", "e12", "e16"]) {
      expect(
        gateMcpCall(C, { ref }, state(), undefined, undefined, true),
        ref,
      ).toMatch(/další generování/);
      expect(gateMcpCall(C, { ref }, state()), ref).toMatch(/další generování/);
      expect(gateMcpCall(C, { ref }, state(), undefined, sha), ref).toMatch(
        /další generování/,
      );
    }
  });

  it("kontrola GPT (přesný režim): kliká se jen na režim, model, intenzitu a nový chat; Upravit, Pokračovat, Work, Kopírovat a ostatní se odmítnou", () => {
    for (const ref of ["e1", "e2", "e3", "e4", "e6", "e8"])
      expect(
        gateMcpCall(C, { ref }, state(), undefined, sha),
        ref,
      ).toBeUndefined();
    for (const ref of ["e5", "e7", "e13", "e14", "e15"])
      expect(gateMcpCall(C, { ref }, state(), undefined, sha), ref).toMatch(
        /kliká jen na výběr režimu, modelu, intenzity a nový chat/,
      );
    // the one send stays allowed only after the verified content (unchanged rule)
    expect(gateMcpCall(C, { ref: "e21" }, state(), undefined, sha)).toMatch(
      /neodpovídá zadanému textu/,
    );
    // outside the exact mode (e.g. vizuál) ordinary clicks stay allowed
    expect(gateMcpCall(C, { ref: "e13" }, state())).toBeUndefined();
  });
});

describe("smoke 4. 11.: anglické popisky a otevřený popover intenzity (fixture ze živého běhu)", () => {
  // Snapshot page-2026-11-04T14-27-36-716Z.yml of the live smoke after login (sidebar and user name anonymized):
  // the picker "Vybrat model ChatGPT" open over the composer, label "Medium", slider in the middle (2 of 3).
  const FIXTURE = fs.readFileSync(
    path.join(__dirname, "fixtures", "chatgpt-smoke-20261104-picker-en.yml"),
    "utf8",
  );
  /** The same picker after End on the slider: the top step "High". */
  const AT_TOP = FIXTURE.replace(
    /Medium, 2 z\(e\) 3\./,
    "High, 3 z(e) 3.",
  ).replace(/Medium/g, "High");
  const MENU_AT = AT_TOP.indexOf('\n  - menu "Vybrat model ChatGPT"');
  /** The picker closed (Escape): no menu, the picker button no longer expanded. */
  const CLOSED = `${AT_TOP.slice(0, MENU_AT)}\n`.replace(
    'button "Vybrat model ChatGPT" [expanded] [ref=e766]',
    'button "Vybrat model ChatGPT" [ref=e766]',
  );
  /** The open picker as a top-level element (after the conversation, like the portal of the live page). */
  const MENU = AT_TOP.slice(MENU_AT + 1)
    .split("\n")
    .map((l) => l.slice(2))
    .join("\n");
  const PROMPT = "Posuď zadání.\n\nKód: abc";
  const sha = typedTextSha(PROMPT);
  /** The composer holding `paragraphs` (and the send button that ChatGPT shows once the field has text). */
  const typed = (paragraphs: string[]) =>
    CLOSED.replace(
      "                    - paragraph: Zeptat se ChatGPT",
      paragraphs
        .map((p) => `                    - paragraph${p ? `: ${p}` : ""}`)
        .join("\n"),
    ).replace(
      'button "Zahájit hlasovou konverzaci" [ref=e787]',
      'button "Odeslat výzvu" [ref=e900]',
    );
  const resp = (yaml: string) =>
    `### Page\n- Page URL: https://chatgpt.com/\n### Snapshot\n\`\`\`yaml\n${yaml}\n\`\`\``;
  const T = "mcp__playwright__browser_type";
  const C = "mcp__playwright__browser_click";
  const K = "mcp__playwright__browser_press_key";

  it("detectModel čte model z označené položky a intenzitu s polohou posuvníku: Medium (2/3) = neshoda, High (3/3) = shoda, Max = Work", () => {
    expect(detectModel(FIXTURE)).toEqual({
      model: "GPT-6",
      intensity: "Medium",
      level: 2,
      levels: 3,
    });
    expect(detectModel(AT_TOP)).toEqual({
      model: "GPT-6",
      intensity: "High",
      level: 3,
      levels: 3,
    });
    // the checked radio decides, not the first model of the list
    const sol = AT_TOP.replace(
      "menuitemradio [checked]:",
      "menuitemradio:",
    ).replace(
      /(- menuitemradio):\n(\s+- generic: GPT-5\.6 Sol)/,
      "$1 [checked]:\n$2",
    );
    expect(detectModel(sol).model).toBe("GPT-5.6 Sol");
    // Czech labels work the same way
    expect(detectModel(AT_TOP.replace(/High/g, "Vysoká")).intensity).toBe(
      "Vysoká",
    );
    // the closed picker shows no model: nothing is guessed
    expect(detectModel(CLOSED).model).toBeUndefined();
  });

  it("brána: popover zavřen klávesou, posuvník na High, pak pole prázdné (nápověda není text), jedno ověřené odeslání; jiný text v poli nikdy neprojde", () => {
    const st = emptyState();
    observeResponse(resp(FIXTURE), st);
    expect(st.overlay).toBe(true);
    // the placeholder "Zeptat se ChatGPT" is not content: the empty field reads as empty
    expect(st.refs.e758.content).toBe("");
    // with the picker open the prompt is not typed
    expect(
      gateMcpCall(T, { ref: "e758", text: PROMPT }, st, undefined, sha),
    ).toMatch(/otevřené menu nebo popover/);
    // the slider and its menu item may be clicked, the model item too; Work never
    for (const ref of ["e825", "e836", "e816", "e766"])
      expect(gateMcpCall(C, { ref }, st, undefined, sha), ref).toBeUndefined();
    expect(gateMcpCall(C, { ref: "e696" }, st, undefined, sha)).toMatch(
      /kliká jen/,
    );
    // keys: only the allowed ones, only in the exact mode
    for (const key of ["End", "ArrowRight", "Escape"])
      expect(gateMcpCall(K, { key }, st, undefined, sha), key).toBeUndefined();
    for (const key of ["Enter", "Control+Enter", "a", ""])
      expect(gateMcpCall(K, { key }, st, undefined, sha), key).toMatch(
        /není povolena/,
      );
    expect(gateMcpCall(K, { key: "Escape" }, st)).toMatch(
      /není pro prohlížeč TARS povolen/,
    );
    expect(gateMcpCall(K, { key: "Escape" }, st, undefined, sha, true)).toMatch(
      /není pro prohlížeč TARS povolen/,
    );
    countCall(K, { key: "End" }, st);
    observeResponse(resp(AT_TOP), st);
    // Escape closes the picker; the field is visible, empty and gets the focus (click)
    countCall(K, { key: "Escape" }, st);
    observeResponse(resp(CLOSED), st);
    expect(st.overlay).toBe(false);
    expect(st.refs.e758.content).toBe("");
    expect(gateMcpCall(C, { ref: "e758" }, st, undefined, sha)).toBeUndefined();
    countCall(C, { ref: "e758" }, st);
    // unchanged procedure: clear, snapshot, type, snapshot, compare sha256, one send
    expect(
      gateMcpCall(T, { ref: "e758", text: "" }, st, undefined, sha),
    ).toBeUndefined();
    countCall(T, { ref: "e758", text: "" }, st);
    observeResponse(resp(CLOSED), st);
    expect(
      gateMcpCall(T, { ref: "e758", text: PROMPT }, st, undefined, sha),
    ).toBeUndefined();
    countCall(T, { ref: "e758", text: PROMPT }, st);
    // another text left in the field next to the prompt: no send
    observeResponse(resp(typed(["A rozepsáno", ...PROMPT.split("\n")])), st);
    expect(gateMcpCall(C, { ref: "e900" }, st, undefined, sha)).toMatch(
      /neodpovídá zadanému textu/,
    );
    // a key after typing makes the content unknown until the next snapshot
    countCall(K, { key: "End" }, st);
    observeResponse(resp(typed(PROMPT.split("\n"))), st);
    countCall(K, { key: "End" }, st);
    expect(gateMcpCall(C, { ref: "e900" }, st, undefined, sha)).toMatch(
      /neodpovídá zadanému textu/,
    );
    // the field holds exactly the prompt → the one send
    observeResponse(resp(typed(PROMPT.split("\n"))), st);
    expect(gateMcpCall(C, { ref: "e900" }, st, undefined, sha)).toBeUndefined();
    countCall(C, { ref: "e900" }, st);
    expect(st.submits).toBe(1);
    // after the send: no key, no typing, no second send
    expect(gateMcpCall(K, { key: "Escape" }, st, undefined, sha)).toMatch(
      /po odeslání/,
    );
    expect(gateMcpCall(C, { ref: "e900" }, st, undefined, sha)).toMatch(
      /po odeslání/,
    );
    // a field with another text than its placeholder is not empty
    const other = emptyState();
    observeResponse(resp(typed(["Jiný text"])), other);
    expect(other.refs.e758.content).toBe("Jiný text");
  });

  it("plán: výběr intenzity česky i anglicky (nejvyšší stupeň, nikdy Max), čtení s otevřeným výběrem, zavření popoverů před vyplněním", () => {
    const steps = chatGptSteps("prompt", MARKER);
    expect(steps.map((s) => s.kind)).toEqual([
      "goto",
      "wait",
      "choose",
      "choose",
      "choose",
      "open",
      "read",
      "close_popups",
      "fill",
      "wait_text",
      "open",
      "read",
    ]);
    steps.forEach((s) => expect(() => checkStep(s)).not.toThrow());
    const intensity = steps[4] as Extract<BrowserStep, { kind: "choose" }>;
    expect(intensity.what).toMatch(
      /Nízká \/ Střední \/ Vysoká nebo Low \/ Medium \/ High/,
    );
    expect(intensity.fallback).toMatch(/„High“/);
    expect(intensity.fallback).toMatch(/nejvyšší stupeň/);
    expect(intensity.fallback).toMatch(/nikdy „Max“/);
    const task = buildTask(steps, "shots");
    expect(task).toMatch(/browser_press_key s klávesou "Escape"/);
    expect(task).toMatch(/Klikni do pole/);
    expect(task).toMatch(/Vyčisti ho: browser_type do pole s text ""/);
  });

  it("checker: před odesláním i po odpovědi otevřený výběr s GPT-6 · High (3/3) → shoda; Medium před odesláním nebo Max → WAITING_REVIEW", async () => {
    const answered =
      (menu: string): Script =>
      (steps) =>
        [
          "- main:",
          "  - article:",
          `    - paragraph: ${JSON.stringify(sentPrompt(steps))}`,
          "  - article:",
          '    - heading "ChatGPT řekl:" [level=6]',
          `    - paragraph: '${PASS_JSON}'`,
          `    - paragraph: ${markerOf(sentPrompt(steps))}`,
          menu,
        ].join("\n");
    const ok = new FakeBrowser(answered(MENU));
    ok.before = AT_TOP;
    const c = checker(ok);
    expect(
      await c.run("x", { cwd: dir, outputSchema: REVIEW_SCHEMA }),
    ).toMatchObject({ ok: true, text: PASS_JSON });
    expect(c.model).toBe("GPT-6 · High");
    expect(c.lastRecord).toMatchObject({
      status: "ANSWER",
      model_matches: true,
    });

    const mid = new FakeBrowser(answered(MENU));
    mid.before = FIXTURE; // Medium, 2 of 3
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
    const r = await checker(mid).run("x", {
      cwd: d,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: false, waitReview: true });
    expect(r.error).toMatch(
      /před odesláním neodpovídá.*GPT-6 · Medium \(stupeň 2\/3\)/,
    );

    // the top step with another label than High/Vysoká is a mismatch
    const odd = new FakeBrowser(
      answered(MENU.replace(/High, 3 z\(e\) 3\./, "Medium, 3 z(e) 3.")),
    );
    odd.before = AT_TOP;
    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
    expect(
      (await checker(odd).run("x", { cwd: d2, outputSchema: REVIEW_SCHEMA }))
        .error,
    ).toMatch(/neodpovídá požadovanému/);

    const max = MENU.replace(/High, 3 z\(e\) 3\./, "Max, 4 z(e) 4.");
    const work = new FakeBrowser(answered(max));
    work.before = AT_TOP;
    const d3 = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
    expect(
      (await checker(work).run("x", { cwd: d3, outputSchema: REVIEW_SCHEMA }))
        .error,
    ).toMatch(/běží v režimu Work místo Chat/);
  });
  describe("Codex review PR #101 kolo 1: model a intenzita jen z otevřeného výběru, nikdy z textu stránky", () => {
    /** A chat in the history titled like an allowed model at the top intensity (the attack of the finding). */
    const withHistory = (page: string) =>
      page.replace(/Ukázkový chat/g, "GPT-6 High");
    const answered =
      (tail: string): Script =>
      (steps) =>
        [
          withHistory(CLOSED).trimEnd(),
          "  - article:",
          `    - paragraph: ${JSON.stringify(sentPrompt(steps))}`,
          "  - article:",
          '    - heading "ChatGPT řekl:" [level=6]',
          `    - paragraph: '${PASS_JSON}'`,
          `    - paragraph: ${markerOf(sentPrompt(steps))}`,
          ...(tail ? [tail] : []),
        ].join("\n");
    const OPEN_HIGH = AT_TOP.slice(MENU_AT + 1).trimEnd();
    const OPEN_MEDIUM = FIXTURE.slice(
      FIXTURE.indexOf('\n  - menu "Vybrat model ChatGPT"') + 1,
    ).trimEnd();
    const run = async (b: FakeBrowser) => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
      const c = checker(b);
      const r = await c.run("x", { cwd: d, outputSchema: REVIEW_SCHEMA });
      return { r, c };
    };

    it("chat „GPT-6 High“ v historii a zavřený výběr (před odesláním i po odpovědi) → WAITING_REVIEW „stav modelu neověřen z ovládacího prvku“, nikdy PASS", async () => {
      expect(detectModel(withHistory(CLOSED))).toEqual({});
      const b = new FakeBrowser(answered(""));
      b.before = withHistory(CLOSED);
      const { r, c } = await run(b);
      expect(r).toMatchObject({ ok: false, waitReview: true, text: "" });
      expect(r.error).toMatch(/stav modelu neověřen z ovládacího prvku/);
      expect(c.lastRecord).toMatchObject({
        status: "WAITING_REVIEW",
        model_matches: false,
      });
      expect(c.model).toMatch(/^neověřeno/);
    });

    it("výběr otevřený jen v jednom ze dvou čtení → WAITING_REVIEW „stav modelu neověřen z ovládacího prvku“", async () => {
      // open after the answer, closed before the send
      const b1 = new FakeBrowser(answered(OPEN_HIGH));
      b1.before = withHistory(CLOSED);
      const x1 = await run(b1);
      expect(x1.r).toMatchObject({ ok: false, waitReview: true });
      expect(x1.r.error).toMatch(
        /stav modelu neověřen z ovládacího prvku \(před odesláním/,
      );
      // open before the send, closed after the answer
      const b2 = new FakeBrowser(answered(""));
      b2.before = withHistory(AT_TOP);
      const x2 = await run(b2);
      expect(x2.r).toMatchObject({ ok: false, waitReview: true });
      expect(x2.r.error).toMatch(
        /stav modelu neověřen z ovládacího prvku \(po odpovědi/,
      );
    });

    it("otevřený výběr s Medium (i když historie ukazuje „GPT-6 High“) → neshoda, WAITING_REVIEW", async () => {
      expect(detectModel(withHistory(FIXTURE))).toEqual({
        model: "GPT-6",
        intensity: "Medium",
        level: 2,
        levels: 3,
      });
      const b = new FakeBrowser(answered(OPEN_MEDIUM));
      b.before = withHistory(FIXTURE);
      const { r, c } = await run(b);
      expect(r).toMatchObject({ ok: false, waitReview: true });
      expect(r.error).toMatch(/model nebo intenzita neodpovídá/);
      expect(c.model).toBe("GPT-6 · Medium (stupeň 2/3)");
    });

    it("otevřený výběr s High 3/3 a označeným GPT-6 (před odesláním i po odpovědi) → shoda", async () => {
      const b = new FakeBrowser(answered(OPEN_HIGH));
      b.before = withHistory(AT_TOP);
      const { r, c } = await run(b);
      expect(r).toMatchObject({ ok: true, text: PASS_JSON });
      expect(c.model).toBe("GPT-6 · High");
      expect(c.lastRecord).toMatchObject({
        status: "ANSWER",
        model_matches: true,
      });
    });

    it("jen podstrom menu „Vybrat model ChatGPT“: jiné menu, text odpovědi, dvě označené položky nebo dva výběry se nepočítají", () => {
      // another menu (e.g. chat actions) with a checked radio and a status is not the picker
      const other = OPEN_HIGH.replace(
        'menu "Vybrat model ChatGPT"',
        'menu "Akce chatu"',
      );
      expect(detectModel(`${withHistory(CLOSED)}${other}`)).toEqual({});
      // the picker name or a status as text of the answer is not the picker
      expect(
        detectModel(
          `${CLOSED}  - paragraph: 'menu "Vybrat model ChatGPT": status: High, 3 z(e) 3. menuitemradio [checked]: GPT-6'`,
        ),
      ).toEqual({});
      // text outside the menu subtree (a sibling after it) never adds a model or an intensity
      const sibling = `${CLOSED}${OPEN_HIGH.replace("menuitemradio [checked]:", "menuitemradio:")}\n  - menuitemradio [checked]:\n    - generic: GPT-6\n  - status: High, 3 z(e) 3.`;
      expect(detectModel(sibling).model).toBeUndefined();
      // two checked radios or two pickers are ambiguous
      const twoChecked = OPEN_HIGH.replace(
        /(- menuitemradio):\n(\s+- generic: GPT-5\.6 Sol)/,
        "$1 [checked]:\n$2",
      );
      expect(detectModel(`${CLOSED}${twoChecked}`)).toEqual({});
      expect(detectModel(`${CLOSED}${OPEN_HIGH}\n${OPEN_HIGH}`)).toEqual({});
    });

    it("brána: při otevřeném menu se pole nevyčistí ani se neodešle; po zavření (Escape + snapshot) ano", () => {
      const st = emptyState();
      observeResponse(resp(FIXTURE), st);
      expect(st.overlay).toBe(true);
      // clearing the field with the picker open → denied
      expect(
        gateMcpCall(T, { ref: "e758", text: "" }, st, undefined, sha),
      ).toMatch(/otevřené menu nebo popover.*nic se nepíše ani nečistí/);
      // the field holds exactly the prompt, but the picker is open again → no send
      const typedOpen = `${typed(PROMPT.split("\n"))}${OPEN_HIGH}`;
      observeResponse(resp(typedOpen), st);
      expect(st.overlay).toBe(true);
      st.typedRef = "e758";
      expect(gateMcpCall(C, { ref: "e900" }, st, undefined, sha)).toMatch(
        /otevřené menu nebo popover.*nic se neodesílá/,
      );
      // closed: the same field and the same send are allowed
      observeResponse(resp(typed(PROMPT.split("\n"))), st);
      expect(st.overlay).toBe(false);
      expect(
        gateMcpCall(C, { ref: "e900" }, st, undefined, sha),
      ).toBeUndefined();
      expect(
        gateMcpCall(T, { ref: "e758", text: "" }, st, undefined, sha),
      ).toBeUndefined();
    });

    it("plán: krok open je povinný a končí UNKNOWN, když výběr nejde otevřít", () => {
      const task = buildTask(chatGptSteps("prompt", MARKER), "shots");
      expect(task).toMatch(/Povinný krok: browser_snapshot/);
      expect(task).toMatch(/RESULT: UNKNOWN vyber-modelu-neotevren/);
    });
  });
});

describe("smoke 4. 11., pokus 2: výběr modelu se neotevřel (fixture ze živého běhu) + opakované otevření", () => {
  // Snapshot page-2026-11-04T20-33-50-199Z.yml of the second live smoke (sidebar, user name and suggestion anonymized):
  // mode Chat pressed, the picker "Vybrat model ChatGPT" closed with "High". In that run both browser_click calls on
  // e766 (and on e695 "Chat") ended "Timeout 5000ms … waiting for element to be visible, enabled and stable".
  const S2 = fs.readFileSync(
    path.join(
      __dirname,
      "fixtures",
      "chatgpt-smoke2-20261104-picker-closed.yml",
    ),
    "utf8",
  );
  /** The open picker of the first live smoke (High, 3 of 3), as the snapshot after a successful opening shows it. */
  const OPEN = fs
    .readFileSync(
      path.join(__dirname, "fixtures", "chatgpt-smoke-20261104-picker-en.yml"),
      "utf8",
    )
    .replace(/Medium, 2 z\(e\) 3\./, "High, 3 z(e) 3.")
    .replace(/Medium/g, "High");
  const resp = (yaml: string) =>
    `### Page\n- Page URL: https://chatgpt.com/\n### Snapshot\n\`\`\`yaml\n${yaml}\n\`\`\``;
  const C = "mcp__playwright__browser_click";
  const K = "mcp__playwright__browser_press_key";
  const S = "mcp__playwright__browser_snapshot";
  const sha = typedTextSha("prompt");

  it("fixture: zavřený výběr nedává žádný stav (kód ho nepřijme); brána klik na výběr i na Chat povoluje (příčina nebyla brána)", () => {
    expect(detectModel(S2)).toEqual({});
    const refs = parseSnapshotRefs(S2);
    expect(refs.e766).toMatchObject({
      role: "button",
      name: CHATGPT_PICKER,
      ok: true,
      submit: false,
    });
    expect(chatClickAllowed(refs.e766.role, refs.e766.name)).toBe(true);
    expect(refs.e695).toMatchObject({ role: "button", name: "Chat" });
    const st = emptyState();
    observeResponse(resp(S2), st);
    expect(st.overlay).toBe(false);
    expect(
      gateMcpCall(
        C,
        { target: "e766", element: CHATGPT_PICKER },
        st,
        undefined,
        sha,
      ),
    ).toBeUndefined();
  });

  it("opakovaný pokus: klik s timeoutem → nový snapshot → nový klik → otevřený výběr (GPT-6 · High 3/3); Escape pak výběr zavře", () => {
    const st = emptyState();
    const call = (tool: string, input: Record<string, unknown>) => {
      const why = gateMcpCall(tool, input, st, undefined, sha);
      if (!why) countCall(tool, input, st);
      return why;
    };
    // pokus 1: snapshot (closed) → click allowed; the click times out, so no response is observed
    expect(call(S, {})).toBeUndefined();
    observeResponse(resp(S2), st);
    expect(
      call(C, { target: "e766", element: CHATGPT_PICKER }),
    ).toBeUndefined();
    // pokus 2: a fresh snapshot (still closed) → the click is allowed again
    expect(call(S, {})).toBeUndefined();
    observeResponse(resp(S2), st);
    expect(
      call(C, { target: "e766", element: CHATGPT_PICKER }),
    ).toBeUndefined();
    // the snapshot after the click shows the open picker: state readable only now
    expect(call(S, {})).toBeUndefined();
    observeResponse(resp(OPEN), st);
    expect(st.overlay).toBe(true);
    expect(detectModel(OPEN)).toEqual({
      model: "GPT-6",
      intensity: "High",
      level: 3,
      levels: 3,
    });
    // Escape (allowed in exact mode) and a snapshot: the picker is closed again
    expect(call(K, { key: "Escape" })).toBeUndefined();
    observeResponse(resp(S2), st);
    expect(st.overlay).toBe(false);
    // a ref missing in the last snapshot is never clicked (the driver must take the ref from a fresh snapshot)
    observeResponse(resp(OPEN.replace(/\[ref=e766\]/g, "[ref=e999]")), st);
    expect(call(C, { target: "e766" })).toMatch(
      /není ref z posledního snapshotu/,
    );
    expect(st.calls).toBe(6); // 3 snapshots, 2 clicks, Escape; the denied click is not counted
    expect(st.submits).toBe(0);
  });

  it("plán: výběr modelu i intenzity a krok open otevírají výběr nejvýš 3× s novým snapshotem a Escape; po 3 nezdarech UNKNOWN", () => {
    expect(PICKER_OPEN_ATTEMPTS).toBe(3);
    const steps = chatGptSteps("prompt", MARKER);
    const chooses = steps.filter(
      (s): s is Extract<BrowserStep, { kind: "choose" }> => s.kind === "choose",
    );
    expect(chooses.map((s) => s.picker)).toEqual([
      undefined,
      CHATGPT_PICKER,
      CHATGPT_PICKER,
    ]);
    steps.forEach((s) => expect(() => checkStep(s)).not.toThrow());
    const task = buildTask(steps, "shots");
    const lines = task.split(/\n(?=\d+\. )/);
    const procedure =
      /Otevření výběru „Vybrat model ChatGPT“ \(nejvýš 3 pokusy/;
    // steps 4 + 5 (model, intensity) and 6 + 11 (open): the retried procedure; step 3 (mode) has none
    for (const n of [4, 5, 6, 11]) {
      const l = lines.find((x) => x.startsWith(`${n}. `))!;
      expect(l, `krok ${n}`).toMatch(procedure);
      expect(l).toMatch(/browser_press_key s klávesou "Escape"/);
      expect(l).toMatch(/ref z PRÁVĚ TOHOTO snapshotu/);
      expect(l).toMatch(/Timeout … visible, enabled and stable/);
      expect(l).toContain(`RESULT: UNKNOWN ${PICKER_NOT_OPEN}`);
      expect(l).toMatch(/kód stav bez otevřeného výběru nepřijme/);
    }
    const mode = lines.find((x) => x.startsWith("3. "))!;
    expect(mode).not.toMatch(/Otevření výběru/);
    expect(mode).toMatch(/„Chat“ už vybraná \(pressed\/checked\), neklikej/);
    expect(task).toMatch(/otevření výběru nejvýš 3×/);
    // the send is still one exact fill and never repeated
    expect(task).toMatch(/Odeslání textu \(submit\) nikdy neopakuj/);
  });

  it("fail-closed: výběr se neotevřel ani po opakování → nic neodesláno, WAITING_REVIEW s důvodem ovladače", async () => {
    const b = new FakeBrowser(
      () =>
        new UiUnknownError(
          `text nebyl odeslán právě jednou po ověření obsahu pole (odesláno: 0; ovladač: ${PICKER_NOT_OPEN})`,
          [],
        ),
      () => ({ submitted: false }),
    );
    const c = checker(b);
    const r = await c.run("Posuď zadání.", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: false, waitReview: true, text: "" });
    expect(r.error).toContain(PICKER_NOT_OPEN);
    expect(c.lastRecord).toMatchObject({
      status: "WAITING_REVIEW",
      model_matches: false,
    });
    // provably not sent: the attempt does not stay in the journal as sent or burned
    expect((readJournal(dir) ?? []).some((e) => e.state === "sent")).toBe(
      false,
    );
    expect(b.calls).toHaveLength(1);
  });

  it("fail-closed: ovladač tvrdí OK, ale čtení před odesláním ukazuje jen zavřený výběr (pokus 2) → WAITING_REVIEW, nikdy odpověď", async () => {
    const b = new FakeBrowser((steps) =>
      [
        S2.trimEnd(),
        "  - article:",
        `    - paragraph: ${JSON.stringify(sentPrompt(steps))}`,
        "  - article:",
        `    - paragraph: '${PASS_JSON}'`,
        `    - paragraph: ${markerOf(sentPrompt(steps))}`,
        OPEN.slice(OPEN.indexOf('\n  - menu "Vybrat model ChatGPT"') + 1)
          .split("\n")
          .map((l) => l.slice(2))
          .join("\n"),
      ].join("\n"),
    );
    b.before = S2;
    const c = checker(b);
    const r = await c.run("Posuď zadání.", {
      cwd: dir,
      outputSchema: REVIEW_SCHEMA,
    });
    expect(r).toMatchObject({ ok: false, waitReview: true, text: "" });
    expect(r.error).toMatch(
      /stav modelu neověřen z ovládacího prvku.*před odesláním/,
    );
  });
});

describe("smoke 4. 11., pokus 1: prompt smoke nekoliduje s koncovou značkou", () => {
  it("text smoke nevylučuje značku (žádné „jen“, „pouze“, „only“), chce slovo OK; značka zůstává poslední pokyn i u krátké odpovědi", () => {
    expect(GPT_SMOKE_PROMPT).not.toMatch(
      /\b(jen|jenom|pouze|výhradně|only|nic jiného|nic víc)\b/i,
    );
    expect(GPT_SMOKE_PROMPT).toMatch(/\bOK\b/);
    expect(GPT_SMOKE_PROMPT).not.toContain(END_WORD);
    const full = GPT_SMOKE_PROMPT + answerInstructions(NONCE);
    expect(full).toMatch(new RegExp(`Kód: ${NONCE}$`)); // the nonce is still the very last word
    expect(markerOf(full)).toBe(MARKER);
    expect(full).toMatch(/Značka je povinná i u velmi krátké odpovědi/);
    expect(full).toContain(END_WORD);
    // the schema variant keeps the same marker rule
    expect(answerInstructions(NONCE, REVIEW_SCHEMA)).toMatch(
      /Značka je povinná i u velmi krátké odpovědi[\s\S]*Kód: n0nce42$/,
    );
  });

  it("said_ok: slovo OK v odpovědi; nic jiného", () => {
    expect(smokeSaidOk("OK")).toBe(true);
    expect(smokeSaidOk("OK.")).toBe(true);
    expect(smokeSaidOk("Rozumím, OK")).toBe(true);
    expect(smokeSaidOk("BOOK")).toBe(false);
    expect(smokeSaidOk("nevím")).toBe(false);
    expect(smokeSaidOk("")).toBe(false);
  });

  it("checker se smoke promptem: odpověď „OK“ se značkou → ok a said_ok (text je jen odpověď, ne ozvěna promptu); „OK“ bez značky → čeká, nic se nepřijme", async () => {
    const ok = new FakeBrowser(answering("OK"));
    const r = await checker(ok).run(GPT_SMOKE_PROMPT, { cwd: dir });
    expect(r.ok, r.error).toBe(true);
    expect(smokeSaidOk(r.text)).toBe(true);
    expect(r.text).not.toMatch(/Kontrola spojení/);
    expect(sentPrompt(ok.calls[0])).toMatch(
      new RegExp(`^${GPT_SMOKE_PROMPT.replace(/\./g, "\\.")}`),
    );

    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), "tars-gptweb-"));
    const noMarker = new FakeBrowser((steps) =>
      [
        "- main:",
        `  - paragraph: ${JSON.stringify(sentPrompt(steps))}`,
        "  - paragraph: OK",
        `  - ${picker()}`,
      ].join("\n"),
    );
    const r2 = await checker(noMarker).run(GPT_SMOKE_PROMPT, { cwd: d2 });
    expect(r2).toMatchObject({ ok: false, waitReview: true });
    expect(r2.error).toMatch(/koncová značka chybí/);
  });
});
