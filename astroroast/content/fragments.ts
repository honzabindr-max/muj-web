// AstroRoast.ai: knihovna humoru. Ručně psané originální české fragmenty.
//
// Pravidla autora:
// - Žádné šablony se skloňováním: každá věta je hotová (nebo předsklonovaná), takže engine jen vybírá a skládá.
// - Všechny věty v 2. osobě čísla jednotného. Vyhýbáme se rodově označeným tvarům (-l/-la), aby věty
//   seděly komukoli, včetně kamaráda, kterému se roast posílá.
// - Střílíme do stereotypu znamení, nikdy do těla, zdraví, peněz, vyznání, orientace, smrti ani skutečných osob.
// - Úroveň 5 je absurdní a kosmická, nikdy krutá.
//
// Skladba roastu (viz engine/roast.ts):
//   headline = headlines[level]            (tématicky neutrální)
//   lines    = core[level] + 2x topic[band] + kicker (generický, podle tématu a úrovně; u kamaráda friendKickers)
//   stats    = 1 generická podle tématu + 1-2 podle znamení
//   verdict  = verdicts[level]
// band: úrovně 1-3 = "soft", úrovně 4-5 = "hot".

import type { Level, SignId, Topic } from "../types";

type Five<T> = [T, T, T, T, T];

/** Surová, kompaktní podoba dat jednoho znamení (index 0 = úroveň 1). */
interface RawSign {
  /** Headlines: 3 na úroveň. */
  h: Five<string[]>;
  /** Core lines (výchozí věta o znamení): 2 na úroveň. */
  c: Five<string[]>;
  /** Verdikty: 2 na úroveň. */
  v: Five<string[]>;
  /** Témata: [soft, hot], 3 věty v každé skupině. */
  t: Record<Topic, [string[], string[]]>;
  /** Falešné statistiky znamení: 6 kusů [label, value]. */
  s: [string, string][];
  /** Denní jednovětky: 12 kusů (+ headlines úrovní 2-4 = pool >= 20). */
  d: string[];
  /** Odpovědi v páru, pořadí viz COUPLE_SITUATIONS: 6 kusů. */
  q: string[];
}

export interface SignFragments {
  headlines: Record<Level, string[]>;
  core: Record<Level, string[]>;
  verdicts: Record<Level, string[]>;
  topic: Record<Topic, { soft: string[]; hot: string[] }>;
  stats: { label: string; value: string }[];
  daily: string[];
  /** Odpověď znamení na každou situaci z COUPLE_SITUATIONS (stejné pořadí). */
  couple: string[];
}

// ---------------------------------------------------------------------------
// Generické (nezávislé na znamení) vrstvy
// ---------------------------------------------------------------------------

/** Závěrečná věta roastu podle tématu a úrovně (3 na buňku). Platí pro libovolné znamení. */
export const KICKERS: Record<Topic, Five<string[]>> = {
  vztahy: [
    [
      "Kdo tě miluje, bere tě i s tímhle. Je to vlastně docela romantické.",
      "Hvězdy radí: smích v páru je nejlepší horoskop.",
      "Nikdo není dokonalý. Ty aspoň máš po ruce vtipné vysvětlení.",
    ],
    [
      "Tvůj protějšek už to ví. Jen se zdvořile tváří, že ne.",
      "Chodit s tebou je vzrušující. Hlavně ty části, které se nedají naplánovat.",
      "Láska vyhrává. Občas až po prodloužení.",
    ],
    [
      "Jestli tě partner snáší, je to buď láska, nebo mimořádná trpělivost. Hvězdy sázejí na tu druhou.",
      "Romantika s tebou je jako počasí: všichni chodí s deštníkem pro jistotu.",
      "Tvoje vztahy mají šťastný konec. Jen k němu vedou dlouhé reklamní přestávky.",
    ],
    [
      "Jediná stálá věc ve tvých vztazích jsou ty samé hádky s lepším osvětlením.",
      "Nejsi těžký případ. Jsi případ s vlastním spisem a čtyřmi přílohami.",
      "Tvůj protějšek má v telefonu poznámku „co říct, až se bude ptát“. Je dlouhá.",
    ],
    [
      "Venuše svolala mimořádné slyšení. Přišel jen Merkur a omluvil se za všechny.",
      "Kupidovi vrátili šíp s poznámkou „tohle nechceme“ a nabídli mu dovolenou.",
      "Planeta lásky přepnula tvůj spis do režimu „jen pro silné povahy“.",
    ],
  ],
  prace: [
    [
      "Kolegové tě mají rádi. Hlavně v pátek odpoledne, když přineseš dobrou náladu.",
      "Hvězdy shodně tvrdí, že tvoje kariéra má potenciál. A tabulku s potenciálem.",
      "V práci jsi tak trochu hvězda. Jen s menším rozpočtem na osvětlení.",
    ],
    [
      "Tvoje poznámky ze schůzky jsou bohužel poznámky o schůzce o schůzce.",
      "Šéf o tobě mluví s úctou. A trochu i s kalendářem v ruce.",
      "Práci bereš vážně. Jen ji občas bereš tak vážně, že zapomeneš dýchat.",
    ],
    [
      "Tvoje pracovní tempo vzbuzuje zájem hvězd. Zatím ho vedou jako „zajímavý případ“.",
      "Každý den hrdinně bojuješ s e-maily. Ty vyhrávají na body.",
      "Kolegové říkají, že bez tebe by to nešlo. Hvězdy dodávají, že to říkají hlavně tehdy, když něco potřebují.",
    ],
    [
      "Životopis říká „týmový hráč“. Kolegové říkají „týmový hráč, co hraje sám“.",
      "Kolegové ti drží místo na poradě. Ne ze zdvořilosti, ale aby věděli, kam se dívat.",
      "Kolegové na tebe vzpomínají v dobrém. Hlavně v nezodpovězených e-mailech.",
    ],
    [
      "Saturn odvolal veškeré pracovní zakázky pro tvou osobu s odůvodněním „nad rámec tabulky“.",
      "Vesmírná personalistka právě založila složku s tvým jménem. Obsahuje jedinou větu: „Ale má potenciál.“",
      "Merkur ti dnes odmítl poslat e-mail. Prý ho nedokáže doručit bez emocionální újmy.",
    ],
  ],
  zivot: [
    [
      "Život s tebou je jako dobrodružný film. Jen s trochou lepších titulků.",
      "Hvězdy tě mají rády. A to nejsou ani zaměstnanci.",
      "Máš talent na hezké okamžiky. Hlavně na ty, které se potají stanou.",
    ],
    [
      "Tvůj život je zábavný. Trochu jako návod, který se píše při čtení.",
      "Plánuješ pravidelně a dodržuješ to nepravidelně. Vyvážené.",
      "Dnes je dobrý den začít něco nového. Nebo dojet to, co už běží.",
    ],
    [
      "Žiješ svůj nejlepší život. Hvězdy jen doufaly, že bude tišší.",
      "Tvůj život má jasný směr. Jen se mu občas zapomene říct, že je to vlastně jiný směr.",
      "Optimismus ti vydrží. Něco jako baterie v ovladači, který stejně nikdo nenajde.",
    ],
    [
      "Tvoje životní plány jsou jako Wi-Fi: když je potřebuješ, hledáš heslo.",
      "Změna života je na seznamu. Vesmír tvrdí, že mezi rozhodnutím a činem leží čtvrtá dimenze.",
      "Smysl života je podle hvězd 42. Tvůj osobní součet je zatím 17.",
    ],
    [
      "Vesmír roztřídil tvůj život do dvou složek: „Dopadlo to dobře“ a „Zatím to dopadá“.",
      "Černá díra před tebou odmítla vstup. Prý je plná.",
      "Hvězdy zvažují, že tvůj spis vloží do muzea. Pod názvem „Jak se to dělat nemá, ale funguje to“.",
    ],
  ],
  pratele: [
    [
      "Přátele máš skvělé. Hvězdy jim to občas připomínají.",
      "Kamarádi jsou jediní lidé, kteří mají tvé trapasy v archivu a pořád ti píšou.",
      "Přátelství s tebou je jako dobrý seriál: nikdy nevíš, co bude příště, a nikdo nechce skončit.",
    ],
    [
      "Skupinový chat je s tebou zábavnější. Hlavně když ho zrovna nikdo nemá ztlumený.",
      "Kamarádi tě znají. A přesto čekají na další díl.",
      "Přátelé ti odpouštějí. I proto, že nemají na výběr.",
    ],
    [
      "Přátelství s tebou je dobrovolná zkouška trpělivosti. Hvězdy kamarádům přejí hodně štěstí.",
      "Tvoji přátelé tě mají rádi jako dobrý filmový zvrat: když přijde, všichni se zasmějí, a pak se dívají na hodinky.",
      "Říkáš „ozvu se“ tak důvěryhodně, že to začínají brát jako folklor.",
    ],
    [
      "Tvůj nejlepší kamarád zná všechny tvoje příběhy. A i tak se ptá, co bude dál.",
      "Máš skvělé přátele. A pozoruhodné štěstí, že mají radši přátelství než pravdu.",
      "Přátelé tě mají rádi navzdory výsledkům hvězdné analýzy. To je lojalita.",
    ],
    [
      "Skupinový chat s tebou si založil vlastní galaxii. První zpráva zní „viděno“.",
      "Vesmír svolal summit tvých přátel. Jediný bod programu: „Kdy se konečně ozve?“",
      "Na seznamu nejoblíbenějších lidí Mléčné dráhy tě vesmír zapsal do rubriky „vtipné, ale chaotické“.",
    ],
  ],
  narozeniny: [
    [
      "Narozeniny jsou jediné datum, kdy ti hvězdy dovolí cokoli. Hlavně dort.",
      "Dort, svíčky a pár lidí, kteří tě mají rádi. Hvězdy by řekly, že to je celé.",
      "Další oběh kolem Slunce. Hvězdy blahopřejí a nabízejí ještě jedno kolečko.",
    ],
    [
      "Hvězdy ti přejí originální dárek. Ne další ponožky s motivem planety.",
      "Hosté na tvé oslavě budou milí. Aspoň do čtvrté písničky.",
      "Narozeniny jsou skvělá příležitost nechat ostatní, aby tě chvíli zvládali.",
    ],
    [
      "Tvoje narozeninová oslava má jednu velkou přednost: končí v čase, kdy už mají všichni dost.",
      "Hvězdy s tebou slaví. Dort si vzaly na dálku.",
      "Na poděkování za přání se čeká zpravidla do příštího roku. Hvězdy to berou jako tradici.",
    ],
    [
      "Svíčky na dortu si ještě před zapálením žádají pojištění.",
      "Narozeninová píseň zní u tebe jako cvičný poplach: všichni zpívají, nikdo neví, kdy skončit.",
      "Oslava se podařila. Hosté o tom mluví dodnes. Většinou šeptem.",
    ],
    [
      "Vesmír ti pro narozeniny nachystal konfety ze zbytků supernovy. Bohužel se úplně nesnesou s tvým nábytkem.",
      "Saturn ti zaslal přání s razítkem „Do vlastních rukou“. Pošťák utekl.",
      "Hvězdy si pro tebe nechaly vyrobit dort velikosti Měsíce. Svíčky nestačí. Bude potřeba slunce.",
    ],
  ],
};

/** Závěrečné věty pro kamaráda (úrovně 1-3). Posílá je ten, kdo roastuje. */
export const FRIEND_KICKERS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Roast od někoho, komu na tobě záleží, je nejlepší druh roastu. Opravdu.",
    "Kamarádi se roastují s láskou. A s malou dávkou zlomyslné radosti.",
    "Kdo dostane takovou kartu, má v telefonu aspoň jednoho člověka, který ho má rád.",
  ],
  2: [
    "Revanš je na místě. Přátelství se testuje právě takhle.",
    "Kdo roastuje, myslí to dobře. Hvězdy tomu říkají „podmíněná láska“.",
    "Kdo ti tohle poslal, ví o tobě dost, aby měl pravdu. A dost málo, aby ti to neřekl do očí.",
  ],
  3: [
    "Člověk, který má tvoje trapné fotky a přesto zůstal, je opravdový přítel. To je láska.",
    "Odpověď „to nejsem já“ platí jen do chvíle, kdy se ti ozve druhý kamarád a řekne „je to přesně ty“.",
    "Máš tři možnosti: smát se, urazit se, nebo poslat revanš. Hvězdy tipují třetí.",
  ],
};

/** Generické fake statistiky podle tématu (4 na téma). */
export const TOPIC_STATS: Record<Topic, { label: string; value: string }[]> = {
  vztahy: [
    { label: "Hádky o nic důležitého", value: "4× týdně" },
    { label: "Omluv v záloze", value: "3" },
    { label: "Rande bez katastrofy", value: "12 %" },
    { label: "Úspěšnost věty „nic se neděje“", value: "0 %" },
  ],
  prace: [
    { label: "Schůzek, které mohly být e-mail", value: "11 týdně" },
    { label: "Kolegů, kteří odpověděli do deadlinu", value: "38 %" },
    { label: "Káv za pracovní den", value: "4,5" },
    { label: "Věrohodnost věty „dám vám vědět“", value: "2 %" },
  ],
  zivot: [
    { label: "Plánů, které přežily pondělí", value: "1 z 9" },
    { label: "Zpráv „odpovím později“", value: "217" },
    { label: "Nadšení z vlastních nápadů", value: "100 %" },
    { label: "Dnů, kdy vše jde podle plánu", value: "2 ročně" },
  ],
  pratele: [
    { label: "Ztlumených skupinových chatů", value: "9" },
    { label: "Slibů „ozvu se“", value: "40" },
    { label: "Odpovědí od kamarádů do týdne", value: "61 %" },
    { label: "Pozvánek, na které odpovíš „možná“", value: "73 %" },
  ],
  narozeniny: [
    { label: "Dortů přežitých bez fotky", value: "0" },
    { label: "Připomínek v kalendáři", value: "3" },
    { label: "Přání, která ti dorazila včas", value: "22 %" },
    { label: "Svíček sfouknutých na první pokus", value: "1,5" },
  ],
};

// ---------------------------------------------------------------------------
// Pár (Couple Roast / Astro Battle)
// ---------------------------------------------------------------------------

/** Situace, na které odpovídá každé znamení (pořadí = pořadí v RawSign.q). */
export const COUPLE_SITUATIONS: string[] = [
  "Otázka dne: kam půjdeme na večeři?",
  "Další bod programu: jaký bude víkend?",
  "Zpráva přišla v 19:42. Jak zní odpověď?",
  "Ve dřezu čeká nádobí. Kdo ho umyje?",
  "Dovolená se blíží. Kam pojedeme?",
  "Gauč, večer, ovladač. Co pustíme?",
];

export type ElementPairKey =
  | "ohen-ohen" | "ohen-zeme" | "ohen-vzduch" | "ohen-voda"
  | "zeme-zeme" | "zeme-vzduch" | "zeme-voda"
  | "vzduch-vzduch" | "vzduch-voda" | "voda-voda"
  | "stejne";

interface CouplePairContent {
  intros: string[];
  titles: string[];
  verdicts: string[];
}

export const COUPLE_PAIRS: Record<ElementPairKey, CouplePairContent> = {
  "ohen-ohen": {
    intros: [
      "Dva ohně v jedné místnosti. Hasiči jsou na cestě, ale zatím jen natáčejí.",
      "Dva plameny, jedna pec. Kdo se první zeptá, kdo má pravdu, zjistí, že oba.",
    ],
    titles: ["Ohňostroj, který nikdo neobjednal", "Dvě sirky v jedné krabičce"],
    verdicts: [
      "Vztah, který se nikdy nenudí. Hasiči ho mají v oblíbených.",
      "Spálili byste všechno, ale nějak to pořád drží pohromadě.",
    ],
  },
  "ohen-zeme": {
    intros: [
      "Oheň a země: jeden chce jet, druhý chce nejdřív zkontrolovat mapu.",
      "Jedna půlka plánuje, druhá už sedí v autě. Obě tvrdí, že tu druhou pořád čekají.",
    ],
    titles: ["Auto jede, mapa se hádá", "Rychle a důkladně, ale ne najednou"],
    verdicts: [
      "Naučíte se od sebe všechno, hlavně trpělivost. A trochu i rychlost.",
      "Jeden pálí, druhý hasí. Voda by ocenila dovolenou.",
    ],
  },
  "ohen-vzduch": {
    intros: [
      "Oheň a vzduch: jeden zapaluje, druhý do toho fouká. Nikdo se neptá, jestli je to bezpečné.",
      "Vzduch má nápad, oheň má zápalky. Rozpočet zůstal doma.",
    ],
    titles: ["Nápad, který chytil", "Vichřice s ohnivým chvostem"],
    verdicts: [
      "Nikdy se nenudíte. Občas se jen nenajdete.",
      "Skvělý tým, dokud nepřijde věc, která vyžaduje dokončení.",
    ],
  },
  "ohen-voda": {
    intros: [
      "Oheň a voda: jeden zhasíná, druhý vře. Výsledku se říká „pára“.",
      "Jeden chce akci, druhý chce pocit. Oba tvrdí, že mluví o stejné věci.",
    ],
    titles: ["Pára nad hrncem", "Syčení bez konce"],
    verdicts: [
      "Je to vztah s horkými chvílemi a mokrými podlahami.",
      "Z vašich hádek by se dal vařit čaj.",
    ],
  },
  "zeme-zeme": {
    intros: [
      "Dvě země. Všechno je naplánované a stejně se nikdo nechce hýbat.",
      "Dva stabilní lidé, jedna nehybná pohovka.",
    ],
    titles: ["Pohodlí na druhou", "Pevná půda, žádný pohyb"],
    verdicts: [
      "Nejspolehlivější dvojice zvěrokruhu. A nejpomalejší.",
      "Společně dokážete postavit dům. Jednu zeď týdně.",
    ],
  },
  "zeme-vzduch": {
    intros: [
      "Země a vzduch: jeden plánuje, druhý se vznáší nad plánem.",
      "Praktický a nepraktický. Kdo je kdo, se mění podle toho, kdo právě prohrává.",
    ],
    titles: ["Plán se vznáší", "Tabulka v oblacích"],
    verdicts: [
      "Doplňujete se, když se zrovna nehádáte. Hádáte se pořád.",
      "Jeden sní, druhý vyplňuje formuláře. Pak se vymění. Pak se zase vymění.",
    ],
  },
  "zeme-voda": {
    intros: [
      "Země a voda: spolu rostou. Občas to vypadá jako zahrada, občas jako bahno.",
      "Jeden se stará, druhý cítí. Nikdo nikoho nenechá bez polévky.",
    ],
    titles: ["Zahrada s pocity", "Bahno s láskou"],
    verdicts: [
      "Tohle drží. Jenom byste se občas měli bavit.",
      "Voda živí zemi, země drží vodu. Všechno je v pořádku, dokud nezačne pršet.",
    ],
  },
  "vzduch-vzduch": {
    intros: [
      "Dva vzduchy: dvě hlavy plné nápadů a nulová dohoda o tom, kdo uklidí.",
      "Dva lidé, tři rozhovory a žádný z nich se nedokončí.",
    ],
    titles: ["Povídání bez konce", "Dvě hlavy, nulová domluva"],
    verdicts: [
      "Nenudíte se. Zato ani jeden neví, kde jsou klíče.",
      "Mluvíte spolu o všem a o ničem. Většinou současně.",
    ],
  },
  "vzduch-voda": {
    intros: [
      "Vzduch a voda: jeden chce probrat všechno, druhý to chce cítit.",
      "Jeden vysvětluje, druhý chápe. Nikdy ne ve stejném okamžiku.",
    ],
    titles: ["Mlha s nápady", "Bouře ve sklenici vody"],
    verdicts: [
      "Jeden analyzuje, druhý pláče u reklamy. Kosmický úřad to eviduje jako „zajímavý experiment“.",
      "Funguje to, když jeden mlčí a druhý poslouchá. Střídá se to jednou měsíčně.",
    ],
  },
  "voda-voda": {
    intros: [
      "Dvě vody: obě cítí všechno, žádná neumí říct co.",
      "Dva citliví lidé a jedna mlčenlivá hádka, která trvá od úterý.",
    ],
    titles: ["Mlčení s dechem", "Oceán nevyřčených vět"],
    verdicts: [
      "Rozumíte si bez slov. A to je problém, protože slov byste potřebovali víc.",
      "Máte nejhlubší vztah zvěrokruhu. Škoda, že nikdo nevytáhne kotvu.",
    ],
  },
  stejne: {
    intros: [
      "Dvě stejná znamení. Hvězdy to berou jako experiment s kontrolní skupinou.",
      "Dvě zrcadla naproti sobě. Nekonečný tunel stejných zvyků.",
      "Stejné znamení, stejné chyby, dvojnásobné sebevědomí.",
    ],
    titles: ["Zrcadlo se hádá se zrcadlem", "Dvakrát totéž, bohužel obojí"],
    verdicts: [
      "Rozumíte si dokonale. To je přesně ten problém.",
      "Mohli byste si navzájem psát návody. Oba by byly stejné.",
    ],
  },
};

