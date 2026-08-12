import type { DayPlan, EmergencyItem, Photo, ShoppingItem } from './types';

export const MISSION = {
  title: 'ČESKÝ RÁJ',
  dates: '13.–15. 8. 2026',
  summary: '3 dny · 2 noci · ~32 km',
  route: 'Hruboskalsko → Trosky → Věžák → Prachov · ⛺ Sedmihorky ×2',
};

// Fotky s atribucí — výhradně Wikimedia Commons, volné licence (CC0 / PD / CC-BY / CC-BY-SA).
// Klíč beze zdroje = pro dané místo neexistuje volná fotka → v UI padá na barevný gradient s názvem.
export const PHOTOS: Record<string, Photo | undefined> = {
  hruboskalaZamek: {
    src: '/cesky-raj-2026/photos/hruboskala-zamek.webp',
    alt: 'Zámek Hrubá Skála',
    author: 'Florin dr',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hruba_Skala_chateau.jpg',
  },
  marianskaVyhlidka: {
    src: '/cesky-raj-2026/photos/marianska-vyhlidka.webp',
    alt: 'Mariánská vyhlídka, Hruboskalsko',
    author: 'Eliška Jindříšková',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Hruboskalsko_Pohled_z_Mari%C3%A1nsk%C3%A9_vyhl%C3%ADdky.jpg',
  },
  naKapelu: {
    src: '/cesky-raj-2026/photos/na-kapelu.webp',
    alt: 'Vyhlídka Na Kapelu, Hruboskalsko',
    author: 'ŠJů, sešito uživatelem Marku1988',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Vyhl%C3%ADdka_na_Kapelu.jpg',
  },
  uLvicka: {
    src: '/cesky-raj-2026/photos/u-lvicka.webp',
    alt: 'Vyhlídka U Lvíčka, Hruboskalsko',
    author: 'ŠJů',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Vyhl%C3%ADdka_U_Lv%C3%AD%C4%8Dka.jpg',
  },
  valdstejn: {
    src: '/cesky-raj-2026/photos/valdstejn.webp',
    alt: 'Hrad Valdštejn',
    author: 'Jerzy Strzelecki',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Castle_Vald%C5%A1tejn_01(js).jpg',
  },
  trosky: {
    src: '/cesky-raj-2026/photos/trosky.webp',
    alt: 'Hrad Trosky — věže Baba a Panna',
    author: 'Me116',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:V%C4%9B%C5%BEe_hradu_Trosky_Baba_a_Panna.JPG',
  },
  vidlak: {
    src: '/cesky-raj-2026/photos/vidlak.webp',
    alt: 'Vidlák, Podtrosecká údolí',
    author: 'Alofok',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Vidlak_rybnik.JPG',
  },
  vezickyRybnik: {
    src: '/cesky-raj-2026/photos/vezicky-rybnik.webp',
    alt: 'Věžický rybník v Českém ráji',
    author: 'Vladkazi1',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:V%C4%9B%C5%BEeck%C3%BD_rybn%C3%ADk_v_%C4%8Cesk%C3%A9m_r%C3%A1ji.jpg',
  },
  nebakov: {
    src: '/cesky-raj-2026/photos/nebakov.webp',
    alt: 'Podtrosecká údolí (přírodní rezervace) u Nebákova',
    author: 'Jiří Sedláček (Frettie)',
    license: 'CC BY-SA 4.0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Meadow_in_nature_reserve_Podtroseck%C3%A1_%C3%BAdol%C3%AD,_Semily_District.JPG',
  },
  prachovskeSkaly: {
    src: '/cesky-raj-2026/photos/prachovske-skaly.webp',
    alt: 'Prachovské skály',
    author: 'Dcpeets',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cesky_Raj_Prachov_Rocks_1.jpg',
  },
  vyhlidkaCeskehoRaje: {
    src: '/cesky-raj-2026/photos/vyhlidka-ceskeho-raje.webp',
    alt: 'Vyhlídka Českého ráje, Prachovské skály',
    author: 'Chmee2',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Vyhl%C3%ADdka_%C4%8Cesk%C3%A9ho_r%C3%A1je.jpg',
  },
  // Prachovská jehla a Šikmá věž: na Wikimedia Commons neexistuje volně licencovaná
  // fotka v dostatečném rozlišení — fallback na gradient s názvem (viz PhotoBox.tsx).
};

