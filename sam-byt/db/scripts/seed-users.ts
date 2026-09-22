import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import { generatePassword, hashPassword } from "../../auth/password";

/**
 * Vytvoří účty sam/honzik, pokud ještě neexistují (idempotentní — už
 * existující účet se nepřepisuje, aby reseed při redeployi nezneplatnil
 * hesla, která Sam/Honzík už používají). Vygenerovaná hesla se NIKDY
 * nevypisují do konzole/chatu — jen se zapíšou do souboru mimo git.
 *
 *   npx tsx sam-byt/db/scripts/seed-users.ts dev
 *   npx tsx sam-byt/db/scripts/seed-users.ts preview
 *   npx tsx sam-byt/db/scripts/seed-users.ts production
 */
async function main() {
  const target = process.argv[2];
  if (target !== "dev" && target !== "preview" && target !== "production") {
    throw new Error("Použití: npx tsx sam-byt/db/scripts/seed-users.ts <dev|preview|production>");
  }

  let databaseUrl: string | undefined;
  if (target === "dev") {
    databaseUrl = process.env.SAM_BYT_DEV_DATABASE_URL ?? "postgres://localhost:5432/sam_byt_dev";
  } else {
    const envFile = path.join(process.cwd(), `.env.migrate.sam-byt.${target}`);
    if (!existsSync(envFile)) {
      throw new Error(`${envFile} neexistuje. Vlož SAM_BYT_MIGRATOR_DATABASE_URL do tohoto souboru ručně.`);
    }
    process.loadEnvFile(envFile);
    databaseUrl = process.env.SAM_BYT_MIGRATOR_DATABASE_URL;
  }
  if (!databaseUrl) throw new Error("Chybí connection string.");

  const outFile = path.join(
    process.cwd(),
    target === "dev" ? "SAM_BYT_CREDENTIALS.dev.local.txt" : "SAM_BYT_CREDENTIALS.local.txt",
  );

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const accounts: Array<{ username: "sam" | "honzik"; displayName: string }> = [
      { username: "sam", displayName: "Sam" },
      { username: "honzik", displayName: "Honzík" },
    ];

    const lines: string[] = [
      `SAM-BYT přihlašovací údaje — ${target} — vygenerováno ${new Date().toISOString()}`,
      "Tento soubor je mimo git (viz .gitignore). Nikdy ho nevkládej do chatu ani do Notionu celý —",
      "jen řekni Samovi/Honzíkovi, ať si otevřou tuto cestu na disku.",
      "",
    ];
    let createdAny = false;

    for (const { username, displayName } of accounts) {
      const existing = await pool.query("select id from sam_byt_users where username = $1", [username]);
      if ((existing.rowCount ?? 0) > 0) {
        lines.push(`${displayName} (${username}): účet už existuje, heslo se neměnilo (přeskočeno).`);
        continue;
      }
      const password = generatePassword();
      const hash = await hashPassword(password);
      await pool.query(
        "insert into sam_byt_users (username, display_name, password_hash) values ($1, $2, $3)",
        [username, displayName, hash],
      );
      lines.push(`${displayName} (${username}): ${password}`);
      createdAny = true;
    }

    if (createdAny) {
      // Přepsat výstupní soubor jen když vzniklo aspoň jedno NOVÉ heslo —
      // jinak by reseed smazal jednorázově vypsané heslo z první inicializace
      // (DB drží jen hash, ten se zpětně nedá vypsat).
      writeFileSync(outFile, lines.join("\n") + "\n", { mode: 0o600 });
      console.log(`sam-byt ${target}: hotovo. Nová hesla zapsaná do ${outFile}.`);
    } else {
      console.log(`sam-byt ${target}: oba účty už existují, heslo se neměnilo. ${outFile} zůstal beze změny.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
