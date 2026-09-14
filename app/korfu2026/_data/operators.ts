import type { Operator, Checklist, ContactTemplate } from "./types";

/**
 * Provozovatelé — SOURCE_PACK části 10, 11, 12 (ř. 129–290).
 * Každý dynamický údaj (cena, dostupnost) nese freshness + source — D01-B.
 */

// ─── Koně (část 10, SP:129–179) ───────────────────────────────────────────────

export const HORSE_OPERATORS: Operator[] = [
  {
    id: "katreena-horse-riding",
    name: "Katreena Horse Riding",
    role: "prvni-volba",
    base: "Close to Roda Taxi, Roda, Kerkira 49081",
    offers: [
      {
        label: "Beach and Nature Ride",
        value: "1 h 15 min, 30 € / osoba",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "katreenahorseridingcorfu.com/experiences",
          url: "https://www.katreenahorseridingcorfu.com/experiences",
        },
        sp: "SP:141",
      },
      {
        label: "Sunset Beach Ride",
        value: "1,5 h, 45 € / osoba",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "katreenahorseridingcorfu.com/experiences",
          url: "https://www.katreenahorseridingcorfu.com/experiences",
        },
        sp: "SP:142",
      },
      {
        label: "Sunset Swim (jízda + koupání s koňmi)",
        value: "65 € / osoba",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "katreenahorseridingcorfu.com/experiences",
          url: "https://www.katreenahorseridingcorfu.com/experiences",
        },
        sp: "SP:143",
      },
      {
        label: "Advanced Ride",
        value: "65 € / osoba, rezervace přímým kontaktem",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "katreenahorseridingcorfu.com/experiences",
          url: "https://www.katreenahorseridingcorfu.com/experiences",
        },
        sp: "SP:144",
      },
      {
        label:
          "3hodinové/denní/BBQ balíčky + otevírací doba 09:00–13:00 a 15:00–22:00",
        value: "starší lead — aktuální stránka nepotvrdila",
        freshness: "starsi-lead",
        checkedAt: null,
        source: {
          label: "katreenahorseridingcorfu.com",
          url: "https://www.katreenahorseridingcorfu.com/",
        },
        note: "Aktuální oficiální stránka tyto balíčky nepotvrdila → označit jako starší lead, nikoli jako aktuální nabídku.",
        sp: "SP:146–148",
      },
    ],
    phones: ["+30 694 482 9461"],
    emails: ["katreenahorseriding@gmail.com"],
    sources: [
      {
        label: "katreenahorseridingcorfu.com",
        url: "https://www.katreenahorseridingcorfu.com/",
      },
      {
        label: "katreenahorseridingcorfu.com/experiences",
        url: "https://www.katreenahorseridingcorfu.com/experiences",
      },
    ],
    warnings: [
      'Ceny a dostupnost pro 14.–20. 9. 2026 znovu potvrdit — štítek „ověřit aktuálně".',
      "Tvrdý zákaz: žádné tvrzení, že vyjížďka začíná před Silver Beach Hotelem nebo vede po celé hlavní Roda Beach. Meeting point a konkrétní úsek pobřeží uvádět jen podle potvrzení provozovatele. (SP:133–135)",
    ],
    freshness: "overit-aktualne",
    sp: "SP:132–151",
  },
  {
    id: "arena-horse-riding",
    name: "Arena Horse Riding",
    role: "alternativa",
    base: "Agios Spiridon / Perithia",
    offers: [
      {
        label: "Začátečníci skupina: morning/afternoon beach ride",
        value: "45 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:155",
      },
      {
        label: "Začátečníci skupina: sunset",
        value: "55 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:155",
      },
      {
        label: "Začátečníci private: beach ride",
        value: "80 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:156",
      },
      {
        label: "Začátečníci private: sunset",
        value: "100 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:156",
      },
      {
        label: "Začátečníci private: swimming",
        value: "120 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:156",
      },
      {
        label: "Pokročilí skupina: morning beach",
        value: "70 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:157",
      },
      {
        label: "Pokročilí skupina: sunset",
        value: "85 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:157",
      },
      {
        label: "Pokročilí skupina: half day",
        value: "150 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:157",
      },
      {
        label: "Pokročilí skupina: all day",
        value: "280 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:157",
      },
      {
        label: "Pokročilí private: morning beach",
        value: "100 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:158",
      },
      {
        label: "Pokročilí private: sunset",
        value: "120 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:158",
      },
      {
        label: "Pokročilí private: swimming",
        value: "150 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: {
          label: "arenahorseriding.com",
          url: "https://www.arenahorseriding.com/",
        },
        sp: "SP:158",
      },
    ],
    phones: ["+30 698 733 7101"],
    emails: ["katia6135@hotmail.com"],
    sources: [
      {
        label: "arenahorseriding.com",
        url: "https://www.arenahorseriding.com/",
      },
    ],
    warnings: [
      "Storno: méně než 3 dny předem není podle webu refundovatelné. (SP:159–160)",
      "Všechny ceny ověřit aktuálně.",
    ],
    freshness: "overit-aktualne",
    sp: "SP:153–160",
  },
];

