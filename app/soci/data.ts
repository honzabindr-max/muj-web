import type { BudgetRow, ChecklistItem, DayData, RiskItem, Waypoint } from './types';

export const DAY_COLORS: Record<number, string> = {
  1: '#64748b',
  2: '#0ea5e9',
  3: '#f97316',
  4: '#10b981',
  5: '#8b5cf6',
  6: '#ef4444',
  7: '#334155',
};

export const WAYPOINTS: Waypoint[] = [
  {
    id: 'brno',
    name: 'Brno',
    lat: 49.1951,
    lng: 16.6068,
    day: null,
    role: 'context',
    kind: 'context',
    description: 'Výchozí bod výpravy',
  },
  {
    id: 'ljubljana',
    name: 'Ljubljana',
    lat: 46.0569,
    lng: 14.5058,
    day: 1,
    role: 'overnight/context',
    kind: 'travel',
    description: 'Přesun Brno→Vídeň→Ljubljana, večer staré město',
  },
  {
    id: 'jezero-jasna',
    name: 'Jezero Jasna',
    lat: 46.474,
    lng: 13.7841,
    day: 2,
    role: 'activity',
    kind: 'nature',
    description: 'Tyrkysové horské jezero se sochou Zlatoroga, aklimatizace',
  },
  {
    id: 'russian-chapel',
    name: 'Russian Chapel',
    lat: 46.4426,
    lng: 13.7677,
    day: 3,
    role: 'stop',
    kind: 'nature',
    description: 'Historická kaple z roku 1916 na serpentinách Vršiče',
  },
  {
    id: 'vrsic-pass',
    name: 'Vršič Pass',
    lat: 46.4329,
    lng: 13.7431,
    day: 3,
    role: 'stop',
    kind: 'pass',
    description: 'Sedlo Vršič 1611 m — panoramatický výhled na Julské Alpy',
  },
  {
    id: 'izvir-soce',
    name: 'Izvir Soče (pramen)',
    lat: 46.4117,
    lng: 13.7241,
    day: 3,
    role: 'activity',
    kind: 'nature',
    description: 'Smaragdová voda tryskající ze skály — pramen řeky Soče',
  },
  {
    id: 'dom-trenta',
    name: 'Dom Trenta / TNP IC',
    lat: 46.3804,
    lng: 13.7525,
    day: 3,
    role: 'overnight',
    kind: 'lodging',
    description: 'Nocleh v Trentě — KRITICKÁ rezervace (zavolat první)',
  },
  {
    id: 'velika-korita',
    name: 'Velika korita Soče',
    lat: 46.3372,
    lng: 13.6459,
    day: 4,
    role: 'stop',
    kind: 'gorge',
    description: 'Fotografický highlight Soča Trailu — soutěska se smaragdovou vodou',
  },
  {
    id: 'camp-bovec',
    name: 'Camp Bovec',
    lat: 46.3355,
    lng: 13.5537,
    day: 4,
    role: 'overnight',
    kind: 'camp',
    description: 'Kemp v Bovci, ~15 €/os/noc — základna na den 5 a 6',
  },
  {
    id: 'bovec-sport',
    name: 'Bovec Sport Center',
    lat: 46.3322,
    lng: 13.5375,
    day: 6,
    role: 'activity',
    kind: 'rafting',
    description: 'Rafting na Soče — peřeje WW II–III, smaragdová voda',
  },
  {
    id: 'boka',
    name: 'Boka waterfall',
    lat: 46.3214,
    lng: 13.482,
    day: 5,
    role: 'activity',
    kind: 'waterfall',
    description: 'Vodopád Boka — 144 m, jeden z nejvyšších ve Slovinsku',
  },
  {
    id: 'virje',
    name: 'Slap Virje',
    lat: 46.3351,
    lng: 13.5142,
    day: 5,
    role: 'activity',
    kind: 'waterfall',
    description: 'Mléčně zelený vodopád Virje — koupání, odpočinkový den',
  },
];

