// AstroRoast.ai: knihovna humoru, znamení stir. Ručně psané originální české fragmenty.
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

const stir: RawSign = {
  h: [
    [
      "Štír: hluboký pohled, tichá síla a paměť, která nezapomene jedinou dobrou věc.",
      "Štír vidí víc, než říká. A říká dost, aby to znělo záhadně.",
      "Nevzdáš se nikdy. Hvězdy by rády věděly, jestli by se dala vzdát aspoň jedna hádka.",
    ],
    [
      "Štír nemá rád překvapení. Obzvlášť ta, o kterých se dozví jako poslední.",
      "Tvoje pohledy mají vlastní kategorii: „dívám se, protože vím“.",
      "Mlčíš tak výmluvně, že okolí mluví za tebe. Obvykle špatně.",
    ],
    [
      "Štír nezapomíná. Štír jen čeká na vhodnou chvíli připomenout něco, co je skoro zapomenuté.",
      "Máš vlastní soukromí tak pevně chráněné, že i ty musíš vyplnit žádost o přístup.",
      "Tvůj poker face je tak dobrý, že občas netušíš, co cítíš. Hvězdy to vědí, ale mlčí.",
    ],
    [
      "Pomsta je pokrm, který se podává studený. Tvůj bývá zamrzlý od roku 2019.",
      "Štír netvrdí, že se mstí. Štír jen přesouvá případ do složky „časem“.",
      "Působíš tak tajemně, že tě kolegové stejně jako hvězdy sledují z bezpečné vzdálenosti.",
    ],
    [
      "Pluto svolalo schůzi: co je ještě nevyřízené? Odpověď: nic. Všechno se pamatuje.",
      "Vesmír z tebe cítí respekt. Jedna černá díra žádá o přesun do jiné galaxie.",
      "Tvůj pohled byl zařazen do úředních dokumentů vesmíru. Pod kategorií „Nekomentovat“.",
    ],
  ],
  c: [
    [
      "Umíš být loajální do morku kostí. Kdo tě má na své straně, ten má na své straně celý kontinent.",
      "Máš intenzitu. V dobrém i ve špatném, ale hvězdy to hlásí jen jako intenzivní.",
    ],
    [
      "Tvoje mlčení řekne víc než ostatním celý projev. Hlavně to, že si pamatuješ.",
      "Máš intuici, která vycítí lež dřív, než ji dotyčný dořekne. Občas i dřív, než ji vymyslí.",
    ],
    [
      "Štír nikdy neřekne „zlobím se“. Štír řekne „v pořádku“. A pak se ostatním udělá zima.",
      "Umíš zvednout obočí tak, že si dotyčný přehraje poslední tři roky.",
    ],
    [
      "Tvůj seznam křivd je tak přesný, že by ho záviděl archiv ministerstva.",
      "Mlčíš dramaticky. S kamerou, s hudbou a se sedmi dny pauzy.",
    ],
    [
      "Pluto se nad tebou sklání a šeptá: „Kosmická rozvědka by se u tebe mohla učit.“",
      "Vesmírný archiv zřídil kvůli tobě novou složku. Název: „Neodpuštěno, ale zapsáno“.",
    ],
  ],
  v: [
    [
      "Verdikt: hloubka, síla a trochu záhady. Jen občas mrkni, ať se ostatní nebojí.",
      "Hvězdy radí: dopřej si pomalu. A kdyby někdo vyzvídal, mlč dramaticky.",
    ],
    [
      "Rada hvězd: zkus říct jednu myšlenku nahlas. Čistě pro vědecké účely.",
      "Verdikt: tajemno, vytrvalost a trocha strašidelnosti. Hvězdy by tě rády pozvaly, ale bojí se odpovědi.",
    ],
    [
      "Verdikt: s tebou je dobře i zle. Obojí je poctivě zdokumentováno.",
      "Rada: přeřaď „pamatuju si“ do kategorie „už je to dávno odpuštěno“. Vesmír to ocení.",
    ],
    [
      "Verdikt: žádná křivda se u tebe neztratí. Škoda, že nikdo neví, kde je tvůj archiv.",
      "Rada hvězd: občas odpusť. Nebo aspoň přepiš ten dokument do menšího písma.",
    ],
    [
      "Verdikt vesmíru: archivováno, vyhodnoceno, uloženo. Vyřízení čeká na příhodnou galaxii.",
      "Rozsudek: povinná jedna odpuštěná křivda ročně. Hvězdy provedou namátkovou kontrolu.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Miluješ naplno: komu dáš srdce, tomu ho dáš celé. Takovou intenzitu ve vztazích nenajdeš nikde jinde.",
        "Tvůj pohled umí říct víc než deset vyznání. Partner si ho schovává jako cennou pohlednici.",
        "Ve vztahu jsi ochránce: o partnera se staráš, hlídáš ho a víš, co potřebuje dřív, než to řekne.",
        "Romantické chvíle umíš vytvořit tak hluboké, že se z nich hned tak nevyleze. Ani se nechce.",
      ],
      [ // úroveň 2
        "Když se partner zeptá „co se děje?“, odpovíš „nic“. Partner už ví, že „nic“ je dlouhý příběh se třemi díly.",
        "Partnerovy zprávy čteš s pozorností detektiva. Mezi řádky tam stojí mnohem víc, než je napsáno.",
        "Partnerův telefon ti nevadí, aspoň to tvrdíš. Ale víš, kdy se naposledy rozsvítil.",
        "Tvůj výraz při slovech „musíme si promluvit“ má v sobě klid i bouři. Partner zkoumá, která převáží.",
      ],
      [ // úroveň 3
        "Žárlivost u tebe není emoce, ale metoda. Důkladná, tichá a se spoustou poznámek.",
        "Říkáš „věřím ti“ stejným tónem, jakým se v krimi říká „jdi dál, nic se neděje“.",
        "Partnerovu minulou chybu si pamatuješ perfektně. Při každé hádce ji vytáhneš jako důkazní materiál D.",
        "Odpouštíš velkoryse: poprvé, podruhé, potřetí. A pak všechno najednou, s odrážkami a daty.",
      ],
      [ // úroveň 4
        "Tvoje „v pořádku“ je tak chladné, že partnerovi zamrzne nápoj. A pak i pohled.",
        "S tebou se partner naučí číst pohledy rychleji než řeč. Řeč ostatně moc nepoužíváš.",
        "Rozcházíš se jako šachista: ticho, tah a po třech týdnech oznámení mat.",
        "Partner se tě zeptá, jestli je něco špatně. Odpovíš „ne“. V příštích dvou týdnech se dozví podrobnosti.",
      ],
      [ // úroveň 5
        "Pluto zřídilo oddělení vztahových křivd. Je to tvoje oddělení. Dostalo vlastní patro, sklep a archiv.",
        "Černá díra se rozešla se svou galaxií. Tvůj komentář: „Amatéři. Bez složky se nerozchází.“",
        "Venuše posílá kytici s lístečkem „já za nic nemůžu“. Pohled stejně dorazil.",
        "Kosmická rada žádá o omezení tvých pohledů na úroveň „mírně děsivé“. Návrh zamítnut, protože nikdo neměl odvahu ho přednést.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci vydržíš tam, kde se ostatní vzdají. Tvoje vytrvalost je tichá a jistá jako pevná skála.",
        "Kolegové se na tebe mohou spolehnout. Co slíbíš, to platí, a co zamlčíš, to je v bezpečí.",
        "Problém odhalíš dřív, než se z něj stane krize. Máš pro to šestý smysl, nebo velmi dobrý archiv.",
        "Při jednání umíš mlčet tak soustředěně, že protistrana sama doplní, co chceš slyšet.",
      ],
      [ // úroveň 2
        "Na poradě mlčíš. Hlasitě. Kolegové se ptají, jestli souhlasíš, a pak raději mění téma.",
        "Když ti někdo vezme sešit, víš kdo. Když ti někdo vezme nápad, víš kdy. Neříkáš nic, ale víš.",
        "Tvůj e-mail s „Dobrý den,“ a podpisem bez emotikonu působí na kolegy jako zvonění po půlnoci.",
        "Kolegové o tobě říkají, že působíš tajemně. Ty prostě nevidíš důvod, proč by měli znát tvůj oběd.",
      ],
      [ // úroveň 3
        "Kolegům chyby odpouštíš velkoryse. Jen si je ukládáš do složky, kterou občas otevřeš pro osvěžení.",
        "Na dotaz „jak to jde?“ odpovíš „v pohodě“. Hvězdy tvrdí, že je to nejděsivější věta v praxi.",
        "Pomsta za špatnou prezentaci ti trvá tři měsíce. Pak kolegovi z porady zmizí oblíbená židle.",
        "V týmu tě znají jako „ticho před poradou“. Ostatní se bojí, jestli nečteš myšlenky. Ty jen čekáš, až se někdo přizná.",
      ],
      [ // úroveň 4
        "Když ti kolega vezme zásluhy, nic neřekneš. Čekáš na vánoční večírek, kde mu poděkuješ pohledem na celý stůl.",
        "Tvoje mlčení na poradě má vlastní rozpočet, dvě místa v zasedačce a občas i vlastního právníka.",
        "V kanceláři jsi jako kamera bez záznamu: všichni vědí, že tě mají na očích, a nikdo neví, co z toho vzejde.",
        "Komunikaci s kolegy vedeš pohledy. Dva pohledy znamenají „souhlasím“. Tři „varování“. Čtyři „už je pozdě“.",
      ],
      [ // úroveň 5
        "Kosmický archiv má kvůli tobě přípojku k tvým poznámkám. Pluto ji nazvalo „Neodpuštěno, ale odloženo“. Poznámek přibývá.",
        "Pracovní porada v Orionu skončila tím, že se Štír podíval na Merkur. Merkur od té doby obíhá pozpátku.",
        "NASA hlásí nárůst ticha v kanceláři Štíra. Vědci to označují jako „slabé gravitační vlny nevyřčeného“.",
        "Vesmírná firma tě zařadila do oddělení „Neřeknu, ale zapíšu“. Zaměstnanců je jeden. Zápisů čtyři miliardy.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Žiješ do hloubky: ne rychle, ne povrchně, ale s chutí na to, co je pod hladinou. Takový život má příchuť.",
        "Máš vzácný dar vycítit, co v místnosti chybí. Pak to tiše doplníš a nikdo neví, jak se to stalo.",
        "Máš pevné hranice. Díky nim víš, co chceš, a ostatní to vždy okamžitě pochopí.",
        "Intuici máš jako druhý mozek. Obvykle má pravdu, jen ji občas nenecháš domluvit.",
      ],
      [ // úroveň 2
        "Když ti někdo řekne „nechtěl jsem ti to říkat“, už víš všechno. Nepotřebuješ detaily. Jen potvrzení.",
        "Máš na hlase tón, kterým se říká „ach tak“, a ostatní hned začnou přemýšlet, co provedli.",
        "Tvoje oblíbené místo v kavárně: u zdi, s výhledem na vchod. Nikdy nevíš, kdo vejde.",
        "Telefon máš na tichém. Svět tě může volat, ale ticho je pro tebe pohodlnější než konverzace.",
      ],
      [ // úroveň 3
        "Říkáš, že nic nevyzvídáš. Pak o všech víš všechno a nikdo ti nic neřekl.",
        "Tajemství umíš udržet tak dobře, že občas zapomeneš, že ostatní vědí, že nějaká máš.",
        "Když se tě někdo zeptá na plány, odpovíš „uvidíme“. Hvězdy tomu říkají „zdvořilé mlčení se zbraní“.",
        "Soukromí máš velké jako pevnost. Rádi bychom ti zazvonili, ale zvonek chybí.",
      ],
      [ // úroveň 4
        "Když se na tebe někdo usměje, hledáš v tom úmysl. Většinou ho najdeš, ale jen proto, že ho tam hledáš.",
        "Sociální sítě máš pod kontrolou: sleduješ všechny a nikdo nevidí tebe. Vzorová špionážní operace.",
        "Máš seznam lidí, kterým nevěříš, a seznam lidí, kterým věříš. Ten druhý se vejde na vizitku.",
        "Máš pocit, že všichni mají tajemství. Máš pravdu, jen tvoje tajemství je, že to zjišťuješ.",
      ],
      [ // úroveň 5
        "Pluto zřídilo pro tvou intuici oddělení radaru. Fungování: kdykoli se někdo usměje, spustí se sirény.",
        "Černá díra má méně tajemství než ty. Při srovnání prý žádala o přesun do jiného vesmíru.",
        "Kosmická rozvědka hledá agenty. Nabídla ti místo. Odpověď: „Já už pracuju. Pro sebe. A pro Pluto.“",
        "Když se podíváš do dalekohledu, hvězdy rychle změní trajektorii. Nikdo nechce vysvětlovat, co dělal včera.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Pro přátele jsi tichá hora: stojí a drží. Kdykoli je potřeba, jsi tam, a to bez zbytečných řečí.",
        "Přátel nemáš mnoho, ale ti, které máš, patří k tobě napořád. To je kvalita, která se nedá sbírat.",
        "Když se ti kamarád svěří, jeho tajemství je v bezpečí hlubšího trezoru, než mají banky.",
        "Máš cit pro to, kdy kamarád potřebuje mlčet a kdy mluvit. A neomylně poznáš, kdy potřebuje pizzu.",
      ],
      [ // úroveň 2
        "Přátelé tě oslovují s opatrností, jako když někdo drží krabici s nápisem „nešťourat“.",
        "Na srazu přátel sedíš tak, že máš výhled na dveře i na všechny. Říkáš tomu pohodlí.",
        "Když kamarád zapomene na tvoje narozeniny, usměješ se. Ten úsměv si kamarád ponese ještě roky.",
        "Skupinový chat čteš, ale neodpovídáš. Přátelé to berou jako dobrou zprávu: žiješ a čteš. Hlavně čteš.",
      ],
      [ // úroveň 3
        "Přátelství u tebe funguje jako smlouva: stálé, oboustranné a s přílohou o případných křivdách.",
        "Tvoje věta „já tě chápu“ znamená „je to v poznámkách“. Přátelé si jí nikdy nejsou jisti.",
        "Když se ti kamarád omluví, odpustíš mu. Zároveň otevřeš složku se třemi podobnými případy z minulé dekády.",
        "Pro přátele uděláš cokoli. Jen musejí počítat s tím, že ti to budou splácet tichem.",
      ],
      [ // úroveň 4
        "Přítel ti řekne tajemství a ty ho pohřbíš tak hluboko, že ho už nikdo nenajde. Včetně přítele.",
        "Když se kamarád zeptá, jestli se zlobíš, odpovíš „ne“. Dvanáct měsíců se pak nestane nic. A potom všechno.",
        "Tvoje přátelství je jako pojistka: funguje dokonale, dokud ji někdo nezkusí obejít. Pak výbuch, který slyší celý panelák.",
        "Máš krátký seznam přátel a dlouhý seznam toho, co ti dlužní. Ty dva seznamy se nikdy nepotkají.",
      ],
      [ // úroveň 5
        "Přátelé z vedlejší galaxie ti poslali přání. Pluto ho zadrželo k přezkoumání. Důvod: v textu chyběla tři slova upřímnosti.",
        "Mléčná dráha pořádá oslavu přátelství. Štír přišel, sedl si do rohu a sledoval. Do rána se u něj vystřídalo pět souhvězdí.",
        "Při vesmírném srazu přátel se Slunce zeptalo: „Jsi v pohodě?“ Odpověď „jo“ způsobila, že Slunce na hodinu zhaslo.",
        "Souhvězdí tvých přátel je vzácné: čtyři hvězdy, jedna černá díra a dlouhá historie vzájemně zamlčených věcí.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš v klidu a s lidmi, na kterých opravdu záleží. Menší oslava, větší pocit, že je to pravé.",
        "Přání od blízkých si pamatuješ každé zvlášť. Hlavně to, které zvlášť upřímně zahřálo.",
        "Dárek od tebe je vždy osobní, promyšlený a zabalený s tichým záměrem, aby dotyčný pocítil, že ho někdo vidí.",
        "Dort sfoukneš se zavřenýma očima a tajným přáním. Nikomu ho neřekneš. Ale něco v tvém úsměvu mluví.",
      ],
      [ // úroveň 2
        "Když se tě zeptají, co si přeješ, odpovíš „nic“. Přesněji „nic, co by se dalo říct nahlas“.",
        "Narozeniny slavíš ve čtyřech lidech. Z původních dvaceti pozvaných se vyfiltrovali ti, kdo si to zaslouží.",
        "Přání od lidí, které dlouho nevidíš, čteš pozorně. Zvlášť to, co v nich není.",
        "Při oslavě mluvíš málo a pozoruješ hodně. Hosté mají pocit, že je někdo hodnotí. Je to pravda.",
      ],
      [ // úroveň 3
        "Narozeniny jsou pro tebe test. Kdo se ozve včas, získá bod. Kdo se ozve pozdě, získá vysvětlení.",
        "Tvůj seznam hostů vypadá nevinně, ale má sedm příloh o tom, kdo se za poslední dva roky zasloužil.",
        "Řekneš „žádné dárky“ a pak sleduješ, kdo co přinese. A kdo ne. Všechno jde do evidence.",
        "Dárek, který tě zklame, přijmeš s úsměvem. Úsměv má na sobě malou poznámku: „zapamatováno“.",
      ],
      [ // úroveň 4
        "Na tvých narozeninách se hosté bojí zeptat, jestli si mohou vzít další kousek dortu. Dort má ochranku.",
        "Narozeniny slavíš tak tajemně, že pozvánka dorazí jen třem lidem. A vždycky těm, kdo nevěděli, že jsou na seznamu.",
        "Přání od lidí, kteří ti nesedí, čteš pozorně. Pak je archivuješ. Pro příští ročník.",
        "Dárek, který tě zaujal, uložíš na bezpečné místo. Ten, který tě nezaujal, na bezpečné místo číslo dvě.",
      ],
      [ // úroveň 5
        "Pluto si pro tvoje narozeniny zarezervovalo celý měsíc. Hostů bylo pět a jeden meteorit. Nikdo se neodvážil zeptat, proč zrovna on.",
        "NASA připravuje oslavu tvých narozenin ve stratosféře. Pozvánka je tajná a hosté mají hlavně držet jazyk za zuby.",
        "Narozeninový dort zatemnil Slunce. Důvod: obsahoval příliš mnoho tajemství. Spolu s ním i sedm černých svíček.",
        "Vesmír ti zazpíval „Hodně štěstí“. Pak ztichl a nechal se pozorovat. Nikdo nevěděl, jestli se ptáš, nebo hodnotíš.",
      ],
    ],
  },
  s: [
    ["Zapamatovaných křivd", "2 311"],
    ["Pohledů, které říkají „vím“", "18 denně"],
    ["Tajemství, o kterých nikdo neví", "31"],
    ["Pravdivost věty „jsem v pohodě“", "0 %"],
    ["Pomalu servírovaných pomst", "4"],
    ["Slov v dnešním dni", "47"],
  ],
  d: [
    "Dnes ti někdo řekne něco, co se ti nebude líbit. Zapíšeš si to do archivu. Hvězdy se dívají.",
    "Pluto dnes říká: nic neříkej. Jen se dívej. Zbytek zařídí atmosféra.",
    "Dnes budeš působit tajemně. Nikdo se tě na nic nezeptá, protože se bojí odpovědi.",
    "Dnešní konstelace: dlouhý pohled, krátká věta, nekonečná paměť.",
    "Dnes ti kdosi odpoví na zprávu pozdě. Hvězdy ti doporučují neříkat nic. Ty to stejně uděláš tichem.",
    "Dnes budeš mít potřebu zkontrolovat něčí profil. Ne proto, že je to důležité. Prostě proto.",
    "Dnes se dozvíš pravdu. Ty ji už dávno znáš. Jen ti chyběl důkaz.",
    "Dnešní tip: usměj se. Hvězdy tvrdí, že to bylo naposledy před dvěma lety. Něco tě rozptýlilo.",
    "Dnes ti někdo opět zadá otázku „co se děje?“. Odpověď: „nic.“ Překlad: „celá sága.“",
    "Dnes tě čeká překvapení. Nikdo neví jaké. Ty už ano. Jen nic neřekneš.",
    "Dnes budeš tři hodiny přemýšlet nad pohledem, který ti někdo věnoval na poradě.",
    "Dnešní varování: pokud ti někdo zatelefonuje, nezvedej to hned. Nech ho trochu napnout.",
    "Dneska se zeptáš „jak se máš?“ a doufáš v upřímnou odpověď. Dostaneš „dobře“. Nevěříš, ale kývneš.",
    "Dnes tě někdo pozdraví větou „dlouho jsme se neviděli“. Ty si zapíšeš přesné datum a počet týdnů.",
    "Dneska se na tebe někdo zahledí. Ty to vydržíš o tři vteřiny déle. Je to dnešní sportovní výkon.",
    "Dnes si v kavárně vybereš místo se zdí za zády. Hvězdy tomu říkají strategie, ty pohodlí.",
    "Dneska ti někdo svěří tajemství. Uložíš ho do hloubky, kde už leží další čtyři a jedno z roku 2016.",
    "Dnes se rozhodneš odpustit. Vydržíš to do oběda.",
    "Dneska ti někdo vrátí půjčenou věc o týden později. Nic neřekneš. Ale pohled bude mít vlastní poznámky pod čarou.",
    "Dnes zjistíš, že ti někdo nevrátil pozdrav. Uložíš to do složky „Zatím nic“. Složka zatím roste.",
    "Dnes ti někdo řekne „nezlob se“. Hvězdy poznamenají: dobrá taktika, ale pozdě.",
    "Dneska se tě někdo zeptá, co děláš večer. Odpovíš „mám plány“. Nikdo se nezeptá dál a ty to oceníš.",
    "Dnes ti přijde zpráva s větou „musíme si promluvit“. Ticho potrvá tři hodiny. Odpověď bude mít dvě slova.",
    "Dnešní horoskop pro Štíra: nic. Totiž nic, co by šlo říct nahlas. A hvězdy mlčí taky.",
  ],
  q: [
    "Vyberu místo, které znám. Sednu si ke zdi. Budu sledovat vchod. Ať vím, kdo kdy přišel.",
    "Víkend je můj. Nikdo se nezeptá, co dělám. Já nikomu neřeknu, že nic.",
    "Odpověď poslat můžu. Ale ještě nevím, jestli ji poslat dnes, nebo až si dotyčný uvědomí, co udělal.",
    "Umyju to. A přitom si budu pamatovat, kdo tam ty hrnky nechal. Ale nic neřeknu.",
    "Cestovat? Tam, kam nikdo nejede. A kde nás nikdo nehledá. A nikdo se neptá, proč.",
    "Něco s tajemstvím. Něco, kde všichni lžou a já to vím od začátku. Hned po první scéně.",
  ],
};

export default stir;
