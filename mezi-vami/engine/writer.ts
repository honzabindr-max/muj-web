// Textový engine: z odvozeného výpočtu napíše bloky stránky Vztahové DNA.
// Model je vyměnitelný (MEZI_VAMI_WRITER_MODEL, výchozí Claude Haiku). Jména model nedostává
// a do DB se neukládají: v textu jsou místa {A1}…{A7} / {B1}…{B7} (pád 1–7), která prohlížeč
// nahradí oslovením ve správném tvaru.

import { z } from "zod";
import { BODY_CS, ASPECTS, SIGN_KEYWORDS, fmtDeg, rowTone, type Derived, type Body } from "./astro";
import { generateStructured, type Usage } from "../llm";

export const DEFAULT_WRITER_MODEL = "anthropic:claude-haiku-5-5";
export const PROMPT_VERSION = "writer-v1";

export const CHAPTERS = [
  "Nejdřív to nejdůležitější",
  "Jak každý z vás funguje ve vztahu",
  "Pět vztahů uvnitř jednoho",
  "Láska, přitažlivost a intimita",
  "Emoce, komunikace a konflikt",
  "Blízkost, svoboda a každodenní fungování",
  "Co v sobě probouzíte a co vztah drží pohromadě",
  "Na doma",
  "Pod kapotou",
];

export const ROW_BODIES: Body[] = ["sun", "moon", "venus", "mars"];

const PH = /\{[AB][1-7]\}/;

export const WriterOutputSchema = z.object({
  mainTheme: z.object({ title: z.string().min(3).max(90), line: z.string().min(3).max(180) }),
  rows: z
    .array(
      z.object({
        a: z.string().min(2).max(90),
        b: z.string().min(2).max(90),
        ton: z.enum(["ladite", "trete", "plynete"]),
        veta: z.string().min(5).max(260),
      }),
    )
    .length(4),
  zaverVeta: z.string().max(240),
  temata: z
    .array(
      z.object({
        aspectIds: z.array(z.string()).min(1).max(2),
        nadpis: z.string().min(3).max(110),
        text: z.string().min(80).max(1100),
        schvalne: z.string().max(200),
        dukazy: z.array(z.object({ aspectId: z.string(), text: z.string().min(5).max(240) })).min(1).max(3),
      }),
    )
    .min(3)
    .transform((a) => a.slice(0, 5)),
  otazky: z
    .array(z.object({ otazka: z.string().min(10).max(220), kapitola: z.number().int().min(1).max(9) }))
    .length(5),
});
export type WriterOutput = z.infer<typeof WriterOutputSchema>;

const str = (max: number) => ({ type: "string", maxLength: max });
const OUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["mainTheme", "rows", "zaverVeta", "temata", "otazky"],
  properties: {
    mainTheme: {
      type: "object",
      additionalProperties: false,
      required: ["title", "line"],
      properties: { title: str(60), line: str(90) },
    },
    rows: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["a", "b", "ton", "veta"],
        properties: {
          a: str(48),
          b: str(48),
          ton: { type: "string", enum: ["ladite", "trete", "plynete"] },
          veta: str(160),
        },
      },
    },
    zaverVeta: str(140),
    temata: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      description: "PŘESNĚ 5 témat",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["aspectIds", "nadpis", "text", "schvalne", "dukazy"],
        properties: {
          aspectIds: { type: "array", minItems: 1, maxItems: 2, items: { type: "string" } },
          nadpis: str(70),
          text: str(700),
          schvalne: str(120),
          dukazy: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["aspectId", "text"],
              properties: { aspectId: { type: "string" }, text: str(140) },
            },
          },
        },
      },
    },
    otazky: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["otazka", "kapitola"],
        properties: { otazka: str(130), kapitola: { type: "integer", minimum: 1, maximum: 9 } },
      },
    },
  },
};

const ROD = { m: "mužský rod", f: "ženský rod", neutral: "neutrálně (vyhni se tvarům minulého času s rodovou koncovkou; piš v přítomném čase)" };

