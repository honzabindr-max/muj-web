// Etapa 4, PR 4a (NAVRH-v6 §6.2): review receipt jako záznam, finální tělo fable (§6.2.1) a vícedílné review dev
// s doloženým pokrytím celého diffu (§6.2.2 body 1–5).
//
// Receipt zapisuje kód orchestrátoru (obal volání kontrolora), nikdy model: runs/<wo>/reviews/<review_id>.json přes
// writeDurable, zápis jen jednou. Platí jen ten, na který odkazuje state.json (meta.review_receipt_id + _sha256).
// V PR 4a je receipt jen záznam: bránu před gh-push / gh-draft-pr (§6.2.3, git) a pokrytí v bráně (§6.2.2 bod 6)
// přidává až PR 4b. Fable deliver ale už teď posílá jen bajty `final-body-r<n>.md` ověřené proti receiptu (§6.2.1).
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AdapterResult, TextAdapter } from "./adapters";
import {
  AttemptJournal,
  currentAttempt,
  journalScope,
  runInAttempt,
  sha256,
} from "./attempts";
import { processStartTime, writeDurable } from "./store";
import type { ModelFamily, Verdict } from "./types";
import type { Finding } from "./verdict";

export interface ReviewChunk {
  index: number;
  start: number;
  end: number;
  sha256: string;
  invocation_id: string | null;
  verdict: Verdict | "ERROR";
}

export interface ReviewReceipt {
  v: 1;
  review_id: string;
  order_id: string;
  /** např. "check/r1" */
  step_id: string;
  /** content: pokus volání kontrolora; git: pokus části 0 (všechny části jsou v `chunks`) */
  invocation_id: string | null;
  reviewer_adapter: string;
  /** z adapter.family, nikdy z výstupu modelu */
  reviewer_family: ModelFamily;
  reviewer_model: string;
  verdict: Verdict;
  reviewed_artifact_kind: "content" | "git";
  reviewed_artifact_hash?: string;
  reviewed_body_file?: { file: string; sha256: string };
  reviewed_git_commit_oid?: string;
  reviewed_base_oid?: string;
  full_diff_sha256?: string;
  full_diff_chars?: number;
  chunks?: ReviewChunk[];
  coverage?: "full";
  prompt_sha256: string;
  output_sha256: string;
  created_at: string;
}

export interface ReceiptRef {
  review_id: string;
  sha256: string;
}

export function reviewId(
  orderId: string,
  stepId: string,
  invocationIds: Array<string | null>,
): string {
  // Volání bez journalu pokusů (oddělení volané napřímo) nemá invocation_id: receipt dostane jednorázové ID, brána
  // (PR 4b/5) ho stejně nepřijme, protože invocation_id = null nemá FINISHED.
  return sha256(
    [
      orderId,
      stepId,
      ...invocationIds.map((x) => x ?? `bez-journalu-${randomUUID()}`),
    ].join("|"),
  );
}

