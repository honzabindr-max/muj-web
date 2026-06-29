import type {
  BudgetRow,
  ChecklistItem,
  DayPlan,
  RiskItem,
  TransportVariant,
  Waypoint,
} from './types';

export const CATEGORY_COLORS = {
  reka: '#0ea5e9',
  vodopad: '#8b5cf6',
  hory: '#f97316',
  zaklad: '#10b981',
  doprava: '#64748b',
} as const;

export const CATEGORY_LABELS = {
  reka: 'Řeka',
  vodopad: 'Vodopád',
  hory: 'Hory',
  zaklad: 'Základna',
  doprava: 'Doprava',
} as const;

// Všechny souřadnice ověřeny přes Google Places 29.6.2026.
export const WAYPOINTS: Waypoint[] = [
  {
    id: 'bovec',
    name: 'Bovec (základna)',
    lat: 46.338,
    lng: 13.552,
    category: 'zaklad',
    description: 'Hlavní základna — odtud všechny denní výlety nalehko',
  },
  {
    id: 'camp-bovec',
    name: 'Camp Bovec',
    lat: 46.3355,
    lng: 13.5537,
    category: 'zaklad',
    description: 'Camp Bovec (Rupa 14) — ~15 €/os/noc, výhledy, platba hotově',
  },
  {
    id: 'bovec-sport',
    name: 'Bovec Sport (rafting)',
    lat: 46.3322,
    lng: 13.5375,
    category: 'reka',
    description: 'Meeting point raftingu — WW II–III, smaragdová Soča, průvodce v ceně',
  },
  {
    id: 'velika-korita',
    name: 'Velika korita Soče',
    lat: 46.3372,
    lng: 13.6459,
    category: 'reka',
    description: 'Soutěska 750 m, hloubka 15 m — vrchol Soča Trailu. Koupání v tůních na konci.',
  },
  {
    id: 'cezsoca',
    name: 'Čezsoča (koupání)',
    lat: 46.319,
    lng: 13.544,
    category: 'reka',
    description: 'Plaža Čezsoča — písčitá pláž, pozvolný vstup, vhodné pro rodiny. Bus B3.',
  },
  {
    id: 'boka',
    name: 'Slap Boka',
    lat: 46.3214,
    lng: 13.482,
    category: 'vodopad',
    description: '~106 m (s kaskádou ~144 m), nejvodnatější vodopád Slovinska — vidět ze silnice, vstup zdarma',
  },
  {
    id: 'virje',
    name: 'Slap Virje',
    lat: 46.3351,
    lng: 13.5142,
    category: 'vodopad',
    description: '~3,5 km od Bovce — laguna pod vodopádem vhodná ke koupání, vstup zdarma',
  },
  {
    id: 'canyoning-susec',
    name: 'Canyoning Sušec (Srpenica)',
    lat: 46.303,
    lng: 13.453,
    category: 'reka',
    description: 'Začátečnické, 2–3 h, skoky 4–7 m (dobrovolné), tobogán ~12 m. Min. věk 8–10 let. ~60–65 €.',
  },
  {
    id: 'dom-trenta',
    name: 'Trenta (Dom Trenta)',
    lat: 46.3804,
    lng: 13.7525,
    category: 'hory',
    description: 'Start Soča Trailu — bezplatný bus Vršič, ~13–15 km pěšky do Veliki koriti',
  },
  {
    id: 'izvir-soce',
    name: 'Izvir Soče (pramen)',
    lat: 46.4117,
    lng: 13.7241,
    category: 'hory',
    description: '⚠️ Zajištěná ferrata A/B — skalní římsa šíře jedné boty. Jen bez strachu z výšek.',
  },
  {
    id: 'vrsic',
    name: 'Vršič (sedlo 1611 m)',
    lat: 46.4329,
    lng: 13.7431,
    category: 'hory',
    description: 'Bezplatným busem — 22 serpentin, výhledy na Julské Alpy. Erjavčeva koča.',
  },
  {
    id: 'ruska-kaple',
    name: 'Ruská kaple',
    lat: 46.4426,
    lng: 13.7677,
    category: 'hory',
    description: 'Dřevěná kaple 1917 — zastávka „Ruski križ\" aktivní až od 1.8., do té doby pěšky z okolní zastávky',
  },
  {
    id: 'ljubljana',
    name: 'Ljubljana',
    lat: 46.0569,
    lng: 14.5058,
    category: 'doprava',
    description: 'Přestupní bod — Arriva/Nomago bus do Bovce (Po–So, do 31.8.)',
  },
  {
    id: 'brno',
    name: 'Brno',
    lat: 49.1951,
    lng: 16.6068,
    category: 'doprava',
    description: 'Výchozí bod — FlixBus nebo vlak do Lublaně',
  },
];