function mapyUrl(query: string): string {
  return `https://mapy.cz/zakladni?q=${encodeURIComponent(query)}`;
}

// ============================================================
// DEN 1 — ČTVRTEK 13. 8. — Hruboskalsko
// ============================================================
const den1: DayPlan = {
  id: 'ct',
  date: '2026-08-13',
  dateLabel: 'čtvrtek 13. 8. 2026',
  shortLabel: 'ČT',
  title: 'Hruboskalsko',
  stats: '10,3 km · 3:10 čisté chůze · +199/−201 m',
  difficulty: 'PLNÁ POLNÍ',
  heroPhoto: PHOTOS.hruboskalaZamek,
  steps: [
    {
      id: 'd1-1',
      time: '08:46',
      type: 'vlak',
      place: 'Brno hl.n. → Pardubice hl.n.',
      instruction: 'Ex3 rj 256 Vindobona · příjezd 10:23',
    },
    {
      id: 'd1-2',
      time: '10:23',
      type: 'vlak',
      place: 'Přestup Pardubice',
      instruction: 'Nejrizikovější bod výletu — sledovat příjezd Vindobony.',
      transferBadge: { minutes: 7, level: 'red', label: '7 min' },
    },
    {
      id: 'd1-3',
      time: '10:30',
      type: 'vlak',
      place: 'Pardubice → Hradec Králové',
      instruction: 'Os 6234 · příjezd 10:53',
    },
    {
      id: 'd1-4',
      time: '10:53',
      type: 'vlak',
      place: 'Přestup Hradec Králové',
      instruction: 'Rezerva na přestup.',
      transferBadge: { minutes: 9, level: 'orange', label: '9 min' },
    },
    {
      id: 'd1-5',
      time: '11:02',
      type: 'vlak',
      place: 'Hradec Králové → Hrubá Skála',
      instruction: 'V50 / Os 5508 · příjezd 12:54',
    },
    {
      id: 'd1-6',
      time: '12:54',
      type: 'trek',
      place: 'Hrubá Skála žst. — START TREKU',
      instruction: 'Upravit batohy, napít se.',
      mapUrl: mapyUrl('Hrubá Skála žst.'),
    },
    {
      id: 'd1-7',
      time: '~13:30–14:00',
      type: 'highlight',
      place: 'Zámek Hrubá Skála',
      instruction: 'Vyhlídková terasa — nejlepší WOW/minuta dne. Nespěchat.',
      mapUrl: mapyUrl('Zámek Hrubá Skála'),
      photo: PHOTOS.hruboskalaZamek,
    },
    {
      id: 'd1-8',
      time: '~14:00–16:30',
      type: 'highlight',
      place: 'Jádro Hruboskalska',
      instruction: 'Adamovo lože → Mariánská vyhlídka → Na Kapelu → U Lvíčka.',
      mapUrl: mapyUrl('Mariánská vyhlídka Hrubá Skála'),
      subPoints: [
        { name: 'Adamovo lože' },
        { name: 'Mariánská vyhlídka', photo: PHOTOS.marianskaVyhlidka },
        { name: 'Na Kapelu', photo: PHOTOS.naKapelu },
        { name: 'U Lvíčka', photo: PHOTOS.uLvicka },
      ],
    },
    {
      id: 'd1-9',
      time: '~16:30–17:15',
      type: 'highlight',
      place: 'Hrad Valdštejn',
      instruction: 'První kandidát na škrt při zpoždění nebo bouřce.',
      mapUrl: mapyUrl('Hrad Valdštejn'),
      photo: PHOTOS.valdstejn,
    },
    {
      id: 'd1-10',
      time: '~17:15–18:00',
      type: 'trek',
      place: 'Sestup do Sedmihorek',
      instruction: 'Sestup ke kempu.',
    },
    {
      id: 'd1-11',
      time: '~18:00',
      type: 'kemp',
      place: 'Autocamp Sedmihorky',
      instruction: 'Check-in, stan na 2 noci, sprcha.',
      mapUrl: mapyUrl('Autocamp Sedmihorky'),
    },
    {
      id: 'd1-12',
      time: '~19:00',
      type: 'jidlo',
      place: 'Večeře v kempu',
      instruction: 'Kiosek / obchod, doplnit zásoby na pátek.',
    },
  ],
  doprava: [
    '08:46 Brno hl.n. → Pardubice hl.n. 10:23 (Ex3 rj 256 Vindobona)',
    '10:30 Pardubice → Hradec Králové 10:53 (Os 6234)',
    '11:02 Hradec Králové → Hrubá Skála 12:54 (V50 / Os 5508)',
    'Nejrizikovější přestup dne: Pardubice, jen 7 min.',
  ],
  trek: [
    '10,3 km · 3:10 čisté chůze · +199/−201 m · PLNÁ POLNÍ',
    'Reálně se zastávkami 4–4,5 h.',
  ],
  jidlo: ['Snídaně doma', 'Svačina ve vlaku', 'Večeře Sedmihorky (kiosek/obchod v kempu)'],
  voda: ['2 l/osobu na start pěší části'],
  ubytovani: ['Autocamp Sedmihorky — stan na 2 noci, check-in ~18:00'],
  planB: [
    'Ujede 10:30 v Pardubicích → 11:07 R14/R1066 → Turnov 13:16 → 13:28 Os 5513 → Hrubá Skála 13:41 (ztráta 47 min). Reakce: zkrátit pauzy, případně projít Valdštejn bez zastávky. NEŠKRTAT hlavní vyhlídky.',
    'Bouřka: zkrátit zastávky → redukovat Valdštejn → kemp.',
  ],
};