const SYSTEM = `Jsi autor Vztahové DNA produktu MEZI VÁMI. Píšeš česky o dynamice mezi dvěma lidmi
z jejich astrologické synastrie. Hlas: „přesný spolupachatel s disciplínou prémiového odhalení“.
Tónová sekvence každého bloku: přesnost → poznání („to jsme my“) → lehký humor → úžas.

PRAVIDLA
- Popisuješ sklony, ne osud. Žádné předpovědi, diagnózy, zdraví, peníze, nevěra, rozchod.
- Humor musí fungovat pro oba zároveň; nikdy si nedělá terč z jednoho z nich.
- Konkrétní situace ze všedního dne (klíčky, sobota, stěhování skříně), ne obecné fráze.
- Žádná astrologická hantýrka v textech témat (planety a aspekty jsou jen v „dukazy“ a v datech).
- Jména neznáš. Místo jmen piš zástupné značky v potřebném pádě: {A1}…{A7} pro první osobu,
  {B1}…{B7} pro druhou (číslo = pád: 1 kdo/co, 2 koho/čeho, 3 komu/čemu, 4 koho/co, 6 o kom,
  7 s kým). Příklad: „Když {B1} vysloví nápad, {A1} už hledá klíčky.“ „Vedle {B2} je {A1} odvážnější.“
- Shoda s rodem osoby (zadaný rod) ve slovesech a přídavných jménech.
- Typografie: české uvozovky „…“, pomlčka –, žádné emoji.

VÝSTUP
- mainTheme: hlavní téma = vazba s nejvyšší vahou (první v seznamu). title = VLASTNÍ krátký název
  této vazby (max ~30 znaků, končí tečkou; nepřebírej příklady z tohoto zadání); line jedna krátká věta.
- rows: přesně 4 řádky v pořadí Slunce (kým je), Měsíc (co potřebuje k bezpečí), Venuše (jak miluje),
  Mars (jak jde do věcí). a/b = krátká charakteristika PODLE KLÍČOVÝCH SLOV ZNAMENÍ dané osoby (viz data),
  BEZ jmen („člověk vlastních pravidel“). ton: použij PŘESNĚ tón zadaný v datech u řádku.
  veta = jedna věta s oběma značkami, jak to spolu funguje, v souladu se zadaným tónem.
  Je-li u Měsíce znamení nejisté, piš opatrně.
- zaverVeta: vrať prázdný řetězec (větu skládá systém).
- temata: přesně 5 témat z nejsilnějších vazeb (první = hlavní téma). aspectIds jen z dodaného seznamu.
  text 3–5 vět (300–550 znaků), schvalne = otázka „Schválně: …?“ nebo prázdný řetězec (aspoň 3 témata ji mají),
  dukazy = ke každé vazbě jedna věta „Kde {A1} …, … s tím, jak {B1} …“ (bez symbolů).
- otazky: 5 otázek, které Vztahová DNA otevřela a rozvádí až placená Hloubková analýza; kapitola = číslo 1–9
  z tohoto seznamu: ${CHAPTERS.map((c, i) => `${i + 1} ${c}`).join("; ")}.`;

function summary(d: Derived): string {
  const person = (k: "a" | "b") => {
    const p = d[k];
    const label = k === "a" ? "PRVNÍ OSOBA ({A…})" : "DRUHÁ OSOBA ({B…})";
    const time = p.plusMinusMin === 0 ? "čas přesný" : p.known ? `čas ±${p.plusMinusMin} min` : "čas neznámý";
    const lines = p.positions.map((x) => {
      const unsure = x.possibleSigns.length > 1 ? ` (nejisté: ${x.possibleSigns.join("/")})` : "";
      return `  ${BODY_CS[x.body].name}: ${x.sign} ${fmtDeg(x.deg)}${unsure}`;
    });
    return `${label} – rod: ${ROD[p.styl]}; ${time}\n${lines.join("\n")}`;
  };
  const asp = d.aspects.slice(0, 12).map((a) => {
    const def = ASPECTS.find((x) => x.type === a.type)!;
    return `  ${a.id}: ${BODY_CS[a.a].name} {A} ${def.cs} ${BODY_CS[a.b].name} {B}, orb ${fmtDeg(a.orb)}, váha ${a.weight.toFixed(2)}${a.uncertain ? ", NEJISTÉ (čas)" : ""}`;
  });
  const TONE_CS = { ladite: "ladíte", trete: "třete se", plynete: "plynete" };
  const rows = ROW_BODIES.map((b, i) => {
    const pa = d.a.positions.find((p) => p.body === b)!;
    const pb = d.b.positions.find((p) => p.body === b)!;
    return `  řádek ${i + 1} ${BODY_CS[b].name}: {A} ${pa.sign} (${SIGN_KEYWORDS[pa.sign]}) × {B} ${pb.sign} (${SIGN_KEYWORDS[pb.sign]}) → TÓN ${rowTone(d, b)} (${TONE_CS[rowTone(d, b)]})`;
  });
  return `${person("a")}\n\n${person("b")}\n\nŘÁDKY „KDO JE KDO“ (tón je pevný):\n${rows.join("\n")}\n\nVAZBY (seřazené podle váhy):\n${asp.join("\n")}`;
}

