// AstroRoast.ai: knihovna humoru, znamení strelec. Ručně psané originální české fragmenty.
//
// Tvar (RawSign, viz content/types.ts). Index 0 = úroveň 1 u všeho, co je Five<...>:
//   h  Five<string[]>   headlines: 3 na úroveň
//   c  Five<string[]>   core lines (výchozí věta o znamení): 2 na úroveň
//   v  Five<string[]>   verdikty: 2 na úroveň
//   t  Record<Topic, Five<string[]>>
//                       témata PO ÚROVNÍCH: pro každé téma (vztahy, prace, zivot, pratele, narozeniny)
//                       pět polí po 4 větách (index 0 = úroveň 1), tedy 20 vět na téma a 100 na znamení.
//                       Engine vybere 2 z t[téma][úroveň-1].
//   s  [label, value][] falešné statistiky znamení: 6 kusů
//   d  string[]         denní jednovětky: 24 kusů (Dnes… / Dneska…, tón kolem úrovně 2-3, žádné předpovědi událostí)
//   q  string[]         odpovědi v páru, pořadí viz COUPLE_SITUATIONS v shared.ts: 6 kusů
//
// Žebřík úrovní (platí pro h, c, v i každou větu v t; stejné téma čtené po úrovních 1..5 má působit jako schody):
//   1 Pohlazení        hřejivý kompliment s drobným mrknutím na konci
//   2 Šťouchnutí       přátelské popichování, všední postřeh s lehkým zvratem
//   3 Sarkasmus        suchá ironie, kompliment se ukáže jako kritika, jasná pointa
//   4 Roast            přímé spálení stereotypu, nadsázka, ostrá srovnání, konkrétní situace
//   5 Kosmická poprava absurdní kosmická eskalace (planety, černé díry, NASA, mezigalaktický úřad)
//
// Pravidla autora:
// - Žádné šablony se skloňováním: každá věta je hotová (nebo předsklonovaná), takže engine jen vybírá a skládá.
// - Všechny věty v 2. osobě čísla jednotného. Vyhýbáme se rodově označeným tvarům (-l/-la), aby věty
//   seděly komukoli, včetně kamaráda, kterému se roast posílá.
// - Střílíme do stereotypu znamení, nikdy do těla, zdraví, peněz, vyznání, orientace, smrti ani skutečných osob.
// - Úroveň 5 je absurdní a kosmická, nikdy krutá.
//
// Skladba roastu (viz engine/roast.ts):
//   headline = h[úroveň]
//   lines    = c[úroveň] + 2x t[téma][úroveň] + kicker (shared.ts, podle tématu a úrovně; u kamaráda FRIEND_KICKERS)
//   stats    = 1 generická podle tématu + 1-2 ze s
//   verdict  = v[úroveň]

import type { RawSign } from "../../types";

