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
      "Kdo tě miluje, bere tě i s tímhle. Je to vlastně docela romantické.",
      "Hvězdy radí: smích v páru je nejlepší horoskop.",
      "Ve vztahu děláš z úterý malý svátek. Partner to nahlas nepřizná, ale počítá s tím.",
      "Láska s tebou není dokonalá, ale je pravá. A to se počítá víc než dokonalost.",
    ],
    [
      "Tvůj protějšek už to ví. Jen se zdvořile tváří, že ne.",
      "Chodit s tebou je vzrušující. Hlavně ty části, které se nedají naplánovat.",
      "Láska vyhrává. Občas až po prodloužení.",
      "Partner tvoje oblíbené věty zná zpaměti. Občas jen předstírá překvapení, aby tě nezklamal.",
    ],
    [
      "Jestli tě partner snáší, je to buď láska, nebo mimořádná trpělivost. Hvězdy sázejí na tu druhou.",
      "Romantika s tebou je jako počasí: všichni chodí s deštníkem pro jistotu.",
      "Tvoje vztahy mají šťastný konec. Jen k němu vedou dlouhé reklamní přestávky.",
      "Říkáš, že vztah je tvoje priorita. Partner by rád aspoň jednou viděl seznam, kde je na prvním místě.",
    ],
    [
      "Jediná stálá věc ve tvých vztazích jsou ty samé hádky s lepším osvětlením.",
      "Nejsi těžký případ. Jsi případ s vlastním spisem a čtyřmi přílohami.",
      "Tvůj protějšek má v telefonu poznámku „co říct, až se bude ptát“. Je dlouhá.",
      "Rande s tebou začíná romantikou a končí tím, že se celý večer řeší, kdo to vlastně začal.",
    ],
    [
      "Venuše svolala mimořádné slyšení. Přišel jen Merkur a omluvil se za všechny.",
      "Kupidovi vrátili šíp s poznámkou „tohle nechceme“ a nabídli mu dovolenou.",
      "Planeta lásky přepnula tvůj spis do režimu „jen pro silné povahy“.",
      "Mezigalaktický úřad pro srdeční záležitosti zavedl pro tvé vztahy novou kolonku: „Nepředvídatelné, ale mimořádně hlasité“.",
    ],
  ],
  prace: [
    [
      "Kolegové tě mají rádi. Hlavně v pátek odpoledne, když přineseš dobrou náladu.",
      "V práci umíš rozjasnit i pondělní poradu. Kolegové to nepřiznají, ale kávu ti vděčně nalévají.",
      "Šéf tě oceňuje a kolegové ti věří. Jen to málokdy řeknou všichni naráz.",
      "Tvoje nadšení pro práci je nakažlivé. V rozumné dávce a bez vedlejších účinků.",
    ],
    [
      "Tvoje poznámky ze schůzky jsou bohužel poznámky o schůzce o schůzce.",
      "Šéf o tobě mluví s úctou. A trochu i s kalendářem v ruce.",
      "Práci bereš vážně. Tak vážně, že oběd je u tebe nepovinný bod programu.",
      "Tvůj e-mailový podpis je delší než zpráva nad ním. Ale působí to profesionálně.",
    ],
    [
      "Tvoje pracovní tempo vzbuzuje zájem hvězd. Zatím ho vedou jako „zajímavý případ“.",
      "Každý den hrdinně bojuješ s e-maily. Ty vyhrávají na body.",
      "Kolegové říkají, že bez tebe by to nešlo. Hvězdy dodávají, že to říkají hlavně tehdy, když něco potřebují.",
      "V práci máš jasné priority. Škoda, že jsou každé ráno trochu jiné.",
    ],
    [
      "Životopis říká „týmový hráč“. Kolegové říkají „týmový hráč, co hraje sám“.",
      "Tvůj pracovní postup je jako tvoje porada: dlouhý, hlasitý a nikdo si nepamatuje, k čemu došel.",
      "Kolegové na tebe vzpomínají v dobrém. Hlavně v nezodpovězených e-mailech.",
      "Deadline u tebe není termín, ale přátelské doporučení, které se s radostí překračuje.",
    ],
    [
      "Saturn odvolal veškeré pracovní zakázky pro tvou osobu s odůvodněním „nad rámec tabulky“.",
      "Vesmírná personalistka právě založila složku s tvým jménem. Obsahuje jedinou větu: „Ale má potenciál.“",
      "Merkur ti dnes odmítl poslat e-mail. Prý ho nedokáže doručit bez emocionální újmy.",
      "NASA vyhodnotila tvůj stůl jako samostatnou sluneční soustavu. Gravitace papírů tam přitahuje i ostatní kolegy.",
    ],
  ],
  zivot: [
    [
      "Život s tebou je jako dobrodružný film. Jen s trochou lepších titulků.",
      "Hvězdy tě mají rády. A to nejsou ani zaměstnanci.",
      "Máš talent na hezké okamžiky. Hlavně na ty, které se potají stanou.",
      "Svět je o kousek hezčí, když se do něj vmísíš. Hvězdy to nahlásily, ať to ví všichni.",
    ],
    [
      "Tvůj život je zábavný. Trochu jako návod, který se píše při čtení.",
      "Plánuješ pravidelně a dodržuješ to nepravidelně. Vyvážené.",
      "Dnes je dobrý den začít něco nového. Nebo dojet to, co už běží.",
      "Máš na všechno plán. Jen se nikdy nezmínil, ve kterém roce začíná.",
    ],
    [
      "Žiješ svůj nejlepší život. Hvězdy jen doufaly, že bude tišší.",
      "Tvůj život má jasný směr. Jen se mu občas zapomene říct, že je to vlastně jiný směr.",
      "Optimismus ti vydrží. Něco jako baterie v ovladači, který stejně nikdo nenajde.",
      "Říkáš, že všechno zvládáš s lehkostí. Ta lehkost má bohužel hodně těžká zavazadla.",
    ],
    [
      "Tvoje životní plány jsou jako zimní bunda v červenci: nadějné, objemné a nikdy po ruce, když je potřeba.",
      "Změna života je na seznamu. Vesmír tvrdí, že mezi rozhodnutím a činem leží čtvrtá dimenze.",
      "Smysl života je podle hvězd 42. Tvůj osobní součet je zatím 17.",
      "Tvůj životní styl je pověstný: ráno předsevzetí, odpoledne výmluva, večer nové předsevzetí.",
    ],
    [
      "Vesmír roztřídil tvůj život do dvou složek: „Dopadlo to dobře“ a „Zatím to dopadá“.",
      "Černá díra před tebou odmítla vstup. Prý je plná.",
      "Hvězdy zvažují, že tvůj spis vloží do muzea. Pod názvem „Jak se to dělat nemá, ale funguje to“.",
      "Mezigalaktický úřad pro životní směřování zřídil pro tvůj případ samostatnou přepážku. Čeká se tam od Velkého třesku.",
    ],
  ],
  pratele: [
    [
      "Přátele máš skvělé. Hvězdy jim to občas připomínají.",
      "Kamarádi jsou jediní lidé, kteří mají tvé trapasy v archivu a pořád ti píšou.",
      "Přátelství s tebou je jako dobrý seriál: nikdy nevíš, co bude příště, a nikdo nechce skončit.",
      "Kolem sebe máš lidi, kteří se usmějí už při pohledu na tvoje jméno v telefonu. To je to nejlepší, co se dá mít.",
    ],
    [
      "Skupinový chat je s tebou zábavnější. Hlavně když ho zrovna nikdo nemá ztlumený.",
      "Kamarádi tě znají. A přesto čekají na další díl.",
      "Přátelé ti odpouštějí. I proto, že nemají na výběr.",
      "Káva domluvená v pondělí se koná nejpozději v dubnu. Kamarádi s tím počítají.",
    ],
    [
      "Přátelství s tebou je dobrovolná zkouška trpělivosti. Hvězdy kamarádům přejí hodně štěstí.",
      "Tvoji přátelé tě mají rádi jako dobrý filmový zvrat: když přijde, všichni se zasmějí, a pak se dívají na hodinky.",
      "Říkáš „ozvu se“ tak důvěryhodně, že to začínají brát jako folklor.",
      "Přátelé tě milují za to, že vždycky dorazíš. Občas dokonce na správný den.",
    ],
    [
      "Tvůj nejlepší kamarád zná všechny tvoje výmluvy po jménu. Ty nejoblíbenější dostaly přezdívky.",
      "Máš skvělé přátele. A pozoruhodné štěstí, že mají radši přátelství než pravdu.",
      "Přátelé tě mají rádi navzdory výsledkům hvězdné analýzy. To je lojalita.",
      "Tvoji kamarádi mají na tvoje „už jedu“ vlastní převodník: přičti hodinu a doufej.",
    ],
    [
      "Skupinový chat s tebou si založil vlastní galaxii. První zpráva zní „viděno“.",
      "Vesmír svolal summit tvých přátel. Jediný bod programu: „Kdy se konečně ozve?“",
      "Na seznamu nejoblíbenějších lidí Mléčné dráhy tě vesmír zapsal do rubriky „vtipné, ale chaotické“.",
      "Mléčná dráha zřídila oddělení pro čekání na tvoje odpovědi. Zaměstnanci tam už vyvinuli vlastní civilizaci.",
    ],
  ],
  narozeniny: [
    [
      "Narozeniny jsou jediné datum, kdy ti hvězdy dovolí cokoli. Hlavně dort.",
      "Dort, svíčky a pár lidí, kteří tě mají rádi. Hvězdy by řekly, že to je celé.",
      "Další oběh kolem Slunce. Hvězdy blahopřejí a nabízejí ještě jedno kolečko.",
      "Narozeniny ti patří celé. Hvězdy žádají jen jedno: ať je dort aspoň o patro vyšší než loni.",
    ],
    [
      "Hvězdy ti přejí originální dárek. Ne další ponožky s motivem planety.",
      "Hosté na tvé oslavě budou milí. Aspoň do čtvrté písničky.",
      "Narozeniny jsou skvělá příležitost nechat ostatní, aby tě chvíli zvládali.",
      "Zhasnutá světla, svíčky a „zazpívejte mi“. Hosté tvé zadání splní, jen trochu falešně.",
    ],
    [
      "Tvoje narozeninová oslava má jednu velkou přednost: končí v čase, kdy už mají všichni dost.",
      "Hvězdy s tebou slaví. Dort si vzaly na dálku.",
      "Na poděkování za přání se čeká zpravidla do příštího roku. Hvězdy to berou jako tradici.",
      "Říkáš, že narozeniny neslavíš. Hosté mezitím stihli donést dort, balónky i vlastní židle.",
    ],
    [
      "Svíčky na dortu si ještě před zapálením žádají pojištění.",
      "Narozeninová píseň zní u tebe jako cvičný poplach: všichni zpívají, nikdo neví, kdy skončit.",
      "Oslava se podařila. Hosté o tom mluví dodnes. Většinou šeptem.",
      "Na tvých narozeninách se pozná dobrá vůle: kdo dorazí včas a nezeptá se, kdy se bude jíst.",
    ],
    [
      "Vesmír ti pro narozeniny nachystal konfety ze zbytků supernovy. Bohužel se úplně nesnesou s tvým nábytkem.",
      "Saturn ti zaslal přání s razítkem „Do vlastních rukou“. Pošťák utekl.",
      "Hvězdy si pro tebe nechaly vyrobit dort velikosti Měsíce. Svíčky nestačí. Bude potřeba slunce.",
      "Slunce obdrželo pozvánku na tvou oslavu. Odmítlo s tím, že na dort plný svíček je tam už moc horko.",
    ],
  ],
};

