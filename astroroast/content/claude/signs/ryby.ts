// AstroRoast.ai: knihovna humoru, znamení ryby. Ručně psané originální české fragmenty.
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

const ryby: RawSign = {
  h: [
    [
      "Ryby: snílek s citlivým srdcem a kapesníkem pro každou příležitost.",
      "Ryby vidí svět krásněji, než je. Hvězdy jim to nechávají, protože to funguje.",
      "Máš soucit s každým a úsměv pro všechny. Svět je u tebe o trochu měkčí.",
    ],
    [
      "Ryby jsou vždy na cestě. Jen nikdo neví kam. Ty to zjistíš nejdřív za týden.",
      "Říkáš „budu tam za chvilku“ a ve své hlavě už jedeš. Realita zatím hledá boty.",
      "Představivost máš tak bohatou, že občas nevíš, která verze příběhu byla ta pravdivá.",
    ],
    [
      "Ryby plynou. S proudem, proti proudu, někdy úplně mimo řeku. Mapa zatím nedorazila.",
      "Máš sen. Vlastně pět. A ve snu už plánuješ další.",
      "Tvůj kalendář vypadá jako akvarel: krásné, rozmazané a těžko čitelné.",
    ],
    [
      "Ryby jsou mistři útěku od reality. Máš na to permanentku s neomezenou platností.",
      "Slovo „realita“ píšeš v uvozovkách a mluvíš o něm jako o vzdáleném příbuzném.",
      "Tvoje paměť je výběrová jako dobrý příběh: drží jen to, co se hodí do filmu.",
    ],
    [
      "Neptun se otočil: „Nic ti nezazlívám. Jen přestaň posílat pohlednice z oblaků.“",
      "Vesmír tě poslal na úřad pro vyřizování snů. Úředník spí. Vlastně sní.",
      "Tvoje představivost spadla do černé díry. Vesmír tvrdí, že je to ta nejhezčí část galaxie.",
    ],
  ],
  c: [
    [
      "Cítíš to, co ostatní zamlčují. Ryby jsou jako dobrá hudba: nic neříkají a všechno je jasné.",
      "Máš dar vidět krásu i tam, kde ostatní vidí jen úterý.",
    ],
    [
      "Pro tebe neplatí „kolik je hodin“. Platí „jaká je nálada okolo“.",
      "Plány děláš s láskou. A pak je necháš na lavičce v parku.",
    ],
    [
      "Neumíš říct ne. Hvězdy to vidí tak, že jsi dobrovolník na všechno, včetně věcí, které neexistují.",
      "Ztrácíš věci rychleji, než je stihneš najít. Hvězdy doporučují jednu poličku a zázrak.",
    ],
    [
      "Tvoje zpoždění není nespolehlivost. Je to umělecký záměr, který zatím nikdo nepochopil.",
      "Když se zeptáš sebe „Co chci?“, odpověď se ztratí někde mezi oblaky a zmrzlinou.",
    ],
    [
      "Neptunova hluboká voda tě pozvala na plavbu snů. Lístek máš, jen ho zase hledáš.",
      "Vesmír tě poslal do reality. Po dvou minutách přišel vzkaz: „Není to ono.“",
    ],
  ],
  v: [
    [
      "Verdikt: srdce jako oceán a hlava v oblacích. Nádherná kombinace.",
      "Hvězdy radí: nech si něco zdát. Jen si to zapiš, než to odpluje.",
    ],
    [
      "Rada hvězd: občas se probuď. Aspoň na oběd a na poštu.",
      "Verdikt: jemnost, laskavost a úplná neorientovanost. To se hodí na dobré příběhy.",
    ],
    [
      "Verdikt: tvoje intuice je skvělá. Tvoje orientace v čase je poezie.",
      "Rada: napiš si, kde je klíč. A pak si napiš, kde je ta poznámka.",
    ],
    [
      "Verdikt: zdržuješ ostatní, protože ve světě vidíš víc, než tam je. Aspoň je tam hezky.",
      "Rada hvězd: občas zkus realitu. Je zdarma a někdy překvapivě dobrá.",
    ],
    [
      "Verdikt vesmíru: odložit, rozplynout se v mlze. Ale šťastně.",
      "Rozsudek: povinné jedno rozhodnutí do konce týdne. Hvězdy budou čekat. Dlouho.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce máš romantickou duši. Partner se s tebou cítí jako ve filmu, ve kterém hraje hlavní roli.",
        "Umíš naslouchat tak, že se partner rozpovídá i o věcech, které zůstávaly nevyslovené.",
        "Tvoje city jsou hluboké jako oceán. Partner v nich rád pluje a nikdy nezná dno.",
        "Do vztahu vnášíš něhu, hudbu a drobné vzkazy na lístečcích. Partner je schovává jako poklad.",
      ],
      [ // úroveň 2
        "Při romantické scéně pláčeš dřív než hlavní hrdinka. Partner ti s úsměvem podává kapesník.",
        "V lásce vidíš to nejlepší. I tam, kde zrovna nic není. Partner doufá, že to mínění vydrží.",
        "Randit s tebou je poezie: krásné, dojemné a občas se zapomene, kde je restaurace.",
        "Vztah bereš jako píseň. Partner by občas uvítal i text s pokyny.",
      ],
      [ // úroveň 3
        "Zamiluješ se do představy a pak se divíš, že skutečný člověk neumí číst myšlenky ani zpívat.",
        "Říkáš „vůbec nevadí“ s tak hlubokým povzdechem, že partner ví, že vadí. Hodně.",
        "Odpouštíš rychle. Hlavně proto, že už nevíš, za co.",
        "Máš naivní víru, že se vztah spraví sám, třeba pod hvězdami. Hvězdy se k tomu zatím nehlásí.",
      ],
      [ // úroveň 4
        "Partnera máš ve dvou verzích: ideální z tvé hlavy a skutečný z obýváku. Pořád porovnáváš. Skutečný prohrává.",
        "Tvoje „musíme si promluvit“ trvá tři hodiny, obsahuje pět metafor a končí otázkou, co bude k večeři.",
        "Rozchod prožíváš jako film, kde jsi režie, kamera i hlavní role. Natáčení se protáhlo o dva roky.",
        "Partner se zeptá, co se děje. Odpovíš „nic“. Pak následuje čtyřicet minut tichého vzdychání a tři písně.",
      ],
      [ // úroveň 5
        "Kupid zamířil, ale tvoje srdce se rozplynulo v mlhovině. Šíp proletěl a skončil v Neptunu.",
        "Venuše ti poslala vzkaz: „Přestaň psát básně pro někoho, kdo ti odpověděl smajlíkem.“",
        "Tvoje city jsou tak hluboké, že se kolem nich vytvořil vlastní oceán. Námořnictvo vesmíru ho vede jako neprozkoumanou oblast.",
        "Kdyby tvoje romantika měla gravitaci, kolem tvého srdce by kroužily všechny nedoručené básně a nedopsané dopisy.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci máš tvořivý tok. Nápady z tebe plynou a kolegové se u nich zahřívají.",
        "Kolegové se na tebe obracejí, když potřebují porozumění. Máš dar vycítit, co se děje pod povrchem.",
        "Pracovní den začínáš s úsměvem a hlavou plnou možností. Šéf to bere jako příjemný bonus.",
        "Tvoje empatie dělá z týmu rodinu. Ten typ, kde se dort sdílí a konflikty se rozplývají u kávy.",
      ],
      [ // úroveň 2
        "Do práce přicházíš s hlavou v oblacích. Ve čtvrtek ji zpravidla stáhneš aspoň na kávu.",
        "Schůzky bereš jako příběhy. Hodně vnímáš a málo si pamatuješ, co se vlastně má dělat.",
        "Když se ptají „stihneš to do pátku?“, odpovíš „určitě“. A v duchu už píšeš omluvu.",
        "Pracovní stůl vypadá jako malá galerie: poznámky, hrnky, nápady a jedna zapomenutá svačina.",
      ],
      [ // úroveň 3
        "Zpoždění máš jako uměleckou zakázku: každý den s jiným výrazem, ale stejnou omluvou.",
        "Tvoje „ještě to doladím“ platí, dokud ti někdo nevezme text z rukou. Pak ho obejmeš a pustíš.",
        "Termíny jsou pro tebe jako vlny: přicházejí, odcházejí a ty se jim při tom krásně usmíváš.",
        "Říkáš „ano“ na každý úkol. Pak se tiše divíš, že ti pondělí trvá do pátku.",
      ],
      [ // úroveň 4
        "Tvoje pracovní postupy působí jako sen: krásné, nelogické a na konci nikdo neví, co se stalo.",
        "Z porady s tebou odchází každý s jiným závěrem. Ty odcházíš s dojmem, že se všichni shodli.",
        "Deadline slyšíš jako vzdálenou hudbu: hezká, ale nijak se tě netýká. Do chvíle, než přijde hlasitá verze.",
        "Šéf říká „potřebuju to dnes“. Ty slyšíš „zítra, možná, kdyby se na to hodila nálada“.",
      ],
      [ // úroveň 5
        "NASA se pokusila sledovat tvoje pracovní postupy. Satelity hlásily mlhovinu s ojedinělými záblesky produktivity.",
        "Tvůj e-mail se ztratil v mezihvězdném prostoru. Odpověď přišla za devadesát let a byla krásná.",
        "Úředník Galaktické pošty našel tvůj úkol v jiné dimenzi. Je hotový. Jen ho nikdo neodeslal, ani ty.",
        "Vesmír ti dal pracovní pozici „Snílek“. Náplň: koukat z okna a občas říct něco geniálního. Plníš ji se ctí.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Žiješ srdcem. Ostatní díky tobě vnímají barvy, které si dřív ani neuvědomovali.",
        "Vnímáš svět citlivěji než většina. Slyšíš tóny tam, kde ostatní slyší jen hluk.",
        "Tvoje představivost je zdroj tvého života. Plný pohádek, hudby a drobných zázraků.",
        "Máš dar proměnit všední moment v malý příběh. Přátelé chtějí, ať vyprávíš dál.",
      ],
      [ // úroveň 2
        "Život ti připadá jako krásná hudba, jen občas v jiné tónině než ostatním. Zato s dojemným refrénem.",
        "Klíče, telefon a nabíječka vedou vlastní tajný život. Scházejí se v místech, kam nikdy nechodíš.",
        "Plány děláš nadšeně. Na lístku. Který zmizí dřív, než se na něj podíváš.",
        "Zapomínáš na věci, ale pamatuješ si pocity. Hvězdy říkají, že je to lepší vybavení.",
      ],
      [ // úroveň 3
        "Žiješ v mlze, které říkáš „výhled do budoucnosti“. Kdyby se dala sdílet, byla by hit.",
        "Říkáš, že stres nesnášíš. Přitom ho spolehlivě vyvoláváš tím, že věci ztrácíš na dokonale zvolených místech.",
        "Realitu přijímáš jen v malých dávkách. Doporučená denní dávka: pět minut. Víc by přerušilo snění.",
        "Intuice ti říká, kudy jít. Navigace říká něco jiného. Vítězí ta, která zní poeticky.",
      ],
      [ // úroveň 4
        "Rozhodování o večeři ti trvá dvě hodiny. Dvanáct možností, tři nálady a nakonec rohlík, který tam byl od začátku.",
        "Tvoje „zítra se do toho pustím“ je tak pevné, že už má vlastní kalendář. Dnes je v něm dvanáctý pokus.",
        "Co se dělo včera? Nevíš. Ale pocit je hezký.",
        "Tvoje vzpomínky jsou ve filtru nostalgie. I zpožděný vlak z loňska vypadá jako romantický výlet.",
      ],
      [ // úroveň 5
        "Vesmír pro tebe zřídil zónu reality. Zůstala prázdná. Zabrala ji představivost.",
        "Tvoje denní snění vytváří paralelní vesmíry. Vědci už evidují čtyřicet jedna. V devíti se dá rezervovat večeře.",
        "Černá díra zkusila pohltit tvoji pozornost. Vrátila se prázdná: pozornost byla už dávno v oblacích.",
        "Vesmír je plný zázraků a ty vnímáš všechny. Žádný z nich ale nestihneš odevzdat včas.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přátelé k tobě chodí s bolestí i radostí. Víš, kdy mlčet, kdy obejmout a kdy poslat něco sladkého.",
        "Tvoje přátelství je jako teplá deka: měkké, bezpečné a vždy po ruce.",
        "Přátelé vědí, že u tebe najdou pochopení. Občas i kafe a pár slz soucitu zdarma.",
        "Pamatuješ si, co přátelům dělá radost. I když zapomínáš, kde máš klíče.",
      ],
      [ // úroveň 2
        "Když se ti kamarád svěří, pláčeš s ním. Obvykle dřív než on. A často víc.",
        "Přátelé ti volají, když potřebují naslouchání. Ty ho dáváš i tam, kde se spí.",
        "Na srazy chodíš s dobrým úmyslem a s telefonem na nule. Dorazíš, jakmile se najde nabíječka a cesta.",
        "Pozvánku přijmeš vždycky. Že dorazíš, to je jiný příběh. Ale ten bude krásný.",
      ],
      [ // úroveň 3
        "Slibuješ, že přijdeš. Dorazíš, až už ostatní vyprávějí historky z konce večera.",
        "Každému radíš, ať si jde za svým snem. Ten tvůj leží v šuplíku vedle klíčů, které nikdo nenajde.",
        "Přátelé vědí, že „zavolám zpátky“ u tebe znamená: nejpozději příští měsíc. Možná.",
        "Nedokážeš odmítnout žádnou pomoc. Přátelé už zjistili, že se můžou zeptat na cokoliv. Hlavně v neděli ráno.",
      ],
      [ // úroveň 4
        "Půjčené věci vracíš v jiném roce, jiném stavu a občas v jiné barvě. Přátelé na to mají speciální kolonku.",
        "Slíbíš, že pomůžeš se stěhováním. Dorazíš, až bude byt zařízený a kočka zabydlená.",
        "Tvoje zprávy začínají „Ahoj, promiň, že se ozývám až teď“. Čtou je lidé, kteří si ten úvod už pamatují.",
        "Kamarádům radíš vždycky něžně a poeticky. Za týden si nepamatuješ, co zaznělo, ale oni ano a občas to citují.",
      ],
      [ // úroveň 5
        "Mezigalaktická pošta eviduje tvoji odpověď na zprávu kamaráda. Doručení: neurčeno, odhad: po konci slunečního cyklu.",
        "Přátelé podali k vesmíru stížnost: tvoje „budu tam za chvilku“ trvá v jejich čase čtyři světelné měsíce.",
        "Neptun tě pověřil správou všech objetí ve vesmíru. Systém se zasekl, protože každé je potřeba vybrat s láskou.",
        "Souhvězdí tvých přátel má jednu chybějící hvězdu. Je to ta, která měla přijít na sraz. Astronomové ji vedou jako „dorazí později“.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš jako malý rituál: svíčky, hudba a několik lidí, kteří tě opravdu vidí.",
        "Dárky bereš srdcem. I obyčejná kresba nebo ručně psané přání tě dojme víc, než by se zdálo.",
        "Na narozeniny se těšíš jako na pohádku. Každý rok má jiný konec, ale začátek je vždy vlídný.",
        "Tvoje oslava je plná hudby, jemných světel a míst k sezení. Hosté odcházejí s pocitem, že se zastavil čas.",
      ],
      [ // úroveň 2
        "Při přáních se rozpláčeš. Hlavně u těch, která nečekáš. A taky u těch, která čekáš.",
        "Oslavu plánuješ s nadšením. Jen zapomeneš určit čas, místo a to, kdo vlastně přijde.",
        "Dort vybíráš podle barvy. Chuť je vedlejší, hlavní je, aby vypadal jako akvarel.",
        "Na přání odpovídáš dlouhými zprávami. Přátelé je čtou jako dopisy z pohádky.",
      ],
      [ // úroveň 3
        "Narozeniny si pamatuješ všem. Vlastní občas zapomeneš. Pak ti přijde sto zpráv a ty se divíš, co se stalo.",
        "Přeješ si, aby tvoje oslava byla dokonalá. Dokonalá znamená: bez konfliktu, bez ticha a aby se všechno zorganizovalo samo.",
        "Dárek, který dáváš, balíš dvě hodiny. Při předávání se dojmeš dřív než obdarovaný. Je to dárek pro všechny.",
        "Svíčky sfoukneš s přáním klidu. Po pěti minutách už přemýšlíš, jestli všichni mají dost dortu a pocitu domova.",
      ],
      [ // úroveň 4
        "Pozvánku na narozeniny rozešleš, hosty zapomeneš. Dort objednáš na špatný týden. Zato s citem.",
        "Vlastní oslavu stihneš jen napůl: dorazíš, až se dort dojí. Je to pointa tvé tradice.",
        "Pláčeš nad přáním od někoho, koho už pět let nevidíš. Pak zapomeneš, že oslava je dnes.",
        "Dárky otevíráš pomalu, jako by uvnitř byl vesmír. Hosté čekají, až jim dojde, že je to jen svetr.",
      ],
      [ // úroveň 5
        "Vesmír tvoje narozeniny oslavil meteorickým deštěm. Termín ale nikdo nepotvrdil, ani ty, takže se konal v paralelní galaxii.",
        "Neptun ti poslal přání v bublině vzduchu. Dorazilo po dvou stech letech, ale vůně moře zůstala.",
        "Tvoje oslava probíhá v mlhovině mezi dvěma datumy. Hosté dorazili, ale nikdo neví, kdy a kam.",
        "Svíčky na dortu se rozplynuly do souhvězdí. Vědci tvrdí, že jde o nový útvar jménem „Přání bez adresy“.",
      ],
    ],
  },
  s: [
    ["Ztracených klíčů za měsíc", "6"],
    ["Slz u reklamy", "3 týdně"],
    ["Zpoždění „zhruba v pět“", "1 h 14 min"],
    ["Okamžiků „kde to je?“", "11 denně"],
    ["Snů, které se dnes vrátí", "5"],
    ["Pravdivost věty „budu tam za chvilku“", "9 %"],
  ],
  d: [
    "Dnes budeš snít. Hvězdy doporučují dělat to v pracovní době jen mírně.",
    "Neptun dnes šeptá: zapomeň na plán. Ostatní planety se ptají, jaký.",
    "Dnes ti někdo ukáže hezký obrázek. Ty se dojmeš. Pak ztratíš telefon.",
    "Dnešní konstelace: oblak, hudba a jedna hluboká myšlenka, kterou zapomeneš dřív, než ji řekneš.",
    "Dnes ti někdo přinese kafe. Ty uvěříš, že je to znamení. A možná budeš mít pravdu.",
    "Dnes se rozhodneš žít víc v přítomnosti. Do oběda to půjde. Pak se zase rozplyneš.",
    "Dnešní tip: napiš si, co ti dnes přišlo na mysl. Pak napiš, kam se ten papír poděl.",
    "Dnes budeš chtít všem pomoct. Hvězdy se obávají, že pomůžeš i těm, co o to nežádali.",
    "Dnes ti přijde, že se čas zastavil. Hvězdy tomu říkají „oběd“.",
    "Dnes přijde krásný nápad. Přesně pět minut před poradou, takže se ztratí cestou na poradu.",
    "Dnes se rozpláčeš u hudby, u reklamy a u pohledu na hezkou fontánu. Hvězdy to berou jako rozcvičku.",
    "Dnešní varování: pokud ti někdo nabídne „malou službu“, rozmysli si to. A pak ji stejně uděláš.",
    "Dnes ztratíš klíče, najdeš je v ruce a budeš tvrdit, že to byl záměr.",
    "Dneska se rozpláčeš u písničky v obchodě. Nikdo si toho nevšimne. Hvězdy ano a pošlou kapesník.",
    "Dnes slíbíš, že přijdeš včas. Hvězdy se podívají na tvoji minulost a začnou nenápadně pískat.",
    "Dnes tě osloví někdo s trápením. Ty ho vyslechneš, obejmeš a zapomeneš, co bylo původně v plánu.",
    "Dnes se ti zdá, že hodiny jdou pomalu. Hvězdy říkají, že jdou stejně. Jen ty se dnes díváš na mraky.",
    "Dnešní horoskop: voda, hudba a nepořádek na stole, který se tváří jako umělecká instalace.",
    "Dnes dostaneš zprávu, na kterou chceš krásně odpovědět. Odpovíš za tři dny a bude to báseň.",
    "Dnes si řekneš „už nikdy nic neztratím“. Hvězdy to zapíšou jako dnešní vtip.",
    "Dnes ti někdo něco půjčí. Hvězdy tipují, že to bude vráceno za týden. Nebo vůbec ne. Pod záštitou přátelství.",
    "Dneska si budeš chtít něco přát. Přej si klid. Hvězdy to prověří a oznámí, že klid se právě ztratil.",
    "Dneska se ti někdo svěří s dojemným příběhem. Za dvacet minut jste oba ve slzách a debata o obědě je odložena.",
    "Dnes přeplaveš pondělní náladu s grácií delfína. Jen místo cíle skončíš u zmrzliny.",
  ],
  q: [
    "Někde, kde hraje hudba a nikdo se nehádá. Pokud takové místo najdeš, zavolej mi. Já se ztratím cestou.",
    "Víkend? Procházka, kniha, zapomenutý plán a hodina koukání do oken. Je to perfektní.",
    "Odpověď… ano, měla by přijít. Jen se chvíli dívám z okna. Chvilku. Možná dvě.",
    "Nádobí… ano. Hned. Jen se nejdřív podívám, jak hezky se v něm odráží světlo. Pak vlastně umyju.",
    "Tam, kde je moře, kniha a nikdo se neptá, kolik je hodin. Hlavně bez budíku.",
    "Něco hezkého a smutného. Ať se můžu rozplakat a pak mít skvělý večer.",
  ],
};

export default ryby;
