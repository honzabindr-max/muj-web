// AstroRoast.ai: původní české texty modelu Codex pro znamení Rak.
//
// Tvar RawSign (viz content/types.ts), index 0 = úroveň 1:
//   h: 3 titulky na každou z 5 úrovní (15 celkem).
//   c: 2 základní věty na každou z 5 úrovní (10 celkem).
//   v: 2 verdikty na každou z 5 úrovní (10 celkem).
//   t: 5 témat × 5 úrovní × přesně 4 věty (100 celkem).
//   s: 6 falešných statistik ve tvaru [popisek, krátká hodnota].
//   d: 24 denních vět začínajících Dnes/Dneska, bez předpovědí událostí.
//   q: 6 odpovědí v pořadí COUPLE_SITUATIONS ze shared.ts.
//
// Stupnice: pohlazení → šťouchnutí → sarkasmus → ostrá nadsázka → kosmická absurdita.
// Terčem je pouze stereotyp znamení. Oslovení je rodově neutrální;
// párové odpovědi jsou přímé repliky. Žádné doplňované šablony.
// Limity: titulky 90, základní a tematické věty 160, verdikty 120, denní věty 140 znaků.

import type { RawSign } from "../../types";

const rak: RawSign = {
  h: [
    [
      "U tebe má i návštěva na pět minut vlastní hrnek.",
      "Máš talent na pohodu. A deku pro každou její příležitost.",
      "Umíš zahřát obyčejný den. Troubu k tomu zapínáš jen občas.",
    ],
    [
      "Čteš mezi řádky i na jídelním lístku.",
      "Na výlet si balíš svačinu a menší verzi domova.",
      "Ukládáš si hezké zprávy. Pro jistotu i ty s podezřelou tečkou.",
    ],
    [
      "Tvoje „to je jedno“ má překvapivě přesný seznam podmínek.",
      "Odpouštíš bez výhrad. Přílohy uchováváš zvlášť.",
      "Minulost necháváš za sebou. Na čestném místě v obýváku.",
    ],
    [
      "Z jedné tečky ve zprávě vyrábíš seriál na šest řad.",
      "Tvoje „nic“ má 800 stran a zakazuje zkrácené vydání.",
      "Jdeš v životě dál. Veškeré křivdy stěhuješ třemi dodávkami.",
    ],
    [
      "K tvému „v pohodě“ připojuje Saturn bezpečnostní prstence.",
      "Uchováváš tolik minulosti, že velký třesk žádá o výpis.",
      "Zabíráš cizí galaxii. Doma už pro vzpomínky nemáš místo.",
    ],
  ],
  c: [
    [
      "Všímáš si drobností, které ostatním udělají radost. Přídavek koláče počítáš mezi základní pozdravy.",
      "Umíš vytvořit příjemnou atmosféru i při čekání na autobus. Jen tam trochu chybí tvůj oblíbený polštář.",
    ],
    [
      "Na odmítnutý přídavek máš dvě odpovědi: menší porci a krabičku na cestu.",
      "Ke každému hrnku máš příběh. K hrnku bez příběhu máš zatím výhrady.",
    ],
    [
      "Říkáš, že nechceš nic rozebírat. Zajímavé, jak přehledně k tomu vedeš poznámky.",
      "Dáváš druhé šance. Pěkně očíslované, aby se nic neztratilo v evidenci.",
    ],
    [
      "Tvůj archiv drobných urážek má tolik pater, že se v něm do minulého čtvrtka jede výtahem.",
      "Chceš, ať ostatní hádají tvoje pocity. Ani nápověda u tebe neprojde bez přijímací zkoušky.",
    ],
    [
      "Zadržuješ tolik nevyřčených vět, že kolem tvého ticha obíhají tři měsíce a jeden překladač.",
      "I černé díře posíláš krabičku po koláči. Chceš ji vrátit, máš k ní vztah od vzniku vesmíru.",
    ],
  ],
  v: [
    [
      "Děláš svět útulnější. S tebou má i pondělí kam odložit kabát.",
      "Máš cit pro maličkosti. Jen k nim občas přidáš rodinné balení sušenek.",
    ],
    [
      "Ke štěstí potřebuješ málo. Akorát to má svůj hrnek, deku a správnou teplotu.",
      "Dopřej i smajlíku možnost znamenat jen smajlík. Ty poznámky si můžeš schovat.",
    ],
    [
      "Se vším se vyrovnáš. A pak to srovnáš abecedně, pro případ další debaty.",
      "Tvá schopnost číst myšlenky funguje výborně. Ověření u zdroje zatím vynecháváš.",
    ],
    [
      "Z každé drobnosti uděláš památku. I památkový úřad si k tobě chodí pro razítko.",
      "Když říkáš „nechme to být“, přikládáš obsah, rejstřík a předplatné pokračování.",
    ],
    [
      "Svoje pocity eviduješ tak důkladně, že vesmír vedle tebe vypadá jako ztracený lístek.",
      "Máš ve vesmíru zvláštní postavení: obíhá kolem tebe nevyřešená středa.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1: pohlazení
        "Pamatuješ si oblíbenou snídani svého protějšku. Romantiku servíruješ i ve všední den.",
        "Umíš dát najevo lásku maličkostí. U tebe má i poslední sušenka jméno toho druhého.",
        "Pro společné chvíle máš cit. A na gauči už preventivně místo pro dva.",
        "Umíš poslouchat tak, že i vyprávění o nákupu dostane příjemnou atmosféru. Včetně přestávky na čaj.",
      ],
      [ // úroveň 2: šťouchnutí
        "Píšeš „chybíš mi“ i mezi kuchyní a obývákem. Vzdálenost je pro tebe osobní věc.",
        "Plánuješ spontánní večer ve dvou. Deka čeká od úterý, svíčka dostává průběžné informace.",
        "Když vybíráš romantickou fotku, přikládáš další tři. Aby ta první nemusela cestovat sama.",
        "Ke společnému výročí počítáš i první povedený toust. Dobré věci si zaslouží kalendář.",
      ],
      [ // úroveň 3: sarkasmus
        "Očekáváš otevřenou komunikaci. Svoje potřeby proto sděluješ různou hlasitostí slova „dobře“.",
        "Lásku bereš bezpodmínečně. Jen oblíbený hrnek druhého člověka podléhá tvému schválení.",
        "Při neshodě chceš mluvit jen o přítomnosti. Pro kontext začínáš prvním rande.",
        "Říkáš „vyber cokoli“. Pak čekáš, kdy ten druhý správně pochopí svobodu volby.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Z jedné stručné odpovědi vyrobíš vztahovou trilogii. Ten druhý se mezitím jen ptá, kde je nabíječka.",
        "Při usmiřování vytáhneš tolik starých dialogů, že společný večer potřebuje archiváře a dva nosiče beden.",
        "Zkoušíš lásku nenápadnými náznaky. U tvého povzdechu by i detektiv žádal řešení na konci knihy.",
        "Z věty „mně je to jedno“ stavíš bludiště. U východu čekáš s otázkou, proč to trvá tak dlouho.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Na společné bydlení žádáš druhý vesmír. V tom prvním už máš vzpomínky na dobu před společným bydlením.",
        "Venuši vracíš licenci na lásku. V návodu chybí kapitola, jak správně reagovat na tvé třetí „nic“.",
        "K hádce zveš Saturn jako nestrannou planetu. Jeho prstence používáš jako zakladače důkazů.",
        "Na usmiřování u tebe potřebuješ portál. Všechny volné termíny obsazuje debata z předminulého vesmíru.",
      ],
    ],
    prace: [
      [ // úroveň 1: pohlazení
        "Všímáš si, kdo se v týmu ještě rozkoukává. Díky tobě má první den i svoji oblíbenou lžičku.",
        "Umíš ocenit práci ostatních. Pochvala od tebe navíc často obsahuje nabídku domácího koláče.",
        "Na společný stůl přinášíš pohodu. A ubrousky, protože pohoda přece nemůže zanechat drobky.",
        "Pamatuješ si, co kolegům usnadní den. Tvoje poznámky mají překvapivě často příchuť skořice.",
      ],
      [ // úroveň 2: šťouchnutí
        "Pracovnímu stolu říkáš pracovní. Přesto má záclonku, fotku a skoro vlastní poštovní schránku.",
        "Na poradu přinášíš něco domácího. Zápis ze schůzky pak obsahuje i dobu pečení.",
        "Odpověď na pracovní zprávu zakončuješ přáním hezkého dne. Pak zkoumáš, jestli to bez smajlíku nehřeje málo.",
        "Při přesunu na jiné místo nejdřív řešíš, kam půjde hrnek. Pracovní úkoly se přece nějak dosadí.",
      ],
      [ // úroveň 3: sarkasmus
        "Zpětnou vazbu vítáš. Doporučení zvětšit písmo pro jistotu posuzuješ i jako stanovisko k vašemu vztahu.",
        "Na poradě souhlasíš s novým postupem. U svého stolu mu vysvětluješ, proč byl ten starý útulnější.",
        "Při předání úkolu přikládáš všechny podklady. Včetně atmosféry, ve které požadavek zaznívá.",
        "Odděluješ pracovní a osobní život. Pocity z pracovní pošty proto třídíš až doma.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Připomínku k nadpisu zpracuješ jako pětidílný dokument o zradě. Nadpis mezitím zabírá dva pixely.",
        "Změnu zasedačky vyřizuješ jako vystěhování rodového sídla. Židle se s tebou musí rozloučit jednotlivě.",
        "Za slovem „přepracovat“ vidíš takovou zápletku, že do další porady píšeš souhrn předchozích dílů.",
        "Kolegy bereš jako rodinu. I k dotazu na tiskárnu proto přibalíš tři staré neshody a recept po předcích.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Při práci na dálku požaduješ vzdálenost tří galaxií. Přesto na poradě poznáš, kdo píše bez úsměvu.",
        "Mezigalaktickému personálnímu úřadu posíláš stížnost na strohé razítko. Chybí mu citový doprovodný dopis.",
        "Ze služební základny na Měsíci si děláš chalupu. Ke schválení tabulky teď vyžaduješ domácí přezůvky.",
        "Archivuješ tón pracovních zpráv i v černé díře. Kolegové k vyhledání přílohy potřebují ohnout časoprostor.",
      ],
    ],
    zivot: [
      [ // úroveň 1: pohlazení
        "Nacházíš radost v obyčejných věcech. I déšť má u tebe dobrou pověst, když se na něj díváš z deky.",
        "Umíš uchovat hezkou vzpomínku. Obyčejná vstupenka díky tobě pozná slavnostní album.",
        "Děláš si čas na malé rituály. Čaj tak u tebe nemá jen návod, ale i důstojné přivítání.",
        "Dokážeš z pokoje udělat oblíbené místo. Návod začíná slovem „posaď se“ a končí přídavkem.",
      ],
      [ // úroveň 2: šťouchnutí
        "Na jednu noc mimo domov balíš tolik známých věcí, že kufr působí jako menší předsíň.",
        "Schováváš si hezké krabičky. Jejich hlavní náplň je zatím možnost, že se budou hodit.",
        "Pustíš si novou písničku. Pak tu starou, aby si ta nová hned moc nevěřila.",
        "Pohodlí bereš vážně. I na seznamu výletů máš kolonku „kdy se vracíme“.",
      ],
      [ // úroveň 3: sarkasmus
        "Pracuješ na životě v přítomném okamžiku. Zatím máš nejradši ten z roku 2017.",
        "Při úklidu vyřazuješ nepotřebné věci. Všechno s příběhem má samozřejmě trvalou výjimku.",
        "Novým zkušenostem dáváš prostor. Hned vedle zásuvky, kterou od dětství neotvíráš, aby se nic nepřesunulo.",
        "Tvrdíš, že máš jen pár památek. Počítáš zřejmě podle skladovacích místností.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Z bytu si děláš muzeum vlastních úterků. Prostor pro návštěvy řešíš cedulí „nedotýkat se vzpomínek“.",
        "Při vyhazování účtenky přednášíš její životopis. Úklid po tobě chce čestné prohlášení, že se vůbec smí začít.",
        "Vystoupit z pohodlí zkoušíš tak, že o dva centimetry přesuneš křeslo. Pak si na nové místo týden zvykáš.",
        "Ke každé maličkosti připojíš tolik významu, že se i zapomenutá gumička stává nosnou konstrukcí domácnosti.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Vytváříš červí díru do dětství. Přesun polštářů do včerejška konečně uvolňuje místo na nové vzpomínky.",
        "Z minulosti si děláš další planetu. Její oběžnou dráhu odmítáš změnit, protože takhle to bývá každý rok.",
        "Na stěhování poptáváš černou díru s policemi. I nekonečno má přece vypadat trochu zabydleně.",
        "Uchováváš záruční list od velkého třesku. S vesmírem máš hezké vzpomínky, obal se určitě ještě hodí.",
      ],
    ],
    pratele: [
      [ // úroveň 1: pohlazení
        "Všímáš si, kdy někdo v partě ztichne. Umíš nabídnout prostor i poslední kousek koláče.",
        "Pamatuješ si malé úspěchy přátel. U tebe má i složená polička nárok na slavnostní zprávu.",
        "Díky tobě zůstávají společné chvíle i na fotkách. Občas na třech téměř totožných, pro jistotu.",
        "Umíš dát přátelům pocit, že jsou vítaní. Tvoje „stav se na chvíli“ už voní z trouby.",
      ],
      [ // úroveň 2: šťouchnutí
        "Přátele vybavuješ na cestu domů tak důkladně, že se hodí rozloučení zopakovat až u výdejního okénka.",
        "Do skupiny přeposíláš starou fotku. Pod heslem „pamatujete?“ zahajuješ další kolo vzpomínání tento týden.",
        "Když se parta schází venku, připomínáš, že i u tebe je vzduch. A podstatně lepší talířky.",
        "Na zprávu „díky“ čekáš s malou netrpělivostí. Krabičku na zbytek koláče máš nachystanou nezávisle na tom.",
      ],
      [ // úroveň 3: sarkasmus
        "Přátelům dáváš prostor. Pravidelným dotazem „neruším?“ ověřuješ jeho aktuální rozměry.",
        "Když se parta rozhodne pro jinou kavárnu, respektuješ to. Vlastnosti té vaší už jen připomínáš cestou.",
        "Ve skupině píšeš „jak chcete“. Svoje doporučení pak doručuješ všem jednotlivě.",
        "Na přátele se můžeš spolehnout. Zvlášť když mají stejné vysvětlení pozdní odpovědi i při druhém dotazu.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Z večera bez společné fotky uděláš vyšetřovací komisi. Pizza slouží jako svědek, stůl jako místo činu.",
        "Když parta přesune sraz, balíš vzpomínky na původní termín. Pozvánka teprve čeká na odeslání.",
        "Z kamarádského „nestíhám“ sestavíš celovečerní drama. Přestávku vyplníš třemi zprávami „já to chápu“.",
        "Při vzpomínání trváš na původním obsazení. I člověk v pozadí fotky dostává předvolání na sraz.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Zakládáš souhvězdí celé party. Hvězdu bez odpovědi přesouváš do vedlejší galaxie, ale svačinu jí posíláš dál.",
        "Na společné focení svoláváš i paralelní verze přátel. Z každé reality ti chybí jedna skupinová fotka.",
        "Mezigalaktické poště vracíš razítko „doručeno“. Od přátel vyžaduješ i „dojato“ a „vážím si krabičky“.",
        "Partě pořizuješ vlastní měsíc na srazy. Kdo nepřijde, dostává pohlednici s přesným rozměrem prázdné židle.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1: pohlazení
        "Nejvíc si vážíš osobního přání. Přídavné jméno „domácí“ ovšem funguje výborně i u dortu.",
        "Na oslavě umíš zapojit každého. I nenápadná miska sušenek má důležitou roli.",
        "Máš radost z maličkostí, které ukazují, že tě někdo zná. Třeba z přesně správné náplně koláče.",
        "Z obyčejného přání si uděláš milou vzpomínku. Do alba se u tebe vejde i mašle.",
      ],
      [ // úroveň 2: šťouchnutí
        "Dárek rozbaluješ opatrně. I papír má u tebe šanci na dlouhou rodinnou tradici.",
        "Chceš jen malou oslavu. Seznam lidí, kteří k ní patří, ovšem pokračuje na druhém ubrousku.",
        "Přání si čteš dvakrát. Jednou pro radost a jednou kvůli přesnému umístění dojatého smajlíku.",
        "Po oslavě schováváš svíčku na památku. Šuplík už považuje každý den za tvoje narozeniny.",
      ],
      [ // úroveň 3: sarkasmus
        "Na dárcích ti nezáleží. U výběru ovšem sleduješ, jak přesně ti na nich nezáleží.",
        "Čas narozeninového přání bereš s nadhledem. Proto jej eviduješ pouze na minuty.",
        "Oslavu chceš neformální. Použití jiné rodinné mísy řešíš až v samostatném zápisu.",
        "Všechna přání tě těší stejně. Některá jen ukládáš do složky „takhle se to dělá“.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Přání bez osobní vzpomínky posuzuješ jako prázdný obal. I taška na dárek u tebe musí doložit společnou minulost.",
        "Z pořadí gratulací sestavíš výroční zprávu o přátelství. Dort krájíš podle zasedacího pořádku komise.",
        "Při hromadném přání hledáš důkaz, že je skutečně pro tebe. Slovo „všechno“ dáváš prověřit třem oddělením.",
        "Píšeš „letos nic nechci“ a vytváříš nejdelší hádanku v dějinách dárkového balení.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Galaktické matrice reklamuješ datum narození. Chceš, aby si ho Slunce pamatovalo samo, bez obíhání.",
        "Na oslavu pronajímáš časovou smyčku. Konečně si každý může nacvičit, jak ti popřát dostatečně osobně.",
        "Své narozeniny měníš v astronomickou jednotku. Vzdálenost mezi přáními měříš na světelné výčitky.",
        "Balicí papír ukládáš do vlastního vesmíru. Velký třesk povoluješ jen tehdy, když zachová mašličku.",
      ],
    ],
  },
  s: [
    ["Významů jediné tečky", "27"],
    ["Krabiček s příběhem", "83"],
    ["Vzpomínek na jeden výlet", "412"],
    ["Pravděpodobnost jediné porce", "2 %"],
    ["Povzdechů s českými titulky", "1 z 9"],
    ["Památečních ubrousků", "56"],
  ],
  d: [
    "Dnes máš nostalgickou náladu. I včerejší seznam nákupu vypadá jako krásné období.",
    "Dnes můžeš číst mezi řádky. Jízdní řád si ale svoje pocity raději nechává pro sebe.",
    "Dnes dáváš pohodlí přednost. Deka má u tebe opět přednostní právo na celý program.",
    "Dnes si klidně pusť něco nového. Úvodní znělka známého seriálu se to nemusí dozvědět.",
    "Dnes máš pro ostatní pochopení. A krabičku, která se ti má vrátit i s víčkem.",
    "Dnes nechej tečku na konci zprávy dělat jen tečku. Vedlejší významy mají volno.",
    "Dnes se obejdeš bez návratu k minulému úterý. V archivu máš i jiné oblíbené díly.",
    "Dnes můžeš přivítat změnu. V předsíni jí nabídni přezůvky, třeba se nakonec osvědčí.",
    "Dnes počítáš malé radosti. Přídavek do stejného talíře vedeš jako samostatnou položku.",
    "Dnes si dej pauzu od hledání skrytých významů. I smajlík má právo jen se usmívat.",
    "Dnes máš doma příjemně. Ani zkušební cesta na balkon nepotřebuje sbalenou tašku.",
    "Dnes si vybíráš oblíbený hrnek. Ostatním nemusíš posílat vysvětlující dopis.",
    "Dnes můžeš říct rovnou, co chceš. Překladové oddělení tvých povzdechů ocení volno.",
    "Dnes máš pro každou maličkost místo. Zkus jednu poličku vyhradit i pro budoucí maličkosti.",
    "Dnes třídíš vzpomínky na hezké, moc hezké a ty s podezřelým tónem.",
    "Dnes máš důvod ocenit přítomnost. Má totiž čerstvější koláč než rok 2016.",
    "Dnes se nemusíš starat o náladu celé místnosti. Polštáře to zvládají i bez pravidelné porady.",
    "Dnes si klidně schovej mašli. Zbytek obalu nemusíš přijímat do rodiny.",
    "Dnes máš v zásobě hezké slovo. Doruč ho bez tří příloh se společnými vzpomínkami.",
    "Dnes můžeš vyrazit za dobrodružstvím. Oblíbený hrnek nepotřebuje živý přenos.",
    "Dnes nech své „dobře“ znamenat dobře. Titulky s návodem na usmíření můžeš vypnout.",
    "Dnes máš náladu na něco známého. I opakování ale u tebe dostává slavnostní premiéru.",
    "Dnes máš vnitřní počasí proměnlivé. Deka proto zastává funkci celoročního územního plánu.",
    "Dnes můžeš nechat něco být. Tvůj archiv to unese, má přece i rezervní přístavbu.",
  ],
  q: [
    "Kamkoli. Jen upozorňuju, že doma už prostírám a zdejší podnik mě zná i s oblíbenou miskou.",
    "Navrhuju poznávací výlet po bytě. Balkon letos skoro neznáme a z kuchyně mám samé dobré ohlasy.",
    "Posílám srdíčko. Pak další, aby to první nevypadalo jako pouhé potvrzení o doručení.",
    "Já myju, ty utírej. Ať ty dva památeční talíře neoddělujeme na celou směnu.",
    "Hlasuju pro místo, kde už to známe. Novou zkušenost zajistí jiná příchuť zmrzliny.",
    "Pusťme náš oblíbený film. Ty vybíráš titulky, já poznávám všechny věty i bez nich.",
  ],
};

export default rak;