// ============================================================
// DEN 2 — PÁTEK 14. 8. — Trosky + Podtrosecká údolí
// ============================================================
const den2: DayPlan = {
  id: 'pa',
  date: '2026-08-14',
  dateLabel: 'pátek 14. 8. 2026',
  shortLabel: 'PÁ',
  title: 'Trosky + Podtrosecká údolí',
  stats: '16–17 km · NALEHKO',
  difficulty: 'NALEHKO',
  heroPhoto: PHOTOS.trosky,
  steps: [
    {
      id: 'd2-1',
      time: '07:15–07:45',
      type: 'kemp',
      place: 'Vstávání',
      instruction: 'Snídaně v kempu, doplnit vodu.',
    },
    {
      id: 'd2-2',
      time: '08:30',
      type: 'trek',
      place: 'Odchod na zastávku',
      instruction: 'Stan a spacáky zůstávají v kempu — jdeme nalehko.',
    },
    {
      id: 'd2-3',
      time: '08:56',
      type: 'vlak',
      place: 'Karlovice-Sedmihorky → Ktová',
      instruction: 'V50 / Os 5505 · příjezd 09:06',
    },
    {
      id: 'd2-4',
      time: '09:06',
      type: 'trek',
      place: 'START — Ktová → Trosky',
      instruction: 'Nástup na trek. 1,5–2 km / 30–40 min.',
    },
    {
      id: 'd2-5',
      time: '~09:45–10:45',
      type: 'highlight',
      place: 'Hrad Trosky',
      instruction: 'Hrad a vyhlídky — počítat 60–90 min.',
      mapUrl: mapyUrl('Hrad Trosky'),
      photo: PHOTOS.trosky,
    },
    {
      id: 'd2-6',
      time: '~10:45–11:15',
      type: 'jidlo',
      place: 'Bistro Pod Troskami',
      instruction:
        'V sezoně od 9:00 — jídlo + MAXIMÁLNĚ DOPLNIT VODU. Na další občerstvení po trase nespoléhat.',
    },
    {
      id: 'd2-7',
      time: '~11:15',
      type: 'trek',
      place: 'Odchod z Trosek',
      instruction: 'Pokračujeme dál na trek.',
    },
    {
      id: 'd2-8',
      time: '~12:15',
      type: 'trek',
      place: 'Vidlák',
      instruction: 'Krátká pauza, občerstvení jen bonus.',
      photo: PHOTOS.vidlak,
    },
    {
      id: 'd2-9',
      time: '~13:00–13:45',
      type: 'highlight',
      place: 'Věžický rybník',
      instruction: 'Hlavní highlight dne, delší pauza. NEŠKRTAT.',
      mapUrl: mapyUrl('Věžický rybník'),
      photo: PHOTOS.vezickyRybnik,
    },
    {
      id: 'd2-10',
      time: '~14:30',
      type: 'highlight',
      place: 'Nebákov',
      instruction: 'VOLITELNÝ MODUL — první na škrt při vedru.',
      photo: PHOTOS.nebakov,
    },
    {
      id: 'd2-11',
      time: '~15:30–16:00',
      type: 'trek',
      place: 'Borek pod Troskami',
      instruction: 'Cíl pěší části.',
    },
    {
      id: 'd2-12',
      time: '16:16',
      type: 'vlak',
      place: 'Borek → Karlovice-Sedmihorky',
      instruction: 'Příjezd 16:22. Primární spoj — viz alternativy níže.',
    },
    {
      id: 'd2-13',
      time: '~16:30',
      type: 'kemp',
      place: 'Kemp',
      instruction: 'Sprcha.',
    },
    {
      id: 'd2-14',
      time: '18:00–19:00',
      type: 'jidlo',
      place: 'Večeře v Sedmihorkách',
      instruction: 'Večer připravit věci na sobotu — ráno se tábor definitivně balí.',
    },
  ],
  doprava: [
    '08:56 Karlovice-Sedmihorky → Ktová 09:06 (V50 / Os 5505)',
    '16:16 Borek → Karlovice-Sedmihorky 16:22 (primární)',
    'Alternativní vlaky z Borku: 14:51→15:03 · 16:16→16:22 (primární) · 16:51→17:03 · 18:15→18:22 — není důvod sprintovat.',
  ],
  trek: [
    '16–17 km · NALEHKO (stan a spacáky zůstávají v kempu)',
    'Nejdelší den, potenciálně kolem 30 °C.',
    'Ktová → Trosky: 1,5–2 km / 30–40 min',
  ],
  jidlo: [
    'Snídaně v kempu',
    'Bistro Pod Troskami (v sezoně od 9:00) — hlavní jídlo dne',
    'Večeře Sedmihorky',
  ],
  voda: [
    'Nejkritičtější den. Start 2–2,5 l/osobu, kapacita ideálně 3 l.',
    'Doplnit na Troskách — maximálně, na další zdroje po trase nespoléhat.',
  ],
  ubytovani: ['Autocamp Sedmihorky — 2. noc, tábor zůstává stát'],
  planB: [
    'HEAT PLAN B (oficiální): při vedru nebo únavě vynechat Nebákov → úspora ~4 km → trasa spadne na 12–13 km. Věžický rybník se neškrtá nikdy.',
    'Nestihneme Borek 16:16 → 16:51, případně 18:15.',
  ],
};

