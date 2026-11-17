// Textový engine: z odvozeného výpočtu napíše bloky stránky Vztahové DNA.
// Model je vyměnitelný (MEZI_VAMI_WRITER_MODEL, výchozí GPT‑6.1 Sol), zadání má verze
// (writer-v1 = původní, writer-v2 = aktuální). Haiku zůstává jen jako srovnávací základ,
// ne jako tichá záloha. Jména model nedostává a do DB se neukládají: v textu jsou místa
// {A1}…{A7} / {B1}…{B7} (pád 1–7), která prohlížeč nahradí oslovením ve správném tvaru.

import { z } from "zod";
import { BODY_CS, ASPECTS, SIGN_KEYWORDS, fmtDeg, rowTone, type Derived, type Body } from "./astro";
import { generateStructured, type Usage } from "../llm";

export const DEFAULT_WRITER_MODEL = "openai:gpt-6.1-sol";
/** Skloňování oslovení zůstává na rychlém modelu (není to zákaznický text DNA). */
export const DEFAULT_NAMES_MODEL = "anthropic:claude-haiku-5-5";
export type PromptVersion = "writer-v1" | "writer-v2";
export const PROMPT_VERSION: PromptVersion = "writer-v2";

/** Schválené kapitoly Hloubkové analýzy (ID = pořadí, názvy z webu). Popisy obsahu zatím ne. */
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
const CHAPTER_IDS = CHAPTERS.map((_, i) => i + 1);

export const ROW_BODIES: Body[] = ["sun", "moon", "venus", "mars"];

const PH = /\{[AB][1-7]\}/;

/* ---------- uložený výstup (obě verze zadání) ---------- */

const upTo = <T extends z.ZodTypeAny>(item: T, min: number, max: number) =>
  z.array(item).min(min).transform((a) => a.slice(0, max));

const RowSchema = z.object({
  a: z.string().min(2).max(120),
  b: z.string().min(2).max(120),
  ton: z.enum(["ladite", "trete", "plynete"]).catch("plynete"),
  veta: z.string().min(5).max(320),
});
const TemaSchema = z.object({
  aspectIds: upTo(z.string(), 1, 2),
  nadpis: z.string().min(3).max(140),
  text: z.string().min(80).max(1400),
  schvalne: z.string().max(260).catch(""),
  dukazy: upTo(z.object({ aspectId: z.string(), text: z.string().min(5).max(300) }), 1, 3),
});

/** writer-v1: tolerantní (nadbytečné položky se oříznou), 3–5 témat, 3–5 otázek. */
export const WriterOutputSchema = z.object({
  mainTheme: z.object({ title: z.string().min(3).max(140), line: z.string().min(3).max(260) }),
  rows: upTo(RowSchema, 4, 4),
  zaverVeta: z.string().catch(""),
  temata: upTo(TemaSchema, 3, 5),
  otazky: upTo(z.object({ otazka: z.string().min(10).max(260), kapitola: z.number().int().min(1).max(9) }), 3, 5),
});

/** writer-v2: hlavní téma nese své vazby, 3–5 témat, 0–3 otázky navázané na kartu. */
export const WriterOutputV2Schema = z.object({
  mainTheme: z.object({
    title: z.string().min(3).max(140),
    line: z.string().min(3).max(260),
    aspectIds: upTo(z.string(), 1, 2),
  }),
  rows: upTo(RowSchema, 4, 4),
  zaverVeta: z.string().catch(""),
  temata: upTo(TemaSchema, 3, 5),
  otazky: z
    .array(
      z.object({
        otazka: z.string().min(10).max(260),
        kapitola: z.number().int(),
        tema: z.number().int(),
      }),
    )
    .catch([])
    .transform((a) => a.slice(0, 3)),
});

/** Společný tvar pro zobrazení (v1 nemá vazby hlavního tématu ani návaznost otázek). */
export type WriterOutput = {
  mainTheme: { title: string; line: string; aspectIds?: string[] };
  rows: z.infer<typeof RowSchema>[];
  zaverVeta: string;
  temata: z.infer<typeof TemaSchema>[];
  otazky: { otazka: string; kapitola: number; tema?: number }[];
};

