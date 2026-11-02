// Supervisor (Opus): reads HANDOFF + mission capsule + episodic log, proposes ONE order and
// writes its brief. It never creates and never checks (§1) — it only returns JSON that the
// code validates. Order source is restricted to HANDOFF ACTIVE TRACK / DALŠÍ KROK.
import type { LogEntry, OrderBrief } from "./types";
import { STRUCTURED_FORMAT } from "./verdict";

export const HANDOFF_PAGE_ID = "3d40ae49f507817db496c4e823996bc4";

/** Sponsor-reserved decision markers (HANDOFF / TARS-ORCH-001 §5). Deterministic backstop. */
const RESERVED_RE: Array<[string, RegExp]> = [
  ["LOCK milníku / zamčený kontrakt", /\b(LOCK(ED)?|zamk(nout|nutí)|zamč)/i],
  ["cena", /\b(cen[aouyě]|Kč|CZK|pric(e|ing))\b/i],
  ["značka / název", /\b(značk|brand|název produktu|ochrann[áé] známk)/i],
  ["platby / platební partner", /\b(platb|platebn|PSP|checkout|Stripe|GoPay|Comgate)/i],
  ["právní rámec", /\b(právn|legal|GDPR|obchodní podmínky|souhlas)/i],
  ["Control Tower Exception", /\b(CTE-\d+|Control Tower Exception)/i],
];

export function reservedDecisionHits(text: string): string[] {
  return RESERVED_RE.filter(([, re]) => re.test(text)).map(([k]) => k);
}

export interface DeptAvailability {
  department: string;
  card: string;
  available: boolean;
  reasons: string[];
}

