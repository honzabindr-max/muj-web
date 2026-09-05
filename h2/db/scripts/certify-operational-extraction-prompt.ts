import { Pool } from "pg";

import { H2_MODELS } from "@/h2/config/models";
import { CONTEXT_TOKEN_BUDGETS } from "@/h2/context/token-budget";
import { OPERATIONAL_EXTRACTION_PURPOSE } from "@/h2/extraction/operational-extraction";
import { OperationalExtractionOutputSchema } from "@/h2/extraction/operational-schema";
import { OPERATIONAL_EXTRACTION_PROMPT_CONTENT } from "@/h2/extraction/prompt-content";
import {
  OPERATIONAL_EXTRACTION_DRY_RUN_MOCKS,
  OPERATIONAL_EXTRACTION_FIXTURES,
  OPERATIONAL_EXTRACTION_FIXTURE_SET_VERSION,
} from "@/h2/extraction/prompt-fixtures";
import { callAnthropicModel } from "@/h2/prompts/anthropic-adapter";
import { loadPromptProviderConfig } from "@/h2/prompts/config";
import { runPromptFixtureSuite } from "@/h2/prompts/fixtures";
import { createDraftPromptVersion } from "@/h2/prompts/registry";

const SCHEMA_VERSION = 1;

/**
 * Certifikace OPERATIONAL_EXTRACTION promptu proti REÁLNÉMU Haiku (BUILD-08
 * otevřená položka, viz BUILD-STATUS.md). Mirror `certify-buddy-response-
 * prompt.ts` vzoru (BUDDY_RESPONSE, Sonnet) — stejná struktura, jiný model
 * a jiný výstupní tvar. NIKDY nevolá `activatePromptVersion()` — jen
 * vytvoří DRAFT verzi a spustí fixture suite, aktivace je oddělený ruční
 * krok POTÉ, co Honzík výstupy přečte a schválí (stejná disciplína jako
 * BUDDY_RESPONSE).
 *
 * `validateOutput` volá `OperationalExtractionOutputSchema.safeParse()` —
 * STEJNÉ schéma, jaké validuje `extractOperationalCandidates()` v produkci
 * (`h2/extraction/operational-extraction.ts`). Na rozdíl od BUDDY_RESPONSE
 * není parse krok (`JSON.parse` + zod) dost komplexní na to, aby si
 * zasloužil vlastní sdílený modul jako `parse-model-output.ts` (žádná
 * tolerantní extrakce, žádný brace-matching) — schéma samo je tu jediný
 * zdroj pravdy o tvaru, sdílený importem.
 *
 * Bez Structured Outputs (BUILD-STATUS.md bod 4a): `callAnthropicModel()`
 * se volá BEZ šestého parametru `outputSchema`, stejně jako produkce.
 *
 * DRY RUN (`--dry-run`): validuje všechny fixtury proti
 * `OPERATIONAL_EXTRACTION_DRY_RUN_MOCKS` — ŽÁDNÉ Anthropic volání, ŽÁDNÉ
 * DB připojení, žádný náklad. Ověřuje jen, že parse/validate cesta
 * funguje na tvarech, které by validní Haiku odpověď měla mít. Živý běh
 * (bez `--dry-run`) vyžaduje `.env.verify` + `.env.local` a NIKDY se
 * nespouští bez Honzíkova explicitního GO — volá skutečné Anthropic API,
 * reálný, byť malý náklad.
 *
 * Použití:
 *   npx tsx h2/db/scripts/certify-operational-extraction-prompt.ts --dry-run
 *   npx tsx h2/db/scripts/certify-operational-extraction-prompt.ts   (živý běh, jen na GO)
 */
function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function validateOutput(text: string): { valid: boolean; errorSummary?: string } {
  const parsed = OperationalExtractionOutputSchema.safeParse(tryParseJson(text));
  return parsed.success ? { valid: true } : { valid: false, errorSummary: parsed.error.message.slice(0, 300) };
}

