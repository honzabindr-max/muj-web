// AstroRoast.ai: knihovna humoru, znamení vodnar. Ručně psané originální české fragmenty.
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

const vodnar: RawSign = {
  h: [
    [
      "Vodnář: originální, nezávislý a občas na jiné planetě. Hvězdy to berou sportovně.",
      "Máš nápady, které předběhly dobu. Doba se k nim zatím blíží opatrně, ale s obdivem.",
      "Zvědavost, svoboda a pár nápadů navíc. Přesně tak, jak se to píše v horoskopech.",
    ],
    [
      "Vodnář je jiný než všichni ostatní. Jako všichni ostatní Vodnáři.",
      "Máš 47 revolučních nápadů. Čtyřicátý osmý je dokončit aspoň jeden.",
      "Tvoje „nikdo mě nechápe“ je tak populární, že už si ho nikdo nechce nechat pro sebe.",
    ],
    [
      "Vodnář chce změnit svět. Zatím začal u uspořádání knihovny a ta se mění pořád.",
      "Tvoje názory jsou tak progresivní, že je ani ty nestačíš dohnat.",
      "Máš nezávislý názor na všechno. Hlavně na věci, o kterých nic nevíš.",
    ],
    [
      "Cit není tvoje silná stránka. Je to přece jen pocit, ne technická specifikace.",
      "Slovo „blízkost“ ti zní jako cizí jazyk. Rozumíš, ale mluvit na to nechceš.",
      "Vodnář nechodí s davem. Obvykle už stojí na vedlejší louce a tvrdí, že tam je lépe.",
    ],
    [
      "Uran s tebou přerušil komunikaci. Prý je to „příliš originální i pro něj“.",
      "Vesmír tě zapsal jako „jediný exemplář svého druhu“ a zavedl pro tebe výjimku z fyziky.",
      "Tvoje myšlenky už opustily sluneční soustavu. Posílají pohlednice a žádají o víc prostoru.",
    ],
  ],
  c: [
    [
      "Vidíš věci jinak. Astronomové tomu říkají „pohled z orbitu“ a trochu ti závidí.",
      "Sníš o lepším světě a navíc k němu máš i návod. Hvězdy to oceňují a chtějí kopii.",
    ],
    [
      "Tvoje oblíbená slova: „Dá se to dělat jinak.“ Nikdo se neptal, jak, ale všichni čekají.",
      "Hvězdy tě mají rády, protože nikdo neví, co uděláš. Ani ty.",
    ],
    [
      "Nikomu se nepodřizuješ. Jen té myšlence, že se nikomu nepodřizuješ.",
      "Tvůj humor se vyplatí až příští generaci. A možná ani tak.",
    ],
    [
      "Emoční dostupnost? Kniha se zamčeným sklepem. Nikdo nezná klíč, ani ty.",
      "Revoluce probíhá, ale zatím jen v konceptu. Hvězdy čekají na první verzi.",
    ],
    [
      "Vesmír se tě pokusil napravit. Dostal odpověď „Jsem originál“ a stáhl se do vedlejší galaxie.",
      "Uran tě nabídl jiné galaxii jako dar. Galaxie tě vrátila s komentářem: „Příliš originální.“",
    ],
  ],
  v: [
    [
      "Verdikt: jiskra světa, která občas zapomene, že ji vidí i ostatní.",
      "Hvězdy radí: zkus aspoň jeden nápad říct nahlas. Svět ho vítá.",
    ],
    [
      "Rada hvězd: dokonči jeden z těch čtyřiceti sedmi. Pak teprve začni čtyřicátý osmý.",
      "Verdikt: svobodomysl, nezávislost, nepostradatelnost. A taky nedostupnost.",
    ],
    [
      "Verdikt: tvoje myšlenky předběhly dobu. Doba se zatím nepřihlásila.",
      "Rada: zkus někoho obejmout. Nemusí to znamenat změnu světového řádu.",
    ],
    [
      "Verdikt: originalita ti vychází tak dokonale, že ji nikdo neumí okopírovat. Ani nechce.",
      "Rada hvězd: občas se spoj s davem. Třeba jen pro zajímavost. Mají tam dobré jídlo.",
    ],
    [
      "Verdikt vesmíru: svět ještě není připraven. Tvůj nápad byl odložen na další velký třesk.",
      "Rozsudek: povinná jedna konvenční věc ročně. Doporučeno: jít na oběd jako všichni.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce jsi originální. Partner s tebou nezažije nudu a dostane nápady, které nikdo jiný nemá.",
        "Díky přátelské povaze mají tvoje vztahy prostor, kde se dá povídat o všem, od vesmíru po pondělní oběd.",
        "S tebou partner zažije něco nového už při první kávě. Třeba kavárnu s motivem černých děr.",
        "Tvůj vztah stojí na hluboké přátelské základně. Partner je i kamarád, i spoluhráč, i spoluobjevitel.",
      ],
      [ // úroveň 2
        "V lásce chceš spojení bez omezení. Partner by uvítal aspoň omezení typu „přijdu na večeři“.",
        "Na rande přijdeš s tématem, ne s kytkou. Téma bývá robotika, svoboda nebo budoucnost kávy.",
        "Partnera zasypáš nápady na zlepšení vztahu. Partner by rád jen věděl, jestli zítra přijdeš.",
        "Říkáš „potřebuju prostor“. Prostor je tak velký, že se v něm občas ztratí i příští pozvánka.",
      ],
      [ // úroveň 3
        "Vztah máš v „pokusném režimu“. Beta verze trvá čtyři roky a partner hlásí chyby.",
        "Na „miluju tě“ odpovídáš „zajímavé téma“. Partner to bere jako vyznání. Taky je to jediné, co dostane.",
        "Citová blízkost je pro tebe jako spojení v letadle: zapnutá je, ale nikdy neříkáš, kdy se připojíš.",
        "Tvoje „jsem tu pro tebe“ platí, dokud se neozve nový projekt. Pak je to „jsem tu pro budoucnost“.",
      ],
      [ // úroveň 4
        "Partner tě studuje jako dálkově řízenou družici: signál přichází jen občas a bez překladu.",
        "Při hádce prohlásíš „emoce jsou neefektivní“. Partner řekne „tak odejdu efektivně“. A už balí.",
        "Slovo „blízkost“ používáš jen při poruše signálu. Jinak preferuješ „dostatečnou vzdálenost“.",
        "Výročí? Pamatuješ si ho tak samozřejmě, že ho zapomeneš napsat do kalendáře. Zato víš přesně, kdy bude letos zatmění.",
      ],
      [ // úroveň 5
        "Kupid tě označil za „nelokalizovatelný cíl“. Šíp se vrátil se vzkazem: „Zkuste to na Uranu.“",
        "Tvoje srdce má vlastní oběžnou dráhu. Partner posílá signály, ale zpráva se vrací s razítkem „příjemce je mimo galaxii“.",
        "Vesmírný registr vztahů vede tvůj stav jako „spojení probíhá, ale s jinou částí vesmíru“.",
        "Kdyby tvůj vztah měl planetu, byla by neobydlená a vedená pod názvem „Teoreticky možný život“.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci jsi zdroj nápadů. Poradu bez tebe by si nikdo nepamatoval, protože by byla stejná jako ta minulá.",
        "Máš dar vidět, jak by to šlo udělat jinak. A často i lépe, k radosti celého týmu.",
        "Kolegové s tebou rádi brainstormují. Odcházejí z místnosti s deseti směry a pocitem, že jsou budoucnost.",
        "Tvoje zvídavost posouvá firmu k novým věcem. I když se tomu občas říká „zase něco nového“.",
      ],
      [ // úroveň 2
        "Máš nápad na zlepšení každého procesu. Hlavně těch, které právě běží a fungují.",
        "Poradu bereš jako příležitost přepsat agendu. Kolegové jako příležitost podívat se na hodinky.",
        "Do práce chodíš jako host: zajímavý, vtipný a s plánem, který se mění po každé kávě.",
        "Hierarchie tě nezajímá. Šéfa oslovuješ stejně jako stážistu. Oba to berou s nadějí na změnu.",
      ],
      [ // úroveň 3
        "V práci prosazuješ plochou hierarchii. Zatím jen ve smyslu, že si nikdo nepamatuje, kdo je tvůj šéf.",
        "Pracovní postup máš vlastní. Kolegové mu nerozumí, ale výsledky chodí. Někdy ve čtvrtek, někdy v jiné realitě.",
        "Tvoje „prostě to udělejme jinak“ je jediná věta, po které IT oddělení tiše zavře dveře.",
        "Chceš pracovat na dálku, bez budíků a bez šéfa. V ideálním případě i bez úkolů.",
      ],
      [ // úroveň 4
        "Každé pondělí navrhuješ revoluci v práci. Do pátku se z ní vyklube prezentace, kterou už nikdo neotevře.",
        "Máš pět rozdělaných projektů a tvrdíš, že jsou propojené. Jediné, co je propojuje, je nedokončenost.",
        "Na poradu přicházíš s radikálním návrhem. Na další poradu s úplně opačným radikálním návrhem.",
        "Tvůj podpis pod e-mailem: „Nezávislý myslitel“. Kolegové si ho překládají jako „Nedostupný, ale s citáty“.",
      ],
      [ // úroveň 5
        "NASA uvedla, že tvoje nápady jsou „příliš daleko od reality i pro vesmírný výzkum“. Teď je nabízí Marsu.",
        "Pracovní porada v tvé galaxii: osm účastníků, devět nápadů a jedna výzva zrušit všechno. Ta výzva jsi ty.",
        "Uran pro tebe zřídil pracovní pozici „Hlavní narušitel“. Odměna se vyplácí v nápadech, benefit je nulová gravitace.",
        "Kdyby firma uvedla tvoje nápady do praxe, vesmír by se musel přepsat. Právní oddělení Galaxie už podalo preventivní odvolání.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Žiješ po svém a ostatním tím dáváš odvahu být taky trochu jiní.",
        "Tvoje zvědavost nemá hranice. Dokážeš se nadchnout pro vynález i pro zapomenutou knihovnu.",
        "Máš v hlavě mapu budoucnosti, kterou ostatní teprve kreslí. Je krásně barevná.",
        "Svoboda je tvoje přirozená hodnota. Ostatní se u tebe učí, že být sám sebou není luxus.",
      ],
      [ // úroveň 2
        "Máš pocit, že čas plyne jinak než ostatním. Naštěstí máš i vlastní hodinky, které se na tom shodují.",
        "Konvence jsou pro tebe jen doporučení. Obvykle si je přečteš po tom, co je porušíš.",
        "Zajímáš se o všechno: vesmír, politiku, techniku, smysl života. Úklid se ti občas ztratí mezi tématy.",
        "Na dotaz „kdy to dokončíš?“ odpovídáš: „To je zajímavá otázka.“ A odcházíš za novým nápadem.",
      ],
      [ // úroveň 3
        "Jsi proti mainstreamu. Když se mainstream přesune k tobě, okamžitě se přestěhuješ.",
        "Chceš zachránit svět. Zatím nezvládáš ani frontu v obchodě, ale plán na záchranu světa je hotový.",
        "Technologii miluješ do chvíle, než ji začnou používat všichni. Pak najednou objevuješ kouzlo papírové mapy.",
        "Tvrdíš, že nesleduješ trendy. Přitom máš vlastní trend, který nikdo nesleduje, ale ty ho vedeš.",
      ],
      [ // úroveň 4
        "Tvůj život je beta verze, která se nikdy nevydá. Pořád v ní je něco, co se dá vylepšit nebo zahodit.",
        "Na seznamu životních cílů máš „změnit svět“ a „vyřídit poštu“. Svět je zatím ve vedení.",
        "Říkáš, že nejsi konformní. Přitom máš sedm stejně nonkonformních kamarádů a všichni si myslí, že jsou jediní.",
        "Tvůj největší sen: aby tě někdo pochopil. Tvůj největší strach: aby tě někdo pochopil úplně.",
      ],
      [ // úroveň 5
        "Vesmír tě zapsal do rejstříku jako „odchylku od normy“. Norma se kvůli tomu poprvé ohradila.",
        "Tvoje vynálezy se vystavují v Galaktickém muzeu zapomenutého budoucna. Návštěvnost: jedna kometa.",
        "Tvůj nápad se stal trendem. Okamžitě se z něj stěhuješ do vedlejší dimenze, protože ho už zná dav.",
        "Galaktický úřad pro individualitu tě eviduje jako výjimku, ke které se hlásí všichni. Úřad zvažuje zrušení výjimek.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přátelé tě mají rádi za nápady, nezávislost a za to, že s tebou je každá debata o vesmíru dobrodružství.",
        "Pro přátele máš po ruce studnici podivuhodných faktů. Jsou vděční a občas trochu zmatení.",
        "Dokážeš se spřátelit s kýmkoli. Od stařenky v tramvaji po robota z reklamy.",
        "Přátelé k tobě chodí pro neotřelý pohled. Odcházejí s novým úhlem a pocitem, že svět je větší.",
      ],
      [ // úroveň 2
        "Na srazu začneš debatu o budoucnosti lidstva. Ostatní by rádi začali debatu o jídle.",
        "Přátelé ti volají, když chtějí originální řešení. A taky když chtějí vědět, jestli ještě odpovídáš na zprávy.",
        "Přátelům radíš věci, které nikdy nezkusí. Ty je taky nezkusíš. Spravedlnost zůstává zachována.",
        "Odpovídáš ochotně a obsáhle. Obvykle ale na jinou otázku, než která padla.",
      ],
      [ // úroveň 3
        "Přátelé vědí, že když řekneš „možná“, znamená to „ne“. A když řekneš „určitě“, znamená to „možná“.",
        "Na sraz přicházíš pozdě. Z principu: čas je sociální konstrukt, ale stůl je rezervovaný na šest.",
        "Tvoje přátelství funguje jako sezónní festival: když přijde, je to zážitek. Když ne, nikdo neví, kdy se koná.",
        "Kamarádi tě chápou. Aspoň když jim dáš čas. Plus pár hodin na překlad.",
      ],
      [ // úroveň 4
        "Přátelům nabízíš hlubokou analýzu jejich problému. Mají pocit, že se přišli poradit, ne obhajovat disertaci.",
        "Kamarád se ti svěří s trápením a dostane přednášku o systémové chybě společnosti. Trápení zůstane.",
        "Když se přátelé hádají, vyhlašuješ neutralitu. Jako Švýcarsko, jen bez čokolády.",
        "Přátelé tě pozvou na oslavu. Ty přijdeš s dárkem, kterému nikdo nerozumí, a s vysvětlením, které nikdo nechce.",
      ],
      [ // úroveň 5
        "Přátelé o tobě vyprávějí jako o kometě: vrátíš se za sedmdesát let a zase s nápadem, který nikdo nechce.",
        "Mezigalaktická rada přátel tě vede jako „specialistu na komunikaci mimo atmosféru“. Obyčejné zprávy ti prý nejsou souzeny.",
        "Tvoje přátelství funguje jako radioteleskop: slyší vesmír, ale odpověď na zprávu přichází až v dalším tisíciletí.",
        "Neptun, Uran a Saturn tě společně přihlásili do kurzu „Jak dorazit na oslavu a zůstat do dortu“. Kurz běží třetí galaktický rok.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš originálně: třeba na střeše, v planetáriu nebo v lese s hvězdným atlasem.",
        "Dárek si vážíš nejvíc, když je vymyšlený. Ručně dělaný, vtipný a trochu divný.",
        "Největší radost máš z přání od lidí, kteří se vážně zamysleli. Ty se pak zamyslíš nad nimi.",
        "Tvoje oslava je plná zajímavých hostů, nápadů a rozhovorů. Dort je jen záminka.",
      ],
      [ // úroveň 2
        "Oslavu máš každý rok jiného typu. Hosté už zahodili očekávání a berou si jen zvědavost.",
        "Dárek ti nejde koupit. A pokud ano, tak jedině ten, který ti nikdo jiný nekoupí. Ideálně vynález.",
        "Při foukání svíček prohlásíš, že tradice jsou přežitek. Pak foukáš a přeješ si, aby to vyšlo.",
        "Přání od hostů čteš pozorně a s pobavením. Nejvíc tě těší ta, která jsou trochu divná.",
      ],
      [ // úroveň 3
        "Narozeniny prohlásíš za „sociální experiment“. Hosté mají pocit, že jsou v anketě, ne na oslavě.",
        "Na pozvánce stojí „oslava“. Realita je přednáška o budoucnosti, tři workshopy a dort ve tvaru atomu.",
        "Říkáš, že nechceš žádný dárek. Pak se tváříš překvapeně, že nikdo nevymyslel něco nového.",
        "Dort si objednáš v neobvyklém tvaru, aby nikdo neznal pravidla. Ty je ale taky neznáš.",
      ],
      [ // úroveň 4
        "Při narozeninách tě nejvíc štve, že všichni slaví stejně. Proto děláš oslavu o týden dřív. Nikdo nepřijde.",
        "Tvoje narozeninová party je tak originální, že hosté tuší, že jde vlastně o schůzku o udržitelnosti s dortem.",
        "Přání dostáváš ráno. Odpovídáš večer, anonymně, v obrazech. Přátelé už mají pocit, že jim posíláš tajné šifry.",
        "Oslava u tebe vypadá jako TED talk: úvod, závěr a v půlce tě někdo musí zastavit.",
      ],
      [ // úroveň 5
        "Uran ti k narozeninám věnoval jiný kalendář. V něm je každý den výjimka a oslava probíhá, ale nikdo neví kdy.",
        "Vesmírný dort ti dorazil v jiném tvaru, než byl objednaný. Ve tvaru, který zatím nemá název a porušuje dvě fyzikální konstanty.",
        "Galaxie ti zazpívala „Hodně štěstí“ v ultrazvuku. Slyšel ji jen delfín a ty. Každému zazněl jiný text.",
        "Vesmír ti poslal pozvánku na vlastní narozeniny. Termín: v nejbližší době, v jiném roce, v jiné dimenzi.",
      ],
    ],
  },
  s: [
    ["Revolučních nápadů", "47"],
    ["Dokončených revolucí", "0"],
    ["Konvenčních rozhodnutí letos", "1 (omylem)"],
    ["Citové dostupnosti", "Wi-Fi na horách"],
    ["Potřeby být jiný", "100 %"],
    ["Pravděpodobnost, že ti rozumí", "3 %"],
  ],
  d: [
    "Dnes dostaneš nápad, který změní svět. Do večera bude nahrazen jiným, ještě lepším.",
    "Uran dnes říká: buď sebou. Hvězdy se ptají, kterým z mnoha.",
    "Dnes ti někdo řekne, že jsi originál. Ty to pochopíš jako kompliment. A taky budeš mít pravdu.",
    "Dnešní konstelace: kreativita, odtažitost a jedna aplikace, kterou nikdo kromě tebe nezná.",
    "Dnes se rozhodneš nedělat nic konvenčního. Hvězdy ti doporučují nezačínat dnešním dnem.",
    "Dnes ti někdo navrhne spolupráci. Ty odpovíš „Možná.“ Možná znamená „Nikdy to neuděláme stejně.“",
    "Dnes budeš mít revoluční nápad na sobotní oběd. Do pondělí bude zapomenut.",
    "Dnešní tip: zkus se dnes zeptat, jak se někdo má. A pak poslouchej. Je to nová technologie.",
    "Dnes ti dojde, že se nikdo neptal, jestli o záchranu stojí. Zítra to zapomeneš.",
    "Dnes budeš někomu vysvětlovat, jak by se mělo žít. Bude ti to připadat jako služba lidstvu.",
    "Dnes narazíš na někoho podobného. Hvězdy to označí za „nežádoucí konkurenci“.",
    "Dnešní varování: pokud ti někdo řekne, že jsi „typický Vodnář“, nepanikař. Má pravdu.",
    "Dnes ti přijde, že s tím nápadem nikdo nepřišel dřív. Hvězdy ověří: přišli tři lidé a jedna kočka.",
    "Dneska odmítneš udělat něco, co dělají všichni. Pak zjistíš, že to odmítají dělat všichni, kdo odmítají.",
    "Dnes ti někdo pošle gif. Ty odpovíš esejem. Hvězdy tomu říkají asymetrická reakce.",
    "Dnes se zeptáš sebe, kdo vlastně jsi. Odpověď se zatím nenašla. Aspoň bude o čem mluvit u večeře.",
    "Dnes přijde chvíle, kdy se tě někdo zeptá na jasnou odpověď. Řekneš: „To záleží.“ A budeš mít radost.",
    "Dnes ti dojde nápad, který by změnil svět. Do oběda se změní jen tvoje pozornost.",
    "Dneska uvidíš něco krásného na obloze. Hvězdy tě vezmou na vědomí, jakmile přestaneš vysvětlovat.",
    "Dnes ti někdo řekne „to je divné“. Vezmeš to jako medaili a budeš ji nosit celý den.",
    "Dnes se pokusíš o nezávislý den. Hvězdy sledují, jestli nezavoláš kamarádovi do deseti minut.",
    "Dnes tě osloví cizí člověk a ty mu za čtyři minuty vysvětlíš stav světa. Bude to jeho nejzajímavější úterý.",
    "Dnešní horoskop: nápad, zvědavost a drobná sociální nedostupnost. Doporučená dávka: celý den.",
    "Dnes se rozhodneš všechno přepracovat. Do večera zvítězí ta původní verze. Tvoje nová je jen druhá nejlepší.",
  ],
  q: [
    "Pojďme někam, kde ještě nikdo není. Pokud je plno, přijdeme později. Nebo vůbec.",
    "Víkend? Dva workshopy, jedna přednáška o budoucnosti a večer experiment s obývákem. Pojď.",
    "Odpovím. Nebo se na tu otázku podívám z jiného úhlu. Nebo ji zrušíme. Podle nálady.",
    "Nádobí je sociální konstrukt. Ale dobře, umyju to. Pouze ale podle vlastního systému.",
    "Do země, která zatím nemá turistiku. Nebo která ji ještě nezvládla vynalézt.",
    "Dokument o zapomenutém vynálezci. Nebo cokoli, co nikdo nezná. Mainstream si nechám na jindy.",
  ],
};

export default vodnar;
