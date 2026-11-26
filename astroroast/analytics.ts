// AstroRoast.ai: tenká analytická vrstva. Posílá události do Vercel Web Analytics (vlastní události)
// a zároveň do window.dataLayer (GTM/GA4), pokud existuje.
// Soukromí: datum narození sem NIKDY nepatří. Klíče, které na datum narození připomínají, se zahodí.
import { track as vaTrack } from "@vercel/analytics";

export type ArEvent =
  | "generate"
  | "share"
  | "download"
  | "fake_door"
  | "fake_door_dismiss"
  | "fake_door_to_free"
  | "crosssell"
  | "couple_generate";

type DataLayerWindow = Window & { dataLayer?: Array<Record<string, unknown>> };

const FORBIDDEN_KEY = /birth|born|date|datum|narozen|dob|year|rok/i;

export function track(event: ArEvent, props?: Record<string, string | number>): void {
  if (typeof window === "undefined") return;
  const safe: Record<string, string | number> = {};
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (FORBIDDEN_KEY.test(key)) continue;
      if (typeof value !== "string" && typeof value !== "number") continue;
      safe[key] = value;
    }
  }
  try {
    vaTrack(`ar_${event}`, safe);
  } catch {
    // analytika nesmí nikdy shodit stránku
  }
  const dl = (window as DataLayerWindow).dataLayer;
  if (!Array.isArray(dl)) return;
  try {
    dl.push({ event: `ar_${event}`, ...safe });
  } catch {
    // totéž
  }
}
