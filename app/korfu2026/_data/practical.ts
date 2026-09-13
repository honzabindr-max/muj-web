import type { PhoneContact, KorfuEvent, TransportOption } from "./types";

/**
 * Praktická data — SOURCE_PACK části 4, 13–16, 17, 18, 25 (ř. 32–374, 461–476).
 * Žádný dynamický údaj se nevykresluje bez štítku a ověřovacího odkazu — D01-B.
 */

// ─── LOCKED fakta o zájezdu (část 4, SP:32–48) ────────────────────────────────

/** Faktická data o cestě — statická, zamknutá, zdrojem je smlouva. */
export const TRIP_FACTS = {
  termin: "14. 9. 2026 – 21. 9. 2026, 7 nocí",
  hotel: "Silver Beach Hotel 3★, Roda, Korfu",
  ubytovani: "1× dvoulůžkový pokoj",
  strava: "Polopenze",
  transfer: "Letiště → hotel → letiště zahrnutý",
  letTam: "14. 9. 2026, Brno 05:10 → Korfu 08:05, TVS 2368",
  letZpet: "21. 9. 2026, Korfu 08:55 → Brno 09:55, TVS 2369",
  zavazadla: "Každý: kabinové 8 kg + odbavené 23 kg",
  cateringLetadlo: "Ne",
  odbaveni: "2 hodiny před odletem; finální čas znovu ověřit.",
  praktickyDopad:
    "Po příletu 14. 9. zbývá část dne. 21. 9. se kvůli časnému letu nepočítá s výletem. " +
    "Čas transferu zpět potvrdit. U hotelu včas objednat časnou snídani nebo balíček.",
  sp: "SP:35–48",
} as const;

// ─── Nouzové kontakty (část 18, SP:357–374) ───────────────────────────────────

export const EMERGENCY_CONTACTS: PhoneContact[] = [
  {
    label: "Jednotná evropská nouzová linka",
    phone: "112",
    note: null,
    sp: "SP:360",
  },
  { label: "Policie", phone: "100", note: null, sp: "SP:361" },
  { label: "Záchranná služba", phone: "166", note: null, sp: "SP:362" },
  { label: "Hasiči", phone: "199", note: null, sp: "SP:363" },
  { label: "Pobřežní stráž", phone: "108", note: null, sp: "SP:364" },
  { label: "Turistická policie", phone: "1571", note: null, sp: "SP:365" },
  {
    label: "Čedok SOS / vady zájezdu",
    phone: "+420 296 184 930",
    note: null,
    sp: "SP:366",
  },
  {
    label: "Silver Beach Hotel",
    phone: "+30 26630 63112",
    note: null,
    sp: "SP:367",
  },
  {
    label: "Aladasi Medical Services Roda",
    phone: "+30 26630 99377",
    note: "(před použitím ověřit)",
    sp: "SP:368–369",
  },
  {
    label: "Aladasi Medical Services Roda (mobil)",
    phone: "+30 6942 564409",
    note: "(před použitím ověřit)",
    sp: "SP:368–369",
  },
  {
    label: "Mastoras Medical Services Roda",
    phone: "+30 26630 63388",
    note: "(před použitím ověřit)",
    sp: "SP:369",
  },
  {
    label: "Corfu General Hospital",
    phone: "+30 26613 60400",
    note: null,
    sp: "SP:370",
  },
];

// ─── Události (část 15, SP:323–330) ───────────────────────────────────────────

