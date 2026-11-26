import type { MetadataRoute } from "next";
import { SIGN_LIST } from "@/astroroast/engine";
import { SITE_URL } from "./_lib/helpers";

/** Datum poslední úpravy statického obsahu (ručně zvyšovat při větší změně textů). */
const CONTENT_UPDATED = "2026-11-26";

export default function sitemap(): MetadataRoute.Sitemap {
  // Denní stránky (úvod a znamení) se opravdu mění každý den. Ostatní mají stabilní datum poslední úpravy obsahu.
  const now = new Date();
  const contentUpdated = new Date(CONTENT_UPDATED);
  return [
    { url: `${SITE_URL}/astroroast`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/astroroast/par`, lastModified: contentUpdated, changeFrequency: "weekly", priority: 0.8 },
    ...SIGN_LIST.map((s) => ({
      url: `${SITE_URL}/astroroast/znameni/${s.id}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