/** Závěr scény podle úrovně páru (1-3), 3 na úroveň. */
export const COUPLE_OUTROS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Hvězdy to shrnují: jste v pohodě. Tomuhle zjištění věnovaly celý kosmický týden.",
    "Závěr kosmické komise: sladké, i když ne vždy bezpečné.",
    "Kosmický zápis: oba vítězí. Remíza byla vyloučena.",
  ],
  2: [
    "Kosmický zápis z jednání: oba vinni, oba milí.",
    "Hvězdy nařizují: večeře, usmíření, žádné další otázky.",
    "Spis uzavřen s poznámkou „zvládnete to, ale rádi se budeme dívat“.",
  ],
  3: [
    "Hvězdy se na vás dívají jako na seriál, který už nejde zrušit.",
    "Verdikt komise: oba obžalovaní jsou stejně nemožní. Přesně proto to funguje.",
    "Zápis: oba prohráli, ale oba si myslí, že vyhráli. To je láska.",
  ],
};

/** Ozvěny pro dvojici stejných znamení: druhý mluvčí neopakuje větu prvního, jen na ni krátce reaguje. */
export const STEJNE_ECHO: string[] = [
  "Tohle se mi honí hlavou taky. Takže vlastně souhlasím se sebou.",
  "Ty to říkáš lépe než já. Což mě vytáčí.",
  "Přesně. A dál? Dál nevím, ty taky ne.",
  "Skvělé. Teď se budeme hádat o tom, kdo to řekl první.",
  "Tak to máme jasno. Jen mi nikdo neřekl, co.",
  "Tak to už jsme dva. Naštěstí se to nedá započítat dvakrát.",
];

/** Základní "kosmická kompatibilita" podle dvojice živlů (obvykle 0-100, vše je samozřejmě vymyšlené). */
export const COMPAT_BASE: Record<ElementPairKey, number> = {
  "ohen-ohen": 62,
  "ohen-zeme": 38,
  "ohen-vzduch": 82,
  "ohen-voda": 32,
  "zeme-zeme": 70,
  "zeme-vzduch": 36,
  "zeme-voda": 78,
  "vzduch-vzduch": 66,
  "vzduch-voda": 34,
  "voda-voda": 74,
  stejne: 55,
};

// ---------------------------------------------------------------------------
// Sestavení veřejné struktury z kompaktních dat znamení
// ---------------------------------------------------------------------------

const LEVELS: Level[] = [1, 2, 3, 4, 5];

function byLevel(five: Five<string[]>): Record<Level, string[]> {
  const out = {} as Record<Level, string[]>;
  LEVELS.forEach((lv, i) => {
    out[lv] = five[i];
  });
  return out;
}

function expand(raw: RawSign): SignFragments {
  const topic = {} as Record<Topic, { soft: string[]; hot: string[] }>;
  (Object.keys(raw.t) as Topic[]).forEach((k) => {
    topic[k] = { soft: raw.t[k][0], hot: raw.t[k][1] };
  });
  return {
    headlines: byLevel(raw.h),
    core: byLevel(raw.c),
    verdicts: byLevel(raw.v),
    topic,
    stats: raw.s.map(([label, value]) => ({ label, value })),
    daily: raw.d,
    couple: raw.q,
  };
}

// ---------------------------------------------------------------------------
// BERAN: motor bez brzdy
// ---------------------------------------------------------------------------
const BERAN: RawSign = {
  h: [
    [
      "Beran: nadšení s nohama. Návod si přečte, až bude hotovo.",
      "Energie ti nechybí. Hvězdy jen řeší, kam ji uložit.",
      "Beran startuje první. V dnešní době je to vlastně hrdinství.",
    ],
    [
      "Slovo „počkej“ je pro Berana jen nezávazný návrh.",
      "Začínáš rychleji, než stihneš říct, co vlastně začínáš.",
      "Tvůj plán má jedinou chybu: mezi nápadem a kopnutím do dveří chybí pauza.",
    ],
    [
      "Máš 14 rozdělaných projektů a pevnou víru, že tenhle bude ten dokončený.",
      "Beran dokončí všechno. Teda všechno, co se dá stihnout do úterý.",
      "Tvoje trpělivost je jako Wi-Fi ve vlaku: teoreticky existuje.",
    ],
    [
      "Táhneš za sebou celý průvod. Jen se nikdy neohlédneš, jestli tě někdo následuje.",
      "Beran nedočte návod. Podle stavu nábytku je to znát.",
      "Tvoje „hned to udělám“ je nejdelší slib ve sluneční soustavě.",
    ],
    [
      "Mars podal výpověď. Prý s tebou nestíhá ani on.",
      "Vesmír tě zařadil mezi věci „spouštět jen pod dozorem“. Dozor si vzal dovolenou.",
      "Tvoje netrpělivost je tak velká, že čas se do fronty ani nepostavil a šel domů.",
    ],
  ],
  c: [
    [
      "Jsi ten člověk, který rozjede každou párty, i když se nikdo neptal, jestli už je párty.",
      "Kdyby nadšení svítilo, Beran by měl vlastní elektrárnu.",
    ],
    [
      "Nadšení ti vydrží první hodinu. Pak přijde další nápad a ten starý dostane padáka.",
      "Sedět klidně pět minut? Tvoje nohy o tom jednají s vedením.",
    ],
    [
      "Tvoje rozhodnutí jsou rychlá, hlasitá a občas i správná. Hvězdy bohužel počítají jen ta třetí.",
      "Pomalé lidi nesnášíš. Většina z nich ale cíl našla, protože si přečetla značku.",
    ],
    [
      "Slovo „kompromis“ bereš jako urážku. Slovo „poslouchej“ jako návrh na zamyšlení.",
      "Tvoje diplomatické schopnosti končí tam, kde začíná tvůj hlas.",
    ],
    [
      "Za tebou stojí řada zdemolovaných plánů, nedodělaných polic a jeden Mars, který žádá o dovolenou.",
      "Kdyby byl vesmír firma, tvoje impulzivnost by byla samostatná položka v rozpočtu na opravy.",
    ],
  ],
  v: [
    [
      "Verdikt: motor světa. Jen občas bez brzdové kapaliny.",
      "Hvězdy radí: dýchej. A hlavně dýchej rychle, ať se to stihne.",
    ],
    [
      "Rada hvězd: zpomal o deset procent. Nikdo si nevšimne, ale okolí vydechne.",
      "Než vyrazíš, najdi aspoň jednu cestu zpátky.",
    ],
    [
      "Verdikt: bez tebe by se nic nezačalo. S tebou by se nic nedokončilo.",
      "Rada: sepiš dokončené věci. Zabere to půl řádku.",
    ],
    [
      "Verdikt: jsi živá spoušť s nadšeným úsměvem.",
      "Rada hvězd: občas počkej na výsledek. Třeba na světelné křižovatce.",
    ],
    [
      "Verdikt vesmíru: zpomal. Tvoje odpověď přišla dřív než otázka.",
      "Rozsudek: trvalá povinnost dočíst aspoň první odstavec návodu.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce jsi jako sprint: rychlý start, silný zápal a pak otázka, kde je vlastně cíl.",
        "Rande plánuješ jako bojovou operaci, jen s menším počtem raket a víc květin.",
        "Svoje city vyznáš dřív, než stihneš zjistit, jak se jmenuje ta restaurace.",
      ],
      [
        "Tvoje vztahy mají dva režimy: „Zbožňuju tě“ a „Proč nic neříkáš“. Mezi nimi není ani pauza.",
        "Vyhrát hádku je pro tebe důležitější než ji dotáhnout do konce. Většinou dosáhneš obojího a zůstaneš s výhrou o samotě.",
        "Randíš jako jízda na letních gumách v zimě: hlasitě, rychle a s hrozícím koncem v příkopu.",
      ],
    ],
    prace: [
      [
        "V práci máš energii za čtyři. Bohužel jen na prvních patnáct minut zadání.",
        "Porada s tebou probíhá takhle: nápad, nadšení, kolega zvedne obočí a ty už stavíš prototyp.",
        "Deadliny miluješ. Hlavně ty, co se blíží. Ty vzdálené bereš jako legendu.",
      ],
      [
        "Do práce chodíš jako do závodu. Kolegové z toho mají únavu a ty medaili, kterou si vyvěsíš na zeď.",
        "V e-mailu čeká 312 nepřečtených zpráv a ty máš pocit, že všechno stihneš. Obojí je omyl.",
        "Tvoje „bude to hotové za chvilku“ je důvod, proč kolegové počítají chvilku v týdnech.",
      ],
    ],
    zivot: [
      [
        "Život bereš jako závod, jen ti pořád zapomínají říct, kdy je cíl.",
        "Ráno máš tři plány. Večer víš o jednom a ten není tvůj.",
        "Den ti začíná v rychlostním pruhu a končí otázkou, kam zmizely klíče.",
      ],
      [
        "Na tvoje životní rozhodnutí by patřila cedule: „Pozor, vyskočí z ničeho.“",
        "Většinu věcí řešíš tak, že nejdřív kopneš a pak se ptáš, co to bylo. Stůl to ví.",
        "Odpočinek máš nastavený na dvacet sekund. Pak ti zavolá další nápad a ty zase mizíš.",
      ],
    ],
    pratele: [
      [
        "Kamarádi tě milují. Zvlášť v okamžiku, kdy nikdo nemá chuť nic plánovat a ty už zamlouváš stůl.",
        "Jsi ten typ, který ve čtvrtek večer napíše: „Zítra jedeme na hory.“ A ono se to stane.",
        "Když se někdo zeptá, kdo to zařídí, ty už máš půlku hotovou. A ta půlka je špatně.",
      ],
      [
        "Tvoji přátelé mají skupinový chat „Berane, zpomal“. Je ztlumený. Pro jistotu.",
        "Se stolní hrou s tebou končí všechno stejně: výhra, sporná pravidla a nová hra, kde pravidla už nejsou.",
        "Když přátelé řeknou „ještě chvíli počkáme“, ty už stojíš u dveří a děláš ten výraz.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny slavíš jako olympiádu: s nadšením, hlukem a nevyřešenými spory o pravidlech.",
        "Dort sfoukneš takovou silou, že se svíčky předem omlouvají.",
        "Přání dostaneš od všech. Poděkuješ do tří dnů. Hvězdy počítají s tolerancí.",
      ],
      [
        "Tvoje „malá oslava“ končí tak, že sousedi znají text písně líp než ty.",
        "Nedočkavost tě prozradí: dárek, který chceš dát, předáš o týden dřív. Všem.",
        "Slavíš tak dlouho, že kalendář musí otevřít další sloupec. A ten se mu nelíbí.",
      ],
    ],
  },
  s: [
    ["Doběhnutých projektů", "3 %"],
    ["Čekání ve frontě bez nadávání", "11 s"],
    ["Nápadů před snídaní", "7"],
    ["Pokusů o „zvládnu to rychleji“", "100 %"],
    ["Kompromisů dnes", "0"],
    ["Reakcí na pomalý internet", "9 denně"],
  ],
  d: [
    "Dnes tě bude něco zdržovat. Reaguj klidně. Hvězdy se dívají s popcornem.",
    "Dnes ti někdo řekne „počkej“. Vydržíš čtyři sekundy. Nový osobní rekord.",
    "Dnes začneš tři věci a dokončíš jednu. Ta jedna bude oběd.",
    "Kávu dnes dopiješ rychleji, než přijde první e-mail. Zbytek dne je zrcadlový obraz.",
    "Dnes budeš mít pravdu. Jen v nesprávném pořadí a hlasitěji, než je zdrávo.",
    "Dnes se ti bude zdát, že všichni jedou pomalu. Zkus nakouknout do zrcátka.",
    "Mars ti dnes posílá energii. Hvězdy ji zadržují, aby se hodila i příští týden.",
    "Dnešní tip: zkus nejdřív dočíst větu. Pak ji můžeš rozdělat.",
    "Dnes tě čeká dilema: rychle, nebo hned. Hvězdy tipují obojí současně.",
    "Dnes se ti povede něco, co nikdo nečekal. Hlavně ty ne.",
    "V poledne ti dojde, že snídaně i oběd se dnes neuskutečnily. Mars je hrdý.",
    "Dnešní varování: pomalá fronta se nedá urychlit zvýšeným hlasem. Hvězdy to už zkoušely.",
  ],
  q: [
    "Stůl je zamluvený. Mnou. Před pěti minutami. Jdeme.",
    "Sobotní plán: kolo, hory, skok z čehokoli. Spaní je v neděli. Možná.",
    "Odpověď letí dřív, než dočtu otázku. Překlepy jsou součástí stylu.",
    "Kdo ho umyje první, vyhrává. Startuju. Ty už prohráváš.",
    "Kamkoli, co odjíždí dnes večer. Sbal se za deset minut.",
    "Něco s výbuchy. Úvod přeskočíme, ten nikdo nepotřebuje.",
  ],
};