/** Neověřené jezdecké leady — SP:162–166. Vše označeno jako neovereno. */
export const HORSE_LEADS: Operator[] = [
  {
    id: "north-corfu-horses",
    name: "North Corfu Horses / Corfu Tourist Services",
    role: "lead",
    base: null,
    offers: [],
    phones: [],
    emails: [],
    sources: [
      { label: "northcorfuhorses.com", url: "https://northcorfuhorses.com" },
      {
        label: "corfutouristservices.gr — horse riding",
        url: "https://corfutouristservices.gr/tours/horse-riding-corfu/",
      },
    ],
    warnings: [
      "Dříve dohledané trasy: Agios Spiridon, Antinioti, Almyros, Cape Ekaterini, Old Perithia.",
      "Ceny a identitu provozovatele znovu ověřit. (SP:163–164)",
    ],
    freshness: "neovereno",
    sp: "SP:163–164",
  },
  {
    id: "angels-horses",
    name: "Angel's Horses",
    role: "lead",
    base: null,
    offers: [
      {
        label:
          "Časy 09:00/11:00/17:00/19:00; orientačně 30 € nebo 35 € s transferem",
        value: "neověřeno",
        freshness: "neovereno",
        checkedAt: null,
        source: null,
        note: "Místo, provoz i cenu považovat za NEOVĚŘENÉ.",
        sp: "SP:165–166",
      },
    ],
    phones: ["+30 699 502 2671"],
    emails: ["horses.corfu@gmail.com"],
    sources: [],
    warnings: ["Místo, provoz i cenu považovat za NEOVĚŘENÉ. (SP:165–166)"],
    freshness: "neovereno",
    sp: "SP:165–166",
  },
];

// ─── Lodě (část 11, SP:181–229) ───────────────────────────────────────────────

