import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * READ-ONLY produkční health check sam-byt (audit 2026-10-03).
 *
 * Jen GET bez přihlášení: ověří, že /sam-byt vrací login, chráněné API
 * vrací 401, a že uložené source_url / alternative_urls / obrázky
 * odpovídají. Obsah inzerátů NEPARSUJE a nic neaktualizuje — zapisuje
 * jen HTTP status a cílovou URL po redirectu.
 *
 *   npx tsx sam-byt/audit/healthcheck-readonly.ts
 */

const BASE = process.env.SAM_BYT_BASE_URL ?? "https://www.good-inventions.work";
const OUT_FILE = path.join(
  "docs",
  "sam-byt",
  "audit-2026-10-03",
  "SAM_BYT_HEALTHCHECK_RESULT.json",
);
const UA = "Mozilla/5.0 (sam-byt read-only audit)";

interface Listing {
  id: string;
  source_url: string;
  alternative_urls: string[];
  image_url_main: string;
  image_urls: string[];
}

async function probe(url: string, init: RequestInit = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": UA },
      ...init,
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.text();
    return {
      url,
      status: res.status,
      final_url: res.url !== url ? res.url : null,
      content_type: res.headers.get("content-type"),
      bytes: body.length,
      ms: Date.now() - started,
      body,
    };
  } catch (error) {
    return {
      url,
      status: null,
      error: (error as Error).message,
      ms: Date.now() - started,
      body: "",
    };
  }
}

async function main() {
  const listings = JSON.parse(
    readFileSync(path.join("data", "sam-byt", "listings.json"), "utf8"),
  ) as Listing[];

  const page = await probe(`${BASE}/sam-byt`);
  const app = {
    "/sam-byt": {
      status: page.status,
      has_login_form: page.body.includes("Přihlásit se"),
      has_title: page.body.includes("SAM-BYT"),
      leaks_listing_data: listings.some((l) =>
        page.body.includes(l.source_url),
      ),
    },
    "/sam-byt/byt/sam-01": await probe(`${BASE}/sam-byt/byt/sam-01`).then(
      (r) => ({
        status: r.status,
        has_login_form: r.body.includes("Přihlásit se"),
      }),
    ),
  } as Record<string, unknown>;
  for (const route of [
    "/api/sam-byt/state",
    "/api/sam-byt/me",
    "/api/sam-byt/events",
  ]) {
    const r = await probe(`${BASE}${route}`);
    app[route] = { status: r.status, expected: 401, body: r.body.slice(0, 80) };
  }

  const sources = [];
  for (const l of listings) {
    const urls = [
      { kind: "source_url", url: l.source_url },
      ...l.alternative_urls.map((url) => ({ kind: "alternative_url", url })),
      ...l.image_urls.map((url) => ({
        kind: url === l.image_url_main ? "image_url_main" : "image_url",
        url,
      })),
    ];
    for (const { kind, url } of urls) {
      const r = await probe(url);
      sources.push({
        listing_id: l.id,
        kind,
        url: r.url,
        status: r.status,
        final_url: "final_url" in r ? r.final_url : null,
        content_type: "content_type" in r ? r.content_type : null,
        bytes: "bytes" in r ? r.bytes : null,
        error: "error" in r ? r.error : null,
        ms: r.ms,
      });
    }
  }

  const result = {
    generated_at: new Date().toISOString(),
    base: BASE,
    app,
    sources,
    summary: {
      source_urls_ok: sources.filter(
        (s) => s.kind === "source_url" && s.status === 200,
      ).length,
      source_urls_total: sources.filter((s) => s.kind === "source_url").length,
      non_200: sources
        .filter((s) => s.status !== 200)
        .map((s) => `${s.listing_id} ${s.kind} ${s.status ?? "ERR"}`),
    },
  };
  writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ app, summary: result.summary }, null, 2));
  console.log(`Výsledek zapsán do ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
