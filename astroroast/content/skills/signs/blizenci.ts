// AstroRoast.ai: knihovna humoru, znamení blizenci. Ručně psané originální české fragmenty.
//
// Tvar (RawSign, viz content/types.ts). Index 0 = úroveň 1 u všeho, co je Five<...>:
//   h  Five<string[]>   headlines: 3 na úroveň
//   c  Five<string[]>   core lines (výchozí věta o znamení): 2 na úroveň
//   v  Five<string[]>   verdikty: 2 na úroveň
//   t  Record<Topic, Five<string[]>>
//                       témata PO ÚROVNÍCH (4 věty na téma a úroveň, schodiště 1 pohlazení … 5 kosmická poprava): pro každé téma (vztahy, prace, zivot, pratele, narozeniny)
//                       pět polí vět (index 0 = úroveň 1), přesně 4 věty v každém. Engine vybere 2 z t[téma][úroveň-1].
//   s  [label, value][] falešné statistiky znamení: 6 kusů
//   d  string[]         denní jednovětky: 24 kusů (každá o „dnes“, tón úrovně 2-3)
//   q  string[]         odpovědi v páru, pořadí viz COUPLE_SITUATIONS v shared.ts: 6 kusů
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
//
import type { RawSign } from "../../types";

const blizenci: RawSign = {
  h: [
    [
      "Blíženci: dva rozhovory najednou, tři nápady a všechno vtipně.",
      "Blíženci mluví s každým. A s každým o něčem jiném.",
      "Máš charisma a čtrnáct otevřených záložek. Hvězdy to berou jako dar.",
    ],
    [
      "Blíženci mají osobnost na večírek a druhou na pondělí. Obě slibují, že se to nestane.",
      "Tvoje věty začínají nahlas a končí v jiném tématu.",
      "Blíženci stihnou dvě věci najednou. K žádné se pak nevrátí.",
    ],
    [
      "Máš názor na všechno. Jen se mění rychleji, než dokončíš první větu.",
      "Blíženci nelžou. Jen říkají obě pravdy po sobě.",
      "Říkáš, že zůstaneš v klidu. To říká jen jedna z tebe. Ta druhá už zvedá hlas.",
    ],
    [
      "Jsi člověk, který nedokončí vě… ale to je jedno. Hvězdy to už vzdaly.",
      "Dvě osobnosti, jedno rozhodnutí. A jedna z nich je vždycky proti.",
      "Názory střídáš rychleji než ponožky. A každý hájíš stejně hlasitě.",
    ],
    [
      "Merkur ti podal výpověď, odvolal ji, podal znovu a nakonec se přestěhoval.",
      "Vesmír tě rozdělil na dvě osobnosti. Obě se hned pohádaly, která je ta původní.",
      "Pozornost ti utekla na Jupiter. Požádala o azyl a trvá na tom, že zůstane.",
    ],
  ],
  c: [
    [
      "Umíš zabavit každého, včetně sebe, a to je u lidí vzácné.",
      "Povídáš si s pokladní v Lidlu, řidičem tramvaje i psem souseda a všichni odcházejí s pocitem, že jste kamarádi.",
    ],
    [
      "Nudíš se rychleji, než se stihneš zeptat, jestli se nudíš. A pak se nudíš i z té otázky.",
      "Zvědavost ti jde skvěle. S dokončováním to máš jako s návodem k pračce: ví se o něm, ale nikdo ho neviděl.",
    ],
    [
      "Máš na všechno názor. Zítra budeš mít na všechno opačný a budeš ho hájit stejně vášnivě.",
      "Mezi „hned to dodělám“ a „to nebylo domluvené“ uběhne u tebe jedna zpráva.",
    ],
    [
      "Domluvíš schůzku tak, že se těší obě tvoje osobnosti a nepřijde ani jedna.",
      "Slibuješ tak hladce, že se k tomu slibu nemůže nikdo přiznat. Včetně tebe.",
    ],
    [
      "Obě tvoje osobnosti dostaly předvolání před hvězdný soud. Ani jedna nepřijde, každá si myslí, že ta druhá už jde.",
      "Tvůj kalendář vede dvojí účetnictví. Obě verze jsou stejně nespolehlivé.",
    ],
  ],
  v: [
    [
      "Verdikt: dvakrát tolik zábavy, poloviční počet dokončených vět.",
      "Hvězdy radí: napiš si, co chceš říct. Pak to přečti. Pak změň názor. Je to v pořádku.",
    ],
    [
      "Rada hvězd: dokonči jednu věc, než otevřeš patnáctou záložku.",
      "Verdikt: skvělá společnost. Jen jedna z vás je vždycky zrovna pryč.",
    ],
    [
      "Verdikt: mluvit umíš skvěle. Škoda, že se k bodu občas dostaneš až po sedmé odbočce.",
      "Rada: až si budeš chtít něco přiznat, přednes to oběma osobnostem najednou.",
    ],
    [
      "Verdikt: duo, které se nikdy nedomluví a stejně vyhraje debatu.",
      "Rada hvězd: na otázku, co chceš, odpověz jednou větou. Té druhé zatím nevěř.",
    ],
    [
      "Verdikt vesmíru: dvojí rozsudek, dvojí odvolání, nulové dokončení.",
      "Rozsudek: příště mluv pomalu. Hvězdy tvrdí, že to nikdo nezkusil.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "S tebou se na rande nikdo nenudí: umíš mluvit o filmech i o smyslu života a ještě stíháš vtipné pauzy.",
        "Flirtuješ tak, že druhý chvíli nechápe, jestli se baví, nebo zamilovává. Ve skutečnosti je to totéž.",
        "Rozesmát toho, kdo sedí naproti, je disciplína, kterou ovládáš. Vedlejší stůl poslouchá.",
        "S tebou partner nikdy neví, co přijde: vtip, hluboká myšlenka, nebo třetí věc, která se právě vynořila.",
      ],
      [ // úroveň 2
        "V lásce chceš všechno: hlubokou řeč, lehkost, překvapení a něco nového každé tři dny. Partner stíhá a hodně se směje.",
        "Svoje city vyjadřuješ zprávami: deset za pět minut, tři o něčem jiném a jedna se smajlíkem, který znamená všechno.",
        "Když se ti někdo líbí, mluvíš o něm s kamarády tak dlouho, že dotyčný dostane pozvánku, aniž by o tom věděl.",
        "Rande s tebou má tři dějství: rozhovor, odbočka a otázka, jak jsme se vlastně dostali k lamám.",
      ],
      [ // úroveň 3
        "„Jsem v tom stoprocentně“ u tebe platí do příštího pátku. Pak se objeví důvod, proč to zas nebylo úplně ono.",
        "Partner vždycky ví, na čem je: na jedné z tvých dvou verzí. Která dnes dorazí, zjistí až při pozdravu.",
        "Vztah ti vyhovuje, když se dá aspoň jednou týdně zeptat: „Co kdybychom byli úplně jiní?“ Partner tohle zadání dostává od ledna.",
        "Hádky s tebou jsou fascinující: začnou nádobím, pokračují filozofií a končí tím, že nikdo neví, kdo měl pravdu.",
      ],
      [ // úroveň 4
        "„Musíme si promluvit“ trvá u tebe tři hodiny a pět témat. Ani jedno není to, kvůli čemu partner přišel.",
        "Vybrat si mezi dvěma možnostmi je pro tebe jako vybrat jedno z dvojčat. Bereš obě a doufáš, že si toho nikdo nevšimne.",
        "Vztahový status máš „je to složité“. Partner má „už to nechápu“. Obě pravdy dorazily v jednom dni.",
        "„Zítra ti to vysvětlím“ platí od září. Cílová stanice je pořád v mlze odboček.",
      ],
      [ // úroveň 5
        "Tvoje vyznání lásky se rozdělí na dvě verze. Merkur z nich vybere třetí: „Nevím, ale je to skvělé.“ A obě zruší.",
        "Ve tvém vztahu panuje klima jako na Jupiteru: bouře jsou neustále někde, jen se pohybují rychleji, než je stihne radar.",
        "NASA vede tvoje rande jako anomálii: dva lidé u jednoho stolu, tři konverzace a vesmír, který si to zapisuje a nestíhá.",
        "Když se hádáš, zapojí se obě osobnosti. Výsledek: hádka na dvou frontách, vítěz žádný a žádost o příměří na Merkuru.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci umíš oživit každou schůzku: pár vtipů, pár nápadů a z nudné porady je místo, kam se lidem chce chodit.",
        "Kolegové tě mají rádi, protože když se zadrhne řeč, vytáhneš z klobouku tři nápady. Aspoň jeden obvykle funguje.",
        "Složitou věc umíš vysvětlit tak, že ji pochopí i pondělní ráno.",
        "S tebou se práce neomrzí: vždycky se najde nová odbočka, nový nápad a nová otázka. Ať už byla zadaná, nebo ne.",
      ],
      [ // úroveň 2
        "V práci děláš tři věci naráz. Všechny dokončíš ve stejný okamžik. Tedy ve čtvrtek, kdy už je pozdě.",
        "Na poradě máš nápad k tématu, nápad k vedlejšímu tématu a nápad z chodby. Řekneš je najednou.",
        "Pracovní e-maily píšeš s citem: dlouhé, vtipné a s přílohou, která zůstala v konceptech.",
        "Zavřených záložek máš málo, otevřených čtyřicet. Hvězdy věří, že mezi nimi je i ta s úkolem.",
      ],
      [ // úroveň 3
        "Tvoje „hned se na to podívám“ je pracovní verze „možná někdy“. Kolegové mají pro obě oficiální překlad: příští kvartál.",
        "Multitasking ti jde skvěle: pět věcí rozdělaných, nula dotažených a pocit, že jsi hodně produktivní.",
        "Kolegovi vysvětlíš zadání tak, že pak pracuje na něčem úplně jiném. Obvykle s větším nadšením než na původním.",
        "Otázka z pohovoru „Jaká je vaše největší slabina?“ u tebe zabere čtyřicet minut a skončí debatou o filmech.",
      ],
      [ // úroveň 4
        "Pracovní poznámky máš jako šifru: půlky vět, tři šipky a slovo „ZÍTRA!!!“ Kolegové je zkoumají s lupou a bez úspěchu.",
        "Když ti kolega zadá úkol, řekneš „jasně“. Do deseti minut ho řeší někdo jiný. Tobě to říká delegování, ostatním záhada.",
        "Kalendář máš ve dvou verzích, obě pravdivé a obě se překrývají. Kolegové chodí na schůzky podle té, kterou uvidí první.",
        "Dokončit práci je u tebe jako dokončit větu: slibný začátek, spousta odboček a závěr, který zmizel v mlze jiného tématu.",
      ],
      [ // úroveň 5
        "Merkur ti na pracovní den přidělil dva týmy, tři projekty a jednu časovou osu, která se každou hodinu přepíše. Odmítá zodpovědnost.",
        "Tvoje schůzky mají vlastní hvězdnou mapu: planety kolem nich krouží a mizí. Jen tobě to pořád připadá jako jeden bod programu.",
        "Cestou do práce se ti rozdvojí pozornost, ta druhá odletí na Saturn a vrátí se se suvenýrem. Suvenýr je nápad a nikdo o něj nežádal.",
        "Tvůj pracovní e-mail má podle astronomů vlastní gravitaci: čím víc odpovídáš, tím víc ho přibývá. Ty tomu říkáš komunikace.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Život u tebe neběží na autopilota. Každý den je nový nápad, nová odbočka a rozhovor s někým, koho právě potkáváš.",
        "Zvídavost je tvoje vstupenka do světa. Dozvíš se o všem a hned to chceš sdílet. Hvězdy by tě rády viděly na vlastní rozhlasové stanici.",
        "Umíš najít zajímavost v obyčejných věcech: fronta, autobus, ponožka. Všude najdeš pointu.",
        "S tebou je den vždycky o něco veselejší. A když se nevydaří, aspoň z něj bude výborná historka.",
      ],
      [ // úroveň 2
        "Máš tolik zájmů, že ti nestačí den. Ani týden. Sobotu už vesmír zkoušel prodloužit, nepomohlo to.",
        "Ráno plánuješ jedno, v poledne děláš druhé a večer třetí. Hvězdy nevědí, co sledovat, a tak sledují všechno.",
        "Nápad ti vydrží pět minut. Pak přijde další a ten první se bez zlosti vrátí do šuplíku k ostatním.",
        "Knihu necháš v půlce. Seriál taky. Kurz taky. Doma ti vyrůstá muzeum půlek.",
      ],
      [ // úroveň 3
        "Od pondělí začneš nový život. Pondělí je tvoje oblíbená výmluva, protože je pořád před tebou.",
        "Tvůj život je jako dobrý kvíz: spousta otázek, žádná odpověď a všichni se příjemně baví, protože nikdo neví, jak to dopadne.",
        "Plánuješ pečlivě a pak improvizuješ. Plán to nese statečně jako host, který zjistil, že se večírek koná jinde.",
        "Říkáš, že umíš odpočívat. Odpočinek ti vydrží do chvíle, než ti přijde nápad na jiný odpočinek.",
      ],
      [ // úroveň 4
        "Pozornost ti funguje jako rádio mezi dvěma stanicemi: tři písničky naráz, kus reportáže a hlášení o dopravě.",
        "Archeologové budou jednou zkoumat tvůj disk a najdou složku „Nový projekt (3) (konečná verze)“. Který projekt to byl, se nezjistí.",
        "Když si máš vybrat jednu věc, vybereš dvě, třetí přidáš, čtvrtou vymyslíš a skončíš u té, která v původním seznamu nebyla.",
        "Bez odboček dotáhneš jen hlasovou zprávu „jsem na cestě“. Zbytek života jezdí po vedlejších kolejích.",
      ],
      [ // úroveň 5
        "Merkur tě vede jako „vícevláknový proces“. Jedno vlákno chybuje, ale protože je to jen jedno z dvanácti, nikdo si toho nevšimne.",
        "Vesmír zaregistroval dvě verze tebe, které míří každá jiným směrem. Teď se řeší, která má nárok na dnešek a která na zítřek.",
        "NASA by tvoje nápady našla v pěti galaxiích. Ani jeden není dotažený a tři už nikdo nepamatuje.",
        "Tvoje zvědavost je tak velká, že kvůli ní vznikla hranice Sluneční soustavy. Pluto si najalo mluvčího.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "S tebou se skupina nikdy nenudí. Stačí, že přijdeš, a hned je o čem mluvit, kam jít a co ochutnat.",
        "Přátelé tě milují, protože umíš navázat rozhovor s kýmkoli. I s tím, kdo si myslel, že dnes už mluvit nebude.",
        "Přátelství s tebou má jedno pravidlo: kdo s tebou sedí, má vždycky co vyprávět. Příběhů máš na každou příležitost.",
        "Vždycky víš, kdo komu napsat, kdo má narozeniny a kdo má o víkendu plán. Přátelé tě mají jako sociální kalendář s úsměvem.",
      ],
      [ // úroveň 2
        "S tebou je sranda. A taky se dozvíš tři věci, které nikdo nechtěl vědět, a dvě, které všichni chtěli.",
        "Na zprávu odpovídáš rychle. Na otázku v ní už ne. Přátelé si zvykli a posílají otázky ve dvou verzích.",
        "Plány s přáteli děláš jako kvíz: spousta možností, žádná jistota a všichni se pobaví. Hlavně ty.",
        "Když přátelé povídají, posloucháš s plným zájmem. Aspoň do chvíle, než se vynoří vlastní příběh a ten je přece lepší.",
      ],
      [ // úroveň 3
        "Přátelé tě mají jako zdroj informací. Jen občas netuší, jestli věřit verzi z pondělí, nebo ze čtvrtka.",
        "Slib „přijdu určitě“ platí u tebe na třicet procent. Zbylých sedmdesát je „možná, ale zkusím“ a „ještě se uvidí“.",
        "Ve skupině hraješ roli moderátora: každé téma uvedeš, změníš a nakonec odvoláš. Hosté odcházejí s pocitem, že debata nikdy neskončila.",
        "Když tě přátelé žádají o radu, vyslechneš je pozorně. Pak dáš čtyři protichůdné rady a všechny zní úplně jistě.",
      ],
      [ // úroveň 4
        "Přátelé mají na tebe vlastní pravidlo: „Co řekne Blíženec v pondělí, platí do úterý.“ Středa je spíš legenda.",
        "Když přátelům posíláš hlasovku, trvá devět minut. Dvě minuty úvod, čtyři odbočka a poslední tři slovo „vlastně“.",
        "Přátelé si zvykli, že pozvánku plníš dvakrát: tělem v jednu hodinu, myšlenkami ve tři. Mezi tím je jen úsměv.",
        "Tvoje skupinová konverzace vypadá jako dálnice se čtyřmi vjezdy: každý jede jiným směrem, ale všichni troubí.",
      ],
      [ // úroveň 5
        "Přátelé tě vyhlásili za vesmírnou anomálii: na jednom místě jsi dvakrát, ale ani jednou nedorazíš včas.",
        "Když přátelé pošlou pozvánku, dorazí na dva různé časy. Jedna verze tebe přijde, druhá už odlétá na Jupiter. Pozvánka se vrací s dopisem od Merkuru.",
        "Tvoje parta má kodex: „Ať Blíženec řekne cokoli, ověřit u druhé verze.“ Intergalaktická rada kodex schválila a přidělila mu tlumočníka.",
        "Tvoje vyprávění je tak dlouhé, že mezi první větou a pointou vznikla nová galaxie. Dosud se řeší, jestli do ní patří závěr.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš jako festival nápadů: dort, hosté, hra, hudba a ještě jeden bod, který přišel v poslední chvíli.",
        "K narozeninám dostaneš tolik zpráv, že jejich přečtení je samo o sobě dárek. A ty na každou odpovíš originálně.",
        "Tvoje oslava je místo, kde se potkají lidé, kteří by se jinak nepotkali. A skončí společným tancem, o kterém nikdo předem nevěděl.",
        "Přání u tebe nezačínají „Všechno nejlepší“. Spíš „Tak co, jaký bude příští rok?“ A pak se povídá do rána.",
      ],
      [ // úroveň 2
        "Narozeninový plán máš jasný: tři různé oslavy, jedna hlavní a dvě improvizace. Hosté dostávají mapu.",
        "Dárky otvíráš s vervou: první potěší, druhý rozesměje a třetí tě naladí na čtvrtý. K poděkování se vrátíš později. Ve stejný den.",
        "Svíčky sfoukneš, přání si vymyslíš tři a vyslovíš jen jedno. Hvězdy poslouchají všechny tři pro jistotu.",
        "Na narozeninách vypráví každý host něco jiného. Ty se zapojíš do všech konverzací najednou a loučíš se se všemi dvakrát.",
      ],
      [ // úroveň 3
        "Říkáš, že na oslavu pozveš jen pár lidí. Pak ti dojde, že znáš ještě sedmnáct dalších, kteří by to určitě ocenili.",
        "Tvoje oslava má dva programy: ten oficiální a ten, který vznikl v půlce. Hosté si pamatují jen ten druhý.",
        "K narozeninám si přeješ klid. Do hodiny to přepíšeš na „drobné překvapení“ a do tří na „velkolepou akci“.",
        "Pozvánku na oslavu rozešleš za tři dny: původně sobota, pak neděle, pak „uvidíme“. Hosté mají v kalendáři zapsáno „Blíženci“.",
      ],
      [ // úroveň 4
        "Tvoje oslava začíná „v šest“. Ve čtvrt na sedm ještě domlouváš program. V půl osmé se konečně všichni seznámili, jen ne s oslavencem.",
        "Přání k narozeninám si u tebe musí vybrat: dort, dárek, nebo tři hodiny řeči. Ty bereš všechno a ještě se ptáš, jestli je něco navíc.",
        "Svůj věk dáváš v nových verzích: „dvacet devět plus jedna“, „věk, který je právě v módě“. Hosté si dělají poznámky a stejně počítají špatně.",
        "Tvoje narozeniny jsou jediná akce, kde se hosté ptají, kdo je tu vlastně oslavenec. Hlásí se ten, kdo vypráví nejvíc.",
      ],
      [ // úroveň 5
        "Merkur ti posílá dvě přání naráz, protože netuší, která osobnost má dnes narozeniny. Obě mají nárok na dort.",
        "Tvoje oslava probíhá na třech místech současně. Hosté se potkávají v chodbě a zjišťují, že všichni zvou na stejnou akci a nikdo neví kam.",
        "Kdykoli sfoukneš svíčky, dvě z nich se vrátí s protestem: „My jsme chtěly zůstat hořet, než dopovídáš.“ Vesmír protest přijal.",
        "Tvoje narozeniny trvají tak dlouho, že Merkur mezitím obletí Slunce a vrátí se s přáním z minulého týdne.",
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
    "Dnes ti Merkur radí: napiš tu zprávu hned. A pak ji pošli jinému člověku.",
    "Dnes ti někdo položí otázku. Odpovíš na třetí věc, která se kolem toho stala.",
    "Dnešní horoskop se rozdvojil. Oba platí, jen každý v jiný den.",
    "Dnes tě něco zaujme tak, že na to zapomeneš dřív, než dojde na druhé.",
    "Dnes se ti zdá, že už to mělo být hotovo. Nebylo. Ani nezačalo. Ale máš o tom skvělou historku.",
    "Dnes se stane něco zajímavého. Jen to nevíš, protože už otevíráš další záložku.",
    "Dnešní tip: v poledne zavři alespoň tři okna. Nepomůže to, ale bude se ti dýchat lépe.",
    "Dnes budeš mluvit o tom, co se ti stalo. Pak o tom, co se nestalo. Pak o tom, co se stane.",
    "Dnes tě čeká důležité rozhodnutí. Dvě verze tebe se zatím neshodly na tom, která z nich ho dělá.",
    "Dnes budeš pozorně poslouchat. Aspoň do chvíle, než tě něco rozptýlí. Chvíle začíná… teď.",
    "Dnes napíšeš pět zpráv a odešleš tu, která byla určená někomu jinému.",
    "Dnes začneš větu na jednom konci kavárny a dokončíš ji na druhém. Posluchač ti vydrží jen první polovinu.",
    "Dnes zjistíš, že ten zajímavý fakt, který všem vyprávíš, nikdo nechtěl. Ale všichni se smáli, takže to platí.",
    "Dnes si řekneš, že se podíváš jen na jedno video. V kolik skončíš, hvězdy raději nekomentují.",
    "Dnes se zeptáš, co kdo dělá o víkendu. Jedna z tvých osobností odpoví sama.",
    "Dnes ti dojde, že máš v telefonu šest nedokončených konverzací. V každé čeká jiné „vlastně“.",
    "Dnes tě osloví cizí člověk a za deset minut budete kamarádi. Za jedenáct už nebudete vědět, o čem to bylo.",
    "Dnes ti Merkur nabídne dvě možnosti. Zvolíš třetí, kterou vymyslíš cestou.",
    "Dnes tě napadne skvělý nápad. Zapíšeš si ho. Za hodinu ti bude připadat, že patří někomu jinému.",
    "Dnes ti někdo řekne „stručně“. Odpovíš „jasně“ a pak zaplníš tři minuty rozhovoru slovem „vlastně“.",
    "Dnes budeš mluvit tak rychle, že ti kamarád zvedne ruku s otázkou, jestli se už může nadechnout.",
    "Dnes se rozhodneš pro jednu věc. Půl hodiny budeš žít v klidu. Pak jedna z tvých osobností zavolá odvolání.",
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

export default blizenci;