export const TRANSPORT_VARIANTS: TransportVariant[] = [
  {
    id: 'nocni',
    icon: '🌙',
    label: 'Noční',
    price: '~55 €/os',
    duration: '~11 h',
    steps: [
      'FlixBus Brno 23:10 → Ljubljana ~06:35',
      'Arriva 07:30 → Bovec 11:18',
      'V Bovci první den v poledne',
    ],
    highlight: 'Ušetříš noc ubytování',
  },
  {
    id: 'nejlevnejsi',
    icon: '✅',
    label: 'Nejlevnější',
    price: '~50–60 €/os',
    duration: '~11 h',
    steps: [
      'FlixBus Brno → Ljubljana (od ~36 €, 8 spojů denně)',
      'Nomago nebo Arriva bus → Bovec (~2–2,5 h)',
      'Přestup v Lublani',
    ],
    highlight: 'Nejnižší cena',
  },
  {
    id: 'pohodlna',
    icon: '🛏️',
    label: 'Pohodlná',
    price: '~80–100 €/os',
    duration: '~12 h',
    steps: [
      'Vlak Brno → Vídeň (~1,5 h) + EC Vídeň → Ljubljana (~5,5–6 h)',
      'Nomago nebo Arriva bus → Bovec',
      'Průběžná jízdenka ÖBB (garance přípoje)',
    ],
    highlight: 'Komfort, zaručený přípoj',
  },
];

// Dopravní kontext polyline (pouze pro mapu)
export const TRANSPORT_LINE: [number, number][] = [
  [49.1951, 16.6068], // Brno
  [46.0569, 14.5058], // Ljubljana
  [46.338, 13.552],   // Bovec
];

export const DAY_PLANS: DayPlan[] = [
  {
    day: 1,
    title: 'Příjezd + TIC + permit',
    tags: ['příjezd', 'organizace'],
    description:
      'Ubytko, TIC Bovec (Trg golobarskih žrtev 47) — koupit permit na rafting (max 24 h předem, 21 €/os), zvážit Julian Alps Card. Odpolední koupání nebo procházka po Bovci. Lehký start.',
    tip: 'Permit si na TIC vyřiď hned první den — systém byl 2026 v přechodu, potvrď aktuální pravidla přímo na místě.',
  },
  {
    day: 2,
    title: 'Rafting na Soče',
    tags: ['rafting', 'adrenalin'],
    description:
      'Rafting WW II–III s průvodcem — firma dodá neopren, vestu, helmu. Odjezdy typicky 8:45 / 12:45 / 16:00. Odpoledne koupání v Čezsoče (bus B3, Plaža Čezsoča — písčitá pláž, pozvolný vstup).',
    tip: 'Rezervuj 1–2 týdny předem. Ceny se liší — vždy ověř finální cenu vč. permitu a transferu.',
  },
  {
    day: 3,
    title: 'Vodopády Virje + Boka (bus B3)',
    tags: ['vodopády', 'lehký výlet'],
    description:
      'Bus B3 pokryje oba vodopády v jeden den (~1 h na každé zastávce). Slap Virje (~3,5 km od Bovce) — laguna na koupání. Slap Boka (~6 km) — 106 m, pohled ze silnice nebo 20min výstup na vyhlídku. Virje i Boka zdarma.',
  },
  {
    day: 4,
    title: 'Vršič + pramen Soče (horský den)',
    tags: ['hory', 'bezplatný bus'],
    description:
      'Bezplatný bus Vršič: Bovec → Trenta → Izvir Soče → Sedlo Vršič (1611 m). Ruská kaple (1917) na serpentinách. Pramen Soče je volitelný vrchol — zajištěná ferrata A/B (jen bez strachu z výšek). Zpátky busem.',
    tip: 'Zastávka „Ruski križ\" (Ruská kaple) aktivní od 1.8. — do té doby kratší výstup pěšky. Choď brzy ráno.',
  },
  {
    day: 5,
    title: 'Canyoning Sušec + odpočinek',
    tags: ['canyoning', 'pláž'],
    description:
      'Dopolední canyoning Sušec (Srpenica, ~7 km od Bovce): skoky 4–7 m, tobogán 12 m, 2–3 h, začátečnické. ~60–65 €/os. Balíček rafting+canyoning ~110 €/os. Odpoledne pláž nebo klid.',
  },
  {
    day: 6,
    title: 'Soča Trail — Trenta → Velika korita',
    tags: ['trek', 'řeka'],
    description:
      'Bezplatný bus do Trenty. Pěšky ~13–15 km podél Soče, visuté mosty, průzory na smaragdovou vodu. Cíl Velika korita — soutěska 750 m, koupání v tůních na konci (ledová voda). Bus zpět do Bovce. Kratší varianta: jen Bovec → Velika korita (~10 km).',
    tip: 'Ověř, že zastávka Soča (nejblíž Velika korita) v termínu staví — aktivní od 1.7.2026.',
  },
  {
    day: 7,
    title: 'Volno + odjezd',
    tags: ['volno', 'odjezd'],
    description:
      'Dle energie: kayak (~60–65 €, permit v ceně kurzu), lanovka Kanin, Mala korita, nebo jen koupání. Odjezd: Arriva bus Bovec 14:45 → Ljubljana 18:17 (jen Po–So!). Neděle = Nomago nebo přizpůsobit plán.',
    tip: 'Neděle Arriva nejede — pokud odjíždíš v neděli, použij Nomago nebo přesuň odjezd na sobotu.',
  },
];

