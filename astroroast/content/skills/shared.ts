// AstroRoast.ai: sdílené (na znamení nezávislé) texty tohoto modelu. Ručně psané originální české fragmenty.
// Pravidla autora jsou v hlavičce content/<model>/signs/*.ts. Tvary držíme shodné s druhým modelem.

import type { Topic } from "../../types";
import type { CouplePairContent, ElementPairKey, Five } from "../types";

/**
 * Závěrečná věta roastu podle tématu a úrovně (4 na buňku, žebříček 1-5: pohlazení, šťouchnutí,
 * sarkasmus, roast, kosmická poprava). Platí pro libovolné znamení, proto bez rodových tvarů.
 */
export const KICKERS: Record<Topic, Five<string[]>> = {
  vztahy: [
    [
      "Partner už ví, že „za pět minut jsem tam“ znamená čtvrt hodiny. Přesto čeká. To je láska.",
      "Z obyčejného úterý umíš udělat malý svátek. Stačí koblih z pekárny a pár vět navíc.",
      "S partnerem si nejlíp rozumíte v tichu u seriálu: dva lidé, jeden pléd, žádná hádka o ovladač.",
      "Máš v sobě dost lásky, aby partner přežil i tvoje boty uprostřed předsíně.",
    ],
    [
      "Tvůj protějšek přesně zná, jak zní tvoje „já jsem v pohodě“. Zatím to nahlas nekomentuje.",
      "Chodit s tebou je dobrodružství. Hlavně ve chvíli, kdy se ptáš „co je?“ a odpověď vlastně nechceš.",
      "Spor s tebou končí remízou. Ve tvých vlastních statistikách vítězstvím.",
      "Partner zná tvoje oblíbené věty zpaměti. Při třetím opakování ještě předstírá překvapení, ze slušnosti.",
    ],
    [
      "Pokud tě partner snáší, je to buď láska, nebo trénink. Hvězdy tipují trénink a přijímají sázky.",
      "Romantika s tebou funguje jako jízdní řád ČD: existuje, je pěkně vytištěný a nikdo na něj nespoléhá.",
      "Říkáš, že vztah je tvoje priorita. Partner by to ocenil písemně, třeba magnetkou na lednici.",
      "Tvoje vztahy mají šťastný konec. Jen se k němu jede přes tři „musíme si promluvit“.",
    ],
    [
      "Rande s tebou začíná romantikou a končí poradou, kdo to začal. Zápis z jednání dorazí do pátku.",
      "Máš ve vztahu jistotu: pořád ta samá hádka, jen s novým osvětlením a lepším slovníkem.",
      "Tvůj protějšek má v telefonu poznámku „co říct, až se zeptá“. Je delší než nákupní seznam na Vánoce.",
      "Partner si vede kalendář tvých nálad. Dnešní zápis: „nezapojovat, nekomentovat, neotevírat lednici“.",
    ],
    [
      "Venuše svolala mimořádné slyšení kvůli tvým vztahům. Přišel jen Merkur a za všechny se omluvil.",
      "Kupidovi vrátili šíp s poznámkou „takhle ne“ a nabídli mu dovolenou na Neptunu.",
      "Hubbleův teleskop zachytil tvou hádku o to, kdo vyndá myčku. Sedm galaxií to vzdalo.",
      "Mezigalaktický matriční úřad zavedl pro tvé vztahy novou kolonku: „zasnoubení s výhradami“.",
    ],
  ],
  prace: [
    [
      "Jedním vtipem umíš zachránit pondělní poradu. Kolegové to nepřiznají, ale kávu ti nalévají s vděkem.",
      "Šéf o tobě říká, že na tebe je spoleh. Dnes to poprvé řekl nahlas a před lidmi.",
      "Tvoje nadšení pro projekt je nakažlivé. Tým to zjistí kolem třetí porady a pak se vrací dobrovolně.",
      "Kolegové tě mají rádi. Hlavně v pátek odpoledne, když přineseš dortík z pekárny.",
    ],
    [
      "Tvoje zápisky ze schůzky jsou zápisky o schůzce o schůzce.",
      "Šéf o tobě mluví s úctou. A taky s kalendářem v ruce, protože tvoje termíny jsou orientační.",
      "Práci bereš vážně. Oběd je u tebe nepovinný bod programu.",
      "Tvůj e-mailový podpis je delší než zpráva nad ním. Působí to nesmírně profesionálně.",
    ],
    [
      "Tvoje pracovní tempo zajímá i hvězdy. Zatím ho vedou jako „zajímavý případ k pozorování“.",
      "Každý den hrdinně bojuješ s doručenou poštou. Doručená pošta vede na body, 214 : 3.",
      "Kolegové říkají, že bez tebe by to nešlo. Hvězdy dodávají, že to říkají hlavně ve čtvrt na pět v pátek.",
      "V práci máš jasné priority. Jen se každé ráno jmenují jinak.",
    ],
    [
      "Životopis říká „týmový hráč“. Kolegové říkají „týmový hráč, co hraje sám a vítězství bere za všechny“.",
      "Tvůj pracovní postup se podobá tvé poradě: dlouhý, hlasitý a nikdo si nepamatuje, kam vedl.",
      "Kolegové tě vedou v kopii u všeho. Nikdo nečeká, že odpovíš, a ty to dodržuješ přesně jako hodinky.",
      "Termín je u tebe přátelské doporučení. Kolegové ho před tebou píšou o týden dřív a malým písmem „skutečně“.",
    ],
    [
      "Saturn přezkoumal tvé pracovní výsledky a vrátil je s poznámkou „nad rámec tabulky, nad rámec sluneční soustavy“.",
      "Vesmírná personalistka založila složku s tvým jménem. Obsahuje jedinou větu: „Ale má potenciál.“",
      "Merkur, bůh poslů, odmítl doručit tvůj e-mail. Prý v něm chyběla příloha. Už po sedmé.",
      "NASA vede tvůj stůl jako samostatnou sluneční soustavu. Kolem hrnku obíhá devět nepřečtených poznámek a jeden tácek.",
    ],
  ],
  zivot: [
    [
      "Život s tebou je jako film, který se nechce vypnout, ani když už dávno běží titulky.",
      "Hvězdy tě mají rády. A to jim za to nikdo neplatí.",
      "Máš talent na hezké okamžiky: lavička na slunci, poslední kousek koláče, zelená na semaforu.",
      "Kdo tě zná, ví, že s tebou má děj i čekání na autobus.",
    ],
    [
      "Tvůj život je zábavný jako návod na skříň z IKEA: každý krok dává smysl, než zjistíš, že zbyl šroub.",
      "Plánuješ pravidelně a dodržuješ nepravidelně. Statisticky vyrovnané.",
      "Dnes je dobrý den začít něco nového. Nebo konečně dojet to, co ti od ledna leží na stole.",
      "Na všechno máš plán. Jen v něm nikdy není uvedeno, ve kterém roce začíná.",
    ],
    [
      "Žiješ svůj nejlepší život. Hvězdy by uvítaly tišší režim.",
      "Tvůj život má jasný směr. Mění se podle toho, co ti naposledy někdo doporučil na internetu.",
      "Optimismus ti vydrží jako baterie v ovladači: někde ji máš, jen nikdy nevíš kde.",
      "Říkáš, že všechno zvládáš s lehkostí. Ta lehkost má bohužel hodně těžká zavazadla.",
    ],
    [
      "Tvoje životní plány jsou jako zimní bunda v červenci: nadějné, objemné a nikdy po ruce, když jsou potřeba.",
      "Změna života je na seznamu od ledna. Mezi „od pondělí“ a „už zítra“ vesmír naměřil jedenáct měsíců.",
      "Smysl života je podle galaxie 42. Tvůj osobní součet zatím stojí na 17, a to s kalkulačkou.",
      "Tvůj denní režim: ráno předsevzetí, odpoledne výmluva, večer nové předsevzetí. Aspoň je stabilní.",
    ],
    [
      "Vesmír roztřídil tvůj život do dvou složek: „Dopadlo to dobře“ a „Zatím to dopadá“. Druhá potřebuje další úložiště.",
      "Černá díra před tebou zavřela dveře. Prý je plná a tvůj nepořádek by se tam nevešel.",
      "Hvězdy zvažují, že tvůj spis vystaví v muzeu. Pod názvem „Jak se to dělat nemá, a přesto to jde“.",
      "Mezigalaktický úřad pro životní směřování zřídil pro tvůj případ samostatnou přepážku. Fronta tam stojí od Velkého třesku.",
    ],
  ],
  pratele: [
    [
      "Kamarádi si tvoje narozeniny pamatují bez kalendáře. To nemá každý a ty to víš.",
      "Kamarádi jsou jediní lidé, kteří mají tvoje trapasy v archivu a pořád ti píšou.",
      "Přátelství s tebou je jako dobrý seriál: nikdy nevíš, co bude příště, a nikdo nechce skončit.",
      "Kolem sebe máš lidi, kterým se při pohledu na tvoje jméno v telefonu rozsvítí úsměv. Ostatním volá hlavně pojišťovna.",
    ],
    [
      "Skupinový chat bez tebe je jen sdílení pozvánek. S tebou je to aspoň seriál.",
      "Kamarádi tě znají. A přesto čekají na další díl.",
      "Přátelé ti odpouštějí. Hlavně proto, že nikdo jiný by si tvoje historky nevyslechl dvakrát.",
      "Káva domluvená v pondělí se koná nejpozději v dubnu. Kamarádi s tím počítají.",
    ],
    [
      "Přátelství s tebou je kurz trpělivosti. Kamarádi ho berou dobrovolně a už několik let bez diplomu.",
      "Přátelé tě mají rádi jako dobrý filmový zvrat: když přijde, všichni se zasmějí, a pak se dívají na hodinky.",
      "Říkáš „ozvu se“ tak přesvědčivě, že to kamarádi začali brát jako folklor.",
      "Přátelé tě milují za to, že vždycky dorazíš. Občas dokonce na správný den.",
    ],
    [
      "Tvůj nejlepší kamarád zná všechny tvoje výmluvy po jménu. Ty nejoblíbenější mají přezdívky.",
      "Přátele máš skvělé. Hlavně proto, že nikdo nevede statistiku tvých „omlouvám se, zaspalo se mi“.",
      "Přátelé tě mají rádi navzdory výsledkům hvězdné analýzy. To je lojalita.",
      "Tvoji kamarádi mají na tvoje „už jedu“ vlastní převodník: přičti hodinu a doufej.",
    ],
    [
      "Skupinový chat s tebou má vlastní galaxii. První zpráva v ní zní „viděno“.",
      "Vesmír svolal summit tvých přátel. Jediný bod programu: „Kdy se konečně ozve?“",
      "Mléčná dráha tě zařadila do rubriky „vtipné, ale nedostupné“. Rubrika je plná od roku 1998.",
      "Mléčná dráha zřídila oddělení pro čekání na tvoje odpovědi. Zaměstnanci tam už vyvinuli vlastní civilizaci.",
    ],
  ],
  narozeniny: [
    [
      "Narozeniny jsou jediné datum, kdy ti hvězdy dovolí cokoli. Hlavně druhý kousek dortu.",
      "Dort, svíčky a pár lidí, kteří tě mají rádi. Víc k tomu hvězdy nepotřebují.",
      "Další oběh kolem Slunce a pořád v původním modelu. Hvězdy gratulují a nabízejí ještě jedno kolečko.",
      "Narozeniny ti patří celé. Hvězdy žádají jen jedno: ať je dort aspoň o patro vyšší než loni.",
    ],
    [
      "Hvězdy ti přejí originální dárek. Ne další ponožky s motivem planety.",
      "Hosté na tvé oslavě budou milí. Aspoň do čtvrté písničky.",
      "Narozeniny jsou jediný den v roce, kdy tě ostatní musí vydržet s úsměvem.",
      "Zhasnou světla, rozsvítí se svíčky a všichni zazpívají. Falešně, ale z hloubi duše.",
    ],
    [
      "Tvoje oslava má jednu velkou přednost: končí dřív, než se hosté pohádají o poslední kousek dortu.",
      "Hvězdy s tebou slaví. Z dálky, aby nemusely zpívat.",
      "Poděkování za přání chodí zpravidla do příštího roku. Hvězdy to berou jako tradici.",
      "Říkáš, že narozeniny neslavíš. Hosté mezitím stihli donést dort, balónky i vlastní židle.",
    ],
    [
      "Svíčky na tvém dortu mají vlastního revizního technika. Doporučil hasicí přístroj a plán evakuace.",
      "Narozeninová písnička zní u tebe jako cvičný poplach: všichni zpívají, nikdo neví, kdy skončit.",
      "Oslava se povedla. Hosté o ní mluví dodnes. Většinou šeptem.",
      "Na tvých narozeninách se pozná charakter: kdo dorazí včas a nezeptá se, kdy se bude jíst.",
    ],
    [
      "Vesmír ti na narozeniny připravil konfety ze zbytků supernovy. Úplně se nehodí k tvé pohovce.",
      "Saturn ti poslal přání s razítkem „Do vlastních rukou“. Doručovatel se vrátil po dvaceti letech a nepoznal vlastní rodinu.",
      "Hvězdy ti nechaly upéct dort velikosti Měsíce. Svíčky nestačí, bude potřeba Slunce.",
      "Slunce odmítlo pozvánku na tvou oslavu: dort plný svíček je prý i na něj moc horký.",
    ],
  ],
};

