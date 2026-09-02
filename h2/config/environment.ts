export type H2Environment = "development" | "preview" | "production";

/**
 * Environment separation dev/preview/prod (Build Specification BUILD-01).
 * Vercel nastavuje VERCEL_ENV automaticky; lokální dev bez VERCEL_ENV
 * spadne na NODE_ENV a bez obojího na "development".
 */
export function getH2Environment(
  source: Record<string, string | undefined> = process.env,
): H2Environment {
  const vercelEnv = source.VERCEL_ENV;
  if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") {
    return vercelEnv;
  }
  return source.NODE_ENV === "production" ? "production" : "development";
}
