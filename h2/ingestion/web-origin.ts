import type { H2Environment } from "@/h2/config/environment";

/**
 * Povolené originy pro CSRF check (h2/identity/csrf.ts) webového ingest
 * endpointu. Bez nové env proměnné — `VERCEL_URL` nastavuje Vercel
 * automaticky pro každý deployment (produkce i preview).
 */
export function resolveWebIngestAllowedOrigins(
  environment: H2Environment,
  source: Record<string, string | undefined> = process.env,
): string[] {
  const origins = ["https://good-inventions.work", "https://www.good-inventions.work"];
  if (source.VERCEL_URL) origins.push(`https://${source.VERCEL_URL}`);
  if (environment !== "production") origins.push("http://localhost:3000");
  return origins;
}
