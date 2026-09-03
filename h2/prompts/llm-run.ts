import type { PoolClient } from "pg";

/**
 * `llm_runs` provenance (Technical Architecture v1.2 §9.2, AT-36) —
 * model/prompt/schema/input manifest pro každý významný run. Bere
 * `PoolClient`, volá se zevnitř volajícího transakčního bloku (stejný
 * vzor jako `h2/voice/usage.ts` `recordWhisperUsage`).
 */
export type LlmRunStatus = "OK" | "ERROR" | "TIMEOUT";

export type RecordLlmRunInput = {
  ownerId: string;
  purpose: string;
  modelId: string;
  promptVersionId?: string | null;
  schemaVersion?: number | null;
  inputReferenceManifest?: unknown;
  inputTokenCount?: number | null;
  outputTokenCount?: number | null;
  latencyMs?: number | null;
  status: LlmRunStatus;
  errorCode?: string | null;
};

export async function recordLlmRun(client: PoolClient, input: RecordLlmRunInput): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into llm_runs (
       owner_id, purpose, model_id, prompt_version_id, schema_version,
       input_reference_manifest, input_token_count, output_token_count,
       latency_ms, status, error_code
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning id`,
    [
      input.ownerId,
      input.purpose,
      input.modelId,
      input.promptVersionId ?? null,
      input.schemaVersion ?? null,
      input.inputReferenceManifest === undefined ? null : JSON.stringify(input.inputReferenceManifest),
      input.inputTokenCount ?? null,
      input.outputTokenCount ?? null,
      input.latencyMs ?? null,
      input.status,
      input.errorCode ?? null,
    ],
  );
  return result.rows[0].id;
}
