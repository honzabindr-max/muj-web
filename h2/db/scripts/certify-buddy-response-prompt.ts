import { Pool } from "pg";

import { parseBuddyResponseOutput } from "@/h2/buddy/parse-model-output";
import { BUDDY_RESPONSE_PROMPT_CONTENT, BUDDY_RESPONSE_OUTPUT_JSON_SCHEMA } from "@/h2/buddy/prompt-content";
import {
  BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS,
  BUDDY_RESPONSE_FIXTURES,
  BUDDY_RESPONSE_FIXTURE_SET_VERSION,
} from "@/h2/buddy/prompt-fixtures";
import { BUDDY_RESPONSE_JSON_SCHEMA } from "@/h2/buddy/stance-intent-schema";
import { H2_MODELS } from "@/h2/config/models";
import { CONTEXT_TOKEN_BUDGETS } from "@/h2/context/token-budget";
import { callAnthropicModel } from "@/h2/prompts/anthropic-adapter";
import { loadPromptProviderConfig } from "@/h2/prompts/config";
import { runPromptFixtureSuite } from "@/h2/prompts/fixtures";
import { createDraftPromptVersion } from "@/h2/prompts/registry";

const BUDDY_RESPONSE_PURPOSE = "BUDDY_RESPONSE";
const SCHEMA_VERSION = 1;

/**
 * Certifikace prvního BUDDY_RESPONSE promptu proti REÁLNÉMU Sonnetu
 * (BUILD-07 aktivační gate, BUILD-10-PLAN.md požadavek). VOLÁ SKUTEČNÉ
 * Anthropic API — malý, ale reálný náklad (12 fixtur × krátký prompt).
 * NIKDY nevolat automaticky, jen na Honzíkovo explicitní GO.
 *
 * Tenhle skript NEAKTIVUJE prompt — jen vytvoří DRAFT verzi a spustí
 * fixture suite, vypíše výsledky (vč. celého responseText ke kontrole)
 * a promptVersionId. Aktivace (`activatePromptVersion()`, vyžaduje
 * recent re-auth v prohlížeči) je samostatný, ruční krok POTÉ, co
 * Honzík výstupy přečte a schválí.
 *
 * `H2_ANTHROPIC_API_KEY` je ve Vercelu typu Secret (write-only, nejde
 * `vercel env pull`, ověřeno 2026-09-04) — musí do `.env.local` (git-
 * ignored, stejné místo jako ostatní lokální secrety, DEC-005) přijít
 * mimo tuhle konverzaci, ne vložením hodnoty do chatu (Secret Handling
 * pravidlo — hodnota v chatu = kompromitovaná).
 *
 * `validateOutput` volá `parseBuddyResponseOutput()` (h2/buddy/parse-
 * model-output.ts) — STEJNOU funkci, jakou volá `generateBuddyResponse()`
 * v produkci (Honzíkovo explicitní zadání 2026-09-04: nesmí existovat
 * dvě různá pravidla toho, co je platný výstup, jinak certifikace ověří
 * něco jiného, než co poběží). Fixtura, jejíž odpověď parser zachránil
 * tolerantní extrakcí (próza kolem JSONu), se v tisknutém výsledku
 * označí `[EXTRAKCE]`.
 *
 * Použití: npx tsx h2/db/scripts/certify-buddy-response-prompt.ts
 * Vyžaduje: .env.verify (DB, viz write-verify-env.sh) + .env.local
 * s H2_ANTHROPIC_API_KEY=...
 */
