/**
 * Structured logger bez content payloadů (Technical Architecture v1.2 §31.7).
 * Typový kontrakt záměrně nemá pole pro volný text/payload/transcript —
 * kdokoli takové pole potřebuje, musí projít code review na tomto souboru.
 * Runtime guard navíc odmítne jakoukoli hodnotu delší než bezpečný limit,
 * jako obranu proti omylem proteklému raw obsahu skrz povolené pole.
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
  latencyMs?: number;
  attempt?: number;
};

const MAX_STRING_FIELD_LENGTH = 128;

export class H2LogPayloadError extends Error {
  constructor(key: string) {
    super(
      `H2 logger: pole "${key}" překračuje bezpečnou délku pro strukturovaný log (možný content payload)`,
    );
    this.name = "H2LogPayloadError";
  }
}

function assertSafeValue(key: string, value: unknown): void {
  if (typeof value === "string" && value.length > MAX_STRING_FIELD_LENGTH) {
    throw new H2LogPayloadError(key);
  }
}

export function logH2Event(fields: H2LogFields): void {
  for (const [key, value] of Object.entries(fields)) {
    assertSafeValue(key, value);
  }
  const record = {
    ts: new Date().toISOString(),
    ...fields,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(record));
}