/** Závěrečné věty pro kamaráda (úrovně 1-3, 4 na úroveň, gradace od vlídné po ironickou). Posílá je ten, kdo roastuje. */
export const FRIEND_KICKERS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Roast od někoho, komu na tobě záleží, je nejlepší druh roastu. Opravdu.",
    "Kdo ti tohle poslal, má tě rád. Roastovat se dá jen ten, koho chceš mít poblíž.",
    "Kdo dostane takovou kartu, má v telefonu aspoň jednoho člověka, který ho má rád.",
    "Tohle nebylo myšleno zle. Hvězdy to potvrzují a odesílatel taky, s úsměvem.",
  ],
  2: [
    "Revanš je na místě. Přátelství se testuje právě takhle.",
    "Kdo roastuje, myslí to dobře. Hvězdy tomu říkají „podmíněná láska“.",
    "Odesílatel tě zná dost dobře na to, aby měl pravdu. A dost slušně, aby ji zabalil do hvězd.",
    "Když se ti chce smát i bránit zároveň, je to znamení, že to aspoň trochu sedí.",
  ],
  3: [
    "Člověk, který má tvoje trapné fotky a přesto zůstal, je opravdový přítel. To je láska.",
    "Odpověď „to nejsem já“ platí jen do chvíle, kdy se ti ozve druhý kamarád a řekne „je to přesně ty“.",
    "Máš tři možnosti: smát se, urazit se, nebo poslat revanš. Hvězdy tipují třetí.",
    "Hvězdy doporučují odpovědět do 24 hodin. Mlčení by se vyložilo jako souhlas a to nikdo nechce.",
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

/** Závěr scény podle úrovně páru (1-3), 4 na úroveň, gradace od vlídné po ironickou. */
export const COUPLE_OUTROS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Hvězdy to shrnují: jste v pohodě. Tomuhle zjištění věnovaly celý kosmický týden.",
    "Závěr kosmické komise: sladké, i když ne vždy bezpečné.",
    "Kosmický zápis: oba vítězí. Remíza byla vyloučena.",
    "Hvězdy vás vidí jako dvojici, která si rozumí i mlčením. Komise to označila za nadějné.",
  ],
  2: [
    "Kosmický zápis z jednání: oba vinni, oba milí.",
    "Hvězdy nařizují: večeře, usmíření, žádné další otázky.",
    "Spis uzavřen s poznámkou „zvládnete to, ale rádi se budeme dívat“.",
    "Komise doporučuje kompromis: jeden z vás vybere restauraci a druhý se bude tvářit, že to byl jeho nápad.",
  ],
  3: [
    "Hvězdy se na vás dívají jako na seriál, který už nejde zrušit.",
    "Verdikt komise: oba obžalovaní jsou stejně nemožní. Přesně proto to funguje.",
    "Zápis: oba prohráli, ale oba si myslí, že vyhráli. To je láska.",
    "Komise vám udělila společné ocenění „Nejvytrvalejší dvojice večera“. Cena zahrnuje poukaz na usmíření.",
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
