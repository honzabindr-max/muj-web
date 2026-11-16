// Ukázková data stránky V (výsledek): jména a astro údaje jsou ukázkové (z plátna V-01 / V-02).
// Žádný výpočet, žádný LLM, žádná osobní data — jen fixtures. `&nbsp;` v textech se převádí
// funkcí n() na pevnou mezeru přesně tam, kde je má plátno.

export const n = (s: string) => s.replaceAll("&nbsp;", " ");

import { nbsp } from "../_lib/nbsp";

/** Pevné mezery (česká typografie) ve všech řetězcích struktury; plátno je má jen místy. */
function nbDeep<T>(value: T): T {
  if (typeof value === "string") return nbsp(value) as T;
  if (Array.isArray(value)) return value.map(nbDeep) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, nbDeep(v)]),
    ) as T;
  return value;
}

export const COPY_PROVENANCE = "PROTOTYPE_FIXTURE_COPY" as const;
export const FIXTURE_ID = "FX-V-RESULT-DEMO-01";

export type VazbaTyp = "conj" | "trine" | "square" | "sextile";
/** 7 vazeb v pořadí zleva (typ, silná = hlavní téma) */
export const VAZBY: { typ: VazbaTyp; strong: boolean }[] = [
  { typ: "conj", strong: true },
  { typ: "trine", strong: false },
  { typ: "trine", strong: false },
  { typ: "square", strong: false },
  { typ: "sextile", strong: false },
  { typ: "square", strong: false },
  { typ: "conj", strong: false },
];

const PAIR_RAW = {
  a: "Jana",
  b: "Tomáš",
  title: "Jana & Tomáš",
  nodesLabel: "7 míst, kde se potkáváte",
  timeNote: n(
    "Čas narození: Jana přibližně (±1&nbsp;h), Tomáš přesně. Části výkladu, které bez přesného času nelze bezpečně určit, vynecháváme. Co nejde spočítat, nedopočítáváme.",
  ),
  mainTheme: { title: "Navzájem se roztáčíte.", line: "Co jeden vysloví, druhý už balí." },
} as const;
export const PAIR = nbDeep(PAIR_RAW);

export type NitTyp = "touch" | "cross" | "merge";
export type NoteTon = "ladite" | "trete" | "plynete";

const KDO_JE_KDO_RAW = {
  eyebrow: "Vaše dvě nebe",
  title: "Kdo je kdo",
  lead: "Čtyři věci o každém z vás. Poznáte se?",
  rows: [
    {
      glyph: "☉",
      otazka: "Kým je",
      planeta: "Slunce",
      a: { text: "člověk vlastních pravidel", znameni: "Vodnář" },
      b: { text: "člověk, kterého táhne dálka", znameni: "Střelec" },
      nit: "touch" as NitTyp,
      ton: "ladite" as NoteTon,
      verdikt: "Ladíte.",
      veta: "Oba potřebujete volnost, každý trochu jinou.",
    },
    {
      glyph: "☽",
      otazka: "Co potřebuje k bezpečí",
      planeta: "Měsíc",
      a: { text: "mít své lidi nablízku", znameni: "Rak" },
      b: { text: n("říct to hned a&nbsp;naplno"), znameni: "Beran" },
      nit: "cross" as NitTyp,
      ton: "trete" as NoteTon,
      verdikt: "Třete se.",
      veta: n(
        "Po bouřce chce Jana klid, Tomáš to mít z&nbsp;krku hned. Víc v&nbsp;tématu&nbsp;02.",
      ),
    },
    {
      glyph: "♀",
      otazka: "Jak miluje",
      planeta: "Venuše",
      a: { text: n("něžně, i&nbsp;beze slov"), znameni: "Ryby" },
      b: { text: "hluboko, nebo vůbec", znameni: "Štír" },
      nit: "merge" as NitTyp,
      ton: "plynete" as NoteTon,
      verdikt: "Plynete.",
      veta: n("Oba berete lásku vážně a&nbsp;do hloubky."),
    },
    {
      glyph: "♂",
      otazka: "Jak jde do věcí",
      planeta: "Mars",
      a: { text: n("hned a&nbsp;s&nbsp;nadšením"), znameni: "Střelec" },
      b: { text: n("až když to sedí oběma"), znameni: "Váhy" },
      nit: "touch" as NitTyp,
      ton: "ladite" as NoteTon,
      verdikt: "Ladíte.",
      veta: "Jana rozjede, Tomáš dá směr.",
    },
  ],
  zaver: {
    eyebrow: "Tady se potkáváte nejvíc",
    veta: n("Jak jde Jana do věcí, splývá s&nbsp;tím, kým je Tomáš."),
    astro: "Mars ☌ Slunce · spojení · odchylka 1,2°",
    proto: "Proto vaše hlavní téma:",
    odkaz: "Navzájem se roztáčíte ↓",
    poznamka: n("Měsíc zůstává v&nbsp;Raku i&nbsp;při nejistotě času ±1&nbsp;h."),
  },
} as const;
export const KDO_JE_KDO = nbDeep(KDO_JE_KDO_RAW);