export const BOAT_OPERATORS: Operator[] = [
  {
    id: "bb-boat-rentals",
    name: "B&B Boat Rentals",
    role: "alternativa",
    base: "Alipa Port, Paleokastritsa",
    offers: [
      {
        label: "Bezlicenční loď — Paleokastritsa",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "rentaboatcorfu.gr",
          url: "https://rentaboatcorfu.gr",
        },
        note: "Hodnocení 5,0/196 recenzí (doplněk 14. 9. 2026).",
        sp: "SP:188–189, SP:512–528",
      },
    ],
    phones: ["+30 697 458 5157"],
    emails: [],
    sources: [{ label: "rentaboatcorfu.gr", url: "https://rentaboatcorfu.gr" }],
    warnings: [],
    freshness: "overit-aktualne",
    sp: "SP:188–189, SP:512–528",
  },
  {
    id: "dinos-boat-rentals",
    name: "Dinos Boat Rentals",
    role: "alternativa",
    base: "Paleokastritsa",
    offers: [
      {
        label: "30HP no-license půlden/celý den nebo skipper",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "dinosboatrentals.com",
          url: "https://dinosboatrentals.com",
        },
        note: "Web blokoval automatické načtení → vše potvrdit přímo. Hodnocení 4,9/537 recenzí (doplněk 14. 9. 2026).",
        sp: "SP:189–191, SP:512–528",
      },
    ],
    phones: ["+30 697 375 4561"],
    emails: ["dinosboatrentalscfu@gmail.com"],
    sources: [
      { label: "dinosboatrentals.com", url: "https://dinosboatrentals.com" },
    ],
    warnings: [
      "Web blokoval automatické načtení → vše potvrdit přímo. (SP:190–191)",
    ],
    freshness: "overit-aktualne",
    sp: "SP:189–191, SP:512–528",
  },
  {
    id: "aeolus-boat-rentals",
    name: "Aeolus Boat Rentals",
    role: "alternativa",
    base: "Liapades Beach",
    offers: [
      {
        label: "Bezlicenční loď — Liapades",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "aeolusboatrentals.gr",
          url: "https://aeolusboatrentals.gr",
        },
        note: "Sezonu a hodiny ověřit. Hodnocení 4,0/57 recenzí (doplněk 14. 9. 2026).",
        sp: "SP:192–193, SP:512–528",
      },
    ],
    phones: [],
    emails: [],
    sources: [
      { label: "aeolusboatrentals.gr", url: "https://aeolusboatrentals.gr" },
    ],
    warnings: [
      "Sezonu a hodiny ověřit. WhatsApp +30 698 311 2325. (SP:192–193)",
    ],
    freshness: "overit-aktualne",
    sp: "SP:192–193, SP:512–528",
  },
  {
    id: "nissaki-boat-rental",
    name: "Nissaki Boat Rental",
    role: "alternativa",
    base: "Nissaki",
    offers: [
      {
        label: "Bezlicenční loď — Nissaki/severovýchod",
        value:
          "14.–15. 9. cca 100–190 €/den, od 16. 9. (nízká sezona) cca 90–170 €/den, podle lodi, často bez paliva",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "nissakiboatrental.com",
          url: "https://nissakiboatrental.com/prices-reservation-nissaki-boat-rental-corfu/",
        },
        note: "Provozovatel označovaný i jako Fontas Boats. Hodnocení 4,9/343 recenzí, cca 15minutová instruktáž, lodě kolem 30 HP (doplněk 14. 9. 2026).",
        sp: "SP:196–197, SP:221–222, SP:529–539",
      },
    ],
    phones: [],
    emails: [],
    sources: [
      {
        label: "nissakiboatrental.com",
        url: "https://nissakiboatrental.com/prices-reservation-nissaki-boat-rental-corfu/",
      },
    ],
    warnings: ["Cenu, povolený dosah a dostupnost ověřit aktuálně."],
    freshness: "overit-aktualne",
    sp: "SP:196–197, SP:529–539",
  },
  {
    id: "skyway-boats-roda",
    name: "Skyway Boats",
    role: "alternativa",
    base: "Roda Beach",
    offers: [
      {
        label: "No-license i speed boats — Roda / severní pobřeží",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "skywayboats.com",
          url: "https://skywayboats.com/contact-us/",
        },
        note: 'Označení „bez licence" ověřit písemně podle lodi a aktuální legislativy. Ceny od cca 45–60 €/půlden u základních lodí (doplněk 14. 9. 2026).',
        sp: "SP:201–203, SP:553–558",
      },
    ],
    phones: [],
    emails: ["skywayboats@gmail.com"],
    sources: [
      { label: "skywayboats.com", url: "https://skywayboats.com/contact-us/" },
    ],
    warnings: [
      'Marketingové označení „bez licence" ověřit písemně. (SP:202–203)',
      "WhatsApp +30 698 568 7929.",
    ],
    freshness: "overit-aktualne",
    sp: "SP:201–203, SP:553–558",
  },
  {
    id: "wave-boat-company-sidari",
    name: "Wave Boat Company",
    role: "alternativa",
    base: "Sidari — hlavní pláž",
    offers: [
      {
        label: "Bezlicenční loď — severní pobřeží",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "waveboathire.com",
          url: "https://waveboathire.com/en",
        },
        note: "Požadované doklady a povolený dosah ověřit. 30HP loď cca 160 €/4h nebo 190 €/den, palivo u delších pronájmů není zahrnuto, vratná záloha 50 € (doplněk 14. 9. 2026).",
        sp: "SP:204–205, SP:553–558",
      },
    ],
    phones: [],
    emails: ["info@waveboathire.com"],
    sources: [
      { label: "waveboathire.com", url: "https://waveboathire.com/en" },
    ],
    warnings: ["Požadované doklady a povolený dosah ověřit. (SP:204–205)"],
    freshness: "overit-aktualne",
    sp: "SP:204–205, SP:553–558",
  },
  {
    id: "sun-fun-club-agios-georgios-pagon",
    name: "Sun Fun Club Boat Hire",
    role: "alternativa",
    base: "Agios Georgios Pagon",
    offers: [
      {
        label: "Bezlicenční čluny do 30 HP a silnější s licencí",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "sunfunclub-boathire.com",
          url: "https://sunfunclub-boathire.com",
        },
        note: "Výchozí bod k Porto Timoni v povoleném dosahu. Bezlicenční 30HP lodě mají podle webu GPS, mapu oblasti a bezpečnostní výbavu (doplněk 14. 9. 2026).",
        sp: "SP:206–207, SP:548–552",
      },
    ],
    phones: [],
    emails: [],
    sources: [
      {
        label: "sunfunclub-boathire.com",
        url: "https://sunfunclub-boathire.com",
      },
    ],
    warnings: [],
    freshness: "overit-aktualne",
    sp: "SP:206–207, SP:548–552",
  },
  {
    id: "corfu-rent-a-boat-ampelaki",
    name: "Corfu Rent a Boat",
    role: "lead",
    base: "Ampelaki, Paleokastritsa",
    offers: [
      {
        label: "Bezlicenční loď — Ampelaki/Paleokastritsa",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "corfurentaboat.com",
          url: "https://www.corfurentaboat.com",
        },
        note: "Hodnocení 4,8/626 recenzí. Nový lead, mimo původní SOURCE_PACK audit — ověřit před rezervací.",
        sp: "SP:512–528",
      },
    ],
    phones: [],
    emails: [],
    sources: [
      { label: "corfurentaboat.com", url: "https://www.corfurentaboat.com" },
    ],
    warnings: ["Nový lead, mimo původní SOURCE_PACK audit — ověřit před rezervací."],
    freshness: "overit-aktualne",
    sp: "SP:512–528",
  },
  {
    id: "corfu-explore-boats",
    name: "Corfu Explore Boats",
    role: "lead",
    base: "Paleokastritsa",
    offers: [
      {
        label: "Bezlicenční loď — Paleokastritsa",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "corfuexploreboats.com",
          url: "http://www.corfuexploreboats.com",
        },
        note: "Hodnocení 4,9/389 recenzí. Nový lead, mimo původní SOURCE_PACK audit — ověřit před rezervací.",
        sp: "SP:512–528",
      },
    ],
    phones: [],
    emails: [],
    sources: [
      { label: "corfuexploreboats.com", url: "http://www.corfuexploreboats.com" },
    ],
    warnings: ["Nový lead, mimo původní SOURCE_PACK audit — ověřit před rezervací."],
    freshness: "overit-aktualne",
    sp: "SP:512–528",
  },
  {
    id: "blue-lagoon-corfu",
    name: "Blue Lagoon Corfu",
    role: "alternativa",
    base: "Paleokastritsa",
    offers: [
      {
        label: "Pronájem lodi i výlety se skipperem do jeskyní",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "bluelagooncorfu.com",
          url: "https://bluelagooncorfu.com",
        },
        note: "Hodnocení 4,9/340 recenzí (doplněk 14. 9. 2026).",
        sp: "SP:186, SP:512–528",
      },
    ],
    phones: [],
    emails: [],
    sources: [{ label: "bluelagooncorfu.com", url: "https://bluelagooncorfu.com" }],
    warnings: [],
    freshness: "overit-aktualne",
    sp: "SP:186, SP:512–528",
  },
  {
    id: "seahorse-corfu",
    name: "Seahorse",
    role: "alternativa",
    base: "Alipa Port",
    offers: [
      {
        label: "Bezlicenční loď — Alipa Port",
        value: "od cca 100 €, půlden i celý den",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "seahorsecorfu.com",
          url: "https://seahorsecorfu.com",
        },
        note: "Hodnocení 4,8/315 recenzí (doplněk 14. 9. 2026).",
        sp: "SP:186, SP:512–528",
      },
    ],
    phones: [],
    emails: [],
    sources: [{ label: "seahorsecorfu.com", url: "https://seahorsecorfu.com" }],
    warnings: [],
    freshness: "overit-aktualne",
    sp: "SP:186, SP:512–528",
  },
  {
    id: "capitano-boats",
    name: "Capitano Boats",
    role: "lead",
    base: "Alipa Port",
    offers: [
      {
        label: "Lodě pro 4–8 osob, možnost výletu se skipperem",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "capitanoboats.com",
          url: "https://capitanoboats.com",
        },
        note: "Bezplatné parkování u přístavu. Nový lead, mimo původní SOURCE_PACK audit — ověřit před rezervací.",
        sp: "SP:512–528",
      },
    ],
    phones: [],
    emails: [],
    sources: [{ label: "capitanoboats.com", url: "https://capitanoboats.com" }],
    warnings: ["Nový lead, mimo původní SOURCE_PACK audit — ověřit před rezervací."],
    freshness: "overit-aktualne",
    sp: "SP:512–528",
  },
  {
    id: "ninos-boat-rental",
    name: "Ninos Boat Rental",
    role: "lead",
    base: "Gefyra/Liapades",
    offers: [
      {
        label: "Bezlicenční loď — nejbližší start k Limni/Stelari/Chomi",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "corfuboatrent.com",
          url: "https://corfuboatrent.com",
        },
        note: "Hodnocení 4,6/1207 recenzí. Nový lead, mimo původní SOURCE_PACK audit — ověřit před rezervací.",
        sp: "SP:512–528",
      },
    ],
    phones: [],
    emails: [],
    sources: [{ label: "corfuboatrent.com", url: "https://corfuboatrent.com" }],
    warnings: ["Nový lead, mimo původní SOURCE_PACK audit — ověřit před rezervací."],
    freshness: "overit-aktualne",
    sp: "SP:512–528",
  },
  {
    id: "nissaki-rent-a-boat-dannys",
    name: "Nissaki Rent a Boat",
    role: "alternativa",
    base: "Nissaki",
    offers: [
      {
        label: "Bezlicenční loď — Nissaki/severovýchod",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "nissakirentaboat.com",
          url: "https://nissakirentaboat.com",
        },
        note: 'Provozovatel označovaný i jako "Danny\'s Boats". Hodnocení 4,9 z cca 130 recenzí (doplněk 14. 9. 2026).',
        sp: "SP:198, SP:529–539",
      },
    ],
    phones: [],
    emails: [],
    sources: [{ label: "nissakirentaboat.com", url: "https://nissakirentaboat.com" }],
    warnings: [],
    freshness: "overit-aktualne",
    sp: "SP:198, SP:529–539",
  },
  {
    id: "porto-timoni-boat-hire",
    name: "Porto Timoni Boat Hire",
    role: "lead",
    base: "Agios Georgios Pagon",
    offers: [
      {
        label: "Bezlicenční loď — výjezd k Porto Timoni bez pěšího sestupu",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "valeriesvoyage.com",
          url: "https://valeriesvoyage.com/a-quick-guide-to-corfus-most-beautiful-beach-porto-timoni/",
        },
        note: "Hodnocení 4,9 z cca 381 recenzí. Přímý web operátora nedohledán → ověřit název a kontakt před rezervací. Nový lead, mimo původní SOURCE_PACK audit.",
        sp: "SP:548–552",
      },
    ],
    phones: [],
    emails: [],
    sources: [],
    warnings: ["Přímý web operátora nedohledán, jen zmínka v sekundárním zdroji — ověřit před rezervací."],
    freshness: "overit-aktualne",
    sp: "SP:548–552",
  },
];