/** Závěrečné věty pro kamaráda (úrovně 1-3, 4 na úroveň, gradace od vlídné po ironickou). Posílá je ten, kdo roastuje. */
export const FRIEND_KICKERS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Roast od člověka, který ti napíše i v pátek večer, je ten nejupřímnější druh pozornosti.",
    "Kdo ti tohle poslal, má tě rád. Pro lidi, které nemá rád, nikdo nehledá pointy.",
    "Dostat takovou kartu znamená mít v telefonu aspoň jednoho člověka, který se u tebe může smát nahlas.",
    "Tohle nebylo myšleno zle. Hvězdy to potvrzují a odesílatel taky, s úsměvem.",
  ],
  2: [
    "Revanš je na místě. Přátelství se zkouší pošťouchnutím, ne dárkovou kartou.",
    "Kdo roastuje, myslí to dobře. Hvězdy tomu říkají „podmíněná láska“.",
    "Odesílatel tě zná dost dobře na to, aby měl pravdu. A dost slušně, aby ji zabalil do hvězd.",
    "Když se ti chce smát i bránit zároveň, aspoň trochu to sedí.",
  ],
  3: [
    "Kdo má tvoje trapné fotky a přesto zůstal, je opravdový přítel. To je láska.",
    "Odpověď „to nejsem já“ platí do chvíle, kdy se ozve druhý kamarád a napíše „je to přesně ty“.",
    "Máš tři možnosti: smát se, urazit se, nebo poslat revanš. Hvězdy tipují třetí.",
    "Hvězdy doporučují odpovědět do 24 hodin. Mlčení se vykládá jako souhlas.",
  ],
};

