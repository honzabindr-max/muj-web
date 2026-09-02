/**
 * Structured logger bez content payloadů (Technical Architecture v1.2 §31.7:
 * povoleno jsou IDs, purpose, status, timing, token counts, bezpečné error
 * codes a sanitizované stack traces — nikdy raw user text, transcript, Buddy
 * odpověď, třetí osoba v plaintextu, OAuth token nebo prompt payload).
 *
 * Typový kontrakt záměrně nemá pole pro volný content/payload/transcript —
 * kdokoli takové pole potřebuje, musí projít code review na tomto souboru.
 * Runtime guard navíc pro každé povolené string pole vynucuje vlastní limit
 * délky (allowlist), takže i sanitizovaný stack trace smí být delší než
 * krátké ID pole, ale žádné pole nesmí být neomezené.
 */
export type H2LogPurpose =
  | "ingest"
  | "processing"
  | "delivery"
  | "buddy"
  | "context"
  | "extraction_operational"
  | "extraction_blind"
  | "job"
  | "health"
  | "config"
  | "auth";

export type H2LogStatus = "ok" | "error" | "retry" | "quarantined" | "skipped";

export type H2LogFields = {
  purpose: H2LogPurpose;
  status: H2LogStatus;
  ownerId?: string;
  jobId?: string;
  rawEventId?: string;
  errorCode?: string;
  /** Krátký bezpečný popis chyby (§31.7) — nikdy raw user/assistant text. */
  errorSummary?: string;
  /** Sanitizovaný stack trace (§31.7) — bez proměnných hodnot/obsahu requestu. */
  sanitizedStackTrace?: string;
  latencyMs?: number;
  attempt?: number;
  inputTokenCount?: number;
  outputTokenCount?: number;
};

/**
 * Allowlist povolených string polí s vlastním limitem délky. Pole, které
 * v allowlistu chybí, ale v H2LogFields existuje jako string, je defaultně
 * odmítnuto s limitem 0 — nová pole musí limit explicitně dostat zde, ne
 * jen v typu.
 */
type StringLoggableKey = Exclude<
  {
    [K in keyof H2LogFields]: H2LogFields[K] extends string | undefined ? K : never;
  }[keyof H2LogFields],
  undefined | "purpose" | "status"
>;

const STRING_FIELD_LIMITS: Record<StringLoggableKey, number> = {
  ownerId: 64,
  jobId: 64,
  rawEventId: 64,
  errorCode: 64,
  errorSummary: 300,
  sanitizedStackTrace: 4000,
};

export class H2LogPayloadError extends Error {
  constructor(key: string) {
    super(
      `H2 logger: pole "${key}" překračuje povolený limit pro strukturovaný log (možný content payload)`,
    );
    this.name = "H2LogPayloadError";
  }
}

function assertSafeStringValue(key: keyof typeof STRING_FIELD_LIMITS, value: string): void {
  const limit = STRING_FIELD_LIMITS[key];
  if (value.length > limit) {
    throw new H2LogPayloadError(key);
  }
}

/** purpose/status jsou povinná pole s uzavřenou množinou hodnot (union type) — bez délkového rizika. */
const ENUM_FIELDS = new Set<keyof H2LogFields>(["purpose", "status"]);

export function logH2Event(fields: H2LogFields): void {
  for (const key of Object.keys(fields) as Array<keyof H2LogFields>) {
    const value = fields[key];
    if (typeof value !== "string" || ENUM_FIELDS.has(key)) continue;
    if (!(key in STRING_FIELD_LIMITS)) {
      throw new H2LogPayloadError(key);
    }
    assertSafeStringValue(key as keyof typeof STRING_FIELD_LIMITS, value);
  }
  const record = {
    ts: new Date().toISOString(),
    ...fields,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(record));
}