// ---------------------------------------------------------------------------
// BÝK: pohodlí jako životní filozofie
// ---------------------------------------------------------------------------
const BYK: RawSign = {
  h: [
    [
      "Býk: spolehlivý jako gauč a stejně těžko se z něj vstává.",
      "Býk ví, co chce. Většinou je to oběd a klid.",
      "Jsi pevný bod ve vesmíru. Hvězdy se o tebe občas opřou.",
    ],
    [
      "Změna je pro Býka slovo, které se píše kurzívou a čte se opatrně.",
      "Býk se nehne, dokud není jídlo na stole nebo důvod, který je lepší než gauč.",
      "Tvoje rutina je tak pevná, že kalendář kontroluje tebe.",
    ],
    [
      "Býk není tvrdohlavý. Jen má pravdu dřív, než ostatní vůbec začnou mluvit.",
      "Tvoje „ještě o tom popřemýšlím“ znamená „ne“ s měsíčním zpožděním.",
      "Máš oblíbenou židli, oblíbenou restauraci a oblíbený názor. Pořadí není náhodné.",
    ],
    [
      "Kdyby tvrdohlavost byla sport, získáš zlato. Na stupně vítězů se ale odmítneš postavit.",
      "Doma máš tak pevné pořádky, že se nábytek bojí přesunout sám od sebe.",
      "Býk není pomalý. Jen šetří energii na to nejdůležitější: oběd.",
    ],
    [
      "Venuše tě prohlásila za „nehybnou památku“. Magistrát už plánuje kolem tebe parkoviště.",
      "Vesmír se pokusil tě posunout o jeden metr. Zabralo to tři supernovy a nový plán.",
      "Tvůj gauč už má vlastní gravitaci. Planety se kolem něj stáčejí a odmítají přistát.",
    ],
  ],
  c: [
    [
      "Umíš si užívat život. Hvězdy to obdivují a tajně ti závidí tu polévku.",
      "S tebou je klid. Jako s dobrou dekou, jen s názory.",
    ],
    [
      "Rozhodnutí děláš pomalu a jistě. Hlavně pomalu. A hlavně se jim nechceš vystavovat.",
      "Jídlo je pro tebe jazyk lásky. A taky plán na zbytek dne.",
    ],
    [
      "Změny ti vadí jako špatná kvalita kávy: nic dramatického, ale celý den z toho máš pachuť.",
      "Tvrdíš, že tvrdohlavost není tvoje silná stránka. Tvoje obočí se k tomu nepřipojilo.",
    ],
    [
      "Jsi jediný člověk, který dokáže stát na místě a přitom říkat „já jsem už na cestě“.",
      "Víc než názory miluješ jen jednu věc: nenechat si je vyvrátit.",
    ],
    [
      "Pozice: pevně zakořeněný. Výsledek: planeta se kolem tebe musela přeskupit.",
      "Vesmír tě chtěl přeprogramovat. Server vrátil chybu: „Odmítá aktualizaci. Tvrdí, že mu to tak vyhovuje.“",
    ],
  ],
  v: [
    [
      "Verdikt: pevný jako skála, hřejivý jako polévka.",
      "Hvězdy radí: dopřej si. Večer už stejně čeká v plánu.",
    ],
    [
      "Rada hvězd: občas ochutnej něco nového. Nemusí to být hned zítra, stačí do příštího roku.",
      "Verdikt: spolehlivý a pohodlný. Dobrá kombinace, kdyby nebyla na jednom místě.",
    ],
    [
      "Verdikt: vydržíš všechno, kromě změny restaurace.",
      "Rada: příště zkus začít větu slovem „ano“ a uvidíš, jestli se země otřese.",
    ],
    [
      "Verdikt: jsi pevná půda. Škoda, že se po ní nikdo nemůže hýbat.",
      "Rada hvězd: pohyb nezabolí. Poslechni si to od někoho, kdo se pohybuje.",
    ],
    [
      "Verdikt vesmíru: odmítnuto. Žádost o změnu byla zamítnuta ještě před odesláním.",
      "Rozsudek: trvalý nárok na gauč a veto proti překvapením.",
    ],
  ],
  t: {
    vztahy: [
      [
        "Ve vztahu jsi stálost sama: jako oblíbený hrnek. Pořád stejný, pořád hřeje.",
        "Romantická večeře u tebe znamená oblíbený podnik, oblíbené jídlo a bezpečný rozpočet na dezert.",
        "Láska se u tebe projevuje jídlem. „Miluju tě“ zní jako „Dáš si ještě?“",
      ],
      [
        "Hádky s tebou jsou jako zeď. Dá se opřít, dá se obejít, ale přes ni nikdo nejde.",
        "Když se rozzlobíš, nezvýšíš hlas. Jen se posadíš a po hodině oznámíš, že jsi stále na stejném názoru.",
        "Tvůj partner se naučil rozpoznávat tři fáze: „Nic mi není“, „Nic mi není, říkám“ a „Opravdu mi nic není“.",
      ],
    ],
    prace: [
      [
        "V práci jsi jistota. Něco jako výtah: vždycky tam, vždycky pomalu, vždycky vyjede.",
        "Úkoly plníš důkladně a v klidu. Termíny si o tobě povídají jako o legendě z vedlejší budovy.",
        "Máš v práci židli, hrnek a rituál. Kdo se dotkne jednoho, ten se nedotkne dalších dvou.",
      ],
      [
        "Změnu procesu v práci vítáš zhruba jako změnu pozice v tvém oblíbeném křesle: hlasitým mlčením.",
        "Kolegové vědí, že tvoje „zvážím to“ znamená „ne“. Prostě tomu říkají „až po obědě“.",
        "Na poradě na tebe nikdo nevolá, protože už se ví, co řekneš. A taky že ještě půjdeš na oběd.",
      ],
    ],
    zivot: [
      [
        "Život ti nejlíp vychází s plánem na příští den: oběd, gauč a ještě jeden oběd.",
        "Máš dar oceňovat maličkosti. Hlavně ty, které se dají sníst nebo si na nich pohodlně sednout.",
        "Tvůj dům je dokonale zařízený. Včetně místa, odkud se ti nikdy nebude chtít odejít.",
      ],
      [
        "Překvapení u tebe končí tak, že se potichu posadíš a čekáš, až se vrátí rovnováha.",
        "Rutina je tvoje druhé já. Říkáš tomu „zvyk“, hvězdy tomu říkají „oběžná dráha“.",
        "Spontánní víkend v tvém podání: stejné jídlo, jiná židle, nová nálada. Skoro dobrodružství.",
      ],
    ],
    pratele: [
      [
        "Na tebe se dá spolehnout vždycky. Jen se k tobě musí přijet, protože ty se nehneš.",
        "Na tvých večírcích je vždycky dost jídla. Nikdo neodejde hladový, všichni ale odejdou s tvým názorem.",
        "Když se kamarádi ptají, kam půjdeme, ty vždycky víš: „Tam, kde jsme byli minule.“",
      ],
      [
        "Tvoji přátelé vědí, že plán s tebou funguje takhle: vybereš restauraci, zamítneš tři návrhy a ocitnete se u té první.",
        "Když chtějí kamarádi zkusit něco nového, ty zvedneš obočí. Nové chutě se pak ochutnávají jen na tvůj souhlas.",
        "Přátelství máš trvalé. Kdo se jednou dostal do tvé paměti, ten tam zůstane. I s tím, kolik si dal na oběd.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny vnímáš hlavně jako dort. A když ho není dost, jako důvod k hlubokému uvažování.",
        "Přání, která dostaneš, třídíš podle chuti. U toho s koláčem se zdržíš nejdéle.",
        "Nechceš překvapení. Chceš oblíbený dort, oblíbené lidi a jednu vodu bez bublinek.",
      ],
      [
        "Tvoje oslava má pevný scénář. Kdo ho změní, ten se dozví, co znamená „výraz Býka“.",
        "Dárky otevíráš pomalu a s úctou. Papír se skládá a ukládá pro příště. Papír už má vlastní složku.",
        "Hosté odcházejí sytí a s pocitem, že absolvovali zkoušku z trpělivosti.",
      ],
    ],
  },
  s: [
    ["Míst na gauči, odkud se nehýbáš", "1"],
    ["Změn za poslední rok", "0,5"],
    ["Nových jídel, která zkusíš", "7"],
    ["Ústupků při hádce", "2 %"],
    ["Slov „ještě chvilku“ denně", "14"],
    ["Odolnosti vůči novinkám", "98 %"],
  ],
  d: [
    "Dnes tě čeká vydatný oběd a pevné rozhodnutí. Jistý je jen ten oběd.",
    "Dnes tě někdo požádá o změnu plánu. Hvězdy doporučují rozhodnout se do příštího čtvrtka.",
    "Dnešní horoskop: zůstaň tam, kde jsi. Jistě tam bude i jídlo.",
    "Dnes ti někdo popletl objednávku. Tvoje obočí to řeší za tebe.",
    "Dnes ti Venuše přeje klid, polštář a jedno spokojené povzdechnutí.",
    "Dnes se rozhodneš něco změnit. Zítra se rozhodneš to vrátit.",
    "Dnešní konstelace: gauč v trigonu s lednicí. Zbytek vesmíru je okrajový.",
    "Tvoje tvrdohlavost dnes naroste o 4 % oproti včerejšku. Hvězdy nabízejí pochopení, ne slevu.",
    "Dnes se ti poštěstí vyhrát debatu tím, že dotyčný odejde jíst.",
    "Dnes ti pošle vesmír malé překvapení. Zkontroluješ ho třikrát a pak ho nezkusíš.",
    "Dnes se tvůj plán nehne. Svět se přizpůsobí kolem něj.",
    "Dnešní tip: oblíbenou restauraci nemusíš zdůvodňovat. Stačí kývnout a vstoupit.",
  ],
  q: [
    "Tam, kde jsme byli minule. A kde jsme byli předminule. Máš vlastní stůl.",
    "Víkend? Gauč, jídlo, seriál. A pokud bude chvilka navíc, tak taky gauč.",
    "Odpovím zítra. Ráno. Po snídani. Možná po obědě. Nespěchej.",
    "Umyju ho. Za chvíli. Jen se dojím a rozmyslím, jestli to opravdu musí být dnes.",
    "Tam, kde je dobré jídlo a stejná postel jako doma. Takže domů.",
    "To, co jsme viděli minule. Zápletku znám, ale přijde mi to uklidňující.",
  ],
};

// ---------------------------------------------------------------------------
// BLÍŽENCI: dvě hlavy, jedna rozdělaná věta
// ---------------------------------------------------------------------------
const BLIZENCI: RawSign = {
  h: [
    [
      "Blíženci: dva rozhovory zároveň, tři nápady a pořád o tom vtipně.",
      "Blíženci umějí mluvit s každým. A hlavně s každým o něčem jiném.",
      "Máš charisma a čtrnáct otevřených záložek. Hvězdy to berou jako dar.",
    ],
    [
      "Blíženci mají osobnost na večírek a druhou na pondělí. Obě slibují, že se to nestane.",
      "Tvrdíš, že zůstáváš v klidu. Pozor, to říká jen jedna z tebe. Ta druhá už zvedá hlas.",
      "Tvoje věty začínají hlasitě a končí někde v jiném tématu.",
    ],
    [
      "Máš názor na všechno. Jen se mění rychleji, než stihneš dokončit první větu.",
      "Blíženci nelžou. Jen říkají obě pravdy po sobě.",
      "Tvoje pozornost se pohybuje rychlostí světla. Stejně často se ztrácí.",
    ],
    [
      "Jsi člověk, který nedokončí vě… ale to je jedno. Hvězdy už to dávno vzdaly.",
      "Dvě osobnosti, jedno rozhodnutí. A jeden z vás je vždycky proti.",
      "Názory střídáš rychleji než ponožky. A každý prosazuješ stejně hlasitě.",
    ],
    [
      "Merkur ti podal výpověď, odvolal ji, podal znovu a nakonec se přestěhoval.",
      "Vesmír tě rozdělil na dvě osobnosti. Obě se hned pohádaly, která z nich je ta původní.",
      "Pozornost ti utekla na Jupiter. Požádala o azyl a trvá na tom, že zůstane.",
    ],
  ],
  c: [
    [
      "Umíš zabavit každého, včetně sebe, a to je u lidí vzácné.",
      "Mluvíš s lehkostí. Hvězdy by si přály, aby jim někdo předal aspoň třetinu zápisu.",
    ],
    [
      "Nudíš se rychleji, než se stihneš zeptat, jestli se nudíš. A pak se nudíš i z té otázky.",
      "Zvědavost je tvoje superschopnost. Dokončování je tvůj kryptonit.",
    ],
    [
      "Máš na všechno názor. Zítra budeš mít na všechno názor opačný. A budeš ho hájit stejně vášnivě.",
      "Mezi „hned to dodělám“ a „to nebylo domluvené“ uběhne u tebe jedna zpráva.",
    ],
    [
      "Umíš si domluvit schůzku tak, že se těší obě tvoje osobnosti a nepřijde ani jedna.",
      "Slibuješ tak hladce, že se k tomu slibu nikdo nemůže přiznat. Včetně tebe.",
    ],
    [
      "Obě tvoje osobnosti byly předvolány před hvězdný soud. Žádná se nedostavila, protože každá myslela, že ta druhá už jde.",
      "Tvůj kalendář má dvojí účetnictví. Obě verze jsou stejně nespolehlivé.",
    ],
  ],
  v: [
    [
      "Verdikt: dvakrát tolik zábavy, poloviční tolik dokončených vět.",
      "Hvězdy radí: napiš si, co chceš říct. Pak to přečti. Pak změň názor. Je to v pořádku.",
    ],
    [
      "Rada hvězd: dokonči jednu věc, než zavřeš dalších čtrnáct záložek.",
      "Verdikt: zajímavý společník. Jen jeden z vás je vždycky zrovna pryč.",
    ],
    [
      "Verdikt: tvoje schopnost mluvit je skvělá. Škoda, že její projevy občas míří jinam než k bodu.",
      "Rada: až si příště budeš chtít něco přiznat, zkus to přednést oběma osobnostem najednou.",
    ],
    [
      "Verdikt: jsi duo, které se nikdy nedomluví, a přesto vyhraje debatu.",
      "Rada hvězd: když se zeptají, co chceš, odpověz jednou větou. Té druhé ještě nevěř.",
    ],
    [
      "Verdikt vesmíru: dvojí rozsudek, dvojí odvolání, nulové dokončení.",
      "Rozsudek: příště zkus mluvit pomalu. Hvězdy tvrdí, že to nikdy nikdo nezkusil.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce umíš zaujmout. Jen se nikdy neví, která z tvých osobností právě přichází na rande.",
        "Tvůj protějšek se nikdy nenudí. Spíš se ptá, jestli už se nepřihlásil někdo úplně jiný.",
        "Flirtovat umíš skvěle. Dokonce i s tím, kdo si myslí, že mluví s někým jiným.",
      ],
      [
        "Slíbíš v pondělí spolehlivost. V úterý tvrdíš, že šlo o nadsázku. Ve středu to slíbíš znovu, lépe napsané.",
        "Každé tvoje „musíme si promluvit“ trvá tři hodiny a zahrnuje čtyři témata, z nichž žádné není to původní.",
        "Tvůj partner si v telefonu vede seznam, kdo z vás dnes mluví. A hlavně od kdy.",
      ],
    ],
    prace: [
      [
        "V práci umíš dělat čtyři věci najednou. Dvě z nich dobře, jedna aspoň vtipně, jedna zatím nikdo neví.",
        "Na poradě přispíš nápadem, který o dvě minuty později vyvrátíš vlastním lepším nápadem.",
        "Tvůj e-mail začíná „Ahoj“ a končí v jiném tématu. Mezi tím se děje magie.",
      ],
      [
        "Pracuješ na dvanácti projektech. Dokončeno: nula. Uvolněno: osm. Zbytek leží v záložkách.",
        "Úkoly plníš jako Blíženec: rychle začneš, hned pochopíš, že je to nuda, a zavoláš kolegovi, aby pomohl.",
        "Kolegové tě milují, protože nikdy nevědí, jaký den právě začíná. Šéf už to vzdal.",
      ],
    ],
    zivot: [
      [
        "Život ti připadá jako buffet. Bereš trochu od všeho a pak pár věcí necháš nedojedených.",
        "Máš tolik zájmů, že se stihneš nudit i ve chvíli, kdy tě něco opravdu baví.",
        "Dokážeš odpovědět na jakoukoli otázku. Občas dokonce té, kterou ti někdo položil.",
      ],
      [
        "Tvůj život je jako přehrávač v režimu náhodného výběru. Zábava velká, kontinuita malá.",
        "Rozhodnutí děláš dvakrát: jednou rychle a jednou důkladně. Oba výsledky jsou naprosto jiné.",
        "Tvoje paměť je výběrová. Pamatuje si, co ti někdo řekl před pěti lety, ale ne, kde jsou klíče.",
      ],
    ],
    pratele: [
      [
        "Jsi ten kamarád, který zná každého a každému řekne něco jiného. Všichni tě mají rádi.",
        "S tebou se vždycky něco děje. Většinou víc věcí najednou, často v různých městech.",
        "Skupinový chat je tvůj domov. Odpovídáš na pět konverzací zároveň a ve všech se ptáš, o čem je řeč.",
      ],
      [
        "Přátelé si u tebe nikdy nejsou jistí, kdo přijde. Radši si proto berou dva různé dárky.",
        "Řekneš „už jedu“ a přitom ještě rozhoduješ, jestli vůbec přijedeš. Dvakrát.",
        "Máš v telefonu tolik rozdělaných konverzací, že kamarádi mají strach ptát se na tu první.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny slavíš na třech místech a s různými lidmi. Všichni věří, že jsou ti nejbližší.",
        "Dort ti chutná, dokud nenajdeš další dort. Pak se tvoje oslava přestěhuje.",
        "Přání ti přijdou rychle a z každého uděláš historku. Pokaždé trochu jinou.",
      ],
      [
        "Narozeninové plány měníš tak často, že pozvaní hosté chodí s dvěma dárky a plánem B.",
        "Píšeš poděkování tak dlouho, až se z něj stane zpráva o něčem jiném.",
        "Jedna oslava ti nestačí. Chceš dvě, každou s jiným programem, a obě zároveň.",
      ],
    ],
  },
  s: [
    ["Otevřených záložek", "47"],
    ["Dokončených vět", "61 %"],
    ["Názorů před obědem", "4"],
    ["Osobností, které dnes dorazí", "2 (možná 3)"],
    ["Rozdělaných konverzací", "12"],
    ["Slibů, že tentokrát to dokončíš", "9"],
  ],
  d: [
    "Dnes budeš mít dva názory na jednu věc. Oba budeš vášnivě obhajovat. Ve stejný den.",
    "Dnes se ti podaří dokončit jednu větu. Je to pokrok století.",
    "Merkur dnes říká: napiš tu zprávu hned. A pak ji pošli jinému člověku.",
    "Dnes ti někdo položí otázku. Odpovíš na třetí věc, která se kolem toho stala.",
    "Dnešní horoskop se rozdvojil. Oba platí, jen každý v jiný den.",
    "Dnes tě něco zaujme tak, že na to zapomeneš dřív, než dojde na druhé.",
    "Dnes se ti zdá, že už to mělo být hotovo. Nebylo. Ani nezačalo. Ale máš o tom skvělou historku.",
    "Dnes se stane něco zajímavého. Jen to nevíš, protože už otevíráš další záložku.",
    "Dnešní tip: v poledne zavři alespoň tři okna. Nepomůže to, ale bude se ti dýchat lépe.",
    "Dnes budeš mluvit o tom, co se ti stalo. Pak o tom, co se nestalo. Pak o tom, co se stane.",
    "Dnes tě čeká důležité rozhodnutí. Dvě verze tebe se zatím neshodly na tom, která z nich ho dělá.",
    "Dnes budeš pozorně poslouchat. Aspoň do chvíle, než tě něco rozptýlí. Chvíle začíná… teď.",
  ],
  q: [
    "Co kdybychom šli na tři místa? Chvíli tam, chvíli tam. Hlavně nic neříkej, ještě mě napadá čtvrté.",
    "Mám plán. A taky druhý plán. A třetí, který vznikne, až si povíme o prvních dvou.",
    "Odpovím! Jen dopíšu zprávu někomu jinému. A pak ještě jednu. Hned jsem tam.",
    "Já umývám, ty utíráš. Počkej, ne, já utírám. Mimochodem, víš, že chobotnice mají tři srdce?",
    "Cestovat? Ano! Kam? To záleží na tom, co si přečtu zítra. Dnešní nápad už stejně vyprchává.",
    "Něco… počkej, než si vyberu. Ne, tohle ne. Tohle ano. Vlastně ne. Takže?",
  ],
};