export function buildSupervisorPrompt(
  capsule: string,
  recentLog: LogEntry[],
  openOrders: string[],
  depts: DeptAvailability[] = [],
  supervisorCard = "",
  handoff = "",
  checkerIssues: string[] = [],
  sourcesText = "",
  requiredByDept: Record<string, string[]> = {},
): string {
  const reqLines = Object.entries(requiredByDept)
    .map(([d, keys]) => `- ${d}: ${keys.join(", ")}`)
    .join("\n");
  const deptLines = depts
    .map((d) => `- ${d.department} (karta ${d.card}): ${d.available ? "DOSTUPNÉ" : `NEDOSTUPNÉ — ${d.reasons.join("; ")}`}`)
    .join("\n");
  const log = recentLog
    .filter((e) => e.kind === "transition" || e.kind === "error")
    .slice(-30)
    .map((e) => JSON.stringify(e))
    .join("\n");
  return `Jsi SUPERVIZOR orchestrátoru TARS (TARS-ORCH-001 v0). Řídíš, NETVOŘÍŠ a NEKONTROLUJEŠ.
Tvůj jediný výstup je návrh JEDNÉ další zakázky (work order) pro misi MEZI VÁMI jako JSON.

POSTUP:
1. HANDOFF (id ${HANDOFF_PAGE_ID}) je níže v bloku HANDOFF, načtený orchestrátorem z Notionu beze změny. Je to jediný zdroj pravdy. Nepoužívej nástroje.
2. Zakázku vyber VÝHRADNĚ z HANDOFF sekcí "ACTIVE TRACK" nebo "DALŠÍ KROK". Nikdy z jiné stránky.
3. Respektuj "Co se NESMÍ dělat znovu": žádná nová syntéza, audit, V5, nový governance framework, znovuotevírání zamčených kontraktů.
4. Zakázka musí jít udělat bez vlastníka až po DRAFT (Notion DRAFT stránka nebo PR draft). Rozhodnutí vyhrazená Sponzorovi (LOCK, cena, značka/název, platební partner, právo, CTE) NEROZHODUJ — jen je vyjmenuj v "owner_decisions".
5. Oddělení v0: "copy" (Copy Studio GPT tvoří text, Claude Opus kontroluje → Notion DRAFT), "dev" (Vývoj: AI Chain → PR draft), "vizual" (Claude Design přes prohlížeč, GPT brána kontroluje). Vyber JEN z oddělení označených DOSTUPNÉ:
${deptLines || "- (seznam nedodán)"}
6. Neopakuj zakázky, které už běží nebo selhaly ze stejného důvodu (viz záznam níže).
7. Do "inputs" a "goal" vlož všechna fakta z HANDOFF a kufříku, která tvůrce potřebuje (tvůrce NEMÁ přístup do Notionu). Fakta odliš od pracovních hodnot (např. cena 1 990 Kč je pracovní, ne launch lock).
8. ZDROJE FAKTŮ: jen HANDOFF a kufřík níže. Nic z CLAUDE.md, repa ani paměti nepodávej jako fakt. Každý vstup označ prefixem "FAKT (HANDOFF …)" / "FAKT (kufřík …)" s doslovnou oporou, nebo "NÁVRH:" (tvoje interpretace, ke schválení), nebo "UNKNOWN:". Netvrď stav milníku, který HANDOFF výslovně neuvádí (např. „se nasazuje“ ≠ „běží“).
9. Rozsah drž úzký a konzistentní: owner_decisions nesmí slibovat uzavření celého milníku, pokud akceptační kritéria pokrývají jen jeho část.
10. SPLNITELNOST: každé akceptační kritérium musí jít splnit jen z "inputs" a kanonických zdrojů. Nežádej vyplnění údaje, který zdroje neurčují (např. akce tlačítka, kterou UI brief neuvádí). Kde zdroj mlčí, kritérium formuluj tak, že tvůrce místo vymýšlení uvede "UNKNOWN" s odkazem na chybějící zdroj v seznamu otevřených otázek — a tím je kritérium splněné. Taková místa vypiš i v "owner_decisions", pokud patří Sponzorovi.

${ROLE_FACTS}

<<<HANDOFF
${handoff}
HANDOFF>>>
${checkerIssues.length ? `\nKONTROLOR (GPT) VRÁTIL PŘEDCHOZÍ ZADÁNÍ — vypořádej:\n${checkerIssues.map((x) => `- ${x}`).join("\n")}\n` : ""}
POVINNÉ ZDROJE PODLE ODDĚLENÍ (karta tvůrce, §2a bod 2) — zadání je MUSÍ všechny uvést v poli "sources" a vycházet z nich:
${reqLines || "- (nedodáno)"}

KANONICKÉ ZDROJE (načtené orchestrátorem z Notionu beze změny; UNKNOWN = nešlo načíst, důvod uveden):
${sourcesText || "(žádné)"}

TVOJE KARTA (TARS-ORCH-001 §2a) — dodržuj ji:
<<<KARTA
${supervisorCard}
KARTA>>>

KUFŘÍK MISE (index, ne zdroj pravdy):
<<<CAPSULE
${capsule}
CAPSULE>>>

OTEVŘENÉ ZAKÁZKY: ${openOrders.length ? openOrders.join(", ") : "žádné"}

ZÁZNAM BĚHŮ (posledních 30 událostí, JSONL):
${log || "(prázdný)"}

VÝSTUP: vrať POUZE jeden JSON objekt v bloku \`\`\`json, bez dalšího textu, přesně tohoto tvaru:
{"title": "...", "department": "copy"|"dev"|"vizual", "milestone": "např. 3.1", "why": "citace z ACTIVE TRACK / DALŠÍ KROK a proč teď", "goal": "...", "inputs": ["..."], "acceptance": ["měřitelné kritérium", "..."], "owner_decisions": ["..."], "sources": ["klíče povinných zdrojů zvoleného oddělení"]}`;
}

export class BriefError extends Error {}

export function parseBrief(text: string): OrderBrief {
  const m = /```json\s*([\s\S]*?)```/.exec(text) ?? /(\{[\s\S]*\})/.exec(text);
  if (!m) throw new BriefError("no JSON in supervisor output");
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    throw new BriefError("supervisor JSON does not parse");
  }
  const str = (k: string) => {
    if (typeof j[k] !== "string" || !(j[k] as string).trim()) throw new BriefError(`brief.${k} missing`);
    return (j[k] as string).trim();
  };
  const arr = (k: string, min: number) => {
    const v = j[k];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string") || v.length < min) throw new BriefError(`brief.${k} invalid`);
    return v as string[];
  };
  const department = str("department");
  if (department !== "copy" && department !== "dev" && department !== "vizual") throw new BriefError(`unknown department ${department}`);
  return {
    title: str("title").slice(0, 120),
    department,
    milestone: str("milestone"),
    why: str("why"),
    goal: str("goal"),
    inputs: arr("inputs", 1),
    acceptance: arr("acceptance", 1),
    owner_decisions: arr("owner_decisions", 0),
    sources: arr("sources", 1),
  };
}