// ─── Potápění (část 12, SP:250–257) ───────────────────────────────────────────

export const DIVING_OPERATORS: Operator[] = [
  {
    id: "dive-easy-acharavi",
    name: "Dive Easy Acharavi",
    role: "prvni-volba",
    base: "Acharavi",
    offers: [
      {
        label: "Try dive, ponory pro certifikované, snorkeling trips",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: { label: "divecorfu.com", url: "https://divecorfu.com" },
        note: "Malé skupiny s instruktorem, útesy, stěny, vraky, jeskyně.",
        sp: "SP:251–253",
      },
    ],
    phones: ["+30 26630 29350", "+30 697 960 0560"],
    emails: ["divecorfu@hotmail.com"],
    sources: [{ label: "divecorfu.com", url: "https://divecorfu.com" }],
    warnings: [
      "Ověřit cenu, délku, transfer z Rody, lékařský dotazník, max. hloubku, pojištění, výbavu a interval před letem. (SP:256–257)",
    ],
    freshness: "overit-aktualne",
    sp: "SP:251–253",
  },
  {
    id: "apollo-corfu-diving",
    name: "Apollo Corfu Diving",
    role: "alternativa",
    base: "Nissaki Port",
    offers: [
      {
        label: "Try diving, snorkeling — Nissaki/Barbati/Agni/Kalami/Kassiopi",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "corfudive.com",
          url: "https://corfudive.com/contact-us/",
        },
        sp: "SP:254–255",
      },
    ],
    phones: ["+30 697 470 5697"],
    emails: ["chris@corfudive.com"],
    sources: [
      { label: "corfudive.com", url: "https://corfudive.com/contact-us/" },
    ],
    warnings: [],
    freshness: "overit-aktualne",
    sp: "SP:254–255",
  },
];