// ---------------------------------------------------------------------------
// RAK: skořápka s pocity a archivem nostalgie
// ---------------------------------------------------------------------------
const RAK: RawSign = {
  h: [
    [
      "Rak: hřeje jako domov a pamatuje si, kdo mu před třemi lety nenabídl druhý kus bábovky.",
      "Rak se o všechny stará. Jen nikdo neví, kdo se stará o Raka. Odpověď: bábovka.",
      "Máš srdce velikosti oceánu a skořápku velikosti dobře zabaleného pokoje.",
    ],
    [
      "Rak chodí bokem. Úhlem pohledu, nikoli doslovně. Většinou doslovně taky.",
      "Nálady ti přicházejí jako příliv. Hvězdy se musejí řídit přílivovými tabulkami.",
      "Tvoje „nic se neděje“ je zpráva s vysokou naléhavostí a třemi vykřičníky v duchu.",
    ],
    [
      "Rak nezapomíná. Hlavně nic, co mu kdy někdo řekl o víkendu v roce 2018.",
      "Domov je pro tebe nejlepší místo na světě. A taky jediné, kde se můžeš v klidu urazit.",
      "Tvoje pasivní agrese má vlastní pracovní dobu, přesčasy a víkendové příplatky.",
    ],
    [
      "Rak se ráno urazí, v poledne obrní a večer pošle tři hlasovky, že je v pořádku.",
      "Tvůj emoční archiv by se dal vystavovat. Prohlídka by trvala roky.",
      "Skořápka je tak silná, že uvnitř neslyšíš ani vlastní „nic se neděje“.",
    ],
    [
      "Měsíc tě vyhlásil za „nejnáladovějšího zástupce“. Soupeřit s tebou nikdo nechce.",
      "Vesmír tě shrnul jedním slovem: „příliv“. Zbytek je omluvný dopis.",
      "Tvoje citlivost je tak velká, že oceány o ní vědí a píšou si poznámky.",
    ],
  ],
  c: [
    [
      "Umíš vytvořit domov i v prázdném pokoji. Stačí hrnek, deka a dostatečné množství pocitů.",
      "Tvoje „bylo ti dnes dobře?“ znamená „mám o tebe strach“. A „dáš si polévku?“ znamená „miluju tě“.",
    ],
    [
      "Rak si pamatuje všechno: narozeniny, oblíbené jídlo i to, jak se kdosi tvářil před pěti lety.",
      "Citlivost je tvoje superschopnost. Hlavně se zapíná i bez objednávky.",
    ],
    [
      "Tvoje nálada se mění rychleji než předpověď počasí. A hlavně s menší přesností.",
      "Slovo „fajn“ u tebe znamená minimálně tři odstavce, které si přečtou jen ti nejbližší.",
    ],
    [
      "Žádný archiv nemá tak dlouhou paměť na drobnosti jako ty. Soudní stenografové o tebe stojí.",
      "Když se urazíš, dokážeš to dělat ve čtyřech jazycích: tichem, vzdechem, pohledem a hlasitým umýváním nádobí.",
    ],
    [
      "Tvoje paměť na křivdy je tak dlouhá, že ji vesmír zapsal do hvězdné knihy rekordů. Pod „nepřekonatelné“.",
      "Mořský příliv se rozhodl koordinovat s tvou náladou. Pláže ti tím pádem vyhlásily výjimečný stav.",
    ],
  ],
  v: [
    [
      "Verdikt: jsi nejlepší domov, jaký může člověk potkat. Jen občas s deštěm.",
      "Hvězdy radí: dopřej si klid. A kdyby se nedařilo, nech si udělat polévku.",
    ],
    [
      "Rada hvězd: řekni nahlas, co cítíš. Nemusí to být celé. Stačí první čtvrtina.",
      "Verdikt: tvoje citlivost je dar. Jen ji občas zapomeň doma, když jdeš na poradu.",
    ],
    [
      "Verdikt: s tebou se nikdo nenudí, protože nikdo neví, jaká nálada právě přijde.",
      "Rada: napiš seznam, co tě urazilo. A druhý, co ti udělalo radost. Ten druhý bude delší, jen se hůř čte nahlas.",
    ],
    [
      "Verdikt: jsi spíš archiv než člověk. Zkus občas něco vyhodit.",
      "Rada hvězd: až se příště urazíš, napiš to na papír. Papír zatím nikoho nepřekvapil.",
    ],
    [
      "Verdikt vesmíru: pocity přijaty, zpracovány, archivovány. Zatím nevyřízeno.",
      "Rozsudek: povinná dovolená pro tvoje emoce. Doporučený cíl: pláž bez Měsíce.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce se staráš tak, že partner dostane polévku dřív, než stihne říct, že mu něco je.",
        "Tvoje láska je jako pevný dům: dává přístřeší, teplo a pocit, že nikdo neunikne ani na dvě hodiny bez zprávy.",
        "Romantiku zvládneš i uprostřed pondělka. Stačí svíčka a rozdělaná bábovka.",
      ],
      [
        "Když se urazíš, partner to pozná podle klapání nádobí. Nikdy ne podle slov.",
        "Nejsilnější věta tvých hádek je „vždyť se nic neděje“. Obsahuje dvacet odstavců a všechny jsou o partnerovi.",
        "Tvůj partner ví, že „nechci o tom mluvit“ znamená „zeptej se ještě dvakrát, ale citlivě“.",
      ],
    ],
    prace: [
      [
        "V práci jsi srdce týmu. Přineseš dort, zapamatuješ si narozeniny a ví o tom celé patro.",
        "Kolegové za tebou chodí pro radu. Důvěřují ti jako domácímu léku.",
        "Tvoje pracovní místo vypadá jako malý domov: rostlina, hrnek, fotka a deka pro nouzové případy.",
      ],
      [
        "Kritika od šéfa se u tebe vstřebává tři dny. První den jako šok, druhý jako urážka, třetí jako dort.",
        "Na poradě nic neřekneš, protože se bojíš, že někoho zraníš. Po poradě pošleš čtyři e-maily.",
        "Do práce chodíš s emocemi. Šéf musí mít v rozpisu rubriku „Rak: citová bouře, sazba A“.",
      ],
    ],
    zivot: [
      [
        "Život u tebe voní po domácí polévce. A po ní si dáš ještě jednu, protože to bylo skvělé.",
        "Máš v sobě zvláštní kouzlo domova. Kamkoli přijdeš, za hodinu tam stojí kuchyň a deka.",
        "Tvoje vzpomínky jsou uloženy v pěti krabicích, které nikomu nedovolíš otevřít. Hvězdy se neptají.",
      ],
      [
        "Plánovat změnu je pro tebe jako stěhovat pevný hrad do nafukovacího člunu.",
        "Máš pocit, že když se něco změní, tak se rozpadne celá planeta. A většinou zrovna ta tvoje.",
        "Ve tvém životě je jen jedna jistota: ať už se děje cokoli, tak v lednici je něco k jídlu.",
      ],
    ],
    pratele: [
      [
        "Pamatuješ si, co kdo má rád. Máš v hlavě tabulku s výběrem dortů pro celý okruh.",
        "Přátelé za tebou chodí s problémy a odcházejí s polévkou. Problémy zůstávají, polévka je dobrá.",
        "Když ti někdo napíše „jak se máš“, odpovíš odstavcem. Pak druhým. Pak polévkou.",
      ],
      [
        "Přátelé vědí, že tvoje „nic“ znamená „všechno“. Nikdo se neodváží zeptat jinak než přes hrnek čaje.",
        "Když tě někdo zraní, nic neřekneš. Zapíše se to do archivu na deset let.",
        "Zorganizuješ oslavu a pak se urazíš, že nikdo nepoděkoval dostatečně hlasitě. Hodinu po začátku.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny berou lidé jako oslavu. Ty jako pečlivě zpracovaný emoční projekt s dortem na konci.",
        "Nejvíc ti dělají radost drobné věci: ruční kartička, upečený koláč, zpráva od někoho, kdo si vzpomněl.",
        "Tvoje oslava je domácí, hřejivá a plná fotografií. Hosté odcházejí s krabičkou koláčů a záchvatem dojetí.",
      ],
      [
        "Když ti někdo zapomene popřát, nic neřekneš. Zapíšeš si to do paměti. V archivu hvězd to vede jako „dlouhodobé uchování“.",
        "Dostaneš dárek, který se ti nelíbí, a řekneš „jé, to je krásné“. Dárek má v tvé paměti trvalé místo.",
        "Na oslavě pláčeš dojetím. Při zpívání písničky. Při dortu. Při přání od babičky. A při tom, že dort došel.",
      ],
    ],
  },
  s: [
    ["Archivovaných pocitů", "1 847"],
    ["Pasivně agresivních vzdechů denně", "14"],
    ["Hrnků čaje na uklidnění", "5"],
    ["Rodinných receptů zpaměti", "63"],
    ["Pravdivost věty „nic se neděje“", "1 %"],
    ["Slz u reklamy", "2 týdně"],
  ],
  d: [
    "Dnes se ti zachce plakat u reklamy. Je to správně. Hvězdy to schvalují.",
    "Měsíc dnes tvrdí, že máš náladu. Neříká jakou. Počkej na další vydání.",
    "Dnes si vzpomeneš na něco, co se stalo před třemi lety. A hned z toho bude téma na tři dny.",
    "Dnešní konstelace: polévka v zenitu, pohodlí na západě, urážka na obzoru.",
    "Dnes ti někdo řekne „jak se máš“. Máš dvanáct odpovědí. Dvě z nich dnes ještě nikdo nezažil.",
    "Dnes ti dojde, že ti něco chybí. Je to hrnek čaje. Vždycky je to hrnek čaje.",
    "Dnes budeš mít pocit, že tě nikdo nechápe. Hvězdy tě chápou. Jen se k tomu nehlásí.",
    "Dnešní tip: nesmutni ze všeho najednou. Rozlož to na tři dny.",
    "Dnes ti někdo odmítne tvůj dort. Hvězdy doporučují nebrat to jako zradu.",
    "Dnes budeš chtít být doma. Hvězdy nebudou překvapené. Připraví ti místo v seznamu.",
    "Dnešní horoskop: příliv emocí ve dvě odpoledne, odliv ve čtyři. Mezi tím polévka.",
    "Dnes ti dojde, že za poslední tichý týden se zatím nikdo neomluvil. Hvězdy říkají, že oni taky ne.",
  ],
  q: [
    "Pojďme domů. Uvařím něco, co mi připomíná dětství. Ty si můžeš vybrat, co je dětství.",
    "Víkend doma, deka, dobré jídlo a nikdo, kdo by mi do toho mluvil. Teda ty můžeš.",
    "Odpověď poslat můžu. Ale radši si ji ještě třikrát přečtu a zeptám se maminky.",
    "Umyju to. Jen mi řekni, jestli to myslíš zle. Protože jestli ano, tak si to zapamatuju.",
    "Tam, kde jsme byli před čtyřmi lety. Měli tam skvělou polévku a lidi tam nikdy neříkali nic zlého.",
    "Něco hřejivého. Něco, u čeho se nebudu muset bát. A pokud možno s kočkou v hlavní roli.",
  ],
};

// ---------------------------------------------------------------------------
// LEV: svět je jeviště, publikum je ještě na cestě
// ---------------------------------------------------------------------------
const LEV: RawSign = {
  h: [
    [
      "Lev: když vstoupí do místnosti, i lustry zaujmou lepší pózu.",
      "Lev rozdává velkoryse: úsměvy, rady a pocit, že všechno se točí kolem něj. Je to dar.",
      "Jsi člověk, který umí rozzářit místnost. Hvězdy jen doufají, že ne zrovna v noci.",
    ],
    [
      "Lev není domýšlivý. Jen ví, že sál se dívá správným směrem.",
      "Tvoje vstupy do místnosti mají vlastní hudební doprovod. V hlavě. Ale má to dobrý rytmus.",
      "Pozornost je tvoje oblíbené jídlo. A přidat si můžeš kdykoli.",
    ],
    [
      "Lev miluje, když se o něm mluví. A když se nemluví, tak o tom aspoň napíše příspěvek.",
      "Hrdost máš na jeřáb. Skromnost čeká na letišti, zavazadlo se ztratilo.",
      "Z jednoho selfie vyrobíš dvacet verzí. Odešleš tu jedenáctou, a ta je stejná jako první.",
    ],
    [
      "Lev se nikdy nezeptá: „Co si o tom myslíš?“ Většinou zve k diskusi: „Co si o mně myslíš?“",
      "Jsi jako Slunce: bez tebe to nejde, ale na tebe se dlouho dívat nedá.",
      "Pokora u tebe znamená, že dovolíš i ostatním stát v zorném poli. Na okraji.",
    ],
    [
      "Slunce požádalo o převedení do jiné soustavy. Prý tam má méně konkurence.",
      "Vesmír tě zapsal jako nejjasnější objekt na obloze. Zlatý rámeček přišel s certifikátem.",
      "Tvoje ego má vlastní oběžnou dráhu. Ostatní planety žádají o přesun.",
    ],
  ],
  c: [
    [
      "Umíš zazářit tak, že ostatním je u toho příjemně. To je vzácný druh charismatu.",
      "Máš velkorysost, humor a špetku dramatu. Vesmír tomu říká „rodinný balíček“.",
    ],
    [
      "Nejlíp sedíš uprostřed. I v autě, i na pohovce, i ve vlastním životě.",
      "Chválu přijímáš jako jedlík bufet: slušně, velkoryse a s dalším kolečkem.",
    ],
    [
      "Skromnost je tvoje silná stránka. Mluvíš o ní jen osm minut denně.",
      "Když tě chválí, kývneš. Když tě nechválí, počkáš, až si to rozmyslí.",
    ],
    [
      "Nepotřebuješ publikum. Jen tak pro jistotu ho máš s sebou pořád.",
      "Tvoje představa o skromnosti je zlatá medaile s nápisem „nejskromnější“.",
    ],
    [
      "Planety se u tvého jména zastavují a salutují. Většinou ze strachu, že jinak přijde proslov.",
      "Vesmír pro tebe uspořádal oslavu. Byla krátká, protože hlavní host ji přerušil proslovem o sobě.",
    ],
  ],
  v: [
    [
      "Verdikt: zlatý střed vesmíru. Lépe řečeno zlatý střed tvé galaxie.",
      "Hvězdy radí: svítit je skvělé. Jen občas nech zazářit i ostatní. Zvládnou to.",
    ],
    [
      "Rada hvězd: zkus dnes nejdřív poslouchat. Je to jako stát v pozadí, ale s pocitem hrdinství.",
      "Verdikt: velkorysý, hlasitý, nepostradatelný. Dvě z těch tří slov zkus ztlumit.",
    ],
    [
      "Verdikt: svět ti leží u nohou. Jen se zdá, že se nechce dívat tvým směrem.",
      "Rada: příště nech chvíli ticha. Uvidíš, jak se budou všichni těšit.",
    ],
    [
      "Verdikt: jsi hlavní postava. Škoda, že ostatním o tom nikdo neřekl.",
      "Rada hvězd: zkus ostatním dovolit mít vlastní vedlejší role. Mají je rádi.",
    ],
    [
      "Verdikt vesmíru: zasloužená pozornost, nezasloužená délka proslovu.",
      "Rozsudek: jeden den v hledišti, poslední řada, výhled na sloup.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce se projevuješ velkoryse: dárky, překvapení, večeře. A ve všem fotografie s dobrým světlem.",
        "Rande s tebou je jako koncert. Skvělý program, dobrý zvuk a pocit, že občas se něco přidá i z publika.",
        "Partner tleská rád. Hvězdy by ale uvítaly, kdyby se potlesk občas vracel.",
      ],
      [
        "Tvoje oblíbená otázka na rande: „A co ty si myslíš… o mně?“",
        "Kritiku od partnera bereš jako recenzi inscenace: autor se pochopitelně mýlí, ale aspoň píše o tobě.",
        "Hádka s tebou má tři dějství. V posledním je omluva, kterou musí přednést někdo jiný.",
      ],
    ],
    prace: [
      [
        "V práci umíš prodat nápad tak, že ho i ty začneš považovat za geniální. A nějak to vždycky dopadne.",
        "Kolegové ti obdivují sebevědomí. Tvoje prezentace mají vždycky lepší design než děj.",
        "Na poradě sedíš v čele. Nikdo ti to nepřidělil, prostě se to tak rozhodlo.",
      ],
      [
        "Ve firmě jsi jako maskot: všichni tě znají, nosíš barvu, a nikdo přesně neví, co děláš.",
        "Každou prezentaci začínáš slovy „Já“ a končíš slovy „Děkuji, že jste mi věnovali pozornost.“",
        "Nepracuješ pro tým. Tým pracuje pro tebe. Hvězdy ti to vždycky schválí, ale v zápisu to neuvedou.",
      ],
    ],
    zivot: [
      [
        "Život bereš jako velké dílo. Stále ve výrobě, ale dobré ukázky už jsou na Instagramu.",
        "Máš dar udělat z obyčejného úterka událost s úvodním proslovem a fotografií.",
        "Do každé místnosti přicházíš s dobrou náladou. A odcházíš s ještě lepší, pokud se ti dostalo potlesku.",
      ],
      [
        "Tvoje oblíbená slova: „Mimochodem“, „Já“ a „No jo, tohle bylo moje.“",
        "Kdyby měl tvůj život titulky, každá minuta by začínala „Představuje se hlavní hvězda“.",
        "Potřebuješ publikum tak moc, že když se nikdo nedívá, natočíš o tom aspoň dokument.",
      ],
    ],
    pratele: [
      [
        "Zorganizuješ oslavu, pozveš celé město a přineseš vlastní dort. A všichni jsou nadšení.",
        "Přátelé tě milují. Hlavně proto, že když jsou smutní, přidáš velkolepý projev.",
        "Při skupinových fotkách jsi vždycky uprostřed. Nikdo si nepamatuje, že to bylo nějak domluvené.",
      ],
      [
        "Přátelé ti vždycky řeknou, že to bylo skvělé. Vědí totiž, co by se stalo, kdyby ne.",
        "Když se ti kamarád svěří, poradíš mu. Pak následuje příběh, kdy se stejná věc stala tobě. A dopadla líp.",
        "Tvoje oblíbené téma při setkání s přáteli: ty. Druhé oblíbené: jak ty vidíš, že ti všichni zavidí.",
      ],
    ],
    narozeniny: [
      [
        "Tvoje narozeniny jsou státní svátek. Aspoň pro tebe. Ostatním stačí, že jsou pozvaní.",
        "Dort chceš takový, aby se na něj dalo koukat jako na výstavu. Chutnat může až potom.",
        "Narozeniny začínají už týden předem, kdy začneš naznačovat, co si přeješ. Subtilně. Každý den.",
      ],
      [
        "Oslava se koná v tvém domě, v tvůj čas a podle tvého scénáře. Hosté jsou statisté s dobrým jídlem.",
        "Přání, která dostaneš, počítáš. Když jich je málo, rozhodneš se, že se to dá napravit dalším příspěvkem.",
        "Při sfouknutí svíček čekáš ticho. A potlesk. A ideálně kameramana z veřejnoprávní televize.",
      ],
    ],
  },
  s: [
    ["Úspěšnost fotek „bez filtru“", "0 %"],
    ["Minut před zrcadlem dnes", "47"],
    ["Příspěvků o skromnosti", "12"],
    ["Pravdivost věty „to byla ironie“", "4 %"],
    ["Rozhovorů, které se stočí k tobě", "100 %"],
    ["Potlesku, který ti stačí", "∞"],
  ],
  d: [
    "Dnes tě někdo pochválí. Ty to přijmeš jako samozřejmost. A hned se zeptáš na další.",
    "Slunce ti dnes posílá paprsek. Ostatní planety dostanou jen odraz.",
    "Dnes ti někdo skočí do řeči. Hvězdy svolávají mimořádné zasedání.",
    "Dnešní konstelace: ty v centru, všichni ostatní jako vedlejší role. Bohužel to platí i pro tvůj kalendář.",
    "Dnes se ti dostane pozornosti. Je jí málo. Hvězdy ti doporučují vytvořit další.",
    "Dnes ti někdo vynese chválu. Ty odpovíš „já vím“. A bude to skoro pravda.",
    "Dnes pošleš selfie, na kterém je tvůj nejlepší úhel. Hvězdy už všechny tvoje úhly zdokumentovaly.",
    "Dnes tě čeká důležité setkání. Hvězdy doufají, že tam bude i někdo jiný než ty.",
    "Dnešní tip: nech aspoň jednu větu doříct i někomu jinému. Je to nové a zajímavé.",
    "Dnes budeš mít skvělou náladu. A zbytek světa se podle toho zařídí. Nebo aspoň k tomu kývne.",
    "Dnes ti dojde, že máš pravdu. Poprvé od včerejška. Slavíš to s úsměvem.",
    "Dnešní varování: pokud máš pocit, že kolem tebe nikdo není, podívej se do zrcadla. Je tam publikum.",
  ],
  q: [
    "Rezervace je na mé jméno. Nejlepší stůl, nejlepší výhled, nejlepší společnost. Mluvím o sobě.",
    "Víkend? Pořádám oslavu. Máš vstup zdarma. Hlavní hvězda je už zajištěna.",
    "Odpověď bude skvělá. Čekej. Právě ji ladím, aby seděla k úvodním titulkům.",
    "Já nádobí nemyju, já jsem vedoucí projektu. Ale pokud se najde dobrovolník, dostane potlesk.",
    "Do místa, kde mě pozná personál. A kde pro mě udělají fotku u vchodu.",
    "Něco, kde je hlavní hrdina charismatický, odvážný a trochu připomíná mě. Vybírám podle toho.",
  ],
};