// Dopravní polyline: Brno → Ljubljana → Kranjska Gora (kontextová šedá vrstva)
export const TRANSPORT_LINE: [number, number][] = [
  [49.1951, 16.6068], // Brno
  [46.0569, 14.5058], // Ljubljana
  [46.4822, 13.7814], // Kranjska Gora (orientačně)
];

export const DAYS: DayData[] = [
  {
    day: 1,
    title: 'Brno → Ljubljana',
    difficulty: 1,
    color: DAY_COLORS[1],
    highlights: 'Pohodový přesun, večer staré město',
    description:
      'Ranní vlak Brno→Vídeň (~1,5 h, RegioJet/ČD), přímý EuroCity Vídeň→Ljubljana (reálně 5,5–6 h, ÖBB+SŽ). Noc v Lublani — večer projít staré město. Kup průběžnou jízdenku Wien→Ljubljana u ÖBB (garance přípoje při zpoždění). Cena orientačně od ~6 € (Brno→Vídeň) + od ~19 € (Vídeň→Ljubljana Sparschiene).',
    planB: 'Ujel přímý EC? Pozdější spoj nebo noc ve Vídni a pokračovat ráno.',
  },
  {
    day: 2,
    title: 'Ljubljana → Kranjska Gora, Jasna',
    difficulty: 1,
    color: DAY_COLORS[2],
    highlights: 'Tyrkysové jezero Jasna, socha Zlatoroga, první výhledy na Julské Alpy',
    description:
      'Bus Ljubljana→Kranjska Gora (~2 h, Arriva/Nomago). Odpoledne jezero Jasna — tyrkysová voda, socha zlatého jeleňce Zlatoroga. Aklimatizace, nákup zásob na zítra. Večer základna KG.',
    planB: 'Pozdní příjezd? Jezero Jasna ráno Den 3 před nasednutím na bus na Vršič.',
  },
  {
    day: 3,
    title: 'KG → Vršič → pramen Soče → Trenta',
    difficulty: 3,
    color: DAY_COLORS[3],
    highlights: 'Serpentiny Vršiče, Ruská kaple (1916), sedlo 1611 m, pramen Soče ze skály',
    description:
      'Doporučená varianta 3B: bezplatný bus Vršič (od 4:30, ~20 spojů/den v sezóně), pěšky horní část + klíčové zastávky. Ne celá pěší 22–25 km etapa. Ruská kaple na serpentinách, sedlo Vršič 1611 m s panoramatem, pěšky k prameni Soče (smaragdová voda ze skály). Nocleh Dom Trenta — REZERVOVAT JAKO PRVNÍ.',
    planB: 'Bouřka na Vršiči → okamžitě dolů, sjet busem do Trenty/Bovce. Sledovat předpověď, start brzy ráno.',
  },
  {
    day: 4,
    title: 'Trenta → Bovec po Soča Trailu',
    difficulty: 2,
    color: DAY_COLORS[4],
    highlights: 'Malá korita, Velika korita Soče, barva řeky po celé trase',
    description:
      'Soča Trail ~20–22 km, lehce zvlněné, 5–6 h čisté chůze / 7–8 h s pauzami. Highlight: Velika korita Soče — soutěska s výjimečnou smaragdovou barvou, ideální foto. Příchod do Camp Bovec večer.',
    planB: 'Déšť → kluzké lávky, jen opatrně nebo bus Trenta→Bovec. Nezkoušet mokré přechody přes lávky bez jistoty.',
  },
  {
    day: 5,
    title: 'Bovec — odpočinek + vodopády',
    difficulty: 1,
    color: DAY_COLORS[5],
    highlights: 'Boka (144 m), Slap Virje, koupání, rezerva počasí',
    description:
      'Odpočinkový den. Vodopád Boka — 144 m, jeden z nejvyšších ve Slovinsku. Slap Virje — mléčně zelená voda, koupání. Doplnění zásob v Bovci. Den slouží i jako rezerva při špatném počasí nebo zpoždění z předchozích dní.',
    planB: 'Celý den odpočinek, žádný tlak na pohyb.',
  },
  {
    day: 6,
    title: 'Rafting na Soče',
    difficulty: 2,
    color: DAY_COLORS[6],
    highlights: 'Peřeje WW II–III, smaragdová voda, průvodce v ceně',
    description:
      'Rafting z Bovec Sport Center (nebo jiná firma — Soča Splash, HydroMania, Bovec Rafting Team). Permit 21 €/dospělý (Sektor Bovec 6 € + Kobarid 15 €), oba synové (16 i 20) platí plnou cenu. 1 permit může krýt až 5 osob. Nekupovat dřív než 24 h předem (non-refundable). Portál: gosoca.si/portal.',
    planB: 'Špatné počasí nebo high water? Canyoning / zipline nebo odložit na Den 7.',
  },
  {
    day: 7,
    title: 'Canyoning Sušec / návrat',
    difficulty: 2,
    color: DAY_COLORS[7],
    highlights: 'Volitelný canyoning, pak přesun Bovec→Ljubljana→Brno',
    description:
      'Dle energie: dopolední canyoning Sušec + odpolední návrat, nebo čistý návrat. Bovec→Ljubljana bus (ověřit poslední rozumný spoj předem). Ljubljana→Vídeň EuroCity, Vídeň→Brno vlak. Nejbezpečnější: noc v Lublani a domů ráno.',
    planB: 'Vynechat aktivitu a jet dřív — noc v Lublani je vždy bezpečná záloha.',
  },
];

