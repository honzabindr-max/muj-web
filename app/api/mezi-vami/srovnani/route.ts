import { NextResponse, after } from "next/server";
import { z } from "zod";
import { getComputation, insertComputation, insertWriting, listWritings } from "@/mezi-vami/db";
import { writeDna, type Attempt } from "@/mezi-vami/engine/writer";
import type { Derived } from "@/mezi-vami/engine/astro";
import { listOpenAiModels } from "@/mezi-vami/llm";

export const runtime = "nodejs";
export const maxDuration = 300;

// Srovnání modelů a verzí zadání nad stejným výpočtem. Jen mimo produkci (Preview / lokálně).
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("models") }),
  z.object({ action: z.literal("clone"), from: z.string().uuid() }),
  z.object({
    action: z.literal("write"),
    id: z.string().uuid(),
    model: z.string().regex(/^(anthropic|openai):[\w.-]+$/),
    prompt: z.enum(["writer-v1", "writer-v2"]),
  }),
]);

// GET varianta pro spouštění bez prohlížeče (Vercel konektor umí jen GET):
//   ?action=models | ?action=clone&from= | ?action=list&id= | ?action=write&id=&model=&prompt=
// Zápis běží na pozadí (after) a výsledek se uloží jako psaní; chyba jde do logu „[srovnani]“.
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV === "production") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const q = Object.fromEntries(new URL(req.url).searchParams);
  if (q.action === "list") {
    if (!/^[0-9a-f-]{36}$/i.test(q.id ?? "")) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return NextResponse.json({ writings: await listWritings(q.id) });
  }
  if (q.action === "write" && q.bg !== "0") {
    let b: { id: string; model: string; prompt: "writer-v1" | "writer-v2" };
    try {
      b = WriteQ.parse(q);
    } catch {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    const c = await getComputation(b.id);
    if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
    after(async () => {
      try {
        const r = await writeDna(c.derived as Derived, process.env, { model: b.model, prompt: b.prompt });
        const meta = { ...r.usage, ms: r.ms, attempts: r.attempts, remaining: r.remaining, fixes: r.fixes };
        const writingId = await insertWriting({ computationId: b.id, model: r.model, promptVersion: r.promptVersion, output: r.output, usage: meta });
        console.log(`[srovnani] ok ${b.model} ${b.id} → ${writingId}`);
      } catch (e) {
        const attempts = (e as { attempts?: Attempt[] }).attempts ?? [];
        console.error(
          `[srovnani] chyba ${b.model} ${b.id}: ${e instanceof Error ? e.message.slice(0, 600) : String(e)} | pokusy ${JSON.stringify(attempts).slice(0, 1500)}`,
        );
      }
    });
    return NextResponse.json({ started: true });
  }
  return POST(new Request(req.url, { method: "POST", body: JSON.stringify(q) }));
}

const WriteQ = z.object({
  id: z.string().uuid(),
  model: z.string().regex(/^(anthropic|openai):[\w.-]+$/),
  prompt: z.enum(["writer-v1", "writer-v2"]),
});

export async function POST(req: Request) {
  if (process.env.VERCEL_ENV === "production") return NextResponse.json({ error: "not_found" }, { status: 404 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (body.action === "models") {
    try {
      return NextResponse.json({ openai: await listOpenAiModels() });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 300) : String(e) }, { status: 502 });
    }
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