// ─── Quad/skútr (část 12, SP:259–268) ─────────────────────────────────────────

export const QUAD_OPERATORS: Operator[] = [
  {
    id: "quad-corfu-adventure",
    name: "Quad Corfu Adventure",
    role: "prvni-volba",
    base: "Acharavi",
    offers: [
      {
        label: "2 h — 1 osoba / 2 osoby",
        value: "80 € / 140 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: { label: "quadcorfu.com", url: "https://quadcorfu.com" },
        sp: "SP:260–263",
      },
      {
        label: "3 h — 1 osoba / 2 osoby",
        value: "110 € / 200 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: { label: "quadcorfu.com", url: "https://quadcorfu.com" },
        sp: "SP:260–263",
      },
      {
        label: "4 h — 1 osoba / 2 osoby",
        value: "140 € / 260 €",
        freshness: "overit-aktualne",
        checkedAt: "2026-09-13",
        source: { label: "quadcorfu.com", url: "https://quadcorfu.com" },
        sp: "SP:260–263",
      },
    ],
    phones: ["+30 698 642 8516"],
    emails: ["info@quadcorfu.com"],
    sources: [{ label: "quadcorfu.com", url: "https://quadcorfu.com" }],
    warnings: [
      "Trasy: Pantokrator Highlands a Old Perithia.",
      "Max. 6 strojů / 12 osob; řidič min. 21 let, skupina B, originál dokladu, pevná obuv, helma poskytována.",
      "Malé auto je obecně bezpečnější základ — u quad/skútru kontrolovat oprávnění, helmu, pojištění, spoluúčast, fotky škod a krytí cestovním pojištěním; nejezdit v žabkách. (SP:267–268)",
    ],
    freshness: "overit-aktualne",
    sp: "SP:260–263",
  },
  {
    id: "top-gear-roda",
    name: "Top Gear Roda",
    role: "lead",
    base: "Hlavní silnice, Roda",
    offers: [
      {
        label: "Půjčovna skútrů, motorek, quadů a kol",
        value: "neověřeno — web se nepodařilo spolehlivě načíst",
        freshness: "neovereno",
        checkedAt: null,
        source: null,
        note: "Ceny, provoz, pojištění a existenci potvrdit přímo.",
        sp: "SP:264–266",
      },
    ],
    phones: ["+30 26630 63191", "+30 26630 64554"],
    emails: [],
    sources: [],
    warnings: [
      "Ceny, provoz, pojištění a existenci potvrdit přímo. (SP:264–266)",
    ],
    freshness: "neovereno",
    sp: "SP:264–266",
  },
];

