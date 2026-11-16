import { NextResponse } from "next/server";
import { z } from "zod";
import { getComputation, getLatestWriting, insertWriting } from "@/mezi-vami/db";
import { writeDna } from "@/mezi-vami/engine/writer";
import type { Derived } from "@/mezi-vami/engine/astro";
import { allow, clientKey } from "@/mezi-vami/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

// Texty Vztahové DNA k uloženému výpočtu (vyměnitelný model MEZI_VAMI_WRITER_MODEL, výchozí Sonnet; bez tiché zálohy).
export async function POST(req: Request) {
  if (!allow(`text:${clientKey(req)}`, 15, 10 * 60_000))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  let id: string;
  try {
    id = z.object({ id: z.string().uuid() }).parse(await req.json()).id;
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    const c = await getComputation(id);
    if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (await getLatestWriting(id)) return NextResponse.json({ ok: true, cached: true });
    const r = await writeDna(c.derived as Derived);
    await insertWriting({
      computationId: id,
      model: r.model,
      promptVersion: r.promptVersion,
      output: r.output,
      usage: { ...r.usage, ms: r.ms, attempts: r.attempts.length, remaining: r.remaining, fixes: r.fixes },
    });
    console.info(
      `[mezi-vami/text] ${r.model} ${r.promptVersion} ${r.ms} ms, pokusy ${r.attempts.length}, in ${r.usage.inputTokens} / cache ${r.usage.cacheReadTokens ?? 0}+${r.usage.cacheWriteTokens ?? 0} / out ${r.usage.outputTokens}`,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[mezi-vami/text]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "text_failed" }, { status: 502 });
  }
}
