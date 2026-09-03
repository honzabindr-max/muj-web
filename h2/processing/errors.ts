/**
 * Typed errors pro queue/lease/fencing/quarantine (BUILD-05, Technical
 * Architecture v1.2 §4.2, §4.3). Fencing selhání se vždy vrací jako
 * explicitní chyba, nikdy jako tichý no-op úspěch (Build Spec BUILD-05
 * plán, Rozhodnutí 4).
 */
export class H2FencingError extends Error {
  constructor(
    public readonly code: "STALE_FENCING_TOKEN",
    public readonly jobId: string,
  ) {
    super(`H2 processing: ${code} (job ${jobId})`);
    this.name = "H2FencingError";
  }
}

export class H2QueueError extends Error {
  constructor(public readonly code: "JOB_NOT_FOUND" | "JOB_NOT_PROCESSING") {
    super(`H2 processing: ${code}`);
    this.name = "H2QueueError";
  }
}
