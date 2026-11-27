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
      "Střelec: optimismus s batohem a nadšení, které se šíří rychleji než fotky z dovolené.",
      "S tebou jdou lidé jen pro chleba a vracejí se z hor.",
      "Svět je pro tebe mapa plná pozvánek a ty na všechny odpovídáš „jasně“.",
    ],
    [
      "Chceš svobodu. Nejlépe s letenkou a bez termínu návratu.",
      "Upřímnost máš rychlejší než přemýšlení. Pointa dorazí až po ní, někdy až pozítří.",
      "O všem prohlašuješ, že to chceš zkusit. I o věcech, které ti zatím nikdo nenabídl.",
    ],
    [
      "Máš plán na celý svět. Jen mu chybí první krok a směr.",
      "Říkáš „neplánuju“. Přitom máš rozjeté tři trasy a v žádné není pondělí.",
      "„Ozvu se.“ Hvězdy upřesňují: z jakého časového pásma a po kolika letech.",
    ],
    [
      "Tvoje upřímnost nemá filtr. Ani brzdy, ani záložní plán.",
      "Závazku se nebojíš. Jen ti při podpisu pokaždé odlétá letadlo.",
      "Při debatě filozofuješ a za deset minut sedíš v letadle. Závěr zbyde potomkům.",
    ],
    [
      "Jupiter tě odvolal z funkce průvodce vesmíru. Zájezd už týden stojí na jiné planetě.",
      "Vesmír tě jmenoval cestovatelem a zapomněl dodat, že cíl neexistuje. Tobě to vyhovuje.",
      "Tvůj optimismus je tak velký, že vzniklo nové souhvězdí: Ještě to nějak dopadne.",
    ],
  ],
  c: [
    [
      "Na všem najdeš něco dobrého. I na zpoždění vlaku, které nazveš bonusovou zastávkou.",
      "Tvoje nadšení se šíří jako vůně svíčkové v neděli: lidé se otočí a jdou za ním.",
    ],
    [
      "Pravdu říkáš tak otevřeně, že ostatní zapomenou, na co se ptali.",
      "Doma je ti nejlíp na cestě. Domov máš tam, kde zrovna přebaluješ batoh.",
    ],
    [
      "Nikdy nechodíš pozdě. Jen se řídíš časovým pásmem, které zná pouze ty.",
      "Řekneš to přímo a pak se divíš tichu. Ty tomu říkáš nadšení, ostatní šok.",
    ],
    [
      "Závazek je pro tebe jako fronta u pokladny v Lidlu: uvidíš ji a okamžitě hledáš jinou pokladnu. Nebo jiný Lidl.",
      "„Jen to krátce vysvětlím“ má u tebe tři body, legendu k mapě a závěrečné titulky.",
    ],
    [
      "Pozemská gravitace se tě pokusila přitáhnout. Vrátila se až po týdnu a s jednosměrnou letenkou.",
      "Vesmír tě chtěl zakotvit. Kotva se vrátila z cesty a poslala pohlednici.",
    ],
  ],
  v: [
    [
      "Verdikt: dobrodružství s dobrým srdcem a lepším batohem, než mají ostatní.",
      "Hvězdy radí: nech si to nadšení. Svět zrovna žádné jiné nemá po ruce.",
    ],
    [
      "Rada hvězd: občas zůstaň na místě. Ber to jako výlet, jen kratší a bez batohu.",
      "Verdikt: upřímnost, otevřenost a pořád sbalený batoh. Hlavně to poslední.",
    ],
    [
      "Verdikt: svoboda je skvělá. Jen nezapomeň, že doma na tebe čeká polévka. Už studená.",
      "Rada: než odjedeš, napiš aspoň kam. Hvězdy ti pošlou pohlednici zpátky.",
    ],
    [
      "Verdikt: s tebou je skvělé cestovat a nemožné plánovat pondělí.",
      "Rada hvězd: občas drž jazyk za zuby. Třeba do konce porady.",
    ],
    [
      "Verdikt vesmíru: domů to máš daleko. Vesmír je kruhový, takže stačí jít pořád rovně. To ti půjde.",
      "Rozsudek: jedna kotva povinně. Vesmír ví, že ji do týdne vyhodíš.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce hledáš dobrodružství. S tebou je rande výlet do neznáma, i když jde jen o kavárnu za rohem.",
        "Partner se u tebe cítí, jako by každé úterý začínaly prázdniny.",
        "Tvoje láska je spontánní: v pátek večer dostane partner zprávu „sbal si pas“. Cíl přijde až potom.",
        "Láska s tebou je cesta bez navigace: občas se zabloudí, ale vždycky u něčeho krásného.",
      ],
      [ // úroveň 2
        "Rande plánuješ spontánně. Partner by tu spontánnost rád znal aspoň den předem, ale to už by byl plán.",
        "Do vztahu přinášíš dobrodružství a půl kufru. Druhou půlku necháváš na letišti.",
        "Říkáš, že potřebuješ prostor. Partner ho vždycky najde: je hned vedle tvého kufru.",
        "K výročí chystáš letenku jako překvapení. Datum odletu zatím nezná nikdo, ani ty.",
      ],
      [ // úroveň 3
        "Řekneš „miluju svobodu“ a čekáš potlesk. Partner zatleská. Pak si sbalí vlastní kufr.",
        "Upřímnost v lásce je u tebe dojemná: řekneš, co cítíš, hned, nahlas a v nejméně vhodnou chvíli.",
        "Máš pevný vztah k cestování a volný ke všemu, co se jmenuje „budeme spolu“.",
        "„Neutíkám, jen se rozhlížím.“ Rozhlížíš se vždycky směrem k východu.",
      ],
      [ // úroveň 4
        "„Vztah“ ti zní jako „pevná trasa“. Chceš, aby se dalo odbočit, přestoupit a zmizet.",
        "Tvoje „nezávazně“ trvá už tři roky. Partner mezitím přestal počítat dny a začal počítat letenky.",
        "Randit s tebou je jako sledovat tabuli odletů s věčným zpožděním. Všichni čekají a nikdo neví na co.",
        "Na první rande přijdeš s nadšením, na třetí s výmluvou a na čtvrté už posíláš pohlednici z Peru.",
      ],
      [ // úroveň 5
        "Mezigalaktický úřad pro vztahy vede tvůj spis pod názvem „Poslední známá poloha: Patagonie“.",
        "Kupid na tebe zamířil, ale šíp se ztratil a přistál v Patagonii. Kupid podal reklamaci.",
        "Planety se kvůli tobě naučily nový pohyb: kroužit kolem někoho, kdo se každé tři dny vzdálí o galaxii.",
        "Černá díra přijela studovat, jak to děláš: všechno pohltíš a vzápětí zmizíš v jiné dimenzi.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci vládne optimismus. Každý problém bereš jako dobrodružství a každou poradu jako přednášku o životě.",
        "Máš skvělé nápady a pevné přesvědčení, že se dají dotáhnout z pláže v Lisabonu.",
        "Kolegové tě obdivují. Hlavně v pondělí, když přicházíš s historkami a suvenýrem z jiného kontinentu.",
        "Tvoje nadšení zvedne náladu celé kanceláře, i když se zrovna řeší výměna tiskárny.",
      ],
      [ // úroveň 2
        "Největší pracovní otázka je pro tebe: kdy je další dovolená? Kalendář zatím mlčí, ty ne.",
        "Poradu bereš jako kontrolní bod před dalším výletem. Ostatní jako poradu.",
        "Kolegům říkáš, co si myslíš. Rychle, nahlas a s úsměvem. Úsměv drží dobře, zbytek občas méně.",
        "Den začínáš nadšením a končíš plánem, kam až se dá zmizet na víkend.",
      ],
      [ // úroveň 3
        "Termín je pro tebe doporučení. Něco jako rada, kterou je hezké znát a nepotřebovat.",
        "V pracovní nabídce stálo „flexibilní“. Šéf myslel flexibilní hodiny, ne flexibilní kontinent.",
        "Pracovní cíle máš jasné: výhled na moře, dobré připojení a nikdo, kdo se ptá na výkazy.",
        "Slibuješ „do pátku“ s jistotou člověka, který nikdy neviděl kalendář. Který pátek, neříkáš.",
      ],
      [ // úroveň 4
        "Ranní porada: pět minut vtipů, tři minuty cestopisu a poslední minuta „no a co jste vlastně chtěli?“",
        "Když se blíží termín, ty se blížíš k letišti. Hvězdy tomu říkají práce na dálku. Hodně na dálku.",
        "Svoboda je tvoje hodnota. Šéf by ji rád viděl i v pracovní smlouvě, ne jen na fotkách z Bali.",
        "Tvůj životopis se čte jako jízdní řád: spousta měst, žádné zakotvení a u každé položky „odchod z osobních důvodů“.",
      ],
      [ // úroveň 5
        "Tvůj pracovní výkon změřila NASA. Výsledek: pěkná oběžná dráha kolem úkolů, přistání nikdy.",
        "Služební cesta do Brna skončila na Maledivách. Vesmírný účetní zatím hledá kolonku „inspirace“.",
        "Galaktický úřad práce eviduje tvůj termín jako nehmotný jev a tvou přítomnost jako teoretickou.",
        "Kdyby byla práce planeta, tvoje oběžná dráha by byla tak daleko, že by se o ní šéf dozvídal jen z pohlednic.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Život je pro tebe jedna velká cesta a každý den přidává novou zastávku. Hvězdy tleskají.",
        "Chuť poznávat všechno za horizontem máš. A někdy i to, co je za rohem.",
        "Každé ráno vítáš jako nový jízdní řád. To je dar, který se nedá koupit ani s akční letenkou.",
        "Optimismus tě nikdy neopouští. Sbalí se do kufru, nastoupí s tebou a nezeptá se, kam jedete.",
      ],
      [ // úroveň 2
        "Život je cesta. Jen si občas zapomeneš sbalit kufr, mapu a pas.",
        "„Kde bydlíš?“ – „Právě teď tady.“ Adresa se aktualizuje podle letenek.",
        "Máš seznam míst, která chceš vidět. Je to nejdelší dokument, jaký ti kdy zůstal rozpracovaný.",
        "Kufr stojí v předsíni natrvalo. Ty tomu říkáš pohotovost, ostatní nábytek.",
      ],
      [ // úroveň 3
        "Plánovat dopředu je pro tebe jako číst předpověď na příští rok: zajímavé, ale nepoužitelné.",
        "Máš přesný plán, kam chceš. Jen ho nikomu neukážeš, protože by se musel dodržet.",
        "Stabilita je pro tebe cizí slovo. Používáš ho jen při hledání ubytování se stabilním připojením.",
        "Tvrdíš, že jsi člověk okamžiku. Okamžik by rád věděl, jestli se vrátíš aspoň na pondělí.",
      ],
      [ // úroveň 4
        "Na každou překážku máš jednu odpověď: „Nějak to dopadne.“ Druhou větu nikdo neviděl.",
        "V peněžence máš lístky z pěti zemí, vstupenky z deseti koncertů a nezodpovězenou otázku, co dělat v pondělí.",
        "Máš rozběhnutých tolik plánů, že se předbíhají. Vítězí ten, který nevyžaduje vstávat.",
        "Tvůj život je cestovní deník bez stránky o příštím roce a s osmi o tom, co se ztratilo na letišti.",
      ],
      [ // úroveň 5
        "Země ti přijde malá a už vyjednáváš s Marsem o víkendové pobyty.",
        "NASA tě zapsala jako „neklasifikovaný pohyb v prostoru“. Vědci se hádají, jestli jde o kometu, nebo o plán na příští týden.",
        "Tvoje „nějak to dopadne“ je tak silné, že ho vesmír používá jako zákon. Fyzika se k němu připojila s ostychem.",
        "Kdyby se tvoje cesta nakreslila, vznikla by galaxie: spirální, rozmazaná a bez jediné vratné šipky.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Z cest vozíš suvenýr, historku a nápad na další výlet. Suvenýr bývá nejméně nebezpečný.",
        "Přátelé tě milují za upřímnost. Aspoň vědí, na čem jsou. Občas by radši nevěděli.",
        "S tebou se člověk nikdy nenudí. Nikdy totiž neví, v jaké zemi bude zítra.",
        "Nadšení rozdáváš jako dárky. Nikdo nikdy neuhodne, co dalšího vytáhneš z batohu.",
      ],
      [ // úroveň 2
        "Na zprávy odpovídáš nadšeně a vykřičníky. Jen týden po zeptání, protože signál. Nebo hory.",
        "Na srazu vyprávíš nejlepší historky. Přátelé jen doufají, že ta o sněžném skútru je pravdivá.",
        "Pozvánky rozesíláš dva dny předem. Kamarádi mají kufr sbalený od začátku roku pro případ.",
        "Každému radíš: „Prostě odjeď.“ Rada je skvělá, jen ne v úterý před odevzdáním.",
      ],
      [ // úroveň 3
        "Tvoje „ozvu se“ platí tak dlouho, jak trvá cesta na letiště. A ta je u tebe krátká.",
        "Přátelé oceňují tvoji upřímnost. Hlavně když míří na někoho jiného.",
        "Přátelé už vědí: když napíšeš „mám nápad“, mají dva dny na vymyšlení výmluvy.",
        "Na cesty jsi spolehlivost sama. Na schůzky spíš legenda.",
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
        "Přání dostaneš z celého světa a odpovíš úsměvem. Tak trochu z letadla.",
        "Každé narozeniny jsou pro tebe další zastávka na dlouhé trase. Tahle má dort a výhled.",
      ],
      [ // úroveň 2
        "Oslavu plánuješ den předem a s velkou vervou. Hosté mají aspoň dobrodružství s navigací.",
        "Na přání odpovídáš až o týden později, hromadně a s fotkou z jiné země.",
        "Koupit ti dárek je těžké: nikdo neví, kde zrovna jsi a do které země ho poslat.",
        "Dort sfoukneš rychle, ať zbyde čas na plánování další cesty. Přání je pokaždé stejné: dál.",
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
    "Dnes se ti zachce na deset dní do hor. Hvězdy rozhodnutí podpoří a zeptají se, kde je mapa.",
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
    "Dnešní horoskop: dobrodružství v dohledu. Vzdálenost: dvě zastávky tramvají a jedna bageta.",
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
