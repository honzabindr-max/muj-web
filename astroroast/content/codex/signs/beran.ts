// AstroRoast.ai: originální české texty Codexu pro znamení Berana.
//
// Tvar RawSign (viz content/types.ts), index 0 = úroveň 1:
//   h: 5 úrovní, přesně 3 titulky na úroveň (nejvýše 90 znaků).
//   c: 5 úrovní, přesně 2 základní věty na úroveň (nejvýše 160 znaků).
//   v: 5 úrovní, přesně 2 verdikty na úroveň (nejvýše 120 znaků).
//   t: 5 témat × 5 úrovní × přesně 4 věty (nejvýše 160 znaků).
//   s: přesně 6 falešných statistik [popisek, krátká hodnota].
//   d: přesně 24 denních vět (nejvýše 140 znaků), bez skutečných předpovědí.
//   q: přesně 6 párových odpovědí v pořadí COUPLE_SITUATIONS v shared.ts.
//
// Ostrost: 1 pohlazení, 2 šťouchnutí, 3 sarkasmus, 4 ostrá nadsázka,
// 5 absurdní kosmická eskalace. Každá úroveň má vlastní pointy.
// Terčem je výhradně stereotyp znamení. Oslovení je rodově neutrální;
// párové odpovědi jsou repliky znamení v dialogu.

import type { RawSign } from "../../types";