// ─── Checklisty (části 10, 11, 12) ────────────────────────────────────────────

export const CHECKLISTS: Checklist[] = [
  {
    id: "kone",
    title: "Povinný checklist před rezervací jízdy na koni",
    items: [
      "Pro koho je trasa vhodná a zda berou úplné začátečníky.",
      "Hmotnostní a zdravotní omezení.",
      'Zda „beach ride" vede skutečně po pláži a zda „swim" znamená vstup do vody.',
      "Čas v sedle vs. celkové trvání výletu.",
      "Helma, pojištění, fotografie, nápoje, případný transfer.",
      "Meeting point, oblečení, storno a postup při špatném počasí.",
      "Dlouhé kalhoty a uzavřené boty.",
      "Na swimming ride plavky, ručník a suché oblečení.",
    ],
    sp: "SP:168–173",
  },
  {
    id: "lod",
    title: "Bezpečnostní checklist — loď",
    items: [
      "Jen loď výslovně označená jako bez licence.",
      "Nechat si zakreslit povolenou oblast a prostudovat limity.",
      "Instruktáž: start, neutrál, zpátečka, nouzové vypnutí motoru, kotva.",
      "Vyfotit trup, vrtuli, palivoměr a záchranné vybavení před odjezdem.",
      "Ověřit pojištění, palivo, asistenci a aktuální předpověď počasí a vln.",
      "Nevjíždět do jeskyní při vlnách nebo bez povolení.",
      "Nekotvit mezi plavci ani na mořské trávě (Posidonia).",
      "Mobil ve voděodolném pouzdře, powerbanka, voda, SPF, pokrývka hlavy a boty do vody.",
      "Alkohol před řízením lodi vynechat.",
    ],
    sp: "SP:224–229",
  },
  {
    id: "potapeni",
    title: "Checklist před rezervací potápění / šnorchlování",
    items: [
      "Cenu, délku a transfer z Rody potvrdit.",
      "Lékařský dotazník (try dive vyžaduje dotazník).",
      "Maximální hloubka pro danou variantu.",
      "Pojištění a výbava v ceně?",
      "Interval před letem nebo výjezdem do vyšší nadmořské výšky — postupovat podle instrukcí centra.",
    ],
    sp: "SP:256–257",
  },
  {
    id: "auto",
    title: "Checklist při půjčování auta",
    items: [
      "Konečná cena a všechny daně.",
      "Kauce a výše spoluúčasti.",
      "CDW / SCDW — zda krytí zahrnuje pneumatiky, skla, podvozek a zrcátka.",
      "Palivová politika (plný→plný / plný→prázdný).",
      "Druhý řidič — příplatek?",
      "Asistence a náhradní vozidlo při poruše.",
      "Fotodokumentace vozu před odjezdem (existující škody).",
    ],
    sp: "SP:333–335",
  },
  {
    id: "predodjezd",
    title: "Checklist před odjezdem / na místě",
    items: [
      "EHIC a cestovní pojištění platné pro Řecko.",
      "Pravidelné léky v originálním balení s názvem léčivé látky.",
      "Kopie dokladů bezpečně uložena online (NE ve veřejném webu).",
      "Offline mapa Korfu stažena do telefonu.",
      "Ověřit roamingový limit datové SIM.",
      "Platební karta + hotovost v eurech.",
      "Při platbě kartou odmítnout přepočet do Kč, platit v EUR.",
      "Uložit hotel, nemocnici, půjčovny a nouzová čísla do telefonu.",
    ],
    sp: "SP:371–374",
  },
];