export type Tema = {
  id: string;
  cislo: string;
  nadpis: string;
  text: string;
  schvalne?: string;
  dukazy: { text: string; meta: string }[];
};

const TEMATA_HEAD_RAW = {
  title: "Pět vazeb, které mezi vámi vyšly nejsilněji",
  lead: "Popisujeme sklony, ne osud. Jak je žijete, víte nejlíp vy dva.",
  note: n(
    "Texty témat píše jazykový model podle pevných pravidel, z&nbsp;vazeb ve vašem výpočtu.",
  ),
};
export const TEMATA_HEAD = nbDeep(TEMATA_HEAD_RAW);
const POCET: Record<number, string> = { 1: "Jedna vazba, která", 2: "Dvě vazby, které", 3: "Tři vazby, které", 4: "Čtyři vazby, které", 5: "Pět vazeb, které" };
/** nadpis sekce témat podle skutečného počtu témat */
export function temataTitle(n: number): string {
  return n === 5 || !POCET[n] ? TEMATA_HEAD.title : nbsp(`${POCET[n]} mezi vámi vyšly nejsilněji`);
}

const TEMATA_RAW: Tema[] = [
  {
    id: "t01",
    cislo: "01",
    nadpis: "Navzájem se roztáčíte",
    text: n(
      "Běží to u&nbsp;vás oběma směry. Když Tomáš vysloví nápad, Jana už hledá klíčky. A funguje to i&nbsp;obráceně: co rozjede Jana, tomu Tomáš dodá tah, aby to nezůstalo u&nbsp;řečí. Proto u&nbsp;vás „jednou bychom mohli…“ málokdy vydrží do další soboty. Daň? Neplánované líné odpoledne vám nejspíš jde hůř než stěhování skříně.",
    ),
    schvalne: n("Schválně: kdo z&nbsp;vás naposledy řekl „tak jdeme“?"),
    dukazy: [
      {
        text: n("Jak jde Jana do věcí, splývá s&nbsp;tím, kým je Tomáš."),
        meta: "Mars ☌ Slunce, 1,2°",
      },
      {
        text: n("Kým je Jana, plyne s&nbsp;tím, jak jde Tomáš do věcí."),
        meta: "Slunce △ Mars, 2,8°",
      },
    ],
  },
  {
    id: "t02",
    cislo: "02",
    nadpis: "Jana jako pevný bod, nálady každá jinak",
    text: n(
      "Jana je pro Tomáše pevný bod: když se mu rozsype den, stačí, že ona zůstane klidná a&nbsp;ví, co dál. Jenže vaše nálady běží na jiných hodinách. Jeden potřebuje věc probrat hned, druhý až ji v&nbsp;sobě usadí. A&nbsp;oba si přitom myslíte, že ten druhý to dělá „nějak divně“.",
    ),
    schvalne: n(
      "Schválně: kdo z&nbsp;vás chce po hádce mluvit hned, a&nbsp;kdo až zítra?",
    ),
    dukazy: [
      {
        text: n(
          "Čím drží Jana stálost, plyne s&nbsp;tím, co k&nbsp;bezpečí potřebuje Tomáš.",
        ),
        meta: "Saturn △ Měsíc",
      },
      {
        text: n(
          "Co k&nbsp;bezpečí potřebuje Jana, se tře s&nbsp;tím, co potřebuje Tomáš.",
        ),
        meta: "Měsíc □ Měsíc",
      },
    ],
  },
  {
    id: "t03",
    cislo: "03",
    nadpis: "Jana fandí nahlas",
    text: n(
      "Když Tomáš váhá, jestli se do něčeho pustit, Jana je obvykle ta, která řekne „jasně, že to dáš“, a&nbsp;myslí to vážně. Vedle ní je Tomáš o&nbsp;kus odvážnější, než by byl sám. Jana to bere jako samozřejmost, Tomáš jako dar.",
    ),
    dukazy: [
      {
        text: n(
          "Kde Jana povzbuzuje, snadno se doplňuje s&nbsp;tím, kým je Tomáš.",
        ),
        meta: "Jupiter ⚹ Slunce",
      },
    ],
  },
  {
    id: "t04",
    cislo: "04",
    nadpis: "Láska ve dvou jazycích",
    text: n(
      "Tomáš dává náklonnost najevo po svém: drobnostmi a&nbsp;pozorností, které si člověk musí všimnout. Jana ji ale čeká v&nbsp;jiné podobě. Oba se snažíte a&nbsp;občas se minete jako dva lidé, kteří si mávají z&nbsp;opačných nástupišť. Není to menší zájem. Je to překlad, který se dá naučit.",
    ),
    dukazy: [
      {
        text: n("Kým je Jana, se tře s&nbsp;tím, jak miluje Tomáš."),
        meta: "Slunce □ Venuše",
      },
    ],
  },
  {
    id: "t05",
    cislo: "05",
    nadpis: n("Rozumíte si z&nbsp;půl věty, i&nbsp;z&nbsp;té nevyslovené"),
    text: n(
      "Jana čte Tomáše mezi řádky: zachytí tón, pauzu i&nbsp;to, co ještě nedořekl. Většinou je to skoro telepatie. Jen občas z&nbsp;toho vznikne klasika: „Tak jsem to nemyslel.“ „Ale myslel.“",
    ),
    schvalne: n("Schválně: kdo z&nbsp;vás to řekl naposledy?"),
    dukazy: [
      {
        text: n("Kde Jana čte mezi řádky, splývá s&nbsp;tím, jak Tomáš mluví."),
        meta: "Neptun ☌ Merkur",
      },
    ],
  },
];
export const TEMATA: Tema[] = nbDeep(TEMATA_RAW);