export const RESERVATION_CHECKLIST: ChecklistItem[] = [
  {
    id: 'res-trenta',
    label: 'Trenta — nocleh (Dom Trenta, +386 5 388 93 30)',
    critical: true,
    note: 'PRVNÍ ZE VŠEHO — nejkritičtější položka, omezená kapacita',
  },
  {
    id: 'res-bovec',
    label: 'Camp Bovec (info@campbovec.com, ~15 €/os/noc)',
    critical: true,
    note: '3 noci Den 4–6',
  },
  {
    id: 'res-vlak-tam',
    label: 'Brno → Ljubljana (vlak, ÖBB/RegioJet)',
    critical: false,
    note: 'Průběžná jízdenka Wien→Ljubljana, Sparschiene od ~19 €',
  },
  {
    id: 'res-bus-kg',
    label: 'Ljubljana → Kranjska Gora (bus, Arriva/Nomago)',
    critical: false,
  },
  {
    id: 'res-rafting',
    label: 'Rafting + permit workflow + finální cena pro 3 osoby (písemně)',
    critical: true,
    note: 'Ověřit: „Is the river permit included, or do we buy it separately? Total final price for 3 persons including permits, equipment and transfer?"',
  },
  {
    id: 'res-navrat',
    label: 'Návrat Bovec → Ljubljana → Brno',
    critical: false,
    note: 'Ověřit poslední rozumný spoj Bovec→Ljubljana',
  },
  {
    id: 'res-pojisteni',
    label: 'Pojištění (komerční, EHIC nestačí)',
    critical: true,
    note: 'Komerční pojistka pokrývající trek + rafting + canyoning v horách',
  },
  {
    id: 'res-mapy',
    label: 'Offline mapy (Maps.me / Mapy.cz / OsmAnd)',
    critical: false,
  },
];

export const BUDGET_ROWS: BudgetRow[] = [
  { item: 'Doprava 3 os.', low: '4 500–6 500 Kč', mid: '6 000–9 000 Kč', high: '9 000–12 000 Kč' },
  { item: 'Noc Ljubljana', low: '1 500–2 250', mid: '2 250–3 250', high: '3 500–5 500' },
  { item: 'Kranjska Gora', low: '1 125–2 250', mid: '2 250–3 750', high: '3 750–6 000' },
  { item: 'Trenta', low: '2 250–3 750', mid: '3 000–4 500', high: '4 500–6 000' },
  { item: 'Bovec 3 noci', low: '3 375', mid: '4 500–6 750', high: '7 500–13 500' },
  { item: 'Rafting + permit', low: '~5 000–6 750', mid: '~5 250–7 500', high: '~6 000–9 000' },
  { item: 'Jídlo', low: '4 500–6 750', mid: '6 000–8 250', high: '8 250–11 250' },
  { item: 'Pojištění', low: '750–1 125', mid: '1 125–1 500', high: '1 500–2 250' },
  { item: 'Rezerva', low: '1 500–2 500', mid: '2 500–4 000', high: '4 000–6 250' },
];

