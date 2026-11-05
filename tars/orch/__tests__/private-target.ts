// Pomocník testů (etapa 4 PR 5, §6.4 N14): DRAFT smí jít jen pod rodiče z `private_draft_parents` s `public_url === null`.
// Testy orchestrátoru, které nejsou o této bráně, dostanou ověřený soukromý cíl: allowlist v dispatch.json (režim hold)
// a fake REST čtení cílové stránky bez publikace. Není to test sám o sobě.
import fs from "node:fs";
import path from "node:path";

import { createHash } from "node:crypto";

import { artifactHash } from "../approval";
import type { DraftTargetReader } from "../effect-gate";
import { writeReviewReceipt } from "../reviews";
import type { Store } from "../store";
import type { ModelFamily, Order } from "../types";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Zakázka ve stavu po kontrole tak, jak ji od PR 4a zakládá orchestrátor: `final-body-r<n>.md` + review receipt PASS
 * nad přesně tímto tělem (kontrolor `reviewerFamily`). Vrací meta pole, která na ně odkazují.
 */
export function reviewedMeta(
  store: Store,
  o: Pick<Order, "id" | "fix_rounds">,
  body: string,
  reviewerFamily: ModelFamily = "claude",
): Record<string, string> {
  const file = `final-body-r${o.fix_rounds}.md`;
  store.writeFile(o.id, file, body);
  const ref = writeReviewReceipt(store.orderDir(o.id), {
    v: 1,
    review_id: sha(`${o.id}|fixture|${file}|${sha(body)}`),
    order_id: o.id,
    step_id: `check/r${o.fix_rounds}`,
    invocation_id: null,
    reviewer_adapter: "fixture",
    reviewer_family: reviewerFamily,
    reviewer_model: "fixture",
    verdict: "PASS",
    reviewed_artifact_kind: "content",
    reviewed_artifact_hash: artifactHash(body),
    reviewed_body_file: { file, sha256: sha(body) },
    prompt_sha256: "0".repeat(64),
    output_sha256: "0".repeat(64),
    created_at: "2026-11-05T00:00:00.000Z",
  });
  return {
    final_body_file: file,
    final_body_sha256: artifactHash(body),
    review_receipt_id: ref.review_id,
    review_receipt_sha256: ref.sha256,
  };
}

export const PRIVATE_PARENT = "0123456789abcdef0123456789abcdef";

export const privateTarget: DraftTargetReader = async () => ({
  complete: true,
  public_url: null,
});

/** dispatch.json (hold) s jediným soukromým rodičem; vrací jeho cestu. */
export function privateDispatchFile(
  dir: string,
  extra: Record<string, unknown> = {},
): string {
  const f = path.join(dir, "dispatch-private.json");
  fs.writeFileSync(
    f,
    JSON.stringify({
      v: 1,
      mode: "hold",
      private_draft_parents: [PRIVATE_PARENT],
      ...extra,
    }),
  );
  return f;
}

/** Závislosti orchestrátoru pro ověřený soukromý cíl DRAFTu. */
export function privateDraftDeps(dir: string): {
  draftParentId: string;
  dispatchFile: string;
  draftTarget: DraftTargetReader;
} {
  return {
    draftParentId: PRIVATE_PARENT,
    dispatchFile: privateDispatchFile(dir),
    draftTarget: privateTarget,
  };
}