const beran: RawSign = {
  h: [
    [
      "Rozhýbeš i pondělí. Jen mu nedáváš moc času na rozkoukání.",
      "Dodáváš odvahu i nápadům, které se zatím jen rozhlížejí.",
      "Umíš strhnout ostatní. Jen občas začínáš už při pozvánce.",
    ],
    [
      "Čekání bereš jako hru. Zatím v ní nemáš ani bod.",
      "Z „co třeba“ uděláš „už to běží“ ještě během nádechu.",
      "Vstoupíš do místnosti a hned hledáš, v čem se tam dá vyhrát.",
    ],
    [
      "Všechno máš pod kontrolou. Hlavně to, k čemu nemáš podklady.",
      "Rozhoduješ rychle. Ověřování ti kazí mezičasy.",
      "Nasloucháš pozorně. Do první příležitosti skočit do řeči.",
    ],
    [
      "Chceš mít poslední slovo tak moc, že ho říkáš jako první.",
      "Tlačíš i na automatické dveře. Otevřou se a bereš to jako výhru.",
      "Ze společného rozhodování děláš sólo s povinným potleskem.",
    ],
    [
      "Velkému třesku vyčítáš, že se s tím tak loudal.",
      "Černou díru přeskočíš. Vtahování ti připadá zbytečně pomalé.",
      "Časoprostor ohýbáš, aby fronta začínala až za tebou.",
    ],
  ],
  c: [
    [
      "Umíš dodat prvnímu kroku tolik nadšení, že si druhý pro jistotu zaváže tkaničky.",
      "Když se do něčeho pustíš, hned je v místnosti víc chuti to zkusit. A o trochu míň času na úvod.",
    ],
    [
      "Při odpočítávání vyrážíš na trojku. Jedničku necháváš ostatním jako drobnou výhodu.",
      "Svoje „ještě si to promyslím“ měříš na vteřiny. I tak máš pocit, že přeháníš.",
    ],
    [
      "Trpělivost uznáváš jako zajímavý obor. S praxí počítáš u ostatních.",
      "Když máš pochybnosti, přidáš na důrazu. Obsah zůstává stejný, ale teď už ho slyší i chodba.",
    ],
    [
      "Do debaty vstupuješ s hotovým závěrem. Názory ostatních používáš jako přestávku na občerstvení.",
      "Každé tlačítko mačkáš třikrát. I „odeslat“ má vedle tebe pocit, že pracuje na zkoušku.",
    ],
    [
      "Předbíháš vlastní ozvěnu a pak ji poučuješ, že má pozdní příchod. Hory kvůli tobě žádají o pružnou pracovní dobu.",
      "Vesmíru diktuješ tempo rozpínání. Když se ozve zpoždění, zakládáš konkurenční vesmír s rychlejším začátkem.",
    ],
  ],
  v: [
    [
      "Svět s tebou získává tah. Dopřej mu občas i zatáčku.",
      "Dodáváš ostatním odvahu. Jen jim nech čas zavázat si boty.",
    ],
    [
      "Zkus jednou nechat doběhnout odpočet. Je tam i nula.",
      "Klidně vyhraj. Jen nejdřív zjisti, jestli se vůbec soutěží.",
    ],
    [
      "Tvoje sebejistota má náskok. Výsledky zatím hledají parkování.",
      "Znáš odpověď na všechno. Škoda té podružné závislosti na otázce.",
    ],
    [
      "Vypni si zvuk. Třeba zjistíš, že argument má mít i obsah.",
      "Se svojí pravdou zacházíš jako s vysílačkou. Příjem pořád nefunguje.",
    ],
    [
      "Kosmická rada ti přiděluje vlastní vesmír. Soutěž s ním. Nás už nech dojít.",
      "Dostáváš zákaz předbíhání. Platí i ve frontě na vznik času.",
    ],
  ],
  t: {
    vztahy: [
      [
        "Umíš z obyčejné procházky udělat malé dobrodružství. Někdy už při obouvání.",
        "Co cítíš, řekneš bez dlouhých oklik. Milostnému dopisu tak šetříš nejméně dvě přílohy.",
        "Na rande přinášíš nadšení pro dva. Stůl se z toho málem posouvá k oknu sám.",
        "Pro společné zážitky máš chuť na rozdávání. I cesta pro pečivo s tebou dostává slavnostní start.",
      ],
      [
        "Při seznamování přeskakuješ rozpaky. Občas i představení.",
        "Na „dejme tomu čas“ odpovídáš návrhem na kratší čas.",
        "Společný výlet naplánuješ za minutu. Druhá minuta patří vysvětlování, že už vyrážíte.",
        "Zamilované ticho si užíváš. Než tě napadne lepší program.",
      ],
      [
        "Otevřenou komunikací myslíš, že můžeš začít mluvit kdykoli.",
        "Ptáš se „jak to vidíš?“ a přikyvuješ. Hlavně částem, které zní jako tvoje verze.",
        "Ve vztahu ctíš rovnost. Každý má právo souhlasit s tvým plánem.",
        "Společné tempo respektuješ. Považuješ za něj to svoje, takže je to příjemně jednoduché.",
      ],
      [
        "Z „my dva“ vyrábíš „já a publikum“. A ještě publiku napovídáš, kdy má tleskat.",
        "Ptáš se na přání protějšku s tónem, jakým navigace oznamuje špatnou odbočku.",
        "Z každé hádky děláš mistrovství v posledním slově. Medaile si objednáváš ještě před prvním argumentem.",
        "Na kompromis kývneš, až když se převlékne za tvůj nápad a přinese ti medaili.",
      ],
      [
        "Venuši posíláš upomínku: tvoje romantická jiskra čeká už tři nanosekundy na vlastní galaxii.",
        "Pro společnou večeři zabereš dvě oběžné dráhy. Tu třetí potřebuje tvoje potřeba mít pravdu.",
        "Do mezihvězdné dohody o soužití dopisuješ podmínku, že i gravitace musí občas ustoupit tobě.",
        "Při vyznání lásky předbíháš světlo. Na konci věty pak čekáš na začátek vlastního rande.",
      ],
    ],
    prace: [
      [
        "Na poradě umíš prolomit ticho dobrým nápadem. Občas i před zapnutím světel.",
        "Dokážeš dát projektu první impuls. Úvodní porada se za tebou teprve rozbíhá.",
        "Když ostatní hledají odvahu něco zkusit, nabídneš první pokus. Návod zatím drží místo.",
        "Do práce přinášíš chuť něco rozhýbat. I kancelářská židle si připadá o kolečko svižnější.",
      ],
      [
        "Zadání čteš svižně. Hlavně mezery mezi titulkem a tlačítkem „začít“.",
        "Na poradě zvedáš ruku tak rychle, že se otázka hlásí až po tobě.",
        "První návrh posíláš hned. Druhý obsahuje i přílohu.",
        "Z „až to schválíme“ slyšíš hlavně příslib, že to nebude trvat dlouho.",
      ],
      [
        "Podklady si otvíráš až po rozhodnutí. Přece nebudeš dokumentům kazit překvapení.",
        "Práci v týmu zvládáš výborně. Hlavně když tým dodržuje roli obecenstva.",
        "Termíny si stanovuješ ambiciózně. Realitu zatím nevedeš mezi účastníky porady.",
        "Zpětnou vazbu vítáš. V té krátké pauze, než ji začneš opravovat.",
      ],
      [
        "Poradu nepřerušuješ. Pouze cizí věty používáš jako nástupní můstek pro vlastní tiskovou konferenci.",
        "Tvoje „beru si to na starost“ zní jako pomoc. V praxi ostatním zabavíš i tlačítko pro připomínky.",
        "Z každého týmového úspěchu uděláš sólový výstup. Kolegy si necháváš v poděkování drobným písmem.",
        "Zpětnou vazbu zpracuješ během vteřiny: přejmenuješ ji na nedorozumění a pošleš zpátky.",
      ],
      [
        "Kvůli tvým termínům se Země točí rychleji. Na poradě si pak stěžuješ, že má den jen sedm minut.",
        "Vesmírnou poradu zahajuješ před vznikem vesmíru. Pak se divíš, že nikdo nemá připravené podklady.",
        "Gravitaci přiděluješ úkol s termínem „včera“. Právě kvůli tobě padá celý vesmír do tabulky.",
        "Tvůj seznam priorit je tak dlouhý, že kolem něj obíhá Saturn. Pořád ho uháníš, kdy dodá prstence.",
      ],
    ],
    zivot: [
      [
        "Umíš se pustit do nových věcí s lehkostí. I první stránka sešitu s tebou zažívá premiéru.",
        "Všednímu dni dodáváš švih. Koš na tříděný odpad díky tobě poznává atmosféru finále.",
        "Dokážeš najít dobrodružství i za rohem. Jen se ten roh občas nestihne představit.",
        "Když tě něco nadchne, umíš tím rozzářit celý den. A rychle mu obstarat pokračování.",
      ],
      [
        "U mikrovlnky sleduješ posledních deset vteřin jako napínavý závěr závodu.",
        "Výtah přivoláváš opakovaně. Třeba mu druhým stiskem vysvětlíš naléhavost.",
        "Novou zálibu si vybíráš podle toho, jestli se s ní dá začít ještě během vybírání.",
        "Na procházce bez cíle stejně potřebuješ dorazit první.",
      ],
      [
        "Návod považuješ za cizí názor na věc, kterou přece držíš v ruce ty.",
        "Všechno řešíš za pochodu. Proto jdeš tak rychle: na místě by tě mohly dohnat souvislosti.",
        "Chyby bereš jako zkušenosti. Podle jejich tempa si buduješ velmi rozsáhlé vzdělání.",
        "Tvůj plán má i záložní variantu. Uděláš totéž s větší jistotou.",
      ],
      [
        "I odpočinek měníš v disciplínu, ve které chceš porazit lidi, co o soutěži nevědí a právě čtou knihu.",
        "Skládáš nábytek podle sebejistoty. Zbylé šroubky pak vydáváš za důkaz zbytečné byrokracie.",
        "Když se tvůj plán střetne s realitou, vysvětlíš realitě, že nemá týmového ducha.",
        "Na tlačítko „přeskočit úvod“ tlačíš tak důsledně, že vlastní život začínáš od třetí kapitoly bez obsahu.",
      ],
      [
        "Ve frontě na konečnost vesmíru žádáš druhou přepážku. Nekonečno za tebou zatím přešlapuje.",
        "Předbíháš světlo a na konci vesmíru reklamuješ tmu. Knihu přání a stížností chceš dřív, než vznikne papír.",
        "Rozdělané nápady si parkuješ na oběžné dráze. Astronomové teď kvůli tvému diáři musejí rozlišovat nový druh zatmění.",
        "Do zákonů fyziky připisuješ „ihned“. Hmota žádá vysvětlení a ty ji obviňuješ ze zdržování experimentu.",
      ],
    ],
    pratele: [
      [
        "V partě dodáváš odvahu prvnímu „pojďme“. Jen mu občas zapomeneš přibalit otazník.",
        "Z obyčejného setkání umíš udělat malou výpravu. Cíl stačí domluvit po cestě.",
        "Když je potřeba něco rozjet, nabídneš se bez dlouhého čekání. Vděčnost stíhá až druhý spoj.",
        "Kamarádům fandíš naplno. Někdy i u výběru zmrzliny, jako by šlo o finále.",
      ],
      [
        "Na otázku „kdo jde?“ odpovídáš „my všichni“. Teprve potom zjišťuješ, kdo čte zprávy.",
        "Výlet s partou bereš pohodově. Jen se občas ptáš, jestli se to pohodlí nedá trochu popohnat.",
        "Společenskou hru vysvětluješ až při rozdávání karet. Napětí přece dělá zábavu.",
        "Když se má hlasovat, zvedáš ruku už při slově „kdo“. Výběr možnosti doženeš potom.",
      ],
      [
        "Přátele necháváš svobodně vybírat ze dvou možností: tvůj plán hned, nebo tvůj plán za chvíli.",
        "V debatě dáváš prostor každému. Jakmile dopovíš a pokud mezitím nepřijde další tvoje myšlenka.",
        "Pravidla hry ctíš. U sporných bodů rozhoduje, co se právě hodí tvým figurkám.",
        "Skupinovou domluvu bereš vážně. Proto ji pro jistotu oznamuješ v hotové podobě.",
      ],
      [
        "Z kamarádského „uvidíme“ děláš závaznou přihlášku, tiskneš startovní čísla a ptáš se, proč ostatní kazí účast.",
        "Pozveš partu na pohodový výlet a po deseti minutách už všem rozdáváš nevyžádané mezičasy.",
        "Večeru s přáteli dodáváš soutěživost tak dlouho, až i věšák musí obhajovat počet odložených bund.",
        "Na deskovce přepíšeš pravidla tak důkladně, že se krabice stává jediným neutrálním účastníkem.",
      ],
      [
        "Pro partu uspořádáš výlet napříč galaxiemi a pak reklamuješ Mléčnou dráhu: má jen jeden pruh.",
        "Při vesmírné deskovce si přisuneš Saturnovy prstence jako žetony. Pravidla pak označíš za lokální omezení.",
        "Na setkání s přáteli předbíháš čas. Parta ti proto posílá pozvánky do minulosti, ať chvíli počkáš.",
        "Z kamarádského srazu uděláš galaktickou olympiádu. I černá díra musí doložit, za jak dlouho schová míček.",
      ],
    ],
    narozeniny: [
      [
        "Svoje narozeniny umíš proměnit v den, na který se těší i kalendář. Jen by chtěl znát čas zahájení.",
        "Dárky rozbaluješ s upřímným nadšením. Mašle si může gratulovat, když se dostane aspoň ke slovu.",
        "Z každého přání máš radost. A hned chuť společně něco podniknout.",
        "U dortu rozzáříš oslavu ještě dřív než svíčky. Ty se aspoň nemusejí tolik snažit.",
      ],
      [
        "Na překvapení se těšíš tak moc, že ho chceš vědět už předem. Jen stručně, celé.",
        "Slavit začínáš hned po půlnoci. Datum musí být potěšené, jak rychle získává účast.",
        "Svíčkám dáváš krátký náskok. Přání už na startu přešlapuje.",
        "Při rozbalování dárků zkoušíš, jestli se nedá papír předběhnout.",
      ],
      [
        "Z narozenin děláš bilanci. Hlavně toho, kdo ti přeje včas a kdo kazí průběžné pořadí.",
        "Tvrdíš, že o dárky nejde. Proto jejich rozbalování měříš se zaujetím rozhodčího.",
        "Narozeninový program konzultuješ s hosty. Mohou si vybrat, kde budou stát při tvém nápadu.",
        "Oslavu si přeješ neformální. Časový rozpis toho, jak to mají všichni projevit, posíláš zvlášť.",
      ],
      [
        "Z vlastní oslavy děláš přijímací zkoušku z nadšení. Hosté musejí doložit, že se těší minimálně stejně jako ty.",
        "Dárek rozbaluješ tak urputně, že i nůžky leží stranou s pocitem, že jsou zbytečně pomalé.",
        "S přáním „ať se ti všechno daří“ zacházíš jako s podepsanou zárukou a chceš vědět, kdo přijímá reklamace.",
        "Překvapení si zorganizuješ podle sebe a pak ostatním opravuješ úžas, protože si ho představuješ hlasitější.",
      ],
      [
        "Svíčky si zapaluješ o jádro hvězdy. Pak si stěžuješ, že celý tenhle vesmír fouká hrozně málo.",
        "Noční obloze posíláš reklamaci, že souhvězdí nehláskují tvoje jméno. Trváš na opravě do sfouknutí dortu.",
        "Na narozeninovou oslavu si zveš celý zvěrokruh. Galaxiím přidělíš stoly podle toho, jak rychle potvrdí účast.",
        "Od vesmíru žádáš k narozeninám splněné přání. Dodací lhůtu „až uzraje čas“ vracíš jako výrobní vadu.",
      ],
    ],
  },
  s: [
    ["Trpělivost před „tak já začnu“", "0,8 s"],
    ["Pročtené návody před rozjezdem", "1 z 81"],
    ["Neoficiální závody za den", "27"],
    ["Otázky vyslechnuté do konce", "4 %"],
    ["Stisky už svítícího tlačítka", "6"],
    ["Pauza mezi dvěma nápady", "0,2 s"],
  ],
  d: [
    "Dnes zkus nechat čaj louhovat. Povzbuzování zpoza hrnku se do návodu nepočítá.",
    "Dnes dej tečce šanci. Zkus odpovědět až po ní.",
    "Dnes nech tlačítko výtahu svítit v klidu. Naléhavost mu dalším stiskem nezvýšíš.",
    "Dneska si trénuj trpělivost na přesýpacích hodinách. Zatím vyhrává písek.",
    "Dnes máš nárok na klid. Nemusíš ho stihnout před ostatními.",
    "Dnes zkus chvíli jen tak být. Časomíru nech vypnutou, i když ti to půjde skvěle.",
    "Dnes si napiš „počkat“ na seznam úkolů. Alespoň jednou tě bude lákat něco odškrtnout pomalu.",
    "Dneska se i tvoje „v klidu“ říká na jeden nádech a s odpočtem.",
    "Dnes poslechni navigaci aspoň do konce věty. Sama zkratka se ještě nemusí zkracovat.",
    "Dnes se nehádej s ukazatelem průběhu. Na „už?“ má pořád stejnou odpověď: 38 %.",
    "Dneska si vychutnej druhé místo. I to je první místo za prvním.",
    "Dnes nech plán chvíli uležet. Nemusíš mu každou minutu obracet polštář.",
    "Dnes neurychluj východ Slunce. Ani rozhodné odhrnutí závěsu není dálkové ovládání planety.",
    "Dnes počítej do deseti. Pokus počítat po pěti se vede jako beraní zkratka.",
    "Dneska dopřej nápadu zkušební provoz. Ne každý potřebuje rovnou slavnostní průvod.",
    "Dnes dovol otazníku dokončit směnu. Odpověď v polovině otázky není zrychlené odbavení.",
    "Dnes zkus hrát pexeso bez časového limitu. Kartičky opravdu nemají kam utéct.",
    "Dneska si odškrtni jeden dokončený úkol. Založení dalšího seznamu tentokrát neplatí.",
    "Dnes máš dost energie i na pauzu. Zkus ji nevyplnit přípravou další pauzy.",
    "Dnes připusť, že pomalé načítání není osobní výzva. Obrazovka pořád nevidí tvoje odhodlání.",
    "Dneska přenech poslední slovo někomu jinému. Nemusíš potom žádat písemný zápis.",
    "Dnes si nastav budík na odpočinek. Odložit ho o pět nových nápadů se nepočítá.",
    "Dnes dej času čas. Tvoje „no tak!“ zatím v kalendáři nemá vlastní kolonku.",
    "Dneska zkus začít otázkou. Věta „takže uděláme tohle“ se do nich pořád neřadí.",
  ],
  q: [
    "Vybírej v klidu. Já zatím vítězoslavně držím dveře podniku, který má nejblíž.",
    "V sobotu výlet, v neděli další. Odpočinek zařadím cestou mezi těmi dvěma odpočívadly.",
    "Odpovídám v 19:41. Obsah si doladím, až zpráva dorazí.",
    "Já myju, ty měříš čas. Ano, i talíře se počítají. Ne, samotné zapnutí vody ještě není vítězství.",
    "Ukazuj na mapě. Já zatím balím. A pokud to nemá jméno, pojmenujeme to až cestou.",
    "Pusť něco napínavého. Nebo zkusme deset vteřin nechat ovladač na stole. To mě napíná dost.",
  ],
};

export default beran;