export const RISKS: RiskItem[] = [
  {
    risk: 'Dlouhá doprava (Vídeň→Ljubljana)',
    prevention: 'Noc v Lublani Den 1, průběžná jízdenka ÖBB',
    fallback: 'Noc ve Vídni a pokračovat ráno',
  },
  {
    risk: 'Plná Trenta (nocleh)',
    prevention: 'Rezervovat jako PRVNÍ věc',
    fallback: 'Basecamp v Bovci, autobus z Trenty',
  },
  {
    risk: 'Bouřky na Vršiči',
    prevention: 'Start brzy ráno, sledovat předpověď 48 h',
    fallback: 'Okamžitě sjet busem dolů do Trenty/Bovce',
  },
  {
    risk: 'Studená voda při raftingu',
    prevention: 'Neopren v ceně služby — ověřit při rezervaci',
    fallback: 'Canyoning / jiná aktivita',
  },
  {
    risk: 'Permit chaos 2026',
    prevention: 'Ověřit u firmy dopředu, dva oddělené permity na dva účty',
    fallback: 'TIC Bovec/Kobarid/Tolmin, tel. +386 70 982 301',
  },
  {
    risk: 'Klíšťata (endemická oblast)',
    prevention: 'Repelent, kontrola nohou každý večer',
    fallback: 'Lékárnička, nejbližší zdravotnické středisko',
  },
];

export const GEAR_GROUPS = [
  {
    group: 'Doklady & pojištění',
    id: 'gear-docs',
    items: [
      { id: 'g-pas', label: 'Pas / OP (každý)' },
      { id: 'g-ehic', label: 'EHIC (jako záloha, komerční pojistka je nutná)' },
      { id: 'g-pojisteni', label: 'Komerční pojistka — potvrzení (trek + rafting + hory)' },
      { id: 'g-cash', label: 'Hotovost EUR (kemp, bus, drobné)' },
    ],
  },
  {
    group: 'Oblečení',
    id: 'gear-clothes',
    items: [
      { id: 'g-boty', label: 'Kotníkové trekové boty' },
      { id: 'g-boty-voda', label: 'Boty do vody (sandály / crocs)' },
      { id: 'g-fleece', label: 'Fleece / vrstvení na Vršič' },
      { id: 'g-plas', label: 'Pláštěnka / poncho' },
      { id: 'g-kratasy', label: 'Rychleschnoucí kalhoty / kraťasy' },
    ],
  },
  {
    group: 'Trek & voda',
    id: 'gear-trek',
    items: [
      { id: 'g-batoh', label: 'Batoh 35–50 l (záda)' },
      { id: 'g-daypack', label: 'Malý daypack 15–20 l' },
      { id: 'g-stan', label: 'Lehký stan / spacák (dle ubytování)' },
      { id: 'g-hole', label: 'Trekové hole' },
      { id: 'g-suchy', label: 'Suchý vak / vodotěsné sáčky' },
      { id: 'g-lahev', label: 'Lahev / filtr (voda ze Soče pitná)' },
    ],
  },
  {
    group: 'Elektronika',
    id: 'gear-electronics',
    items: [
      { id: 'g-power', label: 'Powerbanka (velká, aspoň 20 000 mAh)' },
      { id: 'g-head', label: 'Čelovka + záložní baterie' },
      { id: 'g-mapy', label: 'Offline mapy stažené předem (Mapy.cz / OsmAnd)' },
      { id: 'g-kabel', label: 'Záložní USB kabely' },
    ],
  },
  {
    group: 'Lékárnička',
    id: 'gear-med',
    items: [
      { id: 'g-compeed', label: 'Compeed na puchýře' },
      { id: 'g-banda', label: 'Elastické bandáže, náplasti' },
      { id: 'g-repelent', label: 'Repelent na klíšťata (DEET 30 %+)' },
      { id: 'g-analg', label: 'Analgetika (ibuprofen)' },
      { id: 'g-antis', label: 'Dezinfekce rány' },
    ],
  },
];
