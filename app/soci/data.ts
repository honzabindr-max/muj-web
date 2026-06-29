import type {
  BudgetRow,
  ChecklistItem,
  DayPlan,
  RiskItem,
  TransportVariant,
  Waypoint,
} from './types';

export const MISSION = {
  codename: 'OPERATION SOČA',
  crew: ['táta', 'Sam (20)', 'Denny (16)'],
  dates: '4.–11. 7. 2026',
  base: 'Bovec',
};

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
    description: 'Hlavní základna OPERATION SOČA — odtud všechny denní výlety nalehko',
  },
  {
    id: 'camp-bovec',
    name: 'Camp Bovec / Alpi Center',
    lat: 46.3355,
    lng: 13.5537,
    category: 'zaklad',
    description: 'Rupa 14 — kemp + rafting + canyoning z jednoho místa (česky), jen hotovost',
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
    description: 'Cíl Soča Trailu — soutěska 750 m, koupání v tůních na konci',
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
    description: '~106 m (s kaskádou ~144 m), nejvodnatější vodopád Slovinska — vstup zdarma',
  },
  {
    id: 'virje',
    name: 'Slap Virje',
    lat: 46.3351,
    lng: 13.5142,
    category: 'vodopad',
    description: '~3,5 km od Bovce — laguna pod vodopádem ke koupání, vstup zdarma',
  },
  {
    id: 'canyoning-susec',
    name: 'Canyoning Sušec (Srpenica)',
    lat: 46.303,
    lng: 13.453,
    category: 'reka',
    description: 'Začátečnické, 2–3 h, skoky 4–7 m (dobrovolné), tobogán ~12 m. Denny OK. ~55–65 €.',
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
    description: '⚠️ Zajištěná ferrata A/B — jen po splnění bezpečnostní brány. Pro Dennyho: jen bez strachu z výšek.',
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
    description: 'Dřevěná kaple 1917, stavěli ruští zajatci — zastávka „Ruski križ\" aktivní od 1.8.',
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
    description: 'Start OPERATION SOČA — FlixBus nebo vlak do Lublaně',
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

// Dopravní kontext polyline (mapa)
export const TRANSPORT_LINE: [number, number][] = [
  [49.1951, 16.6068], // Brno
  [46.0569, 14.5058], // Ljubljana
  [46.338, 13.552],   // Bovec
];

export const DAY_PLANS: DayPlan[] = [
  {
    day: 1,
    title: 'Příjezd + TIC + koupání Čezsoča',
    tags: ['příjezd', 'lehce'],
    transport: 'pěšky',
    lastBus: '—',
    description:
      'Ubytko, nákup zásob (SPAR/Mercator — v neděli Mercator zavřený!), TIC Bovec (Trg golobarskih žrtev 47). ' +
      'Zjistit: jízdní řád busů, stav zastávky Soča, uložit číslo lokálního taxi. ' +
      'Odpolední koupání Čezsoča (bus B3). Žádná placená aktivita.',
    tip: 'Pokud jedeš s Rafting Slovinsko (Rupa 14, = Camp Bovec), rezervace raftingu a canyoningu se řeší přímo tam. Permit v ceně raftingu — nemusíš na TIC pro permit.',
  },
  {
    day: 2,
    title: 'Rafting ráno 8:45',
    tags: ['rafting', 'adrenalin'],
    transport: 'pěšky',
    lastBus: '—',
    description:
      'Rafting Standard (Boka/Srpenica→Trnovo, ~1,5 h na vodě), odjezd 8:45. ' +
      'Rafting Slovinsko: 75 €/os s permitem v ceně. ' +
      'Odpoledne Čezsoča/centrum — po raftingu přijdete mokří a studení, suchý oděv připravit.',
    tip: 'Rezervuj 1–2 týdny předem. Dotaz písemně: „Confirm that the river permit for all 3 persons is included in the price."',
  },
  {
    day: 3,
    title: 'Virje + Boka + Čezsoča',
    tags: ['vodopády', 'lehký výlet'],
    transport: 'bus B3',
    lastBus: 'ověř poslední B3 před výjezdem',
    description:
      'Lehký den po raftingu — bus B3 (3 €/jízda). ' +
      'Slap Virje (~3,5 km): laguna ke koupání. ' +
      'Slap Boka (~6 km): 106 m, pohled ze silnice nebo 20min výstup na vyhlídku — jen základní, ne technický výstup k prameni Boky. ' +
      'Virje + Boka zvládneš v jeden den, na každé zastávce hodina.',
  },
  {
    day: 4,
    title: 'Canyoning Sušec ráno 8:30',
    tags: ['canyoning', 'adrenalin'],
    transport: 'transfer firmy',
    lastBus: '—',
    description:
      'Canyoning Sušec (Srpenica, ~7 km od Bovce), odjezd 8:30. ' +
      'Začátečnické: skoky 4–7 m (dobrovolné), tobogán 12 m, 2–3 h. Denny (16) OK. ' +
      'Rafting Slovinsko: 55 €/os. S multi-slevou (rafting+canyoning): −10 %. ' +
      'Odpoledne volno — pláž, město, nákupy.',
  },
  {
    day: 5,
    title: 'Soča Trail — Trenta → Velika korita',
    tags: ['trek', 'řeka'],
    transport: 'bezplatný bus',
    lastBus: '🔴 ověř zastávku Soča (aktivní od 1.7.)',
    description:
      'Bezplatný bus do Trenty. Pěšky ~13–15 km podél Soče — visuté mosty, průzory na smaragdovou vodu. ' +
      'Cíl Velika korita — soutěska 750 m, koupání v tůních (ledová voda). ' +
      'ZÁLOHA: pokud nezajede bus ze Soči, jít jen kratší Bovec→Velika korita (~10 km) nebo taxi.',
    tip: 'Zjisti poslední bezpečný bus zpět z Trenty/Soči den předem. Mít uložené číslo taxi.',
  },
  {
    day: 6,
    title: 'Vršič / pramen Soče',
    tags: ['hory', 'bezplatný bus'],
    transport: 'bezplatný bus',
    lastBus: 'poslední bus z Vršiče (ověřit večer před)',
    description:
      'Bezplatný bus: Bovec → Trenta → Izvir Soče → Sedlo Vršič (1611 m). Ruská kaple (1917). ' +
      'Mokro/únava → jen Vršič sedlo + výhledy, bez pramene. ' +
      'Pramen = volitelný vrchol (ferrata A/B) — JEN po splnění bezpečnostní brány (viz sekce Tipy).',
    tip: 'Aktivity plánuj na dopoledne — odpolední bouřky v Alpách jsou normál. Buď zpět v Bovci ~13:00 pokud se tvoří mraky.',
  },
  {
    day: 7,
    title: 'BUFFER — Kluže / kayak / lanovka / odjezd',
    tags: ['buffer', 'volno'],
    transport: 'pěšky / bus',
    lastBus: 'Arriva Bovec 14:45 → Ljubljana 18:17 (jen Po–So!)',
    description:
      'Pevný buffer — ne nouzovka. Dle energie: ' +
      'Pevnost Kluže (WW1 Isonzo fronta, ~8 km), kayak (~60–65 €, permit v ceně), lanovka Kanin (výhledy), Mala korita, nebo odpočinek. ' +
      'Odjezd: Arriva bus Bovec → Ljubljana → Brno. Neděle = Nomago. V Lublani nech 90+ min na přípoj.',
    tip: 'Pevnost Kluže je ideální na deštivý den nebo po únave — historický kontrast k adrenalinu, sedne Samovi i Dennymu.',
  },
];

export const BUDGET_ROWS: BudgetRow[] = [
  { item: 'Doprava Brno↔Bovec (3 os.)', low: '4 500–7 500 Kč', mid: '7 500–12 000 Kč', high: '12 000–18 000 Kč' },
  { item: 'Camp Bovec 7 nocí (3 os.)', low: '~8 250 Kč', mid: '~8 750 Kč', high: '10 000–15 000 Kč' },
  { item: 'Rafting + permit (3 os.)', low: '~5 625 Kč', mid: '~5 625 Kč', high: '~5 625 Kč' },
  { item: 'Canyoning (3 os.)', low: '~3 750 Kč', mid: '~4 125 Kč', high: '~4 500 Kč' },
  { item: 'Zipline (3 os., volitelné)', low: '—', mid: '—', high: '~5 775 Kč' },
  { item: 'Ferrata set půjčení (1 den)', low: '~1 125 Kč', mid: '~1 125 Kč', high: '~1 125 Kč' },
  { item: 'Jídlo 7 dní', low: '4 500–6 000 Kč', mid: '7 500–10 000 Kč', high: '10 000–15 000 Kč' },
  { item: 'Místní doprava (B3, taxi…)', low: '750–2 000 Kč', mid: '1 250–3 000 Kč', high: '2 500–5 000 Kč' },
  { item: 'Pojištění (3 os.)', low: '1 250–3 000 Kč', mid: '1 750–3 750 Kč', high: '2 500–5 000 Kč' },
];

export const RESERVATION_CHECKLIST: ChecklistItem[] = [
  {
    id: 'res-camp',
    label: 'Camp Bovec / Alpi Center — 7 nocí (campbovec.com, platba JEN hotovost)',
    critical: true,
    note: 'Rupa 14. Rezervuj 4–6 týdnů předem — max 70 míst. Se slevou −10 % při rezervaci aktivit u nich.',
  },
  {
    id: 'res-rafting',
    label: 'Rafting Slovinsko — Standard 8:45 (raftingslovinsko.cz, 75 €/os)',
    critical: true,
    note: 'Rezervuj 1–2 týdny předem. Písemně potvrdit: „Confirm that the river permit for all 3 is included."',
  },
  {
    id: 'res-canyoning',
    label: 'Canyoning Sušec — 8:30 (Rafting Slovinsko, 55 €/os)',
    critical: false,
    note: 'S multi-slevou (rafting+canyoning): −10 %. Denny (16) OK.',
  },
  {
    id: 'res-ferrata',
    label: 'Ferrata set — rezervovat u Rafting Slovinsko/Alpi Center (15 €/den)',
    critical: false,
    note: 'Rupa 14 — helma + set + sedák. Potřeba jen pokud děláte pramen Soče.',
  },
  {
    id: 'res-bus-tam',
    label: 'Bus Brno → Ljubljana → Bovec (FlixBus + Arriva/Nomago)',
    critical: true,
    note: 'Arriva jen Po–So (neděle nejede!), do 31.8. Ověřit návaznost.',
  },
  {
    id: 'res-bus-zpet',
    label: 'Návrat Bovec → Ljubljana → Brno',
    critical: true,
    note: 'Arriva Bovec 14:45 → Ljubljana 18:17 — jen Po–So! V Lublani nech 90+ min na přípoj. Neděle = Nomago.',
  },
  {
    id: 'res-pojisteni',
    label: 'Komerční pojistka — každý člen (EHIC nestačí!)',
    critical: true,
    note: 'Musí krýt: rafting WW3 + canyoning + zipline + ferrata. Ověř podmínky pro každého.',
  },
  {
    id: 'res-cash',
    label: 'Hotovost EUR 400–500 € (bankomat NLB u TIC Bovec)',
    critical: true,
    note: 'Camp Bovec bere jen hotovost. Bankomat v malém městě může být mimo provoz.',
  },
  {
    id: 'res-taxi',
    label: 'Číslo lokálního taxi uložit v mobilu (první den na TIC)',
    critical: false,
    note: 'Levná pojistka proti zmeškanému busu nebo bouřce.',
  },
  {
    id: 'res-mapy',
    label: 'Offline mapy Slovinska stažené přes WiFi doma (Mapy.com ~300–500 MB)',
    critical: false,
    note: 'Na Soča Trail, Vršiči a v Trentě slabší signál.',
  },
];

export const RISKS: RiskItem[] = [
  {
    risk: 'Studená voda Soče (9–12 °C)',
    prevention: 'Neopren v ceně raftingu. Neoprenové boty na koupání. Vstupuj pomalu.',
    fallback: 'Nekoupat se v soutěskách. Čezsoča = nejbezpečnější místo.',
  },
  {
    risk: 'Ferrata k prameni Soče',
    prevention: 'Splnit bezpečnostní bránu (viz sekce Tipy). Mokrý vápenec klouže.',
    fallback: 'Otočení je vítězství. Kdo nechce, počká u chaty ~20 min.',
  },
  {
    risk: 'Odpolední bouřky (normál v Alpách)',
    prevention: 'Aktivity ráno. Celodenní výlety zkrátit — být v Bovci ~13:00 při mracích.',
    fallback: 'Plan C: Virje, Boka, Čezsoča, Kluže — níže = bezpečněji.',
  },
  {
    risk: 'Klíšťová encefalitida (endemická oblast)',
    prevention: 'Repelent DEET/ikaridin před každou chůzí, prohlídka těla každý večer, kleštičky s sebou.',
    fallback: 'Lékárna Bovec (Kot 86), ZS Bovec +386 5 620 33 22.',
  },
  {
    risk: 'Arriva neděle nejede',
    prevention: 'Neplánovat příjezd/odjezd přes Arrivu v neděli.',
    fallback: 'Nomago jako záloha v neděli.',
  },
  {
    risk: 'Zmeškaný bus / déšť',
    prevention: 'Zjistit poslední bezpečný spoj zpět. Mít číslo taxi.',
    fallback: 'Taxi VisitSoča nebo kontakt od TIC/kempu.',
  },
];

export const GEAR_GROUPS = [
  {
    group: 'Doklady & pojištění',
    id: 'gear-docs',
    items: [
      { id: 'g-pas', label: 'Pas / OP (každý člen partyy)' },
      { id: 'g-ehic', label: 'EHIC (záloha — komerční pojistka je nutná)' },
      { id: 'g-pojisteni', label: 'Komerční pojistka — potvrzení (rafting WW3 + canyoning + ferrata + zipline)' },
      { id: 'g-kopie', label: 'Kopie dokladů zvlášť (oddělené od originálu)' },
      { id: 'g-cash', label: 'Hotovost EUR 400–500 € (Camp Bovec jen hotovost!)' },
    ],
  },
  {
    group: 'Oblečení & ochrana',
    id: 'gear-clothes',
    items: [
      { id: 'g-boty-trek', label: 'Kotníkové trekové boty s dobrou podrážkou (Soča Trail + ferrata)' },
      { id: 'g-boty-voda', label: 'Neoprenové / vodní boty (kluzké ostré oblázky)' },
      { id: 'g-fleece', label: 'Fleece / vrstvení (Vršič a noci v kempu)' },
      { id: 'g-plas', label: 'Voděodolná bunda / pláštěnka (bouřky jisté)' },
      { id: 'g-kratasy', label: 'Rychleschnoucí kalhoty a kraťasy' },
      { id: 'g-plavky', label: 'Plavky (koupání denně)' },
      { id: 'g-suche', label: 'Suché oblečení v plastovém pytli — na po-raftingu/canyoningu' },
      { id: 'g-spf', label: 'Opalovací krém SPF50+ (UV 9–10 v Alpách)' },
    ],
  },
  {
    group: 'Batoh & voda',
    id: 'gear-pack',
    items: [
      { id: 'g-batoh', label: 'Batoh 35–50 l (tábor)' },
      { id: 'g-daypack', label: 'Malý daypack 15–20 l na výlety' },
      { id: 'g-suchy', label: 'Suchý vak / vodotěsné pouzdro na telefon (rafting)' },
      { id: 'g-lahev', label: 'Lahev / termoska — plnit v kempu zdarma, svačina na výlety' },
      { id: 'g-hole', label: 'Trekové hole (Soča Trail, Vršič)' },
      { id: 'g-rychlouschnouci', label: 'Rychloschnoucí ručník' },
    ],
  },
  {
    group: 'Elektronika',
    id: 'gear-electronics',
    items: [
      { id: 'g-power', label: 'Powerbanka ≥20 000 mAh' },
      { id: 'g-head', label: 'Čelovka + záložní baterie' },
      { id: 'g-mapy', label: 'Offline mapy Slovinska — Mapy.com (~300–500 MB, stáhnout doma na WiFi)' },
      { id: 'g-plyn', label: 'Plynová kartuše z ČR (v Bovci drahá / k mání)' },
    ],
  },
  {
    group: 'Zdraví & lékárnička',
    id: 'gear-med',
    items: [
      { id: 'g-repelent', label: 'Repelent DEET/ikaridin (klíšťata — Julské Alpy = endemická oblast)' },
      { id: 'g-klesticky', label: 'Kleštičky na klíšťata' },
      { id: 'g-compeed', label: 'Compeed na puchýře' },
      { id: 'g-banda', label: 'Elastické bandáže, náplasti' },
      { id: 'g-analg', label: 'Ibuprofen / paracetamol' },
      { id: 'g-antis', label: 'Dezinfekce rány' },
      { id: 'g-telefony', label: 'Tísňová čísla v mobilu: 112, 113, 1987 (GRZS), TIC +386 5 302 96 47' },
    ],
  },
];