export const BUDGET_ROWS: BudgetRow[] = [
  { item: 'Doprava tam+zpět 3 os.', low: '4 500–7 500 Kč', mid: '7 500–12 000 Kč', high: '12 000–18 000 Kč' },
  { item: 'Camp Bovec 5 nocí 3 os.', low: '4 500–5 625 Kč', mid: '5 625–6 750 Kč', high: '9 000–18 000 Kč' },
  { item: 'Rafting + permit (3 os.)', low: '~5 700–7 200 Kč', mid: '~5 700–7 200 Kč', high: '~5 700–7 200 Kč' },
  { item: 'Canyoning Sušec (3 os.)', low: '~4 500 Kč', mid: '~4 500 Kč', high: '~4 500 Kč' },
  { item: 'Julian Alps Card (opt.)', low: '—', mid: '~2 250 Kč', high: '~2 250 Kč' },
  { item: 'Jídlo 7 dní', low: '4 500–6 750 Kč', mid: '6 750–9 000 Kč', high: '9 000–13 500 Kč' },
  { item: 'Pojištění', low: '750–1 125 Kč', mid: '1 125–1 500 Kč', high: '1 500–2 250 Kč' },
  { item: 'Rezerva', low: '2 000–3 000 Kč', mid: '3 000–4 500 Kč', high: '4 500–6 000 Kč' },
];

export const RESERVATION_CHECKLIST: ChecklistItem[] = [
  {
    id: 'res-camp',
    label: 'Camp Bovec — 5 nocí (campbovec.com, platba hotově)',
    critical: true,
    note: 'Rezervuj 4–6 týdnů předem. Chatka 4 os. ~120 €/noc, stanové místo ~15 €/os/noc.',
  },
  {
    id: 'res-rafting',
    label: 'Rafting — firma + datum (1–2 týdny předem)',
    critical: true,
    note: 'Dotaz: „Is the river permit included? Total final price for 3 persons incl. permits, equipment and transfer?"',
  },
  {
    id: 'res-permit',
    label: 'Permit rafting — TIC Bovec, max 24 h předem',
    critical: true,
    note: '21 €/os, oba synové (16 i 20) platí plnou cenu. Portál gosoca.si/portal nebo TIC +386 5 302 96 47.',
  },
  {
    id: 'res-canyoning',
    label: 'Canyoning Sušec — firma (Hydromania / Alpi Center / Bovec Rafting Team)',
    critical: false,
    note: '~60–65 €/os, min. věk 8–10 let. Balíček rafting+canyoning ~110 €/os.',
  },
  {
    id: 'res-bus-tam',
    label: 'Bus Brno → Ljubljana → Bovec (FlixBus + Arriva/Nomago)',
    critical: false,
    note: 'Arriva jen Po–So (neděle nejede!), do 31.8. Ověřit návaznost nočního FlixBusu.',
  },
  {
    id: 'res-bus-zpet',
    label: 'Návrat Bovec → Ljubljana → Brno',
    critical: true,
    note: 'Arriva Bovec 14:45 → Ljubljana 18:17 — jen Po–So! Neděle = Nomago.',
  },
  {
    id: 'res-pojisteni',
    label: 'Komerční pojistka (EHIC nestačí — rafting, canyoning, ferrata)',
    critical: true,
  },
  {
    id: 'res-card',
    label: 'Julian Alps Card — zvážit (~25 €/dosp, 15+ dní, hop-on-hop-off zdarma)',
    critical: false,
    note: 'Vyplatí se při více jízdách B3 + lanovka Kanin. Spočítat vs. 3 € za jízdu.',
  },
  {
    id: 'res-mapy',
    label: 'Offline mapy stažené předem (Mapy.cz / OsmAnd)',
    critical: false,
  },
];

