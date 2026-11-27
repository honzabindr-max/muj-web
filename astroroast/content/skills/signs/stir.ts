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
      "Štír: hloubka, věrnost a paměť, která si schová i to hezké.",
      "Vidíš víc, než říkáš. A říkáš tak akorát, aby to znělo záhadně.",
      "Komu dáš důvěru, tomu dáš klíč od celého domu. I od sklepa, kde máš archiv.",
    ],
    [
      "Překvapení nesnášíš. Hlavně ta, o kterých se dozvíš jako poslední.",
      "Tvoje pohledy mají vlastní kategorii: „dívám se, protože už to vím“.",
      "Mlčíš tak výmluvně, že za tebe okolí domyslí zbytek. Obvykle hůř, než to bylo.",
    ],
    [
      "Nezapomínáš. Počkáš, až se ostatní uklidní, a pak jim to přečteš i s datem.",
      "Soukromí máš chráněné tak, že i ty potřebuješ razítko na žádost o přístup.",
      "Kamenná tvář ti jde tak dobře, že občas netušíš, co cítíš. Hvězdy to vědí a mlčí z úcty.",
    ],
    [
      "Pomsta je pokrm, který se podává studený. Tvůj je zamrzlý od roku 2019 a pořád v záruce.",
      "Netvrdíš, že se mstíš. Jen přesouváš případ do složky „časem“. Složka má vlastní regál.",
      "Působíš tak tajemně, že u automatu na kávu za tebou nikdo nestojí. Radši o kus dál.",
    ],
    [
      "Pluto svolalo schůzi: co je nevyřízené? Odpověď: nic. Všechno se pamatuje.",
      "Černá díra požádala o přeložení do jiné galaxie. Vedle tebe se necítí dost tajemná.",
      "Vesmír zařadil tvůj pohled mezi živelné pohromy. Kategorie: „Nekomentovat“.",
    ],
  ],
  c: [
    [
      "Věrnost máš do morku kostí. Kdo tě má na své straně, ten má pevnost se zásobami na celý rok.",
      "Všechno prožíváš naplno. I výběr ponožek vypadá u tebe jako rozhodnutí o osudu.",
    ],
    [
      "Tvoje mlčení řekne víc než cizí proslov. Hlavně tohle: pamatuju si.",
      "Máš intuici, která zachytí lež dřív, než ji dotyčný dořekne. Někdy dřív, než ji vymyslí.",
    ],
    [
      "Nikdy nepřiznáš, že se zlobíš. Řekneš „v pořádku“ a v místnosti klesne teplota o tři stupně.",
      "Umíš zvednout obočí tak, že si dotyčný přehraje poslední tři roky. A hledá, co vynechal.",
    ],
    [
      "Tvůj seznam křivd je přesnější než katastr nemovitostí. Má čísla parcel, data i svědky.",
      "Mlčíš dramaticky. S režií, s hudbou a se sedmidenní pauzou na konci kapitoly.",
    ],
    [
      "Pluto se nad tebou sklání a šeptá, že by se od tebe kosmická rozvědka mohla učit. Pak se rozhlédne, jestli neposlouchá někdo další.",
      "Vesmírný archiv zřídil kvůli tobě novou složku. Jmenuje se „Neodpuštěno, ale zapsáno“ a zabírá už tři souhvězdí.",
    ],
  ],
  v: [
    [
      "Verdikt: hloubka, věrnost a špetka záhady. Jen občas mrkni, ať se ostatní nebojí zeptat na čas.",
      "Hvězdy radí: dopřej si pomalé tempo. Kdyby někdo vyzvídal, mlč s hlavou lehce nakloněnou.",
    ],
    [
      "Rada hvězd: zkus dnes říct jednu myšlenku nahlas. Jen pro vědecké účely, bez zápisu.",
      "Verdikt: tajemno, vytrvalost a špetka strašidelnosti. Hvězdy by tě pozvaly na kafe, ale bojí se odpovědi.",
    ],
    [
      "Verdikt: s tebou je dobře i zle. Obojí poctivě zdokumentované, očíslované a odložené.",
      "Rada: přesuň „pamatuju si“ do složky „už je dávno vyřízené“. Hvězdy si toho všimnou a nebudou to komentovat.",
    ],
    [
      "Verdikt: žádná křivda se u tebe neztratí. Škoda, že nikdo neví, kde archiv leží. A kdo má klíč.",
      "Rada hvězd: občas odpusť. Nebo aspoň přepiš ten dokument menším písmem.",
    ],
    [
      "Verdikt vesmíru: archivováno, vyhodnoceno, uloženo. Vyřízení čeká na vhodnou galaxii.",
      "Rozsudek: povinná jedna odpuštěná křivda ročně. Hvězdy provedou namátkovou kontrolu ve tvém sklepě.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Miluješ naplno: komu dáš srdce, tomu celé. Takovou intenzitu nenajde nikdo jinde a partner to ví.",
        "Tvůj pohled řekne víc než deset vyznání. Partner si ho schovává jako pohlednici z dovolené.",
        "Ve vztahu hlídáš: partnerovi uvaříš čaj dřív, než si uvědomí, že mu je zima.",
        "Romantiku umíš vytvořit tak hlubokou, že z ní hned tak nevylezeš. Ani se ti nechce.",
      ],
      [ // úroveň 2
        "„Co se děje?“ – „Nic.“ Partner už ví, že „nic“ je třídílný seriál a první díl právě začal.",
        "Partnerovy zprávy čteš s pozorností detektiva. Mezi řádky tam stojí mnohem víc, než je napsáno, a ty to víš.",
        "Partnerův telefon ti nevadí, tvrdíš. Jen přesně víš, kdy se naposledy rozsvítil.",
        "Na „musíme si promluvit“ máš výraz klidu i bouře. Partner zkoumá, co z toho převáží.",
      ],
      [ // úroveň 3
        "Žárlivost u tebe není emoce, ale metoda. Důkladná, tichá a s vlastním číslováním poznámek.",
        "Říkáš „věřím ti“ tónem, jakým se v detektivce říká „jen jděte dál, nic se neděje“.",
        "Partnerovu starou chybu máš v paměti dokonale. V každé hádce ji vytáhneš jako důkazní materiál D.",
        "Odpouštíš velkoryse: poprvé, podruhé, potřetí. A pak všechno najednou, s odrážkami a daty.",
      ],
      [ // úroveň 4
        "Tvoje „v pořádku“ je tak chladné, že partnerovi zamrzne čaj v hrnku. Pak i pohled.",
        "Partner se u tebe naučí číst pohledy rychleji než řeč. Řeči se ostatně moc nedostává.",
        "Rozchody vedeš jako šachovou partii: ticho, tah a po třech týdnech oznámení mat.",
        "Partner se zeptá, jestli je něco špatně. Odpovíš „ne“. Podrobnosti se dozví v příštích dvou týdnech postupně.",
      ],
      [ // úroveň 5
        "Pluto zřídilo oddělení vztahových křivd. Je celé tvoje. Má vlastní patro, sklep a archiv se zámkem.",
        "Černá díra se rozešla s galaxií. Tvůj komentář: „Amatéři. Bez složky se nerozchází.“",
        "Venuše ti poslala kytici s lístkem „já za nic nemůžu“. Pohled stejně dorazil dřív.",
        "Kosmická rada žádá, aby tvoje pohledy fungovaly aspoň na úrovni „mírně děsivé“. Návrh zamítnut: nikdo ho nechtěl přednést.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci vydržíš tam, kde ostatní vzdají. Vytrvalost máš tichou a jistou jako skála, která nikam neodchází.",
        "Na kolegy je s tebou spolehnutí: co slíbíš, platí. Co si necháš pro sebe, je v bezpečí hlubšího trezoru než v bance.",
        "Problém odhalíš dřív, než z něj bude krize. Máš na to šestý smysl, nebo velmi pečlivý archiv.",
        "U jednání umíš mlčet tak soustředěně, že protistrana doplní, co chceš slyšet, a ještě se omluví.",
      ],
      [ // úroveň 2
        "Na poradě mlčíš hlasitě. Kolegové se ptají, jestli souhlasíš, a pak radši změní téma.",
        "Když ti někdo vezme sešit, víš kdo. Když ti někdo vezme nápad, víš kdy. Neříkáš nic, ale víš.",
        "Tvůj e-mail s „Dobrý den,“ a podpisem bez smajlíku působí na kolegy jako zazvonění po půlnoci.",
        "Kolegové říkají, že působíš tajemně. Ty prostě nevidíš důvod, proč by měli znát tvůj oběd.",
      ],
      [ // úroveň 3
        "Kolegům chyby odpouštíš velkoryse. Jen si je ukládáš do složky, kterou občas otevřeš pro osvěžení paměti.",
        "„Jak to jde?“ – „V pohodě.“ Hvězdy tvrdí, že je to nejděsivější věta v celé pracovní praxi.",
        "Pomsta za špatnou prezentaci ti trvá tři měsíce. Pak kolegovi z porady zmizí oblíbená židle.",
        "V týmu ti říkají „ticho před poradou“. Bojí se, že čteš myšlenky. Ty jen čekáš, jestli se někdo přizná sám.",
      ],
      [ // úroveň 4
        "Když ti kolega vezme zásluhy, neřekneš nic. Počkáš na vánoční večírek a poděkuješ mu pohledem před celým stolem.",
        "Tvoje mlčení na poradě má vlastní rozpočet, dvě židle v zasedačce a občas i právníka.",
        "Na poradě sedíš tak, že máš výhled na všechny a oni na tebe. Nikdo nevstane první.",
        "S kolegy mluvíš pohledy. Dva znamenají „souhlasím“, tři „varování“ a čtyři „už je pozdě“.",
      ],
      [ // úroveň 5
        "Kosmický archiv je napojený na tvoje poznámky. Pluto ho nazvalo „Neodpuštěno, ale odloženo“. Poznámek přibývá rychleji, než vesmír stíhá zapisovat.",
        "Porada v Orionu skončila tím, že se Štír podíval na Merkur. Merkur od té doby obíhá pozpátku.",
        "NASA hlásí nárůst ticha v kanceláři Štíra. Vědci mu říkají „slabé gravitační vlny nevyřčeného“.",
        "Vesmírná firma tě zařadila do oddělení „Neřeknu, ale zapíšu“. Zaměstnanců jeden. Zápisů čtyři miliardy.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Žiješ do hloubky: ne rychle, ne povrchně, ale s chutí na to, co se skrývá pod hladinou.",
        "Máš dar zachytit, co v místnosti chybí. Pak to tiše doplníš a nikdo neví, jak se to stalo.",
        "Hranice máš pevné. Díky nim víš, co chceš, a ostatní to chápou po první větě. Nebo po prvním pohledu.",
        "Intuici máš jako druhý mozek. Obvykle má pravdu. Jen ji občas nenecháš domluvit.",
      ],
      [ // úroveň 2
        "Když ti někdo řekne „nechtěl jsem ti to říkat“, víš všechno. Potřebuješ už jen potvrzení.",
        "Máš tón, kterým říkáš „ach tak“, a ostatní začnou přemýšlet, co provedli. I když nic.",
        "Tvoje místo v kavárně: u zdi, s výhledem na vchod. Nikdy nevíš, kdo vejde, a to se ti nelíbí.",
        "Telefon máš na tichém. Svět může volat, ale ticho je pohodlnější než konverzace.",
      ],
      [ // úroveň 3
        "Říkáš, že nic nevyzvídáš. Přitom o všech víš všechno a nikdo ti nic neřekl.",
        "Tajemství si držíš tak důkladně, že všichni vědí, že nějaké máš. Jen nevědí které.",
        "Na „jaké máš plány?“ odpovíš „uvidíme“. Hvězdy tomu říkají zdvořilé mlčení se zbraní.",
        "Soukromí máš velké jako pevnost. Zvonek chybí, ale kamera nad dveřmi funguje.",
      ],
      [ // úroveň 4
        "Když se na tebe někdo usměje, hledáš v tom úmysl. Většinou ho najdeš, jen proto, že ho tam hledáš.",
        "Sítě máš pod kontrolou: sleduješ všechny a tebe nevidí nikdo. Vzorová špionážní operace s profilovkou kytky.",
        "Máš seznam lidí, kterým nevěříš, a seznam těch, kterým věříš. Ten druhý se vejde na vizitku.",
        "Máš pocit, že všichni mají tajemství. Máš pravdu a největší z nich je, že to zjišťuješ ty.",
      ],
      [ // úroveň 5
        "Pluto zřídilo pro tvou intuici oddělení radaru. Když se někdo usměje, spustí se sirény a otevře se spis.",
        "Černá díra má méně tajemství než ty. Při srovnání prý požádala o přeložení do jiného vesmíru.",
        "Kosmická rozvědka ti nabídla místo agenta. Odpověď: „Já už pracuju. Pro sebe. A pro Pluto.“",
        "Když se podíváš do dalekohledu, hvězdy rychle změní dráhu. Nikdo nechce vysvětlovat, co dělal včera.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Pro přátele jsi jako hora: stojí a drží. Kdykoli je potřeba, jsi tam, a bez zbytečných řečí.",
        "Přátel nemáš mnoho, ale ti, které máš, jsou napořád. Takovou kvalitu nesbírá nikdo jiný.",
        "Když se ti kamarád svěří, jeho tajemství je v bezpečí. Bezpečněji než ve většině trezorů.",
        "Poznáš, kdy kamarád potřebuje mlčet a kdy mluvit. A bezchybně poznáš, kdy potřebuje pizzu.",
      ],
      [ // úroveň 2
        "Přátelé tě oslovují opatrně, jako když někdo drží krabici s nápisem „nešťourat“.",
        "Na srazu sedíš tak, že máš výhled na dveře i na všechny. Říkáš tomu pohodlí.",
        "Když kamarád zapomene tvoje narozeniny, usměješ se. Ten úsměv ponese ještě roky.",
        "Skupinový chat čteš, ale neodpovídáš. Přátelé to berou jako dobrou zprávu: žiješ a čteš. Hlavně čteš.",
      ],
      [ // úroveň 3
        "Přátelství u tebe funguje jako smlouva: stálé, oboustranné a s přílohou o případných křivdách.",
        "Tvoje „já tě chápu“ znamená „je to v poznámkách“. Přátelé si nikdy nejsou jistí.",
        "Když se ti kamarád omluví, odpustíš. Zároveň otevřeš složku se třemi podobnými případy z minulé dekády.",
        "Pro přátele uděláš cokoli. Jen musejí počítat s tím, že ti to budou oplácet tichem.",
      ],
      [ // úroveň 4
        "Kamarád ti svěří tajemství a ty ho zamkneš tak hluboko, že ho nenajde ani on. Příště se ptá, jestli si ho pamatuješ.",
        "„Zlobíš se?“ – „Ne.“ Dvanáct měsíců se pak neděje nic. A potom všechno.",
        "Přátelství máš jako pojistku: funguje dokonale, dokud ji někdo nezkusí obejít. Pak je slyšet celý panelák.",
        "Máš krátký seznam přátel a dlouhý seznam jejich proher. Naštěstí ho přátelé nečtou.",
      ],
      [ // úroveň 5
        "Přátelé z vedlejší galaxie ti poslali přání. Pluto ho zadrželo k přezkoumání, protože v textu chyběla tři slova upřímnosti.",
        "Mléčná dráha pořádá oslavu přátelství. Štír přišel, sedl si do rohu a pozoroval. Do rána se u něj vystřídalo pět souhvězdí.",
        "Při vesmírném srazu se Slunce zeptalo: „Jsi v pohodě?“ Odpověď „jo“ způsobila, že Slunce na hodinu zhaslo.",
        "Souhvězdí tvých přátel je vzácné: čtyři hvězdy, jedna černá díra a dlouhá historie vzájemně zamlčených věcí.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš v klidu a s lidmi, na kterých záleží. Menší oslava, větší jistota, že je to pravé.",
        "Každé přání od blízkých si pamatuješ zvlášť. Hlavně to, které zahřálo.",
        "Dárek od tebe je osobní, promyšlený a zabalený s tichým záměrem, aby se obdarovaný cítil viděný.",
        "Dort sfoukneš se zavřenýma očima a tajným přáním. Nikomu ho neřekneš, ale úsměv prozradí víc.",
      ],
      [ // úroveň 2
        "„Co si přeješ?“ – „Nic.“ Přesněji: nic, co by se dalo říct nahlas.",
        "Slavíš ve čtyřech lidech. Z původních dvaceti pozvaných zbyli jen ti, kdo si to zaslouží.",
        "Přání od lidí, které dlouho nevidíš, čteš pozorně. Zvlášť to, co v nich chybí.",
        "Na oslavě mluvíš málo a pozoruješ hodně. Hosté mají pocit, že je někdo hodnotí. Je to pravda.",
      ],
      [ // úroveň 3
        "Narozeniny jsou pro tebe test. Kdo se ozve včas, dostane bod. Kdo pozdě, dostane vysvětlení.",
        "Seznam hostů vypadá nevinně, ale má sedm příloh o tom, kdo se za poslední dva roky zasloužil.",
        "Řekneš „žádné dárky“ a pak sleduješ, kdo co přinese. A kdo ne. Všechno jde do evidence.",
        "Dárek, který zklame, přijmeš s úsměvem. Pod úsměvem je poznámka: „zapamatováno“.",
      ],
      [ // úroveň 4
        "Na tvých narozeninách se hosté bojí zeptat, jestli si můžou vzít další kousek dortu. Dort má ochranku.",
        "Narozeniny slavíš tak tajemně, že pozvánka dorazí třem lidem. A vždycky těm, kdo nevěděli, že jsou na seznamu.",
        "Přání od lidí, kteří ti nesedí, čteš pozorně. Pak je archivuješ. Pro příští ročník.",
        "Dárek, který tě zaujal, uložíš na bezpečné místo. Ten, který ne, na bezpečné místo číslo dvě.",
      ],
      [ // úroveň 5
        "Pluto si na tvoje narozeniny zarezervovalo celý měsíc. Hostů bylo pět a jeden meteorit. Nikdo se nezeptal, proč zrovna on.",
        "NASA připravuje oslavu tvých narozenin ve stratosféře. Pozvánka je tajná a hosté mají hlavně držet jazyk za zuby.",
        "Narozeninový dort zatemnil Slunce. Důvod: obsahoval příliš mnoho tajemství a sedm černých svíček.",
        "Vesmír ti zazpíval „Hodně štěstí“. Pak ztichl a nechal se pozorovat. Nikdo nevěděl, jestli se ptá, nebo hodnotí.",
      ],
    ],
  },
  s: [
    ["Zapamatovaných křivd", "2 311"],
    ["Pohledů „vím“ denně", "18"],
    ["Tajemství, o kterých nikdo neví", "31"],
    ["Pravdivost věty „jsem v pohodě“", "0 %"],
    ["Pomalu servírovaných pomst", "4"],
    ["Slov, která dnes padla nahlas", "47"],
  ],
  d: [
    "Dnes ti někdo řekne něco nepříjemného. Zapíšeš si to s datem a časem. Hvězdy čekají, jestli to otevřeš ještě letos.",
    "Pluto dnes radí: nic neříkej, jen se dívej. Atmosféra zbytek zařídí.",
    "Dnes budeš působit tak tajemně, že se tě v kanceláři nikdo nezeptá ani na čas.",
    "Dnešní konstelace: dlouhý pohled, krátká věta a paměť bez data expirace.",
    "Dnes ti kdosi odpoví na zprávu o tři dny později. Ty odpovíš za tři dny. Přesně stejně.",
    "Dnes budeš mít potřebu zkontrolovat něčí profil. Ne proto, že je to důležité. Prostě proto. Nepřiznáš to.",
    "Dnes se dozvíš pravdu. Ty ji znáš už dávno. Chyběl ti jen důkaz a stačí snímek obrazovky.",
    "Dnešní tip: usměj se. Hvězdy tvrdí, že naposledy to bylo před dvěma lety. Prý něco rušilo.",
    "Dnes se tě někdo zeptá „co se děje?“. Odpověď: „nic.“ Překlad: sedmidílná sága, první díl zítra.",
    "Dnes tě čeká překvapení. Nikdo neví jaké. Ty už ano. Jen nic neřekneš.",
    "Pohled, který ti dnes někdo věnuje na poradě, budeš rozebírat tři hodiny. Ten člověk o něm nic neví.",
    "Telefon dnes zazvoní a ty ho necháš vyzvánět do konce. Ať si ten druhý zvykne, jaké to je.",
    "Zeptáš se „jak se máš?“ a doufáš v upřímnost. Dostaneš „dobře“. Nevěříš, ale kývneš.",
    "Někdo ti dnes řekne „dlouho jsme se neviděli“. Ty si zapíšeš přesný počet týdnů. A kdo se neozval.",
    "Dnes tě někdo chvíli pozoruje. Vydržíš to o tři vteřiny déle a vyhraješ. Nikdo neví, že se soutěžilo.",
    "V kavárně si dnes vybereš místo se zdí za zády. Hvězdy tomu říkají strategie. Ty pohodlí.",
    "Dnes ti někdo svěří tajemství. Zamkneš ho do hloubky k dalším čtyřem a jednomu z roku 2016.",
    "Dnes se rozhodneš odpustit. Vydržíš to do oběda.",
    "Někdo ti dnes vrátí půjčenou knihu o týden později. Neřekneš nic. Pohled ale dostane poznámky pod čarou.",
    "Dnes ti někdo nepozdraví. Uložíš to do složky „Zatím nic“. Složka roste tak, že se jí brání regál.",
    "Dnes ti někdo řekne „nezlob se“. Hvězdy poznamenají: dobrá taktika, ale přišla o dva týdny pozdě.",
    "Někdo se tě zeptá, co děláš večer. Odpovíš „mám plány“. Nikdo se nezeptá dál a ty to oceníš.",
    "Zpráva „musíme si promluvit“ dorazí v poledne. Ticho potrvá tři hodiny. Odpověď bude mít dvě slova.",
    "Dnešní horoskop pro Štíra: nic. Totiž nic, co by šlo říct nahlas. A hvězdy mlčí taky.",
  ],
  q: [
    "Vyberu místo, které znám. Sednu si ke zdi, kde vidím na vchod. Ať vím, kdo přišel a s kým.",
    "Víkend je můj. Nikdo se nezeptá, co dělám. A já nikomu neřeknu, že nic.",
    "Odpověď poslat můžu. Ještě nevím, jestli dnes, nebo až dotyčný pochopí, co provedl.",
    "Umyju to. A přitom si budu pamatovat, kdo tam ty hrnky nechal. Ale nic neřeknu.",
    "Tam, kam nikdo nejezdí. Kde nás nikdo nehledá a nikdo se neptá proč.",
    "Něco, kde všichni lžou a já to vím od první scény. Nahlas to neřeknu. Budu jen kývat.",
  ],
};

export default stir;