/** Zápis jen jednou: existující soubor se stejným obsahem = OK, jiný obsah = throw (nic se nepřepisuje). */
export function writeReviewReceipt(
  orderDir: string,
  r: ReviewReceipt,
): ReceiptRef {
  if (!/^[0-9a-f]{64}$/.test(r.review_id))
    throw new Error(`neplatné review_id: ${r.review_id}`);
  const dir = path.join(orderDir, "reviews");
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${r.review_id}.json`);
  const text = JSON.stringify(r, null, 2) + "\n";
  if (fs.existsSync(f)) {
    const cur = fs.readFileSync(f, "utf8");
    if (cur !== text)
      throw new Error(
        `review receipt ${r.review_id} už existuje s jiným obsahem`,
      );
    return { review_id: r.review_id, sha256: sha256(cur) };
  }
  writeDurable(f, text);
  return { review_id: r.review_id, sha256: sha256(text) };
}

/** Receipt, na který odkazuje stav (id + sha256 souboru). Cokoli jiného = undefined (soubor bez odkazu se ignoruje). */
export function readReviewReceipt(
  orderDir: string,
  ref: Partial<ReceiptRef>,
): ReviewReceipt | undefined {
  if (!ref.review_id || !ref.sha256 || !/^[0-9a-f]{64}$/.test(ref.review_id))
    return undefined;
  const f = path.join(orderDir, "reviews", `${ref.review_id}.json`);
  if (!fs.existsSync(f)) return undefined;
  const text = fs.readFileSync(f, "utf8");
  if (sha256(text) !== ref.sha256) return undefined;
  const r = JSON.parse(text) as ReviewReceipt;
  return r.review_id === ref.review_id ? r : undefined;
}

// ───────────────────────────── volání kontrolora jako pokus ─────────────────────────────

export interface InvocationResult {
  r: AdapterResult;
  v?: { verdict: Verdict; issues: string[] };
  findings?: Finding[];
  /** attempt ID volání (FINISHED, output_sha256 = sha256(r.text)); null = bez journalu (přímé volání oddělení) */
  invocation_id: string | null;
  prompt_sha256: string;
  output_sha256: string;
}

/**
 * Jedno volání kontrolora jako samostatný pokus `<krok>-a<n>-c<i>` (§6.2: invocation_id musí mít FINISHED se
 * shodným output_sha256). Výstup modelu se trvale uloží před FINISHED. Bez journalu (oddělení volané napřímo,
 * testy) proběhne volání beze změny a invocation_id je null.
 */
export async function invokeChecker(
  journal: AttemptJournal | undefined,
  orderId: string,
  part: number,
  call: () => Promise<{
    r: AdapterResult;
    v?: { verdict: Verdict; issues: string[] };
    findings?: Finding[];
  }>,
  prompt: string,
  deadlineMs = 35 * 60_000,
  now: () => Date = () => new Date(),
): Promise<InvocationResult> {
  const prompt_sha256 = sha256(prompt);
  const outer = currentAttempt();
  if (!journal || !outer) {
    const res = await call();
    return {
      ...res,
      invocation_id: null,
      prompt_sha256,
      output_sha256: sha256(res.r.text ?? ""),
    };
  }
  const o = AttemptJournal.parseId(outer.id);
  const step = `${o.step}-a${o.attempt}-c${part}`;
  const rec = journal.intent(orderId, step, {
    input_sha256: prompt_sha256,
    deadline: new Date(now().getTime() + deadlineMs).toISOString(),
    decision_check: `část kroku ${outer.id}`,
  });
  let res: Awaited<ReturnType<typeof call>>;
  try {
    res = await runInAttempt(
      journalScope(journal, rec.attempt_id, processStartTime),
      call,
    );
  } catch (e) {
    const sha = journal.writeOutput(rec, "");
    journal.finished(rec.attempt_id, {
      exit: null,
      ok: false,
      output_sha256: sha,
    });
    throw e;
  }
  const text = res.r.text ?? "";
  const output_sha256 = journal.writeOutput(rec, text);
  journal.finished(rec.attempt_id, {
    exit: res.r.ok ? 0 : 1,
    ok: res.r.ok,
    output_sha256,
  });
  return {
    ...res,
    invocation_id: rec.attempt_id,
    prompt_sha256,
    output_sha256,
  };
}

export function reviewerInfo(
  a: TextAdapter,
): Pick<
  ReviewReceipt,
  "reviewer_adapter" | "reviewer_family" | "reviewer_model"
> {
  return {
    reviewer_adapter: a.name,
    reviewer_family: a.family,
    reviewer_model: a.model,
  };
}

// ───────────────────────────── dev: části celého diffu (§6.2.2) ─────────────────────────────

export const CHUNK_LIMIT = 150_000;
export const MAX_CHUNKS = 4;

export interface DiffChunk {
  index: number;
  start: number;
  end: number;
  text: string;
  sha256: string;
  files: string[];
}

export type ChunkPlan =
  | { ok: true; chunks: DiffChunk[] }
  | { ok: false; reason: string };

/** Offsety začátků řádků, které odpovídají `re` (vždy včetně 0). */
function cuts(text: string, re: RegExp): number[] {
  const out = [0];
  for (const m of text.matchAll(re)) if (m.index! > 0) out.push(m.index! + 1);
  return out;
}

function fileOf(segment: string): string {
  const m = /^diff --git a\/(.+?) b\//.exec(segment);
  return m ? m[1] : "?";
}

/**
 * Rozdělí celý diff na souvislé části po hranicích souborů (`diff --git`), soubor delší než limit po hranicích hunků
 * (`@@`). Hunk delší než limit nebo víc než `maxChunks` částí = DIFF_TOO_LARGE (žádné tiché zkrácení). Části pokrývají
 * přesně [0, diff.length], každá má sha256 svého výřezu.
 */
export function planDiffChunks(
  diff: string,
  limit = CHUNK_LIMIT,
  maxChunks = MAX_CHUNKS,
): ChunkPlan {
  if (!diff.length) return { ok: true, chunks: [] };
  const fileStarts = cuts(diff, /\ndiff --git /g);
  const pieces: Array<{ start: number; end: number; file: string }> = [];
  for (let i = 0; i < fileStarts.length; i++) {
    const s = fileStarts[i];
    const e = i + 1 < fileStarts.length ? fileStarts[i + 1] : diff.length;
    const seg = diff.slice(s, e);
    const file = fileOf(seg);
    if (seg.length <= limit) {
      pieces.push({ start: s, end: e, file });
      continue;
    }
    // Hlavička souboru patří k prvnímu hunku.
    const hunks = cuts(seg, /\n@@ /g);
    const starts = hunks.length > 1 ? [0, ...hunks.slice(2)] : [0];
    for (let j = 0; j < starts.length; j++) {
      const hs = s + starts[j];
      const he = j + 1 < starts.length ? s + starts[j + 1] : e;
      if (he - hs > limit)
        return {
          ok: false,
          reason: `DIFF_TOO_LARGE: hunk v ${file} má ${he - hs} znaků > limit ${limit}`,
        };
      pieces.push({ start: hs, end: he, file });
    }
  }
  const chunks: DiffChunk[] = [];
  let cur: { start: number; end: number; files: string[] } | undefined;
  const flush = () => {
    if (!cur) return;
    const text = diff.slice(cur.start, cur.end);
    chunks.push({
      index: chunks.length,
      start: cur.start,
      end: cur.end,
      text,
      sha256: sha256(text),
      files: [...new Set(cur.files)],
    });
    cur = undefined;
  };
  for (const p of pieces) {
    if (cur && p.end - cur.start > limit) flush();
    if (!cur) cur = { start: p.start, end: p.end, files: [p.file] };
    else {
      cur.end = p.end;
      cur.files.push(p.file);
    }
  }
  flush();
  if (chunks.length > maxChunks)
    return {
      ok: false,
      reason: `DIFF_TOO_LARGE: ${chunks.length} částí > MAX_CHUNKS ${maxChunks}`,
    };
  return { ok: true, chunks };
}

/** §6.2.2 bod 5: PASS jen když všechny části PASS; BLOCK má přednost před FIX; nečitelná část = chyba, ne PASS. */
export function aggregateVerdict(
  parts: Array<Verdict | undefined>,
): Verdict | undefined {
  if (!parts.length || parts.some((v) => v === undefined)) return undefined;
  if (parts.includes("BLOCK")) return "BLOCK";
  if (parts.includes("FIX")) return "FIX";
  return "PASS";
}

/** §6.2.2 bod 6 (kontrola tvaru; v bráně ji použije až PR 4b): souvislé pokrytí celého diffu. */
export function coverageProblem(
  r: Pick<
    ReviewReceipt,
    "chunks" | "full_diff_chars" | "full_diff_sha256" | "coverage"
  >,
  diff: string,
): string | undefined {
  if (r.coverage !== "full") return "coverage ≠ full";
  if (r.full_diff_chars !== diff.length || r.full_diff_sha256 !== sha256(diff))
    return "full_diff nesedí s diffem";
  const c = r.chunks ?? [];
  if (!c.length) return diff.length ? "chybí části" : undefined;
  if (c[0].start !== 0) return "první část nezačíná na 0";
  for (let i = 0; i < c.length; i++) {
    if (c[i].index !== i) return `část ${i}: index ${c[i].index}`;
    if (i + 1 < c.length && c[i].end !== c[i + 1].start)
      return `mezera nebo překryv mezi částí ${i} a ${i + 1}`;
    if (c[i].sha256 !== sha256(diff.slice(c[i].start, c[i].end)))
      return `část ${i}: sha256 nesedí`;
  }
  if (c[c.length - 1].end !== diff.length)
    return "poslední část nekončí na konci diffu";
  return undefined;
}