const SDILENI_RAW = {
  title: "To je vaše Vztahová DNA.",
  lead: n("Ukažte ji tomu druhému. Schválně, kdo se v&nbsp;ní pozná dřív."),
  akce: ["Poslat obrázek", "Uložit do telefonu"],
  poznamka: "Obrázek neobsahuje data, časy ani místa narození.",
};
export const SDILENI = nbDeep(SDILENI_RAW);

const JAK_JSME_RAW = {
  title: n("Jak jsme k&nbsp;tomu došli"),
  sub: n("Údaje, polohy ve stupních, všech 7&nbsp;vazeb, jak výklad vzniká"),
};
export const JAK_JSME = nbDeep(JAK_JSME_RAW);

const OTEVRENE_RAW = {
  eyebrow: "Hloubková analýza",
  title: n("Co z&nbsp;vašeho výpočtu zůstalo otevřené"),
  lead: n(
    "Vztahová DNA ukázala, co mezi vámi je. Tyhle otázky otevřela a&nbsp;rozvádí je až Hloubková analýza.",
  ),
  polozky: [
    {
      cislo: "01",
      otazka: n("Kdo z&nbsp;vás táhne a&nbsp;kdy to druhého začne unavovat?"),
      kapitola: n("V&nbsp;analýze: 6 · Blízkost, svoboda a&nbsp;každodenní fungování"),
    },
    {
      cislo: "02",
      otazka: n(
        "Co každý z&nbsp;vás potřebuje, když je mu těžko, a&nbsp;proč to druhý napoprvé nepozná?",
      ),
      kapitola: n("V&nbsp;analýze: 5 · Emoce, komunikace a&nbsp;konflikt"),
    },
    {
      cislo: "03",
      otazka: n("Co v&nbsp;sobě navzájem probouzíte?"),
      kapitola: n("V&nbsp;analýze: 7 · Co v&nbsp;sobě probouzíte a&nbsp;co vztah drží pohromadě"),
    },
    {
      cislo: "04",
      otazka: "Jak přeložit náklonnost toho druhého, aby neprošla bez povšimnutí?",
      kapitola: n("V&nbsp;analýze: 4 · Láska, přitažlivost a&nbsp;intimita"),
    },
    {
      cislo: "05",
      otazka: n("Kde si rozumíte beze slov, a&nbsp;kde si to jen myslíte?"),
      kapitola: n("V&nbsp;analýze: 5 · Emoce, komunikace a&nbsp;konflikt"),
    },
  ],
};
export const OTEVRENE = nbDeep(OTEVRENE_RAW);

