/**
 * Capability model per Technical Architecture v1.2 §18: autonomie je per
 * capability, ne globální. OBSERVE < SUGGEST < ACT. ACT je vždy default
 * off a jeho první povolení vyžaduje recent re-auth (§31.2, BUILD-03A).
 */
export type H2Capability = "OBSERVE" | "SUGGEST" | "ACT";

export type H2CapabilityConfig = {
  calendar: H2Capability;
};

export const H2_CAPABILITY_DEFAULTS: H2CapabilityConfig = {
  calendar: "OBSERVE",
};

/**
 * Feature flags pro postupné zapínání funkčnosti po jednotlivých BUILD
 * blocích, bez potřeby měnit tento config modul. Vlastnící blok přepne
 * svůj flag na true až po AT GREEN, ne dřív.
 */
export type H2FeatureFlags = {
  telegramIngest: boolean;
  telegramVoice: boolean;
  webBuddyChat: boolean;
  calendarIntegration: boolean;
};

export const H2_FEATURE_FLAG_DEFAULTS: H2FeatureFlags = {
  telegramIngest: true,
  telegramVoice: true,
  webBuddyChat: true,
  calendarIntegration: false,
};