export function parseStoredOutput(promptVersion: string, output: unknown): WriterOutput {
  return promptVersion === "writer-v2" ? WriterOutputV2Schema.parse(output) : WriterOutputSchema.parse(output);
}

/* ---------- writer-v1 (původní zadání, ponecháno pro srovnání) ---------- */

const str = (max: number) => ({ type: "string", maxLength: max });
const ROW_JSON = {
  type: "object",
  additionalProperties: false,
  required: ["a", "b", "ton", "veta"],
  properties: {
    a: str(48),
    b: str(48),
    ton: { type: "string", enum: ["ladite", "trete", "plynete"] },
    veta: str(160),
  },
};
const DUKAZY_JSON = {
  type: "array",
  minItems: 1,
  maxItems: 2,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["aspectId", "text"],
    properties: { aspectId: { type: "string" }, text: str(140) },
  },
};

const OUT_SCHEMA_V1 = {
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
    rows: { type: "array", minItems: 4, maxItems: 4, items: ROW_JSON },
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
          dukazy: DUKAZY_JSON,
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

const SYSTEM_V1 = `Jsi autor Vztahové DNA produktu MEZI VÁMI. Píšeš česky o dynamice mezi dvěma lidmi
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

/** Kontroly writer-v1 nad rámec schématu: značky, existující vazby, hlavní téma. */
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

/* ---------- writer-v2 (aktuální zadání) ---------- */

const OUT_SCHEMA_V2 = {
  type: "object",
  additionalProperties: false,
  required: ["mainTheme", "rows", "zaverVeta", "temata", "otazky"],
  properties: {
    mainTheme: {
      type: "object",
      additionalProperties: false,
      required: ["title", "line", "aspectIds"],
      properties: {
        title: str(30),
        line: str(90),
        aspectIds: { type: "array", minItems: 1, maxItems: 2, items: { type: "string" } },
      },
    },
    rows: { type: "array", minItems: 4, maxItems: 4, items: ROW_JSON },
    zaverVeta: { type: "string", maxLength: 0 },
    temata: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["aspectIds", "nadpis", "text", "schvalne", "dukazy"],
        properties: {
          aspectIds: { type: "array", minItems: 1, maxItems: 2, items: { type: "string" } },
          nadpis: str(70),
          text: str(550),
          schvalne: str(120),
          dukazy: DUKAZY_JSON,
        },
      },
    },
    otazky: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["otazka", "kapitola", "tema"],
        properties: {
          otazka: str(130),
          kapitola: { type: "integer", enum: CHAPTER_IDS },
          tema: { type: "integer", minimum: 1, maximum: 5 },
        },
      },
    },
  },
};

export const SYSTEM_V2 = `Jsi autor Vztahové DNA produktu MEZI VÁMI. Píšeš česky pro dva lidi,
kteří si výsledek mohou přečíst spolu nebo si ho poslat.

CÍL
Vztahová DNA je samostatná bezplatná ochutnávka. Dej páru jedno konkrétní poznání, které stojí
za sdílení, a jednu drobnost, kterou mohou zkusit. Hloubková analýza na to navazuje podrobnějším
pohledem. Její obsah znáš jen z názvů kapitol v datech – nic dalšího o ní neslibuj.

PODKLADY A HRANICE
- Použij jen dodané pozice, klíčová slova, vazby a údaje o jistotě. Nic nepřepočítávej a žádnou
  vazbu nedoplňuj.
- Astrologii používej jako symbolický podklad pro sklony. Nepiš, že víš, co lidé skutečně dělají,
  cítí nebo co se jim stalo.
- Bez diagnóz, předpovědí, zdravotních a finančních soudů, tvrzení o nevěře či rozchodu a bez
  přidělování viny.
- Váha vazby je vodítko pro výběr, ne pořadí témat ani míra pravdivosti. Příbuzné vazby, které vedou
  ke stejnému poznání, slouč do jednoho tématu. Nevydávej je za nezávislá potvrzení.
- Stejné znamení neopravňuje k tvrzení, že si dva lidé automaticky rozumějí. Pokud máš jen podklad
  pro podobný styl, popiš podobný styl. Nejistou pozici (NEJISTÉ, „nejisté: …“) nepoužij jako jedinou
  oporu konkrétního závěru.
- O čase narození, nejistotě ani chybějících údajích v textu nepiš. Stránka to uvádí jednou nad
  výsledkem. U nejisté pozice napiš jen to, co platí pro všechna možná znamení, nebo ji vynech.

HLAS
Přesný spolupachatel s disciplínou prémiového odhalení. Každý blok má zamčené pořadí:
přesnost → rozpoznání („to jsme my“) → lehké pobavení → úžas. Nikdy obráceně: vtip nesmí předběhnout
přesnost. Úžas přichází z přesného, nečekaného spojení dvou věcí, ne ze sebejistější formulace
ani z přídavných jmen.
Klidně, civilně, krátké věty, bez horoskopových frází a bez tónu terapeuta. Vtip je o mechanismu mezi
dvěma lidmi, nikdy o hodnotě jednoho z nich – musí se mu zasmát oba zároveň. Citlivé místo nemusí
obsahovat vtip.
Modelová scéna: v kartě nejvýš jedna všední situace a JEDNOU ji jasně uveď jako možnost
(„Třeba když…“, „Představte si…“). Nevydávej ji za skutečnou příhodu (ne „minulou sobotu jste…“).
Zbytek piš přímo, oznamovacím způsobem o sklonech („{A1} jde do věcí rovnou, {B1} nejdřív zváží…“).
Neřetěz „může / můžete / mohou“: v jedné kartě nejvýš jednou. Nejvýš jedno zmírňující slovo na kartu
(spíš, obvykle, často).
Nepoužívej: dynamika, harmonie, souznění, energie, vesmír, hvězdy, osud, spřízněné duše, komunikujte,
pocit opory, prostor pro.
V textu karet, řádků, hlavního tématu a otázek nepoužívej názvy planet, aspektů ani hodnoty orbů
a nemluv o stavbě výsledku („karta“, „vazba“, „druhé téma“). Místo jmen nepoužívej zájmena on/ona
ani oslovení „vy“ pro jednoho z nich.
Typografie: české uvozovky „…“, pomlčka –, bez emoji.

JMÉNA A PÁDY
Jména neznáš. Místo jména vždy piš značku: {A…} = první osoba, {B…} = druhá osoba. Číslo je pád:
  1 kdo/co: „{A1} už hledá klíčky.“
  2 koho/čeho (bez, od, do, u, vedle, kvůli): „Vedle {B2} je {A1} odvážnější.“
  3 komu/čemu (k, proti): „{B3} stačí jedna věta.“ „K {A3} se to dostane později.“
  4 koho/co (pro, na, za): „Pro {A4} je to výzva.“ „{B1} bere {A4} za slovo.“
  5 oslovení: nepoužívej.
  6 o kom/čem (o, při, po, v): „Při {B6} se tempo zpomalí.“ „Mluví se o {A6}.“
  7 s kým/čím (s, před, mezi, za): „S {A7} se {B1} nenudí.“
Použij jen pády, které věta opravdu vyžaduje. Slovesa a přídavná jména shoduj se zadaným rodem osoby.
Oba dohromady můžeš oslovit přímo „vy“.

VÝSTUP
mainTheme
- Vyber poznání, které je pro tento pár nejvýstižnější a má konkrétní oporu v dodaných vazbách.
  Nemusí vycházet z první vazby v seznamu.
- aspectIds: 1–2 ID vazeb, na kterých hlavní téma stojí. Dvě jen tehdy, když stavíš výstižný kontrast
  dvou odlišných signálů. Jinak jedno. Kontrast nevyráběj za každou cenu.
- title: vlastní formulace, nejvýš 30 znaků včetně závěrečné tečky. Nepřebírej příklady z tohoto zadání.
- line: jedna věta do 90 znaků. Přidá poznání, ne jen zopakuje nadpis. První karta ho rozvine a doloží.
rows
- Přesně čtyři řádky v pořadí Slunce, Měsíc, Venuše, Mars.
- a a b: nejvýš 48 znaků, bez jmen (vzor tvaru: „člověk …“). Jedna vlastnost ze zadaných klíčových slov
  pro příslušnou pozici. Nepřidávej jiné vlastnosti. U pozice označené NEJISTÉ vyber vlastnost, kterou
  sdílejí všechna možná znamení; když žádnou výraznou nesdílejí, vyber nejobecnější společný rys.
- ton: přepiš přesně hodnotu z dodaného řádku.
- veta: jedna věta do 160 znaků s oběma značkami ve správném pádě. Popiš, jak se dva styly potkají
  v jedné situaci. Předepsaný tón je vodítko k formulaci, ne důkaz souhry nebo konfliktu.
zaverVeta
- Vrať vždy prázdný řetězec. Závěr skládá systém.
temata
- 3 až 5 významově odlišných karet. První rozvíjí mainTheme a její aspectIds obsahují VŠECHNA aspectIds
  z mainTheme (stojí-li hlavní téma na kontrastu dvou vazeb, první karta doloží obě strany).
  Čtvrtou nebo pátou přidej jen tehdy, když přináší skutečně nové poznání. Nový nadpis nebo jiná kulisa
  ze stejného motivu nestačí. Dvě karty nesmějí stát na stejné sadě vazeb.
- nadpis: nejvýš 70 znaků. Pojmenuj, co čtenář v kartě pozná.
- text: 3 až 5 vět, 300 až 550 znaků. Ukaž možnou situaci, rozliš, co v ní vnímá každý, a pojmenuj,
  co mezi nimi vzniká. Karty nemusejí mít stejný rytmus ani stavbu.
- V právě jedné kartě nabídni jediný malý krok nebo konkrétní větu, kterou mohou zkusit.
- schvalne: prázdný řetězec, nebo jedna přirozená otázka „Schválně: …?“ do 120 znaků. V celém výsledku
  nejvýš dvakrát a jen když vybaví konkrétní moment.
- aspectIds: jedno až dvě různá ID z dodaného seznamu. Jen vazby, bez kterých by karta přišla o oporu.
- dukazy: ke každému aspectId právě jedna věta do 140 znaků, ve stejném pořadí jako aspectIds,
  ve tvaru „Kde {A1} …, tam {B1} …“. Lidskými slovy vysvětli, jaký vzorec vazba pomáhá vyložit.
  Zachovej, kdo je A a kdo B. Není to důkaz skutečného chování. Neopakuj doslova text karty.
otazky
- 0 až 3 otázky. První je hlavní pozvánka k placené analýze. Každá navazuje na konkrétní moment
  z jedné karty (tema = číslo té karty) a otevírá, co DNA ještě nerozebrala – například co ve stejné
  větě slyší každý z nich, kde vznikne nedorozumění nebo co jim pomůže navázat po pauze.
- otazka: nejvýš 130 znaků. Bez strašení, slibů záchrany vztahu, tajemství za paywallem nebo obecného
  „Co o vás ještě nevíte?“.
- kapitola: výhradně ID ze seznamu KAPITOLY v datech. Podle názvu jen urči, kam otázka patří.
  Neslibuj konkrétní cvičení, postup ani stránku.
- Když žádná otázka nemá jasnou návaznost na kartu i kapitolu, vrať prázdné pole. Nevyráběj otázku
  kvůli šabloně.

PŘED ODEVZDÁNÍM
Zkontroluj, že hlavní téma a první karta říkají totéž poznání v jiné míře detailu a stojí na stejných
vazbách. Ostatní karty se nesmějí významově opakovat. Ověř délky, pády, směry vazeb a shodu aspectIds
s dukazy. Pokud věta zní přesvědčivě jen díky tomu, že tvrdí víc, než víš, přepiš ji.
Výsledek vrať pouze voláním nástroje vztahova_dna.`;

/** writer-v2: u nejisté pozice dostane model klíčová slova všech možných znamení (ne jen středového). */
function summaryV2(d: Derived): string {
  const kap = CHAPTERS.map((c, i) => `  ${i + 1}: ${c}`).join("\n");
  const TONE_CS = { ladite: "ladíte", trete: "třete se", plynete: "plynete" };
  const side = (p: { sign: keyof typeof SIGN_KEYWORDS; possibleSigns: (keyof typeof SIGN_KEYWORDS)[] }) =>
    p.possibleSigns.length > 1
      ? `NEJISTÉ ${p.possibleSigns.join(" / ")} (${p.possibleSigns.map((x) => `${x}: ${SIGN_KEYWORDS[x]}`).join("; ")})`
      : `${p.sign} (${SIGN_KEYWORDS[p.sign]})`;
  const rows = ROW_BODIES.map((b, i) => {
    const pa = d.a.positions.find((p) => p.body === b)!;
    const pb = d.b.positions.find((p) => p.body === b)!;
    return `  řádek ${i + 1} ${BODY_CS[b].name}: {A} ${side(pa)} × {B} ${side(pb)} → TÓN ${rowTone(d, b)} (${TONE_CS[rowTone(d, b)]})`;
  });
  const base = summary(d).replace(/ŘÁDKY „KDO JE KDO“[\s\S]*?\n\nVAZBY/, `ŘÁDKY „KDO JE KDO“ (tón je pevný):\n${rows.join("\n")}\n\nVAZBY`);
  return `${base}\n\nKAPITOLY HLOUBKOVÉ ANALÝZY (jen ID a název):\n${kap}`;
}

const PLANET_CASE = /(Slunce|Slunci|Měsíc|Merkur|Venuš|Mars|Jupiter|Saturn|Uran|Neptun|Pluto)/;
const ASPECT_WORD = /(kvadratur|opozic|trigon|sextil|konjunkc|\borb\b)/i;
const astroWord = (s: string) => PLANET_CASE.test(s) || ASPECT_WORD.test(s);
/** Interní slovník produktu nesmí do zákaznického textu („z druhé karty“, „tahle vazba“). */
const META_WORD = /(^|[^\p{L}])(kart[aěyuoá]\p{L}*|vazb[aěyuoá]\p{L}*|vazeb)(?![\p{L}])/iu;
/** Měkké chyby (kratší text, nebo delší nejvýš o 20 %) se hlásí, ale nevolají další pokus. */
export const SOFT = "(měkká) ";
const len = (field: string, n: number, max: number, min = 0) =>
  n > max || n < min
    ? `${n <= max * 1.2 ? SOFT : ""}${field}: ${n} znaků, ${min ? `má být ${min}–${max}` : `max ${max}`}`
    : null;
/** Text nesmí mluvit o čase narození ani o nejistotě údajů (to říká jednou stránka). */
export const TIME_TALK = /(čas\p{L}*\s+narozen|neurčím|nevyčtem|zatím nevíme|z (nejistého|chybějícího) údaje)/iu;
const FORBIDDEN = /(dynamik|harmoni|souzněn|energi|vesmír|hvězd|osud|spřízněn|komunikujte|pocit opory|prostor pro)/i;
const MOZE = /\b(může|můžete|mohou|můžeš|mohl[aiy]?|mohli)\b/gi;

/** Předložka → povolené pády značky (nejčastější chyba: „u {B3}“ místo „u {B2}“). */
const PREP_CASE: [RegExp, string][] = [
  [/(^|[\s„(])(u|bez|od|do|vedle|kvůli|podle|kromě|uprostřed|během)\s+\{([AB])([1-7])\}/gi, "2"],
  [/(^|[\s„(])(k|ke|proti|díky|naproti)\s+\{([AB])([1-7])\}/gi, "3"],
  [/(^|[\s„(])(při|po)\s+\{([AB])([1-7])\}/gi, "6"],
  [/(^|[\s„(])(o)\s+\{([AB])([1-7])\}/gi, "46"],
  [/(^|[\s„(])(s)\s+\{([AB])([1-7])\}/gi, "72"],
];
export function caseErrors(text: string): string[] {
  const out: string[] = [];
  for (const [re, ok] of PREP_CASE)
    for (const m of text.matchAll(re))
      if (!ok.includes(m[4])) out.push(`„${m[2]} {${m[3]}${m[4]}}“ → po „${m[2]}“ patří pád ${ok.split("").join(" nebo ")}`);
  return out;
}

/** Kontroly writer-v2. Každá chyba nese pole, které ji způsobilo (zpětná vazba pro další pokus). */
export function checkV2(out: WriterOutput, d: Derived): string[] {
  const ids = new Set(d.aspects.slice(0, 12).map((a) => a.id));
  const errs: string[] = [];
  const push = (e: string | null) => {
    if (e) errs.push(e);
  };
  const mt = out.mainTheme;
  const mIds = mt.aspectIds ?? [];
  push(len("mainTheme.title", mt.title.length, 30));
  push(len("mainTheme.line", mt.line.length, 90));
  if (new Set(mIds).size !== mIds.length) errs.push("mainTheme.aspectIds: opakované ID");
  for (const id of mIds) if (!ids.has(id)) errs.push(`mainTheme.aspectIds: neznámá vazba ${id}`);
  for (const [k, v] of Object.entries({ "mainTheme.title": mt.title, "mainTheme.line": mt.line })) {
    if (astroWord(v)) errs.push(`${k}: obsahuje název planety nebo aspektu`);
    if (FORBIDDEN.test(v)) errs.push(`${k}: zakázané slovo`);
    if (META_WORD.test(v)) errs.push(`${k}: interní slovo (karta/vazba)`);
  }
  out.rows.forEach((r, i) => {
    push(len(`rows[${i}].a`, r.a.length, 48));
    push(len(`rows[${i}].b`, r.b.length, 48));
    push(len(`rows[${i}].veta`, r.veta.length, 160));
    if (!/\{A[1-7]\}/.test(r.veta) || !/\{B[1-7]\}/.test(r.veta)) errs.push(`rows[${i}].veta: chybí značka jedné z osob`);
    if (/\{[AB]5\}/.test(r.veta)) errs.push(`rows[${i}].veta: 5. pád (oslovení) se nepoužívá`);
    if (r.ton !== rowTone(d, ROW_BODIES[i])) errs.push(`rows[${i}].ton: má být ${rowTone(d, ROW_BODIES[i])}`);
    for (const c of caseErrors(r.veta)) errs.push(`rows[${i}].veta: ${c}`);
  });
  if (out.temata.length < 3) errs.push(`temata: jen ${out.temata.length}, min 3`);
  const first = out.temata[0];
  if (first && mIds.some((id) => !first.aspectIds.includes(id)))
    errs.push("temata[0].aspectIds: musí obsahovat všechna mainTheme.aspectIds");
  const seen = new Set<string>();
  let schv = 0;
  out.temata.forEach((t, i) => {
    const f = `temata[${i}]`;
    if (new Set(t.aspectIds).size !== t.aspectIds.length) errs.push(`${f}.aspectIds: opakované ID`);
    for (const id of t.aspectIds) if (!ids.has(id)) errs.push(`${f}.aspectIds: neznámá vazba ${id}`);
    const key = [...t.aspectIds].sort().join("+");
    if (seen.has(key)) errs.push(`${f}.aspectIds: stejná sada vazeb jako jiná karta`);
    seen.add(key);
    const dIds = t.dukazy.map((x) => x.aspectId);
    if (dIds.join("|") !== t.aspectIds.join("|")) errs.push(`${f}.dukazy: musí být právě jeden ke každému aspectId ve stejném pořadí`);
    t.dukazy.forEach((x, j) => push(len(`${f}.dukazy[${j}]`, x.text.length, 140)));
    push(len(`${f}.nadpis`, t.nadpis.length, 70));
    push(len(`${f}.text`, t.text.length, 550, 300));
    if (!PH.test(t.text)) errs.push(`${f}.text: bez značky jména`);
    if (/\{[AB]5\}/.test(t.text)) errs.push(`${f}.text: 5. pád (oslovení) se nepoužívá`);
    for (const c of [...caseErrors(t.text), ...caseErrors(t.nadpis), ...t.dukazy.flatMap((x) => caseErrors(x.text))])
      errs.push(`${f}: ${c}`);
    if (astroWord(t.text) || astroWord(t.nadpis)) errs.push(`${f}: text nebo nadpis obsahuje název planety nebo aspektu`);
    if (FORBIDDEN.test(t.text) || FORBIDDEN.test(t.nadpis)) errs.push(`${f}: zakázané slovo`);
    if (META_WORD.test(t.text) || META_WORD.test(t.nadpis)) errs.push(`${f}: interní slovo (karta/vazba) v textu pro zákazníka`);
    const m = (t.text.match(MOZE) ?? []).length;
    if (m > 1) errs.push(`${f}.text: „může/můžete“ ${m}×, max 1×`);
    if (t.schvalne) {
      schv++;
      if (!/^Schválně: .+\?$/.test(t.schvalne)) errs.push(`${f}.schvalne: tvar „Schválně: …?“`);
      push(len(`${f}.schvalne`, t.schvalne.length, 120));
    }
  });
  if (schv > 2) errs.push(`schvalne: použito ${schv}×, max 2×`);
  out.otazky.forEach((o, i) => {
    if (!CHAPTER_IDS.includes(o.kapitola)) errs.push(`otazky[${i}].kapitola: ${o.kapitola} není v seznamu kapitol`);
    if (!o.tema || o.tema < 1 || o.tema > out.temata.length) errs.push(`otazky[${i}].tema: ${o.tema} neodpovídá žádné kartě`);
    push(len(`otazky[${i}].otazka`, o.otazka.length, 130));
    if (!o.otazka.trim().endsWith("?")) errs.push(`otazky[${i}].otazka: není otázka`);
    if (META_WORD.test(o.otazka) || astroWord(o.otazka)) errs.push(`otazky[${i}].otazka: interní slovo, planeta nebo aspekt`);
    for (const c of caseErrors(o.otazka)) errs.push(`otazky[${i}].otazka: ${c}`);
  });
  const texts: [string, string][] = [
    ["mainTheme.title", mt.title],
    ["mainTheme.line", mt.line],
    ...out.rows.flatMap((r, i): [string, string][] => [[`rows[${i}].a`, r.a], [`rows[${i}].b`, r.b], [`rows[${i}].veta`, r.veta]]),
    ...out.temata.flatMap((t, i): [string, string][] => [[`temata[${i}].nadpis`, t.nadpis], [`temata[${i}].text`, t.text], [`temata[${i}].schvalne`, t.schvalne ?? ""]]),
    ...(out.otazky ?? []).map((q, i): [string, string] => [`otazky[${i}]`, typeof q === "string" ? q : q.otazka]),
  ];
  for (const [k, v] of texts) if (TIME_TALK.test(v)) errs.push(`${k}: nepiš o čase narození ani o nejistotě údajů`);
  return errs;
}

/** Deterministické dorovnání po posledním pokusu: nic nevymýšlí, jen odebere nebo srovná. */
export function normalizeV2(out: WriterOutput, d: Derived): { output: WriterOutput; fixes: string[] } {
  const ids = new Set(d.aspects.slice(0, 12).map((a) => a.id));
  const fixes: string[] = [];
  const temata = out.temata
    .map((t, i) => {
      const aIds = [...new Set(t.aspectIds.filter((x) => ids.has(x)))];
      const dukazy = aIds
        .map((id) => t.dukazy.find((x) => x.aspectId === id))
        .filter((x): x is { aspectId: string; text: string } => !!x);
      if (aIds.length !== t.aspectIds.length || dukazy.length !== t.dukazy.length)
        fixes.push(`temata[${i}]: odebrány neznámé nebo nespárované vazby`);
      return { ...t, aspectIds: aIds, dukazy };
    })
    .filter((t, i) => {
      const ok = t.aspectIds.length > 0 && t.dukazy.length === t.aspectIds.length;
      if (!ok) fixes.push(`temata[${i}]: karta bez platné opory vyřazena`);
      return ok;
    });
  if (temata.length < 3) throw new Error(`writer-v2: po kontrole zbyly jen ${temata.length} karty`);
  let schv = 0;
  for (const t of temata) {
    if (t.schvalne && ++schv > 2) {
      t.schvalne = "";
      fixes.push("schvalne: ponechány jen první dvě");
    }
  }
  let mIds = (out.mainTheme.aspectIds ?? []).filter((x) => ids.has(x));
  if (!mIds.length || mIds.some((x) => !temata[0].aspectIds.includes(x))) {
    mIds = temata[0].aspectIds;
    fixes.push("mainTheme.aspectIds: sjednoceno s první kartou");
  }
  const otazky = out.otazky.filter((o, i) => {
    const ok = CHAPTER_IDS.includes(o.kapitola) && !!o.tema && o.tema >= 1 && o.tema <= temata.length;
    if (!ok) fixes.push(`otazky[${i}]: bez ověřené návaznosti, vyřazena`);
    return ok;
  });
  const rows = out.rows.map((r, i) => ({ ...r, ton: rowTone(d, ROW_BODIES[i]) }));
  return { output: { ...out, mainTheme: { ...out.mainTheme, aspectIds: mIds }, rows, zaverVeta: "", temata, otazky }, fixes };
}

/* ---------- běh pisatele ---------- */

export type Attempt = { ms: number; usage: Usage; errors: string[] };
export type WriterResult = {
  output: WriterOutput;
  model: string;
  usage: Usage;
  promptVersion: PromptVersion;
  attempts: Attempt[];
  /** chyby, které zůstaly po posledním pokusu (před dorovnáním) */
  remaining: string[];
  fixes: string[];
  ms: number;
};

const MAX_ATTEMPTS = 3;

export async function writeDna(
  d: Derived,
  env: Record<string, string | undefined> = process.env,
  opts: { model?: string; prompt?: PromptVersion } = {},
): Promise<WriterResult> {
  const model = opts.model || env.MEZI_VAMI_WRITER_MODEL || DEFAULT_WRITER_MODEL;
  const prompt = opts.prompt || (env.MEZI_VAMI_WRITER_PROMPT as PromptVersion | undefined) || PROMPT_VERSION;
  const v2 = prompt === "writer-v2";
  const t0 = Date.now();
  const attempts: Attempt[] = [];
  const total: Usage = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
  let feedback = "";
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const a0 = Date.now();
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };
    try {
      const r = await generateStructured({
        model,
        system: v2 ? SYSTEM_V2 : SYSTEM_V1,
        user: (v2 ? summaryV2(d) : summary(d)) + feedback,
        schema: v2 ? OUT_SCHEMA_V2 : OUT_SCHEMA_V1,
        schemaName: "vztahova_dna",
        maxOutputTokens: 12000,
        timeoutMs: 150_000,
      });
      usage = r.usage;
      total.inputTokens += usage.inputTokens;
      total.outputTokens += usage.outputTokens;
      total.cacheWriteTokens = (total.cacheWriteTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
      total.cacheReadTokens = (total.cacheReadTokens ?? 0) + (usage.cacheReadTokens ?? 0);
      const output: WriterOutput = v2 ? WriterOutputV2Schema.parse(r.data) : WriterOutputSchema.parse(r.data);
      const errs = v2 ? checkV2(output, d) : checkWriterOutput(output, d);
      attempts.push({ ms: Date.now() - a0, usage, errors: errs });
      const hard = errs.filter((e) => !e.startsWith(SOFT));
      if (hard.length && attempt < MAX_ATTEMPTS - 1) {
        feedback = `\n\nOPRAV V PŘEDCHOZÍM POKUSU (pole: chyba):\n- ${errs.map((e) => e.replace(SOFT, "")).join("\n- ")}`;
        lastErr = new Error(errs.join("; "));
        continue;
      }
      const norm = v2 ? normalizeV2(output, d) : { output, fixes: [] };
      return {
        output: norm.output,
        model: r.model,
        usage: total,
        promptVersion: prompt,
        attempts,
        remaining: errs,
        fixes: norm.fixes,
        ms: Date.now() - t0,
      };
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message.slice(0, 600) : "chyba";
      attempts.push({ ms: Date.now() - a0, usage, errors: [`výstup neprošel schématem: ${msg}`] });
      feedback = `\n\nPŘEDCHOZÍ POKUS NEPROŠEL KONTROLOU (${msg}). Dodrž délky a strukturu.`;
    }
  }
  const err = lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  (err as Error & { attempts?: Attempt[] }).attempts = attempts;
  throw err;
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
  const model = env.MEZI_VAMI_NAMES_MODEL || DEFAULT_NAMES_MODEL;
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
