// Načtení uloženého výsledku pro stránku /mezi-vami/vysledek/[id].
import { getComputation, getLatestWriting, getWriting } from "./db";
import { CalcInputSchema, type Derived } from "./engine/astro";
import { parseStoredOutput } from "./engine/writer";
import { buildView } from "./engine/view";
import type { DnaView } from "@/app/mezi-vami/_v/view-data";

export type LoadedResult =
  | { state: "missing" }
  | { state: "writing"; id: string }
  | { state: "ready"; id: string; view: DnaView; meta: { calcModel: string; writerModel: string; promptVersion: string } };

export async function loadResult(id: string, writingId?: string): Promise<LoadedResult> {
  const c = await getComputation(id);
  if (!c) return { state: "missing" };
  const w = writingId ? await getWriting(id, writingId) : await getLatestWriting(id);
  if (!w) return { state: "writing", id };
  const input = CalcInputSchema.parse(c.input);
  const output = parseStoredOutput(w.prompt_version, w.output);
  return {
    state: "ready",
    id,
    view: buildView(id, input, c.derived as Derived, output),
    meta: { calcModel: `${c.provider}:${c.model}`, writerModel: w.model, promptVersion: w.prompt_version },
  };
}