async function runDryRun(): Promise<void> {
  console.log("DRY RUN — žádné Anthropic volání, žádné DB připojení. Jen validace fixtur proti OperationalExtractionOutputSchema na mockovaném výstupu.\n");

  let passCount = 0;
  for (const fixture of OPERATIONAL_EXTRACTION_FIXTURES) {
    const mockText = OPERATIONAL_EXTRACTION_DRY_RUN_MOCKS[fixture.name];
    if (mockText === undefined) {
      throw new Error(`chybí mock výstup pro fixturu "${fixture.name}" v OPERATIONAL_EXTRACTION_DRY_RUN_MOCKS`);
    }
    const validation = validateOutput(mockText);
    const passed = validation.valid === fixture.expectedValid;
    if (passed) passCount++;
    console.log(`[${passed ? "PASS" : "FAIL"}] ${fixture.name} (${fixture.kind})${validation.errorSummary ? ` — ${validation.errorSummary}` : ""}`);
  }

  console.log(
    `\nDry-run: ${passCount}/${OPERATIONAL_EXTRACTION_FIXTURES.length} passed. Žádný řádek nezapsán do prompt_versions/llm_runs/usage_ledger, žádné Anthropic volání neproběhlo.`,
  );
  if (passCount !== OPERATIONAL_EXTRACTION_FIXTURES.length) {
    process.exitCode = 1;
  }
}

async function runLive(): Promise<void> {
  try {
    process.loadEnvFile(".env.verify");
  } catch {
    throw new Error(".env.verify neexistuje. Spusť nejdřív: bash h2/db/scripts/write-verify-env.sh");
  }
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local je volitelný obecně, ale bez H2_ANTHROPIC_API_KEY loadPromptProviderConfig() níže stejně failne nahlas.
  }

  const connectionString = process.env.H2_RUNTIME_DATABASE_URL;
  if (!connectionString) {
    throw new Error(".env.verify neobsahuje H2_RUNTIME_DATABASE_URL.");
  }
  const credentials = loadPromptProviderConfig();

  const pool = new Pool({ connectionString });
  try {
    const owner = await pool.query<{ id: string }>("select id from owners where google_sub is not null limit 1");
    const ownerId = owner.rows[0]?.id;
    if (!ownerId) {
      throw new Error("Žádný owner v DB — certifikace potřebuje existujícího ownera pro llm_runs/usage_ledger provenance.");
    }

    const draft = await createDraftPromptVersion(pool, OPERATIONAL_EXTRACTION_PURPOSE, OPERATIONAL_EXTRACTION_PROMPT_CONTENT);
    console.log(`DRAFT prompt_versions řádek vytvořen: purpose=${OPERATIONAL_EXTRACTION_PURPOSE} version=${draft.version} id=${draft.id}`);

    const rawResponsesByInput = new Map<string, string>();
    const capturingCallModel = async (modelId: string, promptContent: string, input: string) => {
      const result = await callAnthropicModel(
        modelId,
        promptContent,
        input,
        credentials.anthropicApiKey,
        CONTEXT_TOKEN_BUDGETS.OPERATIONAL_EXTRACTION.maxOutputTokens,
      );
      rawResponsesByInput.set(input, result.text);
      return result;
    };

    const suite = await runPromptFixtureSuite(pool, ownerId, {
      promptVersionId: draft.id,
      purpose: OPERATIONAL_EXTRACTION_PURPOSE,
      modelId: H2_MODELS.extraction,
      promptContent: OPERATIONAL_EXTRACTION_PROMPT_CONTENT,
      schemaVersion: SCHEMA_VERSION,
      fixtureSetVersion: OPERATIONAL_EXTRACTION_FIXTURE_SET_VERSION,
      fixtures: OPERATIONAL_EXTRACTION_FIXTURES,
      callModel: capturingCallModel,
      validateOutput,
    });

    console.log(`\nFixture suite status: ${suite.status} (${suite.results.filter((r) => r.passed).length}/${suite.results.length} passed)\n`);
    for (const result of suite.results) {
      const fixture = OPERATIONAL_EXTRACTION_FIXTURES.find((f) => f.name === result.name);
      const rawText = fixture ? rawResponsesByInput.get(fixture.input) : undefined;
      console.log(`[${result.passed ? "PASS" : "FAIL"}] ${result.name} (${result.kind})${result.errorSummary ? ` — ${result.errorSummary}` : ""}`);
      if (fixture) console.log(`  vstup:  ${fixture.input.replace(/\n/g, " ⏎ ")}`);
      if (rawText) console.log(`  výstup: ${rawText}`);
    }

    console.log(
      `\nDalší krok (NEPROVEDEN automaticky): pokud výstupy vypadají dobře, aktivace vyžaduje\n` +
        `recent re-auth v prohlížeči + activatePromptVersion(pool, ownerId, "${draft.id}", "${H2_MODELS.extraction}", ${SCHEMA_VERSION}, "${OPERATIONAL_EXTRACTION_FIXTURE_SET_VERSION}").`,
    );
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--dry-run")) {
    await runDryRun();
    return;
  }
  await runLive();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
