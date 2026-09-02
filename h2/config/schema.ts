import { z } from "zod";

import { H2ConfigError } from "./errors";

/**
 * Fail-closed env validation. Vrací pouze typované hodnoty požadovaných klíčů.
 * Chybějící nebo neplatná hodnota vyhodí H2ConfigError, jejíž zpráva obsahuje
 * pouze NÁZVY klíčů, nikdy jejich hodnoty — bezpečná chyba pro logy i UI.
 *
 * Každý budoucí BUILD blok, který potřebuje reálný secret (DB URL, API klíč,
 * webhook secret...), volá requireEnv se svým vlastním shape na hranici
 * requestu/bootu daného modulu — ne globálně při Next.js app boot, aby
 * chybějící H2 secret nerozbil zbytek muj-web.
 */
export function requireEnv<Shape extends z.ZodRawShape>(
  shape: Shape,
  source: Record<string, string | undefined> = process.env,
): { [K in keyof Shape]: z.infer<Shape[K]> } {
  const schema = z.object(shape);
  const result = schema.safeParse(source);
  if (!result.success) {
    const missingKeys = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new H2ConfigError(missingKeys);
  }
  return result.data as { [K in keyof Shape]: z.infer<Shape[K]> };
}
