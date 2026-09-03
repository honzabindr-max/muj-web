/**
 * Manifest env proměnných, které kód na hranicích requestu čte přes
 * `requireEnv()` (fail-closed — chybějící hodnota vyhodí `H2ConfigError`)
 * nebo přes degradovaný config vzor (`buildAuthConfig()` — chybějící
 * hodnota nezpůsobí crash, jen tichou degradaci, žádné providery).
 *
 * Zdroj pravdy je samotný kód (`grep -rn "requireEnv(" h2/ app/`) — tento
 * soubor je jeho strojově čitelný zrcadlový obraz, stejný vzor jako
 * `h2/build-governance/at-ownership.ts` (Build Spec §6). Aktualizovat v
 * STEJNÉM commitu, kdy nový modul přidá vlastní `requireEnv()` volání.
 *
 * Účel: preflight kontrola před produkčním deployem (BUILD-STATUS.md
 * pravidlo č. 8) — `h2/db/scripts/check-required-env.ts` ověřuje PŘÍTOMNOST
 * těchto proměnných proti `vercel env ls`, nikdy jejich hodnoty. Lokální
 * testy ani CI tuhle třídu chyby nemůžou odhalit (produkční Vercel env je
 * mimo jejich dosah) — stejný důvod jako pravidlo 5 o neaplikovaných
 * migracích.
 *
 * `H2_ENCRYPTION_KEY_V{n}`: jméno proměnné je dynamické podle aktivní verze
 * (`h2/crypto/keys.ts` čte `H2_ENCRYPTION_KEY_V${activeVersion}`). Tady je
 * zapsaná AKTUÁLNÍ aktivní verze (V1) — při rotaci klíče (nová aktivní
 * verze) je potřeba tenhle záznam ručně přidat/aktualizovat.
 */
export type RequiredEnvVar = {
  key: string;
  module: string;
  failureMode: "fail-closed" | "degraded";
};

export const REQUIRED_ENV_VARS: readonly RequiredEnvVar[] = [
  { key: "H2_RUNTIME_DATABASE_URL", module: "h2/db/pool.ts (getH2Pool)", failureMode: "fail-closed" },
  {
    key: "H2_ENCRYPTION_ACTIVE_KEY_VERSION",
    module: "h2/crypto/keys.ts (loadEncryptionKeyRegistry)",
    failureMode: "fail-closed",
  },
  {
    key: "H2_ENCRYPTION_KEY_V1",
    module: "h2/crypto/keys.ts (loadEncryptionKeyRegistry, aktivní verze — aktualizovat při rotaci)",
    failureMode: "fail-closed",
  },
  { key: "H2_LEDGER_HMAC_KEY", module: "h2/crypto/hmac.ts (Deletion Ledger HMAC, BUILD-20)", failureMode: "fail-closed" },
  {
    key: "H2_TELEGRAM_WEBHOOK_SECRET",
    module: "h2/ingestion/telegram-auth.ts (verifyTelegramWebhookSecret)",
    failureMode: "fail-closed",
  },
  {
    key: "H2_TELEGRAM_OWNER_USER_ID",
    module: "h2/ingestion/telegram-auth.ts (isAllowlistedTelegramSender)",
    failureMode: "fail-closed",
  },
  {
    key: "H2_GOOGLE_CLIENT_ID",
    module: "h2/identity/auth-config.ts (buildAuthConfig — chybějící = degradovaný auth, ne crash)",
    failureMode: "degraded",
  },
  {
    key: "H2_GOOGLE_CLIENT_SECRET",
    module: "h2/identity/auth-config.ts (buildAuthConfig — chybějící = degradovaný auth, ne crash)",
    failureMode: "degraded",
  },
  {
    key: "H2_AUTH_SECRET",
    module: "h2/identity/auth-config.ts (buildAuthConfig — chybějící = degradovaný auth, ne crash)",
    failureMode: "degraded",
  },
];
