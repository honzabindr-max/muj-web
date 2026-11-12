// Obsluha POST /api/mezi-vami/vypocet (oddělená od route.ts kvůli testům s mockovaným modelem).
// Odpověď = NDJSON stream skutečných událostí kroků a nakonec výsledek nebo chyba.
// Osobní údaje se neukládají ani nelogují; v logu jsou jen tokeny, ceny a časy.

import { z } from "zod";
import { runPipeline, type PipelineDeps } from "./pipeline";
import { PipelineError } from "./types";
import { failureDoc, timeResolutionDoc } from "./views";

export const RATE_LIMIT_MS = 30_000;
export const RATE_COOKIE = "mvc";

const PersonSchema = z.object({
  den: z.string().max(2),
  mesic: z.string().max(2),
  rok: z.string().max(4),
  placeText: z.string().max(200),
  place: z
    .object({
      name: z.string().max(120),
      okres: z.string().max(120),
      cc: z.enum(["CZ", "SK"]),
    })
    .nullable(),
  mode: z.enum(["exact", "approx", "unknown"]),
  cas: z.string().max(10),
  approx: z.enum(["30", "60", "120", "part"]),
  part: z.enum(["noc", "rano", "odpoledne", "vecer"]),
  styl: z.enum(["neutral", "m", "f"]),
});
export const RequestSchema = z.object({
  persons: z.object({
    step: z.enum(["A", "B"]),
    a: PersonSchema,
    b: PersonSchema,
  }),
});

const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    },
  });

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function handleCalc(
  req: Request,
  deps: PipelineDeps,
  now: () => number = Date.now,
): Promise<Response> {
  let parsed;
  try {
    parsed = RequestSchema.safeParse(await req.json());
  } catch {
    return json(400, { type: "error", code: "INVALID_INPUT" });
  }
  if (!parsed.success)
    return json(400, { type: "error", code: "INVALID_INPUT" });

  // Ochrana nákladů: max 1 výpočet za 30 s na session (cookie nese čas posledního spuštění).
  const last = Number(readCookie(req, RATE_COOKIE));
  if (Number.isFinite(last) && last > 0 && now() - last < RATE_LIMIT_MS) {
    const retry = Math.ceil((RATE_LIMIT_MS - (now() - last)) / 1000);
    return json(
      429,
      { type: "error", code: "RATE_LIMIT", retry_after_s: retry },
      {
        "retry-after": String(retry),
      },
    );
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) =>
        controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const res = await runPipeline(parsed.data.persons, deps, send);
        console.log(
          JSON.stringify({
            mv_run: "ok",
            ms: res.revision.duration_ms,
            step_ms: res.revision.step_ms,
            tokens_in: res.revision.usage.inputTokens,
            tokens_out: res.revision.usage.outputTokens,
            calls: res.revision.usage.calls,
            usd: Number(res.revision.usage.costUsd.toFixed(6)),
          }),
        );
        send({
          type: "result",
          document: res.document,
          revision: res.revision,
        });
      } catch (e) {
        if (e instanceof PipelineError && e.kind.type === "TIRR") {
          send({
            type: "error",
            code: "TIRR",
            view: timeResolutionDoc(e.kind.slot, e.kind.reason),
          });
        } else if (
          e instanceof PipelineError &&
          e.kind.type === "INVALID_INPUT"
        ) {
          send({ type: "error", code: "INVALID_INPUT" });
        } else {
          const code =
            e instanceof PipelineError && e.kind.type === "FAIL"
              ? e.kind.code
              : "CALCULATION_FAILED";
          // Log bez osobních údajů: jen kód a typ chyby.
          console.error(
            JSON.stringify({
              mv_run: "fail",
              code,
              err: e instanceof Error ? e.message.slice(0, 60) : "?",
            }),
          );
          send({ type: "error", code: "FAIL", view: failureDoc(code) });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
      "set-cookie": `${RATE_COOKIE}=${now()}; Path=/api/mezi-vami; Max-Age=60; HttpOnly; SameSite=Lax; Secure`,
    },
  });
}
