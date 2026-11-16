import { NextResponse } from "next/server";
import { CalcInputSchema, derive } from "@/mezi-vami/engine/astro";
import { getCalcProvider } from "@/mezi-vami/engine/calc";
import { insertComputation } from "@/mezi-vami/db";
import { allow, clientKey } from "@/mezi-vami/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

// Výpočet Vztahové DNA: údaje o narození obou osob (bez jmen) → polohy (CalcProvider) →
// odvozené vazby → uložení. Vrací id výsledku.
export async function POST(req: Request) {
  if (!allow(`calc:${clientKey(req)}`, 10, 10 * 60_000))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  let input;
  try {
    input = CalcInputSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    const provider = getCalcProvider();
    const out = await provider.compute(input);
    const derived = derive(input, out.a, out.b);
    const id = await insertComputation({
      input,
      provider: out.provider,
      model: out.model,
      longitudes: { a: out.a, b: out.b },
      derived,
      usage: out.usage,
    });
    return NextResponse.json({ id });
  } catch (e) {
    console.error("[mezi-vami/vypocet]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "calc_failed" }, { status: 502 });
  }
}
