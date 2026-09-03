/**
 * Sovereignty fast path (DEC-007, Technical Architecture v1.2 §8.1) —
 * deterministický exact-match detektor, NIKDY LLM klasifikace ("detector
 * nesmí hádat význam běžné věty"). Zachytává jen zprávu, která je PŘESNĚ
 * `/stop`, `/pause` nebo `/resume` (po trimu, case-insensitive, celá
 * zpráva, nic jiného) — holé "stop"/"pause" v přirozené větě sem
 * NEPATŘÍ (I7.6: chybná klasifikace nesmí nevratně připravit zprávu o
 * normální zpracování), to řeší až Command Gate stage uvnitř BUILD-10
 * pipeline, kde je kontext.
 *
 * Sdílená funkce mezi `h2/ingestion/ingest-message.ts` (DEC-007 bod 2 —
 * bump ve STEJNÉ transakci jako raw_event insert) a budoucím BUILD-10
 * Command Gate stage (DEC-007 bod 5 — re-detekce stejnou funkcí je
 * strukturální důkaz, že epoch už byl bumpnutý při ingestu, takže
 * pipeline nesmí bumpnout znovu — I7.3 idempotence bez potřeby nové
 * migrace/markeru).
 */
export type FastPathControlCommand = "STOP" | "PAUSE" | "RESUME";

const FAST_PATH_COMMANDS: Readonly<Record<string, FastPathControlCommand>> = {
  "/stop": "STOP",
  "/pause": "PAUSE",
  "/resume": "RESUME",
};

export function detectFastPathControlCommand(text: string): FastPathControlCommand | null {
  return FAST_PATH_COMMANDS[text.trim().toLowerCase()] ?? null;
}
