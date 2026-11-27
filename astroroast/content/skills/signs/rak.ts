// AstroRoast.ai: knihovna humoru, znamení rak. Varianta "skills" (Sonnet 5.5 s psacími skilly).
//
// Tvar (RawSign, viz content/types.ts). Index 0 = úroveň 1 u všeho, co je Five<...>:
//   h  headlines: 3 na úroveň
//   c  core lines: 2 na úroveň
//   v  verdikty: 2 na úroveň
//   t  témata po úrovních: 4 věty na téma a úroveň (schodiště 1 pohlazení … 5 kosmická poprava)
//   s  falešné statistiky znamení: 6 kusů
//   d  denní jednovětky: 24 kusů
//   q  odpovědi v páru: 6 kusů
//
// Pravidla autora: 2. osoba jednotného čísla, žádné rodově označené tvary o čtenáři (-l/-la),
// střílíme jen do stereotypu znamení, úroveň 5 je absurdní a kosmická, nikdy krutá.

import type { RawSign } from "../../types";

const rak: RawSign = {
  h: [
    [
      "Rak: nikdo od jeho stolu neodejde hladový. Ani ten, kdo se tam nechtěl posadit.",
      "Rak pozná podle chůze, že máš špatný den. A už ti ohřívá polévku.",
      "Máš srdce jako sváteční stůl: uprostřed bábovka, kolem všichni, na kterých ti záleží.",
    ],
    [
      "Rak chodí bokem. K problémům, k lidem i k odpovědi na otázku „jak se máš“.",
      "Tvoje „nic se neděje“ se dá číst jako oznámení o evakuaci.",
      "Nálady ti chodí jako příliv, ale jízdní řád k nim nikdo nevydal.",
    ],
    [
      "Rak nezapomíná. Poznámka k jeho bábovce z roku 2018 je pořád ve spisu.",
      "Domov je jediné místo, kde se dá urazit v klidu a s přístupem k lednici.",
      "Tvoje pasivní agrese má pracovní dobu: od osmi do osmi, o víkendu s příplatkem.",
    ],
    [
      "Ráno urážka, v poledne rolety dolů, večer čtyřminutová hlasovka „v pohodě“. Typický Rak.",
      "Tvůj archiv křivd má index, rejstřík a odkazy na původní zdroje.",
      "Rak se stáhne do skořápky a vyvěsí cedulku: „Nic se neděje. Zeptej se potřetí.“",
    ],
    [
      "Měsíc podal stížnost: Rak mu kopíruje fáze a nechce uvést zdroj.",
      "Oceány čtou tvoje nálady a podle nich plánují příliv. Námořníci žádají předpověď.",
      "Vesmír vede tvoje křivdy v samostatné galaxii. Je zaplněná z 85 %.",
    ],
  ],
  c: [
    [
      "Z prázdného pokoje uděláš domov, když najdeš hrnek, deku a někoho, komu můžeš ohřát polévku.",
      "Tvoje „bereš si bundu?“ znamená „mám o tebe strach“. A „dáš si ještě?“ znamená „miluju tě“.",
    ],
    [
      "Pamatuješ si, kdo má rád ořechy v bábovce, kdo je nesnáší a kdo se u nich před šesti lety ošklivě tvářil.",
      "Citlivost máš jako superschopnost. Jen nejde vypnout a občas se spustí u reklamy na jogurt.",
    ],
    [
      "Nálada se ti mění rychleji než počasí na horách. A bez výstrahy.",
      "Slovo „fajn“ je u tebe jen nadpis. Pod ním běží tři odstavce, které si přečtou jen ti nejbližší. Pokud je uhádnou.",
    ],
    [
      "Tvoje paměť na drobné křivdy má lepší zálohu než státní archiv. A rychlejší vyhledávání.",
      "Urážet se umíš ve čtyřech jazycích: tichem, povzdechem, pohledem a hlasitým mytím jedné lžíce.",
    ],
    [
      "Tvoje paměť na křivdy má vlastní oběžnou dráhu. Astronomové ji pozorují od roku 1998 a pořád jim to nesedí.",
      "Měsíc sladil svoje fáze s tvou náladou. Příliv teď přichází, když se urazíš, a odliv, když ti zavoní polévka.",
    ],
  ],
  v: [
    [
      "Verdikt: tam, kde jsi ty, je teplo. Jen občas přibal deštník pro ty, co zrovna potřebují slunce.",
      "Hvězdy radí: dovol dnes někomu uvařit tobě. Bude to trapné, ale bábovka to přežije.",
    ],
    [
      "Rada hvězd: řekni nahlas, co se děje. Nestačí-li věta, přidej druhou. Třetí si nech do hlasovky.",
      "Verdikt: citlivost je tvoje přednost. Na poradě ji ale nech v tašce vedle bábovky.",
    ],
    [
      "Verdikt: s tebou se nikdo nenudí. Jen nikdo neví, jestli má přinést kytku, nebo polévku.",
      "Rada: sepiš dva seznamy. Co tě urazilo a co tě potěšilo. Ten druhý dnes přečti nahlas.",
    ],
    [
      "Verdikt: jsi spíš archiv než člověk. Zkus občas něco skartovat. Třeba tu poznámku z roku 2018.",
      "Rada hvězd: až se příště urazíš, napiš to na papír a nech ho do rána. Papír aspoň nepíše zpátky.",
    ],
    [
      "Verdikt vesmíru: pocity přijaty, zaprotokolovány, uloženy. Vyřízeno: nikdy, ale s láskou.",
      "Rozsudek: týden na pláži bez Měsíce. Příliv ti stejně pošle pohlednici s dotazem, co se děje.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce jsi domov: kdo k tobě přijde, dostane deku, talíř a pocit, že se nemusí nikam vracet.",
        "Pamatuješ si, co partner řekl před třemi lety u rybníka. Ne proto, že počítáš body, ale protože ti na každé větě záleželo.",
        "Tvoje romantika voní polévkou a svítí svíčkou z Lidlu. Je tichá, hřeje a dojímá se u reklamy na pojištění.",
        "Partnerovi stačí vzdychnout u dveří a za deset minut má čaj, deku a ztlumenou televizi. Hotel s pěti hvězdami to nezvládne.",
      ],
      [ // úroveň 2
        "Ve vztahu vedeš tajný archiv: kdo co řekl, kdy a jakým tónem. Partner o něm tuší, ale ještě nikdy nesáhl na kliku.",
        "Když partner neodepíše do hodiny, tvoje fantazie vydá tři verze. První je zdržení, druhá drama, třetí má i hudbu.",
        "Rande plánuješ jako rodinnou oslavu: jídlo, vzpomínky a kapesníky pro oba. Partner si pro jistotu nosí vlastní.",
        "Do vztahu nastěhuješ domov i svůj polštář. Partner brzy zjistí, že polštář není předmět, ale člen domácnosti s hlasem.",
      ],
      [ // úroveň 3
        "Tvoje „nic se neděje“ ve vztahu znamená, že se děje všechno. Partner má na rozluštění tři hodiny, pak začne tichý režim.",
        "Hádku ukončíš odchodem do kuchyně. Za hodinu partner zjistí, že omluva je upečená a že nemá právo ji odmítnout.",
        "Vyznání lásky zahrnuje u tebe polévku, objetí a nenápadný přehled toho, kdo naposledy zapomněl na výročí. Skóre se drží přesně.",
        "Říkáš, že vztah stojí na upřímnosti. Pak řekneš „nic mi není“ a čekáš, že to partner vyčte z toho, jak zavíráš dveře od skříně.",
      ],
      [ // úroveň 4
        "Tvoje urážka má tři fáze: ticho, hlasité nádobí a omluvu, kterou pokračuješ jinými prostředky.",
        "Partner se zeptá, co se děje. Řekneš „nic“ a on má dvanáct vteřin na rozluštění. Pak následuje týden ticha s krabičkou oběda.",
        "Pamatuješ si všechny hádky za posledních pět let včetně počasí a toho, kdo měl jakou mikinu. Policejní spis by se styděl.",
        "Tvoje žárlivost má kamufláž: „Já se jen ptám, co tě tak zdrželo. Večeře je studená, ale to je v pořádku.“",
      ],
      [ // úroveň 5
        "Při tvých hádkách vzniká příliv, který zaznamenává i Tichý oceán. Oceánografové žádají předběžné ohlášení termínů.",
        "Když se urazíš, Neptun si dělá poznámky a černá díra přestane nasávat, aby nic nepřeslechla.",
        "Tvoje láska je široká jako Mléčná dráha. Stačí zapomenuté výročí a stáhne se do skořápky velikosti vlašského ořechu.",
        "Partner, který na „nic se neděje“ správně odpoví „vím, že ano“, dostane od vesmíru ocenění. Uděluje se jednou za dvě stě let.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci jsi srdce týmu: pamatuješ narozeniny, nosíš buchty a kolegové vědí, že u tvého stolu se dá aspoň chvíli nadechnout.",
        "Kancelář zútulníš jedinou rostlinou a hrnkem s nápisem. Pondělí se pak aspoň trochu stydí.",
        "Zákazníky vedeš s citem. Poznají, že jim opravdu chceš pomoct, a proto jim to trvá o pět minut déle. Nikomu to nevadí.",
        "Při krizi se u tvého stolu objeví čaj, plán a dobrý nápad jako první. V tomhle pořadí.",
      ],
      [ // úroveň 2
        "V práci se staráš o všechny. Tvůj vlastní úkol leží pod hromadou cizích dobrých skutků.",
        "Pracovní e-mail ti zabere dvě hodiny: hodinu psaní a hodinu přemýšlení, jestli to nikoho nezraní. Většinou nezraní. Odešleš ho stejně až zítra.",
        "Na poradě vážíš každé slovo. Kolegové pak do oběda řeší, jestli „v pořádku“ znamená v pořádku.",
        "Kolegu, který zapomene poděkovat, nenavštěvuješ. Jen ho nenápadně sleduješ na chodbě. On to ví, ty víš, že on ví.",
      ],
      [ // úroveň 3
        "Tvoje „v pořádku, nech to tak“ v práci znamená, že to v pořádku není a že budeš tři týdny připomínat. Mlčky. S výrazem.",
        "Z tónu e-mailu čteš myšlenky. Většinou se trefíš. Když ne, zapíšeš si to jako důkaz pro příště.",
        "Pochvala od šéfa je pro tebe kyslík. Kritika je skvrna na košili: ostatní si jí nevšimnou, tobě zůstane celý týden před očima.",
        "Rozhodovat umíš skvěle, když se nikdo nedívá. Jakmile se podívají, začneš řešit, kdo se na koho jak tváří.",
      ],
      [ // úroveň 4
        "Na poradě sedíš klidně. Uvnitř běží tři seriály a dokument o tom, jak tě kolega minulý týden přerušil.",
        "V šuplíku máš dvanáct čajů, tři deky a seznam kolegů, kteří ti dluží omluvu. Poslední sloupec je nejobsáhlejší.",
        "Když ti šéf řekne „máš chvilku?“, tvoje fantazie zaznamená zemětřesení o síle sedm s dozvuky do pátku.",
        "Kolegové poznají tvoje pocity podle toho, jak klapne víčko od hrnku. Jedno klapnutí je pohoda, dvě porada, tři evakuace.",
      ],
      [ // úroveň 5
        "NASA zavedla kalendář s fázemi tvé nálady. Kolegové si do něj píšou, kdy se s tebou dá mluvit. Většinou je to středa v 10:40.",
        "Když se ti v práci něco nelíbí, černá díra zadrží dech. Pak z kuchyňky zazní lžička v hrnku a všichni vědí.",
        "Tvoje „já žádný problém nemám“ letí kanceláří rychlostí světla a kolega ho zachytí až příští týden. Vesmír mu doporučuje sluchátka.",
        "Zapomenuté poděkování ví do pěti hodin Mars, Saturn a pár vzdálených mlhovin. Do pondělí je z toho téma na jeden galaktický rok.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Život umíš zabalit do tepla: deka, polévka a pár lidí, kteří vědí, že jsi doma. Víc nepotřebuješ a většinu už máš.",
        "Z jakéhokoli místa uděláš domov. Vlak, čekárna i hotelový pokoj se po tvém příchodu změní na obývák.",
        "Vzpomínky držíš jako fotky v rámečku: ostře, s popiskem a s nápisem, kdo je u toho. Hvězdy v nich rády listují.",
        "Když se někdo trápí, objeví se ti v ruce hrnek čaje. Nevíš odkud. Prostě talent.",
      ],
      [ // úroveň 2
        "Nálady ti chodí jako počasí: ráno slunce, v poledne mraky, večer polévka. Hvězdy to zapisují do kalendáře svátků.",
        "Doma máš věci tak, že kdyby někdo přesunul vázu o dva centimetry, srdce to pozná do tří vteřin. Rodinný alarm.",
        "Pamatuješ si, co kdo jedl na Vánoce před sedmi lety. U dárků skvělé, u hádek riskantní.",
        "Víkend trávíš doma. Přijdou tři pozvánky a ty je odmítneš tak jemně, že se pozvaní omlouvají.",
      ],
      [ // úroveň 3
        "Říkáš, že nostalgie tě nezajímá. Jen ti potají vonějí věci z roku 2009. Třeba i ta špatná zimní bunda.",
        "Tvoje „nic mi není“ se ráno mění v „jen chci domů“ a večer v „tohle si budu pamatovat“.",
        "Rozhodování o večeři je pro tebe emoční událost. Ve skutečnosti volíš mezi polévkou z dětství a polévkou z dětství s trochou petrželky.",
        "Vzpomínky třídíš do krabic podle nálady. Když se jedna omylem otevře, celý den se do ní vejde.",
      ],
      [ // úroveň 4
        "Tvůj domov je pevnost s vlastním počasím: dvě deky, tři polštáře a atmosféra, ve které se host po pěti minutách rozpláče. Dojetím.",
        "Když tě něco zraní, zatáhneš se do skořápky a odtamtud posíláš hlasovky „nic se neděje“. Každá trvá minutu a půl.",
        "Reklama na rodinné jogurty tě rozpláče, ztracená ponožka rozzuří a vzpomínka na prázdniny z roku 1998 položí na celé odpoledne.",
        "Tvoje emoční tempo je horská dráha: nahoru, dolů, smyčka a zastavení u polévky. Cestující mají pásy a v ruce kapesníky.",
      ],
      [ // úroveň 5
        "Měsíc tě jmenoval pozemským zástupcem. Přílivy se řídí tebou a pláže pro tvoje dojetí vyhlašují stav pohotovosti.",
        "Kolem tvých emocí obíhají dva měsíčky: Nostalgie a Polévka. NASA je nemůže vyfotit, pořád se hýbou.",
        "Polévka ze všech tvých pocitů by nasytila celou Mléčnou dráhu. A na druhý den by zbylo.",
        "Při tvém dojetí hlásí seismografy na Marsu poplach. Mars odpovídá: „Děkujeme za upozornění. Posíláme deku.“",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "U tebe nikdo neodchází hladový ani smutný. Přátelé o tobě říkají, že jsi domov, který se dá vzít s sebou.",
        "Pamatuješ si, kdo má co rád, kdy má narozeniny a jakou barvu mělo poslední přání. Přátelé tě mají jako lásku s paměťovou kartou.",
        "Trápí-li se kamarád, přijdeš s polévkou dřív, než stihne zavolat. Nikdo neví, jak to děláš. Je to dar.",
        "S tebou se dá mluvit o všem. Přátelé vědí, že tvoje uši jsou otevřené a tvoje polévka o jednu porci větší.",
      ],
      [ // úroveň 2
        "Přátelé u tebe vědí, že co řeknou, to zmizí v archivu. A občas se z něj citlivě vytáhne.",
        "Zprávy přátelům čteš třikrát, než je odešleš. A pak ještě dvakrát, aby neznělo jinak než v hlavě.",
        "Když přátelé zapomenou na narozeniny, tvoje „nevadí“ zní jako omluva i jako pozvánka na dlouhý rozhovor.",
        "Na skupinový výlet bereš tašku s jídlem, náplasti a pocit, že tohle je tvoje malá archa. Ostatním stačí tričko.",
      ],
      [ // úroveň 3
        "Tvoje „vůbec se nezlobím“ přátelům nic neříká. Mají od tebe týdenní program: ticho, ticho a věta, která sedne přesně.",
        "Přátelé oceňují, že pro ně máš čas. Čas máš. Jen k němu občas dostanou tichý seznam toho, co mu předcházelo.",
        "Pamatuješ si, kdo komu kdy nenapsal. Když se ten dotyčný ozve, přivítáš ho vřele, s úsměvem a poznámkou o roce 2019.",
        "Řekneš, že se nic nestalo. Přátelé už vědí, že se stalo, a že na rozbor bude čas nejdřív ve čtvrtek.",
      ],
      [ // úroveň 4
        "Přátelé mají na tebe mapu nálad: zelená znamená „můžeš se zeptat“, žlutá „opatrně“, červená „pošli jen srdíčko“. Aktualizuje se každé tři hodiny.",
        "Výlet s tebou má pevný program: dojetí, urážka, usmíření, polévka. Pořadí se může změnit, polévka je jistota.",
        "Když tě někdo z přátel zapomene pozvat, archiv zapne záznam. Přesný popis události se dozví o Silvestru.",
        "Přátelům posíláš dlouhé zprávy plné pocitů. Odpověď přijde jako palec nahoru a ty na něj hledíš dvě hodiny jako na vzkaz z cizího jazyka.",
      ],
      [ // úroveň 5
        "Přátelé tě vedou pod krycím jménem „Měsíc“. Změny nálady se dají předpovědět podle fází a pořád se mýlí.",
        "Tvoje parta má krizový štáb pro případ, že se urazíš: dva lidé, tři dorty a oficiální stanovisko vesmíru.",
        "Kdyby paměť přátel fungovala jako tvoje, v archivu by vznikla nová galaxie. Naštěstí ji spravuješ ty. S poznámkami.",
        "Když se rozhodneš odpustit, vesmír vysílá hlášení: „Rak dnes odpouští. Ostatní planety, zachovejte klid.“",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš jako malý rodinný svátek: dort, objímání a pár slz. Hosté odcházejí s pocitem, že byli doma.",
        "Všechna přání si pamatuješ: kdo napsal, kdo zavolal a kdo poslal nejkrásnější kartičku. A víš i jakou barvou.",
        "Dort ti peče někdo, komu na tobě záleží. To je nejlepší recept: máslo, trpělivost a třetí vrstva pozornosti.",
        "Narozeniny jsou den, kdy se můžeš dojímat nahlas a nikdo se nesměje. A když ano, tak s láskou.",
      ],
      [ // úroveň 2
        "K narozeninám dostaneš tolik zpráv, že si je přečteš třikrát a večer ještě jednou. Hvězdy tomu říkají sentimentální oběh.",
        "Tvoje oslava je jako domov: hřejivá, trochu hlučná a s rohem, kam se schováš, když tě dojmou přání.",
        "Dárek rozbaluješ pomalu. Zkoumáš papír, stuhu i lístek. Hosté mezitím nosí židle.",
        "Svíčky sfoukneš s malou slzou. Přání zůstává tajné, ale hvězdy tipují, že obsahuje slovo „polévka“.",
      ],
      [ // úroveň 3
        "Tvrdíš, že narozeniny nic neznamenají. Zarámované album z posledních dvaceti oslav tvrdí opak.",
        "Říkáš, že nechceš žádný dárek. Pak se podíváš, kdo co přinesl, a tvoje mlčení řekne víc než deset vět.",
        "Když na tvoje narozeniny zapomene někdo blízký, řekneš „vůbec to nevadí“. Pak ho založíš do archivu a příští rok vytáhneš.",
        "Dort je pro tebe důkaz lásky. Kdo ho přinese, má bod. Kdo zapomene, dostane tichou omluvu a polévku o stupeň slabší.",
      ],
      [ // úroveň 4
        "Tvoje oslava má scénář: hosté dorazí, rozpláčeš se, obejmeš každého a večer rozešleš dvanáct děkovných hlasovek. Každá delší než párty.",
        "Seznam lidí, kteří ti nepopřáli, vzniká dřív než seznam těch, kdo popřáli. A je přesnější.",
        "Narozeniny trvají od rána do rána. V půl dvanácté zazní „ještě nemám dárek“ a pak už se jen jí, pláče a vzpomíná.",
        "Dárky hodnotíš podle množství vzpomínek, které v nich jsou. Ponožky mají nízké skóre, i když jsou měkké.",
      ],
      [ // úroveň 5
        "Měsíc ti každý rok pošle nejmenší možné přání: „Všechno nejlepší. Prosím, nesmutni.“ Rakova odpověď má 482 stran a je laskavá.",
        "Při tvých narozeninách zaznamenaly oceány prudký příliv: tři sta litrů slz, patnáct odstavců vzpomínek a jedna bábovka.",
        "Tvůj dort je tak sentimentální, že ho NASA hlídá z oběžné dráhy. Nikdo ho nechce poškodit. Ani souhvězdí.",
        "Každý rok slavíš stejně: polévka, rodina a album. Vesmír už pro příští rok připravuje vlastní recept a tajně ho zkouší.",
      ],
    ],
  },
  s: [
    ["Archivovaných pocitů", "1 847"],
    ["Hlasovek „nic se neděje“ měsíčně", "23"],
    ["Hrnků čaje na uklidnění", "5"],
    ["Rodinných receptů zpaměti", "63"],
    ["Pravdivost věty „nic se neděje“", "0,4 %"],
    ["Slz u reklamy týdně", "2"],
  ],
  d: [
    "Dnes tě rozpláče reklama na jogurt. Hvězdy to schvalují. Jogurt o tom neví.",
    "Dnes ti Měsíc oznámí, že máš náladu. Jakou, to se dozvíš zpětně.",
    "Dnes si vzpomeneš na větu z roku 2021. Bude z toho téma na tři dny a jedna polévka.",
    "Dnešní konstelace: polévka v zenitu, pohodlí na západě, urážka na obzoru.",
    "Dnes se tě někdo zeptá „jak se máš?“. Máš dvanáct odpovědí a ani jedna není „dobře“.",
    "Dnes ti dojde, že ti něco chybí. Je to hrnek čaje. Vždycky je to hrnek čaje.",
    "Dnes budeš mít pocit, že tě nikdo nechápe. Hvězdy chápou. Jen se k tomu nehlásí.",
    "Dnešní tip: nesmutni ze všeho najednou. Rozlož to na tři dny a v pátek to sloučíš.",
    "Dnes ti někdo odmítne druhý kus bábovky. Hvězdy doporučují nebrat to jako zradu. Poprvé.",
    "Dnes budeš chtít zůstat doma. Hvězdy nebudou překvapené, jen přidají poznámku do spisu.",
    "Dnešní předpověď: příliv emocí ve dvě odpoledne, odliv ve čtyři. Mezitím polévka.",
    "Dnes si všimneš, že se ti za týden ticha nikdo neomluvil. Hvězdy říkají, že jim taky ne.",
    "Dnes ti někdo napíše „můžeme si promluvit?“. Než odpovíš, vyslechneš v hlavě tři scénáře a dva rozsudky.",
    "Dnes vypiješ třetí hrnek čaje. První na radost, druhý na klid, třetí kvůli větě, kterou někdo řekl v úterý.",
    "Dnes dostaneš pochvalu. Tři hodiny budeš zkoumat, jestli to nebyl sarkasmus. Pak ji založíš.",
    "Dnes ti někdo zapomene poděkovat. Zítra to bude čerstvé. Za rok už jen lehce nostalgické.",
    "Dnes zavoláš mamce, že je všechno v pořádku. Zeptá se, co se stalo. A bude mít pravdu.",
    "Dnes budeš mít pocit, že tě někdo ignoruje. Pak dorazí zpožděná zpráva. Pocit už ale zapustil kořeny.",
    "Dnes tě v autě rozpláče písnička z rádia. Spolujezdci předstírají, že se dívají z okna. To je láska.",
    "Dnes uvaříš víc, než potřebuješ. Hvězdy říkají, že je to správně: láska se počítá v porcích.",
    "Dnes bude Měsíc ve fázi, kdy je všechno trochu dojemné. Zasáhne to i reklamu na čistič oken.",
    "Dnes ti někdo nabídne pomoc. Odmítneš, protože „nic se neděje“. Pak čtyři hodiny čekáš, až se zeptá znovu.",
    "Dnes najdeš v krabici fotku, která ti zkazí odpoledne. Hvězdy na ni nemíří, jen tiše podávají kapesník.",
    "Dnes ti zavolá babička, aby zjistila, jestli máš v lednici něco k jídlu. Ví, že nemáš. Ví to i lednice.",
  ],
  q: [
    "Pojď domů. Uvařím něco, co chutná jako dětství. Dětství si vyber.",
    "Víkend: doma, deka, dobré jídlo a nikdo, kdo by mi do toho mluvil. Teda ty můžeš. Ale potichu.",
    "Odpověď pošlu. Přečtu ji ještě třikrát a zavolám mamce, jestli nezní nějak.",
    "Umyju to. Jen mi řekni, jestli to myslíš zle. Když ano, zapamatuju si to. Do příštího léta.",
    "Tam, kde jsme byli před čtyřmi lety. Měli výbornou polévku a obsluha nikoho neurážela.",
    "Něco hřejivého. Něco, u čeho se nemusím bát. Nejlíp s kočkou v hlavní roli. A s krabičkou kapesníků v záloze.",
  ],
};

export default rak;