export const EVENTS: KorfuEvent[] = [
  {
    id: "marching-bands-festival-2026",
    title: "International Marching Bands Festival of the Ionian Islands 2026",
    date: "18.–19. 9. 2026",
    location: "Corfu Town",
    description:
      "Potvrzená hlavní událost. Průvody, prezentace, koncerty a TATTOO show. " +
      "Přesné hodiny ověřit na programu festivalu.",
    freshness: "overit-aktualne",
    source: {
      label: "ionianmusicfestival.com — program",
      url: "https://ionianmusicfestival.com/en/schedule/",
    },
    sp: "SP:324–326",
  },
  {
    id: "agios-ioannis-sidari-14-9",
    title: "Svátek Povýšení sv. Kříže — klášter Agios Ioannis",
    date: "14. 9. 2026",
    location: "Oblast Sidari",
    description:
      "Svátek u kláštera Agios Ioannis v oblasti Sidari. Pouze po aktuálním ověření.",
    freshness: "overit-aktualne",
    source: null,
    sp: "SP:327–328",
  },
  {
    id: "vinarske-slavnosti-kavadades-15-9",
    title: "Vinařský festival Kavadades",
    date: "15. 9. 2026",
    location: "Kavadades",
    description: "Vinařský festival. Pouze po aktuálním ověření.",
    freshness: "overit-aktualne",
    source: null,
    sp: "SP:328",
  },
  {
    id: "vinarske-slavnosti-kassiopi-moraitice-21-9",
    title: "Vinařské slavnosti Kassiopi a Moraitice",
    date: "21. 9. 2026",
    location: "Kassiopi a Moraitice",
    description:
      "Kvůli rannímu odletu 21. 9. prakticky nepoužitelné. Ověřit jen informativně.",
    freshness: "overit-aktualne",
    source: null,
    sp: "SP:328–329",
  },
  {
    id: "hudba-bary-roda-aktualne",
    title: "Aktuální lokální hudba, karaoke a program barů v Rodě",
    date: "14.–20. 9. 2026",
    location: "Roda",
    description:
      "Program barů jen po aktuálním ověření na tabulích podniků nebo sociálních sítích. " +
      "Nezobrazovat starý program jako dnešní.",
    freshness: "overit-aktualne",
    source: null,
    sp: "SP:329–330",
  },
];

// ─── Doprava a půjčovny (část 16, SP:332–346) ─────────────────────────────────

export const TRANSPORT_OPTIONS: TransportOption[] = [
  {
    id: "auto",
    mode: "Auto",
    description:
      "Pro dva preferovat malé auto s klimatizací. Ověřit konečnou cenu, kauci, CDW/SCDW, " +
      "palivovou politiku, druhého řidiče a asistenci.",
    facts: [
      {
        label: "Půjčovna Dromeas Rent a Car",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "dromeas-rentacar-roda.com",
          url: "https://dromeas-rentacar-roda.com",
        },
        sp: "SP:335–338",
      },
      {
        label: "Půjčovna NSK Rent a Car",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "nsk-carrentalcorfu.com",
          url: "https://nsk-carrentalcorfu.com",
        },
        sp: "SP:335–338",
      },
      {
        label: "Půjčovna Infinity Car Hire",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "infinitycarhire.com/roda-office-corfu/",
          url: "https://infinitycarhire.com/roda-office-corfu/",
        },
        sp: "SP:335–338",
      },
      {
        label: "Půjčovna Corfu Cars",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "corfucars.com",
          url: "https://corfucars.com/contact.php",
        },
        sp: "SP:335–338",
      },
    ],
    candidates: [
      "Dromeas Rent a Car (dromeas-rentacar-roda.com)",
      "NSK Rent a Car (nsk-carrentalcorfu.com)",
      "Infinity Car Hire (infinitycarhire.com/roda-office-corfu/)",
      "Corfu Cars (corfucars.com/contact.php)",
      "Dimitra & Manos / hotelové doručení",
    ],
    sources: [],
    warnings: ["Aktuální nabídku ověřit přímo u půjčovny."],
    sp: "SP:333–338",
  },
  {
    id: "skutr",
    mode: "Skútr",
    description:
      "Jen s odpovídajícím oprávněním, helmami a zkušenostmi. " +
      "Nedoporučovat automaticky na vzdálený jih, Pantokrator nebo návrat po tmě.",
    facts: [],
    candidates: [],
    sources: [],
    warnings: [
      "Jen s odpovídajícím oprávněním, helmami a zkušenostmi. (SP:339–340)",
      "Nedoporučovat na vzdálený jih, Pantokrator nebo návrat po tmě.",
    ],
    sp: "SP:339–340",
  },
  {
    id: "autobus",
    mode: "Autobus",
    description:
      "Green Bus A3: Corfu Town ↔ Roda/Acharavi. " +
      "Severní S5: Sidari ↔ Roda/Acharavi ↔ Kassiopi. " +
      "Provozní dny a časy ověřit.",
    facts: [
      {
        label: "Jízdní řád Green Buses",
        value: "ověřit aktuálně",
        freshness: "overit-aktualne",
        checkedAt: null,
        source: {
          label: "mng.greenbuses.gr — jízdní řád PDF",
          url: "https://mng.greenbuses.gr/usersc/pdf-en.php",
        },
        sp: "SP:341–342",
      },
    ],
    candidates: [],
    sources: [
      {
        label: "mng.greenbuses.gr — jízdní řád PDF",
        url: "https://mng.greenbuses.gr/usersc/pdf-en.php",
      },
    ],
    warnings: [
      "Provozní dny a časy ověřit na aktuálním jízdním řádu. (SP:341–342)",
    ],
    sp: "SP:341–342",
  },
  {
    id: "taxi",
    mode: "Taxi",
    description:
      "Na večerní návrat nebo jednosměrný přesun. " +
      "Cenu delší cesty potvrdit předem. " +
      "Objednat přes hotel nebo ověřený podnik.",
    facts: [],
    candidates: [],
    sources: [],
    warnings: [
      "Cenu delší cesty potvrdit předem; objednat přes hotel nebo ověřený podnik. (SP:343–344)",
    ],
    sp: "SP:343–344",
  },
  {
    id: "rizeni",
    mode: "Řízení",
    description:
      "Jezdí se vpravo. Horské silnice úzké, klikaté, někdy bez krajnic. " +
      "Počítat s autobusy, skútry, chodci a zvířaty. " +
      "Na Pantokrator a do Old Perithie jet za světla.",
    facts: [],
    candidates: [],
    sources: [],
    warnings: [
      "Horské silnice mohou být úzké, klikaté, bez krajnic. (SP:345–346)",
      "Na Pantokrator a do Old Perithie jet za světla.",
    ],
    sp: "SP:345–346",
  },
];