/** Kontroly nad rámec schématu: značky, existující vazby, hlavní téma. */
export function checkWriterOutput(out: WriterOutput, d: Derived): string[] {
  const ids = new Set(d.aspects.slice(0, 12).map((a) => a.id));
  const errs: string[] = [];
  if (out.temata.length < 5) errs.push(`témat je jen ${out.temata.length}, musí jich být přesně 5`);
  out.temata.forEach((t, i) => {
    for (const id of [...t.aspectIds, ...t.dukazy.map((x) => x.aspectId)])
      if (!ids.has(id)) errs.push(`téma ${i + 1}: neznámá vazba ${id}`);
    if (!PH.test(t.text)) errs.push(`téma ${i + 1}: text bez značky jména`);
  });
  if (d.aspects[0] && out.temata[0]?.aspectIds[0] !== d.aspects[0].id)
    errs.push("první téma není hlavní vazba");
  return errs;
}

export type WriterResult = { output: WriterOutput; model: string; usage: Usage; promptVersion: string };

export async function writeDna(
  d: Derived,
  env: Record<string, string | undefined> = process.env,
): Promise<WriterResult> {
  const model = env.MEZI_VAMI_WRITER_MODEL || DEFAULT_WRITER_MODEL;
  let feedback = "";
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await generateStructured({
        model,
        system: SYSTEM,
        user: summary(d) + feedback,
        schema: OUT_SCHEMA,
        schemaName: "vztahova_dna",
        maxOutputTokens: 6000,
        timeoutMs: 120_000,
      });
      const output = WriterOutputSchema.parse(r.data);
      const errs = checkWriterOutput(output, d);
      if (errs.length && attempt === 0) {
        feedback = `\n\nOPRAV V PŘEDCHOZÍM POKUSU:\n- ${errs.join("\n- ")}`;
        lastErr = new Error(errs.join("; "));
        continue;
      }
      return { output, model: r.model, usage: r.usage, promptVersion: PROMPT_VERSION };
    } catch (e) {
      lastErr = e;
      feedback = `\n\nPŘEDCHOZÍ POKUS NEPROŠEL KONTROLOU (${e instanceof Error ? e.message.slice(0, 400) : "chyba"}). Dodrž délky a strukturu.`;
    }
  }
  throw lastErr;
}

/* ---------- skloňování oslovení (neukládá se) ---------- */

const CASES = ["nominativ", "genitiv", "dativ", "akuzativ", "vokativ", "lokal", "instrumental"] as const;
const FORMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...CASES],
  properties: Object.fromEntries(CASES.map((c) => [c, { type: "string", maxLength: 60 }])),
};
const NAMES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["a", "b"],
  properties: { a: FORMS_SCHEMA, b: FORMS_SCHEMA },
};

export async function declineNames(
  a: { nick: string; styl: string },
  b: { nick: string; styl: string },
  env: Record<string, string | undefined> = process.env,
): Promise<{ a: string[]; b: string[] }> {
  const model = env.MEZI_VAMI_WRITER_MODEL || DEFAULT_WRITER_MODEL;
  const r = await generateStructured({
    model,
    system:
      "Vyskloňuj česká oslovení (jméno, přezdívku). nominativ = kdo/co (Honzík), genitiv = bez koho (Honzíka), dativ = komu (Honzíkovi), akuzativ = koho vidím (Honzíka), vokativ = oslovení (Honzíku), lokal = o kom (o Honzíkovi), instrumental = s kým (s Honzíkem). Bez předložek. Zachovej velká písmena. Nerozumíš-li slovu, vrať ho všude beze změny.",
    user: `a: „${a.nick}“ (rod: ${a.styl})\nb: „${b.nick}“ (rod: ${b.styl})`,
    schema: NAMES_SCHEMA,
    schemaName: "sklonovani",
    maxOutputTokens: 500,
  });
  const F = z.object(Object.fromEntries(CASES.map((c) => [c, z.string().max(60)])) as Record<(typeof CASES)[number], z.ZodString>);
  const d = z.object({ a: F, b: F }).parse(r.data);
  return { a: CASES.map((c) => d.a[c]), b: CASES.map((c) => d.b[c]) };
}
