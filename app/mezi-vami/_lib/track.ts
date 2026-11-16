"use client";

// Měření funnelu (Vercel Web Analytics, vlastní události). Bez osobních údajů — jen názvy kroků.
import { track as vaTrack } from "@vercel/analytics";

export type FunnelEvent =
  | "landing_cta"
  | "osoba_a_done"
  | "osoba_b_done"
  | "vysledek_ready"
  | "vysledek_view"
  | "share_click"
  | "save_click"
  | "order_view"
  | "payment_click";

export function track(e: FunnelEvent) {
  try {
    vaTrack(e);
  } catch {
    /* měření nesmí rozbít tok */
  }
}
