import { z } from "zod";

/**
 * Strukturovaný výstup BUDDY_RESPONSE volání Sonnetu (Technical
 * Architecture v1.2 §7.2, BUILD-10 plán "Návrh API" — stance/intent
 * klasifikace sdílí jedno Sonnet volání s generováním odpovědi, žádné
 * druhé volání navíc kvůli nákladům).
 *
 * AT-50 ("žádný LLM output není přímo autoritativním DB state transition
 * bez deterministic validation") — stejný vzor jako BUILD-08's
 * `OperationalExtractionOutputSchema`: validuje se TVAR výstupu, ne obsah.
 * Na rozdíl od `operational_extractions` (best-effort advisory data, smí
 * uložit `status='INVALID'` s raw textem) je `responses` řádek
 * autoritativní doručená odpověď — neplatný výstup se sem NESMÍ zapsat
 * vůbec (viz `h2/buddy/generate-response.ts`, throw před `commitJobResult`).
 */
export const BUDDY_STANCE_VALUES = ["BE_WITH", "EXPLORE", "ACT"] as const;

export const BUDDY_INTENT_VALUES = [
  "SHARE",
  "EVENT",
  "SELF_REPORT",
  "EMOTION",
  "IDEA",
  "QUESTION",
  "TASK",
  "PROJECT",
  "DECISION",
  "COMMITMENT",
  "RECONSIDERATION",
  "OPEN_LOOP",
  "CORRECTION",
  "DELETE",
  "REMINDER",
  "PLANNING",
  "REFLECTION",
] as const;

export const BuddyResponseOutputSchema = z.object({
  responseText: z.string().min(1),
  stance: z.enum(BUDDY_STANCE_VALUES),
  intent: z.enum(BUDDY_INTENT_VALUES),
});

export type BuddyStance = (typeof BUDDY_STANCE_VALUES)[number];
export type BuddyIntent = (typeof BUDDY_INTENT_VALUES)[number];
export type BuddyResponseOutput = z.infer<typeof BuddyResponseOutputSchema>;
