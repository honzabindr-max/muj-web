// AstroRoast.ai: původní české texty varianty Codex pro znamení Vodnáře.
// Tvar RawSign: h = 3 titulky, c = 2 hlavní věty, v = 2 verdikty na každou z pěti úrovní.
// t = témata vztahy, prace, zivot, pratele, narozeniny; každé má 5 úrovní po přesně 4 větách.
// s = 6 falešných statistik [popisek, krátká hodnota]; d = 24 denních vět bez skutečných předpovědí.
// q = 6 párových odpovědí v pořadí COUPLE_SITUATIONS v shared.ts.
// Indexy 0–4: Pohlazení, Šťouchnutí, Sarkasmus, Roast, Kosmická poprava.
// Hotové věty bez zástupných značek; oslovení ve druhé osobě bez určení rodu.
// Terčem je vodnářský stereotyp: nezávislost, nekonvenčnost, teoretizování a odstup.

import type { RawSign } from "../../types";

const vodnar: RawSign = {
  h: [
    [
      "Umíš najít nové dveře. I tam, kde ostatním stačí okno.",
      "Díky tobě má i obyčejný den možnost překvapit.",
      "Máš dar ptát se jinak. I návod si vedle tebe rozšíří obzory.",
    ],
    [
      "Jdeš vlastní cestou. Jen kvůli ní občas přesouváš přechod.",
      "Na obyčejnou otázku máš lehce experimentální odpověď.",
      "Než řekneš „souhlasím“, potřebuješ to nazvat jinak.",
    ],
    [
      "Máš vlastní názor. Počkáš si jen, s čím můžeš nesouhlasit.",
      "Máš řešení budoucnosti. Současnost zřejmě nemá správný konektor.",
      "Vyžaduješ otevřenou debatu. Výsledek máš připravený.",
    ],
    [
      "Na banalitu odpovídáš manifestem. I tvoje rohožka má programové prohlášení.",
      "Máš tolik vlastních cest, že se u tebe ztrácí i odbočka.",
      "Vymýšlíš nový svět, protože v tomhle se musí odpovídat na zprávy.",
    ],
    [
      "Zakládáš konkurenční vesmír. Tenhle má moc uživatelů.",
      "Připomínkuješ velký třesk. Prý moc obvyklý začátek.",
      "Žádáš o vlastní časoprostor. Sdílená realita tě omezuje.",
    ],
  ],
  c: [
    [
      "Umíš ostatním ukázat možnost, které si nevšímají. Někdy je to nový směr, jindy vedlejší vchod.",
      "Dáváš prostor i nezvyklým nápadům. Vedle tebe se nemusí stydět ani židle s ambicemi na houpačku.",
    ],
    [
      "U všeho se ptáš „proč zrovna takhle?“. I u dveří, které máš jen přivřít.",
      "Máš slabost pro neobvyklá řešení. Občas jen otočíš židli a už sedíš v budoucnosti.",
    ],
    [
      "Přijímáš všechny názory. Ty shodné s tvým jsou jen o něco přijatelnější.",
      "Měníš svět v teoretické rovině. V té praktické hledáš nabíječku.",
    ],
    [
      "Bojuješ proti škatulkám tak urputně, že máš vlastní škatulku s nápisem „proti škatulkám“ a zákazem vstupu.",
      "Svými vizemi přepisuješ dějiny. Bohužel hlavně dějiny úkolu „vynést papír“, který se táhne už třetí civilizaci.",
    ],
    [
      "Zakládáš úřad proti byrokracii na Uranu. K podání odporu vyžaduješ tři mlhoviny a ověřenou kopii nekonečna.",
      "Kvůli své nezávislosti obíháš mimo všechny soustavy. Už i černá díra ti posílá zprávu „aspoň dej vědět“.",
    ],
  ],
  v: [
    [
      "Přinášíš čerstvý vzduch. A občas s ním i návrh na lepší okno.",
      "Umíš rozsvítit nový nápad. I obyčejná lampička ti fandí.",
    ],
    [
      "Máš vlastní rytmus. Jen na něj těžko sladíš čas srazu.",
      "Přemýšlíš mimo zavedené koleje. Občas i mimo otázku.",
    ],
    [
      "Máš náskok před dobou. Tak značný, že na výsledky ještě nedohlédneš.",
      "Trváš na nezávislosti. Zejména na ověřování vlastních teorií.",
    ],
    [
      "Máš vlastní proud myšlení. Zatím s ním poháníš jen větrák na svoje výmluvy.",
      "Odmítáš jít s davem. I kdyby všichni ostatní šli ven a ty do kumbálu.",
    ],
    [
      "Vznášíš námitku proti gravitaci. Vyřízení čekej po doručení razítka ze středu Slunce.",
      "I za hranicí vesmíru hledáš méně známý vesmír. Tenhle už podle tebe objevuje moc lidí.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Umíš milovat bez předepsaného scénáře. I obyčejné „pojď ven“ s tebou získá trochu dobrodružství.",
        "Dáváš ve vztahu prostor vlastnímu světu toho druhého. Jen občas nakoukneš s návrhem na vylepšení.",
        "Pamatuješ si neobvyklé drobnosti. Třeba oblíbený mrak člověka, na kterém ti záleží.",
        "Zajímá tě, jak druhý člověk přemýšlí. Máš tím pádem námět i na šestou společnou procházku.",
      ],
      [ // úroveň 2
        "Na otázku „co mezi námi je?“ kreslíš zajímavé schéma. Malé srdíčko doplníš až na vyžádání.",
        "Místo běžného vyznání posíláš článek, který tě nadchne. Romantika má dnes dvanáct stran a poznámky pod čarou.",
        "Rande plánuješ neotřele. Už samotné hledání vchodu je malá seznamovací hra.",
        "Chceš si ve vztahu zachovat volnost. I společnému nákupnímu seznamu proto říkáš nezávazná inspirace.",
      ],
      [ // úroveň 3
        "Na „chybíš mi“ odpovídáš úvahou o prostoru. Technicky držíš téma.",
        "Hlásáš vztah bez pravidel. Kromě toho, že nesmí mít pravidla. Na tom trváš.",
        "Před rozhovorem o citech si ujasníš pojmy. Ke třetímu výročí se dostáváte k definici slova „my“.",
        "Zajímáš se o budoucnost vztahů. Ten současný mezitím čeká na odpověď.",
      ],
      [ // úroveň 4
        "Na společné fotce si necháváš tolik prostoru, že na ni musí navázat katastrální mapa.",
        "Tolik bráníš nezávislost, že i polštáře odděluješ státní hranicí. Polibek řešíš přes celní správu.",
        "Na otázku „máš mě vůbec v plánu?“ předkládáš výhled rozvoje lidstva. Jedno obejmutí tam hledáš ve třetí příloze.",
        "Na vyznání chystáš tak odbornou odpověď, že romantickou atmosféru přeruší komise s laserovým ukazovátkem.",
      ],
      [ // úroveň 5
        "Na společné bydlení máš vesmírný plán: každý vlastní galaxii, kuchyň sdílenou přes červí díru.",
        "Kvůli volnosti žádáš Venuši o sedmnáct měsíců odstupu. Na výročí posíláš souřadnice náhradního vesmíru.",
        "Při slově „závazek“ zřizuješ velvyslanectví za horizontem událostí. Návštěvní hodiny určuješ před vznikem času.",
        "Na vyznání lásky odpovídáš mezihvězdnou dohodou o autonomii. K podpisu přikládáš prstýnek ze Saturnu, každý jeho konec jinde.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "Umíš objevit jednodušší postup. Občas mu jen pro radost vymyslíš složitější název.",
        "Na poradě dáváš šanci i tichým nápadům. Dokonce i tomu, který zatím existuje jen na ubrousku.",
        "Ptáš se na věci, které ostatní berou jako dané. Díky tobě má i stará tabulka nové možnosti.",
        "Dovedeš propojit zdánlivě nesouvisející věci. Pracovní úkol i zajímavý brouk mají u tebe místo na stejné nástěnce.",
      ],
      [ // úroveň 2
        "Na zadání „přejmenuj složku“ reaguješ návrhem nového způsobu ukládání. Složka si zatím nechává staré jméno.",
        "Na poradu přinášíš odvážný nápad. Třeba že příští poradu nahradíte něčím, co bude taky porada, ale jinak.",
        "Pracovní postup bereš jako první nabídku. Následuje tvoje oblíbená část: drobné filozofické vyjednávání.",
        "U každého úkolu najdeš prostor k inovaci. Sešívačku si kolegové pro jistotu schovávají.",
      ],
      [ // úroveň 3
        "Na termíny máš moderní pohled. Považuješ je za historický přežitek ještě před jejich uplynutím.",
        "Dodáváš vizi, směr i koncepci. Hotový soubor by celou věc jen zbytečně konkretizoval.",
        "Necháváš nápady zrát. Ve složce „aktuální“ už máš pěknou časovou kapsli.",
        "Ke každému řešení navrhuješ alternativu. Práci tím přiděluješ těm, kdo si dovolí mít řešení.",
      ],
      [ // úroveň 4
        "Na připevnění poličky zakládáš inovační oddělení. Zeď má strategii, polička leží na zemi.",
        "Komplikuješ jednoduché věci tak důkladně, že na výměnu toneru potřebuje kancelář stavební povolení.",
        "Místo zápisu z porady píšeš manifest. Tiskárna už plive letáky a nikdo neví, kdy odevzdat výkaz.",
        "Odmítáš pracovní šablony s takovou vášní, že pátým rokem ručně vyrábíš vlastní tlačítko „uložit“.",
      ],
      [ // úroveň 5
        "Na jednoduchý úkol svoláváš radu galaxií. Než schválíš zápis, mění Slunce adresu a porada pokračuje jako mlhovina.",
        "Přesouváš termín za hranice času. Oddělení mezihvězdné docházky ti vrací výkaz: nekonečno není pracovní den.",
        "Navrhuješ předělat gravitaci na dobrovolnou. Pracovní stůl ti už třetí světelný rok obíhá kolem vedoucího.",
        "Zakládáš vlastní galaxii pro nápady bez hranic. První tři soustavy věnuješ prezentaci, čtvrtou vysvětlení, proč ještě nic nefunguje.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Umíš se nadchnout i pro obyčejnou věc. Konvice s tebou má šanci na zajímavou druhou kariéru.",
        "Dáváš všednímu dni nový úhel. Třeba tím, že si čteš v předsíni, kde je překvapivě hezké světlo.",
        "Nebojíš se zkusit jinou cestu. Díky tobě zná okolí i lavičku, o které mapa diskrétně mlčí.",
        "Všímáš si možností tam, kde jiní vidí hotovou věc. I prázdná krabice u tebe zažívá slibný začátek.",
      ],
      [ // úroveň 2
        "Návod si přečteš až po vlastním pokusu. Bereš ho jako zajímavý názor výrobce.",
        "Na automatických dveřích tě láká hlavně možnost projít neautomaticky.",
        "Při zařizování pokoje myslíš dopředu. Tak daleko, že současná zásuvka zůstává za skříní.",
        "Zkoušíš nový způsob organizace dne. Prozatím potřebuješ volné dopoledne na jeho vysvětlení.",
      ],
      [ // úroveň 3
        "Odmítáš dělat věci ze zvyku. Své odmítání praktikuješ každý den ve stejnou dobu.",
        "Ceníš si myšlení mimo rámec. Obraz na zdi podle toho visí bez rámu už třetí rok.",
        "Běžné řešení přijmeš, jakmile zjistíš, že je natolik běžné, až už ho nikdo nepoužívá.",
        "Na každou drobnost máš vlastní systém. Jeho údržbou šetříš přibližně záporných šest hodin týdně.",
      ],
      [ // úroveň 4
        "I na párování ponožek píšeš manifest proti uniformitě. Pračka je jediná, kdo se tím řídí bez připomínek.",
        "Přepracováváš zvonek, aby nezněl jako ostatní. Návštěva teď před dveřmi luští šestiminutovou zvukovou instalaci.",
        "Nezávislost předvádíš i navigaci. Třikrát obkroužíš stejný kruháč, jen aby ti neurčovala směr.",
        "Z obyčejného věšáku děláš protest proti vlastnictví. Bunda leží na zemi a tvoje předsíň vyžaduje komentovanou prohlídku.",
      ],
      [ // úroveň 5
        "Odmítáš obíhat Slunce podle jízdního řádu. Zakládáš si vlastní úterý a Země tě v něm smí navštívit na pozvánku.",
        "Hledáš tak neobvyklou cestu domů, že na přestup čekáš uvnitř černé díry. Stále tvrdíš, že je to zkratka.",
        "Přepisuješ přírodní zákony na doporučení. Sousední galaxie teď žádá o příspěvek na odchyt tvého nábytku.",
        "Zakládáš vesmír bez škatulek. Pro každý atom ovšem vyžaduješ potvrzení, že se nikdy nestane součástí krabice.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Umíš propojit lidi, které by nenapadlo dát ke stejnému stolu. Debata pak nepotřebuje ani společné téma.",
        "Dáváš přátelům pocit, že jejich zvláštnosti mají místo. U tebe dokonce čestné místo u okna.",
        "Vytáhneš partu za něčím neobvyklým. Někdy stačí i výstava, na které nikdo neví, co je věšák.",
        "Zajímáš se o nápady druhých. I kamarádův vynález držáku na druhý držák u tebe najde publikum.",
      ],
      [ // úroveň 2
        "Do skupinové domluvy posíláš třetí možnost. I když se rozhoduje jen mezi ano a ne.",
        "Na sraz přinášíš nové téma. Nejdřív ale partě vysvětlíš, proč je dosavadní téma společenský konstrukt.",
        "Přátelům doporučuješ zapadlé místo. Jakmile tam začnou chodit, doporučuješ jiné.",
        "Ve společné fotce hledáš prostor pro originalitu. Zpravidla se proto díváš na úplně jiný fotoaparát.",
      ],
      [ // úroveň 3
        "Chceš partu samostatně myslících lidí. Shoda na tvém návrhu je pro tebe důkaz samostatného myšlení.",
        "Na organizaci srazu nemáš čas. Pracuješ na návrhu společnosti, ve které se srazy organizují samy.",
        "Přátele bereš takové, jací jsou. S několika nezávaznými návrhy, jací by ještě mohli být.",
        "Odpovídáš, až máš co říct. Na otázku „v kolik?“ to u tebe vyžaduje nečekaně hlubokou přípravu.",
      ],
      [ // úroveň 4
        "Při domlouvání srazu rozebíráš pojem „spolu“. Parta už sedí v parku a lavička má za tebe stoprocentní účast.",
        "Společný seznam písniček bereš jako prostor k osvětě. Po tvé hodinové nahrávce zvuku mostu slaví parta refrén i u mikrovlnky.",
        "Ke každému oblíbenému místu nabízíš méně známé. Nakonec vítězoslavně svoláš partu do chodby, kde se nesmí stát.",
        "Přátelství obohacuješ tolika teoriemi, že se parta před obyčejným posezením začíná učit na přijímačky.",
      ],
      [ // úroveň 5
        "Partě posíláš polohu z jiného rozměru. Kdo tě chce najít, musí nejdřív stáhnout druhou fyziku.",
        "Na společnou večeři zveš všechny myslící bytosti vesmíru. Pak prosazuješ malý stůl, protože velké akce už jsou moc známé.",
        "Přátelům slibuješ rychlou odpověď po oběhu Neptunu. Na mezihvězdném úřadě ti zatím schvalují pojem „rychlá“.",
        "Vybíráš tak neobvyklé místo srazu, že musí astronomové přidat třináctý směr. I tam pak trváš na zadním vchodu.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Z obyčejného narozeninového přání umíš mít radost. Zvlášť když na něm najdeš neobvyklou známku.",
        "Na oslavě dáváš dohromady lidi z různých světů. I dort se díky tobě dozví něco nového.",
        "Ceníš si dárku, nad kterým někdo přemýšlí. Zvláštní kamínek s příběhem má u tebe dobré vyhlídky.",
        "Umíš si oslavu zařídit po svém. Třeba s piknikem, na kterém se deka počítá jako slavnostní výzdoba.",
      ],
      [ // úroveň 2
        "Na pozvánku píšeš „žádný pevný program“. Přikládáš jen stručná pravidla spontánnosti.",
        "Přeješ si něco neobvyklého. Dárkové tašky teď v partě dostávají zajímavé rozměry.",
        "Svíčky na dortu rozmístíš podle vlastního návrhu. I přání si u tebe hledá jinou cestu než přímo nahoru.",
        "K narozeninám chceš překvapení. Předem jen vysvětlíš, které druhy překvapení jsou už příliš běžné.",
      ],
      [ // úroveň 3
        "Říkáš, že na narozeninách nezáleží. Jen chceš, aby to každý vyjádřil nějakým osobitým způsobem.",
        "Slavíš bez tradic. Tenhle svůj tradiční formát držíš už osmým rokem.",
        "Přání „všechno nejlepší“ přijmeš s výhradou. Nejlepší podle jakých měřítek?",
        "Narozeninovou písničku hodnotíš jako příliš známou. Hostům tím otevíráš zajímavý prostor pro ticho.",
      ],
      [ // úroveň 4
        "Požaduješ tak neotřelý dort, že cukrárna místo řezu předkládá obhajobu diplomové práce.",
        "Rozbalování dárků měníš v diskuzi o významu balení. Hosté už třetí hodinu tleskají zavřené krabici.",
        "Trváš na neformální oslavě tak důsledně, že za obyčejné „všechno nejlepší“ uděluješ napomenutí před dortem.",
        "Máš tak přesnou představu o překvapení, že k němu vydáváš zadávací dokumentaci. Spontánnost požaduješ ve třech vyhotoveních.",
      ],
      [ // úroveň 5
        "Přeješ si dosud neobjevenou barvu. Galaktická balírna čeká s mašlí za okrajem viditelného spektra.",
        "Slavíš na planetě bez oběžné dráhy, aby ti Slunce nevnucovalo datum. Hostům posíláš pozvánku s kolonkou „někdy“.",
        "Na dort požaduješ nový chemický prvek. Vesmírné cukrárně vracíš helium: to už zná každý balónek.",
        "Narozeniny přesouváš před velký třesk. Konečně máš oslavu, kde nikdo nemůže tvrdit, že už něco podobného zažívá.",
      ],
    ],
  },
  s: [
    ["Námitek k návodu", "38"],
    ["Nápadů na jeden šuplík", "12"],
    ["Shody s většinou", "2 %"],
    ["Blízkosti v osobním prostoru", "1 z 9"],
    ["Verzí nového systému", "106"],
    ["Tradičních úterků", "0"],
  ],
  d: [
    "Dnes máš ke slovu „běžně“ tolik výhrad, že i denní světlo si radši říká experimentální osvětlení.",
    "Dneska hledáš nový úhel pohledu. Zkus se nejdřív otočit na židli, ať kvůli tomu nemusíš stěhovat obývák.",
    "Dnes máš otevřených tolik možností, že už se ti mezi nimi dělá průvan.",
    "Dneska považuješ „protože to funguje“ za zvlášť podezřelou obhajobu.",
    "Dnes přinášíš do všednosti svěží nápad. Jen mu zatím nepiš stanovy.",
    "Dneska máš pro každé tlačítko lepší funkci. To původní ale pořád zhasíná, kdy má.",
    "Dnes zkus přijmout hotové řešení. Nemusíš k němu nejdřív vynalézat jiný problém.",
    "Dneska máš vlastní tempo. Budík se k němu zjevně zapomíná přihlásit.",
    "Dnes bereš návod jako pozvání k diskuzi. Šroubek má naštěstí jen jeden závit.",
    "Dneska si necháváš všechny možnosti otevřené. U lednice už to ale hraničí s výzkumem klimatu.",
    "Dnes obhajuješ právo dělat věci po svém. I záložka v knize leží napříč.",
    "Dneska přesně víš, jak má vypadat budoucnost. Jen dnešní odpoledne ještě čeká na návrh.",
    "Dnes máš prostor na geniální nápad. Vynést krabici se počítá taky, i bez tiskové konference.",
    "Dneska potřebuješ volnost. Zkus jí pro začátek dát tvar volného místa na stole.",
    "Dnes hledáš něco, co ještě nikdo nezná. Nepřečtená zpráva ve tvém telefonu je slušný začátek.",
    "Dneska se nebojíš odlišného názoru. Pokud ho máš ty.",
    "Dnes máš netradiční plán. Pro odlišení od včerejška mu zatím měníš název.",
    "Dneska ti na všech záleží tak široce, že se odpověď jednomu člověku sotva vejde do záběru.",
    "Dnes zkus říct „ano“ bez dodatku. Pořád jde o plnohodnotný příspěvek do debaty.",
    "Dneska bereš kompromis vážně. Zvažuješ pro něj vlastní, lepší definici.",
    "Dnes si dovol drobnou konvenci. Čaj se dá pít i z hrnku, který nemá autorský záměr.",
    "Dneska máš v hlavě budoucnost dopravy. Klíče od kola zatím hledáš stejným způsobem jako minule.",
    "Dnes zkus svůj nápad vysvětlit jednou větou. Dvojtečka s dvanácti body je zatím pořád dvanáct bodů.",
    "Dneska dáváš obyčejným věcem nový význam. Jen neříkej neuklizenému stolu výzkumná stanice.",
  ],
  q: [
    "Zkusme tu jídelnu v bývalé tramvaji. Jestli ji doporučují v průvodci, musíme najít jiný dopravní prostředek.",
    "Pojďme na výstavu vynálezů. Konečně místo, kde otázka „proč to děláme normálně?“ nebude jenom ode mě.",
    "Napíšu jen „ahoj“. Pak přidám odkaz na článek o tom, proč pozdravy potřebují změnu. Krátké zprávy mi jdou.",
    "Beru houbičku. Ale u toho můžeme probrat, jestli nás nádobí nespojuje jen proto, že si neumíme objednat jeden velký talíř.",
    "Vyberme místo podle mapy, kde ještě chybí název. A přibalme druhou mapu, abychom se vůbec dostali zpátky.",
    "Pusťme si něco bez doporučení. U pěti hvězdiček už mám podezření na příliš širokou shodu.",
  ],
};

export default vodnar;
