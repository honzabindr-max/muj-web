import { NextResponse } from "next/server";
import { z } from "zod";
import { getComputation, insertComputation, insertWriting } from "@/mezi-vami/db";
import { writeDna, type Attempt } from "@/mezi-vami/engine/writer";
import type { Derived } from "@/mezi-vami/engine/astro";

export const runtime = "nodejs";
export const maxDuration = 300;

// Srovnání modelů a verzí zadání nad stejným výpočtem. Jen mimo produkci (Preview / lokálně).
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("clone"), from: z.string().uuid() }),
  z.object({
    action: z.literal("write"),
    id: z.string().uuid(),
    model: z.string().regex(/^(anthropic|openai):[\w.-]+$/),
    prompt: z.enum(["writer-v1", "writer-v2"]),
  }),
]);

export async function POST(req: Request) {
  if (process.env.VERCEL_ENV === "production") return NextResponse.json({ error: "not_found" }, { status: 404 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const c = await getComputation(body.action === "clone" ? body.from : body.id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.action === "clone") {
    // kopie výpočtu = stejný vstup pro pisatele, ale vlastní ID (původní výsledek se nemění)
    const id = await insertComputation({
      input: c.input,
      provider: c.provider,
      model: c.model,
      longitudes: c.longitudes,
      derived: c.derived,
      usage: { clonedFrom: body.from },
    });
    return NextResponse.json({ id });
  }

  try {
    const r = await writeDna(c.derived as Derived, process.env, { model: body.model, prompt: body.prompt });
    const meta = { ...r.usage, ms: r.ms, attempts: r.attempts, remaining: r.remaining, fixes: r.fixes };
    const writingId = await insertWriting({
      computationId: body.id,
      model: r.model,
      promptVersion: r.promptVersion,
      output: r.output,
      usage: meta,
    });
    return NextResponse.json({ ok: true, writingId, model: r.model, prompt: r.promptVersion, ...meta });
  } catch (e) {
    const attempts = (e as { attempts?: Attempt[] }).attempts ?? [];
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 500) : String(e), attempts },
      { status: 502 },
    );
  }
}