// ---------------------------------------------------------------------------
// PANNA: seznam, seznam seznamů a barevné záložky
// ---------------------------------------------------------------------------
const PANNA: RawSign = {
  h: [
    [
      "Panna: šikovná, pečlivá a vždycky tam, kde má být. Hvězdy ji berou jako vzor.",
      "Panna ví, kde co je. Ví to i o věcech, které nepatří jí.",
      "Máš talent na pořádek. Vesmír by ti rád předal klíče od svého skladu.",
    ],
    [
      "Panna má v seznamu úkolů poznámku „udělat seznam“. Je splněná.",
      "Tvůj kalendář má barevné kódování, které přečte jen pár zasvěcených.",
      "Perfekcionismus u tebe není vada. Je to metodika s přílohami.",
    ],
    [
      "Panna nikdy nepřichází pozdě. Jen o osm minut dřív, než ostatní chtějí.",
      "Tvůj stůl je tak úhledný, že se kolegové bojí dýchat.",
      "Na seznamu úkolů máš položku „dodělat seznam úkolů“. Odškrtnutá není, protože se doplňuje.",
    ],
    [
      "Perfekcionismus je tvoje druhé jméno. První je „Ještě to musím trochu doladit“.",
      "Tvoje kritika je tak přesná, že občas hledáš chybu i v pochvalách, které dostaneš.",
      "Panna nic nekritizuje. Panna jen upravuje svět, dokud nebude mít správné okraje.",
    ],
    [
      "Merkur nabídl uspořádání vesmíru. Odmítnuto: osy nejsou rovnoběžné.",
      "Hvězdy se bojí poslat ti zprávu s překlepem. Raději to nechají být a nikdy nepošlou nic.",
      "Vesmír se pokusil zavést chaos. Chaos byl zalaminován, očíslován a vložen do složky.",
    ],
  ],
  c: [
    [
      "Umíš věci dotahovat do konce. Tvoje spolehlivost je vzácná, jako dobré wi-fi.",
      "Máš cit pro detail. Díky tomu se kolem tebe všechno lepí na místo.",
    ],
    [
      "Když něco spravíš, hned chceš vědět, co se dá zlepšit. Nepřestaneš, dokud ti to neřeknou.",
      "Tvoje oblíbená zábava: ladit tabulku. Druhá oblíbená zábava: ladit tabulku jiným způsobem.",
    ],
    [
      "Perfekcionismus tě chrání před chybami. Chrání tě i před hotovými věcmi.",
      "Říkáš „to je jen drobnost“ a pak o ní mluvíš tři hodiny.",
    ],
    [
      "Dokážeš najít chybu i v dokonalé věci. Pak se zdvořile omluvíš a hledáš dál.",
      "Tvoje „jen jedna drobnost“ obvykle znamená, že se musí přepsat celý dokument.",
    ],
    [
      "Vesmír byl při stvoření nezkorigován. Panna to dodnes tvrdí a má sepsaný seznam chyb s odkazy.",
      "Kosmický pořádek je tvoje záliba. Černé díry si už raději vyplňují formuláře, aby je nikdo nemusel upozorňovat.",
    ],
  ],
  v: [
    [
      "Verdikt: tvoje pečlivost je dar. Jen občas zapomeň na lupu.",
      "Hvězdy radí: dopřej si chvíli bez seznamu. Aspoň dvě minuty. S dobrou tužkou.",
    ],
    [
      "Rada hvězd: nech jednu věc nedokonalou. Jen malou. Třeba tu, co nikdo nevidí.",
      "Verdikt: spolehlivá jako švýcarské hodinky. Jen občas s lehkým tikáním navíc.",
    ],
    [
      "Verdikt: svět je lepší, když ho udržuješ v pořádku. A ještě lepší, když z toho neděláš deník.",
      "Rada: příště zkus neopravovat cizí text. Aspoň ne nahlas.",
    ],
    [
      "Verdikt: perfekce tě baví. Zbytek světa se dívá, jak to zvládáš, a tiše se bojí.",
      "Rada hvězd: dokonalost není cíl. Je to mrak, který se pohybuje s tebou.",
    ],
    [
      "Verdikt vesmíru: pořádek uznán, perfekcionismus archivován pod číslem 1 003. Odvolání se vyřizuje abecedně.",
      "Rozsudek: povinná jedna chyba denně. Dobrovolně, ale pod dohledem.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce jsi pečlivost a loajalita sama. Výročí nezapomene nikdo, protože ho máš v tabulce na čtyři roky dopředu.",
        "Rande plánuješ jako projekt: čas, místo, rozpočet, plán B a plán C.",
        "Láska se u tebe projevuje prakticky: čistá košile, naplánovaná večeře a lékárnička pro každý případ.",
      ],
      [
        "Hádky s tebou probíhají s důkazy, přílohami a časovou osou. Partner se rozhodl, že nevyhraje.",
        "Tvoje oblíbená věta: „Já jen říkám, že by se to dalo udělat lépe.“ Partner to slyší jako „Takhle ne“.",
        "Perfektní partner pro tebe existuje. Zatím čeká ve frontě na schválení. Hvězdy si čtou jeho spis.",
      ],
    ],
    prace: [
      [
        "V práci jsi jistota. Kdo potřebuje něco dohledat, volá tebe a ne vyhledávač.",
        "Tvoje tabulky jsou umělecká díla. Kolegové je občas jen tak otevřou a uctivě mlčí.",
        "Všechno máš včas, úhledně a ve správném formátu. Pak následuje ještě jedna kontrola, pro jistotu.",
      ],
      [
        "Kolegové se bojí posílat ti dokumenty. Vrátí se označené třemi barvami a pěti poznámkami.",
        "Tvoje „jen drobná připomínka“ je dokument o třiceti stranách s odkazy.",
        "Když máš dokončit práci, začínáš ji znovu, aby byla perfektní. Deadline je pro tebe doporučení.",
      ],
    ],
    zivot: [
      [
        "Život ti jde nejlíp, když je dobře zorganizovaný. Pak ti jde ještě lépe, když ho ostatní nepokazí.",
        "Máš v telefonu aplikaci na sledování spánku, vody, kroků, nálad a toho, jak často používáš aplikace.",
        "Ráno si děláš plán dne. Večer děláš plán na zítřek. Hvězdy ti dávají jednu hvězdičku za průběžnou vytrvalost.",
      ],
      [
        "Spontánnost je pro tebe jako jazyk, kterému rozumíš teoreticky: gramatika dobrá, výslovnost žádná.",
        "Když se něco nepovede podle plánu, vezmeš to jako osobní urážku. A poslední tabulku přepracuješ.",
        "Máš aplikaci na všechno. Nemáš jen aplikaci na to, jak vypnout aplikace.",
      ],
    ],
    pratele: [
      [
        "Vždycky víš, kdo má koho rád, kdo co nejí a komu přinést jaké pivo.",
        "Přátelé vědí, že když dáš radu, má strukturu: úvod, tři body a závěr. Většinou i příloha.",
        "Na vaše setkání přijdeš včas, vzorně a s náhradní nabíječkou. Nikdy nevíš.",
      ],
      [
        "Přátelé se bojí požádat tě o malou službu. Dostanou projekt s harmonogramem.",
        "Když se kamarád rozhodne něco udělat jinak než ty, tvoje obočí to všechno napíše za tebe.",
        "Tvoje nejhorší noční můra: kamarádi, kteří přijdou o pět minut později. Bez omluvy.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny plánuješ dopředu: seznam hostů, menu, rozpočet a plán B pro případ změny počasí.",
        "Dort musí být dokonalý. Přesně měřený, přesně nařezaný, a pokud možno bez drobků na talířích.",
        "Na přání odpovíš každému zvlášť, s podrobnostmi a do tří hodin.",
      ],
      [
        "Na oslavě si všimneš, že tři hosté stojí v nesprávném místě. Řekneš to. Možná i nahlas.",
        "Dárky rozbalíš pečlivě, uložíš papír a vyfotíš pro archiv. Dar je zaznamenán, poděkování odesláno do tří hodin.",
        "Narozeninový dort krájíš jako chirurg. Každý kus stejný. Nikdo nesmí mít víc polevy.",
      ],
    ],
  },
  s: [
    ["Seznamů úkolů", "37"],
    ["Barevných záložek", "114"],
    ["Cizích překlepů opraveno dnes", "5"],
    ["Pravděpodobnost, že je to „jen drobnost“", "0 %"],
    ["Kontrol před odesláním", "4"],
    ["Spontánních rozhodnutí letos", "1 (byla naplánovaná)"],
  ],
  d: [
    "Dnes najdeš chybu, kterou nikdo jiný nevidí. Rozhodneš se ji nahlásit. Hvězdy rozhodnutí vítají.",
    "Dnes se ti povede všechno podle plánu. Bude tě to znervózňovat.",
    "Dnešní konstelace: stůl v dokonalém pořádku, mysl ve čtyřech tabulkách.",
    "Dnes ti někdo pošle e-mail s překlepem. Ty se rozhodneš nevšímat si. Vydržíš čtyři minuty.",
    "Merkur ti dnes radí: odlož tabulku. Aspoň na dobu oběda.",
    "Dnes ti někdo řekne, že je to dostatečně dobré. Zasloužíš si čas na zotavení.",
    "Dnes budeš mít čas, ale nebudeš vědět, co s ním. Hvězdy doporučují vytvořit seznam.",
    "Dnes narazíš na kolegu, který nepoužívá styly. Vesmír se bude třást a ty také.",
    "Dnešní tip: zavři oči a ať je v pokoji dvacet vteřin nepořádek. Dýchej.",
    "Dnes se ti nepodaří dokončit všechno. Hvězdy ti odpustí. Ty si to ještě nějakou dobu nebudeš moct odpustit.",
    "Dnes tě čeká nečekaná změna plánu. Hvězdy ti dávají půl hodiny na vstřebání.",
    "Dnes se ti poštěstí uvařit dokonalou kávu. Hvězdy tuto událost zapsaly do archivu.",
  ],
  q: [
    "Mám tabulku restaurací s hodnocením. Dnes vychází na prvním místě podnik s rezervací na 19:00. Je 18:57.",
    "Víkend je rozplánovaný po hodinách, včetně pauzy na spontánnost v neděli od 15:00 do 15:20.",
    "Odpověď je hotová. Čtyřikrát přečtená. Odesílám ji v 19:46, protože tak působí uvážlivě.",
    "Umyju to. Ale nejdřív ti vysvětlím správný postup. Lžíce vlevo, hrnky vzadu, houbičku podle barvy.",
    "Mám itinerář, rezervace, náhradní plán, lékárničku a záložní nabíječku. Stačí si sbalit batoh.",
    "Něco dokumentárního, ať se můžeme poučit. A pak napíšu poznámky, ať si to pamatujeme.",
  ],
};

// ---------------------------------------------------------------------------
// VÁHY: rozhodnou se hned. Za tři týdny.
// ---------------------------------------------------------------------------
const VAHY: RawSign = {
  h: [
    [
      "Váhy: půvab, vkus a upřímný zájem o to, co si dáš ty. Ty už víš. Váhy ne.",
      "Váhy dokážou ze dvou stejně dobrých věcí vybrat tu třetí.",
      "Máš diplomacii, vkus a schopnost slušně odmítnout i sebe.",
    ],
    [
      "Váhy se rozhodnou hned. Přesněji řečeno, jakmile ostatní odejdou domů.",
      "„To je na tobě“ je u tebe vyznání lásky i obrana najednou.",
      "Tvoje nejlepší vlastnost: vidíš obě strany. Tvoje nejhorší vlastnost: stejná.",
    ],
    [
      "Pro i proti máš v tabulce, v poznámkách a v hlavě. Rozhodnutí leží někde mezi nimi.",
      "Říkáš „je mi to jedno“ a myslíš „vyber to správně, ale tak, aby to byl můj nápad“.",
      "Máš pro každou situaci skvělé řešení. Škoda, že jich je vždycky aspoň šest.",
    ],
    [
      "V restauraci čteš jídelní lístek jako smlouvu. A pak si dáš to, co sousedi.",
      "Konflikt je pro tebe jako kopřiva: radši obejdeš celou louku, než přiznáš, že tě štípe.",
      "Tvoje diplomatické „možná“ už ukončilo tři hádky a jednu válku. Kdo začal, neví nikdo.",
    ],
    [
      "Venuše tě požádala o jedno jednoduché rozhodnutí. Čeká na odpověď od minulé galaxie.",
      "Vesmír se zeptal, jestli jsi pro, nebo proti. Odpověď: „pro rovnováhu“.",
      "Hvězdná váha se kvůli tobě rozbila. Nemohla se rozhodnout, kam se přiklonit.",
    ],
  ],
  c: [
    [
      "Umíš vytvořit atmosféru, kde se všichni cítí dobře. I když nikdo neví, kdo to udělal.",
      "Máš dar vidět krásu. Zvlášť v restauracích, o kterých se ještě rozhoduje.",
    ],
    [
      "Rozhodování je pro tebe sportovní disciplína. Trénuješ ji denně. Závod ale dokončuješ vždycky až příští týden.",
      "Nejraději máš věty typu „jak chceš“. Je to elegantní způsob, jak sdělit, že nechceš nést odpovědnost.",
    ],
    [
      "Konflikt vyřešíš tak, že se budeš tvářit, že nikdy neexistoval. Hvězdy ti to uznávají.",
      "V debatě souhlasíš s oběma stranami a nakonec máš pravdu ty. Bohužel nikdo neví, o čem.",
    ],
    [
      "Úspěšně se vyhýbáš konfliktům. Zvláště těm, které způsobuje tvoje „možná“.",
      "Rozhodnutí odkládáš tak elegantně, že se z toho stala umělecká forma.",
    ],
    [
      "Váhy kosmické spravedlnosti ti vrátily vlastní vyváženost s komentářem: „Zajímavé, ale nepoužitelné.“",
      "Tvoje rozhodnutí mají vlastní časovou zónu. Nikdo z hvězdné kanceláře ji ještě nepřepočítal.",
    ],
  ],
  v: [
    [
      "Verdikt: elegance sama. Jen občas bez konkrétního rozhodnutí.",
      "Hvězdy radí: zkus vybrat jednu věc. Jakoukoli. Hvězdy tě nebudou soudit.",
    ],
    [
      "Rada hvězd: dnes řekni, co opravdu chceš. I kdyby to byla jen vanilková zmrzlina.",
      "Verdikt: každý tě má rád, protože nikomu nepřitakáš ani neodporuješ dost dlouho, aby se urazil.",
    ],
    [
      "Verdikt: harmonie je skvělá. Ale někdy se hodí i silnější názor než „jak myslíš“.",
      "Rada: napiš seznam „pro“ a „proti“. A pak vybírej podle barvy písma.",
    ],
    [
      "Verdikt: jsi nejlepší diplomat, který nikdy nepodepsal žádnou smlouvu.",
      "Rada hvězd: příště řekni „ne“. Jen jednou. Hvězdy to rády uvidí.",
    ],
    [
      "Verdikt vesmíru: výsledek hlasování je nerozhodný. Tvůj hlas byl započítán na obě strany.",
      "Rozsudek: do konce týdne se musíš rozhodnout mezi dvěma věcmi. Vesmír tě nenapomíná, ale pozoruje.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce se projevuješ romanticky: květiny, svíčky, hudba. A pak týden otázek: „Opravdu to chceš?“",
        "Říct „miluju tě“ umíš tak, že se nikdo nedozví, jestli to myslíš doopravdy.",
        "Rande s tebou je estetický zážitek. Menu, světlo i oblek ladí. Jen rozhodnutí, kam jít, se zatím hledá.",
      ],
      [
        "Na otázku „chceš se rozejít?“ odpovíš „A co ty?“. Pak si třikrát ověříš, jestli ti rozumí.",
        "Tvoje hádka zní: „Já se přece nezlobím. Jen mi vadí, že to tak vypadá.“",
        "Partner ti dává na výběr ze dvou restaurací. Po hodině oba jedete do třetí, kterou nikdo nenavrhl.",
      ],
    ],
    prace: [
      [
        "V práci jsi mediátor. Tým se hádá, ty vyvažuješ. Pak se tým pohádá o tobě. Vyvážíš i to.",
        "Kolegové oceňují tvou diplomacii. Hlavně proto, že nikdy neřekneš, co si myslíš.",
        "Máš estetický smysl pro prezentace. Rozhodnutí, o čem jsou, přijde na řadu po barevném ladění.",
      ],
      [
        "Šéf: „Potřebuju odpověď do pátku.“ Ty: „Určitě. Do pátku. Nebo do příštího pátku.“",
        "Když tě někdo požádá o názor, začneš větou „Je to složitější“. Pak mluvíš dvacet minut o všem kromě názoru.",
        "Rozhodování o novém logu ti trvá tři měsíce. Rozhodování o oběde sedmnáct minut. Hvězdy ti rozumí.",
      ],
    ],
    zivot: [
      [
        "Život ti dává na výběr spoustu možností. A ty si dáváš na výběr ještě víc. Pro jistotu.",
        "Máš skvělý vkus. Zařídíš cokoli tak, že to vypadá jako z časopisu. Jen nábytek je v obýváku dva týdny rozepsaný.",
        "Každé ráno vybíráš, co si obléct. Tři varianty. Čtvrtá se skrývá v zrcadle.",
      ],
      [
        "Nikdy nevíš, co chceš k večeři. Zato přesně víš, co nechceš. A to se mění po každé nabídce.",
        "Tvůj život je jeden velký seznam „pro a proti“. Skóre je 12 : 12. Vždycky.",
        "Když máš něco koupit, vozík dvakrát objede regál sám. V oboru se tomu říká „studie trhu“.",
      ],
    ],
    pratele: [
      [
        "Všechny smiřuješ. Každý si myslí, že je tvůj nejlepší přítel. Hvězdy věří, že je to pravda.",
        "Přátelé tě milují, protože s tebou se nikdy nehádají. Nebo aspoň ne tak, aby to bylo poznat.",
        "Máš vkus na lidi, na kavárny i na hudbu. Jen ne na to, kdo zaplatí.",
      ],
      [
        "Když se kamarádi ptají, kam jít, odpovíš „Je mi to jedno.“ Pak jdeš do toho, kam jít nechtěli.",
        "Plány s tebou jsou jako lodní trasa: hodně směrů, žádný přístav, hodně vody.",
        "Když se dva přátelé pohádají, jsi v pozici, kde se oba cítí podpořeni. Diplomaté tomu říkají „dvojitý agent“.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny slavíš elegantně: svíčky, dobré víno a ten správný odstín dortu. Výběr odstínu trval týden.",
        "Dárky vybíráš dlouho, aby byly dokonalé. Jejich předání se tím sice zpozdí, ale působivost je jistá.",
        "Slavení narozenin s tebou je estetický zážitek. A k tomu otázka „co kdybychom to udělali jinak?“.",
      ],
      [
        "Přání dostaneš od všech. Jedno z nich budeš tři dny hodnotit, jestli bylo dostatečně vřelé.",
        "Na tvé oslavě se hosté dozvědí, že hlavní chod je nakonec dvojí. Rozhodnutí se totiž odkládá.",
        "Dort máš vybraný čtyřikrát. A každá verze je pořád v hlavě. Zítra se objeví pátá.",
      ],
    ],
  },
  s: [
    ["Rozhodnutí hotových do deadlinu", "3 %"],
    ["Šatů vyzkoušených před odchodem", "7"],
    ["Pravdivost věty „je mi to jedno“", "0 %"],
    ["Sekund při volbě filmu", "2 400"],
    ["Dnešních vyhnutých konfliktů", "6"],
    ["Pravděpodobnost, že řekneš „ne“", "8 %"],
  ],
  d: [
    "Dnes si budeš muset vybrat mezi dvěma věcmi. Vesmír ti dává týden. Nebo dva.",
    "Venuše dnes říká: buď elegantní. A pokud nemůžeš, buď aspoň ve stejné barvě.",
    "Dnes tě čeká důležité rozhodnutí. Pošleš ho na poradu s třemi přáteli. Pak ještě s dvěma.",
    "Dnešní konstelace: dvě možnosti, dvě opačné strany, jedna váha bez ručičky.",
    "Dnes ti někdo řekne „je to na tobě“. Hvězdy zaznamenají, že tvoje odpověď dorazí příští týden.",
    "Dnes se rozhodneš. Zítra se rozhodneš o tom rozhodnutí.",
    "Dnešní tip: zvol si nejdřív něco malého. Třeba čaj. Hvězdy už zkoumají druhy čaje.",
    "Dnes se vyhneš konfliktu s takovou elegancí, že se ho zúčastníš tři dny po jeho konci.",
    "Dnes si vybereš ze dvou možností. A pak se zeptáš, jestli by nešly kombinovat.",
    "Dnes budeš chtít zdvořile říct ne. Diplomaté tomu říkají „zajímavý pokus“.",
    "Dnes tě čeká estetický zážitek. Strávíš nad ním dvě hodiny a nic nekoupíš.",
    "Dnešní varování: pokud ti někdo řekne „já se rozhodnu hned“, nevěř mu. Pokud to řekneš ty, hvězdy se zasmějí.",
  ],
  q: [
    "Je mi to jedno. Vyber ty. Jen ne ten podnik, ten včera. A taky ne tamten. A taky ne… radši nic neříkej.",
    "Víkend by se dal strávit mnoha způsoby. Navrhuji tři. A pak se uvidí, co bude hezké.",
    "Odpovím. Jen musím vymyslet odpověď, která nebude nikoho urážet. Dej mi dvacet minut. Nebo týden.",
    "Já umyju, ty utíráš. Nebo opačně? Nebo můžeme obojí zítra. Jak chceš. Ne, jak chceš ty.",
    "Do míst, kde je hezky. Konkrétně navrhuji tři. Ale můžeš vybrat čtvrté, pokud je hezčí.",
    "Co chceš ty. Tak ne. Co chci já? Vlastně tohle se mi líbí. Ale to druhé taky.",
  ],
};