// ============================================================
// DEN 3 — SOBOTA 15. 8. — Prachovské skály + návrat
// ============================================================
const den3: DayPlan = {
  id: 'so',
  date: '2026-08-15',
  dateLabel: 'sobota 15. 8. 2026',
  shortLabel: 'SO',
  title: 'Prachovské skály + návrat',
  stats: '5,4 km · 2:21 čisté chůze · +309/−309 m',
  difficulty: 'PLNÁ POLNÍ',
  heroPhoto: PHOTOS.prachovskeSkaly,
  steps: [
    {
      id: 'd3-1',
      time: '06:45–07:00',
      type: 'kemp',
      place: 'Vstávání',
      instruction: 'Snídaně.',
    },
    {
      id: 'd3-2',
      time: '07:00–08:15',
      type: 'kemp',
      place: 'Balení tábora',
      instruction:
        'Počítat 60–75 min, ne 40–50 — stan může být od rosy mokrý. Všechno jde s námi, do kempu se nevracíme.',
    },
    {
      id: 'd3-3',
      time: '08:30',
      type: 'trek',
      place: 'Odchod na vlak',
      instruction: 'S plnými batohy na zastávku.',
    },
    {
      id: 'd3-4',
      time: '08:56',
      type: 'vlak',
      place: 'Karlovice-Sedmihorky → Libuň',
      instruction: 'V50 / Os 5505 · příjezd 09:18',
    },
    {
      id: 'd3-5',
      time: '09:18',
      type: 'vlak',
      place: 'Přestup Libuň',
      instruction: 'Rezerva na přestup.',
      transferBadge: { minutes: 5, level: 'red', label: '5 min' },
    },
    {
      id: 'd3-6',
      time: '09:23',
      type: 'vlak',
      place: 'Libuň → Mladějov v Čechách',
      instruction: 'S36 / Os 8515 · příjezd 09:35',
    },
    {
      id: 'd3-7',
      time: '09:35–09:49',
      type: 'trek',
      place: 'Pěšky na zastávku Mladějov, knihovna',
      instruction: 'Přesun na autobus.',
    },
    {
      id: 'd3-8',
      time: '09:49',
      type: 'bus',
      place: 'Bus 510 → Holín, Prachov, Skalní město',
      instruction: 'Příjezd 09:59.',
    },
    {
      id: 'd3-9',
      time: '10:00',
      type: 'plan-b',
      place: 'Batohy — PLAN A',
      instruction:
        'Zeptat se v Turistické chatě Prachov na úschovu tří velkých batohů. Doložena je úschova kol, ne zavazadel — není to jistota. Když vezmou → okruh nalehko. Když ne → jdeme s nimi.',
      mapUrl: mapyUrl('Turistická chata Prachov'),
    },
    {
      id: 'd3-10',
      time: '10:15–13:00',
      type: 'highlight',
      place: 'BEST OF PRACHOV',
      instruction:
        'Vstup → Vyhlídka Českého ráje → Prachovská jehla → Všetečkova vyhlídka → Šikmá věž → Hlaholská vyhlídka → severní promenáda → vstup. Se zastávkami 2:45–3:15 h.',
      mapUrl: mapyUrl('Prachovské skály'),
      photo: PHOTOS.prachovskeSkaly,
      subPoints: [
        { name: 'Vyhlídka Českého ráje', photo: PHOTOS.vyhlidkaCeskehoRaje },
        { name: 'Prachovská jehla', photo: PHOTOS.prachovskaJehla },
        { name: 'Všetečkova vyhlídka' },
        { name: 'Šikmá věž', photo: PHOTOS.sikmaVez },
        { name: 'Hlaholská vyhlídka' },
      ],
    },
    {
      id: 'd3-11',
      time: '13:00–13:15',
      type: 'trek',
      place: 'Konec okruhu',
      instruction: 'Vyzvednout batohy.',
    },
    {
      id: 'd3-12',
      time: '13:15–14:30',
      type: 'jidlo',
      place: 'Oběd Turistická chata Prachov',
      instruction: 'Teplé jídlo, doplnit pití.',
    },
    {
      id: 'd3-13',
      time: '14:30',
      type: 'trek',
      place: 'Přesun na autobus',
      instruction: '',
    },
    {
      id: 'd3-14',
      time: '15:01',
      type: 'bus',
      place: 'Bus 510 Prachov → Jičín',
      instruction: 'Příjezd 15:15. Primární spoj.',
    },
    {
      id: 'd3-15',
      time: '15:34',
      type: 'vlak',
      place: 'Jičín → Hradec Králové',
      instruction: 'V50 / Os 5515 · příjezd 16:51',
    },
    {
      id: 'd3-16',
      time: '17:05',
      type: 'vlak',
      place: 'Hradec Králové → Pardubice',
      instruction: 'Os 6249 · příjezd 17:28',
    },
    {
      id: 'd3-17',
      time: '17:36',
      type: 'vlak',
      place: 'Pardubice → Brno hl.n.',
      instruction: 'Ex3 rj 257 Vindobona · příjezd 19:13',
    },
  ],
  doprava: [
    '08:56 Karlovice-Sedmihorky → Libuň 09:18 (V50 / Os 5505)',
    '09:23 Libuň → Mladějov v Čechách 09:35 (S36 / Os 8515)',
    '09:49 bus 510 → Holín, Prachov, Skalní město 09:59',
    '15:01 bus 510 Prachov → Jičín 15:15',
    '15:34 Jičín → Hradec Králové 16:51 (V50 / Os 5515)',
    '17:05 Hradec Králové → Pardubice 17:28 (Os 6249)',
    '17:36 Pardubice → Brno hl.n. 19:13 (Ex3 rj 257 Vindobona)',
    'Nejrizikovější přestup dne: Libuň, jen 5 min.',
  ],
  trek: [
    '5,4 km · 2:21 čisté chůze · +309/−309 m · PLNÁ POLNÍ',
    'Nenechat se zmást kilometráží — schody, průchody mezi skalami, převýšení. Při 30+ °C fyzicky nepříjemnější, než km naznačují.',
  ],
  jidlo: ['Oběd Turistická chata Prachov — teplé jídlo, doplnit pití'],
  voda: ['2 l/osobu, v Prachově možnost dokoupit'],
  ubytovani: ['Tábor se dnes ráno definitivně balí — do kempu se nevracíme'],
  planB: [
    'V Prachově nevezmou batohy → 5,4 km okruh s nimi.',
    'Pozdější návraty: 15:01→19:13 (primární) · 15:53→20:13 · 17:01→21:13 · 17:53→22:13 (nejzazší rozumný). Při velkém vedru preferovat 15:01.',
  ],
};