// ─── Kontaktní šablony (část 10, 12) ──────────────────────────────────────────

export const CONTACT_TEMPLATES: ContactTemplate[] = [
  {
    id: "kone",
    title: "Kontaktní zpráva — koně (Katreena / Arena)",
    body: `Hello,
We are two adults staying at Silver Beach Hotel, Roda from 14 to 21 September 2026.
We are interested in a horse riding experience — [beginners/experienced riders].
Could you please let us know about availability and pricing for our dates?
Thank you.`,
    sp: "SP:175–179",
  },
  {
    id: "potapeni",
    title: "Kontaktní zpráva — Dive Easy Acharavi",
    body: `Hello,
We are two adults staying in Roda from 14 to 21 September 2026.
We would like to book a try dive / snorkeling trip for two people.
Could you confirm availability, price, location and whether transfer from Roda is possible?
Thank you.`,
    sp: "SP:283–285",
  },
  {
    id: "quad",
    title: "Kontaktní zpráva — Quad safari (Quad Corfu Adventure)",
    body: `Hello,
We are two adults staying in Roda from 14 to 21 September 2026.
We are interested in a quad safari (Pantokrator Highlands or Old Perithia route).
Could you confirm availability, pricing and any requirements for two riders?
Thank you.`,
    sp: "SP:286–289",
  },
];