// ---------------------------------------------------------------------------
// ŠTÍR: nic neříká, všechno si pamatuje
// ---------------------------------------------------------------------------
const STIR: RawSign = {
  h: [
    [
      "Štír: hluboký pohled, tichá síla a perfektní paměť na narozeniny všech, kdo mu ublížili.",
      "Štír vidí víc, než říká. A říká dost, aby to znělo záhadně.",
      "Nevzdáš se nikdy. Hvězdy by rády věděly, jestli by se dala vzdát aspoň jedna hádka.",
    ],
    [
      "Štír nemá rád překvapení. Obzvlášť ta, o kterých se dozví jako poslední.",
      "Tvoje pohledy mají vlastní kategorii: „dívám se, protože vím“.",
      "Mlčíš tak výmluvně, že okolí mluví za tebe. Obvykle špatně.",
    ],
    [
      "Štír nezapomíná. Štír jen čeká na vhodnou chvíli připomenout něco, co je skoro zapomenuté.",
      "Máš vlastní soukromí tak pevně chráněné, že i ty musíš vyplnit žádost o přístup.",
      "Tvůj poker face je tak dobrý, že občas netušíš, co cítíš. Hvězdy to vědí, ale mlčí.",
    ],
    [
      "Pomsta je pokrm, který se podává studený. Tvůj bývá zamrzlý od roku 2019.",
      "Štír netvrdí, že se mstí. Štír jen přesouvá případ do složky „časem“.",
      "Jsi tak tajemný, že tě kolegové stejně jako hvězdy sledují z bezpečné vzdálenosti.",
    ],
    [
      "Pluto svolalo schůzi: co je ještě nevyřízené? Odpověď: nic. Všechno se pamatuje.",
      "Vesmír z tebe cítí respekt. Jedna černá díra žádá o přesun do jiné galaxie.",
      "Tvůj pohled byl zařazen do úředních dokumentů vesmíru. Pod kategorií „Nekomentovat“.",
    ],
  ],
  c: [
    [
      "Umíš být loajální do morku kostí. Kdo tě má na své straně, ten má na své straně celý kontinent.",
      "Jsi intenzivní. V dobrém i ve špatném, ale hvězdy to hlásí jen jako intenzivní.",
    ],
    [
      "Tvoje mlčení řekne víc než ostatním celý projev. Hlavně to, že si pamatuješ.",
      "Máš intuici, která vycítí lež dřív, než ji dotyčný dořekne. Občas i dřív, než ji vymyslí.",
    ],
    [
      "Štír nikdy neřekne „zlobím se“. Štír řekne „v pořádku“. A pak se ostatním udělá zima.",
      "Umíš zvednout obočí tak, že si dotyčný přehraje poslední tři roky.",
    ],
    [
      "Tvůj seznam křivd je tak přesný, že by ho záviděl archiv ministerstva.",
      "Mlčíš dramaticky. S kamerou, s hudbou a se sedmi dny pauzy.",
    ],
    [
      "Pluto se nad tebou sklání a šeptá: „Kosmická rozvědka by se u tebe mohla učit.“",
      "Vesmírný archiv zřídil kvůli tobě novou složku. Název: „Neodpuštěno, ale zapsáno“.",
    ],
  ],
  v: [
    [
      "Verdikt: hloubka, síla a trochu záhady. Jen občas mrkni, ať se ostatní nebojí.",
      "Hvězdy radí: dopřej si pomalu. A kdyby někdo vyzvídal, mlč dramaticky.",
    ],
    [
      "Rada hvězd: zkus říct jednu myšlenku nahlas. Čistě pro vědecké účely.",
      "Verdikt: tajemný, vytrvalý a trochu strašidelný. Hvězdy by tě rády pozvaly, ale bojí se odpovědi.",
    ],
    [
      "Verdikt: s tebou je dobře i zle. Obojí je poctivě zdokumentováno.",
      "Rada: přeřaď „pamatuju si“ do kategorie „už je to dávno odpuštěno“. Vesmír to ocení.",
    ],
    [
      "Verdikt: žádná křivda se u tebe neztratí. Škoda, že nikdo neví, kde je tvůj archiv.",
      "Rada hvězd: občas odpusť. Nebo aspoň přepiš ten dokument do menšího písma.",
    ],
    [
      "Verdikt vesmíru: archivováno, vyhodnoceno, uloženo. Vyřízení čeká na příhodnou galaxii.",
      "Rozsudek: povinná jedna odpuštěná křivda ročně. Hvězdy provedou namátkovou kontrolu.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce jsi intenzivní. Když miluješ, tak celým svým tajemným já. Partner je z toho nadšený i vyděšený.",
        "Rande s tebou je hluboká zkušenost. První hodinu mlčíš, pak se zeptáš na jedinou otázku, která všechno změní.",
        "Tvůj pohled dokáže vyjádřit celou knihu. Jen nikdo neví, jestli je to romance, nebo thriller.",
      ],
      [
        "Tvoje žárlivost je jako tichá hudba v pozadí. Nikdo ji nevidí, ale všichni ji slyší.",
        "Když se partner opozdí o deset minut, máš plán, mapu a sedm vysvětlení. Žádné není hezké.",
        "Říkáš „nic se neděje“ a partner se zatím rozhoduje, jestli má utíkat, nebo se omluvit. Obojí může být pozdě.",
      ],
    ],
    prace: [
      [
        "V práci jsi zdrojem tajemství. Víš o všech všechno a nikomu nic neřekneš. Je to vzácné a trochu děsivé.",
        "Pracuješ soustředěně a bez zbytečných slov. Šéf z toho má pocit, že je pozorován. Je.",
        "Na poradě sedíš a mlčíš. Když něco řekneš, všichni si zapisují.",
      ],
      [
        "Kolegové si často nejsou jistí, jestli tě mají rádi, nebo se tě bát. Hvězdy tvrdí, že obojí je v pořádku.",
        "Tvoje oblíbená kancelářská zbraň: dlouhý pohled přes monitor. Není to přání. Je to protokol.",
        "Když ti někdo vezme nápad, nic neřekneš. Jen si začneš vést složku. Tuhle složku nikdo nechce otevřít.",
      ],
    ],
    zivot: [
      [
        "Život bereš jako detektivku, kde ty jsi detektiv, vyšetřovatel a svědek. Případ stále běží.",
        "Máš silnou vůli. Pokud se rozhodneš pro něco, nezastaví tě ani Mars.",
        "Čím víc se něco skrývá, tím víc tě to láká. Úředně jde o „tvého vnitřního vyšetřovatele“.",
      ],
      [
        "Ráno si vezmeš kafe, a už se ti honí hlavou, kdo ti před sedmi lety řekl, že je to „skvělý nápad“.",
        "Tajemství jsou tvůj koníček. Máš jich tolik, že občas zapomeneš, které jsou tvoje.",
        "Tvoje soukromí je opevněné. Hvězdy zjistily, že za zdí je další zeď a za ní něco, co nazýváš „nic“.",
      ],
    ],
    pratele: [
      [
        "Tobě se dá svěřit cokoli. Tajemství u tebe mizí. Jen se z nich nikdy nevrací.",
        "Přátel máš málo. Ale ti vydrží. Na vesmírném úřadě to vedou jako „kvalitní výběr s přísnou kontrolou“.",
        "Tvoje loajalita je pevná jako ocelová brána. Hesla se ale mění podle nálady.",
      ],
      [
        "Přátelé vědí, že Štírovi se nelže. Taky vědí, že Štír to bude vědět dřív, než lež dořeknou.",
        "Když tě někdo zradí, nic neřekneš. Prostě se po čase pozná, že už nepíšeš. Odborný název: „tichá výpověď“.",
        "Kamarádi se tě bojí zeptat, co děláš ve volném čase. Odpověď by mohla být příliš přesná.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny slavíš v úzkém kruhu. Hvězdy odhadují, že kruh má tři členy a jednoho tajného hosta.",
        "Dárky otevíráš tajemně. Nikdo neví, jestli se ti líbí. A to je přesně tvoje taktika.",
        "Přání čteš pomalu, s pohledem, který říká: „Vím, kdo to psal a proč.“",
      ],
      [
        "Pokud ti někdo zapomene popřát, nic neřekneš. Hvězdy ale slyší, jak se zapisuje do tvého archivu.",
        "Tvoje oslava je jako tajná schůzka: přesný čas, přesné místo a heslo. Kdo ho nezná, nevstoupí.",
        "Dort s nápisem „Všechno nejlepší“ zkoumáš s podezřením. Hvězdy ti tvrdí, že je jen z jahod.",
      ],
    ],
  },
  s: [
    ["Zapamatovaných křivd", "2 311"],
    ["Pohledů, které říkají „vím“", "18 denně"],
    ["Tajemství, o kterých nikdo neví", "31"],
    ["Pravdivost věty „jsem v pohodě“", "0 %"],
    ["Pomalu servírovaných pomst", "4"],
    ["Slov v dnešním dni", "47"],
  ],
  d: [
    "Dnes ti někdo řekne něco, co se ti nebude líbit. Zapíšeš si to do archivu. Hvězdy se dívají.",
    "Pluto dnes říká: nic neříkej. Jen se dívej. Zbytek zařídí atmosféra.",
    "Dnes budeš tajemný. Nikdo se tě na nic nezeptá, protože se bojí odpovědi.",
    "Dnešní konstelace: dlouhý pohled, krátká věta, nekonečná paměť.",
    "Dnes ti kdosi odpoví na zprávu pozdě. Hvězdy ti doporučují neříkat nic. Ty to stejně uděláš tichem.",
    "Dnes budeš mít potřebu zkontrolovat něčí profil. Ne proto, že je to důležité. Prostě proto.",
    "Dnes se dozvíš pravdu. Ty ji už dávno znáš. Jen ti chyběl důkaz.",
    "Dnešní tip: usměj se. Hvězdy tvrdí, že to bylo naposledy před dvěma lety. Něco tě rozptýlilo.",
    "Dnes ti někdo opět zadá otázku „co se děje?“. Odpověď: „nic.“ Překlad: „celá sága.“",
    "Dnes tě čeká překvapení. Nikdo neví jaké. Ty už ano. Jen nic neřekneš.",
    "Dnes budeš tři hodiny přemýšlet nad pohledem, který ti někdo věnoval na poradě.",
    "Dnešní varování: pokud ti někdo zatelefonuje, nezvedej to hned. Nech ho trochu napnout.",
  ],
  q: [
    "Vyberu místo, které znám. Sednu si ke zdi. Budu sledovat vchod. Ať vím, kdo kdy přišel.",
    "Víkend je můj. Nikdo se nezeptá, co dělám. Já nikomu neřeknu, že nic.",
    "Odpověď poslat můžu. Ale ještě nevím, jestli ji poslat dnes, nebo až si dotyčný uvědomí, co udělal.",
    "Umyju to. A přitom si budu pamatovat, kdo tam ty hrnky nechal. Ale nic neřeknu.",
    "Cestovat? Tam, kam nikdo nejede. A kde nás nikdo nehledá. A nikdo se neptá, proč.",
    "Něco s tajemstvím. Něco, kde všichni lžou a já to vím od začátku. Hned po první scéně.",
  ],
};

// ---------------------------------------------------------------------------
// STŘELEC: upřímnost bez brzd a letenka bez návratu
// ---------------------------------------------------------------------------
const STRELEC: RawSign = {
  h: [
    [
      "Střelec: optimista s batohem, který se nikdy úplně nevybalí.",
      "Střelec je upřímný. Většinou ve chvíli, kdy ostatní doufali v diplomacii.",
      "Máš v sobě dobrodruha a hlad po novém místě. Hvězdy ti přejí dobré spojení.",
    ],
    [
      "Střelec chce svobodu. Nejlépe s letenkou a bez tabulky.",
      "Tvoje upřímnost je tak rychlá, že ji mozek předběhne jen výjimečně.",
      "O všem prohlašuješ, že to chceš vyzkoušet. I o tom, co ti ještě nikdo nenabídl.",
    ],
    [
      "Střelec má plán na celý svět. Jen mu pořád chybí první krok a směr.",
      "Říkáš „neplánuju“. Máš ale tři cestovní tabulky, které by uvedly NASA do rozpaků.",
      "Slibuješ, že se ozveš. Hvězdy sledují, v jakém časovém pásmu.",
    ],
    [
      "Tvoje upřímnost nemá filtr. Bohužel ani brzdy, ani náhradní plán.",
      "Střelec se nebojí závazku. Jen mu nějak pořád nezbývá čas ho podepsat.",
      "V diskusích jsi filozof. Za deset minut už letíš na jiný kontinent.",
    ],
    [
      "Jupiter ti dal výpověď z funkce „průvodce vesmírem“. Dovolenou ti nechal.",
      "Vesmír si tě zvolil za cestovatele. Bohužel ti zapomněl říct, že cíl nikde není.",
      "Tvůj optimismus je tak velký, že vzniklo nové souhvězdí: „Ještě to dopadne“.",
    ],
  ],
  c: [
    [
      "Umíš na všem najít to dobré. Hvězdy se už těší, co najdeš na pondělí.",
      "Máš v sobě rozlet, který se šíří na ostatní. Někdy dokonce i na letiště.",
    ],
    [
      "Pravdu říkáš tak otevřeně, že ostatní zapomenou, jaká byla otázka.",
      "Všude jsi doma. Doma je ti nejlíp na cestě. Ideálně v jiné zemi.",
    ],
    [
      "Střelec nikdy nepřijde pozdě. Jen se řídí vlastním časovým pásmem.",
      "Říkáš to přímo. A pak se divíš, že je ticho. Hvězdy říkají, že je to forma uznání.",
    ],
    [
      "Závazek je pro tebe jako dlouhá fronta: vidíš ji z letiště a letíš jinam.",
      "Tvoje „jen to krátce vysvětlím“ mívá tři body, jednu legendu a vlastní závěr.",
    ],
    [
      "Pozemská gravitace tě už několikrát zadržela. Žádný z pokusů nevyšel a hvězdy ztratily trpělivost.",
      "Vesmír tě chtěl zakotvit. Kotva se vrátila z cesty a poslala pohlednici.",
    ],
  ],
  v: [
    [
      "Verdikt: dobrodruh s dobrým srdcem. A s lepším batohem než ostatní.",
      "Hvězdy radí: zkus aspoň jednou doletět tam, kam míříš. Půjde to dobře.",
    ],
    [
      "Rada hvězd: občas zůstaň. Ne jako výlet, spíš jako pokus.",
      "Verdikt: upřímný, otevřený a vždycky na cestě. Hlavně to poslední.",
    ],
    [
      "Verdikt: svoboda je skvělá. Jen nezapomeň, že někdo ti čeká s polévkou.",
      "Rada: než odjedeš, aspoň napiš, kam. Hvězdy pošlou pohlednici zpět.",
    ],
    [
      "Verdikt: nejlepší společník na cesty a nejhorší na pondělí.",
      "Rada hvězd: občas drž jazyk za zuby. Nebo aspoň jednu větu před koncem.",
    ],
    [
      "Verdikt vesmíru: zpátky už se nevrátíš. Vesmír je totiž kruhový a ty jsi na druhém konci.",
      "Rozsudek: jedna kotva, povinně. Hvězdy chápou, že ji stejně do týdne vyhodíš.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce jsi dobrodruh. Rande s tebou je výlet na neznámé místo, i když je to jen kavárna za rohem.",
        "Partner s tebou zažije nečekané věci. Například půlnoční výlet do jiné země, protože v telefonu blikla akční letenka.",
        "Tvůj smysl pro humor je tak otevřený, že ho partner musí někdy zavřít kvůli průvanu.",
      ],
      [
        "Slovo „vztah“ zní pro tebe jako „pevná trasa“. Chceš, aby se dalo odbočit.",
        "Upřímně říkáš, co si myslíš. Obvykle to je tak upřímné, že se pár dní po tom nikdo neozve.",
        "Tvoje „nezávazně“ trvá už tři roky. Partner mezitím přestal počítat dny a začal počítat letenky.",
      ],
    ],
    prace: [
      [
        "V práci jsi optimista. Každý problém bereš jako dobrodružství a každou poradu jako workshop o životě.",
        "Máš skvělé nápady a pevné přesvědčení, že se dají realizovat z kavárny v Lisabonu.",
        "Kolegové tě obdivují. Hlavně v pondělí, když se vrátíš s historkami a dárkem z jiného kontinentu.",
      ],
      [
        "Tvoje ranní porada: pět minut vtipů, tři minuty cestopisu a poslední minuta pro „no a co jste vlastně chtěli?“",
        "Když se blíží deadline, ty se blížíš na letiště. Hvězdy říkají, že to se dá nazvat „práce na dálku“.",
        "Svoboda je tvoje hodnota. Šéf to chápe, jen by ji rád viděl i v pracovní smlouvě.",
      ],
    ],
    zivot: [
      [
        "Život je pro tebe jedna velká cesta. Jen si občas zapomeneš sbalit kufr, mapu a pas.",
        "Máš v sobě touhu poznávat. Hlavně to, co je daleko, nedosažitelné a levně dostupné jako akční letenka.",
        "Na otázku „kde bydlíš“ odpovídáš: „Právě teď tady.“ Adresa se aktualizuje podle letenek.",
      ],
      [
        "Plánovat do budoucna je pro tebe jako číst předpověď počasí pro příští rok. Zajímavé, ale nepoužitelné.",
        "Pro každou překážku máš jednu odpověď: „Nějak to dopadne.“ Hvězdy by ocenily, kdyby ji doplnil aspoň jeden konkrétní plán.",
        "V peněžence máš vstupenky z pěti zemí, lístky z deseti koncertů a nezodpovězenou otázku, co dělat v pondělí.",
      ],
    ],
    pratele: [
      [
        "Přivezeš suvenýr, historku a nápad na další výlet. Všechno hned.",
        "Přátelé tě milují za upřímnost. Hlavně když se zrovna nepřihodí něco, k čemu je potřeba diplomacie.",
        "S tebou se člověk nikdy nenudí. Hlavně proto, že nikdy neví, v jaké zemi se zítra ocitne.",
      ],
      [
        "Když ti kamarád svěří problém, dostane ho zpátky s filozofickým rozborem, citátem a plánem na výlet.",
        "Přátelé tě vedou v kontaktech jako „Střelec (někde na cestě)“. Aktualizace polohy chybí.",
        "Tvoje „ozvu se“ platí stejně dlouho jako sezónní jízdenka. Obvykle přesně do chvíle, než odjedeš.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny slavíš jako dobrodružství: nové místo, nová parta a vždycky něco nečekaného u dortu.",
        "Dárek ti nejlíp zabalí zážitek. Vstupenky, jízdenky, nebo lístek na loď. Hvězdy aplaudují.",
        "Přání dostaneš z celého světa. Jen odpovědět na ně budeš až z jiného časového pásma.",
      ],
      [
        "Tvoje oslava se koná tam, kde zrovna jsi. Pozvaní hosté se o tom dozvídají z fotek.",
        "Když máš narozeniny, nikdy nejsi doma. Dort jde do kufru a svíčky se zapalují na letišti.",
        "Říkáš „přijďte v sobotu“. V sobotu jsi někde jinde, ale dort je tam. A to je tvoje verze pozvánky.",
      ],
    ],
  },
  s: [
    ["Zemí na seznamu „musím vidět“", "63"],
    ["Zemí skutečně navštívených", "4"],
    ["Pravdivost věty „přijdu včas“", "17 %"],
    ["Letenek v košíku", "9"],
    ["Dnešních pravd bez filtru", "6"],
    ["Plánů, které přežijí příští týden", "0,5"],
  ],
  d: [
    "Dnes dostaneš nápad na výlet. Hvězdy ti doporučují nejdřív vyřídit pondělí.",
    "Jupiter dnes přeje cestě. Nemusí to být daleko. Stačí do vedlejšího města.",
    "Dnes řekneš někomu pravdu. Upřímně, nahlas a bez přípravy. Hvězdy zajistí ticho po ní.",
    "Dnešní konstelace: kufr, letenka a otázka, jestli se nejde ještě dál.",
    "Dnes ti někdo nabídne stabilní závazek. Hvězdy si sednou do hlediště.",
    "Dnes se ti zachce odejít na deset dní do hor. Hvězdy to rozhodnutí podpoří a zeptají se, kde je mapa.",
    "Dnešní tip: neslibuj nic, co nedokážeš dodržet. Nebo slib všechno a odlétej. Hvězdy mají rády obojí.",
    "Dnes ti dojde, že cestování je lepší než pondělí. Ve čtvrtek ti to dojde znovu.",
    "Optimismu bude dnes nepřiměřeně mnoho. Hvězdy si poznamenají, že tomu říkáš „strategie“.",
    "Dnes pošleš pohlednici. Hvězdy se zeptají, odkud. Neví to ani odesílatel.",
    "Dnešní varování: tvoje „nějak to dopadne“ dnes nebude stačit. Ale zkusíš to.",
    "Dnes tě čeká změna plánu. Hvězdy předpokládají, že ji vyvolá tvůj vlastní nápad.",
  ],
  q: [
    "Kam? Někam, kde jsme ještě nebyli. Nikdo neví, kde to je. Ale určitě to bude zajímavé.",
    "Víkend? Hory, pak moře, pak ještě jedno město. Vezmi si batoh. A pas.",
    "Odpověď poslat můžu. Jen jsem zrovna v letadle. Bez signálu. Ale v duchu už píšu.",
    "Nádobí? Vždyť jsme na cestě. Umyju ho příští týden, až se vrátíme. Nebo ne.",
    "Do země, o které znám tři věty. Zbytek se dozvíme na místě. To je ta zábava.",
    "Něco o cestování. A pokud možno film, kde se hlavní hrdina nikdy nevrátí domů.",
  ],
};

