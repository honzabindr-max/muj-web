/**
 * Retention policy (§31.8) — čisté funkce pro výpočet cutoff a jeden
 * generický purge helper pro řádky s timestamp sloupcem. Plánovač (kdy
 * job spustit) vlastní BUILD-23 — tento modul jen odpovídá na otázku
 * "co je dnes expirované", ne "kdy to spustit".
 *
 * Zahrnuty jsou jen kategorie, které H2 sám aktivně maže; kategorie bez
 * automatické expirace (raw user/Buddy turns, evidence lineage) tu záměrně
 * chybí — ty se mažou jen explicitní akcí (delete/correction), ne časem.
 */
export type H2RetentionCategory =
  | "voice_audio_quarantined"
  | "provider_debug_response"
  | "platform_logs"
  | "server_side_export"
  | "incidents_job_runs_metadata";

const RETENTION_HOURS: Record<H2RetentionCategory, number> = {
  voice_audio_quarantined: 24,
  provider_debug_response: 24 * 7,
  platform_logs: 24 * 30,
  server_side_export: 24,
  incidents_job_runs_metadata: 24 * 365,
};

/** Řádky s `occurredAt` starším než tento cutoff jsou expirované. */
export function computeRetentionCutoff(category: H2RetentionCategory, now: Date): Date {
  const hours = RETENTION_HOURS[category];
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export function isExpired(category: H2RetentionCategory, occurredAt: Date, now: Date): boolean {
  return occurredAt.getTime() < computeRetentionCutoff(category, now).getTime();
}
