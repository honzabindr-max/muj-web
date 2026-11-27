// AstroRoast.ai: knihovna humoru, znamení panna. Ručně psané originální české fragmenty.
//
// Tvar (RawSign, viz content/types.ts). Index 0 = úroveň 1 u všeho, co je Five<...>:
//   h  Five<string[]>   headlines: 3 na úroveň
//   c  Five<string[]>   core lines (výchozí věta o znamení): 2 na úroveň
//   v  Five<string[]>   verdikty: 2 na úroveň
//   t  Record<Topic, Five<string[]>>
//                       témata PO ÚROVNÍCH: pro každé téma (vztahy, prace, zivot, pratele, narozeniny)
//                       pět polí vět (index 0 = úroveň 1), přesně 4 věty v každém (100 vět na znamení).
//                       Engine vybere 2 z t[téma][úroveň-1].
//   s  [label, value][] falešné statistiky znamení: 6 kusů
//   d  string[]         denní jednovětky: 24 kusů (+ headlines úrovní 2-3 = pool >= 30)
//   q  string[]         odpovědi v páru, pořadí viz COUPLE_SITUATIONS v shared.ts: 6 kusů
//
// Žebřík úrovní (platí pro h, c, v i každou větu v t):
//   1 Pohlazení       vřelý lichotivý kompliment s drobným mrknutím na konci, bez žihadla
//   2 Šťouchnutí      přátelské popichování, každodenní pozorování s lehkým zvratem
//   3 Sarkasmus       suchá ironie, kompliment se ukáže jako kritika, jasná pointa
//   4 Roast           přímý popel na stereotyp, přehánění, ostrá srovnání, konkrétní směšné situace
//   5 Kosmická poprava absurdní kosmická eskalace (planety, černé díry, NASA, galaxie, mezihvězdná byrokracie)
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

