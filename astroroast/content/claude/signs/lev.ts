// AstroRoast.ai: knihovna humoru, znamení lev. Ručně psané originální české fragmenty.
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

const lev: RawSign = {
  h: [
    [
      "Lev: když vstoupí do místnosti, i lustry zaujmou lepší pózu.",
      "Lev rozdává velkoryse: úsměvy, rady a pocit, že všechno se točí kolem něj. Je to dar.",
      "Jsi člověk, který umí rozzářit místnost. Hvězdy jen doufají, že ne zrovna v noci.",
    ],
    [
      "Lev není domýšlivý. Jen ví, že sál se dívá správným směrem.",
      "Tvoje vstupy do místnosti mají vlastní hudební doprovod. V hlavě. Ale má to dobrý rytmus.",
      "Pozornost je tvoje oblíbené jídlo. A přidat si můžeš kdykoli.",
    ],
    [
      "Lev miluje, když se o něm mluví. A když se nemluví, tak o tom aspoň napíše příspěvek.",
      "Hrdost máš na jeřáb. Skromnost čeká na letišti, zavazadlo se ztratilo.",
      "Z jednoho selfie vyrobíš dvacet verzí. Odešleš tu jedenáctou, a ta je stejná jako první.",
    ],
    [
      "Lev se nikdy nezeptá: „Co si o tom myslíš?“ Většinou zve k diskusi: „Co si o mně myslíš?“",
      "Jsi jako Slunce: bez tebe to nejde, ale na tebe se dlouho dívat nedá.",
      "Pokora u tebe znamená, že dovolíš i ostatním stát v zorném poli. Na okraji.",
    ],
    [
      "Slunce požádalo o převedení do jiné soustavy. Prý tam má méně konkurence.",
      "Vesmír tě zapsal jako nejjasnější objekt na obloze. Zlatý rámeček přišel s certifikátem.",
      "Lev si objednal vlastní supernovu. Na oslavu nikdo nepřišel, tak ji vyhlásil znovu.",
    ],
  ],
  c: [
    [
      "Umíš zazářit tak, že ostatním je u toho příjemně. To je vzácný druh charismatu.",
      "Máš velkorysost, humor a špetku dramatu. Vesmír tomu říká „rodinný balíček“.",
    ],
    [
      "Nejlíp sedíš uprostřed. I v autě, i na pohovce, i ve vlastním životě.",
      "Chválu přijímáš jako host u bufetu: slušně, velkoryse a s dalším kolečkem.",
    ],
    [
      "Skromnost je tvoje silná stránka. Mluvíš o ní jen osm minut denně.",
      "Když tě chválí, kývneš. Když tě nechválí, počkáš, až si to rozmyslí.",
    ],
    [
      "Nepotřebuješ publikum. Jen tak pro jistotu ho máš s sebou pořád.",
      "Tvoje představa o skromnosti je zlatá medaile s nápisem „nejskromnější“.",
    ],
    [
      "Planety se u tvého jména zastavují a salutují. Většinou ze strachu, že jinak přijde proslov.",
      "Vesmír pro tebe uspořádal oslavu. Byla krátká, protože hlavní host ji přerušil proslovem o sobě.",
    ],
  ],
  v: [
    [
      "Verdikt: zlatý střed vesmíru. Lépe řečeno zlatý střed tvé galaxie.",
      "Hvězdy radí: svítit je skvělé. Jen občas nech zazářit i ostatní. Zvládnou to.",
    ],
    [
      "Rada hvězd: zkus dnes nejdřív poslouchat. Je to jako stát v pozadí, ale s pocitem hrdinství.",
      "Verdikt: velkorysost, hlasitost, nepostradatelnost. Dvě z těch tří slov zkus ztlumit.",
    ],
    [
      "Verdikt: svět ti leží u nohou. Jen se zdá, že se nechce dívat tvým směrem.",
      "Rada: příště nech chvíli ticha. Uvidíš, jak se budou všichni těšit.",
    ],
    [
      "Verdikt: jsi hlavní postava. Škoda, že ostatním o tom nikdo neřekl.",
      "Rada hvězd: zkus ostatním dovolit mít vlastní vedlejší role. Mají je rádi.",
    ],
    [
      "Verdikt vesmíru: zasloužená pozornost, nezasloužená délka proslovu.",
      "Rozsudek: jeden den v hledišti, poslední řada, výhled na sloup.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Ve vztahu svítíš jako Slunce: hřeješ, rozdáváš a všichni kolem se vyhřívají. Jen sluneční brýle si partner nechává po ruce.",
        "Překvapení, která plánuješ, jsou tak velkolepá, že partner má radost už z pozvánky. A trochu trému.",
        "Umíš dát najevo lásku tak, že to ví celý dům. A sousedi. A trochu i poštovní schránka.",
        "S tebou je každé výročí svátek. Kalendář si ho zapisuje sám, pro jistotu červeně.",
      ],
      [ // úroveň 2
        "Na rande si vybíráš místo s dobrým světlem. Pro atmosféru, samozřejmě. Že je to i světlo na tvé fotky, je shoda okolností.",
        "Partner tě nechává vést vztah. Mohl by se ptát, ale už ví, že odpověď bude „já, samozřejmě“.",
        "Dárek pro partnera vybíráš s láskou a s tichou nadějí, že ten příští dostaneš zase ve stejně velké krabici.",
        "Když vyznáváš lásku, zní to jako úvodní scéna filmu. Partner jen čeká, jestli bude i druhé dějství, ve kterém promluví on.",
      ],
      [ // úroveň 3
        "Partnerovi říkáš, že je tvoje všechno. Zvlášť ve chvílích, kdy potřebuješ někoho, kdo potlesk vydrží držet nejdéle.",
        "Ve vztahu je místo pro dva. Ty se v něm roztahuješ tak velkoryse, že partner dostal roli s jednou větou: „Výborně.“",
        "Říkáš „nemusíš mi nic kupovat“ tónem, kterým se ve filmech říká „bomba vybuchne ve tři“.",
        "Tvoje „já nežárlím“ má jednu zvláštnost: předchází mu dvacet minut o tom, kdo se na partnera včera díval.",
      ],
      [ // úroveň 4
        "Tvoje oblíbená otázka na rande: „A co ty si myslíš… o mně?“",
        "Kritiku od partnera bereš jako recenzi inscenace: autor se pochopitelně mýlí, ale aspoň píše o tobě.",
        "Hádka s tebou má tři dějství. V posledním je omluva, kterou musí přednést někdo jiný.",
        "Společná fotka z rande má dvacet pokusů. Partner na ní vypadá jako stativ, který ti drží světlo.",
      ],
      [ // úroveň 5
        "Venuše ti vypověděla spolupráci. Prý konkurence v soustavě je moc silná a ona nemá šanci na hlavní roli ve vztahu.",
        "Když partner řekne „miluju tě“, ozve se Slunce: „Počkat, tohle je moje scéna.“ Případ řeší kosmická rada.",
        "Milenecké konstelace byly přejmenovány na „Lev a jeho pozadí“. Partner je ta slabě svítící hvězdička vpravo dole.",
        "Při tvém vyznání lásky se rozzáří pulsar. Astronomové zjistili, že to jsi ty, jak s úsměvem čekáš na potlesk.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci zapálíš celý tým. Nápady sypeš jako jiskry a ostatní najednou chtějí ráno vstávat.",
        "Máš přirozený dar vést: lidé tě následují, i když zrovna nikam nejdeš. Kolegové tomu říkají charisma.",
        "Při prezentaci držíš sál v napětí. Kdyby měla porada tleskat, tleskala by včas.",
        "Tvoje pochvaly mají kouzlo: kdo je dostane, pracuje další týden s úsměvem. Tebe to těší taky, což je fér.",
      ],
      [ // úroveň 2
        "Na poradě se ujímáš slova dřív, než zazní otázka. Kolegové tomu říkají „Lev už ví“.",
        "Po schůzce se kolegů ptáš, jak to vyznělo. Chceš slyšet „skvěle“, a obvykle ho dostaneš.",
        "Při týmovém obědě mluvíš nejvíc a nejlíp. Aspoň to tvrdí ten, kdo se dostal ke slovu jednou.",
        "Nástěnku pochval čteš pro jistotu, jestli se tam někde neztratilo tvoje jméno.",
      ],
      [ // úroveň 3
        "Delegovat umíš skvěle: všechny úkoly zadáš ostatním, všechny zásluhy si nenápadně necháš.",
        "Slovo „tým“ používáš často. Hlavně těsně před slovy „díky mně“.",
        "Do životopisu píšeš „vedu“, „inspiruji“ a „tvořím vize“. Že to byla porada s kávou, nikdo nepozná.",
        "Kritiku v práci bereš jako nabídku k diskusi. Ke své diskusi, kde zazní hlavně tvoje verze.",
      ],
      [ // úroveň 4
        "Ve firmě jsi jako maskot: všichni tě znají, nosíš barvu, a nikdo přesně neví, co děláš.",
        "Každou prezentaci začínáš slovy „Já“ a končíš slovy „Děkuji, že jste mi věnovali pozornost.“",
        "Nepracuješ pro tým. Tým pracuje pro tebe. Hvězdy ti to vždycky schválí, ale v zápisu to neuvedou.",
        "Tvůj e-mail s „krátkou otázkou“ má sedm odstavců. Pět z nich je o tvé roli v celém projektu.",
      ],
      [ // úroveň 5
        "Merkur zrušil schůzku s tebou. Důvod: nesnese čekat, až se proslov dostane k bodu 2 z 94.",
        "V kosmické firmě tě vedou jako „Hlavní zdroj světla a hluku“. Obě kolonky mají stejný rozpočet.",
        "Tvoje prezentace byla vyslána na Voyager. Mimozemšťané odpověděli jediným slovem: „Další slide ne.“",
        "Galaktická rada tě jmenovala CEO Slunce. Slunce se odvolalo, ale odvolání bylo přerušeno tvým úvodním proslovem.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Žiješ ve velkém stylu. I obyčejný čtvrtek vypadá u tebe jako malá premiéra s dobrým osvětlením.",
        "Máš talent proměnit všední den ve svátek. Lidé se rádi přidají, protože se u tebe dobře baví.",
        "Tvoje dobrá nálada naskočí dřív než ranní káva. Okolí je za to vděčné a trochu zaskočené.",
        "Kolem tebe se lidé usmívají sami od sebe. Kdo by se nechtěl vyhřívat na slunci.",
      ],
      [ // úroveň 2
        "Když vejdeš do obchodu, prodavač se instinktivně narovná. Nevíš proč, ale líbí se ti to.",
        "Svoje plány představuješ s úvodním slovem a přípitkem. Otázky jsou vítané, ale odpovídáš na ně dalším plánem.",
        "Cestou na zastávku si pouštíš hudbu, která by se hodila do úvodních titulků. Autobus pak přijede jako zpožděný režisér.",
        "Zrcadlo ti kývne, když ho míjíš. Nebo si to aspoň myslíš. Tak či tak, den začíná skvěle.",
      ],
      [ // úroveň 3
        "Skromnost ti není cizí. Znáš ji z doslechu a z vlastních příspěvků o ní.",
        "Říkáš, že pozornost nepotřebuješ. Tónem, který slyší tři sta lidí, a v hlavní roli.",
        "Život ti vždycky něco vrátí. Hlavně potlesk, který sis předtím dal na zálohu.",
        "Říkáš, že se slávou nenecháš unášet. Pak ráno natočíš tři příběhy o tom, jak se neunášíš.",
      ],
      [ // úroveň 4
        "Tvoje oblíbená slova: „Mimochodem“, „Já“ a „No jo, tohle bylo moje.“",
        "Kdyby měl tvůj život titulky, každá minuta by začínala „Představuje se hlavní hvězda“.",
        "Potřebuješ publikum tak moc, že když se nikdo nedívá, natočíš o tom aspoň dokument.",
        "Tvoje paměť na komplimenty je lepší než cloud. Kritika se tam nikdy nenahraje, chybí jí oprávnění.",
      ],
      [ // úroveň 5
        "Slunce navrhlo střídání ve funkci středu soustavy. Odpověď: „Počkejte, zapíšu si to jako urážku.“ Slunce se vypnulo.",
        "Astronomové pozorují supernovu. Je to tvoje ranní pózování před zrcadlem. Je vidět až z Andromedy.",
        "Černá díra pohltila světlo. Tvůj komentář: „Konečně někdo, kdo mi nekonkuruje.“ Černá díra se urazila.",
        "Při tvém narození prý kometa zpomalila. Vesmír dodnes neví, jestli se tě bála, nebo chtěla autogram.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Pro přátele jsi domov: s tebou se jede na dovolenou, do divadla a v nouzi i na návštěvu bez objednání.",
        "Parta se tvou zásluhou schází častěji. Bez tebe by se plánovalo do příštího jara.",
        "Tvůj smích rozjede každou hodinu. I tu, ve které se parta vlastně chystala domů.",
        "Když má kamarád problém, nabídneš mu velkoryse radu, objetí i večeři. A zbytek vyprávění si jen užíváš.",
      ],
      [ // úroveň 2
        "Ve skupinovém chatu píšeš nejvíc. Ostatní to berou jako sociální službu. Tobě to připadá jako koncert.",
        "Na rozloučenou pronášíš proslov, který je o něco delší než samotná oslava.",
        "Při výběru restaurace prohlásíš, že je ti to jedno. A pak vybereš největší podnik se stolem uprostřed.",
        "Přátelé tě milují. Jen si občas všimnou, že téma konverzace nezvykle často míří k tobě. Ale mile.",
      ],
      [ // úroveň 3
        "Pozvat tě na oslavu je pocta. Pozvat tě na cizí oslavu je riziko, že se z ní stane tvoje.",
        "Do cizích rozhovorů se zapojuješ s lehkostí a neodcházíš, dokud se téma nestočí k tobě.",
        "Kamarádovi popřeješ k úspěchu. Pak se zeptáš, jestli už viděl tvoje fotky z včerejška.",
        "Skupinová fotka je pro tebe závod. Vyhráváš ho pokaždé: stojíš uprostřed a zůstaneš tam o půl minuty déle.",
      ],
      [ // úroveň 4
        "Přátelé ti vždycky řeknou, že to bylo skvělé. Vědí totiž, co by se stalo, kdyby ne.",
        "Když se ti kamarád svěří, poradíš mu. Pak následuje příběh, kdy se stejná věc stala tobě. A dopadla líp.",
        "Tvoje oblíbené téma při setkání s přáteli: ty. Druhé oblíbené: jak ty vidíš, že ti všichni zavidí.",
        "Při přípitku na přítele je tvoje část nejdelší. Oslavenec se nakonec stane hostem na tvém vystoupení.",
      ],
      [ // úroveň 5
        "Parta kamarádů se prý přesunula do vedlejší galaxie. Důvod: v té tvé je moc světla a málo místa pro ostatní.",
        "Satelit sleduje tvoje večeře s přáteli. Zaznamenal, že 94 % času zabírá slovo „já“. Zbytek je „díky“.",
        "Kamarádi ti postavili pomník na vedlejší planetě. Nápis: „Tady už se nikdo nedostane ke slovu.“",
        "Mléčná dráha uspořádala sraz přátel. Ty máš vlastní, větší, ve stejnou dobu. S dortem.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš s radostí a všichni se přidají. Je to jako když se rozsvítí lustr, jen s dortem.",
        "Máš talent udělat z cizích narozenin skvělou párty. Kamarádi se k ní po letech vracejí v myšlenkách.",
        "Dárek vybíráš s láskou, takže kdo ho dostane, ví, že na něm záleží. A že krabice byla velká.",
        "Tvoje oslavy mají atmosféru: hudba, světýlka a hosté, kteří se smějí ještě doma.",
      ],
      [ // úroveň 2
        "Narozeniny začínáš slavit týden předem. Aby se nikdo nemohl vymluvit, že nevěděl.",
        "Přání dostáváš celé dopoledne a každému odpovídáš zvlášť, osobně, s emotikonem. Je to docela pracovní den.",
        "Dort musí být tak velký, aby ho viděl i soused. Jíst se může až po proslovu.",
        "Společná narozeninová fotka se opakuje, dokud nesedí světlo. Dort mezitím aspoň stihne vychladnout.",
      ],
      [ // úroveň 3
        "Narozeniny jsou jediný den, kdy skromnost bere dovolenou. Zbytek roku bere jen krátké pauzy.",
        "Přání od ostatních čteš nahlas. Pro jistotu, kdyby někdo přehlédl, jak velká je tvoje popularita.",
        "Řekneš: „Nic nechci, hlavně mě nepřekvapujte.“ Pak týden každému naznačuješ barvu, velikost a značku.",
        "Na narozeniny pozveš deset lidí. Přijde třicet, protože se to rozneslo tvými příspěvky.",
      ],
      [ // úroveň 4
        "Oslava se koná v tvém domě, v tvůj čas a podle tvého scénáře. Hosté jsou statisté s dobrým jídlem.",
        "Přání, která dostaneš, počítáš. Když jich je málo, rozhodneš se, že se to dá napravit dalším příspěvkem.",
        "Při sfouknutí svíček čekáš ticho. A potlesk. A ideálně kameramana z veřejnoprávní televize.",
        "Dárky hodnotíš podle velikosti krabice. Malá krabice u tebe vyvolá výraz, kterým by se dala zastavit pošta.",
      ],
      [ // úroveň 5
        "NASA každé jaro vyhlašuje stav vyšší pohotovosti: blíží se tvoje narozeniny. Oběžné dráhy se předem uvolňují pro ohňostroj.",
        "Při sfouknutí svíček prý zhasla polovina souhvězdí. Slunce reklamovalo, že tohle je jeho exkluzivní práce.",
        "Kosmické úřady zavedly zvláštní kalendář: 364 dní roku a jedny narozeniny Lva. Ty poslední trvají tři týdny.",
        "Tvůj dort má tolik svíček, že družice hlásí požár na Zemi. Hasiči přijedou a ty od nich vyžaduješ přípitek.",
      ],
    ],
  },
  s: [
    ["Úspěšnost fotek „bez filtru“", "0 %"],
    ["Minut před zrcadlem dnes", "47"],
    ["Příspěvků o skromnosti", "12"],
    ["Pravdivost věty „to byla ironie“", "4 %"],
    ["Rozhovorů, které se stočí k tobě", "100 %"],
    ["Potlesku, který ti stačí", "∞"],
  ],
  d: [
    "Dnes tě někdo pochválí. Ty to přijmeš jako samozřejmost. A hned se zeptáš na další.",
    "Slunce ti dnes posílá paprsek. Ostatní planety dostanou jen odraz.",
    "Dnes ti někdo skočí do řeči. Hvězdy svolávají mimořádné zasedání.",
    "Dnešní konstelace: ty v centru, všichni ostatní jako vedlejší role. Bohužel to platí i pro tvůj kalendář.",
    "Dnes se ti dostane pozornosti. Je jí málo. Hvězdy ti doporučují vytvořit další.",
    "Dnes ti někdo vynese chválu. Ty odpovíš „já vím“. A bude to skoro pravda.",
    "Dnes pošleš selfie, na kterém je tvůj nejlepší úhel. Hvězdy už všechny tvoje úhly zdokumentovaly.",
    "Dnes tě čeká důležité setkání. Hvězdy doufají, že tam bude i někdo jiný než ty.",
    "Dnešní tip: nech aspoň jednu větu doříct i někomu jinému. Je to nové a zajímavé.",
    "Dnes budeš mít skvělou náladu. A zbytek světa se podle toho zařídí. Nebo aspoň k tomu kývne.",
    "Dnes ti dojde, že máš pravdu. Poprvé od včerejška. Slavíš to s úsměvem.",
    "Dnešní varování: pokud máš pocit, že kolem tebe nikdo není, podívej se do zrcadla. Je tam publikum.",
    "Dneska si u kávy řekneš, že skromnost je tvoje silná stránka. Pak o tom budeš mluvit čtvrt hodiny.",
    "Dnes zkusíš sednout do poslední řady. Vydržíš to do první přestávky, pak se přesadíš dopředu.",
    "Dneska někdo vysloví tvoje jméno ve vedlejší místnosti. Přijdeš zjistit, co přesně se o tobě říkalo.",
    "Dnes narazíš na zrcadlo na neobvyklém místě. Hvězdy neručí za to, kolik času u něj strávíš.",
    "Dneska dostaneš kompliment a nebudeš ho muset vynucovat. Tenhle den si zapiš červeně, je vzácný.",
    "Dnes napíšeš zprávu, ve které se slovo „já“ objeví jen čtyřikrát. Osobní rekord a důvod k oslavě.",
    "Dneska se tě někdo zeptá, jak se máš. Odpověď bude mít úvod, rozvinutí a závěr s pointou.",
    "Dnes si u dveří uděláš malou pauzu před vstupem. Ne z nervozity, jen ať se všichni stihnou otočit.",
    "Dneska vyfotíš oběd. Pak se rozhodneš, že hlavní motiv bude stejně tvůj obličej. Jídlo se nezlobí.",
    "Dnes se na poradě rozhodne spousta věcí bez tebe. Slunce ti pošle soustrast, ale jen krátkou.",
    "Dneska dostane pochvalu někdo jiný. Zhluboka dýchej. Je to jen tři minuty potlesku.",
    "Dnes se projevíš velkoryse a zaplatíš kávu. Do oběda o tom bude vědět celé oddělení.",
  ],
  q: [
    "Rezervace je na mé jméno. Nejlepší stůl, nejlepší výhled, nejlepší společnost. Mluvím o sobě.",
    "Víkend? Pořádám oslavu. Máš vstup zdarma. Hlavní hvězda je už zajištěna.",
    "Odpověď bude skvělá. Čekej. Právě ji ladím, aby seděla k úvodním titulkům.",
    "Já nádobí nemyju, já jsem vedoucí projektu. Ale pokud se najde dobrovolník, dostane potlesk.",
    "Do místa, kde mě pozná personál. A kde pro mě udělají fotku u vchodu.",
    "Něco, kde je hlavní hrdina charismatický, odvážný a trochu připomíná mě. Vybírám podle toho.",
  ],
};

export default lev;