/** Prompt for the GPT checker of the supervisor's brief (karta supervizor.md, bod 6). */
/** Role facts the checker needs to judge assignments (TARS-ORCH-001 §1, §2, §3). */
export const ROLE_FACTS = `ROZDĚLENÍ ROLÍ (TARS-ORCH-001 §1–§3, fakt, ne návrh):
- Supervizor (Claude Opus) jen vybírá zakázku a píše zadání; výstup specialisty nikdy nekontroluje.
- Oddělení copy: tvůrce GPT (Copy Studio), kontrolor Claude Opus jako SAMOSTATNÉ volání v roli kontrolora podle karty copy-studio bod 6 — není to supervizor.
- Oddělení dev: tvůrce AI Chain (Claude), kontrolor Codex (GPT) + deterministické kontroly.
- Oddělení vizual: tvůrce Claude Design, kontrolor GPT brána.
- Kontrolu tvorby tedy vždy dělá jiná rodina modelů než tvůrce a nikdy supervizor.
- Doručení: copy a vizual → Notion podstránka DRAFT, kterou zakládá orchestrátor; dev → PR draft (TARS-ORCH-001 §2, §3 bod 6). To je vlastnost systému, ne pravomoc, kterou musí dokládat HANDOFF.
- Rozhodnutí vyhrazená Sponzorovi končí ve WAITING_OWNER s kartou GO / REJECT (TARS-ORCH-001 §3 bod 7, §5).`;

export function buildBriefCheckPrompt(
  brief: OrderBrief,
  handoff: string,
  supervisorCard: string,
  capsule = "",
  requiredSources: string[] = [],
  sourcesText = "",
  /** true when the checker runs with `--output-schema` (structured JSON verdict). */
  structured = false,
): string {
  return `Jsi KONTROLOR zadání supervizora (GPT, jiná rodina než supervizor Claude Opus). Netvoříš, jen hodnotíš.
Checklist (karta supervizor.md, body 3, 5 a 6):
1. "why" cituje text, který v HANDOFF skutečně stojí v sekci ACTIVE TRACK nebo DALŠÍ KROK.
2. Zakázka nespadá pod "Co se NESMÍ dělat znovu" a nemění zamčený kontrakt.
3. "inputs" obsahují jen fakta, která v HANDOFF nebo kufříku stojí; pracovní hodnoty nejsou podané jako zamčené.
4. "acceptance" jsou ověřitelná kritéria.
5. "owner_decisions" vyjmenovává každé dotčené rozhodnutí Sponzora (cena, značka/název, platby, právo, LOCK, CTE, vizuální směr, copy preference); supervizor je nerozhoduje.
6. Zadání odkazuje na VŠECHNY povinné zdroje karty tvůrce (${requiredSources.join(", ") || "—"}) a jeho fakta s nimi nejsou v rozporu (zamčená architektura obrazovek, rozsah P1.2 apod.). Chybějící povinný zdroj = FIX.
7. Každé akceptační kritérium jde splnit jen ze zadání a povinných zdrojů. Kritérium, které vyžaduje údaj, jenž zdroje neurčují, a nepřipouští "UNKNOWN" s odkazem na chybějící zdroj = FIX (tvůrce by musel vymýšlet, nebo kontrolor zablokuje).

POVINNÉ ZDROJE ODDĚLENÍ "${brief.department}" (načtené beze změny):
${sourcesText || "(žádné)"}

${ROLE_FACTS}

KUFŘÍK MISE (povolený zdroj vedle HANDOFF; index, při rozporu vyhrává HANDOFF):
<<<CAPSULE
${capsule}
CAPSULE>>>

KARTA SUPERVIZORA:
<<<KARTA
${supervisorCard}
KARTA>>>

<<<HANDOFF
${handoff}
HANDOFF>>>

ZADÁNÍ K POSOUZENÍ (JSON):
${JSON.stringify(brief, null, 2)}

KALIBRACE VERDIKTU:
- FIX jen pro vadu, která by vedla ke špatnému výstupu, porušila zákaz nebo by rozhodla za Sponzora. Jinak PASS a drobnosti uveď jako poznámky.
- BLOCK jen když zakázka nejde udělat bez vlastníka nebo porušuje "Co se NESMÍ dělat znovu".
- Nehledej nové typy připomínek v dalších kolech; posuď, zda jsou vyřešeny dřívější blokující vady.

${structured ? STRUCTURED_FORMAT : `Vrať POUZE JSON v bloku \`\`\`json: {"verdict": "PASS"|"FIX"|"BLOCK", "issues": ["konkrétní nedostatek s odkazem na bod checklistu"]}`}`;
}
