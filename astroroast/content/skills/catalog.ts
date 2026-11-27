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
      "Sejde se deset Beranů u semaforu. Naskočí zelená, všichni vystartují a až na další křižovatce se zeptají, kam vlastně jedou. Hlavně že před ostatními.",
      "Sejde se deset Beranů a někdo řekne „kdo dřív“. Za minutu běží všichni do schodů a nikdo neví, co je nahoře. Vyhraje ten, kdo první zjistí, že je to půda.",
    ],
    dovolena: [
      "Beran na dovolené vstává v šest, aby „zabral“ lehátko. Pak na něm leží do deseti a čeká, až se ostatní probudí a uvidí, že vyhrál.",
      "Beran sedí u navigace jako u kokpitu. Odbočí tam, kam nikdo nečekal, a pak hlásí, že to byla zkratka. Trvala o hodinu déle.",
    ],
    zprava: [
      "Beran odpoví dřív, než dočte otázku. Odpověď je rychlá, sebejistá a patří do úplně jiného rozhovoru.",
      "Napíšeš Beranovi odstavec a vrátí se „ok“. Napíšeš druhý, ještě delší, a vrátí se „ok, a?“. Takhle vypadá jeho nejdelší konverzace za rok.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Klid, já to vyřídím.“ Myslí tím: Už jsem zavolal a teď honem zjišťuju komu.",
      "Řekne: „Já přece nejsem netrpělivý.“ Myslí tím: Odpověz do deseti sekund, nebo si dám pauzu od tebe. Vydrží čtyři.",
    ],
    "one-liner": [
      "Beran nikdy nechodí pozdě. Chodí dřív, než akce začne, a pak se diví, že tam nikdo není.",
      "Beran nezačíná hádku. Začíná větu a hádka se přidá cestou jako spolujezdec.",
    ],
  },

  byk: {
    "sejde-se": [
      "Sejde se deset Býků na výletě. Nikdo nechce měnit trasu, nikdo nechce měnit oběd a po jídle nikdo nechce měnit polohu. Výlet se tiše přejmenuje na „zůstali jsme tam“.",
      "Sejde se deset Býků na schůzi společenství vlastníků a hlasuje se o nové barvě vchodových dveří. Deset hlasů proti, protože hnědé byly dobré i před třiceti lety.",
    ],
    dovolena: [
      "Býk na dovolené najde jednu restauraci, objedná si totéž a po týdnu ho obsluha zdraví jako rodinu. Zbytek ostrova nikdy neviděl.",
      "Býk si u moře vybere lehátko a po týdnu ho považuje za své. Když na něm leží někdo jiný, stojí vedle a mlčí, dokud neodejde.",
    ],
    zprava: [
      "Býk odpovídá na zprávy tempem, které si zvolil před lety. Urgence ho nezrychlí. Odpověď dorazí v úterý a bude to palec nahoru.",
      "Napíšeš Býkovi: „Nechceš to zkusit jinak?“ Odpoví: „Ne.“ Za minutu přijde ještě: „Ale díky za nabídku.“",
    ],
    "rika-vs-mysli": [
      "Řekne: „Jsem otevřený novým věcem.“ Myslí tím: Pokud vypadají přesně jako ty staré a stojí na stejném místě.",
      "Řekne: „Jen si na chvilku sednu.“ Myslí tím: Zítra mě najdeš ve stejném důlku v gauči.",
    ],
    "one-liner": [
      "Býk nezmění názor. Nanejvýš ho přestěhuje do pohodlnějšího křesla.",
      "Býka argumenty nepřesvědčíš. Nech věc tři týdny ležet a on ji „sám“ objeví. Zavede ji jako vlastní patent.",
    ],
  },

  blizenci: {
    "sejde-se": [
      "Sejde se deset Blíženců a za pět minut mluví dvacet hlasů. Každý Blíženec totiž vede v hlavě druhou konverzaci a ta je zajímavější.",
      "Sejde se deset Blíženců na poradě. Všichni mluví, nikdo nezapisuje a pak se shodnou, že to byla nejlepší porada roku. Co se řešilo, neví nikdo.",
    ],
    dovolena: [
      "Blíženec na dovolené uvízne v hovoru s taxikářem a mine vlastní hotel. Večer ho zná celá ulice, hotel pořád ne.",
      "Blíženec si na dovolenou koupí tři knihy a nedočte žádnou. Čtvrtou mu v letadle půjčí soused a tu dočte první.",
    ],
    zprava: [
      "Blíženec odpoví na zprávu pěti zprávami. Čtvrtá je oprava té první a pátá odpovídá na otázku, kterou nikdo nepoložil.",
      "Blíženec odepíše dřív, než dopíšeš otázku. A nejhorší na tom je, že se trefí.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Jen dvě minutky, dopovím tuhle historku.“ Myslí tím: Zítra ráno se k tomu vrátíme.",
      "Řekne: „Slibuju, že to nikomu neřeknu.“ Myslí tím: Řeknu to jednomu člověku. Ten to slíbí taky.",
    ],
    "one-liner": [
      "Blíženec má vždycky dvě verze příběhu. Pravdivou a lepší. Vypráví se ta druhá.",
      "Blíženec má v prohlížeči dvanáct záložek. Na jedenácti se právě dozvídá něco, co s prací nesouvisí.",
    ],
  },

  rak: {
    "sejde-se": [
      "Sejde se deset Raků na oslavě. Každý upeče dort, každý má lepší recept a každý se potají urazí, že ten jeho nikdo nevzal dvakrát.",
      "Sejde se deset Raků v kavárně a všichni zdvořile říkají, že už musí domů. Odejdou za čtyři hodiny, po jednom, každý po dvaceti minutách loučení ve dveřích.",
    ],
    dovolena: [
      "Rak z dovolené pošle domů dvanáct fotek jídla a zprávu: „Chybíte mi, tady to není ono.“ Sedí přitom u moře.",
      "Rak si na dovolenou sbalí domov: dva polštáře, svíčku a oblíbený hrnek. V hotelu mu pak chybí už jen hotel.",
    ],
    zprava: [
      "Rak odpoví jedním smajlíkem. Pak hodinu mlčí a ty zjišťuješ, jestli se něco stalo, nebo je to jen úterý.",
      "Rak napíše „Dobře.“ S tečkou. Za tou tečkou se krčí devět odstavců, které mu v hlavě dopsal ukřivděný večer.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Nic se neděje.“ Myslí tím: Děje se toho víc, než se vejde do jednoho bytu 2+kk.",
      "Řekne: „Vůbec mi nevadí, že se mi nikdo neozval.“ Myslí tím: Mám to v seznamu. Vedu ho od roku 2014.",
    ],
    "one-liner": [
      "Rak nemá náladu. Rak má počasí a ty se můžeš rozhodnout jen o tom, jestli si vezmeš deštník.",
      "Rak se nezlobí. Rak archivuje. Ve složce „Křivdy“ máš vlastní podsložku.",
    ],
  },

  lev: {
    "sejde-se": [
      "Sejde se deset Lvů a volí se předseda. Hlasování dopadne deset ku nule: všichni hlasovali pro sebe a každý to bere jako jednomyslné zvolení.",
      "Sejde se deset Lvů na večeři. Zasedací pořádek se řeší dvě hodiny, jídlo patnáct minut a focení do rána. Každý se fotí tak, aby nestál vedle ostatních.",
    ],
    dovolena: [
      "Lev na dovolené vstává před východem slunce. Slunce prý nesmí začít bez publika.",
      "Lev u bazénu pózuje i o samotě. Pro jistotu, kdyby nad ním přeletěl dron.",
    ],
    zprava: [
      "Lev odpoví hlasovkou. Tři minuty, úvodní fanfáry, poděkování na závěr. Zpráva zněla: „Jdeš dneska?“",
      "Lev neodpovídá hned. Nechává si čas, aby to vypadalo, že má důležitější publikum. Má. Je to jeho příští příspěvek.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Já žádnou pozornost nepotřebuju.“ Myslí tím: Dívej se na mě, ale ať to nevypadá, že jsem o to prosil.",
      "Řekne: „Je to týmová práce.“ Myslí tím: Já jsem tým. Ostatní jsou titulky na konci.",
    ],
    "one-liner": [
      "Lev není domýšlivý. Lev jen ví, že když vejde do místnosti, měla by k tomu hrát hudba.",
      "Lev miluje kritiku. Hlavně když končí slovy „ale stejně jsi nejlepší“.",
    ],
  },

  panna: {
    "sejde-se": [
      "Sejde se deset Panen na úklidu. Za hodinu je hotovo. Za další hodinu je uklizená i ta část, která už uklizená byla.",
      "Sejde se deset Panen na poradě. Zápis píše každá jiný a každá je přesvědčená, že ten její je finální a ostatní jsou koncepty.",
    ],
    dovolena: [
      "Panna sbalí kufr podle dnů, hodin a pravděpodobnosti deště. Vrací se s vypranými věcmi, které nevyndala, a s poznámkou, jak to příště zabalit líp.",
      "Panna na dovolené nejdřív zkontroluje pokoj, pak recenze pokoje a pak recenze těch recenzí. Je poledne.",
    ],
    zprava: [
      "Panna odpoví bez překlepu, s čárkami na správných místech a s jedním drobným, laskavým upozorněním na tvou interpunkci.",
      "Panna odpoví do pěti minut. Dalších třicet ji v hlavě opravuje, protože nad čárkou ve druhé větě se vznáší otazník.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Já si maličkostí nevšímám.“ Myslí tím: Mám seznam. Je očíslovaný a první bod jsou tvoje boty u dveří.",
      "Řekne: „S radostí ti pomůžu, jen to uděláme správně.“ Myslí tím: Pomůžu ti. Mým způsobem. Teď hned.",
    ],
    "one-liner": [
      "Panna neprokrastinuje. Panna si nejdřív vytvoří systém, díky kterému příště prokrastinovat nebude. Systém má tři záložky.",
      "Panna najde chybu i v plánu, který ještě neexistuje.",
    ],
  },

  vahy: {
    "sejde-se": [
      "Sejde se deset Vah na výběru restaurace. Po dvou hodinách mají tři finalisty, čtyři obavy a jednoho člověka, který by chtěl pizzu, ale neřekne to.",
      "Sejde se deset Vah na hlasování. Hlasují pětkrát, protože pokaždé vyjde něco jiného a každý výsledek je nespravedlivý k té druhé možnosti.",
    ],
    dovolena: [
      "Váhy si na dovolené vybírají pláž tři dny. Čtvrtý den jedou domů.",
      "Váhy dostanou v hotelu na výběr pokoj s výhledem na moře a pokoj s výhledem na hory. Vyberou si třetí, který v nabídce nebyl, protože se v něm nikdo nehádá.",
    ],
    zprava: [
      "Váhy odpoví: „Jasně, jak chceš!“ A pak ještě pět minut píšou, jestli „jak chceš“ opravdu znamená „jak chceš“.",
      "Váhy odpoví: „Já bych možná jo, ale jen jestli ty taky.“ Zpráva zněla: „Jdeš na oběd?“",
    ],
    "rika-vs-mysli": [
      "Řekne: „Je mi to úplně jedno, vyber ty.“ Myslí tím: Hádej správně. Názor mám, jen ho nenechám vyslovit.",
      "Řekne: „Chci být fér.“ Myslí tím: Dám za pravdu oběma a pak se budu divit, že se nikdo neraduje.",
    ],
    "one-liner": [
      "Váhy nejsou nerozhodné. Váhy jen počítají i s těmi, kdo by to rozhodli jinak.",
      "Váhy jsou jediné znamení, které si před nákupem vybere třetí variantu, aby mohlo litovat té druhé.",
    ],
  },

  stir: {
    "sejde-se": [
      "Sejde se deset Štírů na poradě. Nikdo nic neřekne, všichni všechno vědí a po poradě si každý vede soukromý seznam, kdo se na koho díval.",
      "Sejde se deset Štírů a každý zná tajemství těch devíti ostatních. Konverzace je mimořádně zdvořilá.",
    ],
    dovolena: [
      "Štír nikomu neřekne, kam jede. Po návratu nikomu neřekne, kde byl. A přesto všichni vědí, že to bylo fantastické.",
      "Štír u bazénu nemluví, jen se dívá. Za hodinu ví o lidech kolem víc než jejich rodiny.",
    ],
    zprava: [
      "Štír zprávu přečte a neodpoví. Dvě modré fajfky svítí a on čeká, až se začneš potit sám.",
      "Štír odpoví jedním slovem. Poznáš ale, že ho vybíral ze čtyřiceti kandidátů.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Já se nezlobím.“ Myslí tím: Zlobím se stylem, který si budeš pamatovat do konce roku.",
      "Řekne: „Je to v pohodě.“ Myslí tím: Zapsáno.",
    ],
    "one-liner": [
      "Štír neodpouští. Štír jen odkládá vyúčtování na pohodlnější termín.",
      "Štír nežárlí. Štír provádí průzkum. Zatím čtvrtý týden.",
    ],
  },

  strelec: {
    "sejde-se": [
      "Sejde se deset Střelců plánovat dovolenou. Za hodinu je domluveno dvanáct zemí a jedna schůzka, na kterou nikdo nedorazí včas.",
      "Sejde se deset Střelců na výletě. Domluví se, že se jde na vrchol. Za půl hodiny míří čtyři na vrchol, tři do údolí a tři za „něčím zajímavým“, co leží úplně jinde.",
    ],
    dovolena: [
      "Střelec si na dovolené koupí jízdenku do města, jehož jméno neumí vyslovit. Prý nejlepší dovolená jeho života. Rodina to uslyší do Vánoc ještě dvacetkrát.",
      "Střelec stihne za týden pět sportů, tři jídla, která nikdy neviděl, a jednoho průvodce, který na něj nezapomene.",
    ],
    zprava: [
      "Střelec odpoví upřímně, nahlas a s dvanácti vykřičníky. Na otázku, která tam nebyla.",
      "Střelec odpoví po třech dnech: „Promiň, byl jsem na Islandu! Co se stalo?“ Omluva je tak upřímná, že ti ten problém přestane vadit.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Řeknu ti to na rovinu.“ Myslí tím: Něco řeknu a ono se to pak nějak srovná.",
      "Řekne: „Za pět minut jsem tam!“ Myslí tím: Za pět minut vyrazím a ještě nevím kterým směrem.",
    ],
    "one-liner": [
      "Střelec nikdy neříká, že je pozdě. Říká, že ostatní přišli brzo.",
      "Střelec má tři životní hesla. Ani jedno nedotáhne do konce, ale všechna se vejdou na tričko.",
    ],
  },

  kozoroh: {
    "sejde-se": [
      "Sejde se deset Kozorohů na poradě. Všichni dorazí v 7:55, protože 8:00 je pozdě. Zjistí, že dorazili o hodinu dřív než program.",
      "Sejde se deset Kozorohů na dovolené. První den zřídí pracovní skupinu pro odpočinek. Do konce týdne mají zprávu, jak se odpočívá efektivněji.",
    ],
    dovolena: [
      "Kozoroh na dovolené odpoví na čtrnáct pracovních e-mailů „jen aby se nehromadily“. Zato se mu hromadí výčitky, že u moře nic nestihl.",
      "Kozoroh si na dovolené udělá harmonogram lenošení: 9:00 až 10:30 pláž, 10:30 až 11:00 přesun na jinou pláž. Splní ho na 110 %.",
    ],
    zprava: [
      "Kozoroh odpoví stručně a věcně: „Přijato.“ Je to jeho nejdelší projev náklonnosti.",
      "Kozoroh odpoví přesně ve chvíli, kdy dokončí to, co zrovna dělá. Do té doby jsi v jeho frontě úkolů pod číslem 14.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Nic nového, jen práce.“ Myslí tím: Mám na ni plán na pět let, tři kapitoly a přílohu.",
      "Řekne: „Odpočinu si, až bude hotovo.“ Myslí tím: Hotovo nebude. Ale slibuje si to s obdivuhodným klidem. Každý rok.",
    ],
    "one-liner": [
      "Kozoroh nemá volný čas. Má nenaplánovaný čas, který čeká na správný úkol.",
      "Kozoroh se směje podle plánu. Kdyby to nebylo v kalendáři, nikdo by nepoznal, že to byl vtip.",
    ],
  },

  vodnar: {
    "sejde-se": [
      "Sejde se deset Vodnářů na poradě. Každý má originální nápad, který změní svět. Nikdo ho nenapíše, protože zápis je tak konvenční.",
      "Sejde se deset Vodnářů a zjistí, že jsou nejnápaditější skupina v místnosti. Domluví se, že se na ničem nedomluví. Je to jejich největší shoda.",
    ],
    dovolena: [
      "Vodnář nejede tam, kam jezdí všichni. Jede tam, kam jezdí jen on, a pak podezíravě měří každého, kdo tam je taky.",
      "Vodnář si na dovolené založí nový projekt. Tři nápady, dvě domény, jeden manifest. Dovolená skončila včera.",
    ],
    zprava: [
      "Vodnář odpoví odkazem na dokument, který nikdo neviděl, s názvem, kterému nikdo nerozumí. Odpověď tam je. Někde.",
      "Vodnář odpoví za tři dny. Nebyl to nezájem, jen jeho pozornost cestovala v jiném časovém pásmu.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Já nejsem jako ostatní.“ Myslí tím: Jsem přesně jako všichni Vodnáři. Což je ten nejlepší důkaz.",
      "Řekne: „Mám na to zajímavý pohled.“ Myslí tím: Zapomněl jsem, o čem se mluví, ale názor už mám.",
    ],
    "one-liner": [
      "Vodnář má nápad na revoluci. Jen počká na lepší připojení.",
      "Vodnář je jediné znamení, které se dokáže cítit osamělé i v davu, který ho obdivuje.",
    ],
  },

  ryby: {
    "sejde-se": [
      "Sejde se deset Ryb na schůzce. Všechny dorazí o půl hodiny později, protože se cestou zasnily. Nikdo se neomlouvá. Všichni mají tak krásný důvod.",
      "Sejde se deset Ryb u moře. Hodinu spolu mlčí a všechny odjedou s pocitem, že to byl nejhlubší rozhovor roku.",
    ],
    dovolena: [
      "Ryba na dovolené zapomene kufr, adaptér a čas. Vrátí se s dvaceti fotkami západů slunce a pocitem, že se jí život konečně dostal do správného proudu.",
      "Ryba u moře hledí na vlny. Zeptáš se, na co myslí. „Na nic.“ V hlavě zrovna píše román, který má už třetí konec.",
    ],
    zprava: [
      "Ryba odpoví dlouhým krásným textem se spoustou smajlíků. Chybí v něm jen odpověď na otázku.",
      "Ryba odpoví za tři dny, ale srdečně. Omluví se, přizná, že na tebe myslela, a pošle video, které s tvou zprávou nesouvisí vůbec nijak.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Za chvilku jsem tam.“ Myslí tím: Hledám klíče, které držím v ruce.",
      "Řekne: „Nic mi není.“ Myslí tím: Prožívám tři filmy najednou a žádný nemá konec.",
    ],
    "one-liner": [
      "Ryba není nespolehlivá. Plave proudem, který se zrovna přestěhoval.",
      "Ryba má bohatý vnitřní život. Škoda, že se nevejde do diáře.",
    ],
  },
};

export const CATALOG: CatalogJoke[] = buildCatalog(RAW_CATALOG as Record<SignId, Record<Series, string[]>>);
