import type { Pool } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

import { recordLlmRun } from "./llm-run";
import { recordAnthropicUsage } from "./usage";

/**
 * Fixture-based prompt testing (BUILD-07 plán, Rozhodnutí 6). Fixtury
 * jsou verzované v kódu (`fixtureSetVersion` je jen identifikátor, obsah
 * fixtur žije v repu, ne v DB) — happy-path, malformed input, adversarial
 * context, schema validation (Build Specification §2 BUILD-07 DoD).
 *
 * `callModel`/`validateOutput` jsou injektované (stejný vzor jako BUILD-05
 * `work`, BUILD-06 `download`/`transcribe`) — CI běží na fake verzích,
 * žádné reálné Anthropic volání (Rozhodnutí 6). Metering (Rozhodnutí 3) a
 * `llm_runs` provenance (AT-36) se zapisují za KAŽDÝ fixture, co se
 * skutečně zavolal — i když validace později FAILuje (AT-34: zavolalo se,
 * zaplatilo se, i když aktivace neprojde).
 */
export type PromptFixtureKind = "happy_path" | "malformed_input" | "adversarial_context" | "schema_validation";

export type PromptFixture = {
  name: string;
  input: string;
  kind: PromptFixtureKind;
  /** Očekáváme, že výstup projde `validateOutput` — false u fixtur, které mají záměrně selhat. */
  expectedValid: boolean;
};

export type CallModelResult = { text: string; inputTokens: number; outputTokens: number };
export type CallModelFn = (modelId: string, promptContent: string, input: string) => Promise<CallModelResult>;
export type ValidateOutputResult = { valid: boolean; errorSummary?: string };
export type ValidateOutputFn = (text: string) => ValidateOutputResult;

export type FixtureRunResult = {
  name: string;
  kind: PromptFixtureKind;
  passed: boolean;
  errorSummary?: string;
};

export type RunPromptFixtureSuiteParams = {
  promptVersionId: string;
  purpose: string;
  modelId: string;
  promptContent: string;
  schemaVersion: number;
  fixtureSetVersion: string;
  fixtures: readonly PromptFixture[];
  callModel: CallModelFn;
  validateOutput: ValidateOutputFn;
};

export async function runPromptFixtureSuite(
  pool: Pool,
  ownerId: string,
  params: RunPromptFixtureSuiteParams,
): Promise<{ testRunId: string; status: "PASS" | "FAIL"; results: FixtureRunResult[] }> {
  const results: FixtureRunResult[] = [];

  for (const fixture of params.fixtures) {
    const startedAt = Date.now();
    let outcome: FixtureRunResult;

    try {
      const callResult = await params.callModel(params.modelId, params.promptContent, fixture.input);
      const validation = params.validateOutput(callResult.text);
      outcome = {
        name: fixture.name,
        kind: fixture.kind,
        passed: validation.valid === fixture.expectedValid,
        errorSummary: validation.errorSummary,
      };

      await withOwnerScope(pool, ownerId, async (client) => {
        await recordLlmRun(client, {
          ownerId,
          purpose: params.purpose,
          modelId: params.modelId,
          promptVersionId: params.promptVersionId,
          schemaVersion: params.schemaVersion,
          inputReferenceManifest: { fixtureName: fixture.name, fixtureKind: fixture.kind },
          inputTokenCount: callResult.inputTokens,
          outputTokenCount: callResult.outputTokens,
          latencyMs: Date.now() - startedAt,
          status: "OK",
        });
        await recordAnthropicUsage(client, ownerId, params.purpose, params.modelId, callResult.inputTokens, callResult.outputTokens);
      });
    } catch (error) {
      const errorSummary = error instanceof Error ? error.message.slice(0, 200) : "unknown error";
      outcome = { name: fixture.name, kind: fixture.kind, passed: false, errorSummary };

      await withOwnerScope(pool, ownerId, async (client) => {
        await recordLlmRun(client, {
          ownerId,
          purpose: params.purpose,
          modelId: params.modelId,
          promptVersionId: params.promptVersionId,
          schemaVersion: params.schemaVersion,
          inputReferenceManifest: { fixtureName: fixture.name, fixtureKind: fixture.kind },
          latencyMs: Date.now() - startedAt,
          status: "ERROR",
          errorCode: errorSummary.slice(0, 60),
        });
      });
    }

    results.push(outcome);
  }

  const status: "PASS" | "FAIL" = results.length > 0 && results.every((r) => r.passed) ? "PASS" : "FAIL";
  const testRun = await pool.query<{ id: string }>(
    `insert into prompt_test_runs (prompt_version_id, model_id, schema_version, fixture_set_version, status, results)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [params.promptVersionId, params.modelId, params.schemaVersion, params.fixtureSetVersion, status, JSON.stringify(results)],
  );

  return { testRunId: testRun.rows[0].id, status, results };
}
