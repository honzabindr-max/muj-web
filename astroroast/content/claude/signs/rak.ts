// AstroRoast.ai: knihovna humoru, znamení rak. Ručně psané originální české fragmenty.
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

const rak: RawSign = {
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
      [ // úroveň 1
        "V lásce jsi jako domov: kdo u tebe najde pozornost, jídlo a pocit, že se nemusí nikam vracet, zůstane tak dlouho, jak chce.",
        "Pamatuješ si všechno, co partner řekl, a občas i to, co už sám zapomněl. Každé drobné gesto se u tebe počítá.",
        "Tvoje romantika má vůni polévky a barvu měsíčního světla. Je tichá, hřeje a občas se dojme u reklamy.",
        "Když se zamiluješ, staráš se o druhého tak, že za tři dny ví, jak chutná tvoje polévka, tvoje bábovka a tvoje péče.",
      ],
      [ // úroveň 2
        "Ve vztahu vedeš tajný archiv: kdy se co stalo, kdo co řekl a jakým tónem. Partner o něm tuší, ale zatím nenahlédl.",
        "Když partner neodpoví do hodiny, tvoje fantazie už píše tři verze. V první je jen zdržení, ve druhé drama a třetí má i hudbu.",
        "Rande plánuješ jako rodinnou oslavu: jídlo, vzpomínky a dost ubrousků na dojetí. Partner si pro jistotu nosí zásobu.",
        "Do vztahu přineseš domov i vlastní polštář. Partner brzy pochopí, že to není obyčejný polštář, ale součást smlouvy.",
      ],
      [ // úroveň 3
        "Tvoje „nic se neděje“ ve vztahu znamená, že se děje. Partner má tři hodiny na rozluštění kódu, jinak následuje tichý režim.",
        "Hádku ukončíš zvláštním způsobem: odejdeš do kuchyně a začneš vařit. Partner se po hodině dozví, že omluva chutná po mouce.",
        "Romantika podle Raka: vyznání, polévka a nenápadný přehled, kdo naposledy něco zapomněl. Skóre se drží pevně.",
        "Věříš, že vztah je o upřímnosti. Zároveň ale tvrdíš, že „nic ti není“, a čekáš, že to partner vyčte z pohledu.",
      ],
      [ // úroveň 4
        "Tvoje urážka ve vztahu má tři fáze: tichá, hlasité nádobí a láskyplná omluva, která ve skutečnosti pokračuje v urážce jinými prostředky.",
        "Partner se zeptá, co se děje. Odpovíš „nic“ a on má dvanáct vteřin na rozluštění. Pokud neuspěje, následuje týdenní ticho se zabaleným obědem.",
        "Pamatuješ si všechny hádky z posledních pěti let, včetně dne, počasí a toho, co kdo měl na sobě. Soud by se o tobě učil v dějepise.",
        "Tvoje žárlivost se tváří jako starost: „Jen se ptám, kde všechno tak dlouho trvá. Čaj vystydl.“",
      ],
      [ // úroveň 5
        "Při tvých hádkách vzniká na Zemi příliv. Oceány tě žádají, ať termíny oznamuješ předem a dopřeješ jim přípravný čas.",
        "Když se urazíš, i černá díra si dělá poznámky a Neptun vybírá omluvnou kartičku.",
        "Tvoje láska je široká jako Mléčná dráha. Jakmile ale partner zapomene výročí, stáhne se do pouzdra o velikosti vlašského ořechu.",
        "Partner, který poprvé řekne „v pohodě“ a myslí to vážně, získá od vesmíru cenu. Stává se to zhruba jednou za dvě stě let.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci jsi srdce týmu: pamatuješ narozeniny, nosíš dobroty a kolegové vědí, že u tebe najdou klid. Nebo aspoň sušenky.",
        "Pracovní prostředí umíš zútulnit tak, že se i pondělí těší na kafe. Stačí jedna rostlina a hrnek s nápisem.",
        "Zákazníky vedeš s citem: mluví s tebou rádi, protože cítí, že jim opravdu chceš pomoct. A to se pozná.",
        "Kolegové vědí, že při krizi bude tvůj stůl první s čajem a nápadem. Obojí nesmírně hřeje.",
      ],
      [ // úroveň 2
        "V práci se staráš o všechny. Jen o tvůj úkol se většinou nikdo nestará, protože leží pod hromadou cizích dobrých skutků.",
        "Pracovní e-mail ti zabere dvě hodiny: hodinu psaní a hodinu přemýšlení, jestli někoho nezraní. Většinou nezraní nikoho.",
        "Na poradě si dáváš pozor na každé slovo. Kolegové často řeší, jestli „v pořádku“ znamená opravdu v pořádku.",
        "Kolegu, který zapomene poděkovat, si pamatuješ. Nevadí ti to. Jen víš, že se díváš. A že on ví, že víš.",
      ],
      [ // úroveň 3
        "Tvoje „v pořádku, můžeš to nechat“ v práci znamená, že to v pořádku není a že budeš tři týdny potichu připomínat.",
        "V práci umíš číst myšlenky podle tónu e-mailu. Většinou se trefíš, a když ne, rovnou si to zapíšeš.",
        "Pochvalu od šéfa potřebuješ jako vzduch. Kritika je pro tebe jako deštník: prochází mezi kapkami, ale všechny si odneseš domů.",
        "Rozhodování v práci ti jde skvěle, pokud se ostatní nedívají. Jakmile se podívají, začne se řešit, kdo se komu jak tváří.",
      ],
      [ // úroveň 4
        "Na poradě se tváříš klidně. Uvnitř běží tři emoční seriály a jeden dokument o tom, jak tě kolega minulý týden přerušil.",
        "Tvoje pracovní zásuvka obsahuje dvanáct druhů čaje, tři deky a seznam kolegů, kteří dluží omluvu. Poslední sloupec je nejobsáhlejší.",
        "Když ti šéf řekne „můžeme si promluvit?“, tvoje fantazie zaznamená zemětřesení síly sedm s dozvukem do pátku.",
        "Kolegové o tvých pocitech vědí hned ráno. Tvoje káva klepe na hrnek jinak, když se něco stalo.",
      ],
      [ // úroveň 5
        "Pracovní nálada ti kolísá s přílivem. NASA proto zavedla kalendář s fázemi Měsíce a kolegové si v něm píšou, kdy se s tebou dá mluvit.",
        "Když se ti v práci něco nelíbí, černá díra zadrží dech a vesmír na chvíli ztichne. Pak z kuchyňky zazní lžička v hrnku a všichni vědí.",
        "Tvoje „já nemám žádný problém“ letí kanceláří rychlostí světla a dopadne na kolegu v kuchyňce až za týden. Vesmír mu doporučuje sluchátka.",
        "Kolega zapomene poděkovat. Do pěti hodin to ví Mars, Saturn a pár vzdálených mlhovin. Do pondělí je z toho téma na jeden galaktický rok.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Život umíš zabalit do tepla: deka, polévka a pár lidí, kteří vědí, že jsi doma. Nic víc nepotřebuješ a všechno už máš.",
        "Máš dar dělat z každého místa domov. I vlak, hotel nebo čekárna se po tvém příchodu změní na obývací pokoj.",
        "Vzpomínky ti zůstávají jako fotky v rámečku: v dobré kvalitě a s nápisem, kdo je u toho. Hvězdy v nich rády listují.",
        "Když se někdo trápí, objeví se ti v ruce hrnek čaje. Ani nevíš odkud. Prostě talent.",
      ],
      [ // úroveň 2
        "Nálady ti chodí jako počasí: ráno slunce, v poledne mrak a večer polévka. Hvězdy si to zapisují do kalendáře.",
        "Doma máš věci tak, že kdyby je někdo přesunul, tvoje srdce to pozná do tří sekund. Rodinný alarm.",
        "Pamatuješ si, co kdo jedl na svátky před sedmi lety. Šikovné u dárků, trochu nebezpečné u hádek.",
        "Víkend plánuješ doma. Když přijdou tři pozvánky, odmítneš je tak jemně, že se pozvaní omlouvají.",
      ],
      [ // úroveň 3
        "Tvrdíš, že nostalgie tě nezajímá. Jen ti občas dojde, že staré věci voní líp. Třeba ty z roku 2009.",
        "Tvoje „nic mi není“ se ráno mění v „nic, ale chci domů“ a večer v „víš co, tohle už si pamatuju“.",
        "Rozhodování o večeři je pro tebe emoční událost. Ve skutečnosti volíš mezi polévkou z dětství a polévkou z dětství ve druhé variantě.",
        "Vzpomínky ukládáš do krabic podle barvy nálady. Když se jedna otevře, celý den je v ní.",
      ],
      [ // úroveň 4
        "Tvůj domov je pevnost s vlastním počasím: dvě deky, tři polštáře a atmosféra, ve které se host po pěti minutách rozpláče. Z dojetí.",
        "Když tě něco zraní, zatáhneš se do skořápky a odtamtud posíláš tři hlasovky s textem „nic se neděje“. Každá trvá minutu a půl.",
        "Jedna reklama na rodinné jogurty tě rozpláče, jedna ztracená ponožka rozzlobí a jedna vzpomínka na prázdniny z roku 1998 položí na celý den.",
        "Tvoje emoční tempo je horská dráha: nahoru, dolů, smyčka a nakonec zastavení u polévky. Cestující mají pásy a v ruce kapesníky.",
      ],
      [ // úroveň 5
        "Měsíc tě vyhlásil za svého zástupce na Zemi. Přílivy se podle tebe řídí a pláže hlásí „výjimečný stav pro dojetí“.",
        "Tvoje emoce mají vlastní oběžnou dráhu a dva měsíčky. Jeden se jmenuje Nostalgie, druhý Polévka. NASA je nemůže vyfotit, pořád se hýbou.",
        "Polévka ze všech tvých pocitů by nasytila celou Mléčnou dráhu. A ještě by zbylo na druhý den.",
        "Při tvém emočním výbuchu zaznamenaly seismografy na Marsu poplach. Mars odpovídá: „Děkujeme za upozornění. Posíláme deku.“",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přátelé u tebe nacházejí domov: dobrý čaj, upřímné ucho a vždycky něco k jídlu. Nikdo neodchází hladový ani smutný.",
        "Pamatuješ si, co kdo má rád, kdy má narozeniny a jak se tvářil, když dostal poslední dárek. Přátelé tě mají jako lásku s paměťovou kartou.",
        "Když se někdo z přátel trápí, přijdeš s polévkou dřív, než stihne zavolat. Nikdo neví, jak to děláš. Je to dar.",
        "S tebou se dá povídat o všem. Přátelé vědí, že tvoje uši jsou otevřené a tvoje polévka vždycky o jednu porci větší.",
      ],
      [ // úroveň 2
        "Přátelé mají u tebe výhodu: řekni cokoli a ty to vstřebáš, uložíš a občas citlivě připomeneš.",
        "Zprávy přátelům čteš třikrát, než odešleš. A pak ještě dvakrát, aby bylo jisté, že nezní jinak než v hlavě.",
        "Když přátelé zapomenou na narozeniny, tvoje „nevadí“ zní jako omluva, ale taky jako pozvánka na dlouhý rozhovor.",
        "Na skupinový výlet bereš tašku s jídlem, lékárničku a pocit, že tohle je tvoje malá vesmírná loď. Ostatním stačí tričko.",
      ],
      [ // úroveň 3
        "Tvoje „vůbec se nezlobím“ přátelům nic neříká. Mají od tebe týdenní program: ticho, ticho a pak věta, která zasáhne přesně.",
        "Přátelé oceňují, že pro ně máš čas. Čas máš, jen se k němu občas přidává tichý seznam toho, co mu předcházelo.",
        "Pamatuješ si, kdo komu kdy nenapsal. A když se ten dotyčný ozve, přivítáš ho vřele, s úsměvem a poznámkou o roku 2019.",
        "Říkáš, že se nic nestalo. Přátelé už vědí, že se stalo, ale že do čtvrtka nebude čas na rozbor.",
      ],
      [ // úroveň 4
        "Tvoji přátelé mají na tebe mapu nálad: zelená je „můžeš se zeptat“, žlutá „opatrně“ a červená „napiš jen srdíčko“. Mapa se aktualizuje po třech hodinách.",
        "Výlet s tebou má pevný program: dojetí, urážka, usmíření a polévka. Pořadí se může změnit, polévka je jistota.",
        "Když tě někdo z přátel opomene pozvat, archiv v tobě zapne záznam. Přesný popis události se dozví na příštím Silvestru.",
        "Přátelům posíláš dlouhé zprávy plné pocitů. Odpoví jim palec nahoru a ty na něj hledíš dvě hodiny jako na vzkaz v cizím jazyce.",
      ],
      [ // úroveň 5
        "Přátelé tě vedou pod kódovým označením „Měsíc“: změny nálady se dají předpovědět jen podle fází a pořád se mýlí.",
        "Tvoje parta má záložní tým pro případ, že se urazíš. Tým zahrnuje dva lidi, tři dorty a jedno oficiální stanovisko vesmíru.",
        "Kdyby paměť přátel fungovala jako tvoje, v archivu by vznikla nová galaxie. Naštěstí ji spravuješ ty, s láskou a poznámkami.",
        "Když se rozhodneš odpustit, vesmír to vysílá jako zprávu: „Rak dnes odpouští. Ostatní planety, zachovejte klid.“",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš jako malý rodinný svátek: dort, objímání a pár slz dojetí. Hosté odcházejí s pocitem, že byli doma.",
        "Všechna přání si pamatuješ: kdo napsal, kdo zavolal a kdo poslal nejkrásnější kartičku. A ještě víš, jakou barvou.",
        "Dort pro tebe peče někdo, kdo tě má rád. To je ten nejlepší recept: laskavost, máslo a třetí vrstva pozornosti.",
        "Narozeniny jsou pro tebe den, kdy se dojímáš nahlas a nikdo se tomu nesměje. Pokud ano, tak s láskou.",
      ],
      [ // úroveň 2
        "K narozeninám dostaneš tolik zpráv, že si je přečteš třikrát a pak ještě večer. Hvězdy tomu říkají sentimentální chlebíček.",
        "Tvoje oslava je přesně jako domov: hřejivá, trochu hlučná a s koutkem, kam se schováš, když tě dojmou přání.",
        "Dárek otvíráš pomalu. Zkoumáš papír, stuhu a tak dlouho, že hosté začnou nosit židle.",
        "Svíčky sfoukneš s malou slzou. Přání zůstává tajné, ale hvězdy tipují, že obsahuje slovo „polévka“.",
      ],
      [ // úroveň 3
        "Tvrdíš, že narozeniny nic neznamenají. Zarámované album z posledních dvaceti oslav tvrdí opak.",
        "Říkáš, že nechceš žádný dárek. A pak se podíváš, kdo co přinesl, a tvoje mlčení řekne víc než deset slov.",
        "Když na tvoje narozeniny zapomene někdo blízký, řekneš „vůbec to nevadí“. Pak ho založíš do archivu a příští rok ho vytáhneš.",
        "Dort je pro tebe symbol: kdo ho přinese, ten tě má rád. Kdo zapomene, dostane tichou omluvu a polévku o úroveň slabší.",
      ],
      [ // úroveň 4
        "Tvoje narozeniny mají scénář: hosté dorazí, rozpláčeš se, obejmeš každého a večer pošleš dvanáct děkovných hlasovek. Každá delší než oslava.",
        "Seznam lidí, kteří ti nepopřáli, vzniká dřív než ten s lidmi, kteří popřáli. A je přesnější.",
        "Tvoje narozeniny trvají od rána do rána. V půl dvanácté zazní „ještě nemám dárek“ a pak se už jen jí, pláče a vzpomíná.",
        "Dárek od blízkých hodnotíš podle toho, kolik v něm bylo vzpomínek. Ponožky mají nízké skóre, i když jsou měkké.",
      ],
      [ // úroveň 5
        "Měsíc ti každý rok pošle přání nejmenšího možného rozměru: „Všechno nejlepší. Prosím, nesmutni.“ Rakova odpověď má 482 stran a je laskavá.",
        "Při tvých narozeninách zaznamenaly oceány prudký příliv. Je to dojetí: tři sta litrů slz, patnáct odstavců vzpomínek a jedna bábovka.",
        "Tvůj dort je tak sentimentální, že NASA nasazuje mezigalaktický dohled. Nikdo ho nechce poškodit. Ani žádné souhvězdí.",
        "Každý rok slavíš ve stejném duchu: polévka, rodina a album vzpomínek. Vesmír už připravuje vlastní recept a tajně ho zkouší.",
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
    "Dnes ti Měsíc oznámí, že máš náladu. Neřekne jakou. Počkej na další vydání.",
    "Dnes si vzpomeneš na něco, co se stalo před třemi lety. A hned z toho bude téma na tři dny.",
    "Dnešní konstelace: polévka v zenitu, pohodlí na západě, urážka na obzoru.",
    "Dnes ti někdo řekne „jak se máš“. Máš dvanáct odpovědí. Dvě z nich dnes ještě nikdo nezažil.",
    "Dnes ti dojde, že ti něco chybí. Je to hrnek čaje. Vždycky je to hrnek čaje.",
    "Dnes budeš mít pocit, že tě nikdo nechápe. Hvězdy tě chápou. Jen se k tomu nehlásí.",
    "Dnešní tip: nesmutni ze všeho najednou. Rozlož to na tři dny.",
    "Dnes ti někdo odmítne tvůj dort. Hvězdy doporučují nebrat to jako zradu.",
    "Dnes budeš chtít být doma. Hvězdy nebudou překvapené. Připraví ti místo v seznamu.",
    "Dnešní horoskop: příliv emocí ve dvě odpoledne, odliv ve čtyři. Mezitím polévka.",
    "Dnes ti dojde, že se za poslední tichý týden nikdo neomluvil. Hvězdy říkají, že oni taky ne.",
    "Dnes ti někdo řekne „můžeme si promluvit?“. Vezmeš si deku a ještě než dojde na rozhovor, vyslechneš si tři scénáře.",
    "Dneska si dáš třetí hrnek čaje. Jeden pro radost, jeden pro klid a jeden pro to, že někdo něco řekl.",
    "Dnes dostaneš pochvalu. Tři hodiny budeš zkoumat, jestli to nebyl sarkasmus. Pak ji uložíš do archivu.",
    "Dneska ti někdo zapomene poděkovat. Zítra to bude ještě čerstvé. Za rok už jen lehce nostalgické.",
    "Dnes zavoláš mamince, že je všechno v pořádku. Ona se zeptá, co se stalo. A bude mít pravdu.",
    "Dnes budeš mít pocit, že tě někdo ignoruje. Pak se ukáže, že jde o zpožděnou zprávu. Emoce už ale dorazila.",
    "Dneska tě rozpláče starý song z rádia. Spolujezdci se tváří, že se nic neděje. Je to láska.",
    "Dnes uvaříš víc, než potřebuješ. Hvězdy říkají, že je to správně: láska se počítá v porcích.",
    "Dnes ti Měsíc pošle fázi, kdy je všechno trochu dojemné. Zasáhne to i reklamu na čistič oken.",
    "Dneska se ti vybaví věta, kterou ti někdo řekl před třemi lety. Ta věta dnes slaví výročí. Dostane polévku.",
    "Dnes ti někdo nabídne pomoc. Odmítneš, protože „nic se neděje“. Čtyři hodiny pak budeš čekat, až se zeptá znovu.",
    "Dneska se v krabici vzpomínek objeví fotka, která ti zkazí odpoledne. Hvězdy na ni nemíří, jen tiše podávají kapesník.",
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

export default rak;
