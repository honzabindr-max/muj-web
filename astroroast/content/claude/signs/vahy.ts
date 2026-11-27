// AstroRoast.ai: knihovna humoru, znamení vahy. Ručně psané originální české fragmenty.
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

const vahy: RawSign = {
  h: [
    [
      "Váhy: půvab, vkus a upřímný zájem o to, co si dáš ty. Ty už víš. Váhy ne.",
      "Váhy dokážou ze dvou stejně dobrých věcí vybrat tu třetí.",
      "Máš diplomacii, vkus a schopnost slušně odmítnout i sebe.",
    ],
    [
      "Váhy se rozhodnou hned. Přesněji řečeno, jakmile ostatní odejdou domů.",
      "„To je na tobě“ je u tebe vyznání lásky i obrana najednou.",
      "Tvoje nejlepší vlastnost: vidíš obě strany. Tvoje nejhorší vlastnost: stejná.",
    ],
    [
      "Pro i proti máš v tabulce, v poznámkách a v hlavě. Rozhodnutí leží někde mezi nimi.",
      "Říkáš „je mi to jedno“ a myslíš „vyber to správně, ale tak, aby to byl můj nápad“.",
      "Máš pro každou situaci skvělé řešení. Škoda, že jich je vždycky aspoň šest.",
    ],
    [
      "V restauraci čteš jídelní lístek jako smlouvu. A pak si dáš to, co sousedi.",
      "Konflikt je pro tebe jako kopřiva: radši obejdeš celou louku, než přiznáš, že tě štípe.",
      "Tvoje diplomatické „možná“ už ukončilo tři hádky a jednu válku. Kdo začal, neví nikdo.",
    ],
    [
      "Venuše tě požádala o jedno jednoduché rozhodnutí. Čeká na odpověď od minulé galaxie.",
      "Vesmír se zeptal, jestli jsi pro, nebo proti. Odpověď: „pro rovnováhu“.",
      "Hvězdná váha se kvůli tobě rozbila. Nemohla se rozhodnout, kam se přiklonit.",
    ],
  ],
  c: [
    [
      "Umíš vytvořit atmosféru, kde se všichni cítí dobře. I když nikdo neví, kdo to udělal.",
      "Máš dar vidět krásu. Zvlášť v restauracích, o kterých se ještě rozhoduje.",
    ],
    [
      "Rozhodování je pro tebe sportovní disciplína. Trénuješ ji denně. Závod ale dokončuješ vždycky až příští týden.",
      "Nejraději máš věty typu „jak chceš“. Je to elegantní způsob, jak sdělit, že nechceš nést odpovědnost.",
    ],
    [
      "Konflikt vyřešíš tak, že se budeš tvářit, že nikdy neexistoval. Hvězdy ti to uznávají.",
      "V debatě souhlasíš s oběma stranami a nakonec máš pravdu ty. Bohužel nikdo neví, o čem.",
    ],
    [
      "Úspěšně se vyhýbáš konfliktům. Zvláště těm, které způsobuje tvoje „možná“.",
      "Rozhodnutí odkládáš tak elegantně, že se z toho stala umělecká forma.",
    ],
    [
      "Váhy kosmické spravedlnosti ti vrátily vlastní vyváženost s komentářem: „Zajímavé, ale nepoužitelné.“",
      "Tvoje rozhodnutí mají vlastní časovou zónu. Nikdo z hvězdné kanceláře ji ještě nepřepočítal.",
    ],
  ],
  v: [
    [
      "Verdikt: elegance sama. Jen občas bez konkrétního rozhodnutí.",
      "Hvězdy radí: zkus vybrat jednu věc. Jakoukoli. Hvězdy tě nebudou soudit.",
    ],
    [
      "Rada hvězd: dnes řekni, co opravdu chceš. I kdyby to byla jen vanilková zmrzlina.",
      "Verdikt: každý tě má rád, protože nikomu nepřitakáš ani neodporuješ dost dlouho, aby se urazil.",
    ],
    [
      "Verdikt: harmonie je skvělá. Ale někdy se hodí i silnější názor než „jak myslíš“.",
      "Rada: napiš seznam „pro“ a „proti“. A pak vybírej podle barvy písma.",
    ],
    [
      "Verdikt: diplomacie světové úrovně. Jen bez jediné podepsané smlouvy.",
      "Rada hvězd: příště řekni „ne“. Jen jednou. Hvězdy to rády uvidí.",
    ],
    [
      "Verdikt vesmíru: výsledek hlasování je nerozhodný. Tvůj hlas byl započítán na obě strany.",
      "Rozsudek: do konce týdne se musíš rozhodnout mezi dvěma věcmi. Vesmír tě nenapomíná, ale pozoruje.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Ve vztahu umíš naslouchat tak, že se druhý cítí jako jediný člověk na světě. A ty u toho ještě krásně voníš.",
        "Tvoje romantika má vkus: svíčky, hudba a správně vybraná sklenice. Partner si připadá jako ve filmu.",
        "Umíš zjemnit každou hádku tak, že skončí smíchem. Diplomatický talent, který by obdivovali v Ženevě.",
        "Partnerovi nosíš květiny, o kterých víš, že se hodí k nábytku. Pozornost k detailům je tvůj jazyk lásky.",
      ],
      [ // úroveň 2
        "Když se partner zeptá, co si dáš k večeři, odpovíš „cokoli“. Pak jeden po druhém jemně vyvracíš jeho návrhy.",
        "Plánování rande ti trvá déle než samotné rande. Hlavně výběr mezi dvěma stejně milými restauracemi.",
        "Partner tě zná: když řekneš „je mi to jedno“, znamená to, že ti to jedno není, ale chceš, aby uhodl.",
        "Na pozvánku na víkend říkáš „zajímavý nápad“. Zní to jako ano, a je to přibližně šedesát procent ano.",
      ],
      [ // úroveň 3
        "Říkáš „jak chceš“ tak ledově jemným hlasem, že partner na chvíli pochybuje, co vlastně chce.",
        "Hádku vyřešíš elegantně: dáš za pravdu oběma. Pak se každý cítí vítězem a nikdo nepamatuje, o čem se hádalo.",
        "Na otázku „miluješ mě?“ odpovíš: „Samozřejmě, jen se nejdřív podívám, jak to myslíš.“",
        "Tvoje „nevadí mi to“ má jednu zvláštnost: následující tři dny se neděje nic jiného než to, že ti to vadí.",
      ],
      [ // úroveň 4
        "Rozejít se s tebou trvá stejně dlouho jako vybrat tapetu: ostatní už mezitím vystudovali další obor.",
        "Na rande se tě zeptají, co si dáš. Tvůj obličej přitom udělá dva výrazy: „všechno“ a „nic“.",
        "Partner by rád věděl, kdy se zítra večer uvidíte. Odpověď „pak se uvidí“ trvá od středy do soboty.",
        "Při hádce napíšeš dlouhou zprávu. Pak ji smažeš. Napíšeš novou. Pak odešleš „nic“ a druhý den přijde pozdrav s emotikonem.",
      ],
      [ // úroveň 5
        "Venuše vyhlásila hlasování o tvém vztahu. Výsledek: pro tři, proti tři, zdržel se jeden pulsar. Opakuje se od srpna.",
        "Kupid ti nabídl tři šípy. Rozhodování trvá od roku 2019 a Kupid mezitím přesedlal na luk.",
        "Dva satelity se zamilovaly a čekají, který z nich se tě zeptá, jestli to myslíš vážně. Ty čekáš, který bude první.",
        "Vesmírná agentura pro vztahy tě jmenovala „Vyvážená Nerozhodnost“. Dva roky řeší, jestli je to kompliment.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci umíš každého zklidnit a každému dát za pravdu tak, že se nikdo necítí odbytý. Tým by se bez tebe rozpadl na tři strany.",
        "Máš cit pro prezentace: barvy ladí, písmo je hezké a obsah sedí. Kolegové ti závidí i vizuály.",
        "Vyjednávání je tvůj živel. S tebou u stolu se i cizí lidé usmívají a odcházejí s dohodou.",
        "V kanceláři umíš vytvořit atmosféru, ve které se pracuje lépe. Rostlina na stole je vlastně tvoje zásluha.",
      ],
      [ // úroveň 2
        "Na poradě slyšíš oba názory a oba ti dávají smysl. Zápis obsahuje větu „zvážit obě strany“.",
        "E-maily s rozhodnutím píšeš tak jemně, že kolegové občas nepoznají, jestli jim něco zakazuješ.",
        "Při výběru dodavatele sepíšeš seznam pro a proti. Pak ho pošleš třem lidem a čekáš na jejich názor.",
        "Do práce chodíš se dvěma kávami, protože se nemůžeš rozhodnout. Tým už to chápe.",
      ],
      [ // úroveň 3
        "Termín? „Zhruba tento týden.“ V kalendáři je kolonka „možná“ a ta se od pondělka nezměnila.",
        "Na poradě řekneš „je to na vás“. Pak je to na všech a nikdo za nic nemůže.",
        "Kolegovi řekneš, že jeho nápad je zajímavý. Zajímavý jako pozvánka na akci, kam se nepůjde.",
        "Rozhodnutí odkládáš tak profesionálně, že na to máš složku. Pojmenovanou „Pro jistotu“.",
      ],
      [ // úroveň 4
        "Když se tě zeptají na názor, odpovíš: „To záleží.“ Na čem, to už nikdo nezjistí. Hlavní je nechat si otevřené dveře.",
        "Výběr jednoho písma pro prezentaci ti trvá dva dny. Pak odešleš prezentaci ve třech písmech, ať je to pestré.",
        "Na schůzce o rozpočtu hlasuješ „pro“. A „proti“. A „zdržuju se“. Zápis dopadne jako rovnice.",
        "Tvůj tým vyjednává se zákazníkem. Ty vyjednáváš s týmem, jestli se do vyjednávání zapojíš.",
      ],
      [ // úroveň 5
        "Jednání vesmírné rady se táhne už tři galaxie. Důvod: Váhy se nemohou rozhodnout, jestli přijít včas, nebo elegantně.",
        "Slunce požádalo o rozhodnutí o stavu soustavy. Váhy odpověděly: „Pošlu dva návrhy a třetí do kontroly.“ Slunce čeká.",
        "NASA chtěla vědět, kam letět. Odpověď Vah: „Obě možnosti jsou skvělé.“ Raketa stojí na rampě. Posádka mezitím vystudovala další obor.",
        "Černá díra žádala o rozhodnutí o fúzi. Váhy ji odložily na příští kvartál. Kvartál už nestihne vzniknout.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Svět se kolem tebe zkrášluje. Kam přijdeš, tam se zvedne nálada, vyladí barvy a ve vzduchu je pohoda.",
        "Máš dar vidět krásu v maličkostech: šálek, světlo, správně sladěné ponožky. Ostatní se díky tobě zpomalí.",
        "Žiješ v rovnováze. Práce a odpočinek, ticho a hudba, káva a čaj. Všechno má své místo.",
        "Dokážeš vybrat dárek, který sedne každému. Lidé tomu říkají vkus a ty „no, to se jen tak povedlo“.",
      ],
      [ // úroveň 2
        "V obchodě s oblečením vyzkoušíš sedm kousků. Odcházíš se dvěma. A druhý den se pro třetí vrátíš.",
        "Rozhodnutí o večeři děláš jako diplomatickou misi: konzultace, kompromis a nakonec pizza, jako vždycky.",
        "Když se někdo zeptá, jestli chceš čaj, nebo kávu, odpovíš: „A co máte?“ Seznam je dlouhý a ty mu věnuješ pozornost.",
        "Máš dvanáct oblíbených restaurací a pokaždé pochybnost, kterou z nich vybrat. Restaurace si už zvykly.",
      ],
      [ // úroveň 3
        "Tvoje „zítra se rozhodnu“ je vlastně prohlášení, že se zítra o tom rozhodnutí zase rozhodneš.",
        "Říkáš, že děláš kompromisy. Zatím se k nim ale vždy zavázali ostatní.",
        "Když tě donutí vybrat, nakonec vyberou za tebe. Pak se tváříš překvapeně, ale s úlevou.",
        "Svoje názory máš dvoje: vnitřní a pro okolí. Oba jsou v pohodě, dokud se nesetkají.",
      ],
      [ // úroveň 4
        "Na otázku „co chceš dělat?“ odpovíš „co ty?“. Pak ještě jednou. Pak kývnutím, že jsi pro cokoli, a vydáváš to za svobodu.",
        "Tvoje oblíbené slovo: „vlastně“. Druhé: „ale“. Třetí: „to je ale těžké“.",
        "Když máš vybrat jednu ze dvou věcí, vyrobíš si třetí. Obvykle horší, ale rozhodnutí se aspoň neodehrálo před tebou.",
        "Máš skvělý vkus. Jen mu chybí rozhodnutí. Skvělý vkus ve výloze, bez účtenky.",
      ],
      [ // úroveň 5
        "Vesmírná komise žádá o stanovisko. Váhy odpovídají: „Pro, ale také proti.“ Komise si objednala další vesmír.",
        "Planeta Země ti položila jedinou otázku: „Chceš tu zůstat?“ Odpověď se očekává po příští době ledové.",
        "Hvězdná váha se zlomila na dvě poloviny. Obě se hádají, která z nich je ta správná. Ty obě chápeš.",
        "Merkur a Venuše hlasovaly o společné trajektorii. Hlasy se vyrovnaly. Rozhodl tvůj hlas, který odmítl hlasovat.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Mezi přáteli jsi lepidlo: kdo se zlobí, ten se dohodne, a kdo se nudí, ten se rozesměje. Skvělá parta díky tobě.",
        "Dokážeš vyslechnout každého stejně pozorně. I když se příběh vyklube jako lehké drama, všichni odcházejí lehčí.",
        "Narozeniny kamarádů pro tebe nejsou jen svátek. Je to umělecká kolekce: tvůj dárek je vždycky přesně ten pravý.",
        "Díky tobě se lidé potkávají, protože jsi nejen pozorný, ale i příjemný. Vůně kávy to jen podtrhuje.",
      ],
      [ // úroveň 2
        "Když se parta rozhoduje, kam půjde, ptáš se všech. A pak všichni čekají, až se zeptáš sama sebe.",
        "Skupinový chat s tebou má dvě fronty: ty, co píšou, a ty, co čekají, až se rozhodneš.",
        "Kamarádovi pomůžeš s výběrem bundy. Dva dny, pět obchodů a každá bunda je nakonec „super, ale…“.",
        "Při přípitku hledáš slova tak dlouho, že sklenice stihne vystydnout. A přitom je to krásný přípitek.",
      ],
      [ // úroveň 3
        "Přátelé tě mají rádi, protože nikdy neřekneš „ne“. A nikdy neřekneš „ano“. Je to takový bezpečný nulový rozměr.",
        "Když ti kamarád řekne něco ošklivého, zmírníš to. Pak mu doporučíš někoho, kdo to řekne líp.",
        "Na otázku „jdeš s námi?“ odpovíš: „Uvidíme.“ V překladu: ještě se rozhodnu, jestli se rozhodnu.",
        "Pro každého máš větu, kterou chce slyšet. Skoro vždy je to věta, kterou chtěl slyšet někdo jiný naopak.",
      ],
      [ // úroveň 4
        "Když máš vybrat restauraci pro partu, hlasování trvá déle než samotná večeře. Hlasuje se i o koupelně.",
        "Na dotaz, jestli budeš na srazu, odpovíš: „Možná.“ Příští týden to potvrdíš. Sraz už proběhl a všichni jsou doma.",
        "Kamarádi tě milují jako předpověď počasí: každý den jiná, a všichni s tím počítají.",
        "Když se přátelé hádají, jsi neutrální jako Švýcarsko. Se stejně zaujatým pohledem na to, kdo je právě dole.",
      ],
      [ // úroveň 5
        "Galaxie svolala parlament přátelství. Hlasování o tobě skončilo remízou, protože tvůj hlas se zdržel. Poprvé v dějinách vesmíru.",
        "Kamarádi poslali sondu zjistit, kam půjdete na večeři. Sonda se vrátila s jedinou větou: „Možná.“ Je dnes historický dokument.",
        "Přátelé ti postavili vlastní souhvězdí: Dvě Možnosti. Skládá se ze dvou hvězd, které se nikdy nespojí.",
        "Mléčná dráha tě pozvala na akci. Tvoje odpověď „uvidíme“ zatím letí a doletí kolem roku 30 000.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš s vkusem: svíčky, hudba a dobrá společnost. Všichni si odnášejí hezký večer.",
        "Dárky umíš vybrat tak, že obdarovaný má pocit, že ho někdo opravdu zná. A často je to tak.",
        "Tvoje oslavy jsou harmonie: dobrý dort, dobrá hudba a nikdo se necítí zbytečný.",
        "Pozvánky na narozeniny píšeš poeticky, takže se nakonec ukážou i ti, kdo nechtěli.",
      ],
      [ // úroveň 2
        "Při výběru dárku si vybereš tři. Pak se rozhodneš pro čtvrtý. A pak pro ten první.",
        "Narozeninový dort je pro tebe dilema: čokoláda, nebo ovoce? Nakonec jsou to oba, napůl.",
        "Když se tě zeptají, co chceš k narozeninám, odpovíš: „Něco hezkého.“ Pak následuje dvacet minut specifikace.",
        "Pozvánky rozešleš včas. Jen datum se mezitím dvakrát posune, protože se nemůžeš rozhodnout mezi sobotou a nedělí.",
      ],
      [ // úroveň 3
        "Řekneš: „Nic nechci.“ A pak se na každý dárek díváš pohledem, který sděluje: „Zajímavé, ale není to ono.“",
        "Na otázku „kam půjdeme?“ odpovíš: „Je mi to jedno.“ Pak zamítneš tři podniky z důvodu vkusu.",
        "Slavit se může kdykoli. Nejlépe v den, kdy se zrovna rozhodneš, že je to vhodná doba.",
        "Při přípitku nevíš, jestli děkovat, nebo vtipkovat. Řekneš obojí a nastane ticho.",
      ],
      [ // úroveň 4
        "Oslava má dvě data, dva rozpočty a dva dorty. Hosté nevědí, kdy mají přijít, a ty zjišťuješ, jestli ti to vadí.",
        "Při výběru dortu strávíš víc času než většina lidí výběrem bydliště. Dort vyhrává, protože je sladký.",
        "Kamarádi ti kupují poukaz. Protože dárek by znamenal, že musí poznat, co chceš.",
        "Když máš sfouknout svíčky, přání je tak neurčité, že vesmír posílá doplňující dotaz.",
      ],
      [ // úroveň 5
        "Vesmír se snaží doručit tvoje narozeninové přání. Má dvě verze, každou ve dvanácti variantách. Doručí se po jejich sloučení v roce 4 000.",
        "Při sfouknutí svíček nastala v Mléčné dráze pauza: vesmír čekal, jestli se rozhodneš pro svíčky vlevo, nebo vpravo.",
        "NASA vypočítala, že se tvoje oslava koná ve dvou časových pásmech současně. Nejsou jisti, která z nich je potvrzená.",
        "Kosmický dort se skládá ze dvou polovin. Obě jsou pistáciové i čokoládové. Rozhodnutí o fúzi se posouvá do dalšího milénia.",
      ],
    ],
  },
  s: [
    ["Rozhodnutí hotových do deadlinu", "3 %"],
    ["Šatů vyzkoušených před odchodem", "7"],
    ["Pravdivost věty „je mi to jedno“", "0 %"],
    ["Sekund při volbě filmu", "2 400"],
    ["Dnešních vyhnutých konfliktů", "6"],
    ["Pravděpodobnost, že řekneš „ne“", "8 %"],
  ],
  d: [
    "Dnes si budeš muset vybrat mezi dvěma věcmi. Vesmír ti dává týden. Nebo dva.",
    "Venuše dnes říká: buď elegantní. A pokud nemůžeš, buď aspoň ve stejné barvě.",
    "Dnes tě čeká důležité rozhodnutí. Pošleš ho na poradu s třemi přáteli. Pak ještě s dvěma.",
    "Dnešní konstelace: dvě možnosti, dvě opačné strany, jedna váha bez ručičky.",
    "Dnes ti někdo řekne „je to na tobě“. Hvězdy zaznamenají, že tvoje odpověď dorazí příští týden.",
    "Dnes se rozhodneš. Zítra se rozhodneš o tom rozhodnutí.",
    "Dnešní tip: zvol si nejdřív něco malého. Třeba čaj. Hvězdy už zkoumají druhy čaje.",
    "Dnes se vyhneš konfliktu s takovou elegancí, že se ho zúčastníš tři dny po jeho konci.",
    "Dnes si vybereš ze dvou možností. A pak se zeptáš, jestli by nešly kombinovat.",
    "Dnes budeš chtít zdvořile říct ne. Diplomaté tomu říkají „zajímavý pokus“.",
    "Dnes tě čeká estetický zážitek. Strávíš nad ním dvě hodiny a nic nekoupíš.",
    "Dnešní varování: pokud ti někdo řekne „já se rozhodnu hned“, nevěř mu. Pokud to řekneš ty, hvězdy se zasmějí.",
    "Dnes si objednáš oběd po dvaceti minutách váhání. Číšník se mezitím stihne zamyslet nad svým povoláním.",
    "Dneska řekneš „ne“. Hvězdy se podívají na hodinky: bylo 14:07. Zapíšou to jako historickou událost.",
    "Dnes porovnáš dva úplně stejné produkty a pro jistotu se zeptáš tří lidí. Rozhodne tvůj čtvrtý pocit.",
    "Dneska ti někdo nabídne dvě barvy. Vybereš třetí. Hvězdy tomu říkají „kreativní řešení“, obchod „zdržení“.",
    "Dnes zjistíš, že odpovědět „asi“ je dobrá strategie. Asi.",
    "Dneska se pokusíš sestavit playlist. Čas na přípravu: 45 minut. Čas na přehrávání: 12.",
    "Dnes tě čeká krásný západ slunce. Nad fotkou strávíš víc času než nad samotným západem.",
    "Dnes se tě někdo zeptá na názor. Zazní věta „to záleží“. Hvězdy tomu říkají pětiminutový úvod.",
    "Dneska si koupíš dvě verze téhož. Pak vrátíš obě a koupíš třetí. Hvězdy ti odpouštějí.",
    "Dnes sladíš barvu ponožek s barvou nálady. Nálada se mezitím změní. Ponožky zůstanou.",
    "Dnes na tebe čeká důležitý hlas „pro“ nebo „proti“. Zvedneš ruku, ale bude to spíš mávnutí.",
    "Dneska odpovíš na zprávu rychle. Hvězdy zaznamenají výjimku. Okolí se bude ptát, jestli nejsi někdo jiný.",
  ],
  q: [
    "Je mi to jedno. Vyber ty. Jen ne ten podnik, ten včera. A taky ne tamten. A taky ne… radši nic neříkej.",
    "Víkend by se dal strávit mnoha způsoby. Navrhuji tři. A pak se uvidí, co bude hezké.",
    "Odpovím. Jen musím vymyslet odpověď, která nebude nikoho urážet. Dej mi dvacet minut. Nebo týden.",
    "Já umyju, ty utíráš. Nebo opačně? Nebo můžeme obojí zítra. Jak chceš. Ne, jak chceš ty.",
    "Do míst, kde je hezky. Konkrétně navrhuji tři. Ale můžeš vybrat čtvrté, pokud je hezčí.",
    "Co chceš ty. Tak ne. Co chci já? Vlastně tohle se mi líbí. Ale to druhé taky.",
  ],
};

export default vahy;