const NABIDKA_RAW = {
  eyebrow: "Hloubková analýza MEZI VÁMI",
  title: n("Všechno, co se sem nevešlo."),
  lead: n(
    "Osobní report pro vás dva, sestavený z&nbsp;vašeho výpočtu: co potřebuje každý z&nbsp;vás a&nbsp;jak spolu fungujete. Do hloubky a&nbsp;s&nbsp;vlastní grafikou.",
  ),
  vyhody: [
    "Osobní PDF pro vás dva",
    "PDF nejpozději do 48 hodin od potvrzené platby. Zabezpečený odkaz ke stažení obdržíte e-mailem; platí 30 dní.",
    "Jednorázově, žádné předplatné",
  ],
  nahledPoznamka: "Náhled stran je ilustrační, finální ukázky budou ze vzorového reportu.",
  nahledOdkaz: "Celý vzorový report (PDF)",
  naduvodce: n("Co v&nbsp;analýze najdete"),
  kapitoly: [
    "Nejdřív to nejdůležitější",
    n("Jak každý z&nbsp;vás funguje ve vztahu"),
    "Pět vztahů uvnitř jednoho",
    n("Láska, přitažlivost a&nbsp;intimita"),
    n("Emoce, komunikace a&nbsp;konflikt"),
    n("Blízkost, svoboda a&nbsp;každodenní fungování"),
    n("Co v&nbsp;sobě probouzíte a&nbsp;co vztah drží pohromadě"),
    "Na doma",
    "Pod kapotou",
  ],
  timeNote: n(
    "Čas narození Jany je přibližný. Části výkladu, které bez přesného času nelze bezpečně určit, vynecháváme i v&nbsp;Hloubkové analýze. Znáte přesný čas?",
  ),
  timeNoteOdkaz: "Upravte ho před objednávkou.",
  cenaLabel: "Pracovní cena prototypu",
  cena: "1 990 Kč",
  cenaPozn: "vč. DPH",
  stitekS1: "Provizorní ukázka – nejde o finální podobu zákaznického reportu.",
  stitekS2: "Vzorový report",
  cta: "Objednat Hloubkovou analýzu",
  paticka: ["Platba kartou", "Prodávající [IČO]", "Obchodní podmínky", "Jak výklad vzniká"],
  uprava: n("Upravit údaje a&nbsp;přepočítat"),
};
export const NABIDKA = nbDeep(NABIDKA_RAW);

/** B-P0 + K-13: „Z čeho analýza vychází“, bezprostředně před tlačítkem objednávky (Copy Studio, doslovně). */
const ZDROJ_ANALYZY_RAW = {
  title: "Z čeho analýza vychází",
  odstavce: [
    "Interpretace vycházejí z astrologického výpočtu podle data a místa narození obou lidí. Čas narození zohledňujeme podle toho, zda a jak přesně je známý.",
    "Neznámý čas nebrání vytvoření plnohodnotné Vztahové DNA. Části výkladu, které bez přesného času nelze bezpečně určit, vynecháváme. Přibližný čas nezaměňujeme za přesný.",
    "Výklad nabízí možné souvislosti k zamyšlení. Zejména u soukromých a citlivých témat nejde o potvrzení skutečných událostí nebo úmyslů druhého člověka. Astrologická interpretace není vědeckým důkazem ani předpovědí.",
    "Hloubka jednotlivých částí závisí na dostupných údajích obou lidí a na znalosti času narození. Zahrnujeme jen to, co lze pro danou dvojici z těchto údajů podložit.",
  ],
};
export const ZDROJ_ANALYZY = nbDeep(ZDROJ_ANALYZY_RAW);

/** V-02: sdílecí karta 9:16 — záměrně jen jména, téma, jeden řádek; bez dat, časů a míst */
const KARTA_RAW = {
  znacka: "MEZI VÁMI",
  eyebrow: "Vztahová DNA",
  title: "Jana & Tomáš",
  tema: PAIR.mainTheme.title,
  veta: PAIR.mainTheme.line,
  jakMiluje: {
    glyph: "♀",
    otazka: "Jak miluje",
    a: { jmeno: "Jana", text: n("něžně, i&nbsp;beze slov") },
    b: { jmeno: "Tomáš", text: "hluboko, nebo vůbec" },
  },
  paticka: "Spočítejte si svou · good-inventions.work/mezi-vami",
};
export const KARTA = nbDeep(KARTA_RAW);
