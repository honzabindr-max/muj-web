import { BuddyResponseOutputSchema, type BuddyResponseOutput } from "./stance-intent-schema";

/**
 * Tolerantní parser Sonnet výstupu (BUILD-11 odložené rozhodnutí,
 * Honzíkovo rozhodnutí 2026-09-04): certifikace (round 1, 3, 5 — 3 z 5
 * běhů) ukázala, že model u tématu "posuzování třetí osoby" opakovaně
 * napíše krátkou prózu PŘED jinak validním JSON objektem, přestože prompt
 * výslovně žádá "VÝHRADNĚ jeden JSON objekt". Honzíkovo rozhodnutí:
 * neopakovat volání (repair retry = další zaplacené volání se stejnou
 * tendencí modelu), místo toho deterministická extrakce zdarma.
 *
 * Pravidlo (jednoznačné, testovatelné): pokud celý text neparsuje jako
 * JSON, hledej v něm PRÁVĚ JEDEN kompletní top-level JSON objekt. Nula
 * nebo víc než jeden kandidát = neplatný výstup, stejně jako dnes (žádné
 * hádání, který z víc objektů je "ten pravý").
 *
 * Prompt instrukce "výhradně jeden JSON objekt" ZŮSTÁVÁ beze změny
 * (Honzíkovo rozhodnutí) — čistý výstup je norma, tolerance je záchranná
 * síť, ne povolení modelu psát cokoliv kolem JSONu.
 *
 * Certifikační skript (`h2/db/scripts/certify-buddy-response-prompt.ts`)
 * musí volat TENHLE modul, ne vlastní `JSON.parse`/schema kombinaci —
 * jinak by certifikace ověřovala jinou parse cestu, než jakou běží
 * produkce (Honzíkovo explicitní zadání).
 */
export type ParseBuddyResponseOutputResult =
  | { success: true; data: BuddyResponseOutput; extractionUsed: boolean }
  | { success: false; errorSummary: string; extractionUsed: boolean };

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Najde konec JSON objektu, který začíná na indexu `start` (musí být
 * `text[start] === '{'`), respektuje stringy (uvozovky, escapování) tak,
 * aby závorky uvnitř textových hodnot nerozbily počítání hloubky.
 * Vrátí index uzavírací `}`, nebo -1, pokud objekt není kompletní.
 */
function findMatchingBraceEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === "\\") {
        escapeNext = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Najde všechny TOP-LEVEL (sourozenecké, ne vnořené) kompletní JSON
 * objekty v textu. Jakmile najde jeden kompletní objekt, přeskočí za
 * jeho konec — vnořené `{}` uvnitř téhož objektu se tak nepočítají jako
 * samostatní kandidáti.
 */
function extractTopLevelJsonObjectCandidates(text: string): string[] {
  const candidates: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      const end = findMatchingBraceEnd(text, i);
      if (end !== -1) {
        candidates.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    i++;
  }
  return candidates;
}

export function parseBuddyResponseOutput(rawText: string): ParseBuddyResponseOutputResult {
  const direct = tryParseJson(rawText.trim());
  if (direct !== undefined) {
    const parsed = BuddyResponseOutputSchema.safeParse(direct);
    return parsed.success
      ? { success: true, data: parsed.data, extractionUsed: false }
      : { success: false, errorSummary: parsed.error.message.slice(0, 300), extractionUsed: false };
  }

  const candidates = extractTopLevelJsonObjectCandidates(rawText);
  if (candidates.length !== 1) {
    return {
      success: false,
      errorSummary: `očekával jsem právě jeden kompletní JSON objekt v odpovědi, nalezeno ${candidates.length}`,
      extractionUsed: false,
    };
  }

  const extractedJson = tryParseJson(candidates[0]);
  if (extractedJson === undefined) {
    return { success: false, errorSummary: "extrahovaný text nebyl validní JSON", extractionUsed: true };
  }
  const parsed = BuddyResponseOutputSchema.safeParse(extractedJson);
  return parsed.success
    ? { success: true, data: parsed.data, extractionUsed: true }
    : { success: false, errorSummary: parsed.error.message.slice(0, 300), extractionUsed: true };
}