export const RISKS: RiskItem[] = [
  {
    risk: 'Studená voda Soče (6–12 °C)',
    prevention: 'Neopren v ceně raftingu. Neoprenové boty na koupání.',
    fallback: 'Nekoupat se v soutěskách (silný proud, zakázáno). Čezsoča = nejbezpečnější.',
  },
  {
    risk: 'Ferrata k prameni Soče',
    prevention: 'Jen bez strachu z výšek. Mokrý vápenec klouže — ranní start, pevná obuv.',
    fallback: 'U lan smí někdo couvnout — počká ~20 min u chaty. Ferrata set půjčit u Alpi Center.',
  },
  {
    risk: 'Bouřky na Vršiči',
    prevention: 'Sledovat předpověď 48 h, ranní start (před polednem zpátky na sedle).',
    fallback: 'Busem okamžitě dolů. Nečekat.',
  },
  {
    risk: 'Permit chaos 2026',
    prevention: 'Systém 2026 v přechodu (21 € vs. jednotný 15 €) — potvrdit na TIC Bovec.',
    fallback: 'TIC Bovec +386 5 302 96 47, gosoca.si/portal',
  },
  {
    risk: 'Arriva neděle nejede',
    prevention: 'Neplánovat příjezd/odjezd v neděli přes Arrivu.',
    fallback: 'Nomago jako záloha na neděli.',
  },
  {
    risk: 'Klíšťata (endemická oblast)',
    prevention: 'Repelent DEET 30 %+, kontrola těla každý večer.',
    fallback: 'Lékárnička, nejbližší zdravotní středisko Bovec.',
  },
];

export const GEAR_GROUPS = [
  {
    group: 'Doklady & pojištění',
    id: 'gear-docs',
    items: [
      { id: 'g-pas', label: 'Pas / OP (každý)' },
      { id: 'g-ehic', label: 'EHIC (záloha; komerční pojistka je nutná)' },
      { id: 'g-pojisteni', label: 'Komerční pojistka — potvrzení (rafting + hory + canyoning)' },
      { id: 'g-cash', label: 'Hotovost EUR (camp, bus, TIC, drobné)' },
    ],
  },
  {
    group: 'Oblečení',
    id: 'gear-clothes',
    items: [
      { id: 'g-boty-trek', label: 'Kotníkové trekové boty (Soča Trail + ferrata)' },
      { id: 'g-boty-voda', label: 'Neoprenové boty / sandály do vody' },
      { id: 'g-fleece', label: 'Fleece / vrstvení (Vršič i v létě chladný)' },
      { id: 'g-plas', label: 'Pláštěnka / poncho' },
      { id: 'g-kratasy', label: 'Rychleschnoucí kalhoty a kraťasy' },
      { id: 'g-plavky', label: 'Plavky (koupání denně)' },
    ],
  },
  {
    group: 'Batoh & camping',
    id: 'gear-pack',
    items: [
      { id: 'g-batoh', label: 'Batoh 35–50 l (tábor)' },
      { id: 'g-daypack', label: 'Malý daypack 15–20 l na výlety' },
      { id: 'g-suchy', label: 'Suchý vak / vodotěsné sáčky (rafting)' },
      { id: 'g-lahev', label: 'Láhev / filtr (voda ze Soče v horním toku pitná)' },
      { id: 'g-hole', label: 'Trekové hole (Soča Trail, Vršič)' },
    ],
  },
  {
    group: 'Elektronika',
    id: 'gear-electronics',
    items: [
      { id: 'g-power', label: 'Powerbanka (velká, ≥20 000 mAh)' },
      { id: 'g-head', label: 'Čelovka + záložní baterie' },
      { id: 'g-mapy', label: 'Offline mapy stažené předem (Mapy.cz / OsmAnd)' },
    ],
  },
  {
    group: 'Lékárnička',
    id: 'gear-med',
    items: [
      { id: 'g-compeed', label: 'Compeed na puchýře' },
      { id: 'g-banda', label: 'Elastické bandáže, náplasti' },
      { id: 'g-repelent', label: 'Repelent DEET 30 %+ (klíšťata — endemická oblast)' },
      { id: 'g-analg', label: 'Ibuprofen' },
      { id: 'g-antis', label: 'Dezinfekce rány' },
    ],
  },
];