/** Generické fake statistiky podle tématu (4 na téma). */
export const TOPIC_STATS: Record<Topic, { label: string; value: string }[]> = {
  vztahy: [
    { label: "Hádky o to, kdo to začal", value: "4× týdně" },
    { label: "Omluv připravených v konceptech", value: "3" },
    { label: "Rande dokončených bez drobné katastrofy", value: "12 %" },
    { label: "Úspěšnost věty „nic se neděje“", value: "0 %" },
  ],
  prace: [
    { label: "Schůzek, které mohly být e-mail", value: "11 týdně" },
    { label: "Kolegů, kteří odpověděli před termínem", value: "38 %" },
    { label: "Hrnků kávy za pracovní den", value: "4,5" },
    { label: "Věrohodnost věty „dám vám vědět“", value: "2 %" },
  ],
  zivot: [
    { label: "Plánů, které přežily pondělí", value: "1 z 9" },
    { label: "Zpráv „odpovím později“ v konceptech", value: "217" },
    { label: "Nadšení z nápadu ve 23:30", value: "100 %" },
    { label: "Dnů, kdy vše jde podle plánu", value: "2 ročně" },
  ],
  pratele: [
    { label: "Ztlumených skupinových chatů", value: "9" },
    { label: "Slibů „ozvu se“ za pololetí", value: "40" },
    { label: "Odpovědí od kamarádů do týdne", value: "61 %" },
    { label: "Pozvánek, na které odpovíš „možná“", value: "73 %" },
  ],
  narozeniny: [
    { label: "Dortů přežitých bez fotky", value: "0" },
    { label: "Připomínek v kalendáři, které nikdo neviděl", value: "3" },
    { label: "Přání doručených včas", value: "22 %" },
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

export const COUPLE_PAIRS: Record<ElementPairKey, CouplePairContent> = {
  "ohen-ohen": {
    intros: [
      "Dva ohně v jedné místnosti. Hasiči už jedou, ale cestou se zastavili na párek v rohlíku.",
      "Dva plameny, jedna kamna. Kdo se první zeptá, kdo má pravdu, zjistí, že oba.",
    ],
    titles: ["Ohňostroj, který nikdo neobjednal", "Dvě sirky v jedné krabičce"],
    verdicts: [
      "Vztah, který se nikdy nenudí. Hasiči ho mají v oblíbených.",
      "Shořeli byste spolu, ale ještě se pohádáte, kdo zavolá hasiče.",
    ],
  },
  "ohen-zeme": {
    intros: [
      "Oheň a země: jeden chce vyrazit, druhý nejdřív ověřit mapu a předpověď počasí.",
      "Jedna půlka plánuje, druhá už sedí v autě. Obě tvrdí, že na tu druhou pořád čekají.",
    ],
    titles: ["Auto jede, mapa se hádá", "Rychle a důkladně, ale ne najednou"],
    verdicts: [
      "Jeden se naučí čekat, druhý spěchat. Zkouška proběhne na dovolené, před zavřenou chatou.",
      "Jeden pálí, druhý hasí. Voda by ocenila dovolenou.",
    ],
  },
  "ohen-vzduch": {
    intros: [
      "Oheň a vzduch: jeden zapaluje, druhý do toho fouká. Nikdo se neptá, jestli je to bezpečné.",
      "Vzduch má nápad, oheň má sirky. Návod k použití zůstal na chatě.",
    ],
    titles: ["Nápad, který chytil", "Vichřice s ohnivým chvostem"],
    verdicts: [
      "Nikdy se nenudíte. Občas se jen nenajdete.",
      "Skvělý tým na rozjezd. Na dojezd si hledejte někoho třetího.",
    ],
  },
  "ohen-voda": {
    intros: [
      "Oheň a voda: jeden zhasíná, druhý vře. Výsledku se říká „pára“.",
      "Jeden chce akci, druhý chce probrat pocity z té akce. Dohoda o pořadí trvá déle než akce.",
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
      "Dva stabilní lidé, jedna pohovka, která se nehnula od roku 2019.",
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
      "Jeden má tabulku, druhý nápady. Tabulka vždycky vyhraje, ale nápady o tom neví.",
    ],
    titles: ["Plán se vznáší", "Tabulka v oblacích"],
    verdicts: [
      "Doplňujete se výborně, když se zrovna nehádáte. Hádáte se většinu času.",
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
      "Tohle drží. Akorát se při tom občas zapomíná bavit.",
      "Voda živí zemi, země drží vodu. Všechno je v pořádku, dokud nezačne pršet.",
    ],
  },
  "vzduch-vzduch": {
    intros: [
      "Dva vzduchy: dvě hlavy plné nápadů a žádná dohoda o tom, kdo uklidí.",
      "Dva lidé, tři rozhovory a žádný z nich se nedokončí.",
    ],
    titles: ["Dvě rádia, jeden pokoj", "Dvě hlavy, nulová domluva"],
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
    titles: ["Ticho, které slyší celý byt", "Oceán nevyřčených vět"],
    verdicts: [
      "Rozumíte si bez slov. A to je problém, protože slov byste potřebovali víc.",
      "Máte nejhlubší vztah zvěrokruhu. Škoda, že nikdo nevytáhne kotvu.",
    ],
  },
  stejne: {
    intros: [
      "Dvě stejná znamení. Hvězdy to berou jako experiment bez kontrolní skupiny.",
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

/** Závěr scény podle úrovně páru (1-3), 4 na úroveň, gradace od vlídné po ironickou. */
export const COUPLE_OUTROS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Závěr komise: jste v pohodě. Tomuhle zjištění věnovala celý kosmický týden.",
    "Závěr kosmické komise: sladké, i když ne vždy bezpečné pro lednici.",
    "Kosmický zápis: oba vítězí. Remíza byla vyloučena, protože by pak nikdo neuklízel.",
    "Hvězdy vás vidí jako dvojici, která si rozumí i mlčením. Komise to označila za nadějné.",
  ],
  2: [
    "Kosmický zápis z jednání: oba vinni, oba milí.",
    "Hvězdy nařizují večeři, usmíření a žádné další otázky.",
    "Spis uzavřen s poznámkou „zvládnete to, ale rádi se budeme dívat“.",
    "Komise doporučuje kompromis: jeden z vás vybere restauraci a druhý předstírá, že to byl jeho nápad.",
  ],
  3: [
    "Hvězdy se na vás dívají jako na seriál, který už nejde zrušit.",
    "Verdikt komise: oba obžalovaní jsou stejně nemožní. Právě proto to funguje.",
    "Zápis: oba prohráli a oba si myslí, že vyhráli. Komise tomu říká láska a odchází na oběd.",
    "Komise vám uděluje titul „Nejvytrvalejší dvojice večera“. Součástí ceny je poukaz na usmíření.",
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