async function main() {
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

    const draft = await createDraftPromptVersion(
      pool,
      BUDDY_RESPONSE_PURPOSE,
      BUDDY_RESPONSE_PROMPT_CONTENT,
      BUDDY_RESPONSE_OUTPUT_JSON_SCHEMA,
    );
    console.log(`DRAFT prompt_versions řádek vytvořen: purpose=${BUDDY_RESPONSE_PURPOSE} version=${draft.version} id=${draft.id}`);

    // runPromptFixtureSuite() nevrací raw text (jen name/kind/passed/
    // errorSummary) — Honzík ale chce vidět skutečné odpovědi Buddyho, ne
    // jen PASS/FAIL, proto si je zachytáváme bokem podle fixture inputu.
    // Zachytáváme i JMÉNO aktuální fixtury (podle inputu), aby validateOutput
    // níže mohlo zavolat obsahovou kontrolu specifickou pro tuhle fixturu
    // (BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS) — suite volá callModel a hned
    // nato validateOutput sekvenčně, jedna fixtura po druhé, takže tenhle
    // "poslední input" box je bezpečný.
    const rawResponsesByInput = new Map<string, string>();
    const extractionUsedByFixtureName = new Map<string, boolean>();
    let lastFixtureName: string | null = null;
    const capturingCallModel = async (modelId: string, promptContent: string, input: string) => {
      lastFixtureName = BUDDY_RESPONSE_FIXTURES.find((f) => f.input === input)?.name ?? null;
      const result = await callAnthropicModel(
        modelId,
        promptContent,
        input,
        credentials.anthropicApiKey,
        CONTEXT_TOKEN_BUDGETS[BUDDY_RESPONSE_PURPOSE].maxOutputTokens,
        BUDDY_RESPONSE_JSON_SCHEMA,
      );
      rawResponsesByInput.set(input, result.text);
      return result;
    };

    // validateOutput() volá STEJNÝ parseBuddyResponseOutput() (h2/buddy/
    // parse-model-output.ts), jaký běží v produkci (generateBuddyResponse())
    // — Honzíkovo explicitní zadání: nesmí existovat dvě různá pravidla
    // toho, co je platný výstup, jinak certifikace ověřuje jinou parse
    // cestu, než jaká poběží. Obsahové kontroly (BUDDY_RESPONSE_FIXTURE_
    // CONTENT_CHECKS) běží AŽ NAD tímhle parsovaným výsledkem, ne místo něj.
    const suite = await runPromptFixtureSuite(pool, ownerId, {
      promptVersionId: draft.id,
      purpose: BUDDY_RESPONSE_PURPOSE,
      modelId: H2_MODELS.buddy,
      promptContent: BUDDY_RESPONSE_PROMPT_CONTENT,
      schemaVersion: SCHEMA_VERSION,
      fixtureSetVersion: BUDDY_RESPONSE_FIXTURE_SET_VERSION,
      fixtures: BUDDY_RESPONSE_FIXTURES,
      callModel: capturingCallModel,
      validateOutput: (text) => {
        const parsed = parseBuddyResponseOutput(text);
        if (lastFixtureName) extractionUsedByFixtureName.set(lastFixtureName, parsed.extractionUsed);
        if (!parsed.success) {
          return { valid: false, errorSummary: parsed.errorSummary };
        }
        const contentCheck = lastFixtureName ? BUDDY_RESPONSE_FIXTURE_CONTENT_CHECKS[lastFixtureName] : undefined;
        if (contentCheck) {
          const result = contentCheck(parsed.data);
          if (!result.valid) return { valid: false, errorSummary: result.errorSummary };
        }
        return { valid: true };
      },
    });

    console.log(`\nFixture suite status: ${suite.status} (${suite.results.filter((r) => r.passed).length}/${suite.results.length} passed)\n`);
    const extractionCount = [...extractionUsedByFixtureName.values()].filter(Boolean).length;
    if (extractionCount > 0) {
      console.log(`Tolerantní parser (parse-model-output.ts) zasáhl u ${extractionCount}/${suite.results.length} fixtur.\n`);
    }
    for (const result of suite.results) {
      const fixture = BUDDY_RESPONSE_FIXTURES.find((f) => f.name === result.name);
      const rawText = fixture ? rawResponsesByInput.get(fixture.input) : undefined;
      const extractionUsed = extractionUsedByFixtureName.get(result.name);
      console.log(
        `[${result.passed ? "PASS" : "FAIL"}] ${result.name} (${result.kind})${extractionUsed ? " [EXTRAKCE]" : ""}${result.errorSummary ? ` — ${result.errorSummary}` : ""}`,
      );
      if (fixture) console.log(`  vstup:  ${fixture.input.replace(/\n/g, " ⏎ ")}`);
      if (rawText) console.log(`  výstup: ${rawText}`);
    }

    console.log(
      `\nDalší krok (NEPROVEDEN automaticky): pokud výstupy vypadají dobře, aktivace vyžaduje\n` +
        `recent re-auth v prohlížeči + activatePromptVersion(pool, ownerId, "${draft.id}", "${H2_MODELS.buddy}", ${SCHEMA_VERSION}, "${BUDDY_RESPONSE_FIXTURE_SET_VERSION}").`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
