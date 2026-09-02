import { H2_CAPABILITY_DEFAULTS, H2_FEATURE_FLAG_DEFAULTS } from "./capabilities";
import type { H2CapabilityConfig, H2FeatureFlags } from "./capabilities";
import { getH2Environment } from "./environment";
import type { H2Environment } from "./environment";
import { H2_MODELS } from "./models";

export type H2Config = {
  environment: H2Environment;
  models: typeof H2_MODELS;
  capabilities: H2CapabilityConfig;
  featureFlags: H2FeatureFlags;
};

let cachedConfig: H2Config | null = null;

/**
 * Vstupní bod H2 konfigurace. Validace/skládání konfigurace se děje líně,
 * při prvním použití na hranici H2 requestu (např. /api/h2/health), ne
 * při globálním Next.js app boot — chybějící H2 secret proto nesmí rozbít
 * zbytek muj-web webu.
 */
export function getH2Config(source: Record<string, string | undefined> = process.env): H2Config {
  if (cachedConfig) return cachedConfig;
  cachedConfig = {
    environment: getH2Environment(source),
    models: H2_MODELS,
    capabilities: H2_CAPABILITY_DEFAULTS,
    featureFlags: H2_FEATURE_FLAG_DEFAULTS,
  };
  return cachedConfig;
}

export function resetH2ConfigCacheForTests(): void {
  cachedConfig = null;
}

export { requireEnv } from "./schema";
export { H2ConfigError } from "./errors";
export { H2_MODELS } from "./models";
export type { H2ModelPurpose } from "./models";
export { H2_CAPABILITY_DEFAULTS, H2_FEATURE_FLAG_DEFAULTS } from "./capabilities";
export type { H2Capability, H2CapabilityConfig, H2FeatureFlags } from "./capabilities";
export { getH2Environment } from "./environment";
export type { H2Environment } from "./environment";
