// Structured verdicts from the other-family checker (krok 1 plánu převodu, DR-029).
// `codex exec --output-schema <schema.json>` makes GPT return ONE JSON object instead of prose:
//   {"verdict": "PASS"|"FIX"|"BLOCK", "findings": [{"severity","file","line","text"}]}
// Parsing is strict. Anything that is not valid against the schema is NEVER a PASS: it becomes
// FIX with the issue "Nelze ověřit: …" (the order cannot be accepted on an unreadable verdict).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Finding {
  severity: Severity;
  file: string | null;
  line: number | null;
  text: string;
}

export type JsonSchema = Record<string, unknown>;

function findingSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["severity", "file", "line", "text"],
    properties: {
      severity: { type: "string", enum: [...SEVERITIES] },
      file: { type: ["string", "null"] },
      line: { type: ["integer", "null"] },
      text: { type: "string" },
    },
  };
}

/** JSON Schema for `codex exec --output-schema` (OpenAI strict mode: all keys required, no extras). */
export function verdictSchema(verdicts: readonly string[]): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["verdict", "findings"],
    properties: {
      verdict: { type: "string", enum: [...verdicts] },
      findings: { type: "array", items: findingSchema() },
    },
  };
}

/** Review / brief-check verdicts. BLOCK = cannot be done without the owner (kept from the text protocol). */
export const REVIEW_VERDICTS = ["PASS", "FIX", "BLOCK"] as const;
export const REVIEW_SCHEMA: JsonSchema = verdictSchema(REVIEW_VERDICTS);

/** Build OS P1.6 gate verdicts (Vizuál). */
export const GATE_VERDICTS = ["PASS", "PASS WITH REQUIRED PATCHES", "FAIL", "CONTROL TOWER EXCEPTION"] as const;
export const GATE_SCHEMA: JsonSchema = verdictSchema(GATE_VERDICTS);

export interface StructuredVerdict<V extends string = string> {
  verdict: V;
  findings: Finding[];
  /** Flat, human-readable lines for the automaton / creator ("[high] a.ts:12 text"). */
  issues: string[];
}

export function formatFinding(f: Finding): string {
  const where = f.file ? ` ${f.file}${f.line != null ? `:${f.line}` : ""}` : "";
  return `[${f.severity}]${where} ${f.text}`;
}

function isFinding(x: unknown): x is Finding {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const keys = Object.keys(o).sort().join(",");
  if (keys !== "file,line,severity,text") return false;
  return (
    (SEVERITIES as readonly string[]).includes(o.severity as string) &&
    (o.file === null || typeof o.file === "string") &&
    (o.line === null || (typeof o.line === "number" && Number.isInteger(o.line) && o.line >= 0)) &&
    typeof o.text === "string" &&
    o.text.trim().length > 0
  );
}

/**
 * Strict parse of the whole checker output (no regex digging in prose).
 * Returns undefined when the output is not exactly the schema. Rules beyond the schema:
 *  - non-PASS verdict needs at least one finding (otherwise there is nothing to fix),
 *  - PASS may carry only low/info notes; a critical/high/medium finding next to PASS is a
 *    self-contradicting verdict and is not trusted (matches STRUCTURED_FORMAT).
 */
export function parseStructuredVerdict<V extends string>(text: string, allowed: readonly V[]): StructuredVerdict<V> | undefined {
  let j: unknown;
  try {
    j = JSON.parse(text.trim());
  } catch {
    return undefined;
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return undefined;
  const o = j as Record<string, unknown>;
  if (Object.keys(o).sort().join(",") !== "findings,verdict") return undefined;
  if (!allowed.includes(o.verdict as V)) return undefined;
  if (!Array.isArray(o.findings) || !o.findings.every(isFinding)) return undefined;
  const findings = o.findings as Finding[];
  const verdict = o.verdict as V;
  if (verdict !== "PASS" && findings.length === 0) return undefined;
  if (verdict === "PASS" && findings.some((f) => f.severity !== "low" && f.severity !== "info")) return undefined;
  return { verdict, findings, issues: findings.map(formatFinding) };
}

/** What the orchestrator gets when the verdict cannot be read: FIX, never PASS. */
export function unverifiable(reason: string): { verdict: "FIX"; issues: string[] } {
  return { verdict: "FIX", issues: [`Nelze ověřit: ${reason}`] };
}

/** Writes the schema to a private temp dir (not into the reviewed worktree). Caller removes `dir`. */
export function writeSchemaFile(schema: JsonSchema): { file: string; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-schema-"));
  const file = path.join(dir, "verdict.schema.json");
  fs.writeFileSync(file, JSON.stringify(schema, null, 2));
  return { file, dir };
}

export const STRUCTURED_FORMAT = `Vrať POUZE jeden JSON objekt podle schématu (nic jiného, žádný markdown):
{"verdict": "PASS"|"FIX"|"BLOCK", "findings": [{"severity": "critical"|"high"|"medium"|"low"|"info", "file": "cesta nebo null", "line": číslo nebo null, "text": "konkrétní, opravitelný nález s odkazem na kritérium"}]}
PASS = splňuje všechna akceptační kritéria (findings smí obsahovat jen low/info poznámky). FIX = opravitelné nálezy (vyjmenuj je, alespoň jeden). BLOCK = zakázka nejde splnit bez vlastníka nebo by porušila zákaz (zamčený kontrakt, rozhodnutí Sponzora, tajemství).`;

export const STRUCTURED_GATE_FORMAT = `Vrať POUZE jeden JSON objekt podle schématu (nic jiného, žádný markdown):
{"verdict": "PASS"|"PASS WITH REQUIRED PATCHES"|"FAIL"|"CONTROL TOWER EXCEPTION", "findings": [{"severity": "critical"|"high"|"medium"|"low"|"info", "file": null, "line": null, "text": "konkrétní patch nebo důvod"}]}
Jiný než PASS verdikt musí mít alespoň jeden nález.`;