// ─── Večerní podniky v Rodě (část 13, SP:301–306) ────────────────────────────

/** Večerní podniky v Rodě — všechny s freshness 'overit-aktualne'. */
export const VECERNI_PODNIKY = [
  {
    id: "drunken-sailor",
    name: "Drunken Sailor",
    description: "Koktejly, sport, tribute/cabaret/DJ.",
    freshness: "overit-aktualne" as const,
    sp: "SP:301",
  },
  {
    id: "oscars-entertainment-diner",
    name: "Oscar's Entertainment Diner",
    description: "Jídlo, bar, tribute program.",
    freshness: "overit-aktualne" as const,
    sp: "SP:302",
  },
  {
    id: "crusoes-pub-cafe",
    name: "Crusoe's Pub Cafe",
    description: "Pub, kvízy.",
    freshness: "overit-aktualne" as const,
    sp: "SP:302",
  },
  {
    id: "pirates-bar",
    name: "Pirates Bar",
    description: "Karaoke, tematické večery.",
    freshness: "overit-aktualne" as const,
    sp: "SP:303",
  },
  {
    id: "the-boathouse",
    name: "The Boathouse",
    description: "Klidnější posezení u moře, západ slunce.",
    freshness: "overit-aktualne" as const,
    sp: "SP:303–304",
  },
  {
    id: "big-ben",
    name: "Big Ben",
    description: "Řecké večery, hudba, turistická show.",
    freshness: "overit-aktualne" as const,
    sp: "SP:304",
  },
  {
    id: "nemo-cafe",
    name: "Nemo Café",
    description: "Koktejly, terasa, klidnější atmosféra.",
    freshness: "overit-aktualne" as const,
    sp: "SP:304–305",
  },
] as const;

// ─── Restaurace v Rodě (část 14, SP:310–321) ──────────────────────────────────

