// AstroRoast.ai: knihovna humoru, znamení kozoroh. Ručně psané originální české fragmenty.
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

const kozoroh: RawSign = {
  h: [
    [
      "Kozoroh: na tebe se dá spolehnout i v pondělí v 7:40.",
      "Kozoroh dotáhne věci, které ostatní na poradě jen slíbí.",
      "Když Kozoroh řekne „bude hotovo“, můžeš to s klidem škrtnout ze seznamu.",
    ],
    [
      "Kozoroh má smysl pro humor. Nechává si ho na čtvrtek po páté.",
      "Odpočívat umíš. Jen to nejdřív zapíšeš do kalendáře a pozveš na to sebe.",
      "Když řekneš „já to vezmu“, ostatním se uleví a tobě přibude víkend.",
    ],
    [
      "Kozoroh nemá čas na zbytečné řeči. Hlavně na ty, co nejsou jeho.",
      "Máš plný kalendář. Dovolená se u tebe musí hlásit předem a písemně.",
      "Humor máš tak suchý, že ho kolegové berou jako zápis z porady.",
    ],
    [
      "Na dětské oslavě se Kozoroh zeptá, kdo odpovídá za dort. Jméno chce písemně.",
      "Máš pětiletý plán a o víkendu k němu dopisuješ šestý rok.",
      "Úsměv ti musí nejdřív schválit vedení. Vedení jsi ty a zrovna jsi na poradě.",
    ],
    [
      "Saturn podal žádost o snížení nároků, které na sebe máš. Zamítnuto, chybí příloha.",
      "Slunce za pět miliard let zhasne. Ty to máš v kalendáři od ledna, s připomínkou.",
      "Komise ti schválila odpočinek. Tvůj kalendář ho zamítl pro kolizi s prací.",
    ],
  ],
  c: [
    [
      "Dotáhneš to, co ostatní odloží na „někdy“. Beze slov, jen s hotovým výsledkem.",
      "Lidé se u tebe cítí v bezpečí. Víš, kde je záložní klíč, rezervní baterie i návod k troubě.",
    ],
    [
      "Úspěch bereš vážně. Vtipy taky, ale ty si necháváš schvalovat zvlášť.",
      "Odpočinek je pro tebe další úkol: má čas, cíl a mírnou nespokojenost s výsledkem.",
    ],
    [
      "Dovolenou plánuješ čtyři měsíce a pak ji zrušíš kvůli prioritě. Priorita se jmenuje úterý.",
      "Sarkasmus máš tak suchý, že kolegové pochopí vtip až při čtení zápisu.",
    ],
    [
      "V sobotu v 8:15 „jen mrkneš do e-mailů“. V 11:40 už píšeš kolegům, co od nich čekáš v pondělí.",
      "Z letošní dovolené máš tři fotky. Na všech je za tebou vidět notebook.",
    ],
    [
      "Na videohovorech mluvíš tak stroze, že tě automatické titulky vedou jako ticho se zápisem.",
      "Černá díra pohltí hvězdy, světlo i čas. Tvoji plnou poštu odmítla: prý se jí už nevejde.",
    ],
  ],
  v: [
    [
      "Pevný základ, tichá síla a týden naplánovaný po hodinách. Tohle se nedá okopírovat.",
      "Zasloužíš si pauzu. Zapiš si ji do kalendáře, ať ji nemusíš nikomu obhajovat.",
    ],
    [
      "Smaž jednu schůzku. Nikomu to neřekneme a budova to přežije.",
      "Humor máš. Jen ho vytahuješ o víkendu, který nemáš. Zkus ho jednou i ve všední den.",
    ],
    [
      "Zasloužíš si úspěch a týden bez plánu. Aspoň na zkoušku, klidně s tužkou v ruce.",
      "Zkus jednou odejít z práce před zhasnutím světel. Budova bude stát a nikdo si nevšimne.",
    ],
    [
      "Nejlepší kolega na všechno kromě dovolené. Tam by se svolala porada.",
      "Štěstí se nedá vyplnit do kolonky „cíl“. Ale ty to stejně zkusíš s grafem.",
    ],
    [
      "Verdikt vesmíru: odpočinek schválen na příští fiskální rok. Vesmír žádný nemá.",
      "Rozsudek: hodina nicnedělání pod dozorem. Předem naplánovaná, s agendou a zapisovatelem.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce se na tebe dá spolehnout. Ve čtvrtek je večeře, v neděli procházka a partner ví, že tam budeš včas.",
        "Lásku neprojevuješ velkými gesty. Máš nabitý telefon, kapesníky a deštník pro oba.",
        "Partner se s tebou cítí v bezpečí. A občas dostane překvapení, když ho ohlásíš aspoň týden předem.",
        "Slovo „navždy“ říkáš málokdy. Když ho řekneš, má váhu notářského razítka.",
      ],
      [ // úroveň 2
        "Rande plánuješ s předstihem. Restauraci znáš líp než majitel a stůl u okna máš rezervovaný týden dopředu.",
        "Citlivost máš, jen ji držíš v trezoru. Partner už zjistil, že kód je datum vašeho výročí.",
        "Romantika je u tebe stůl na 19:00. Přijdeš v 18:52 a svíčky bereš jako příjemný bonus.",
        "Říkáš „miluju tě“ stejně jako „podepsáno“: pevně, jednou a s datem.",
      ],
      [ // úroveň 3
        "Romantický večer máš v kalendáři mezi poradou a „rezervou“. Partner už ví, že rezerva je jeho místo.",
        "V lásce jsi efektivní: nejdřív analýza kompatibility, pak pusa. Výsledky hlásíš do pátku.",
        "Na kávu zveš s agendou. Bod první: seznámení. Bod druhý: jestli se budete vídat i ve čtvrtek.",
        "Partner chce spontánnost. Slíbíš mu ji ve čtvrtek od 18:00 do 18:30, s pauzou na dort.",
      ],
      [ // úroveň 4
        "Romantickou večeři zahájíš větou „Pojďme probrat naše výsledky.“ Svíčky zhasnou samy.",
        "Partner se zeptá, jestli ho miluješ. Odpovíš: „Trend je dlouhodobě pozitivní.“ Je to největší vyznání v dějinách firmy.",
        "Výročí máš rozepsané po minutách. Partner prosí o jednu minutu bez agendy a dostane ji ve 21:15.",
        "Dárek k výročí je vždycky praktický. Partner už dostal sadu nožů, hasicí přístroj a revizi komínu.",
      ],
      [ // úroveň 5
        "Kupid zamířil na tvoje srdce. Šíp se zasekl v kalendáři u položky „Pozdější revize“.",
        "Mezigalaktický úřad pro srdce zamítl tvoji žádost o lásku. Chybí příloha C: city.",
        "Venuše ti poslala pozvánku na rande. Přišla automatická odpověď: „Jsem na poradě, vracím se za tři světelné roky.“",
        "Až se Kozoroh zamiluje, vesmír vydá tiskovou zprávu. Má ji v konceptu od velkého třesku.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci jsi jako klidný stroj: kolem tebe lidé přestanou panikařit a začnou pracovat.",
        "Když něco řekneš, platí to. V kanceláři je to vzácnější než funkční tiskárna.",
        "Projekt vedeš tak, že se nikdo nemusí bát. I ti, kdo jsou nervózní z principu, se uklidní.",
        "Dochvilnost je tvoje superschopnost. Ostatní chodí na schůzky, ty na ně přicházíš o pět minut dřív.",
      ],
      [ // úroveň 2
        "Šéfem být nechceš. Chováš se tak ale často, že to začíná být oficiální.",
        "Poradu začínáš přesně v čas. Kdo mluví déle, dostane pohled na hodinky.",
        "Zápis z porady máš pečlivější než zápis z jednání OSN. Nikdo ho nechtěl, ale všichni ho dostanou.",
        "Kávu piješ v plánovaných intervalech. Chuť je vedlejší efekt.",
      ],
      [ // úroveň 3
        "Dovolená je pro tebe jako nekonečno: víš, že existuje, ale nikdy se k ní nedostaneš.",
        "Někdo řekne „zkusme to“ a ty už vidíš tři rizika, dvě závislosti a poradu, která to celé zastaví.",
        "Tvůj e-mail má pět slov a čtrnáct příloh. Nikdo neví, jestli je to zdvořilost, nebo výhrůžka.",
        "Tvrdíš, že práce není tvůj život. Říkáš to v neděli ve 22:00 při kontrole e-mailů.",
      ],
      [ // úroveň 4
        "Nejuvolněnější okamžik tvé kariéry nastal na školení o zvládání stresu. V pauze na kávu. Trval čtyři minuty.",
        "Rovnováhu práce a života máš vyřešenou: v týdnu práce, o víkendu záloha práce.",
        "Kolegové tě mají rádi na dálku. Zblízka cítí, jak jim v tvém pohledu běží stopky.",
        "Když někdo na poradě řekne „jen krátce odbočím“, tvůj pohled udělá větší škodu než audit.",
      ],
      [ // úroveň 5
        "NASA nabídla spolupráci na misi na Mars. Odpověď dorazila do hodiny: „Harmonogram je příliš volný, posílám revizi.“",
        "Tvoje pracovní morálka má vlastní gravitaci. Planetky se k ní stáčejí a hlásí se na přesčas.",
        "Galaktický úřad práce tě eviduje jako perpetuum mobile. Kontrola v neděli tě našla u e-mailů.",
        "Černá díra pohltila pracovní plány celé Země. Ten tvůj vyplivla s poznámkou: „Příliš detailní.“",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Život stavíš jako dům: každý rok přistavíš patro a výhled je pořád lepší.",
        "Opřít se o tebe může kdokoli. Stojíš tak pevně, že tě ani pondělí nepohne.",
        "Máš v životě řád, který uklidňuje. Ostatní se v něm cítí jako ve studovně: ticho, bezpečí a funkční lampička.",
        "Trpělivost je tvoje superschopnost. Počkáš na výsledek tak dlouho, až ostatní zapomenou, že ho čekali.",
      ],
      [ // úroveň 2
        "Spontánnost si plánuješ. Do kalendáře, s připomínkou a poznámkou „zkusit se bavit“.",
        "Odpočinku vyhradíš čtyřicet minut a děláš ho pořádně. Pak zkontroluješ, jestli splnil cíle.",
        "Narozeniny, svátky, výročí: všechno máš dva týdny dopředu. Překvapení tě zaskočí nejvíc.",
        "Řád ti dává klid. Chaos ti dává důvod založit další seznam.",
      ],
      [ // úroveň 3
        "Tvůj den má vzorec: práce, plán, práce, plán. Radost je poznámka pod čarou mezi dvěma schůzkami.",
        "Máš tolik pravidel, že spontánnost musí podat žádost. Vyřízení trvá šest až osm týdnů.",
        "Říkáš, že chceš žít v přítomnosti. Přítomnost ti zatím posílá jen pozvánky na schůzky v budoucnosti.",
        "Na pohodu máš protokol a na štěstí přílohu k protokolu. Obojí leží ve složce „Později“.",
      ],
      [ // úroveň 4
        "Tvůj poslední spontánní nápad neprošel revizí. Komise ho označila za nepřiměřeně spontánní.",
        "Žiješ tak naplánovaně, že ti i překvapení doručují s potvrzenkou a třídenní lhůtou.",
        "Zapisuješ si i to, co nechceš zapomenout. A pak nevíš, v které složce ten zápis leží.",
        "Na „jak se máš?“ odpovídáš statusem projektu: „V termínu, s rizikem zpoždění.“",
      ],
      [ // úroveň 5
        "Kosmos prošel tvůj život a hlásí: „Volné okno nenalezeno. Hledáno dvě miliardy let.“",
        "Entropie říká, že pořádek se rozpadá. Tvůj kalendář podal námitku a vyhrál.",
        "Temná hmota tvoří většinu vesmíru. Tvůj kalendář ji hledá už roky, aby jí přidělil úkol.",
        "Kdyby se tvoje životní plány vytiskly, pokryly by oběžnou dráhu Jupiteru. A pořád by v nich chyběla kolonka „zábava“.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přátelé tě mají jako pevný bod. Když se kolem všechno komplikuje, ty máš lano, plán B a rezervní nabíječku.",
        "Dárky dáváš promyšlené a užitečné. Přátelé je používají roky a při každém použití si na tebe vzpomenou.",
        "Nejsi nejhlasitější. Jsi ten, kdo je k dispozici. Přátelé to vědí, i když to neřeknou.",
        "Slib držíš vždycky. Přátelé už to berou jako přírodní zákon, hned vedle gravitace.",
      ],
      [ // úroveň 2
        "Oslavy zveš s agendou. Bod 1: přivítání. Bod 2: dort. Bod 3: rozloučení.",
        "Když přátelé volají, čekáš, že jde o něco důležitého. Na „jen tak“ je potřeba předem rezervovaný termín.",
        "Rady dáváš rychle, věcně a bez hlazení. Přátelé je používají, i když zrovna neřeknou díky.",
        "Na zprávy odpovídáš do hodiny. Přátelé tuší, že máš notifikace pod dozorem.",
      ],
      [ // úroveň 3
        "Když přátelé plánují víkend, ty už máš tři varianty a plán úniku. Pláž dostanou e-mailem.",
        "Kamarádi o tobě říkají „na tebe je spolehnutí“. Překlad: nuda, ale funguje to.",
        "Do skupinového chatu píšeš jen věcné body. Poslední smajlík z roku 2021 už vedou jako historický artefakt.",
        "Dárky pro kamarády jsou praktické: záložní baterie, termoska, multifunkční nůž. Trochu je to děsí a zároveň jim za to děkují.",
      ],
      [ // úroveň 4
        "Na oslavu přijdeš včas, odejdeš ve 22:00 a cestou domů zhodnotíš večer. Známka: 7 z 10.",
        "Kamarád se rozejde s partnerem. Ty se zeptáš: „A máš už plán na příští čtvrtletí?“",
        "V kontaktech tě kamarádi mají jako „Kozoroh (nechystat překvapení)“.",
        "Pozvánku na kafe posuzuješ jako obchodní nabídku. Chceš podmínky, termín a důkaz, že kafe bude dobré.",
      ],
      [ // úroveň 5
        "Mezigalaktická rada přátel vydala nařízení: Kozoroha zvát jen s patnáctidenním předstihem.",
        "Tvoje přátelství funguje jako satelit: přesně na dráze, nikdy mimo plán. Jen občas dorazí signál „díky, ahoj“.",
        "Kosmická pošta doručila přátelům tvoji pozvánku: agenda, tři přílohy a poznámka „Přineste vlastní nadšení“.",
        "Mezi hvězdami koluje legenda o Kozorohovi, který přišel na sraz pozdě. Je to největší záhada vesmíru, hned po temné hmotě.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš tiše, ale poctivě. Dort je dobrý, dárky promyšlené a přání upřímná.",
        "Nejradši dostáváš věci, které se dají používat celý rok. Praktičnost je tvoje forma sentimentu.",
        "Narozeniny ti připomínají, že čas plyne. Ty se s ním přátelíš, protože máš plán.",
        "Když ti hosté zpívají, tváříš se klidně. Uvnitř tě hřeje, že tu všichni jsou kvůli tobě.",
      ],
      [ // úroveň 2
        "Oslavu máš naplánovanou na hodinu. Hosté se ptají, jestli existuje i druhá hodina.",
        "Přání si ukládáš do složky „Narozeniny“. Poděkování máš připravené do týdne.",
        "Svíčky sfoukáváš s rozmyslem. Přání je vždycky praktické, třeba nová stolní lampa.",
        "Dárky otevíráš s poznámkami: dárce, užitečnost, doba použití. Vděčnost je ale opravdová.",
      ],
      [ // úroveň 3
        "Nejlepší dárek: diář. Nejhorší: překvapení v jiný den, než máš v kalendáři. A hned po něm překvapení s hosty.",
        "Narozeniny slavíš mezi 17:00 a 19:00. Pak začíná noční směna e-mailů.",
        "Na oslavě běží program: úvod, krájení dortu a krátký dotazník spokojenosti hostů.",
        "K narozeninám si přeješ klid. Za pět minut už vyhodnocuješ, jestli se přání splnilo.",
      ],
      [ // úroveň 4
        "Odchod z vlastní oslavy máš zapsaný v kalendáři. Hosté to berou jako přísný dozor nad zábavou.",
        "Pozvánka na tvoje narozeniny obsahuje čas, místo, oblečení a cíl večera. Hosté se bojí závěrečného hodnocení.",
        "Svíčky sfoukneš za tři vteřiny, přání máš už v kalendáři a dort se dělí podle předem připravené mapy.",
        "Když ti hosté zpívají „Hodně štěstí“, hlídáš, jestli nezpívají déle, než se domluvilo.",
      ],
      [ // úroveň 5
        "Vesmír ti poslal přání s přílohou „Oznámení o zpoždění o jeden oběh kolem Slunce“.",
        "NASA zařadila tvoje narozeniny mezi astronomické události: nastávají jednou ročně a vyžadují písemné potvrzení.",
        "Galaxie ti poslala přání včas, podepsané dvěma planetami a s poznámkou, že úsměv bude dodán ve čtvrtém kvartálu.",
        "Svíčky zhasínáš tak důsledně, že si černá díra žádá školení.",
      ],
    ],
  },
  s: [
    ["Hodin schůzek týdně", "27"],
    ["Dovolené využité z nároku", "9 %"],
    ["Kalendářů, které spravuješ", "3"],
    ["Pravdivost věty „dnes končím včas“", "0 %"],
    ["Sobotních e-mailů za měsíc", "11"],
    ["Úsměvů před první kávou", "0,4"],
  ],
  d: [
    "Dnes půjde všechno podle plánu. Zbytek dne budeš pátrat po tom, co v něm chybí.",
    "Dnes ti někdo řekne, že si zasloužíš odpočinek. Odpovíš: „Schválím ho v pátek.“",
    "Dnes odejdeš z práce včas. Kolegové zavolají, jestli se něco nestalo.",
    "Dnešní konstelace: tabulka, káva, tabulka. Kozoroh je v zenitu.",
    "Dnes se na poradě ukáže, že podklady přečetl jen jeden člověk. Zeptej se zrcadla.",
    "Dnes budeš pracovat o víkendu. Je sice úterý, ale plán je plán.",
    "Dnes se rozhodneš odpočívat víc. Od ledna 2027, s připomínkou.",
    "Dneska se na někoho usměješ bez důvodu. Do kalendáře to nedáš, ale hvězdy si toho všimnou.",
    "Dnes ti někdo pošle neplánovanou zprávu. Zařadíš ji do složky „Nezařazeno“ a odpovíš ve čtvrtek.",
    "Dnes sníš oběd za sedm minut u klávesnice. Hořčice na klávese E bude důkaz.",
    "Dnes přijde pozvánka na poradu bez agendy. Odmítneš ji tak zdvořile, že ti ji pošlou znovu.",
    "Dnes ti kolega nabídne spolupráci. Odpovíš: „Pošli mi to e-mailem.“ Sedíte vedle sebe.",
    "Dneska budeš mít pravdu. Nahlas to říkat nebudeš, stačí, že si to zapíšeš.",
    "Dnes ti někdo řekne „uvolni se“. Založíš si k tomu úkol s termínem.",
    "Dnes zkusíš nic nedělat. Vydržíš čtyři minuty a pak z toho uděláš projekt s milníky.",
    "Dnes ti někdo pochválí práci. Kývneš, zapíšeš a ověříš, že pochvala odpovídá plánu.",
    "Dneska ti přijde, že čas letí. Máš dvanáct úkolů a dvě kávy, takže pocit je správný.",
    "Dnes se někdo zeptá, jestli máš chvilku. Odpovíš: „Dvanáct minut.“ A myslíš to vážně.",
    "Dnes ti někdo navrhne spontánní plán. Zeptáš se, jestli je v kalendáři. Není, tak ho odložíš na příští rok.",
    "Dnes si dáš cíl na příštích deset let. Za deset minut ho rozdělíš na čtvrtletí.",
    "Dneska si vezmeš pauzu na kafe. Po třech minutách ji přejmenuješ na „neformální poradu“.",
    "Dnes u pokladny v Lidlu spočítáš rychlost všech front. Vybereš nejrychlejší a stejně ji předběhne ta vedlejší.",
    "Dnes ti někdo řekne, že vedeš tým výborně. Odpovíš, že žádný tým nevedeš. Pak mu zadáš úkol.",
    "Dnes si najdeš v kalendáři volné odpoledne. Hned ho zaplníš, aby se nezkazilo.",
  ],
  q: [
    "Rezervaci mám na 19:00 a stůl u okna. Přijdu v 18:52, ať si na mě zvyknou.",
    "Víkend? V sobotu dopoledne tři úkoly, odpoledne volno od 14:00 do 14:20. Pojď, využijeme ho spolu.",
    "Odpověď dostaneš zítra v 9:15. Dnes ji nechávám uležet, ať je přesná.",
    "Nádobí zvládnu za 8 minut. Časovač už běží a hrnec z neděle má přednost.",
    "Dovolená? Skvělé. Najdu místo s dobrým signálem a zasedací místností. Pro případ.",
    "Dokument o stavbě dálnic. Nebo cokoli poučného. Jinak se mi večer nezapočítá jako volný čas.",
  ],
};

export default kozoroh;