export const DAYS: DayPlan[] = [den1, den2, den3];

export const EMERGENCY: EmergencyItem[] = [
  { situace: 'Vindobona má zpoždění', reakce: 'Sledovat Pardubice.' },
  {
    situace: 'Ujede 10:30 v Pardubicích',
    reakce: '11:07 → Turnov → Hrubá Skála 13:41.',
  },
  { situace: 'Čtvrtek bouřka', reakce: 'Zkrátit zastávky / vynechat Valdštejn.' },
  { situace: 'Pátek velké vedro', reakce: 'Vynechat Nebákov, Věžák nikdy.' },
  { situace: 'Nestihneme Borek 16:16', reakce: '16:51, případně 18:15.' },
  { situace: 'V Prachově nevezmou batohy', reakce: '5,4 km okruh s nimi.' },
  { situace: 'Sobota extrémní vedro', reakce: 'Kratší pauzy, dost vody, odjezd 15:01.' },
  { situace: 'Chceme zůstat déle', reakce: '17:01 → Brno 21:13.' },
];

export const SHOPPING_LIST: ShoppingItem[] = [
  { id: 'tortilly', label: '6–8 tortill nebo trvanlivé pečivo' },
  { id: 'syr', label: '300–400 g tvrdého sýra' },
  { id: 'salam', label: '300–400 g trvanlivého salámu/jerky' },
  { id: 'banany', label: '6 banánů' },
  { id: 'jablka', label: '3–6 jablek' },
  { id: 'tycinky', label: '~9 müsli/proteinových tyčinek' },
  { id: 'orechy', label: '300–400 g ořechů' },
  { id: 'susenky', label: 'Sušenky/rychlé sladké' },
  { id: 'elektrolyty', label: '6–9 dávek elektrolytů' },
  { id: 'rezerva', label: '3 tyčinky jako nouzová rezerva' },
];

export const SHOPPING_NEVOZIT =
  'Nevozit: konzervy, těžké zásoby, kompletní večeře, velké množství pečiva.';
