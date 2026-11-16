import { NextResponse } from "next/server";
import { z } from "zod";
import { declineNames } from "@/mezi-vami/engine/writer";
import { allow, clientKey } from "@/mezi-vami/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Skloňování oslovení pro zobrazení v prohlížeči. Nic se neukládá ani neloguje.
const Body = z.object({
  a: z.object({ nick: z.string().trim().max(40), styl: z.enum(["neutral", "m", "f"]) }),
  b: z.object({ nick: z.string().trim().max(40), styl: z.enum(["neutral", "m", "f"]) }),
});

export async function POST(req: Request) {
  if (!allow(`jmena:${clientKey(req)}`, 20, 10 * 60_000))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    return NextResponse.json(await declineNames(body.a, body.b));
  } catch {
    return NextResponse.json({ error: "decline_failed" }, { status: 502 });
  }
}