export const RESTAURACE_RODA = [
  {
    id: "nikos-family-restaurant",
    name: "Nikos Family Restaurant",
    description:
      "Silná dlouhodobá hodnocení, rodinné prostředí, řecká kuchyně.",
    freshness: "overit-aktualne" as const,
    sp: "SP:313–314",
  },
  {
    id: "roda-park-restaurant",
    name: "Roda Park Restaurant",
    description: "Tradiční řecká a středomořská kuchyně.",
    freshness: "overit-aktualne" as const,
    source: { label: "rodapark.com", url: "https://rodapark.com" },
    sp: "SP:314–315",
  },
  {
    id: "drosia-taverna",
    name: "Drosia Taverna & Grill Room",
    description: "Taverna, grill.",
    freshness: "overit-aktualne" as const,
    sp: "SP:315",
  },
  {
    id: "la-luz-beach-bar",
    name: "La Luz All Day Beach Bar",
    description: "Plážový bar.",
    freshness: "overit-aktualne" as const,
    sp: "SP:315",
  },
] as const;

/** Co ochutnat — doslova dle SP:317–318. Statická fakta, ne dynamické ceny. */
export const WHAT_TO_TRY: string[] = [
  "sofrito",
  "pastitsada",
  "bourdeto",
  "saganaki",
  "pražma, mořský vlk, chobotnice a kalamáry",
  "moussaka, stifado, souvlaki",
  "řecký salát a tzatziki",
  "kumquatový likér nebo sladkosti",
];

/** Zásoby — doslova dle SP:320–321. */
export const ZASOBY_TIPY: string[] = [
  "Voda, ovoce, jogurt, pečivo, svačiny — základní zásoby.",
  "Na lodní den: minimálně 1,5–2 l vody na osobu, slané i sladké občerstvení a jednoduchý oběd.",
  "U ryb ověřit, zda je cena za porci, nebo podle hmotnosti.",
];

// ─── Zdroje (část 25, SP:461–476) ─────────────────────────────────────────────

export const SOURCES_SECTION = {
  autoritativni: [
    { label: "Silver Beach Hotel", url: "https://silverbeachcorfu.com/" },
    {
      label: "International Marching Bands Festival — program",
      url: "https://ionianmusicfestival.com/en/schedule/",
    },
    {
      label: "Green Buses — jízdní řád PDF",
      url: "https://mng.greenbuses.gr/usersc/pdf-en.php",
    },
    {
      label: "Řecká nouzová čísla (gov.gr)",
      url: "https://www.gov.gr/en/sdg/healthcare/national-emergency-numbers",
    },
    {
      label: "Visit Greece — Health & Safety",
      url: "https://www.visitgreece.gr/before-travelling-to-greece/health-safety/",
    },
  ],
  koneAktivity: [
    {
      label: "katreenahorseridingcorfu.com",
      url: "https://www.katreenahorseridingcorfu.com/",
    },
    { label: "arenahorseriding.com", url: "https://www.arenahorseriding.com/" },
    {
      label: "corfutouristservices.gr — horse riding",
      url: "https://corfutouristservices.gr/tours/horse-riding-corfu/",
    },
    { label: "northcorfuhorses.com", url: "https://northcorfuhorses.com" },
    {
      label: "roda-beach.com — water sports",
      url: "https://roda-beach.com/en/water-sports/",
    },
    { label: "divecorfu.com", url: "https://divecorfu.com" },
    { label: "corfudive.com", url: "https://corfudive.com/contact-us/" },
    { label: "quadcorfu.com", url: "https://quadcorfu.com" },
    {
      label: "roda-beach.com — sport & leisure",
      url: "https://roda-beach.com/en/sport-and-leisure-facilities/",
    },
    {
      label: "corfutouristservices.gr — aktivity",
      url: "https://corfutouristservices.gr/activities-in-corfu/",
    },
    { label: "corfuextremesports.com", url: "https://corfuextremesports.com" },
  ],
  lodeAutaGastronomie: [
    { label: "seahorsecorfu.com", url: "https://seahorsecorfu.com" },
    { label: "bluelagooncorfu.com", url: "https://bluelagooncorfu.com" },
    { label: "corfuboatrental.com", url: "https://corfuboatrental.com" },
    { label: "nikaboatrental.com", url: "https://nikaboatrental.com" },
    { label: "rentaboatcorfu.gr", url: "https://rentaboatcorfu.gr" },
    { label: "dinosboatrentals.com", url: "https://dinosboatrentals.com" },
    { label: "aeolusboatrentals.gr", url: "https://aeolusboatrentals.gr" },
    { label: "skywayboats.com", url: "https://skywayboats.com/contact-us/" },
    { label: "waveboathire.com", url: "https://waveboathire.com/en" },
    {
      label: "sunfunclub-boathire.com",
      url: "https://sunfunclub-boathire.com",
    },
    {
      label: "nissakiboatrental.com",
      url: "https://nissakiboatrental.com/prices-reservation-nissaki-boat-rental-corfu/",
    },
    {
      label: "dromeas-rentacar-roda.com",
      url: "https://dromeas-rentacar-roda.com",
    },
    { label: "nsk-carrentalcorfu.com", url: "https://nsk-carrentalcorfu.com" },
    {
      label: "infinitycarhire.com/roda-office-corfu/",
      url: "https://infinitycarhire.com/roda-office-corfu/",
    },
    { label: "corfucars.com", url: "https://corfucars.com/contact.php" },
    { label: "rodapark.com", url: "https://rodapark.com" },
  ],
  sp: "SP:461–476",
};

