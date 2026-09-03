import { z } from "zod";

/**
 * Obecný kandidátní kontejner (BUILD-08 plán, Rozhodnutí 1) — skutečné
 * CRUD/state machines pro Projects/Commitments/Tasks/Open Loops/Reminders
 * jsou BUILD-12. Tady se jen validuje TVAR extrakčního výstupu, ne obsah
 * `payload` (to je BUILD-12's rozhodnutí, až bude vědět, co konzumuje).
 */
export const OperationalExtractionCandidateSchema = z.object({
  type: z.enum(["INTENT", "ENTITY", "COMMAND", "TASK", "REMINDER", "OPEN_LOOP", "USER_ACTION"]),
  payload: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1).optional(),
});

export const OperationalExtractionOutputSchema = z.object({
  candidates: z.array(OperationalExtractionCandidateSchema),
});

export type OperationalExtractionCandidate = z.infer<typeof OperationalExtractionCandidateSchema>;
export type OperationalExtractionOutput = z.infer<typeof OperationalExtractionOutputSchema>;
