import type { Pool } from "pg";

import { H2_MODELS } from "@/h2/config/models";
import type { H2ModelPurpose } from "@/h2/config/models";
import { withOwnerScope } from "@/h2/db/with-owner-scope";

/**
 * Model drift check (AT-63, BUILD-07 plán) — porovná pinned `H2_MODELS`
 * konfiguraci s poslední CERTIFIKOVANOU kombinací. Čistá funkce, nikam se
 * sama nezapojuje — zapojení do live health endpointu je BUILD-23.
 *
 * Prompt-based purposes (Sonnet/Haiku): certifikace = poslední `PASS`
 * `prompt_test_runs` pro daný `purpose`. Prompt-less purposes (Whisper —
 * žádný prompt k verzování): certifikace = `model_id` posledního `OK`
 * `llm_runs` řádku (BUILD-06 retrofit, Rozhodnutí 5).
 */
const PURPOSE_TO_MODEL_PURPOSE: Readonly<Record<string, H2ModelPurpose>> = {
  BUDDY_RESPONSE: "buddy",
  OPERATIONAL_EXTRACTION: "extraction",
  BLIND_EXTRACTION: "extraction",
  voice_transcription: "transcription",
};

const PROMPT_LESS_PURPOSES = new Set<string>(["voice_transcription"]);

export type ModelDriftResult = {
  purpose: string;
  configuredModelId: string;
  certifiedModelId: string | null;
  drift: boolean;
};

export async function checkModelDrift(
  pool: Pool,
  ownerId: string,
  purpose: string,
  configuredModelIdOverride?: string,
): Promise<ModelDriftResult> {
  const modelPurpose = PURPOSE_TO_MODEL_PURPOSE[purpose];
  if (!modelPurpose) {
    throw new Error(`H2 prompts: neznámý purpose "${purpose}" pro model drift check`);
  }
  const configuredModelId = configuredModelIdOverride ?? H2_MODELS[modelPurpose];

  let certifiedModelId: string | null;
  if (PROMPT_LESS_PURPOSES.has(purpose)) {
    certifiedModelId = await withOwnerScope(pool, ownerId, async (client) => {
      const result = await client.query<{ model_id: string }>(
        `select model_id from llm_runs where owner_id = $1 and purpose = $2 and status = 'OK' order by created_at desc limit 1`,
        [ownerId, purpose],
      );
      return result.rows[0]?.model_id ?? null;
    });
  } else {
    const result = await pool.query<{ model_id: string }>(
      `select ptr.model_id
       from prompt_test_runs ptr
       join prompt_versions pv on pv.id = ptr.prompt_version_id
       where pv.purpose = $1 and ptr.status = 'PASS'
       order by ptr.run_at desc
       limit 1`,
      [purpose],
    );
    certifiedModelId = result.rows[0]?.model_id ?? null;
  }

  return { purpose, configuredModelId, certifiedModelId, drift: certifiedModelId !== configuredModelId };
}