const strelec: RawSign = {
  h: [
    [
      "Střelec: optimista s batohem a nakažlivým nadšením pro každé nové místo.",
      "Máš v sobě rozlet, který se šíří na ostatní. Hvězdy by se rády svezly.",
      "Střelec vidí svět jako mapu plnou pozvánek. A ty na všechny odpovídáš ano.",
    ],
    [
      "Střelec chce svobodu. Nejlépe s letenkou a bez tabulky.",
      "Upřímnost máš rychlejší než přemýšlení. Pointa přijde až po ní.",
      "O všem prohlašuješ, že to chceš vyzkoušet. I o tom, co ti ještě nikdo nenabídl.",
    ],
    [
      "Střelec má plán na celý svět. Jen mu chybí první krok a směr.",
      "Říkáš „neplánuju“. Přitom máš rozjeté tři itineráře a v žádném není pondělí.",
      "Slibuješ, že se ozveš. Hvězdy jen upřesňují: z jakého časového pásma.",
    ],
    [
      "Tvoje upřímnost nemá filtr. Bohužel ani brzdy, ani záložní plán.",
      "Střelec se nebojí závazku. Jen mu vždycky odlétá letadlo, když se podepisuje.",
      "V debatě filozofuješ. Za deset minut sedíš v letadle a odpověď necháváš potomkům.",
    ],
    [
      "Jupiter ti poslal výpověď z funkce průvodce vesmírem. Dovolenou ti nechal.",
      "Vesmír tě jmenoval cestovatelem a zapomněl dodat, že cíl nikde není.",
      "Tvůj optimismus je tak velký, že vzniklo nové souhvězdí: Ještě to nějak dopadne.",
    ],
  ],
  c: [
    [
      "Umíš na všem najít to dobré. Hvězdy se už těší, co najdeš na pondělí.",
      "Tvoje nadšení je nakažlivé. Lidé s tebou chtějí na výlet, i když původně šli jen pro chleba.",
    ],
    [
      "Pravdu říkáš tak otevřeně, že ostatní zapomenou, jaká byla otázka.",
      "Doma ti je nejlíp na cestě. Domov je pro tebe místo, kde se přebalují kufry.",
    ],
    [
      "Střelec nikdy nepřijde pozdě. Jen se řídí časovým pásmem, které zná jenom on.",
      "Řekneš to přímo a pak se divíš tichu. Ty tomu říkáš nadšení. Ostatní šok.",
    ],
    [
      "Závazek je pro tebe jako dlouhá fronta: vidíš ji z letiště a letíš jinam.",
      "Tvoje „jen to krátce vysvětlím“ mívá tři body, jednu legendu a vlastní závěrečné titulky.",
    ],
    [
      "Pozemská gravitace tě zkusila přitáhnout. Vrátila se s kufrem a jednosměrným lístkem.",
      "Vesmír tě chtěl zakotvit. Kotva se vrátila z cesty a poslala pohlednici.",
    ],
  ],
  v: [
    [
      "Verdikt: dobrodruh s dobrým srdcem a lepším batohem než ostatní.",
      "Hvězdy radí: nech si to nadšení. Svět zrovna žádné jiné nemá po ruce.",
    ],
    [
      "Rada hvězd: občas zůstaň na místě. Ber to jako výlet, jen kratší.",
      "Verdikt: upřímnost, otevřenost a pořád sbalený batoh. Hlavně to poslední.",
    ],
    [
      "Verdikt: svoboda je skvělá. Jen nezapomeň, že doma ti někdo drží polévku. Už studenou.",
      "Rada: než odjedeš, napiš aspoň kam. Hvězdy ti pošlou pohlednici zpátky.",
    ],
    [
      "Verdikt: nejlepší společník na cesty a nejhorší na pondělí.",
      "Rada hvězd: občas drž jazyk za zuby. Třeba jen do konce porady.",
    ],
    [
      "Verdikt vesmíru: zpátky už se nevrátíš. Vesmír je totiž kruhový a ty jsi na druhém konci.",
      "Rozsudek: jedna kotva, povinně. Vesmír ví, že ji do týdne vyhodíš.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce hledáš dobrodružství. Rande s tebou je výlet do neznáma, i když jde jen o kavárnu za rohem.",
        "Tvoje nadšení je nakažlivé. Partner se u tebe cítí, jako by každé úterý začínaly prázdniny.",
        "Milovat po střelecku znamená nést partnerovi batoh i na výlety, o kterých ještě neví.",
        "S tebou je láska jako cesta bez navigace: občas se zabloudí, ale vždycky s úsměvem.",
      ],
      [ // úroveň 2
        "Rande plánuješ spontánně. Partner by tu spontánnost rád znal aspoň den předem.",
        "Do vztahu přinášíš dobrodružství a půl kufru. Druhou půlku necháváš na letišti.",
        "Říkáš, že potřebuješ prostor. Partner ho vždycky najde: je hned vedle tvého kufru.",
        "K výročí chystáš překvapení v podobě letenky. Datum odletu zatím nezná nikdo, ani ty.",
      ],
      [ // úroveň 3
        "Řekneš „miluju svobodu“ a čekáš potlesk. Partner zatleská. Pak si sbalí vlastní kufr.",
        "Upřímnost v lásce je u tebe dojemná: řekneš, co cítíš, hned, nahlas a v nejméně vhodnou chvíli.",
        "Máš pevný vztah k cestování a volný ke všemu, co se jmenuje „budeme spolu“.",
        "„Neutíkám, jen se rozhlížím“ je tvoje oblíbená věta. Rozhlížíš se vždycky směrem k východu.",
      ],
      [ // úroveň 4
        "Slovo „vztah“ zní pro tebe jako „pevná trasa“. Chceš, aby se dalo odbočit, přestoupit a zmizet.",
        "Tvoje „nezávazně“ trvá už tři roky. Partner mezitím přestal počítat dny a začal počítat letenky.",
        "Randit s tebou je jako sledovat let s věčně posunutým odletem. Všichni čekají, nikdo neví na co.",
        "Na první rande přijdeš s nadšením, na třetí s výmluvou a na čtvrté už posíláš pohlednici z Peru.",
      ],
      [ // úroveň 5
        "Mezigalaktický úřad pro vztahy vede tvůj spis pod názvem „Poslední známá poloha: Patagonie“.",
        "Kupid na tebe zamířil, ale šíp ztratil cíl a přistál v Patagonii. Kupid podal reklamaci.",
        "Planety se kvůli tobě naučily nový pohyb: kroužit kolem někoho, kdo se každé tři dny vzdálí o galaxii.",
        "Černá díra si od tebe vzala příklad: taky pohlcuje všechno, jen aby pak zmizela v jiné dimenzi.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci vládne optimismus. Každý problém bereš jako dobrodružství a každou poradu jako malý workshop o životě.",
        "Máš skvělé nápady a pevné přesvědčení, že se dají dotáhnout z pláže v Lisabonu.",
        "Kolegové tě obdivují. Hlavně v pondělí, když přijdeš s historkami a dárkem z jiného kontinentu.",
        "Tvoje nadšení zvedá náladu celé kanceláře, i když se zrovna řeší výměna tiskárny.",
      ],
      [ // úroveň 2
        "V práci řešíš velké otázky. Třeba kdy bude další dovolená. Odpověď zatím nikdo nenašel.",
        "Poradu bereš jako kontrolní bod před dalším výletem. Ostatní jako poradu.",
        "Kolegům říkáš, co si myslíš. Rychle, nahlas a s úsměvem. Úsměv drží dobře, zbytek občas méně.",
        "Pracovní den začínáš nadšením a končíš plánem, kam až se dá zmizet na víkend.",
      ],
      [ // úroveň 3
        "Termín je pro tebe doporučení. Něco jako rada, kterou je hezké znát a nepotřebovat.",
        "V pracovní pozici máš „flexibilní“. Šéf myslel flexibilní hodiny, ne flexibilní kontinent.",
        "Pracovní cíle máš jasné: výhled na moře, dobrý signál a nikdo, kdo se ptá na reporty. Zbytek je detail.",
        "Slibuješ „do pátku“ s jistotou člověka, který nikdy neviděl kalendář. Který pátek, neříkáš.",
      ],
      [ // úroveň 4
        "Tvoje ranní porada: pět minut vtipů, tři minuty cestopisu a poslední minuta pro „no a co jste vlastně chtěli?“",
        "Když se blíží deadline, ty se blížíš na letiště. Hvězdy tomu říkají „práce na dálku“. Hodně na dálku.",
        "Svoboda je tvoje hodnota. Šéf by ji rád viděl i v pracovní smlouvě, ne jen na tvých fotkách z Bali.",
        "Tvůj životopis se čte jako itinerář: spousta destinací, žádné zakotvení a u každé položky „odjezd z osobních důvodů“.",
      ],
      [ // úroveň 5
        "Tvůj pracovní výkon změřila NASA. Výsledek: dokonalá oběžná dráha kolem úkolů, přistání nikdy.",
        "Služební cesta do Brna skončila na Maledivách. Vesmírný účetní zatím hledá kolonku „inspirace“.",
        "Galaktický úřad práce eviduje tvůj deadline jako nehmotný jev a tvoji přítomnost jako teoretickou.",
        "Kdyby práce byla planeta, tvoje oběžná dráha by byla tak daleko, že by se o ní šéf dozvídal jen z pohlednic.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Život je pro tebe jedna velká cesta a každý den v ní přidává novou zastávku. Hvězdy tleskají.",
        "Máš chuť poznávat všechno za horizontem. A někdy i to, co je za rohem.",
        "Každé ráno vítáš jako nový itinerář. To je dar, který se nedá koupit ani s akční letenkou.",
        "Optimismus tě nikdy neopouští. Sbalí se do kufru, nastoupí s tebou a nikdy se nezeptá, kam jedete.",
      ],
      [ // úroveň 2
        "Život je pro tebe cesta. Jen si občas zapomeneš sbalit kufr, mapu a pas.",
        "Na otázku „kde bydlíš“ odpovídáš: „Právě teď tady.“ Adresa se aktualizuje podle letenek.",
        "Máš seznam míst, která chceš vidět. Je to nejdelší dokument, který ti kdy zůstal rozpracovaný.",
        "Tvůj kufr stojí v předsíni natrvalo. Ty tomu říkáš pohotovost, ostatní nábytek.",
      ],
      [ // úroveň 3
        "Plánovat do budoucna je pro tebe jako číst předpověď na příští rok: zajímavé, ale nepoužitelné.",
        "Máš přesný plán, kam chceš. Jen ho nikomu neukážeš, protože by se musel dodržet.",
        "Stabilita je pro tebe cizí slovo. Používáš ho, jen když hledáš ubytování se stabilním signálem.",
        "Tvrdíš, že jsi člověk okamžiku. Okamžik by rád věděl, jestli se vrátíš aspoň na pondělí.",
      ],
      [ // úroveň 4
        "Pro každou překážku máš jednu odpověď: „Nějak to dopadne.“ Druhou větu k ní zatím nikdo neviděl.",
        "V peněžence máš vstupenky z pěti zemí, lístky z deseti koncertů a nezodpovězenou otázku, co dělat v pondělí.",
        "Máš tolik rozběhnutých plánů, že se navzájem předbíhají. Vítězí obvykle ten, který nevyžaduje vstávat.",
        "Tvůj život je cestovní deník bez jediné stránky o příštím roce, zato s osmi o tom, co se ztratilo na letišti.",
      ],
      [ // úroveň 5
        "Země ti přijde malá a už vyjednáváš s Marsem o víkendové pobyty.",
        "NASA tě zapsala jako „neklasifikovaný pohyb v prostoru“. Vědci se hádají, jestli jde o kometu, nebo o plán na příští týden.",
        "Tvoje „nějak to dopadne“ je tak silné, že ho kosmos oficiálně používá jako zákon. Fyzika se k němu připojila s ostychem.",
        "Kdyby se tvoje životní cesta nakreslila, vznikla by galaxie: spirální, rozmazaná a bez jediné vratné šipky.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přivezeš suvenýr, historku a nápad na další výlet. Všechno hned a s úsměvem.",
        "Přátelé tě milují za upřímnost. Aspoň vědí, na čem jsou, i když je to někdy překvapení.",
        "S tebou se člověk nikdy nenudí. Nikdy totiž neví, v jaké zemi bude zítra.",
        "Přátelům nosíš nadšení jako dárek. Nikdy neuhodnou, co dalšího vytáhneš z batohu.",
      ],
      [ // úroveň 2
        "Na zprávy odpovídáš nadšeně. Jen s týdenním zpožděním, protože signál.",
        "Na srazu vyprávíš nejlepší historky. Přátelé jen doufají, že ta o sněžném skútru je pravdivá.",
        "Pozvánky rozesíláš dva dny předem. Přátelé už mají kufr sbalený jen pro případ.",
        "Každému radíš: „Prostě odjeď.“ Rada je skvělá, jen ne v úterý před odevzdáním.",
      ],
      [ // úroveň 3
        "Tvoje „ozvu se“ platí tak dlouho, jak trvá cesta na letiště. A ta je u tebe krátká.",
        "Přátelé oceňují tvoji upřímnost. Hlavně když míří na někoho jiného.",
        "Přátelé už vědí: když napíšeš „mám nápad“, mají dva dny na vymyšlení výmluvy.",
        "Jako parťák na cesty jsi spolehlivost sama. Jako parťák na schůzky spíš legenda.",
      ],
      [ // úroveň 4
        "Když ti kamarád svěří problém, dostane ho zpátky s filozofickým rozborem, citátem a plánem na výlet.",
        "Přátelé tě vedou v kontaktech jako „Střelec (někde na cestě)“. Aktualizace polohy chybí.",
        "Do skupinového chatu pozdravíš z jiného kontinentu. Přátelé už nechtějí vysvětlení, jen potvrzení, že tam máš signál.",
        "Slibuješ kamarádovi pomoc se stěhováním. V den stěhování se stěhuješ ty, jen do Kolumbie.",
      ],
      [ // úroveň 5
        "Přátelé požádali o GPS čip pro tebe. Vesmír žádost zamítl: signál by se ztratil mezi galaxiemi.",
        "Tvoje „ozvu se“ cestuje rychlostí světla. Přijde ale až za rok, protože jede oklikou přes tři souhvězdí.",
        "Přátelé o tobě vyprávějí jako o jednorožci: všichni znají někoho, kdo tě jednou viděl na srazu.",
        "Mezigalaktická rada přátel tě vyloučila za neúčast. Oznámení poslala poštou, adresu našla až po třech světelných letech.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš jako dobrodružství: nové místo, nová parta a vždycky něco nečekaného u dortu.",
        "Nejlepší dárek pro tebe je zážitek: jízdenka, lístek na koncert nebo plavba. Hvězdy aplaudují.",
        "Přání dostaneš z celého světa a odpovíš jim úsměvem. Tak trochu z letadla.",
        "Každé narozeniny jsou pro tebe další zastávka na dlouhé trase. Tahle má dort a výhled.",
      ],
      [ // úroveň 2
        "Oslavu plánuješ den předem a s velkou vervou. Hosté mají aspoň dobrodružství s navigací.",
        "Na přání odpovídáš až o týden později, hromadně a s fotkou z jiné země.",
        "Koupit ti dárek je těžké: nikdo neví, kde zrovna jsi a do které země ho poslat.",
        "Dort sfoukneš rychle, ať zbyde čas na plánování další cesty.",
      ],
      [ // úroveň 3
        "Řekneš „přijďte v sobotu“. V sobotu jsi někde jinde, ale dort je tam. To je tvoje verze pozvánky.",
        "Vlastní narozeniny slavíš v pondělí, v úterý, na výletě a pak ještě jednou, až se vrátíš.",
        "Nejlepší dárek pro tebe je letenka. Nejhorší zahradní židle, protože to zní jako zakořenění.",
        "Svíčky na dortu zhasínáš s přáním. Přání je vždy stejné: ať se nikdo neptá, kdy se vrátíš.",
      ],
      [ // úroveň 4
        "Tvoje oslava se koná tam, kde zrovna jsi. Pozvaní hosté se o tom dozvídají z fotek.",
        "Když máš narozeniny, nikdy nejsi doma. Dort jde do kufru a svíčky se zapalují na letišti.",
        "Hosté ti zpívají „Hodně štěstí“ do hlasové schránky. Dostaneš to za týden, v jiné časové zóně, bez dortu.",
        "Dostaneš deset dárků a zapomeneš je na třech letištích. Pošta ti pak pošle pohlednici: „Našli jsme dvě ponožky.“",
      ],
      [ // úroveň 5
        "Kosmický kalendář zapsal tvoje narozeniny třikrát: v pondělí, na Maledivách a v časové smyčce. Úředník podal rezignaci.",
        "Místo svíček ti NASA zapálila hvězdu. Dort se odpařil dřív, než stihneš cokoli přát.",
        "Černá díra ti poslala přání. Nedoručitelné: adresát se pohybuje rychlostí světla k nejbližšímu letišti.",
        "Narozeniny slavíš tak důsledně na cestě, že se Slunce rozhodlo obíhat kolem tebe. Chce taky dort.",
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
    "Dnes řekneš „ozvu se“. Hvězdy to zapíšou do kategorie „dlouhodobé sliby“.",
    "Dneska ti přijde, že všechno dobře dopadne. Hvězdy nechtějí kazit atmosféru, tak mlčí.",
    "Dnes se tě někdo zeptá na plány na příští rok. Odpovíš: „Mapy ještě nevyšly.“",
    "Dnes zjistíš, že letenka na druhý konec světa je v akci. Hvězdy doporučují nejdřív zodpovědět e-maily.",
    "Dneska budeš v půlce věty vědět, že říkáš víc, než bylo v plánu. Dokončíš ji stejně.",
    "Dnes přijde chvíle, kdy se někdo zeptá „kam vlastně jedeš?“. Hvězdy tipují, že odpovíš: „Uvidíme.“",
    "Dnes zahlédneš na zdi mapu světa. Hvězdy ti doporučují počkat s odjezdem aspoň do večera.",
    "Dneska dostaneš pozvánku na schůzku v pondělí. Odpovíš ano. Hvězdy si zapíšou tvou odvahu.",
    "Dnes se někdo ohradí proti tvé upřímnosti. Zvedneš obočí: „Ale já to myslím hezky.“",
    "Dnešní horoskop: dobrodružství v dohledu. Vzdálenost: dvě zastávky tramvají a jeden kebab.",
    "Dnes ti kamarád nabídne spolupráci na dlouhém projektu. Hvězdy se podívají na tvoji letenku a zavřou oči.",
    "Dneska se ti podaří přijít včas. Hvězdy se podívají na hodinky a začnou si dělat starosti.",
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

export default strelec;