// ---------------------------------------------------------------------------
// KOZOROH: dovolená je položka v kalendáři mezi dvěma schůzkami
// ---------------------------------------------------------------------------
const KOZOROH: RawSign = {
  h: [
    [
      "Kozoroh: ambice na dvou nohách a plán na dvacet let dopředu.",
      "Kozoroh ví, kam míří. Hvězdy jen doufají, že mu to někdy řekne.",
      "Spolehlivost máš jako seřízený budík. A v pondělí stejnou popularitu.",
    ],
    [
      "Kozoroh má smysl pro humor. Jen ho používá výhradně mimo pracovní dobu.",
      "Odpočívat umíš. Nejdřív to ale zapíšeš do kalendáře a zkontroluješ konflikty.",
      "Tvoje „zvládnu to“ zní spíš jako výhrůžka než jako slib.",
    ],
    [
      "Kozoroh nemá rád zbytečné řeči. Obzvlášť ty, co nejsou jeho.",
      "Pracuješ tolik, že se tvoje dovolená bojí přijít.",
      "Tvůj smysl pro humor je tak suchý, že ho kolegové berou jako technickou poznámku.",
    ],
    [
      "Kozoroh je ten, kdo se zeptá „A jaký je z toho ROI?“ i na dětskou narozeninovou párty.",
      "V tobě se potkává ambice pětiletého plánu a empatie čtvrtletního reportu.",
      "Tvůj úsměv se objevuje jen na základě písemného schválení a ověřených zdrojů.",
    ],
    [
      "Saturn podal žádost o snížení tvých požadavků. Zamítnuto: „Ty to zvládneš.“",
      "Vesmír tě naplánoval na čtvrté čtvrtletí. Dovolená je ve složce „Příští galaxie“.",
      "Komise ti schválila odpočinek. Tvůj kalendář ho vrátil: „nemáme kapacitu“.",
    ],
  ],
  c: [
    [
      "Umíš věci dokázat. Bez velkých slov, ale s pevným výsledkem.",
      "Jsi člověk, který na všechno myslí. Dopředu, dozadu i do jiné časové zóny.",
    ],
    [
      "Úspěch bereš vážně. A vtipy také, ale jen ty, které mají zpětnou vazbu.",
      "Jsi jako přesný nástroj: spolehlivý, silný a bez tlačítka „relax“.",
    ],
    [
      "Dovolená je pro tebe fáze, která se plánuje čtyři měsíce a pak se zruší kvůli prioritě.",
      "Tvůj sarkasmus je tak suchý, že lidé většinou zjistí až za týden, že to byl vtip.",
    ],
    [
      "V sobotu ráno kontroluješ e-maily „jen aby bylo zítra snazší“.",
      "Tvůj životopis obsahuje víc kapitol než tvoje fotky z dovolené.",
    ],
    [
      "Na videohovorech mluvíš tak věcně, že automatické titulky přestanou psát a jen přikyvují.",
      "Kosmický kalendář nemá volné okno pro tvoje potřeby. Když se ho zeptáš, začne se omlouvat.",
    ],
  ],
  v: [
    [
      "Verdikt: pevný základ, tichá síla a perfektně naplánovaný týden.",
      "Hvězdy radí: dnes si dej pauzu. Dvanáct minut. Už je v kalendáři.",
    ],
    [
      "Rada hvězd: občas smaž jednu schůzku. Hvězdy pak ocení tvoji odvahu.",
      "Verdikt: ambiciózní, seriózní, trochu bez humoru. Ale ten tvůj je speciální.",
    ],
    [
      "Verdikt: zasloužíš si úspěch. A také týden, kdy nic neplánuješ. Jen tak, na zkoušku.",
      "Rada: zkus jednou odejít z práce, než zhasnou světla. Jen aby se zjistilo, že budova ještě stojí.",
    ],
    [
      "Verdikt: nejlepší kolega na všechno, kromě dovolené. Tam by se konala porada.",
      "Rada hvězd: štěstí není KPI. Ale můžeš si ho zkusit zapsat do tabulky.",
    ],
    [
      "Verdikt vesmíru: žádost o odpočinek schválena v dalším fiskálním roce. Bohužel vesmír má jen jeden.",
      "Rozsudek: povinná jedna hodina nicnedělání, pod dohledem. Samozřejmě naplánováno.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce jsi spolehlivost sama. Partner ví, že když řekneš „budu tam“, bude to přesně v domluvený čas.",
        "Romantika s tebou má strukturu: úvod, rozvinutí, závěr a krátký přehled výsledků.",
        "Tvoje láska je tichá a pevná. Projevuje se hlavně tím, že hlídáš, aby partner měl vždycky plnou nádrž.",
      ],
      [
        "Rande plánuješ jako schůzku s klientem. Včetně agendy a shrnutí na konec.",
        "Výročí zapíšeš do kalendáře s předstihem tří měsíců. Pak ho zrušíš kvůli práci. Pak se omluvíš tabulkou.",
        "Partner by chtěl víc spontánnosti. Ty mu dáš čas v kalendáři: „Spontánní okno: čtvrtek 17:30–18:00.“",
      ],
    ],
    prace: [
      [
        "V práci jsi legenda. Kolegové o tobě mluví šeptem a občas s nadšením.",
        "Tvoje tabulky jsou jako pevné hory: nikdo je nehne, všichni je obdivují.",
        "Pracuješ ráno, odpoledne i večer. A kolegové doufají, že noc je vyhrazena spánku.",
      ],
      [
        "Tvůj nejlepší nápad na dovolenou: přesunout poradu na pláž. Vypadá to dobře v prezentaci.",
        "Z práce odcházíš poslední a vždycky s pocitem, že se ti něco nepodařilo. Většinou ne.",
        "Tvůj šéf se tě bojí zeptat, jestli nechceš volno. Bojí se, že řekneš ano a pak vyplníš formulář.",
      ],
    ],
    zivot: [
      [
        "Život ti dává smysl, když se dá dobře naplánovat. Naštěstí máš tři kalendáře.",
        "Tvoje ambice nemají strop. Mají jen tabulku, ve které se zatím nikdo nevyzná.",
        "Čím víc práce, tím lépe se cítíš. V kosmické terminologii jde o „ocelovou vytrvalost“.",
      ],
      [
        "Tvoje představa o odpočinku je „menší pracovní tempo“. Tvoje představa o zábavě je „školení“.",
        "Máš dlouhodobý plán. Dokonce i na ten dnešní den. Hvězdy chtějí vědět, jestli v něm je i oběd.",
        "Slovo „spontánní“ je ve tvém slovníku přeškrtnuté a nahrazeno „naplánované spontánní“.",
      ],
    ],
    pratele: [
      [
        "Ozveš se přesně v den narozenin. Včas, s dárkem a s poznámkou, že se příště sejdete.",
        "Přátelé vědí, že na tebe se dá spolehnout. Nevědí jen, kdy máš čas.",
        "Máš málo přátel, ale kvalitních. Interně to vedou jako „pečlivě vybraný tým“.",
      ],
      [
        "Pozvánky od přátel dostávají odpověď „Ozvu se, až se mi uvolní kalendář“. Už třetí rok.",
        "Přátelé se s tebou scházejí jako na poradě: s předstihem, podle agendy a s časovým limitem.",
        "Když máš volný víkend, přátelé to vědí. Nevěří tomu, dokud ho nezačneš plánovat.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny slavíš v klidu. Dort, pár lidí a přesně domluvený čas, kdy to všechno skončí.",
        "Přání odpovíš každému. Do tří dnů. S poděkováním a drobným dotazem na jejich plány.",
        "Tvoje oslava má začátek, program a konec. Hosté chválí organizaci a pomalu se ptají, kde je zábava.",
      ],
      [
        "Narozeniny si dáš do kalendáře jako „Osobní den“. V den narozenin zrušíš dvě schůzky. Hvězdy to oceňují.",
        "Dárek, který chceš, ti nikdo nekoupí, protože zní „Čtvrtletní report v lepší kvalitě“.",
        "Na oslavě sedíš, usmíváš se a v hlavě sepisuješ, co všechno se mohlo dělat efektivněji.",
      ],
    ],
  },
  s: [
    ["Hodin schůzek týdně", "27"],
    ["Dovolené využité z nároku", "9 %"],
    ["Kalendářů, které spravuješ", "3"],
    ["Pravdivost věty „dnes končím včas“", "0 %"],
    ["Sobotních e-mailů", "11"],
    ["Pravděpodobnost úsměvu před kávou", "4 %"],
  ],
  d: [
    "Dnes se ti podaří všechno naplánovat. Hvězdy čekají, co se pokazí. Je to nejzajímavější část dne.",
    "Saturn ti dnes říká: dnes odejdi včas. Ty zapíšeš do kalendáře: „Zvážit odchod včas“.",
    "Dnes ti někdo řekne, že máš zasloužený odpočinek. Ty odpovíš: „Schválím ho v pátek.“",
    "Dnešní konstelace: tabulka, káva, tabulka. Kozoroh v zenitu.",
    "Dnes se ti zdá, že všichni zaostávají. Hvězdy ti doporučují poslat jim milou tabulku.",
    "Dnes budeš pracovat o víkendu. Je ale dnes úterý. To nevadí, plán platí.",
    "Dnes se rozhodneš, že budeš víc odpočívat. V roce 2027.",
    "Dnešní tip: usměj se na někoho bez důvodu. Tohle nedá do kalendáře, ale hvězdy si toho všimnou.",
    "Dnes ti někdo pošle neplánovanou zprávu. Zpracuješ ji do tří dnů v tabulce „Zpráva, nezařazeno“.",
    "Dnes se ti poštěstí vtipně reagovat na poradě. Nikdo si toho nevšimne. Hvězdy ti zatleskají zvlášť.",
    "Dnes si dáš oběd. Bude to těžký pracovní oběd na vzdáleném stole. Hvězdy se zeptají, jestli máš plán B.",
    "Dnešní varování: pokud na tebe někdo zavolá „pojďme na pivo“, ověř, že to není v kalendáři jako „schůzka“.",
  ],
  q: [
    "Mám rezervaci na 19:00. Přesně. Přijdu v 18:52. Ani o minutu dřív ani později.",
    "Víkend? Mám tři pracovní úkoly, jednu schůzku a dvacet minut na „volný čas“. Můžeme ho využít spolu.",
    "Odpověď připravím do zítra. Zítra také bude plán na pozítří.",
    "Nádobí je v režimu „nutné a efektivní“. Dám ti 8 minut a časovač. Jdeme.",
    "Dovolená? Skvělé. Zjistím, kde je dobré připojení. Pokud možno s konferenční místností.",
    "Dokument o vývoji kapitálových trhů. Nebo něco poučného. Jinak se mi film nezapočítá.",
  ],
};