// ─── Počasí — povinná pravidla webu (část 17, SP:348–355) ────────────────────

/**
 * Pravidla pro `C:PocasiPanel` — doslovně ze SP:351–355.
 * Web nesmí žádné z těchto pravidel porušit.
 */
export const POCASI_PRAVIDLA: string[] = [
  "Zobrazovat živé počasí jen z reálného zdroje a s timestampem. (SP:351)",
  "Při chybě nabídnout odkaz na živou předpověď. (SP:351–352)",
  "Pro loď sledovat vítr a vlny, ne jen teplotu. (SP:352)",
  "Pantokrator a panoramata doporučit za dobré viditelnosti. (SP:352–353)",
  "Porto Timoni a Myrtiotissu označit jako problematické za mokra. (SP:353–354)",
  "Corfu Town, restaurace, případná muzea a hotelový odpočinek označit jako možnosti při horším počasí. (SP:354–355)",
  "Žádný automatický denní itinerář. (SP:355)",
];

/** Datovaný snapshot — pouze informativně, nikdy jako předpověď (SP:349–350). */
export const POCASI_SNAPSHOT = {
  datum: "13. 9. 2026",
  text: "Přibližně 27–28 °C přes den a 17–19 °C v noci, s možností přeháněk v několika dnech.",
  upozorneni: "Není to trvalý údaj. Ověřit živou předpověď.",
  sp: "SP:349–350",
} as const;

// ─── Peníze, data a navigace (část 18, SP:371–374) ───────────────────────────

/**
 * Praktické tipy pro sekci Zdraví a peníze — doslovně ze SP:371–374.
 * Shoduje se s `CHECKLISTS.predodjezd` položkami (id: "predodjezd").
 * Ukládáno jako pojmenovaný export pro `C:PraktickeSection` (D:practical.PENIZE_DATA).
 */
export const PENIZE_DATA: string[] = [
  "EHIC a cestovní pojištění platné pro Řecko.",
  "Pravidelné léky v originálním balení s názvem léčivé látky.",
  "Kopie dokladů bezpečně uložena online (NE ve veřejném webu).",
  "Offline mapa Korfu stažena do telefonu.",
  "Ověřit roamingový limit datové SIM.",
  "Platební karta + hotovost v eurech.",
  "Při platbě kartou odmítnout přepočet do Kč, platit v EUR.",
  "Uložit hotel, nemocnici, půjčovny a nouzová čísla do telefonu.",
];
