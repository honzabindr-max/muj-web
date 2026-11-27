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
      "Vodnář: originální, nezávislý a místy na jiné planetě. Návštěvy jsou vítané.",
      "Vodnář vymyslí věci, které budou za deset let normální. Zatím jsou jen báječně divné.",
      "Zvědavost máš takovou, že se u tebe z obyčejné otázky stanou tři hodiny povídání.",
    ],
    [
      "Vodnář je jiný než všichni ostatní. Úplně stejně jako všichni ostatní Vodnáři.",
      "Máš 47 revolučních nápadů. Čtyřicátý osmý by byl dotáhnout aspoň jeden.",
      "Když řekneš „já to dělám jinak“, ostatní vědí, že ten postup nezopakuje nikdo. Ani ty.",
    ],
    [
      "Vodnář chce změnit svět. Zatím u přeskládání knihovny, která se mění každý týden.",
      "Máš nezávislý názor na všechno. Nejsilnější na to, co ti dnes ráno vysvětlilo jedno video.",
      "Tvoje názory jsou tak pokrokové, že je za dva roky budeš chtít vyměnit za pokrokovější.",
    ],
    [
      "Slovo „blízkost“ ti zní jako cizí jazyk. Rozumíš, ale mluvit odmítáš.",
      "Vodnář nechodí s davem. Stojí na vedlejší louce a tvrdí, že je tam lepší výhled.",
      "Když řekneš „udělám to po svém“, tým si potichu zálohuje data.",
    ],
    [
      "Uran s tebou přerušil spojení. Prý jsi „příliš originální i na něj“.",
      "Vesmír tě vede jako „jediný exemplář“. Fyzika kvůli tobě zavedla výjimku.",
      "Tvoje myšlenky opustily sluneční soustavu. Posílají pohlednice a žádají víc prostoru.",
    ],
  ],
  c: [
    [
      "Vidíš věci z úhlu, na který nikdo nepomyslel. Ostatní to zjistí za pět let a řeknou, že to bylo jasné.",
      "Snít o lepším světě umí každý. Ty k němu máš návod, schéma a seznam, co koupit v železářství.",
    ],
    [
      "Oblíbená věta: „Dá se to dělat jinak.“ Nikdo se neptal jak, ale všichni čekají.",
      "Nikdo neví, co uděláš. Ty taky ne, a proto je to tak napínavé.",
    ],
    [
      "Nikomu se nepodřizuješ. Jen té myšlence, že se nikomu nepodřizuješ.",
      "Tvůj humor se vyplatí až příští generaci. A možná ani té.",
    ],
    [
      "Když ti někdo řekne „mám tě rád“, odpovíš „zajímavé“ a přidáš poznámku pod čarou. Ten dotyčný ji čte celý týden.",
      "Revoluce probíhá. Zatím ve fázi poznámky v mobilu s názvem „NÁPAD finální 2 (nepoužívat)“.",
    ],
    [
      "Vesmír se tě pokusil napravit. Dostal odpověď „Já jsem originál“ a stáhl se do vedlejší galaxie.",
      "Uran tě nabídl sousední galaxii jako dárek. Vrátili tě s poznámkou „nelze zabalit“.",
    ],
  ],
  v: [
    [
      "Jiskra, která občas zapomene, že ji vidí i ostatní. Neboj, stojí za to.",
      "Řekni jeden nápad nahlas. Svět poslouchá víc, než myslíš.",
    ],
    [
      "Dokonči jeden ze čtyřiceti sedmi nápadů. Pak teprve začni čtyřicátý osmý.",
      "Svobodomyslný, nezávislý, nepostradatelný. A od úterý bez signálu.",
    ],
    [
      "Tvoje myšlenky předběhly dobu. Doba se zatím nepřihlásila a nemá ani e-mail.",
      "Zkus někoho obejmout. Nemusí to změnit světový řád, stačí obyčejný pátek.",
    ],
    [
      "Originalita ti vychází tak dokonale, že ji nikdo neumí okopírovat. Ani nechce.",
      "Spoj se někdy s davem. Jen pro zajímavost. Mají tam dobrou svačinu.",
    ],
    [
      "Verdikt vesmíru: svět ještě není připraven. Nápad byl odložen na další velký třesk.",
      "Rozsudek: jedna konvenční věc ročně. Doporučeno: jít na oběd, kam chodí všichni, a dát si totéž.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce jsi originální. S tebou partner nezažije nudu a dostane nápady, které nikde jinde nedostane.",
        "Tvoje vztahy mají prostor, kde se dá povídat o všem, od vesmíru po úterní oběd.",
        "S tebou partner zažije něco nového už u první kávy. Třeba kavárnu s motivem černých děr.",
        "Partner je u tebe zároveň kamarád, spoluhráč a spoluobjevitel. Poslední titul je na plný úvazek.",
      ],
      [ // úroveň 2
        "V lásce chceš spojení bez omezení. Partner by uvítal aspoň omezení typu „v sedm jsi doma“.",
        "Na rande přijdeš s tématem, ne s kyticí. Téma bývá robotika, svoboda nebo budoucnost kávy.",
        "Partnera zasypeš nápady, jak zlepšit váš vztah. Partner by rád věděl jen to, jestli zítra přijdeš na večeři.",
        "Říkáš „potřebuju prostor“. Prostor je tak velký, že se v něm ztratí i pozvánka na víkend.",
      ],
      [ // úroveň 3
        "Váš vztah je ve zkušebním provozu. Beta verze běží čtvrtý rok a partner hlásí chyby.",
        "Na „miluju tě“ odpovídáš „zajímavé téma“. Partner to bere jako vyznání. Taky je to jediné, co dostane.",
        "Emoce zpracováváš jako jazykový kurz: v teorii skvěle, v praxi se ptáš, jestli to jde přeložit.",
        "Tvoje „jsem tu pro tebe“ platí, dokud se neozve nový projekt. Pak je to „jsem tu pro budoucnost“.",
      ],
      [ // úroveň 4
        "Partner tě studuje jako vzdálenou sondu: signál chodí občas, bez překladu a vždycky ve špatnou chvíli.",
        "Při hádce řekneš „emoce jsou neefektivní“. Partner odpoví „tak odejdu efektivně“ a už balí.",
        "Výročí ti vypadne z hlavy. Datum zatmění Měsíce ale znáš na minutu a partner to ví.",
        "Na rozhovor o citech si žádáš podklady předem. Partner pošle dvě stránky. Odpovíš, že ti chybí zdroje.",
      ],
      [ // úroveň 5
        "Kupid tě označil za „nelokalizovatelný cíl“. Šíp se vrátil se vzkazem: „Zkuste to na Uranu.“",
        "Tvoje srdce má vlastní oběžnou dráhu. Partner vysílá, ale zpráva se vrací s razítkem „příjemce mimo galaxii“.",
        "Vesmírný registr vztahů tě vede jako „spojení probíhá, ale s jinou částí vesmíru“.",
        "Kdyby tvůj vztah byl planeta, byla by neobydlená a v katalogu vedená jako „Teoreticky možný život“.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci jsi zdroj nápadů. Porada bez tebe by byla stejná jako ta minulá, a to nikdo nechce.",
        "Máš dar vidět, jak by to šlo udělat jinak. Často i líp, což tým občas překvapí.",
        "S tebou se na poradě nápady rodí. Z místnosti se odchází s deseti směry a pocitem, že tým je budoucnost.",
        "Tvoje zvědavost posouvá firmu k novým věcem. I když se tomu říká „zase něco nového“.",
      ],
      [ // úroveň 2
        "Máš nápad, jak vylepšit každý proces. Hlavně ty, které právě běží a fungují.",
        "Poradu bereš jako příležitost přepsat agendu. Kolegové jako příležitost podívat se na hodinky.",
        "Do práce chodíš jako host: zajímavý, vtipný a s plánem, který se mění po každé kávě.",
        "Hierarchie tě nezajímá. Šéfa i stážistu oslovuješ stejně. Oba pak doufají, že ne naposled.",
      ],
      [ // úroveň 3
        "Prosazuješ plochou hierarchii. Zatím jen v tom smyslu, že si nikdo nepamatuje, kdo je tvůj šéf.",
        "Pracovní postup máš vlastní. Kolegové mu nerozumí, výsledky chodí. Někdy ve čtvrtek, někdy v jiné realitě.",
        "Tvoje „uděláme to jinak“ je věta, po které IT oddělení tiše zavře dveře.",
        "Chceš pracovat na dálku, bez budíku a bez šéfa. Ideálně i bez úkolů.",
      ],
      [ // úroveň 4
        "Každé pondělí navrhneš revoluci. V pátek je z ní prezentace, kterou už nikdo neotevře.",
        "Máš pět rozdělaných projektů a tvrdíš, že spolu souvisí. Jediné, co je spojuje, je nedokončenost.",
        "Na poradu přijdeš s radikálním návrhem. Na další s úplně opačným radikálním návrhem.",
        "Podpis pod e-mailem: „Nezávislý myslitel“. Kolegové si ho překládají jako „nedostupný, ale s citáty“.",
      ],
      [ // úroveň 5
        "NASA označila tvoje nápady za „příliš vzdálené realitě i pro vesmírný výzkum“. Teď je nabízí Marsu.",
        "Porada v tvé galaxii: osm účastníků, devět nápadů a jedna výzva zrušit všechno. Ta výzva jsi ty.",
        "Uran ti zřídil pracovní pozici „Hlavní narušitel“. Odměna: nápady. Benefit: nulová gravitace.",
        "Kdyby firma zavedla všechny tvoje nápady, musel by se přepsat vesmír. Právní oddělení Galaxie už podalo preventivní odvolání.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Žiješ po svém a tím dáváš odvahu ostatním, aby byli aspoň trochu jiní.",
        "Zvědavost nemá hranice. Nadchneš se pro vynález i pro zapomenutou městskou knihovnu.",
        "V hlavě máš mapu budoucnosti, kterou ostatní teprve kreslí. Je barevná a má legendu.",
        "Svoboda je tvoje přirozená hodnota. U tebe se ostatní učí, že být sám sebou není luxus.",
      ],
      [ // úroveň 2
        "Čas plyne pro tebe jinak. Naštěstí máš hodinky, které s tebou souhlasí.",
        "Konvence bereš jako doporučení. Přečteš si je obvykle až po porušení.",
        "Zajímá tě všechno: vesmír, politika, technika, smysl života. Úklid se ztratí mezi tématy.",
        "Na „kdy to dokončíš?“ odpovídáš: „To je zajímavá otázka.“ A odcházíš za novým nápadem.",
      ],
      [ // úroveň 3
        "Jsi proti hlavnímu proudu. Jakmile se hlavní proud přesune k tobě, okamžitě se stěhuješ.",
        "Chceš zachránit svět. Frontu v obchodě zatím zvládáš hůř, ale plán na záchranu světa je hotový.",
        "Technologii miluješ, dokud ji nepoužívají všichni. Pak najednou objevíš kouzlo papírové mapy.",
        "Tvrdíš, že nesleduješ trendy. Jenže máš vlastní trend, který nikdo nesleduje, a ty ho vedeš.",
      ],
      [ // úroveň 4
        "Tvůj život je beta verze, která nikdy nevyjde. Pořád v ní je něco, co se dá vylepšit nebo zahodit.",
        "Na seznamu cílů máš „změnit svět“ a „vyřídit poštu“. Svět je zatím ve vedení.",
        "Říkáš, že nejsi konformní. Máš sedm stejně nonkonformních kamarádů a každý si myslí, že je jediný.",
        "Největší sen: aby tě někdo pochopil. Největší strach: aby tě někdo pochopil úplně.",
      ],
      [ // úroveň 5
        "Vesmír tě zapsal do rejstříku jako „odchylku od normy“. Norma se kvůli tomu poprvé ohradila.",
        "Tvoje vynálezy jsou vystavené v Galaktickém muzeu zapomenuté budoucnosti. Návštěvnost: jedna kometa.",
        "Tvůj nápad se stal trendem. Okamžitě se z něj stěhuješ do vedlejší dimenze, protože ho už zná dav.",
        "Galaktický úřad pro individualitu tě eviduje jako výjimku, ke které se hlásí všichni. Úřad zvažuje zrušení výjimek.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přátelé tě mají rádi za nápady, nezávislost a debaty o vesmíru, které končí až po půlnoci.",
        "Pro přátele máš studnici podivuhodných faktů. Jsou vděční a občas trochu zmatení.",
        "Spřátelíš se s kýmkoli. Od paní v tramvaji po robota z reklamy.",
        "K tobě se chodí pro neotřelý pohled. Odchází se s novým úhlem a pocitem, že svět je větší.",
      ],
      [ // úroveň 2
        "Na srazu zahájíš debatu o budoucnosti lidstva. Ostatní by radši debatovali o jídle.",
        "Přátelé ti volají, když chtějí originální řešení. A taky když chtějí vědět, jestli ještě odpovídáš na zprávy.",
        "Přátelům radíš věci, které nikdy nezkusí. Ty je taky nezkusíš. Spravedlnost zůstává zachována.",
        "Odpovídáš ochotně a obsáhle. Obvykle na jinou otázku, než která padla.",
      ],
      [ // úroveň 3
        "Přátelé vědí, že tvoje „možná“ znamená „ne“. A tvoje „určitě“ znamená „možná“.",
        "Na sraz chodíš pozdě. Z principu: čas je společenská konstrukce, ale stůl je rezervovaný na šest.",
        "Tvoje přátelství funguje jako sezónní festival: když přijde, je to zážitek. Jinak nikdo neví, kdy se koná.",
        "Kamarádi tě chápou. Aspoň když jim dáš čas. Plus pár hodin na překlad.",
      ],
      [ // úroveň 4
        "Kamarádovi nabídneš hlubokou analýzu jeho problému. Chtěl si jen postěžovat, ale dostal obhajobu disertace.",
        "Kamarád se ti svěří s trápením a dostane přednášku o systémové chybě společnosti. Trápení zůstane.",
        "Když se přátelé hádají, vyhlásíš neutralitu. Jako Švýcarsko, jen bez čokolády.",
        "Přijdeš na oslavu s dárkem, kterému nikdo nerozumí, a s vysvětlením, o které nikdo nestál.",
      ],
      [ // úroveň 5
        "Přátelé o tobě vyprávějí jako o kometě: vrátíš se za sedmdesát let a zase s nápadem, který nikdo nechce.",
        "Mezigalaktická rada přátel tě vede jako „specialistu na komunikaci mimo atmosféru“. Obyčejné zprávy ti prý nejsou souzeny.",
        "Tvoje přátelství funguje jako radioteleskop: slyší vesmír, ale odpověď na zprávu dorazí až v dalším tisíciletí.",
        "Neptun, Uran a Saturn tě společně přihlásili na kurz „Jak dorazit na oslavu a zůstat do dortu“. Kurz běží třetím rokem.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš originálně: na střeše, v planetáriu nebo v lese s hvězdným atlasem.",
        "Nejvíc si vážíš dárků, které někdo vymyslel. Ručně dělaných, vtipných a trochu divných.",
        "Největší radost máš z přání od lidí, kteří se opravdu zamysleli. Ty se pak zamyslíš nad nimi.",
        "Tvoje oslava je plná zajímavých hostů, nápadů a rozhovorů. Dort je jen záminka.",
      ],
      [ // úroveň 2
        "Oslavu máš každý rok jiného typu. Hosté už zahodili očekávání a berou si jen zvědavost.",
        "Dárek ti nejde koupit. A když ano, tak jedině takový, který ti nikdo jiný nekoupí. Ideálně vynález.",
        "Při foukání svíček prohlásíš, že tradice jsou přežitek. Pak sfoukneš a přeješ si, aby to vyšlo.",
        "Přání od hostů čteš pozorně a s pobavením. Nejvíc tě těší ta, která jsou trochu divná.",
      ],
      [ // úroveň 3
        "Narozeniny prohlásíš za „sociální experiment“. Hosté mají pocit, že jsou v anketě, ne na oslavě.",
        "Na pozvánce stojí „oslava“. Realita je přednáška o budoucnosti, tři kurzy a dort ve tvaru atomu.",
        "Říkáš, že nechceš žádný dárek. Pak se tváříš překvapeně, že nikdo nevymyslel nic nového.",
        "Dort si objednáš v neobvyklém tvaru, aby nikdo neznal pravidla. Ty je ale taky neznáš.",
      ],
      [ // úroveň 4
        "Nejvíc tě na narozeninách štve, že všichni slaví stejně. Proto oslavu děláš o týden dřív. Nikdo nepřijde.",
        "Tvoje narozeninová oslava je tak originální, že hosté tuší, že jde vlastně o schůzku o udržitelnosti s dortem.",
        "Přání dostáváš ráno. Odpovídáš večer, anonymně, v obrazech. Přátelé už mají pocit, že jim posíláš tajné šifry.",
        "Oslava u tebe vypadá jako přednáška v planetáriu: úvod, závěr a v půlce tě někdo musí zastavit.",
      ],
      [ // úroveň 5
        "Uran ti k narozeninám věnoval jiný kalendář. V něm je každý den výjimka a oslava probíhá, ale nikdo neví kdy.",
        "Vesmírný dort dorazil v jiném tvaru, než byl objednaný. Ve tvaru, který zatím nemá název a porušuje dvě fyzikální konstanty.",
        "Galaxie ti zazpívala „Hodně štěstí“ v ultrazvuku. Slyšel ji jen delfín a ty. Každému zazněl jiný text.",
        "Vesmír ti poslal pozvánku na vlastní narozeniny. Termín: v nejbližší době, v jiném roce, v jiné dimenzi.",
      ],
    ],
  },
  s: [
    ["Revolučních nápadů", "47"],
    ["Dokončených revolucí", "0"],
    ["Konvenčních rozhodnutí letos", "1 (omylem)"],
    ["Citový signál", "jako Wi-Fi na chatě"],
    ["Potřeba být jiný", "100 %"],
    ["Pravděpodobnost, že ti rozumí", "3 %"],
  ],
  d: [
    "Dnes dostaneš nápad, který změní svět. Do večera ho nahradí jiný, ještě lepší.",
    "Dnes ti někdo řekne, že vypadáš jinak než ostatní. Vezmeš to jako kompliment. Říká to každému Vodnáři.",
    "Dnes ti někdo řekne, že máš originální názor. Zjistíš, že to byl cizí citát z podcastu.",
    "Dnešní konstelace: kreativita, odtažitost a jedna aplikace, kterou kromě tebe nezná nikdo.",
    "Dnes se rozhodneš nedělat nic konvenčního. Hvězdy doporučují nezačínat dnešním dnem.",
    "Dnes ti někdo navrhne spolupráci. Odpovíš „možná“. Možná znamená „nikdy to neuděláme stejně“.",
    "Dnes budeš mít revoluční nápad na sobotní oběd. V pondělí o něm nebudeš vědět.",
    "Dnešní tip: zeptej se někoho, jak se má. A pak poslouchej. Je to nová technologie.",
    "Dnes ti dojde, že se nikdo neptal, jestli o záchranu světa stojí. Zítra na to zapomeneš.",
    "Dnes budeš někomu vysvětlovat, jak by se mělo žít. Bude ti to připadat jako služba lidstvu.",
    "Dnes narazíš na někoho podobného. Hvězdy to označí za „nežádoucí konkurenci“.",
    "Dnes ti někdo řekne „typický Vodnář“. Neprotestuj, má pravdu.",
    "Dnes tě napadne, že s tím nápadem nikdo dřív nepřišel. Hvězdy ověří: přišli tři lidé a jedna kočka.",
    "Dneska odmítneš udělat to, co dělají všichni. Pak zjistíš, že to samé odmítají všichni, co odmítají.",
    "Dnes ti někdo pošle obrázek. Ty odpovíš esejem. Hvězdy tomu říkají asymetrická odpověď.",
    "Dnes se zeptáš sebe, kdo vlastně jsi. Odpověď se zatím nenašla. Aspoň bude o čem mluvit u večeře.",
    "Dnes se tě někdo zeptá na jasnou odpověď. Řekneš: „To záleží.“ A budeš mít radost.",
    "Dnes ti dojde nápad, který by změnil svět. Do oběda se změní jen tvoje pozornost.",
    "Dneska uvidíš něco krásného na obloze. Hvězdy tě vezmou na vědomí, jakmile přestaneš vysvětlovat.",
    "Dnes ti někdo řekne „to je divné“. Vezmeš to jako medaili a budeš ji nosit celý den.",
    "Dnes zkusíš nezávislý den. Hvězdy sledují, jestli nezavoláš kamarádovi do deseti minut.",
    "Dnes tě osloví cizí člověk a ty mu za čtyři minuty vysvětlíš stav světa. Bude to jeho nejzajímavější úterý.",
    "Dnešní horoskop: nápad, zvědavost a drobná sociální nedostupnost. Doporučená dávka: celý den.",
    "Dnes se rozhodneš všechno přepracovat. Do večera zvítězí původní verze. Ta nová je jen druhá nejlepší.",
  ],
  q: [
    "Pojďme někam, kde ještě nikdo není. Je-li plno, přijdeme později. Nebo vůbec.",
    "Víkend? Dva kurzy, přednáška o budoucnosti a večer experiment s obývákem. Pojď.",
    "Odpovím zítra. Nebo tu otázku přepíšu na jinou, která se mi líbí víc.",
    "Nádobí je společenská konstrukce. Ale dobře, umyju ho. Podle vlastního systému, který ti nevysvětlím.",
    "Do země, která zatím nemá turisty. Nebo aspoň nemá cedule.",
    "Dokument o zapomenutém vynálezci. Cokoli, co nikdo nezná. Slavné filmy si nechám na jindy.",
  ],
};

export default vodnar;