// ---------------------------------------------------------------------------
// VODNÁŘ: jiný než všichni ostatní, jako všichni ostatní Vodnáři
// ---------------------------------------------------------------------------
const VODNAR: RawSign = {
  h: [
    [
      "Vodnář: originální, nezávislý a občas na jiné planetě. Hvězdy to berou sportovně.",
      "Vodnář přináší nápady, které předběhly dobu. Doba na ně zatím čeká v bezpečné vzdálenosti.",
      "Neotřelost, svobodomyslnost, zvědavost. Přesně tak, jak se to píše v horoskopech.",
    ],
    [
      "Vodnář je jiný než všichni ostatní. Jako všichni ostatní Vodnáři.",
      "Máš 47 revolučních nápadů. Čtyřicátý osmý je dokončit aspoň jeden.",
      "Tvoje „nikdo mě nechápe“ je tak populární, že už si ho nikdo nechce nechat pro sebe.",
    ],
    [
      "Vodnář chce změnit svět. Zatím začal u uspořádání knihovny. Ta se mění pořád.",
      "Tvoje názory jsou tak progresivní, že je ani ty nestačíš dohnat.",
      "Máš nezávislý názor na všechno. Hlavně na věci, o kterých nic nevíš.",
    ],
    [
      "Cit není tvoje silná stránka. Je to přece jen pocit, ne tabulka.",
      "Slovo „blízkost“ ti zní jako cizí jazyk. Rozumíš, ale mluvit na to nechceš.",
      "Vodnář nechodí s davem. Obvykle už stojí na vedlejší louce a tvrdí, že tam je lépe.",
    ],
    [
      "Uran odmítl komunikaci s tebou. Prý to začíná být „příliš originální i pro něj“.",
      "Vesmír tě zapsal jako „jediný exemplář svého druhu“ a hned žádá o výjimku.",
      "Tvoje myšlenky už opustily sluneční soustavu. Posílají pohlednice a žádají o víc prostoru.",
    ],
  ],
  c: [
    [
      "Umíš vidět věci jinak. Astronomové tomu říkají „pohled z orbitu“.",
      "Máš sen o lepším světě. Hvězdy jej podporují, i když jsou v něm lepší židle než jejich.",
    ],
    [
      "Tvoje oblíbená slova: „Dá se to dělat jinak.“ Nikdo se neptal, jak, ale všichni čekají.",
      "Hvězdy tě mají rády, protože nikdo neví, co uděláš. Ani ty.",
    ],
    [
      "Nikomu se nepodřizuješ. Jen té myšlence, že se nikomu nepodřizuješ.",
      "Tvůj humor se vyplatí až příští generaci. A možná ani tak.",
    ],
    [
      "Emoční dostupnost? Kniha se zamčeným sklepem. Nikdo nezná klíč.",
      "Revoluce probíhá, ale zatím jen v konceptu. Hvězdy čekají na první verzi.",
    ],
    [
      "Vesmír se tě pokusil napravit. Podal návrh, dostal odpověď „Jsem originál“ a stáhl se do vedlejší galaxie.",
      "Uran tě nabídl jako dar jiné galaxii. Galaxie vrátila s komentářem: „Příliš originální.“",
    ],
  ],
  v: [
    [
      "Verdikt: jiskra světa. Jen občas zapomene, že ji vidí i ostatní.",
      "Hvězdy radí: zkus aspoň jeden nápad nahlas. Možná se ho chytí.",
    ],
    [
      "Rada hvězd: dokonči jeden z těch čtyřiceti sedmi. Pak teprve začni čtyřicátý osmý.",
      "Verdikt: svobodomyslný, nezávislý, nepostradatelný. Také nedostupný.",
    ],
    [
      "Verdikt: tvoje myšlenky jsou o generaci před svou dobou. Škoda, že doba zatím nepřišla.",
      "Rada: zkus někoho obejmout. Nemusí to znamenat změnu světového řádu.",
    ],
    [
      "Verdikt: tvoje originalita má jedinou vadu: je tak originální, že ji nikdo neumí okopírovat.",
      "Rada hvězd: občas se spoj s davem. Třeba jen pro zajímavost. Mají tam dobré jídlo.",
    ],
    [
      "Verdikt vesmíru: svět ještě není připraven. Tvůj nápad byl odložen na další velký třesk.",
      "Rozsudek: povinná jedna konvenční věc ročně. Doporučeno: jít na oběd, jako všichni.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce jsi svobodný duch. Partner tě miluje za originalitu. Teď ještě zjistit, kde je.",
        "Rande s tebou je neotřelé: občas v zoo, občas v muzeu, občas na vzdálené planetě.",
        "Tvoje láska je zvláštní směs přátelství, zvědavosti a občas pozvánky na debatu o smyslu bytí.",
      ],
      [
        "Slovo „vztah“ ti připadá jako formulář. Partner by ho rád vyplnil. Ty už jsi dávno mimo systém.",
        "Když partner řekne „potřebuju tě“, ty se zeptáš, jestli je to experiment, nebo manifest.",
        "Tvoje citová dostupnost je jako Wi-Fi na horách: je tam, jen si musíš najít správné místo.",
      ],
    ],
    prace: [
      [
        "V práci přicházíš s nápady, které předběhly dobu. Šéf je uloží do složky „Příští desetiletí“.",
        "Kolegové si tě váží. Hlavně proto, že občas řekneš něco, co se ukáže jako pravda. Za dva roky.",
        "Práci děláš po svém. Pravidla bereš jako návrh. A návrhy jako výzvu.",
      ],
      [
        "Tvoje ranní porada: „Co kdybychom to celé zrušili a začali znovu?“ Nikdo se neptá, co přesně.",
        "Na poradě sedíš zamyšleně. Po poradě se dozvíš, že se hlasovalo. A že tvůj hlas byl proti.",
        "Pracovní doba je pro tebe pojem z jiné civilizace. Dovolená ještě víc.",
      ],
    ],
    zivot: [
      [
        "Život je pro tebe experiment. Hypotéza se mění každý týden a výsledky se nikam nezapisují.",
        "Máš spoustu zájmů a málo času. Zatímco ostatní vybírají, ty si vybíráš všechno.",
        "Tvůj byt vypadá jako výstava. Návštěvníci si nejsou jistí, jestli smí sedět na umění.",
      ],
      [
        "Tvoje představa lepšího světa je tak podrobná, že by stačila na vlastní stát. Mapa už existuje.",
        "Když tě někdo vyzve k „normálnosti“, odpovíš „A co to je?“. Pak patnáct minut diskutuješ.",
        "Ve tvém životě je jen jedno pravidlo: žádná pravidla. A těch pravidel je celkem dvanáct.",
      ],
    ],
    pratele: [
      [
        "Znáš lidi z celého světa. Všechny přes obrazovku.",
        "Přátelé tě milují za nápady. Hlavně za ty, které vymyslíš večer a ráno už je nepamatuješ.",
        "S tebou se debata nikdy nenudí. Hlavně proto, že ji nikdo nedokáže doříct do konce.",
      ],
      [
        "Přátelé tě občas hledají. Zjistí, že jsi na kurzu hry na neznámý nástroj. V jiné zemi.",
        "Když máš přijít na oslavu, tvoje odpověď zní: „Zkusím.“ Přátelé to přeloží jako „Nepřijdu, ale mám dobrý důvod.“",
        "Kamarádi vědí, že ti nikdy nesmí říct, že je něco „normální“. Pak je čeká dvouhodinová přednáška.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny slavíš originálně: bez dortu, s experimentem a s hosty, kteří se vzájemně neznají.",
        "Dárek, který chceš, nikdo neumí koupit, protože zatím neexistuje. Ty ho právě vymýšlíš.",
        "Přání ti píšou neobvykle kreativně. Většinou proto, že jinak by to nestálo za přečtení.",
      ],
      [
        "Pokud ti někdo dá klasický dárek, usměješ se a pak ho použiješ k něčemu úplně jinému.",
        "Slavit narozeniny ve stejný den jako všichni ostatní by bylo příliš konvenční. Slavíš je tedy ve čtvrtek.",
        "Na oslavě vedeš debatu o smyslu narozenin. Dort mezitím vychladne. A dozraje.",
      ],
    ],
  },
  s: [
    ["Revolučních nápadů", "47"],
    ["Dokončených revolucí", "0"],
    ["Konvenčních rozhodnutí letos", "1 (omylem)"],
    ["Citové dostupnosti", "Wi-Fi na horách"],
    ["Potřeby být jiný", "100 %"],
    ["Pravděpodobnost, že ti rozumí", "3 %"],
  ],
  d: [
    "Dnes dostaneš nápad, který změní svět. Do večera bude nahrazen jiným, ještě lepším.",
    "Uran dnes říká: buď sebou. Hvězdy se ptají, kterým z mnoha.",
    "Dnes ti někdo řekne, že jsi originál. Ty to pochopíš jako kompliment. A taky budeš mít pravdu.",
    "Dnešní konstelace: kreativita, odtažitost a jedna aplikace, kterou nikdo kromě tebe nezná.",
    "Dnes se rozhodneš nedělat nic konvenčního. Hvězdy ti doporučují nezačínat dnešním dnem.",
    "Dnes ti někdo navrhne spolupráci. Ty odpovíš „Možná.“ Možná znamená „Nikdy to neuděláme stejně.“",
    "Dnes budeš mít revoluční nápad na sobotní oběd. Do pondělí bude zapomenut.",
    "Dnešní tip: zkus se dnes zeptat, jak se někdo má. A pak poslouchej. Je to nová technologie.",
    "Dnes ti dojde, že se nikdo neptal, jestli o záchranu stojí. Zítra to zapomeneš.",
    "Dnes budeš někomu vysvětlovat, jak by se mělo žít. Bude ti to připadat jako služba lidstvu.",
    "Dnes narazíš na někoho podobného. Hvězdy to označí za „nežádoucí konkurenci“.",
    "Dnešní varování: pokud ti někdo řekne, že jsi „typický Vodnář“, nepanikař. Má pravdu.",
  ],
  q: [
    "Pojďme někam, kde ještě nikdo není. Pokud je plno, přijdeme později. Nebo vůbec.",
    "Víkend? Dva workshopy, jedna přednáška o budoucnosti a večer experiment s obývákem. Pojď.",
    "Odpovím. Nebo se na tu otázku podívám z jiného úhlu. Nebo ji zrušíme. Podle nálady.",
    "Nádobí je sociální konstrukt. Ale dobře, umyju to. Pouze ale podle vlastního systému.",
    "Do země, která zatím nemá turistiku. Nebo která ji ještě nezvládla vynalézt.",
    "Dokument o zapomenutém vynálezci. Nebo cokoli, co nikdo nezná. Mainstream si nechám na jindy.",
  ],
};

// ---------------------------------------------------------------------------
// RYBY: žijí v oblacích. Wi-Fi tam nechytá, to je záměr.
// ---------------------------------------------------------------------------
const RYBY: RawSign = {
  h: [
    [
      "Ryby: snílek s citlivým srdcem a kapesníkem pro každou příležitost.",
      "Ryby vidí svět krásněji, než je. Hvězdy jim to nechávají, protože to funguje.",
      "Máš soucit s každým, včetně lidí, kteří si to nezaslouží. A kafe pro ně.",
    ],
    [
      "Ryby jsou vždy na cestě. Jen nikdo neví, kam. A ty to zjistíš nejdřív za týden.",
      "Říkáš „budu tam za chvilku“ a myslíš, že se právě oblékáš. Ve své hlavě už jedeš.",
      "Představivost máš tak bohatou, že občas zapomeneš, která verze příběhu byla ta pravdivá.",
    ],
    [
      "Ryby plynou. S proudem, proti proudu, někdy úplně mimo řeku. Hvězdy se ptají, kde je mapa.",
      "Máš sen. Ve skutečnosti pět snů. A ve snu si plánuješ další.",
      "Tvůj kalendář vypadá jako akvarel: krásné, rozmazané a těžko čitelné.",
    ],
    [
      "Ryby jsou nejlepší v útěku od reality. Hvězdy zjistily, že na to máš permanentku.",
      "Slovo „realita“ se u tebe píše v uvozovkách a mluví se o něm s ironií.",
      "Tvoje paměť je výběrová jako dobrý příběh: drží jen to, co se hodí do filmu.",
    ],
    [
      "Neptun se otočil: „Nic ti nezazlívám. Jen přestaň posílat pohlednice z oblaků.“",
      "Vesmír tě poslal na místo, kde se vyřizují žádosti o snění. Úředník spí. Vlastně sní.",
      "Tvoje představivost spadla do černé díry. Vesmír tvrdí, že je to ta nejhezčí.",
    ],
  ],
  c: [
    [
      "Umíš cítit to, co ostatní zamlčují. Ryby jsou jako dobrá hudba: nic neříkají, ale všechno chápeš.",
      "Máš dar vidět krásu i tam, kde ostatní vidí jen úterý.",
    ],
    [
      "Pro tebe neplatí „kolik je hodin“. Platí „jaká je nálada okolo“.",
      "Plány děláš s láskou. A pak je zapomeneš na lavičce v parku.",
    ],
    [
      "Neumíš říct ne. Hvězdy to bohužel vidí tak, že jsi dobrovolník na všechno.",
      "Ztrácíš věci rychleji, než je stihneš najít. Hvězdy ti doporučují jednu poličku a zázrak.",
    ],
    [
      "Tvoje zpoždění není nespolehlivost. Je to umělecký záměr, který zatím nikdo nepochopil.",
      "Když se zeptáš sebe „Co chci?“, odpověď se ztratí někde mezi oblaky a zmrzlinou.",
    ],
    [
      "Neptunova hluboká voda tě pozvala na plavbu snů. Palubní lístek máš, jen ho zase hledáš.",
      "Vesmír tě poslal do reality. Po dvou minutách přišel vzkaz: „Není to ono.“",
    ],
  ],
  v: [
    [
      "Verdikt: srdce jako oceán a hlava v oblacích. Hezká kombinace.",
      "Hvězdy radí: nech si něco zdát. Ale poznamenej si to, než zmizí.",
    ],
    [
      "Rada hvězd: občas se probuď. Aspoň na oběd a na poštu.",
      "Verdikt: jemný, laskavý a úplně neorientovaný. To se hodí na dobré příběhy.",
    ],
    [
      "Verdikt: tvoje intuice je skvělá. Tvoje orientace v čase je poezie.",
      "Rada: napiš si, kde je klíč. A pak si napiš, kde je ta poznámka.",
    ],
    [
      "Verdikt: zdržuješ ostatní, protože ve světě vidíš víc, než tam je. Aspoň je tam hezky.",
      "Rada hvězd: občas zkus realitu. Je to zdarma. A někdy je překvapivě dobrá.",
    ],
    [
      "Verdikt vesmíru: odložit, rozplynout, ztratit se v mlze. Ale šťastně.",
      "Rozsudek: povinné jedno rozhodnutí do konce týdne. Dobrovolně. Hvězdy budou čekat. Dlouho.",
    ],
  ],
  t: {
    vztahy: [
      [
        "V lásce jedeš naplno. Partner dostane báseň, svíčku a mix hudby, který trvá čtyři hodiny.",
        "Tvoje empatie je tak silná, že vycítíš, jak se partner cítí, ještě než se partner dozví, že se tak cítí.",
        "Rande s tebou bývá pohádka. Končí buď dobře, nebo ve čtyři ráno nad hrnkem čaje.",
      ],
      [
        "Říkáš „je to v pohodě“ a doufáš, že partner pozná, že ne. Hvězdy se mu omlouvají předem.",
        "Zamilovat se pro tebe znamená: vidět v člověku to nejlepší. Hlavně to, co tam ještě není.",
        "Tvoje hranice jsou jako obrysy mraku: jsou tam, ale nikdo je nevidí. A mění se s větrem.",
      ],
    ],
    prace: [
      [
        "V práci jsi tvořivost a cit v jednom. Kolegové se na tebe obracejí, když potřebují radu, útěchu nebo nápad na dárek.",
        "Tvoje nápady přicházejí neočekávaně: v tramvaji, ve sprše a během porady. Naštěstí máš poznámkový blok.",
        "Pracuješ nejlíp, když se necítíš pod tlakem. Což znamená, že pracuješ nejlíp, když nikdo nevidí, že pracuješ.",
      ],
      [
        "Šéf: „Kde je to, co jsem chtěl?“ Ty: „Je to hotové. V hlavě. Ve snu to bylo dokonalé.“",
        "Deadline pro tebe znamená „zhruba v tu dobu“. Šéf to chápe jako „přesně“. Hvězdy jsou na straně šéfa.",
        "Zapomínáš na schůzky, protože tvůj kalendář není dobrý v připomínání. Hvězdy říkají, že je to tvůj hlavní talent.",
      ],
    ],
    zivot: [
      [
        "Život ti připadá jako dlouhý sen, ve kterém občas zazvoní budík. Pak ho odložíš.",
        "Máš v sobě tolik hudby, obrazů a nápadů, že se ti ten týden zdá krátký. Nebo dlouhý. Nebo vlastně jiný.",
        "Dokážeš se ztratit i v místnosti, kterou máš doma deset let. Navigace to vede jako „procházku v hlavě“.",
      ],
      [
        "Nejlepší nápady máš ve sprše. Nejhorší je, že ve sprše nemáš poznámkový blok.",
        "Klíče, sluchátka a telefon: tři věci, které se ti ztratí denně. Hvězdy ti doporučují jednu věc: tři kopie.",
        "Tvoje kalendářní aplikace je jako vzdálená cizí planeta: občas na ni zapomeneš, ale pořád tam je.",
      ],
    ],
    pratele: [
      [
        "Vždycky vycítíš, že je něco v nepořádku. Většinou dřív než dotyčný sám.",
        "Přátelé za tebou chodí s trápením a odcházejí s úsměvem. Odborně: „terapie bez ceny“.",
        "Ve skupinovém chatu jsi ten, kdo pošle nejhezčí GIF a jako poslední odpoví na otázku.",
      ],
      [
        "Přátelé se naučili: „Sejdeme se v pět“ znamená „Zhruba v šest, ale určitě s hezkým příběhem“.",
        "Tvoje „ozvu se“ je upřímné. Opravdu. Jen se zatím neozvalo.",
        "Když ti kamarád svěří problém, ty se rozpláčeš. A on tě musí utěšovat. Hvězdy tomu říkají „oboustranná pomoc“.",
      ],
    ],
    narozeniny: [
      [
        "Narozeniny jsou pro tebe svátek snění. Dort, svíčky a přání, které si nenecháš říct nahlas.",
        "Dárek, který tě dojme, je ruční a drobný. Většinou ho dostaneš od někoho, kdo ví, že máš slabost pro věci s příběhem.",
        "Při přáních se rozpláčeš. Ne smutkem, ale dojetím. Nebo hudbou. Nebo dortem. To je jedno.",
      ],
      [
        "Slavit narozeniny včas je pro tebe výzva. Většinou je slavíš tehdy, kdy si na to vzpomeneš.",
        "Dort dostaneš a řekneš „To je tak krásné.“ Pak ho nesníš, protože je moc hezký.",
        "Hosté chodí postupně. Ty už mezitím stihneš zapomenout, kdo je pozval. Ale všechny vítáš s radostí.",
      ],
    ],
  },
  s: [
    ["Ztracených klíčů za měsíc", "6"],
    ["Slz u reklamy", "3 týdně"],
    ["Zpoždění „zhruba v pět“", "1 h 14 min"],
    ["Okamžiků „kde to je?“", "11 denně"],
    ["Snů, které se dnes vrátí", "5"],
    ["Pravdivost věty „budu tam za chvilku“", "9 %"],
  ],
  d: [
    "Dnes budeš snít. Hvězdy doporučují dělat to v pracovní době jen mírně.",
    "Neptun dnes šeptá: zapomeň na plán. Ostatní planety se ptají, jaký.",
    "Dnes ti někdo ukáže hezký obrázek. Ty se dojmeš. Pak ztratíš telefon.",
    "Dnešní konstelace: oblak, hudba a jedna hluboká myšlenka, kterou zapomeneš dřív, než ji řekneš.",
    "Dnes ti někdo přinese kafe. Ty uvěříš, že je to znamení. A možná budeš mít pravdu.",
    "Dnes se rozhodneš žít víc v přítomnosti. Do oběda to půjde. Pak se zase rozplyneš.",
    "Dnešní tip: napiš si to, co ti dnes přišlo na mysl. Pak napiš, kam jsi ten papír dal.",
    "Dnes budeš chtít všem pomoct. Hvězdy se obávají, že pomůžeš i těm, co o to nežádali.",
    "Dnes ti přijde, že se čas zastavil. Hvězdy tomu říkají „oběd“.",
    "Dnes budeš mít krásný nápad. Je pět minut před poradou. Naštěstí se ho zítra zeptáš znovu.",
    "Dnes se rozplačeš u hudby, u reklamy a u pohledu na hezkou fontánu. Hvězdy to berou jako rozcvičku.",
    "Dnešní varování: pokud ti někdo nabídne „malou službu“, rozmysli si to. A pak ji stejně uděláš.",
  ],
  q: [
    "Někde, kde hraje hudba a nikdo se nehádá. Pokud takové místo najdeš, zavolej mi. Já se ztratím cestou.",
    "Víkend? Procházka, kniha, zapomenutý plán a hodina koukání do oken. Je to perfektní.",
    "Odpověď… ano, měla by přijít. Jen se chvíli dívám z okna. Chvilku. Možná dvě.",
    "Nádobí… ano. Hned. Jen se nejdřív podívám, jak hezky se v něm odráží světlo. Pak vlastně umyju.",
    "Tam, kde je moře, kniha a nikdo se neptá, kolik je hodin. Hlavně bez budíku.",
    "Něco hezkého a smutného. Ať se můžu rozplakat a pak mít skvělý večer.",
  ],
};

// ---------------------------------------------------------------------------
// Veřejný export
// ---------------------------------------------------------------------------

export const FRAGMENTS: Record<SignId, SignFragments> = {
  beran: expand(BERAN),
  byk: expand(BYK),
  blizenci: expand(BLIZENCI),
  rak: expand(RAK),
  lev: expand(LEV),
  panna: expand(PANNA),
  vahy: expand(VAHY),
  stir: expand(STIR),
  strelec: expand(STRELEC),
  kozoroh: expand(KOZOROH),
  vodnar: expand(VODNAR),
  ryby: expand(RYBY),
};
