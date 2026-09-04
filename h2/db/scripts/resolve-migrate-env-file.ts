import path from "node:path";

const VALID_TARGETS = ["preview", "production"] as const;
type MigrateTarget = (typeof VALID_TARGETS)[number];

function isValidTarget(value: string): value is MigrateTarget {
  return (VALID_TARGETS as readonly string[]).includes(value);
}

/**
 * Vybere .env.migrate soubor podle volitelného cílového prostředí (1. CLI
 * argument migrate-neon-runtime.ts/migrate-neon-control.ts). Bez argumentu
 * (undefined) vrací dřívější .env.migrate — fallback pro zpětnou
 * kompatibilitu, ať nic existujícího nespadne po zavedení preview/production
 * splitu (write-migrate-env.sh, docs/h2/BUILD-STATUS.md "Migrační env
 * workflow").
 */
export function resolveMigrateEnvFile(target: string | undefined): string {
  if (target === undefined) {
    return path.join(process.cwd(), ".env.migrate");
  }
  if (!isValidTarget(target)) {
    throw new Error(`Neplatné cílové prostředí "${target}" — očekáváno "preview" nebo "production" (nebo bez argumentu pro .env.migrate).`);
  }
  return path.join(process.cwd(), `.env.migrate.${target}`);
}
