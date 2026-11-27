// AstroRoast.ai: původní české texty varianty Codex pro znamení Váhy.
// Tvar RawSign; index 0 = úroveň 1: Pohlazení, Šťouchnutí, Sarkasmus, Roast, Kosmická poprava.
// h: 3 titulky na úroveň; c: 2 základní věty na úroveň; v: 2 verdikty na úroveň.
// t: 5 témat × 5 úrovní × přesně 4 věty; při skládání se vybírají dvě.
// s: 6 dvojic [popisek, hodnota]; d: 24 denních vět bez skutečných předpovědí.
// q: 6 párových odpovědí v pořadí COUPLE_SITUATIONS v codex/shared.ts.
// Oslovení bez rodových tvarů; terčem jsou jen stereotypy znamení. Úroveň 5 je kosmická nadsázka.

import type { RawSign } from "../../types";

const vahy: RawSign = {
  h: [
    [
      "Umíš najít společnou řeč. A sladit k ní ubrousky.",
      "Máš vkus i takt. I obyčejné setkání s tebou má hezké světlo.",
      "Dáváš prostor každému názoru. I tomu, kam postavit vázu.",
    ],
    [
      "Vybíráš tak pečlivě, až si i čaj potřebuje přisednout.",
      "Tvoje „klidně vyber“ má drobným písmem tři podmínky.",
      "Chceš hlavně pohodu. Jen ještě doladíš, jak přesně má vypadat.",
    ],
    [
      "Máš pevný názor. V obou verzích.",
      "Svou neutralitu hájíš s překvapivě jasným názorem.",
      "Tvoje odpověď má úvod, závěr a žádnou odpověď.",
    ],
    [
      "Z otázky „čaj, nebo kávu?“ dokážeš udělat přijímačky do diplomacie.",
      "Tvoje „mně je to fuk“ má víc výjimek než školní řád.",
      "I otočné dveře projdeš až po debatě o správném směru.",
    ],
    [
      "Svým „ještě uvidíme“ držíš velký třesk ve zkušebním provozu.",
      "Kvůli tobě má kosmický formulář kolonky ano, ne a hezčí písmo.",
      "Na tvé rozhodnutí čeká i světlo. Rychlost už neřeší, chce termín.",
    ],
  ],
  c: [
    [
      "Umíš naslouchat tak, že se každý cítí vítaně. I názor na barvu závěsů u tebe dostane pohodlné křeslo.",
      "Máš cit pro soulad: spojíš lidi, barvy i poslední dvě sušenky na talíři. Ty hlavně spravedlivě.",
    ],
    [
      "Když si házíš mincí, necháš si poradit i od hrany. Ať se žádná možnost necítí odstrčeně.",
      "Než řekneš, co chceš, ověříš si, co chtějí ostatní. Vlastní přání pak představíš jako společný návrh.",
    ],
    [
      "Za svým názorem si stojíš. Jen pro jistotu tak, aby se z toho místa dalo stát i za opačným.",
      "Tvoje diplomacie funguje bezchybně: každý odchází přesvědčeně a nikdo netuší, na čem se vlastně shodujete.",
    ],
    [
      "Rozhodnutí u tebe absolvuje tolik schvalování, že než vybereš hrnek, dostane konvice razítko historické památky.",
      "Konflikt zameteš pod koberec a pak vybíráš větší koberec. Tomu doma říkáš harmonický interiér.",
    ],
    [
      "Při výběru jedné možnosti vyrábíš náhradní vesmíry pro ty ostatní. Mezihvězdný úřad ti kvůli tomu zakazuje vzorkovníky.",
      "U černé díry zvažuješ, jestli se hodí ke zbytku galaxie. Horizont událostí ti zatím nabízí výměnu do čtrnácti eonů.",
    ],
  ],
  v: [
    [
      "Máš dar ladit věci i lidi. Jen ta váza má u tebe překvapivě silné slovo.",
      "S tebou má i kompromis půvab. A sladěný podtácek.",
    ],
    [
      "Vybrat umíš. Jen tomu předchází malý festival možností.",
      "Na tvém „klidně“ je krásné, kolik práce si s ním dáváš.",
    ],
    [
      "Zachováváš rovnováhu. Především mezi tím, co říkáš, a tím, co neřekneš.",
      "Tvůj názor je zcela jasný. Stačí ho správně odhadnout.",
    ],
    [
      "I tvoje tečka za debatou má odvolací komisi.",
      "Tvoje „ano“ má tolik únikových východů, že potřebuje evakuační plán.",
    ],
    [
      "Kvůli tobě má multivesmír jednu povinnou přílohu: variantu v béžové.",
      "Své rozhodnutí najdeš u Saturnu. Zatím tam čeká na sedm kulatých razítek.",
    ],
  ],
  t: {
    vztahy: [
      [
        "Umíš se zeptat na den a opravdu poslouchat. Jen u výběru společného dezertu se hodí i obrazová příloha.",
        "Pamatuješ si drobnosti, které druhému dělají radost. A umíš k nim najít hezký balicí papír.",
        "Z obyčejné večeře uděláš hezkou chvíli. Někdy k tomu stačí světlo, jindy přestěhovat lampu o tři centimetry.",
        "Dáváš ve vztahu prostor oběma přáním. Na pohovce pro ně máš i sladěné polštáře.",
      ],
      [
        "Na rande vybíráš místo se správnou atmosférou. A pak druhé místo, kde by ta atmosféra mohla být o něco správnější.",
        "Když si dělíte dezert, hlídáš spravedlnost tak pečlivě, že by se k vidličkám hodilo malé pravítko.",
        "Chceš spontánní romantiku. Jen předem potřebuješ vědět kde, kdy a jestli tam ladí židle.",
        "Řekneš „překvap mě“ a nenápadně pošleš šest obrázků, jak má takové překvapení vypadat.",
      ],
      [
        "Ve vztahu zastáváš otevřenou komunikaci. Proto o svém přání necháš druhou stranu otevřeně hádat.",
        "Tvůj ideál je rovnocenný vztah: napůl společná rozhodnutí, napůl tvoje nenápadné opravy.",
        "Na otázku, co ti vadí, odpovíš „nic konkrétního“. Podrobnosti pak upřesníš změnou interpunkce.",
        "Když hledáš kompromis, začneš uprostřed. Pak střed nenápadně přesouváš ke své restauraci.",
      ],
      [
        "Než schválíš společnou fotku, stihne se z rande stát dokumentární cyklus o výběru společné fotky.",
        "Tvoje romantika má tolik nenápadných požadavků, že i svíčka před zapálením žádá o přesné zadání.",
        "Říkáš „nechci se hádat“ a přitom servíruješ výčitky po tak malých soustech, že z toho vztah má ochutnávkové menu.",
        "Když vybíráš místo na večeři, z párové blízkosti vyrobíš soutěž, kdo dřív vysloví přijatelnou adresu.",
      ],
      [
        "Na společné bydlení vybíráš planetu. Venuši vracíš: dobrá atmosféra, ale ten odstín oblohy mezi námi prostě nefunguje.",
        "Pro každou verzi ideálního rande zakládáš vesmír. Ve všech nakonec přesouváš stůl dál od černé díry.",
        "Své „to je v pohodě“ posíláš přes mezihvězdnou podatelnu. Příloha s vysvětlivkami už tvoří samostatný asteroidový pás.",
        "Chceš, aby to mezi vámi jiskřilo. Tak přerovnáváš souhvězdí do srdce a zamítáš Slunce kvůli příliš ostrému světlu.",
      ],
    ],
    prace: [
      [
        "Umíš propojit nápady lidí, kteří se míjejí. Na poradě tak vznikne i něco jiného než další porada.",
        "Dáváš prostor i tichému nápadu. A pak mu pomůžeš vybrat trochu čitelnější písmo.",
        "Zpětnou vazbu podáváš s taktem. I červená poznámka od tebe má příjemný odstín.",
        "Máš cit pro přehlednou prezentaci. Díky tobě se i třetí čtvrtletí umí hezky představit.",
      ],
      [
        "Na poradě navrhneš hlasování. Pak se ještě zeptáš, jestli s hlasováním všichni souhlasí.",
        "Úkol si označíš barvou podle důležitosti. Jen si potřebuješ ujasnit, která barva důležitost nejlíp vystihuje.",
        "E-mail s odmítnutím začneš tak mile, že na konci pro jistotu přidáš, že to tedy vlastně nejde.",
        "Než vybereš název složky, uděláš si tři návrhy. Složka „nová složka“ je zatím všechny hostí.",
      ],
      [
        "V týmu podporuješ rozhodnost. Zejména když ji za tebe projeví někdo jiný.",
        "Tvoje prezentace má dvacet snímků a jednotný styl. Závěr se ještě hledá, ale místo už má krásné.",
        "Souhlasíš s návrhem, který zazní poslední. Je příjemné, jak pružně u tebe fungují pevné priority.",
        "Když máš uzavřít debatu, shrneš oba pohledy. Účastníci tak přesně vědí, kde pořád jsou.",
      ],
      [
        "Do názvu souboru přidáváš „opravdu konečné“ tolikrát, že se celé zadání vejde do kratšího řádku než cesta k výsledku.",
        "Z krátké porady uděláš seriál. Každá řada končí otázkou, jestli už můžeme rozhodnout.",
        "Tvoje „pojďme si to potvrdit“ je kancelářský bumerang: pošleš úkol pryč a za hodinu ho má každý znovu na stole.",
        "Odkládáš verdikt tak dlouho, až z kalendáře uděláš výstavu promarněných pátků. Zato barevně sjednocenou.",
      ],
      [
        "Zadání posíláš na meziplanetární připomínky. Merkur schvaluje obsah, Saturn okraje a ty zakládáš komisi pro barvu razítka.",
        "Na poradě o vzniku galaxie požaduješ další varianty. Velký třesk přesouváš na dobu, až se vyjasní vizuální směr.",
        "Termín odevzdání přesouváš za horizont událostí. Černá díra ti posílá upomínku: i nekonečno má nějaké hranice.",
        "Pro jedinou prezentaci svoláváš radu souhvězdí. Po třech eonech schvaluješ první bod: vzdálenost odrážky od okraje.",
      ],
    ],
    zivot: [
      [
        "Umíš si všimnout hezkého detailu i v obyčejném dni. Třeba když hrnek přesně ladí s obálkou knihy.",
        "Doma vytváříš příjemnou atmosféru. I deka u tebe vypadá, že přesně ví, proč leží zrovna tam.",
        "Zvažuješ víc možností, protože v každé najdeš něco dobrého. I výběr marmelády tak dostane trochu pozornosti.",
        "Máš cit pro férovost i v maličkostech. Poslední sušenku rozdělíš tak hezky, že se skoro nechce jíst.",
      ],
      [
        "Před cestou z domu ladíš oblečení. Pak ještě hledáš klíče, které s celým záměrem odmítají spolupracovat.",
        "Na výběr tapety telefonu si otevřeš šest obrázků. Na původní tapetu se mezitím díváš celý večer.",
        "Když se ti líbí dvě vázy, představíš si doma obě. Teď už jen potřebuješ třetí názor a o trochu širší poličku.",
        "I při výběru čaje hledáš rovnováhu. Sáček zatím trpělivě čeká, jestli se smí namočit.",
      ],
      [
        "Ceníš si jednoduchosti. Proto máš na výběr jednoduchého řešení samostatný seznam.",
        "Svobodu volby si užíváš tak důsledně, že si ji nenecháš zkazit nějakou konkrétní volbou.",
        "Označíš si něco jako oblíbené a rozhodnutí odložíš. Tvoje oblíbené položky teď zahrnují celý obchod.",
        "Své zásady neměníš podle okolí. Jen jim dopřáváš místně přizpůsobenou formulaci.",
      ],
      [
        "Při nákupu hrnku uděláš tolik srovnání, že se porcelán naučí stárnout do retro stylu přímo v regálu.",
        "Tvoje čekání na správnou chvíli má čekárnu, pořadové lístky a ceduli „o otevření se jedná“.",
        "Ze dvou odstínů bílé vyrobíš celodenní drama. Zeď už by si nejradši vzala montérky a vymalovala sama.",
        "I kruhový objezd opouštíš s pocitem, že ostatní výjezdy nedostávají spravedlivou šanci.",
      ],
      [
        "Při výběru žárovky posuzuješ i hvězdy. Slunce ti vrací vzorník s poznámkou, že teplejší bílou už ze sebe nedostane.",
        "Mezi dvěma polštáři zvažuješ tak dlouho, že pro třetí názor natahuješ červí díru přímo do obýváku.",
        "V obchodě s galaxiemi žádáš rezervaci všech modelů. Vesmír ti přidává druhý rozměr času čistě na rozmýšlení.",
        "Při hledání vnitřní rovnováhy srovnáváš Saturnovy prstence pravítkem. Reklamaci pak podáváš kvůli nedostupné béžové.",
      ],
    ],
    pratele: [
      [
        "Umíš do hovoru přizvat i toho, kdo jen poslouchá. A nabídnout mu lepší místo než vedle hlučné lednice.",
        "V partě si všímáš, co komu udělá radost. U společné fotky ještě nenápadně vybereš hezké pozadí.",
        "Pomáháš přátelům najít společnou řeč. Občas přes společnou objednávku hranolek.",
        "Dokážeš pozvat různé povahy k jednomu stolu. Jen jim předem vyměníš neladící prostírání.",
      ],
      [
        "Když parta vybírá místo, podpoříš každý návrh. Pak ještě pošleš vlastní, čistě pro úplnost.",
        "Na skupinovou fotku nastavíš samospoušť. Těch deset vteřin věnuješ debatě, jestli je to správná zeď.",
        "Přátelům řekneš „kdykoli se stavte“. Hned pak dodáš dva časy, kdy je doma nejhezčí světlo.",
        "Když se dva přátelé neshodnou, navrhneš smír. Pro jistotu tak, aby si každý mohl vyložit vítězství po svém.",
      ],
      [
        "Každému v partě dáváš za pravdu. Je praktické, že si skupinové zprávy můžete přečíst všichni.",
        "Na společný plán odpovíš „za mě cokoli“. Své připomínky posíláš odděleně, aby souhlas zůstal přehledný.",
        "Slibuješ upřímný názor na oblečení. Nakonec pochválíš odvahu a navrhneš jiné světlo.",
        "Přátelství stavíš na rovnosti. Proto si hlídáš, aby nikdo nedostal méně neurčitou odpověď než ostatní.",
      ],
      [
        "Při domlouvání srazu vyrobíš tolik anket, že parta potřebuje ústřední volební komisi a pozorovatele k výběru kavárny.",
        "Svým „oba vás chápu“ uhladíš spor tak důkladně, že se teď oba hádají s tebou. Výborná práce se sjednocením skupiny.",
        "Když máš zvolit kavárnu, kamarádi cestou absolvují prohlídku celého města. Z posezení děláš poznávací zájezd vestoje.",
        "Do skupiny píšeš „nechci to komplikovat“ a hned přikládáš hlasování s větvením. Kamarádství u tebe potřebuje návod.",
      ],
      [
        "Na sraz zveš všech dvanáct znamení a pak zjišťuješ vhodný termín. Kalendář ti mezitím přepíná z dnů na geologické éry.",
        "Rozsazuješ partu po planetách, aby se nikdo necítil stranou. Pluto ti podává stížnost přes tři galaxie.",
        "Každému kamarádství dáváš vlastní souhvězdí. Teď přemísťuješ hvězdy, protože si někdo všímá, že jiné má hezčí tvar.",
        "Pro usmíření dvou přátel svoláváš galaktický sněm. Kvůli neutrálnímu zasedacímu pořádku necháváš vesmír rozpínat.",
      ],
    ],
    narozeniny: [
      [
        "Na své oslavě myslíš na každého. I poslední kousek dortu díky tobě dostane důstojný talířek.",
        "Umíš oslavě dodat půvab bez velkých gest. Tedy kromě nenápadné výměny všech ubrousků.",
        "Na dárcích si všímáš pozornosti, která v nich je. Hezká mašle má u tebe malý náskok.",
        "Svíčky na dortu rozestavíš tak hezky, že si před sfouknutím zaslouží ještě jednu fotku.",
      ],
      [
        "Přeješ si malé překvapení. Pro usnadnění pošleš seznam doporučených odstínů balicího papíru.",
        "Při výběru dortu ochutnáš dvě příchutě. Pak si dáš třetí vzorek, ať má rozhodování i vlastní občerstvení.",
        "Na pozvánku napíšeš „nic nenoste“. O chvíli později připojíš nenápadný odkaz na vázu.",
        "Před sfouknutím svíček zvažuješ přání. Pro jistotu máš hlavní, záložní a jedno, které by vyhovovalo oběma.",
      ],
      [
        "Říkáš, že jde hlavně o společný čas. Vyvážené rozmístění hostů přesto řešíš ve třech půdorysech.",
        "Na otázku, co si přeješ, odpovíš „cokoli“. Výraz nad rozbaleným dárkem má pak překvapivě přesnou specifikaci.",
        "Přeješ si oslavu bez velkého řešení. Proto dolaďuješ drobnosti už od měsíce před narozeninami.",
        "Svou oslavu označíš za neformální. Jen hostům nenápadně ukážeš, které talířky patří ke kterým zákuskům.",
      ],
      [
        "Při výběru přání nad dortem zdržíš celý obřad tak dlouho, až ze svíček uděláš voskovou verzi svého váhání.",
        "Tvoje „jen malé posezení“ potřebuje zasedací plán, zkušební osvětlení a komisi pro estetickou přijatelnost jednohubek.",
        "Než schválíš fotku z oslavy, hostům přibude materiál na další narozeninové album. Zatím pořád fotíš příchod.",
        "Chceš být na narozeniny středem pozornosti, ale nenápadně. Takže režíruješ, kdy si tě všichni mají náhodou všimnout.",
      ],
      [
        "Na svém dortu chceš symetrické svíčky, tak žádáš Saturn o zapůjčení prstenců. Drobky pak reklamuješ jako vadný hvězdný prach.",
        "Na přání nad dortem zakládáš galaktickou komisi. Než ho vyslovíš, Slunce přechází do úsporného režimu.",
        "Pro dokonalou narozeninovou fotku posouváš Mléčnou dráhu. Pak zkoušíš snímek bez ní, jen pro porovnání.",
        "Jako dárek si přeješ harmonii. Venuše ti posílá celou galaxii a ty zjišťuješ, jestli se dá vyměnit za méně třpytivou.",
      ],
    ],
  },
  s: [
    ["Možností po zúžení výběru", "19"],
    ["Souhlasů na jednu námitku", "2"],
    ["Odstínů přijatelné béžové", "47"],
    ["Platnost „vyber ty“", "8 s"],
    ["Rozhodnutí bez porady", "1 z 99"],
    ["Soulad hrnku s náladou", "98 %"],
  ],
  d: [
    "Dnes dáváš každé možnosti šanci. I té, že se k tomu vrátíš zítra.",
    "Dnes máš jasno: béžová. Teď už jen vybrat, která z těch sedmnácti.",
    "Dnes si chráníš klid. Heslo k němu zní „jak myslíš“ a měníš ho podle návštěvy.",
    "Dnes bereš život s nadhledem. Z téhle výšky jsou rozdíly mezi oběma hrnky konečně zanedbatelné.",
    "Dnes si zjednodušuješ rozhodování. Ze seznamu pro a proti děláš dva hezčí seznamy.",
    "Dnes ladíš byt s náladou. Nálada má zatím námitky k poloze lampy.",
    "Dnes říkáš věci na rovinu. Jen tu rovinu pro jistotu lehce nakláníš podle publika.",
    "Dnes máš vlastní názor. V pěti barevných provedeních a s možností výměny.",
    "Dnes u tebe i pomyslný jazýček vah čeká na schválení, jestli se smí vychýlit.",
    "Dnes dáváš intuici volnou ruku. Druhou jí nenápadně podáváš srovnávací tabulku.",
    "Dnes ti stačí málo ke štěstí. Jen to málo musí ladit se zbytkem.",
    "Dnes praktikuješ umění kompromisu: každý trochu ustoupí a váza zůstane tam, kde ji chceš mít.",
    "Dnes na sebe netlačíš. Rozhodnutí necháváš krásně odležet vedle těch včerejších.",
    "Dnes se tvé „možná“ tváří závazně. Má totiž nově tečku.",
    "Dnes vybíráš hudbu na pohodu. Výběr doprovází příjemné třičtvrtěhodinové ticho.",
    "Dnes si dovoluješ říct ne. Zatím si to zkoušíš na nevhodném odstínu ubrousku.",
    "Dnes máš rovnováhu na dosah. Jen musíš přesunout tři polštáře a jeden cizí názor.",
    "Dnes se držíš středu. I při výběru zákusku zkoumáš, jestli nejde objednat prostor mezi dvěma.",
    "Dnes třídíš oblíbené položky. Zakládáš jim složku „ještě oblíbenější, ale uvidíme“.",
    "Dnes necháváš mluvit činy. Začínáš přerovnáním těch debatních podkladů.",
    "Dnes hledáš harmonii v maličkostech. Proto si i nákupní seznam zaslouží jednotné okraje.",
    "Dnes vítáš různé názory. Vlastní si zatím odkládáš do šatny, ať nikoho neruší.",
    "Dnes dáváš přednost spontánnosti. Máš pro ni krásné okénko mezi dvěma konzultacemi.",
    "Dnes hodnotíš obě strany mince. Než si hodíš, potřebuješ ještě vědět, jak vypadá v denním světle.",
  ],
  q: [
    "Tam, kde to chutná nám oběma. Já prověřím osvětlení, ty židle. K večeři zatím můžeme dojíst ten výběr.",
    "Ty navrhni něco venku, já něco uvnitř. Pak se sejdeme na prahu a budeme tomu říkat vyvážený víkend.",
    "Já ohlídám tón, ty obsah. Za půl hodiny společně odešleme palec nahoru a oba začneme pochybovat.",
    "Já srovnám talíře podle barev, ty podle velikosti. Pak si oba přiznáme, že třídění se do mytí nepočítá.",
    "Já vyberu krásné místo, ty dobré spojení. Zatím máme čtrnáct krásných letišť a ani jeden kufr u dveří.",
    "Já chci hezký obraz, ty dobrý příběh. Dnes se nám oběma nejvíc líbí nabídka filmů. Už má druhou hodinu.",
  ],
};

export default vahy;
