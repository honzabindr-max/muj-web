import { ImageResponse } from "next/og";
import { z } from "zod";
import { CardImage, cardFonts } from "@/mezi-vami/card-image";
import { loadResult } from "@/mezi-vami/result";
import { FIXTURE_VIEW } from "@/app/mezi-vami/_v/view-data";
import { FALLBACK_FORMS, fillNames } from "@/app/mezi-vami/_lib/names";

export const runtime = "nodejs";
export const maxDuration = 60;

// PNG sdílecí karty. Oslovení přichází v těle požadavku z prohlížeče (neukládá se, neloguje se),
// id určuje výsledek; „demo“ = ukázková dvojice.
const Body = z.object({
  id: z.string().max(40),
  a: z.array(z.string().max(60)).max(7),
  b: z.array(z.string().max(60)).max(7),
});

export async function POST(req: Request) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return new Response("invalid", { status: 400 });
  }
  let view = FIXTURE_VIEW;
  if (body.id !== "demo") {
    const r = await loadResult(body.id).catch(() => null);
    if (!r || r.state !== "ready") return new Response("not found", { status: 404 });
    view = r.view;
  }
  const forms = {
    a: body.a.length === 7 ? body.a : FALLBACK_FORMS.a,
    b: body.b.length === 7 ? body.b : FALLBACK_FORMS.b,
  };
  const f = (s: string) => fillNames(s, forms);
  const k = view.karta;
  return new ImageResponse(
    (
      <CardImage
        title={f(k.title)}
        tema={f(k.tema)}
        veta={f(k.veta)}
        glyph={k.jakMiluje.glyph}
        otazka={k.jakMiluje.otazka}
        a={{ jmeno: f(k.jakMiluje.a.jmeno), text: f(k.jakMiluje.a.text) }}
        b={{ jmeno: f(k.jakMiluje.b.jmeno), text: f(k.jakMiluje.b.text) }}
        paticka={k.paticka}
        vazby={view.vazby}
      />
    ),
    { width: 1080, height: 1920, fonts: await cardFonts(), headers: { "cache-control": "no-store" } },
  );
}