const panna: RawSign = {
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
      "Umíš věci dotahovat do konce. Tvoje spolehlivost je vzácná jako mapa, která přesně odpovídá terénu.",
      "Máš cit pro detail. Díky tomu se kolem tebe všechno lepí na místo.",
    ],
    [
      "Když něco spravíš, hned chceš vědět, co se dá zlepšit. Nepřestaneš, dokud ti to neřeknou.",
      "Když věci nesedí, mírně ti cuká oko. Když sedí, cuká ti druhé. Nikdo ti neřekne, že to je radost.",
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
      "Verdikt: spolehlivost jako švýcarské hodinky. Jen občas s lehkým tikáním navíc.",
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
      [ // úroveň 1
        "Ve vztahu si pamatuješ všechno důležité: oblíbený čaj, velikost bot i den, kdy jste se poprvé zasmáli. Je to dojemné.",
        "Pozornost k detailům je tvoje řeč lásky: partner nikdy nezmokne, protože v kabátu najde deštník.",
        "Staráš se o druhé tak jemně, že si toho všimnou, až když jim něco chybí. A ty hned víš, co to je.",
        "Tvoje romantika se pozná podle toho, že snídaně je teplá, ubrus rovný a svíčka hoří přesně uprostřed.",
      ],
      [ // úroveň 2
        "Překvapení pro partnera plánuješ tak důkladně, že má časový plán, přílohy a záložní variantu pro déšť.",
        "Partnerovi občas při hádce opravíš větu. Z lásky, aby ji příště řekl stylisticky čistě.",
        "Při společném balení kufru tě partner sleduje s obdivem. Sám by zabalil dva svetry a hotovo.",
        "Společné bydlení s tebou má jedno pravidlo: hrnky stojí uchem doprava. Je to milé, než se to naučí.",
      ],
      [ // úroveň 3
        "Říkáš „nic se neděje“ a pak partnerovi přehraješ jeho minulý čtvrtek ve třech bodech s přílohami.",
        "Rande plánuješ jako audit. Partner dostane rozpis, trasu a otázku, jestli má nějaké připomínky.",
        "Tvoje „jen ti říkám, ať víš“ znamená totéž co revize dokumentu: sedm bodů k opravě a jedno poděkování.",
        "Partnerovu lásku poznáš podle toho, jak složí ručníky. Když špatně, zůstáváš v klidu a mlčíš. Ručník to ví.",
      ],
      [ // úroveň 4
        "Na rande přijdeš o osm minut dřív, protože stůl, osvětlení a vzdálenost židlí vyžadují kontrolu. Partner přijde na zkoušku.",
        "Partnerovi nevytýkáš chyby. Vedeš o nich jen čistý, přehledný a průběžně aktualizovaný soubor.",
        "Hádka s tebou probíhá takto: bod 1, bod 2, bod 3, příloha. V příloze je screenshot z roku 2022.",
        "Vyznání lásky máš promyšlené: tři verze, jedna záložní a jedna pro případ, že se partner zeptá na zdůvodnění.",
      ],
      [ // úroveň 5
        "Merkur a Venuše se pokusily o rande. Panna jim doručila kritiku na třech stranách A4. Rozešly se kvůli fontu.",
        "NASA žádá o radu, jak uspořádat vztahy mezi planetami. Odpověď Panny má 47 stran a opravuje názvy planet.",
        "Kupidův šíp byl vrácen k přepracování. Důvod: neodpovídá specifikaci a nemá schválenou záruční lhůtu.",
        "Vesmírná manželská poradna tě odmítla. Prý u tebe nebylo co řešit, jen opravovat zápisy z minulých sezení.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci jsi ta, na kterou se spoléhají. Co řekneš, platí. Co uděláš, je hotové a ještě pěkně popsané.",
        "Máš nadání pro systém: tvoje složky si rozumí a úkoly vědí, kdy se mají splnit.",
        "Kolegové za tebou chodí s chaosem a odcházejí s plánem. Je to dar, který se nedá zaplatit. Dá se jen pochválit.",
        "Tvoje e-maily jsou jasné, stručné a bez překlepů. Čtenář po nich ví, co má dělat, a trochu se stydí za ty své.",
      ],
      [ // úroveň 2
        "Na poradě máš sepsané body ještě před příchodem prvního kolegy. Pořadí je pro tebe svaté, odbočky jsou hosté bez rezervace.",
        "Klávesové zkratky ovládáš tak rychle, že kolegové mají pocit, že počítač pracuje sám a ty se jen díváš.",
        "Barevné štítky na složkách mají svůj klíč. Kolegové se k němu snaží dostat, ale zatím se zastavili u modré.",
        "U kávy se tě kolegové ptají na pomoc s dokumentem. Ty už stejně pomáháš, jen se ptáš, jestli to opravdu musí být takhle.",
      ],
      [ // úroveň 3
        "Při kontrole dokumentu hledáš chybu jako detektiv. A když ji nenajdeš, hledáš chybu v detektivovi.",
        "Říkáš „jen jedna drobnost“ u dokumentu, který díky tomu projde třetím kolem revizí.",
        "Termín splníš s předstihem. Pak odevzdáš o den později, protože se našla tečka navíc.",
        "Delegovat umíš. Hlavně úkoly, které pak za ostatní předěláš, aby byly správně.",
      ],
      [ // úroveň 4
        "Tvoje oblíbená pochvala je „tohle je skoro v pořádku“. V týmu to platí za Nobelovu cenu.",
        "V týmu jsi jako kontrolní seznam s pulsem: když ho nikdo nepotřebuje, hlásí se sám.",
        "Tvoje „ještě to musím doladit“ pozná celá kancelář podle toho, jak všem klesnou ramena.",
        "Když ti někdo pošle dokument v nevhodném fontu, neřekneš nic. Jen se ti zvedne obočí a uloží se do paměti.",
      ],
      [ // úroveň 5
        "Saturn žádal o prodloužení termínu. Panna ho zamítla s poznámkou: „Prstence nejsou zarovnané.“",
        "Porada vesmíru začala včas. Skončila, až Panna opravila zápis z minulé schůzky, z předminulé a z té před ní.",
        "Vesmír byl při stvoření vrácen k přepracování. Zásadní připomínky: mlhoviny, hustota hvězd a chybějící legenda.",
        "Panna prošla Mléčnou dráhu s červenou pastelkou. NASA žádala o kopii. Vráceno s poznámkou, že 80 % je „nejasné“.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Tvůj život je jako dobře vyžehlená košile: čistý, svěží a ostatním se vedle něj chce taky srovnat ramena.",
        "Máš dar vnést klid do chaosu. Stačí se objevit v místnosti a pár věcí se samo srovná.",
        "Dny začínáš plánem a končíš odškrtnutým seznamem. Je to uspokojivé sledovat, i zvenčí.",
        "Zbytečný nepořádek ti vadí, ale umíš ho unést, když je jen na chvíli. Aspoň do chvíle, než se otočíš.",
      ],
      [ // úroveň 2
        "Kávu pijete u tebe ve dvanáct, ve tři a v pět. Odchylky jsou považovány za mimořádnou událost.",
        "Na dovolenou si bereš seznam, který má vlastní kontrolní seznam. Ten druhý hlídá, jestli ten první není zapomenutý doma.",
        "Lednička je u tebe uspořádaná podle logiky, kterou zná jen ona a ty. Návštěva si bere vodu, a to je správně.",
        "Zásuvka na příbory je dokonalá. Když ji někdo otevře, zmlkne a mimoděk narovná záda.",
      ],
      [ // úroveň 3
        "Spontánnost máš naplánovanou na čtvrtek od 18:00. Pokud se nedostaví, přeplánuješ ji na pátek.",
        "Říkáš, že pořádkem posedlé nejsi. Pak v hostech vzbudíš pocit, že mají špinavé boty, i když jsou zouvané.",
        "Odpočinek máš v kalendáři a hlídá ho budík. Když zazvoní, jdeš odpočívat. Rychle, než se něco pokazí.",
        "Sebereflexe ti jde skvěle: chybu najdeš i u sebe. Jen ji pak chceš opravit hned a nahlas.",
      ],
      [ // úroveň 4
        "Tvůj život má víc seznamů než zážitků. Seznam zážitků je ovšem skvěle uspořádaný.",
        "Když ti někdo řekne „uvolni se“, vyrobíš plán uvolnění. S časem, cílem a mírou nedokonalosti.",
        "Tvoje představa o dobrodružství: koupit lepší pořadač. Stylové, odvážné, a navíc se vejde do batohu.",
        "Nad nevyžehleným rohem ubrusu strávíš víc času než nad celým víkendem na horách. Ubrus vyhrává.",
      ],
      [ // úroveň 5
        "Vesmír začal chaosem. Panna zakázala jeho rozpínání, dokud nedoloží, že jsou označené zóny.",
        "Černá díra vyhodila do prostoru svůj nepořádek. Panna ho vytřídila do tří barev a poslala zpět s fakturou.",
        "Kvůli tobě zavedli v Mléčné dráze povinné zarovnání hvězd. Orionův pás odmítl a přesunul se do vedlejší soustavy.",
        "Slunce svítí v rozporu s plánem. Panna mu poslala e-mail s upozorněním na chybějící odrážku a tři tečky navíc.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přátelům jsi oporou: pamatuješ narozeniny, oblíbené jídlo i to, kdo je na co alergický. Chodící poznámkový blok s láskou.",
        "Když kamarád potřebuje poradit, máš po ruce strukturu: tři možnosti, výhody, nevýhody. A kávu.",
        "Parta s tebou nikdy nezabloudí. Máš mapu, náhradní trasu a záložní nabíječku pro všechny.",
        "Přátelé se na tebe mohou spolehnout, i když ti občas řeknou „já to zvládnu“. Ty víš, že zvládneš to i s nimi.",
      ],
      [ // úroveň 2
        "Ve skupinovém chatu opravíš překlep. Pak se omluvíš. Pak opravíš omluvu.",
        "Při výletě se ujmeš organizace. Ostatní to oceňují, dokud nezjistí, že mají k obědu přidělenou hodinu.",
        "Když se parta rozhoduje, kam jít, máš už tři varianty s hodnocením. Zbytek skupiny chce hlavně sednout.",
        "Do kalendáře přátel si píšeš připomínky. Z lásky. Jen jim ještě nikdo neřekl, že kalendář je sdílený.",
      ],
      [ // úroveň 3
        "Kamarádům říkáš pravdu vždycky. Hlavně o jejich plánech, životopisech, fontech a skladbě batohu.",
        "Při pomoci s přestěhováním se ujmeš krabic. Pak etiket. Pak rozdělení pokojů. Stěhováci jdou domů.",
        "Tvoje „jen dobře míním“ je velké razítko. Pod ním se vejde cokoli, od poznámky o ponožkách po kritiku kariéry.",
        "Pozvánku na oslavu potvrdíš ihned. Pak se zeptáš na dress code, parkování, program a seznam hostů.",
      ],
      [ // úroveň 4
        "Kamarádi ti říkají „Wikipedie“, protože vždycky víš. A protože nemáš tlačítko „přeskočit“.",
        "Na srazu přátel jsi jako revizor: nic neřekneš, ale všichni se najednou narovnají a sundají lokty ze stolu.",
        "Kamarád ti ukáže novou věc, kterou si koupil. Ty najdeš pět vad dřív, než stihne říct, jak ho to těší.",
        "Když se přátelé hádají o místě, rozhoduješ ty. Ne proto, že chceš. Ale proto, že máš dokument a oni už nemají sílu.",
      ],
      [ // úroveň 5
        "Kamarádi ti poslali pozvánku na večeři. Přišlo ti 14 verzí. Večeře se kvůli opravám pozvánky odložila o rok.",
        "Při kosmickém pikniku se Orion zeptal, kde sedět. Odpověď: podle schématu, které čeká na schválení do příštího roku.",
        "Přátelé tě pozvou do Andromedy. Galaxie je předem upozorněna na pořadí příborů a pro jistotu se uklidí.",
        "Skupinový chat Mléčné dráhy má čtyři miliardy členů. Panna opravuje překlepy od prvního dne. Zbývá jí pár světelných let.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny plánuješ s láskou: dort bez chyb, hosté usazení, dárky podle seznamu přání. Radost mají všichni.",
        "Na narozeniny kamarádů myslíš s předstihem. Připomínka v kalendáři, nápad na dárek a záložní nápad pro jistotu.",
        "Dárek od tebe je vždycky praktický, hezky zabalený a opatřený lístečkem, na kterém je napsáno, jak ho používat.",
        "Oslava u tebe má program, který zná každý host. Je to bezpečné, příjemné a všichni se přitom skvěle baví.",
      ],
      [ // úroveň 2
        "Narozeninový dort kontroluješ jako inspektor: rovnoměrné řezy, stejně velké kousky, žádná křivá svíčka.",
        "Pozvánky na oslavu rozešleš měsíc předem. Včetně času příchodu, času odchodu a odkazu na mapu.",
        "Při balení dárku srovnáváš papír na milimetr. Příjemce rozbaluje opatrně, jako by otevíral pamětní předmět.",
        "Svíčky na dortu zapaluješ v pořadí. Fotky půjdou do složky podle data, jmen a nálady hostů.",
      ],
      [ // úroveň 3
        "V přání, které dostaneš, najdeš nejdřív překlep. Až potom dojetí. Dojetí je skoro vždycky druhé.",
        "Říkáš, že oslavu nepotřebuješ. Pak víš, kdo přijde, co sní a kde bude sedět.",
        "Dárek, který ti není po chuti, přijmeš s úsměvem a uložíš do složky „příležitosti“. Ta složka už má pět let.",
        "Na narozeninové překvapení reaguješ tak, že se zeptáš, kdo to plánoval, a nabídneš zpětnou vazbu.",
      ],
      [ // úroveň 4
        "Oslava u tebe má scénář, plán B a záložní plán B. Překvapení je skvěle připraveno. Hosté jsou skvěle připraveni na překvapení.",
        "Dárek opatříš štítkem s datem, jménem a hmotností. Příjemce zjistí, že dostal dar s číslem šarže.",
        "Svíčku sfoukneš až po kontrole, zda je rozmístění na dortu rovnoměrné. Hosté mezitím čekají s telefony.",
        "Narozeninové přání píšeš čtyřikrát a pak pošleš to první. Ale s opravenou čárkou.",
      ],
      [ // úroveň 5
        "Narozeniny vesmíru se konají jednou za 13,8 miliardy let. Panna žádá o změnu data. Pozvánka byla vrácena pro nesprávné zarovnání.",
        "Merkur chystal oslavu. Panna přinesla harmonogram, pozvánku, vizitku a čtyři svíčky v pořadí. Merkur zrušil narozeniny.",
        "Mléčná dráha slaví narozeniny ohňostrojem. Panna sbírá zbytky. Ohňostroj byl dodatečně uznán jako „skoro v pořádku“.",
        "Kosmický dort byl rozdělen na deset miliard stejných dílů. Každý host ho dostane, až se vyřeší pořadí v abecedě.",
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
    "Dnes zjistíš, že složka „Různé“ obsahuje dvanáct podsložek. Hvězdy tě nesoudí, jen tiše povzdechnou.",
    "Dneska ti někdo řekne „tak nějak“. Zachováš klid, ale oko ti už cuká.",
    "Dnes si přerovnáš pořadí aplikací v telefonu. Hvězdy tvrdí, že to není odkládání, ale revize.",
    "Dneska se ti podaří vypít kávu horkou. Hvězdy to oslavují jako malý zázrak.",
    "Dnes uvidíš cizí odrážku odsazenou o milimetr. Nic neřekneš. Ale hvězdy slyší, jak ti uvnitř hučí hlava.",
    "Dneska se k tobě někdo posadí a zeptá se: „Můžu rovnou?“ Odpovíš úsměvem s poznámkou pod čarou.",
    "Dnes ti dojde, že víš o dvaceti drobnostech, kterých si nikdo nevšiml. Rozhodneš se je zapsat. Pro jistotu.",
    "Dneska zkusíš improvizovat. Vydržíš dvě minuty, pak vytáhneš seznam.",
    "Dnes zjistíš, že někdo použil tvůj hrnek. Hvězdy doporučují klid a čistou houbičku.",
    "Dneska se dozvíš, že chyba v dokumentu nebyla tvoje. Dvě hodiny se budeš cítit podivně svobodně.",
    "Dnes ti někdo pošle fotku stolu „jak je teď uklizený“. Jsou na ní tři věci mimo zarovnání. Budeš hodnotit do večera.",
    "Dneska při výběru ponožek pochopíš, že pořadí v zásuvce je vlastně životní filozofie. Hvězdy to odmítají komentovat.",
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

export default panna;
