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
      "Kozoroh: ambice na dvou nohách a plán, který sahá až do důchodu.",
      "Kozoroh vydrží, co ostatní vzdají. Hory se před ním skromně sklápějí.",
      "Spolehlivost máš jako švýcarské hodinky: ostatní si podle tebe nastavují den.",
    ],
    [
      "Kozoroh má smysl pro humor. Jen ho používá výhradně mimo pracovní dobu.",
      "Odpočívat umíš. Nejdřív to ale zapíšeš do kalendáře a zkontroluješ konflikty.",
      "Tvoje „zvládnu to“ zní spíš jako výhrůžka než jako slib.",
    ],
    [
      "Kozoroh nemá rád zbytečné řeči. Zvlášť ty, které nejsou jeho.",
      "Pracuješ tolik, že se tvoje dovolená bojí přijít.",
      "Tvůj humor je tak suchý, že ho kolegové berou jako technickou poznámku.",
    ],
    [
      "Kozoroh se zeptá „A jaké je z toho ROI?“ i na dětské narozeninové párty.",
      "Ambice pětiletého plánu a empatie čtvrtletního reportu: to je tvoje vizitka.",
      "Tvůj úsměv se objevuje jen po písemném schválení a ověření zdrojů.",
    ],
    [
      "Saturn podal žádost o snížení tvých požadavků. Zamítnuto: „Ty to zvládneš.“",
      "Vesmír tě naplánoval na čtvrté čtvrtletí. Dovolená je ve složce „Příští galaxie“.",
      "Komise ti schválila odpočinek. Tvůj kalendář ho vrátil: nemáme kapacitu.",
    ],
  ],
  c: [
    [
      "Umíš věci dotáhnout. Bez velkých slov, ale s výsledkem, který zůstane.",
      "Myslíš dopředu, dozadu i do jiného časového pásma. Lidé se kolem tebe cítí v bezpečí.",
    ],
    [
      "Úspěch bereš vážně. Vtipy taky, ale jen ty, ke kterým existuje zpětná vazba.",
      "Jsi jako přesný nástroj: spolehlivost, síla a žádné tlačítko „relax“.",
    ],
    [
      "Dovolenou plánuješ čtyři měsíce a pak ji zrušíš kvůli prioritě. Priorita se jmenuje úterý.",
      "Tvůj sarkasmus je tak suchý, že lidé zjistí až za týden, že to byl vtip.",
    ],
    [
      "V sobotu ráno kontroluješ e-maily „jen aby bylo zítra snazší“. Zítra je neděle.",
      "Tvůj životopis má víc kapitol než tvoje fotky z dovolené. Těch je přesně nula.",
    ],
    [
      "Na videohovorech mluvíš tak věcně, že automatické titulky přestanou psát a jen přikyvují.",
      "Kosmický kalendář nemá volné okno pro tvoje potřeby. Když se ho zeptáš, začne se omlouvat.",
    ],
  ],
  v: [
    [
      "Verdikt: pevný základ, tichá síla a perfektně naplánovaný týden.",
      "Hvězdy radí: dopřej si pauzu. Zasloužíš si ji víc, než si myslíš.",
    ],
    [
      "Rada hvězd: občas smaž jednu schůzku. Hvězdy to ocení a nikomu to neřeknou.",
      "Verdikt: ambice, serióznost a trochu míň humoru. Ten tvůj je ale speciální.",
    ],
    [
      "Verdikt: zasloužíš si úspěch. A taky týden, kdy nic neplánuješ. Aspoň na zkoušku.",
      "Rada: zkus jednou odejít z práce před zhasnutím světel. Zjistíš, že budova ještě stojí.",
    ],
    [
      "Verdikt: nejlepší kolega na všechno, kromě dovolené. Tam by se konala porada.",
      "Rada hvězd: štěstí není KPI. Ale klidně si ho zkus vyplnit do kolonky „cíl“.",
    ],
    [
      "Verdikt vesmíru: žádost o odpočinek schválena na příští fiskální rok. Vesmír ale má jen jeden.",
      "Rozsudek: povinná hodina nicnedělání pod dohledem. Samozřejmě předem naplánovaná.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce se na tebe dá spolehnout. Partner ví, že ve čtvrtek bude večeře a v neděli procházka. A že se na ně těší.",
        "Lásku neprojevuješ velkými gesty. Projevuješ ji tím, že máš vždycky nabitý telefon a rezervní deštník.",
        "Partner s tebou zažije bezpečí. A někdy i překvapení, pokud ho naplánuješ aspoň týden předem.",
        "Slovo „navždy“ říkáš zřídka. Zato s váhou, kterou by ocenil i notář.",
      ],
      [ // úroveň 2
        "Rande plánuješ s předstihem. Partner ocení spolehlivost a také to, že restauraci znáš líp než majitel.",
        "Citlivost máš, jen ji schováváš hluboko. Partner se k ní dostane, ale potřebuje vstupní kartu.",
        "Romantika u tebe znamená rezervaci stolu na 19:00. Přesně. Svíčky jsou bonus.",
        "Říkáš „miluju tě“ stejně jako „podepsáno“. Pevně, jednou a s datem.",
      ],
      [ // úroveň 3
        "Romantický večer máš v kalendáři mezi „porada s týmem“ a „rezerva“. Partner se s tím naučil žít.",
        "V lásce jsi efektivní. Tak efektivní, že nejdřív proběhne analýza kompatibility a až potom pusa.",
        "Tvůj způsob flirtu: pozveš někoho na kávu a rovnou pošleš agendu. Bod jedna: seznámení.",
        "Partner chce spontánnost. Ty ji slíbíš v kalendáři: čtvrtek, 18:00 až 18:30.",
      ],
      [ // úroveň 4
        "Romantickou večeři zahajuješ větou „Pojďme probrat naši trajektorii.“ Svíčky zhasnou samy.",
        "Partner se ptá, jestli ho miluješ. Odpovíš: „Trend je pozitivní.“",
        "Líbánky jsou rozepsané po minutách. Partner mezitím prosí o jednu minutu bez plánu.",
        "Dárek k výročí je vždycky praktický. Partner už dostal sadu nožů, kufr a pojištění domácnosti.",
      ],
      [ // úroveň 5
        "Kupid se pokusil zamířit na tvoje srdce. Šíp se zasekl v kalendáři na položce „Pozdější revize“.",
        "Mezigalaktický úřad pro srdce odmítl tvoji žádost o lásku. Důvod: chybí příloha C, „emoce“.",
        "Venuše poslala tvému srdci pozvánku. Přišla automatická odpověď: „Jsem na poradě, vrátím se za tři světelné roky.“",
        "Až se zamiluješ, vesmír vydá tiskovou zprávu. Zatím ji má v konceptu od velkého třesku.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "Práce je tvoje přirozené prostředí. Lidé se kolem tebe uklidňují jako kolem funkčního stroje.",
        "Kolegové ti věří, že když něco řekneš, platí to. V dnešním světě je to vzácnější než dobrá káva.",
        "Dokážeš vést projekt tak, že se nikdo nemusí bát. Hvězdy tu klidnou sílu vidí a obdivují.",
        "Dochvilnost je tvoje superschopnost. Ostatní chodí na schůzky, ty na ně přicházíš o pět minut dřív.",
      ],
      [ // úroveň 2
        "Šéfem být nechceš. Jen se tak často chováš, že to začíná být oficiální.",
        "Poradu zahajuješ přesně v čas. Když někdo mluví déle, začneš nenápadně koukat na hodinky.",
        "Zápis z porady máš pečlivější než protokol ze zasedání OSN. Nikdo ale nechtěl, aby se rozesílal.",
        "Kávu si dáváš v plánovaných intervalech. Chuť je vedlejší efekt.",
      ],
      [ // úroveň 3
        "Tvoje oblíbená destinace je pracovna s oknem. Dovolená je pro tebe teoretický pojem.",
        "Někdo řekne „pojďme to zkusit“ a ty už vidíš tři rizika, dvě závislosti a schůzku, která to celé zastaví.",
        "Tvůj e-mail o pěti slovech má čtrnáct příloh. Nikdo neví, jestli je to zdvořilost, nebo výhrůžka.",
        "Tvrdíš, že nejsi workoholik. Tvrdíš to v neděli, při kontrole e-mailů.",
      ],
      [ // úroveň 4
        "Nejuvolněnější okamžik tvé kariéry nastal při školení o time managementu. Při pauze na kávu.",
        "Tvoje představa work-life balance: práce v týdnu a o víkendu zálohovaná verze práce.",
        "Kolegové tě mají rádi, ale jen na dálku. Zblízka cítí, jak jim ve tvém pohledu běží stopky.",
        "Když na poradě někdo řekne „na chvíli odbočím“, tvůj pohled udělá větší škodu než audit.",
      ],
      [ // úroveň 5
        "NASA nabídla spolupráci na misi na Mars. Odpověď přišla do hodiny: „Harmonogram je příliš volný, posílám revizi.“",
        "Tvoje pracovní morálka má vlastní gravitaci. Planetky se kolem ní stáčejí a hlásí se o přesčas.",
        "Galaktický úřad práce tě zapsal jako „perpetuum mobile“. Kontrola přišla v neděli. Našla tě u e-mailů.",
        "Černá díra pohltila všechny pracovní plány Země. Ten tvůj vyplivla s poznámkou: „Příliš detailní.“",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Život vnímáš jako pevně vystavěný dům. Každý rok přistavíš patro s lepším výhledem.",
        "Jsi člověk, o kterého se ostatní můžou opřít. Hvězdy vidí, jak pevně stojíš.",
        "Máš v životě řád, který působí klidně. Ostatní se v něm cítí jako v knihovně: bezpečně a tiše.",
        "Trpělivost je tvoje superschopnost. Dokážeš čekat na výsledek tak dlouho, až ostatní zapomenou, že ho čekají.",
      ],
      [ // úroveň 2
        "Spontánní chvíle si plánuješ. Do kalendáře, s připomínkou a s poznámkou „zkusit se bavit“.",
        "Máš sklon dělat všechno pořádně. I odpočinek, kterému vyhrazuješ přesně čtyřicet minut.",
        "Narozeniny, svátky, výročí: všechno máš dva týdny dopředu. Překvapení je tvoje slabá stránka.",
        "Řád ti dává klid. Chaos ti dává pocit, že je čas na další seznam.",
      ],
      [ // úroveň 3
        "Vzorec tvého dne: práce, plán, práce, plán. Radost je v poznámce pod čarou, mezi dvěma schůzkami.",
        "Máš tolik pravidel, že spontánnost musí podat žádost. Vyřízení trvá šest až osm týdnů.",
        "Říkáš, že chceš žít v přítomnosti. Přítomnost ti zatím posílá jen pozvánky na schůzky v budoucnosti.",
        "Na pohodu máš protokol. Na štěstí máš přílohu k protokolu. Obojí leží ve složce „Později“.",
      ],
      [ // úroveň 4
        "Tvůj poslední spontánní nápad dopadl v revizi. Komise ho shledala nepřiměřeně spontánním.",
        "Žiješ tak naplánovaně, že ti i překvapení doručují s potvrzenkou a třídenní lhůtou.",
        "Zapisuješ si i věci, které nechceš zapomenout. A pak zapomeneš, kam se ten zápis uložil.",
        "Na otázku „jak se máš?“ odpovídáš statusem projektu: „Na dobré cestě, s rizikem zpoždění.“",
      ],
      [ // úroveň 5
        "Kosmos prošel tvůj život a podal zprávu: „Nenalezeno žádné volné okno. Hledáno dvě miliardy let.“",
        "Zákon entropie říká, že pořádek se rozpadá. Tvůj kalendář podal námitku a vyhrál.",
        "Temná hmota tvoří většinu vesmíru. Tvůj kalendář ji hledá už léta, aby jí přidělil úkol.",
        "Kdyby se tvoje životní plány vytiskly, pokryly by oběžnou dráhu Jupiteru. A i tak by v nich chyběla kolonka „zábava“.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přátelé tě mají jako pevný bod. Když se kolem všechno komplikuje, ty máš záchranné lano a plán B.",
        "Dáváš dárky promyšlené a užitečné. Přátelé si jich cení víc, než dávají najevo.",
        "Nejsi ten, kdo bývá slyšet. Jsi ten, kdo bývá k dispozici. Přátelé si toho opravdu cení.",
        "Slib držíš vždycky. Přátelé už to berou jako přírodní zákon, hned vedle gravitace.",
      ],
      [ // úroveň 2
        "Přátele zveš na oslavy s agendou. Bod 1: přivítání, bod 2: dort, bod 3: rozloučení.",
        "Když přátelé volají, předpokládáš, že jde o věc. Na „jen tak“ musí být předem rezervovaný slot.",
        "Rady dáváš věcně, rychle a bez hlazení. Přátelé je používají, i když zrovna neřeknou díky.",
        "Na zprávy odpovídáš do hodiny. Přátelé začínají tušit, že máš notifikace pod dohledem.",
      ],
      [ // úroveň 3
        "Když přátelé plánují víkend, ty už máš tři varianty a plán úniku. Pláž dostanou jen e-mailem.",
        "Kamarádi o tobě říkají: „Na tebe je spolehnutí.“ Překlad: „Nuda, ale funguje to.“",
        "Do skupinového chatu píšeš jen věcné body. Poslední smajlík je zakonzervovaný jako historický artefakt.",
        "Dárky pro kamarády jsou praktické: powerbanka, termoska, multifunkční nůž. Kamarády to trochu děsí a zároveň zachraňuje.",
      ],
      [ // úroveň 4
        "Na oslavu přijdeš včas, odejdeš v 22:00 a cestou domů zapíšeš, jak se akce povedla. Hodnocení: 7/10.",
        "Kamarád ti řekne, že se rozešel s partnerem. Ty se zeptáš: „A máš už plán na příští čtvrtletí?“",
        "Kamarádi tě mají v kontaktech jako „Kozoroh (nepřipravovat překvapení)“.",
        "Pozvánku na kafe posuzuješ jako obchodní nabídku. Chceš podmínky, termín a doložení, že kafe bude dobré.",
      ],
      [ // úroveň 5
        "Mezigalaktická rada přátel vydala nařízení: „Kozoroh se smí zvát jen s patnáctidenním předstihem.“",
        "Tvoje přátelství funguje jako satelit: přesně na oběžné dráze, nikdy mimo plán. Jen občas přijde signál: „Díky, ahoj.“",
        "Kosmická pošta doručila přátelům pozvánku od tebe. Obsahovala agendu, tři přílohy a poznámku: „Přineste vlastní nadšení.“",
        "Mezi hvězdami se šíří legenda o Kozorohovi, který přišel na sraz pozdě. Je to nejhlubší tajemství vesmíru.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš tiše, ale poctivě. Dort je dobrý, dárky promyšlené a přání úplně upřímná.",
        "Nejraději dostáváš věci, které se dají použít celý rok. Hvězdy ocení tvoji praktičnost.",
        "Narozeniny ti připomínají, že čas plyne. Ty se s ním přátelíš, protože máš dobrý plán.",
        "Když ti hosté zazpívají, tváříš se klidně. Uvnitř tě ale hřeje, že se na tebe někdo vůbec dívá.",
      ],
      [ // úroveň 2
        "Oslavu máš naplánovanou na hodinu. Hosté se pak ptají, jestli existuje i druhá hodina.",
        "Přání si zapisuješ do složky „Narozeniny“. Odpověď na každé máš připravenou do týdne.",
        "Svíčky na dortu sfoukáváš pravidelně a s rozmyslem. Přání je vždycky praktické.",
        "Dárky otevíráš s poznámkami: dárce, užitečnost, doba použití. Vděčnost je ale upřímná.",
      ],
      [ // úroveň 3
        "Nejlepší dárek pro tebe: diář. Nejhorší: překvapení s jiným datem. A hned po něm překvapení s hosty.",
        "Narozeniny slavíš v pracovní pauze, přesněji mezi 17:00 a 19:00. Pak začíná noční směna e-mailů.",
        "Na oslavě běží plánovaný program: úvod, krájení dortu a krátké hodnocení spokojenosti hostů.",
        "K narozeninám si přeješ klid. Do pěti minut už hodnotíš, jestli se přání splnilo.",
      ],
      [ // úroveň 4
        "Na oslavu máš v kalendáři zapsaný odchod. Hosté to berou jako přísný dozor nad zábavou.",
        "Pozvánka na tvoje narozeniny obsahuje čas, místo, dress code a vedlejší cíl večera. Hosté se bojí otázky na výsledky.",
        "Svíčky sfoukneš za tři vteřiny, přání už je v kalendáři a dort se dělí podle předem připravené mapy.",
        "Hosté ti zpívají „Hodně štěstí“. Ty kontroluješ, jestli se nezpívá déle, než bylo domluveno.",
      ],
      [ // úroveň 5
        "Vesmír ti poslal přání k narozeninám s přílohou: „Pozdní oznámení o zpoždění o jeden oběh kolem Slunce.“",
        "NASA tvoje narozeniny zařadila mezi astronomické události: nastávají jednou ročně a vyžadují potvrzení.",
        "Galaxie ti poslala přání: včas, s podpisem dvou planet a s poznámkou, že úsměv bude dodán ve čtvrtém čtvrtletí.",
        "Svíčky zhasínáš tak důsledně, že černá díra žádá o školení.",
      ],
    ],
  },
  s: [
    ["Hodin schůzek týdně", "27"],
    ["Dovolené využité z nároku", "9 %"],
    ["Kalendářů, které spravuješ", "3"],
    ["Pravdivost věty „dnes končím včas“", "0 %"],
    ["Sobotních e-mailů", "11"],
    ["Pravděpodobnost úsměvu před kávou", "4 %"],
  ],
  d: [
    "Dnes se ti podaří všechno naplánovat. Hvězdy čekají, co se pokazí. Je to nejzajímavější část dne.",
    "Saturn ti dnes říká: dnes odejdi včas. Ty zapíšeš do kalendáře: „Zvážit odchod včas“.",
    "Dnes ti někdo řekne, že máš zasloužený odpočinek. Ty odpovíš: „Schválím ho v pátek.“",
    "Dnešní konstelace: tabulka, káva, tabulka. Kozoroh v zenitu.",
    "Dnes se ti zdá, že všichni zaostávají. Hvězdy ti doporučují poslat jim milou tabulku.",
    "Dnes budeš pracovat o víkendu. Je ale dnes úterý. To nevadí, plán platí.",
    "Dnes se rozhodneš, že budeš víc odpočívat. V roce 2027.",
    "Dnešní tip: usměj se na někoho bez důvodu. Tohle nedáš do kalendáře, ale hvězdy si toho všimnou.",
    "Dnes ti někdo pošle neplánovanou zprávu. Zpracuješ ji do tří dnů ve složce „Zpráva, nezařazeno“.",
    "Dnes se ti poštěstí vtipně reagovat na poradě. Nikdo si toho nevšimne. Hvězdy ti zatleskají zvlášť.",
    "Dnes si dáš oběd u stolu, u počítače, v sedmi minutách. Hvězdy se zeptají, jestli to byl plán A, nebo plán B.",
    "Dnešní varování: pokud ti někdo zavolá „pojďme na kafe“, ověř, že to není v kalendáři jako „schůzka“.",
    "Dnes odejdeš z práce včas. Hvězdy to zapíšou jako vzácný úkaz a svolají tiskovku.",
    "Dneska ti někdo řekne „uvolni se“. Zapíšeš si to jako úkol s termínem.",
    "Dnes přijde pozvánka na schůzku bez agendy. Hvězdy tě sledují, jak to ustojíš.",
    "Dnes ti kolega nabídne spolupráci. Ty odpovíš: „Pošli mi to e-mailem.“ Sedíte vedle sebe.",
    "Dneska budeš mít pravdu. Nahlas to říkat nebudeš. Hvězdy to ocení a zapíšou do protokolu.",
    "Dnes se ti poštěstí sedm minut ticha. Hvězdy doporučují využít je a necpat do nich schůzku.",
    "Dnešní horoskop: stabilita, pořádek a neočekávaná chuť na koláč. Obojí si můžeš dovolit.",
    "Dnes si dáš cíl na příštích deset let. Hvězdy čekají na pravidelný report.",
    "Dnes se někdo zeptá, jestli máš chvilku. Odpovíš: „Mám dvanáct minut.“ A myslíš to vážně.",
    "Dneska zkusíš nic nedělat. Vydržíš čtyři minuty a pak z toho uděláš meditační projekt.",
    "Dnes ti někdo pochválí práci. Kývneš, zapíšeš a zkontroluješ, že pochvala sedí do plánu.",
    "Dneska ti přijde, že čas letí. Hvězdy poukazují, že je to proto, že máš dvanáct úkolů a dvě kávy.",
  ],
  q: [
    "Mám rezervaci na 19:00. Přesně. Přijdu v 18:52. Ani o minutu dřív ani později.",
    "Víkend? Mám tři pracovní úkoly, jednu schůzku a dvacet minut na „volný čas“. Můžeme ho využít spolu.",
    "Odpověď připravím do zítra. Zítra také bude plán na pozítří.",
    "Nádobí je v režimu „nutné a efektivní“. Dám ti 8 minut a časovač. Jdeme.",
    "Dovolená? Skvělé. Zjistím, kde je dobré připojení. Pokud možno s konferenční místností.",
    "Dokument o vývoji kapitálových trhů. Nebo něco poučného. Jinak se mi film nezapočítá.",
  ],
};

export default kozoroh;
