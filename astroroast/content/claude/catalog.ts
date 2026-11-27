// AstroRoast.ai: ručně psaný katalog hotových vtipů tohoto modelu (originální obsah, žádný LLM za běhu).
// Každé znamení má 5 sérií po 2 vtipech. Id: "{sign}-{series}-{n}".

import type { CatalogJoke, SignId } from "../../types";
import { buildCatalog } from "../build";

type Series = CatalogJoke["series"];

export const SERIES_LABELS: Record<Series, string> = {
  "sejde-se": "Sejde se 10…",
  dovolena: "Na dovolené",
  zprava: "Jak odpoví na zprávu",
  "rika-vs-mysli": "Co říká vs. co tím myslí",
  "one-liner": "Jednohubky",
};

export const RAW_CATALOG: Record<SignId, Record<Series, string[]>> = {
  beran: {
    "sejde-se": [
      "Sejde se deset Beranů u semaforu. Naskočí zelená, všichni vyrazí a nikdo neví kam. Hlavně že první.",
      "Sejde se deset Beranů na startu závodu. Nikdo ho nevyhlásil, ale vítěz už je znám. Je to ten, kdo nejhlasitěji řekl, že vyhrál.",
    ],
    dovolena: [
      "Beran na dovolené má plán na každou hodinu. Do oběda stihne tři památky, dva výlety a hádku s navigací o tom, kdo tady velí.",
      "Beran u bazénu nevydrží ležet. Po deseti minutách vyhlásí soutěž ve skocích. Vítěz je znám předem a už si píše děkovnou řeč.",
    ],
    zprava: [
      "Beran odpoví dřív, než dočte otázku. Odpověď je sebejistá, rychlá a k otázce má zhruba tak blízko jako Pluto ke slunci.",
      "Pošlete Beranovi dlouhou zprávu a on odpoví: „Ok.“ Pošlete mu druhou, ještě delší, a dostanete: „Ok, a?“ Tak vypadá jeho nejhlubší konverzace roku.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Klid, já to vyřídím.“ Myslí tím: Už jsem do toho skočil a teď zjišťuju, kam to vede.",
      "Řekne: „Já přece nejsem netrpělivý.“ Myslí tím: Odpověz do deseti sekund, nebo se urazím.",
    ],
    "one-liner": [
      "Beran v diáři nemá „zítra“. Má tam „hned“ a „už jsem to udělal“.",
      "Beran spory nezačíná. Začíná na plný plyn a spor je jen vedlejší efekt.",
    ],
  },

  byk: {
    "sejde-se": [
      "Sejde se deset Býků na výletě. Nikdo nechce změnit trasu, nikdo nechce změnit hospodu a po obědě nikdo nechce změnit polohu na lavičce. Výlet se oficiálně jmenuje „zůstali jsme tam“.",
      "Sejde se deset Býků na poradě a každý si přinese vlastní polštář. Jen tak, pro jistotu. Porada se nezlepší, ale všichni budou vyspaní jako argument.",
    ],
    dovolena: [
      "Býk na dovolené má jedinou podmínku: aby se tam dalo dobře najíst. Zbytek dovolené se plánuje podle toho, jak daleko je to od oběda.",
      "Býk si na dovolené najde jednu restauraci a zůstane jí věrný. Ostatní památky jsou pro něj jen zdržení na cestě zpátky ke stolu.",
    ],
    zprava: [
      "Býk odpovídá na zprávy tempem, které si zvolil před lety. Netlačte. Nezrychlí, ale pošle palec nahoru, jako by to byla výhra.",
      "Napíšete Býkovi: „Nechceš to zkusit jinak?“ Odpoví: „Ne.“ A pak ještě jednu zprávu: „Ale díky, že ses zeptal.“",
    ],
    "rika-vs-mysli": [
      "Řekne: „Jsem otevřený novým věcem.“ Myslí tím: Pokud vypadají přesně jako ty staré.",
      "Řekne: „Dám si jen chvilku pauzu.“ Myslí tím: Zítra mě najdete na stejném místě, ve stejné pozici.",
    ],
    "one-liner": [
      "Býk nezmění názor. Nanejvýš ho přestěhuje do pohodlnějšího křesla.",
      "Býka nepřesvědčíte argumenty. Dejte mu čas, a on na to „sám“ přijde. Bude to váš nápad.",
    ],
  },

  blizenci: {
    "sejde-se": [
      "Sejde se deset Blíženců. Je to vlastně dvacet lidí, protože každý v hlavě vede dvě konverzace a ta druhá je zajímavější.",
      "Sejde se deset Blíženců na poradě. Všichni mluví, nikdo nepíše zápis a všichni se shodnou, že to byla nejproduktivnější porada v historii.",
    ],
    dovolena: [
      "Blíženci na dovolené mluví úplně se všemi: s taxikářem, s číšníkem, s turistkou z vedlejší skupiny. Domů se vrátí s osmi novými kamarády a bez jediné prohlédnuté památky.",
      "Blíženec si na dovolenou koupí tři knihy a ani jednu nedočte. Čtvrtou už mu někdo půjčil v letadle.",
    ],
    zprava: [
      "Blíženec odpoví na zprávu pěti zprávami. Čtvrtá je oprava první a pátá je odpověď na něco, na co jste se neptali.",
      "Blíženec odepíše okamžitě, na otázku, kterou jste ještě nestihli dopsat. A nejhorší je, že se trefí.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Jen dvě minutky, dopovím tuhle historku.“ Myslí tím: Přijďte zítra a vezměte si svačinu.",
      "Řekne: „Slibuju, že to nikomu neřeknu.“ Myslí tím: Řeknu to jen jednomu člověku. Ten to taky nikomu neřekne. Jen jednomu člověku.",
    ],
    "one-liner": [
      "Blíženec má vždycky dvě verze příběhu. Jedna je pravdivá, druhá je lepší a vyprávět se bude ta druhá.",
      "Blíženec má v prohlížeči dvanáct záložek. Deset z nich je o věcech zajímavějších než ta práce, kterou měl dělat.",
    ],
  },

  rak: {
    "sejde-se": [
      "Sejde se deset Raků na oslavě. Každý upeče dort, každý má lepší recept a každý se potají urazí, že si ostatní vzali jen kousek.",
      "Sejde se deset Raků v kavárně. Všichni říkají, že už musí domů. Nikdo neodejde, protože tady je to přece jako doma.",
    ],
    dovolena: [
      "Rak na dovolené pošle domů dvanáct fotek jídla, tři fotky polštáře a jednu zprávu: „Chybíte mi, tady to není ono.“ Je u moře.",
      "Rak si na dovolenou sbalí domov: dva polštáře, svíčku a oblíbený hrnek. V hotelu mu pak chybí jen hotel.",
    ],
    zprava: [
      "Rak odpovídá po svém. Nejdřív emoji, pak odmlka, pak jedna věta, kvůli které budete hodinu přemýšlet, jestli se něco stalo.",
      "Rak odpoví: „Dobře.“ A za tou tečkou se krčí devět odstavců, které mu v hlavě dopsal ukřivděný večer.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Nic se neděje.“ Myslí tím: Děje se toho víc, než se vejde do jednoho bytu.",
      "Řekne: „Vůbec mi nevadí, že jste na mě zapomněli.“ Myslí tím: Mám to v seznamu. Vedu ho od roku 2014.",
    ],
    "one-liner": [
      "Rak nemá náladu. Rak má počasí a vy se můžete jen rozhodnout, jestli si vezmete deštník.",
      "Rak se nezlobí. Rak si to jen pamatuje, a to mnohem déle než vy.",
    ],
  },

  lev: {
    "sejde-se": [
      "Sejde se deset Lvů a má se zvolit vedoucí. Hlasování dopadne deset ku nule. Všichni hlasovali pro sebe a každý to bere jako jednomyslné zvolení.",
      "Sejde se deset Lvů na večeři. Zasedací pořádek trvá dvě hodiny, jídlo patnáct minut a focení do rána.",
    ],
    dovolena: [
      "Lev na dovolené vstává před východem slunce. Slunce prý nesmí začít bez publika.",
      "Lev u bazénu pózuje i ve chvíli, kdy je sám. Pro jistotu, kdyby kolem proletěl dron.",
    ],
    zprava: [
      "Lev odpoví na zprávu hlasovkou. Tři minuty, úvodní fanfáry, závěrečné poděkování. Zpráva zněla: „Jdeš dneska?“",
      "Lev nikdy neodpovídá hned. Nechává si čas, aby to vypadalo, že má jiné, důležitější publikum. Má. Je to jeho příští příspěvek.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Já žádnou pozornost nepotřebuju.“ Myslí tím: Podívejte se na mě, ale tak, aby to nevypadalo, že jsem o to žádal.",
      "Řekne: „Je to týmová práce.“ Myslí tím: Já jsem tým.",
    ],
    "one-liner": [
      "Lev není domýšlivý. Lev jen ví, že když vejde do místnosti, měla by k tomu hrát hudba.",
      "Lev miluje kritiku. Pokud je to potlesk.",
    ],
  },

  panna: {
    "sejde-se": [
      "Sejde se deset Panen na úklidu. Za hodinu je hotovo. Za další hodinu je hotová i ta část, která už byla uklizená.",
      "Sejde se deset Panen na poradě. Zápis píše každá, každá jiný a každá je přesvědčená, že ten její je finální a ostatní jsou jen koncepty.",
    ],
    dovolena: [
      "Panna na dovolené má kufr sbalený podle dnů, hodin a pravděpodobnosti deště. Vrací se s vypranými věcmi, které nepoužila, a s poznámkami, jak to příště zabalit líp.",
      "Panna na dovolené nejdřív zkontroluje pokoj, pak recenze pokoje a pak recenze těch recenzí. Potom je čas na oběd.",
    ],
    zprava: [
      "Panna odpoví bez překlepu, s čárkami na správných místech a s jedním drobným, laskavým upozorněním na vaši interpunkci.",
      "Panna odpoví do pěti minut. A dalších třicet minut opravuje to, co napsala, protože to přece někdo mohl přečíst.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Já si maličkostí nevšímám.“ Myslí tím: Mám seznam. Je očíslovaný.",
      "Řekne: „S radostí ti pomůžu, jen to uděláme správně.“ Myslí tím: Pomůžu ti. Mým způsobem. Teď hned.",
    ],
    "one-liner": [
      "Panna neprokrastinuje. Panna si nejdřív vyrobí systém, díky kterému příště prokrastinovat nebude.",
      "Panna dokáže najít chybu i v plánu, který zatím neexistuje.",
    ],
  },

  vahy: {
    "sejde-se": [
      "Sejde se deset Vah na výběru restaurace. Za dvě hodiny mají tři finalisty, čtyři obavy a jednoho člověka, který by si nejraději objednal pizzu, ale nechce rozhodovat za ostatní.",
      "Sejde se deset Vah na hlasování. Hlasují pětkrát, protože pokaždé vyjde něco jiného a pokaždé je to nespravedlivé vůči té druhé možnosti.",
    ],
    dovolena: [
      "Váhy si na dovolené vybírají pláž. Tři dny. Čtvrtý den už jedou domů.",
      "Váhy v hotelu dostanou na výběr pokoj s výhledem na moře a pokoj s výhledem na hory. Vyberou si třetí, který v nabídce nebyl, protože se v něm nikdo nehádá.",
    ],
    zprava: [
      "Váhy odpovědí: „Jasně, jak chceš!“ A pak ještě pět minut píšou, aby se ujistily, že „jak chceš“ opravdu znamená „jak chceš“.",
      "Váhy odpovědí diplomaticky. Je to buď ano, nebo ne, nebo zatím ne, nebo ano, ale jen pokud to bude fajn pro všechny.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Je mi to úplně jedno, vyber ty.“ Myslí tím: Zkus uhodnout správně. Názor mám, jen ho nenechám vyslovit.",
      "Řekne: „Chci být spravedlivý.“ Myslí tím: Dám za pravdu oběma, a pak se budu divit, že se nikdo neraduje.",
    ],
    "one-liner": [
      "Váhy nejsou nerozhodné. Váhy jen počítají i s těmi, kdo by to mohli rozhodnout jinak.",
      "Váhy jsou jediné znamení, které si před nákupem zvolí třetí variantu, aby mohlo litovat té druhé.",
    ],
  },

  stir: {
    "sejde-se": [
      "Sejde se deset Štírů na poradě. Nikdo nic neřekne, všichni všechno vědí a po poradě si každý vede soukromý seznam, kdo se na koho díval.",
      "Sejde se deset Štírů a každý ví tajemství o těch devíti ostatních. Konverzace je nesmírně zdvořilá.",
    ],
    dovolena: [
      "Štír na dovolené nikomu neřekne, kam jede. Po návratu nikomu neřekne, kde byl. A přesto o něm všichni vědí, že to bylo fantastické.",
      "Štír u bazénu nemluví. Dívá se. Za hodinu ví o lidech kolem víc než jejich rodiny.",
    ],
    zprava: [
      "Štír zprávu přečte a neodpoví. Pak ji přečte znovu. Pak ji nechá ležet přesně tak dlouho, aby bylo jasné, že ji viděl.",
      "Štír odpoví jedním slovem. Ale vy poznáte, že to slovo bylo vybrané ze čtyřiceti kandidátů.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Já se nezlobím.“ Myslí tím: Zlobím se stylem, který si pamatujete do konce roku.",
      "Řekne: „Je to v pohodě.“ Myslí tím: Zapsáno.",
    ],
    "one-liner": [
      "Štír nikdy nezapomíná. Štír jen čeká na vhodné osvětlení.",
      "Štír nežárlí. Štír provádí průzkum.",
    ],
  },

  strelec: {
    "sejde-se": [
      "Sejde se deset Střelců na plánování dovolené. Za hodinu je domluveno dvanáct zemí a jedna schůzka, na kterou nikdo nedorazí včas.",
      "Sejde se deset Střelců na výletě. Pevně se dohodne, že se jde na vrchol. Za půl hodiny jdou čtyři na vrchol, tři do hospody a tři za zážitkem, který leží někde úplně jinde.",
    ],
    dovolena: [
      "Střelec si na dovolené koupí jízdenku do města, jehož jméno neumí vyslovit. Byla to nejlepší dovolená jeho života a všichni to budou slyšet.",
      "Střelec na dovolené stihne za týden vyzkoušet pět sportů, dvě jídla, která neznal, a jednoho průvodce, který na něj nikdy nezapomene.",
    ],
    zprava: [
      "Střelec odpoví upřímně, hlasitě a s dvanácti vykřičníky. Na otázku, která tam nebyla.",
      "Střelec odpoví po třech dnech: „Sorry, byl jsem pryč! Co se stalo?“ Jeho omluva je tak upřímná, že vám ten problém skoro přestane vadit.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Řeknu ti to na rovinu.“ Myslí tím: Nechci být zlý, ale zkusím to a uvidíme.",
      "Řekne: „Za pět minut jsem tam!“ Myslí tím: Za pět minut vyrazím a ještě nevím, kterým směrem.",
    ],
    "one-liner": [
      "Střelec nikdy neříká, že je pozdě. Říká, že vy jste přišli brzo.",
      "Střelec má tři životní hesla. Ani jedno nedotáhne do konce, ale všechna znějí skvěle.",
    ],
  },

  kozoroh: {
    "sejde-se": [
      "Sejde se deset Kozorohů na poradě. Všichni dorazí v 7:55, protože 8:00 je pozdě. Brzy zjistí, že dorazili o hodinu dřív než program.",
      "Sejde se deset Kozorohů na dovolené. Prvního dne zřídí pracovní skupinu pro odpočinek. Do konce týdne mají zprávu, jak se odpočívá efektivněji.",
    ],
    dovolena: [
      "Kozoroh na dovolené odpoví na čtrnáct pracovních e-mailů „jen aby se nehromadily“. Hromadí se mu dovolená.",
      "Kozoroh si na dovolené udělá harmonogram lenošení: 9:00 až 10:30 pláž, 10:30 až 11:00 přesun na jinou pláž. Nikdy tak dobře neodpočíval. Splnil to na 110 %.",
    ],
    zprava: [
      "Kozoroh odpoví stručně a věcně: „OK.“ Je to jeho nejdelší projev náklonnosti.",
      "Kozoroh odpoví přesně ve chvíli, kdy dokončí to, co zrovna dělal. Ne dřív. Je to profesionální a nepříjemně spravedlivé.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Nic nového, jen práce.“ Myslí tím: Mám na ni plán, který se vejde do pěti let a tří kapitol.",
      "Řekne: „Odpočinu si, až bude hotovo.“ Myslí tím: Hotovo nebude, ale slibuju si to s obdivuhodným klidem.",
    ],
    "one-liner": [
      "Kozoroh nemá volný čas. Má nenaplánovaný čas, který ještě čeká na správný úkol.",
      "Kozoroh se směje podle plánu. Kdyby to nebylo v kalendáři, nikdo by nepoznal, že to byl vtip.",
    ],
  },

  vodnar: {
    "sejde-se": [
      "Sejde se deset Vodnářů na poradě. Každý má originální nápad, který změní svět. Nikdo ho nenapíše, protože zápis je tak konvenční.",
      "Sejde se deset Vodnářů a zjistí, že jsou nejnápaditější skupina v místnosti. Domluví se, že se na ničem nedomluví. Je to jejich největší shoda.",
    ],
    dovolena: [
      "Vodnář na dovolené nejede tam, kam jezdí všichni. Jede tam, kam jezdí jen on, a pak se podivně dívá na ostatní, kteří tam taky jsou.",
      "Vodnář si na dovolené založí nový projekt. Má tři nápady, dvě domény a jeden manifest. Dovolená skončila včera.",
    ],
    zprava: [
      "Vodnář odpoví odkazem na dokument, který nikdo neviděl, s názvem, kterému nikdo nerozumí. Odpověď tam je. Někde.",
      "Vodnář odpoví za tři dny. Nebyl to nezájem. Jeho pozornost jen cestovala v jiném časovém pásmu.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Já nejsem jako ostatní.“ Myslí tím: Jsem přesně jako všichni Vodnáři, což je ten nejlepší důkaz.",
      "Řekne: „Mám na to zajímavý pohled.“ Myslí tím: Zapomněl jsem, o čem se mluví, ale názor už mám.",
    ],
    "one-liner": [
      "Vodnář má nápad na revoluci. Jen počká na lepší wifi.",
      "Vodnář je jediné znamení, které se dokáže cítit osamělé uprostřed davu, který ho obdivuje.",
    ],
  },

  ryby: {
    "sejde-se": [
      "Sejde se deset Ryb na schůzce. Všechny dorazí o půl hodiny později, protože se cestou zasnily. Nikdo se neomlouvá. Všichni mají tak krásný důvod.",
      "Sejde se deset Ryb na pláži. Za chvíli se všechny dívají na moře a mlčky přemýšlejí o dvanácti věcech, které nikdo neřekne nahlas.",
    ],
    dovolena: [
      "Ryba na dovolené zapomene kufr, adaptér a čas. Vrátí se s dvaceti fotkami západů slunce a pocitem, že se jí život konečně dostal do správného proudu.",
      "Ryba u moře se dívá na vlny. Někdo se zeptá, na co myslí. Ryba odpoví: „Na nic.“ V hlavě zrovna píše román, který má už třetí zakončení.",
    ],
    zprava: [
      "Ryba odpoví na zprávu dlouhým, krásným textem plným emoji. Chybí v něm jen odpověď na otázku.",
      "Ryba odpoví za tři dny, ale srdečně. Omluví se, přizná, že na vás myslela, a pošle video, které s vaší zprávou nesouvisí vůbec nijak.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Za chvilku tam jsem.“ Myslí tím: Zatím jsem doma a hledám klíče, které držím v ruce.",
      "Řekne: „Nic mi není.“ Myslí tím: Prožívám tři filmy najednou a žádný zatím nemá konec.",
    ],
    "one-liner": [
      "Ryba není nespolehlivá. Ryba jen plave proudem, který se zrovna přestěhoval.",
      "Ryba má bohatý vnitřní život. Škoda, že se do diáře nevejde.",
    ],
  },
};

export const CATALOG: CatalogJoke[] = buildCatalog(RAW_CATALOG as Record<SignId, Record<Series, string[]>>);
