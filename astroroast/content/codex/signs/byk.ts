// AstroRoast.ai: autorská varianta Codex pro znamení Býka.
// Tvar RawSign (viz content/types.ts); index 0 = úroveň 1:
//   h: 3 titulky na každou z 5 úrovní; c: 2 výchozí věty na úroveň; v: 2 verdikty na úroveň.
//   t: témata vztahy, prace, zivot, pratele, narozeniny; každé má 5 úrovní po přesně 4 větách.
//   s: 6 smyšlených statistik [popisek, krátká hodnota]; d: 24 denních jednovětek.
//   q: 6 párových odpovědí v pořadí COUPLE_SITUATIONS ze shared.ts.
// Ostrost: pohlazení → šťouchnutí → sarkasmus → ostrá pointa → kosmická absurdita.
// Terčem je stereotyp znamení; oslovení bez rodových tvarů, denní texty bez předpovědí událostí.

import type { RawSign } from "../../types";

const byk: RawSign = {
  h: [
    [
      "Umíš z obyčejného úterý udělat malý svátek. Stačí správný talíř.",
      "Máš vytříbený vkus. I tvoje pauza má hezkou podložku.",
      "Dáváš věcem čas. A lidem pocit, že nikam nemusí spěchat.",
    ],
    [
      "Než kývneš na dobrodružství, zajímá tě kvalita povlečení.",
      "Umíš vykročit ze zajetých kolejí. Hlavně když je poblíž cukrárna.",
      "Máš otevřenou mysl. Jen prosíš zavírat, ať netáhne.",
    ],
    [
      "Zvažuješ oba názory. Ten svůj a ten svůj po obědě.",
      "Změnu podporuješ. Z bezpečné vzdálenosti od vlastního programu.",
      "Říkáš, že jdeš s dobou. Doba tedy chvíli počká.",
    ],
    [
      "Máš tak pevný názor, že kvůli němu musí objížďkou i argument.",
      "Pleteš si kompromis s okamžikem, kdy ostatním dojdou připomínky.",
      "Chceš vystoupit z komfortní zóny? Nejdřív kolem ní stavíš předsíň.",
    ],
    [
      "Odmítáš změnu tak důsledně, že se vesmír rozpíná jen na opačnou stranu.",
      "Žádáš černou díru o vrácení polštáře. Horizont událostí není účtenka.",
      "Na galaktické radě vetuješ zítřek. Moc se liší od včerejška.",
    ],
  ],
  c: [
    [
      "Umíš poznat, co stojí za čas a pozornost. I obyčejný čaj si u tebe připadá jako slavnost.",
      "Držíš slovo a děláš kolem sebe příjemno. Občas k tomu přidáš i prostírání.",
    ],
    [
      "Novinkám dáváš šanci. Nejdřív ale malou, na samostatném talířku.",
      "Zrychlit umíš, jen chceš předem vědět, u čeho se pak bude odpočívat.",
    ],
    [
      "Na nové informace reaguješ důstojně: počkáš, až začnou souhlasit s původním názorem.",
      "Každý návrh pečlivě posoudíš podle tří kritérií: jestli je obvyklý, známý a stejný jako minule.",
    ],
    [
      "Svůj názor nevysvětluješ. Vydáváš ho po jednotlivých paragrafech a připomínky bereš jako tiskovou chybu.",
      "O pohodlí nevyjednáváš. I stěhovací krabici posuzuješ podle toho, jestli má opěrku.",
    ],
    [
      "Na oběžné dráze si označuješ své místo dekou. Saturnovy prstence už vnímáš jen jako tác na drobnosti.",
      "Při vzniku vesmíru žádáš zkušební verzi. Velký třesk bez možnosti vrácení do původního stavu neschvaluješ.",
    ],
  ],
  v: [
    [
      "Umíš zpříjemnit den. A ještě k němu vybrat skvělou přílohu.",
      "Máš dar vydržet u toho, na čem záleží. U dobrého čaje obzvlášť.",
    ],
    [
      "Můžeš si trochu povolit. Třeba pravidla pro umístění podtácku.",
      "Na nové zážitky máš místo. Hned vedle těch osvědčených, ať se nebojí.",
    ],
    [
      "Nasloucháš všem stranám. Rozhoduješ tou svou.",
      "Dáváš změně zelenou. Semafor máš zatím ve sklepě.",
    ],
    [
      "V debatě nepovolíš ani milimetr. Proto se s tebou jedná přes katastr.",
      "Tvůj neústupný postoj už vyžaduje stavební povolení.",
    ],
    [
      "Na úřadě pro paralelní vesmíry žádáš ten samý. Bez novinek.",
      "Držíš si své místo tak pevně, že máš vlastní souřadnice ve všech galaxiích.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1: pohlazení
        "Lásku dáváš najevo drobnou péčí. Umíš podat deku přesně ve chvíli, kdy začíná být potřeba.",
        "Ve dvou vytváříš příjemné rituály. I obyčejná středa u tebe dostane oblíbený hrnek.",
        "Pamatuješ si drobnosti, které dělají druhému radost. Třeba správnou křupavost topinky.",
        "Na vztah si umíš udělat čas. Ve spěchu se přece nedá pořádně ani držet za ruku.",
      ],
      [ // úroveň 2: šťouchnutí
        "Na schůzku se těšíš. Jen potřebuješ ujistit, že se nebude stát u vysokého stolku.",
        "Změnu ve vztahu vítáš, pokud jde o čisté povlečení a zůstává stejný vzor.",
        "Pro romantickou improvizaci máš slabost. Hlavně když proběhne podle domluvy.",
        "O své hranolky se dělíš z lásky. Počítat je předem je přece jen organizační detail.",
      ],
      [ // úroveň 3: sarkasmus
        "Při debatě hledáš společnou řeč. Nejsnáze ji poznáš podle toho, že cituje tebe.",
        "Ve vztahu ponecháváš prostor pro rozvoj. Přesně mezi botníkem a osvědčenými zvyky.",
        "Svůj romantický repertoár považuješ za nadčasový. Stačí nevěnovat pozornost kalendáři.",
        "Kompromis přijímáš ochotně: protějšek navrhne změnu a ty ochotně vysvětlíš, proč nebude.",
      ],
      [ // úroveň 4: ostrá pointa
        "Ve dvou hledáš soulad tak usilovně, až z druhého názoru uděláš překlep ve vlastním projevu.",
        "Pro změnu strany postele vyžaduješ tolik podpisů, že má vaše ložnice vlastní petiční výbor.",
        "Romantické překvapení udusíš požadavkem na přesný čas, obsah a možnost opakovat minulé.",
        "Na větu „něco zkusíme jinak“ reaguješ takovým tichem, že si i přesýpací hodiny sednou.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Venuši při konzultaci vašeho vztahu přiděluješ stálé místo u stolu. Je planetou, ale výjimky neděláš.",
        "Kvůli přesunu společné deky svoláváš radu galaxií. K usnášeníschopnosti potřebuješ tři mlhoviny a původní deku.",
        "Kupidův šíp vracíš s reklamací: žádáš cit, který se hodí k závěsům a nevyžaduje přestavbu vesmíru.",
        "Pro společný život vybíráš paralelní vesmír. Máte tam všechno stejné, jen o polštář víc.",
      ],
    ],
    prace: [
      [ // úroveň 1: pohlazení
        "Co vezmeš do rukou, dotahuješ pečlivě. I sponka má pocit, že patří do kvalitního projektu.",
        "Dokážeš udržet klid i u náročného úkolu. Jen si k tomu nejprve srovnáš podložku.",
        "Týmu dáváš pevnou půdu pod nohama. A občas tip, kde mají opravdu dobrý čaj.",
        "Na výsledku ti záleží i v detailech. Poznáš dobře odvedenou práci stejně jako poctivé těsto.",
      ],
      [ // úroveň 2: šťouchnutí
        "Nový pracovní postup zkusíš. Jen chceš ten původní ponechat pro příjemný pocit z návratu.",
        "Na pracovní židli máš jasná kritéria. Schopnost otáčet se k novým nápadům zatím neřešíš.",
        "Do nového projektu se pouštíš s rozvahou. Nejdřív zjišťuješ, kde se dělá přestávka.",
        "Na poradě souhlasíš s posunem. Zvlášť když jde o přesunutí porady až po svačině.",
      ],
      [ // úroveň 3: sarkasmus
        "Pracovní postup máš ověřený časem. Především tím, který věnuješ odmítání jiných postupů.",
        "Na školení o pružnosti přístupu sedíš na svém obvyklém místě a žádáš původní osnovu.",
        "Do kolonky „otevřenost změnám“ píšeš ano. Formulář máš uložený od roku 2011.",
        "Nové nástroje hodnotíš nezaujatě. Rovnou podle toho, co ti na nich nebude vyhovovat.",
      ],
      [ // úroveň 4: ostrá pointa
        "Když se má zjednodušit postup, nasadíš tolik námitek, že firma potřebuje nový postup na tvoje námitky.",
        "Na poradě dokážeš slovem „ale“ vrátit celý projekt do doby, kdy se porady teprve vynalézaly.",
        "Své pracovní návyky chráníš tak urputně, že i výměnu toneru vnímáš jako převrat ve vedení.",
        "Tvrzení „vždycky to tak fungovalo“ používáš místo návodu. S touhle logikou ještě tiskneš na kámen.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Na galaktické poradě žádáš zachovat původní soustavu. Nové planety nemají zaškolení.",
        "Merkuru vracíš vesmírný oběžník. Přechod na rychlost světla nemáš v popisu práce.",
        "Při stěhování kanceláře do jiné galaxie žádáš zachovat výhled. Stěhuješ tedy i souhvězdí za oknem.",
        "Kvantový počítač nutíš čekat na schválení postupu. Všechny jeho možné stavy už mají po pracovní době.",
      ],
    ],
    zivot: [
      [ // úroveň 1: pohlazení
        "Umíš se zastavit u hezké chvíle. Západ slunce u tebe nemusí soupeřit s další položkou seznamu.",
        "Domov tvoříš z věcí, které tě těší. I světlo si u tebe sedne trochu pohodlněji.",
        "Poznáš kvalitu bez dlouhého vysvětlování. Dobré pečivo tě přesvědčí už při prvním křupnutí.",
        "Na obyčejném dni nacházíš dost příjemného. Třeba to, jak dobře ti padne do ruky oblíbený hrnek.",
      ],
      [ // úroveň 2: šťouchnutí
        "Novou cestu domů klidně zkusíš. Jakmile si ověříš, že vede kolem stejné pekárny.",
        "Přesouváš vázu a už máš pocit, že si letošní dávku dobrodružství můžeš odškrtnout.",
        "Svou rutinu občas osvěžíš. Třeba tím, že si oblíbený pořad pustíš o tři minuty dřív.",
        "Před odchodem z domu hledáš klíče a důvod. Klíče se obvykle najdou snáz.",
      ],
      [ // úroveň 3: sarkasmus
        "Zkoušíš žít přítomností. Pokud se dostatečně podobá minulému čtvrtku.",
        "Své zvyky průběžně přehodnocuješ. Vždycky tě příjemně překvapí, že opět obstojí všechny.",
        "Na nový začátek věříš. Ideálně s původním nábytkem, programem a veškerým pokračováním.",
        "Svůj život řídíš podle chuti. Chuť na změnu má zatím omluvenku.",
      ],
      [ // úroveň 4: ostrá pointa
        "Oblíbený hrnek bráníš tak důsledně, že k myčce chybí už jen vodní příkop.",
        "Při přesunutí koberce vnímáš domov jako cizí stát a žádáš tlumočení návodu k obýváku.",
        "Na větu „zkus něco nového“ odpovídáš obhajobou starého toustovače. Slyšení připomínek odkládáš na neurčito.",
        "Kdyby šlo zakázat pondělí za změnu víkendu, už kvůli tomu objíždíš úřady. S vlastním polštářem do čekárny.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Při rozpínání vesmíru si přitahuješ konferenční stolek blíž. Kosmologii neschvaluješ, pokud nedosáhneš na sušenky.",
        "Černou díru využíváš jako úložný prostor. Jen ji předem žádáš, ať ti nesmíchá sezónní deky.",
        "Při objevu nové dimenze žádáš fotky interiéru. Do prostoru bez závěsů rozhodně nevstupuješ.",
        "Na konci časoprostoru žádáš prodloužení pobytu. Konečně máš pečivo přesně propečené.",
      ],
    ],
    pratele: [
      [ // úroveň 1: pohlazení
        "Pro přátele vytváříš místo, kde se dá vydechnout. Obvykle i s něčím dobrým na malém talířku.",
        "Pamatuješ si, co mají blízcí nejradši. Tvoje pozvání působí jako osobní jídelní lístek.",
        "Umíš naslouchat bez koukání na hodiny. Výjimkou je čas, kdy se vytahuje koláč.",
        "Přátelství pěstuješ trpělivě. Společné rituály u tebe postupně získávají vlastní hrnky.",
      ],
      [ // úroveň 2: šťouchnutí
        "Na výlet s partou kývneš s jedinou otázkou: kolik z toho je posezení?",
        "Kamarádům dáváš volnou ruku při výběru podniku. S potěšením jim pak připomeneš ten svůj.",
        "Návštěvu vždycky uvítáš. Jen potřebuješ drobný náskok na přípravu občerstvení a vlastního odhodlání.",
        "Ve skupinové debatě navrhneš něco odvážného: stejný podnik, ale stůl u druhého okna.",
      ],
      [ // úroveň 3: sarkasmus
        "S partou rozhoduješ demokraticky. Každý může hlasovat pro tvůj návrh.",
        "Kamarádům dopřeješ vlastní názor. Jen pro něj zatím nemáš místo v programu.",
        "Když říkáš „přizpůsobím se“, očekáváš od přátel správné pochopení slova „se“.",
        "Ve skupině si udržuješ pověst jistoty. Předem se ví, které nápady zamítneš.",
      ],
      [ // úroveň 4: ostrá pointa
        "Partu vedeš ke kompromisu tak dlouho, až si všichni pletou vlastní přání s tvou objednávkou.",
        "Když kamarádi chtějí jinam, předložíš tak dlouhou obhajobu oblíbeného podniku, že se mezitím mění jídelní lístek.",
        "Výběr restaurace s tebou připomíná únikovou hru. Nápovědy dáváš všechny, východ nepovolíš ani jeden.",
        "Na spontánní sraz přinášíš pevný program. Je tak pevný, že si o něj parta může opřít kola.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Na setkání s mimozemšťany trváš na známém podniku. Ať překonají osm galaxií, rezervaci už máš.",
        "Partě slibuješ výlet za hranice vesmíru. Bereš vlastní posezení, aby se to tam moc nelišilo.",
        "V galaktické skupině zamítáš nové místo srazu. Požaduješ planetu s původním stolkem číslo sedm.",
        "Červí díru využíváš pro setkání s přáteli. Ústí povoluješ výhradně vedle svého křesla.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1: pohlazení
        "Oslavu umíš proměnit v příjemný společný čas. Dort má důležitou, ale dobře obsazenou vedlejší roli.",
        "Z drobného dárku máš velkou radost, když je vybraný s péčí. Na hezký hrnek se u tebe místo najde.",
        "Sváteční den si umíš vychutnat bez spěchu. Svíčky mají čas zazářit i před fotografováním.",
        "Na narozeniny zveš hlavně pohodu. Lidé ji poznají podle toho, že si ještě přisednou.",
      ],
      [ // úroveň 2: šťouchnutí
        "Překvapení k narozeninám máš nejradši s předběžným seznamem přísad.",
        "Dárkové přání necháváš otevřené. Jen přidáváš odkaz, barvu a přesné rozměry.",
        "Při krájení dortu postupuješ s rozvahou. První kousek přece nastavuje směr celé oslavy.",
        "Narozeninový program občas obměníš. Letos dovolíš zapálit svíčky z druhé strany.",
      ],
      [ // úroveň 3: sarkasmus
        "S každým dalším rokem přijímáš změnu čísla. Tím považuješ letošní inovace za vyřízené.",
        "Oslavu plánuješ podle osvědčeného scénáře. Nový věk se musí přizpůsobit.",
        "Dáváš hostům svobodu výběru dárku. V rámci přiložené specifikace je prakticky neomezená.",
        "Přeješ si den plný překvapení. Kladně hodnotíš hlavně ta, o kterých víš už týden.",
      ],
      [ // úroveň 4: ostrá pointa
        "Nechceš oslavu s překvapením. Chceš reprízu loňska s opraveným počtem svíček a bez dramaturgických ambicí.",
        "Seznam přání sepisuješ tak závazně, že dárková taška vypadá jako doručená soudní obsílka.",
        "Změnu příchuti dortu posuzuješ jako porušení ústavy. Krájet se začne až po obnovení pořádku.",
        "Svou oslavu chráníš před improvizací tak důkladně, že i konfety nejdřív řadíš na schválená místa dopadu.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Svíčky na dortu zapaluješ pomocí vzdálených hvězd. Místní Slunce ti barevně neladí s polevou.",
        "Od vesmíru si přeješ zachovat letošní pohodlí. Galaktická rada proto ruší vývoj a zřizuje ti oddělení stálosti.",
        "Při narozeninovém přání odmítáš novou životní kapitolu. Do knihy času vkládáš záložku a bráníš otočení stránky.",
        "Na narozeninový dort si rezervuješ Saturnovy prstence. Průměr schvaluješ, ale trváš na obvyklé příchuti.",
      ],
    ],
  },
  s: [
    ["Razítek nutných ke změně plánu", "18"],
    ["Pružnost názoru po obědě", "0,4 %"],
    ["Dosah pohodlí od polštáře", "80 cm"],
    ["Schválených překvapení", "1 z 9"],
    ["Zkušební lhůta pro nový hrnek", "6 let"],
    ["Věrnost oblíbené příloze", "100 %"],
  ],
  d: [
    "Dnes máš na změnu názoru dost času. Přesně tolik, kolik věnuješ hledání důvodů, proč není nutná.",
    "Dneska testuješ nové obzory: sedíš na druhém konci lavice a zvažuješ návrat.",
    "Dnes si své pohodlí pěstuješ pečlivě. Deku nemusíš zalévat, což je velká výhoda.",
    "Dneska chápeš slovo „pružnost“ hlavně v souvislosti s kvalitním polštářem.",
    "Dnes bereš změnu jako koření. Špetku připustíš, zbytek necháváš v obchodě.",
    "Dneska si dáváš načas tak poctivě, že i pauza potřebuje přestávku.",
    "Dnes máš program nabitý drobnými radostmi. Pro přesuny mezi nimi hledáš co nejměkčí trasu.",
    "Dneska novému nápadu nasloucháš. Hlavně jestli náhodou nepopisuje ten tvůj starý.",
    "Dnes otestuješ hranice komfortní zóny: zjišťuješ, kam až dosáhne nabíječka.",
    "Dneska dáváš prostor oběma variantám. S knedlíkem i s bramborem.",
    "Dnes si držíš vlastní tempo. Ani přehrávání ve dvojnásobné rychlosti s tebou nehne.",
    "Dneska vnímáš slovo „novinka“ jako zdvořilou výzvu ke zvýšené opatrnosti.",
    "Dnes si děláš pohodlí tak důkladně, že i polštář má kam si podložit roh.",
    "Dneska připouštíš jiný názor. Do debaty zatím vstupuje jen jako návštěva.",
    "Dnes máš velké plány. Jejich provedení posuzuješ podle vzdálenosti od konvice.",
    "Dneska dáváš životu šanci tě překvapit. Podmínky zasíláš ve třech přílohách.",
    "Dnes držíš kurz. Pro jistotu i zábradlí, aby kurz nezačal někam odbočovat.",
    "Dneska důvěřuješ intuici. Zejména když radí objednat osvědčenou přílohu.",
    "Dnes si hlídáš detaily: teplotu čaje, polohu deky a vzdálenost od rušivých nápadů.",
    "Dneska zkoušíš malý ústupek. Na zkoušku, v původním obalu, s možností vrácení.",
    "Dnes dáváš svůj názor k nahlédnutí. Kolonka pro připomínky je pěkná dekorace.",
    "Dneska přijímáš výzvu vykročit do neznáma. Vyžaduješ jen přesný půdorys a fotky sezení.",
    "Dnes máš v sobě klid starého stromu. Hlavně když někdo navrhuje změnit místo.",
    "Dneska si užíváš svobodu volby. Opět volíš všechno stejně, ale ten pocit je hezký.",
  ],
  q: [
    "Vyber cokoli. V tom podniku, co mám uložený. A z té stránky jídelního lístku, kterou ti ukazuju.",
    "V sobotu odpočíváme. V neděli nechávám rezervu, kdyby se sobotní program protáhl.",
    "„Platí.“ Dvě slabiky, stejná váha jako podpis u notáře. Další zprávy už prosím bez změn.",
    "Umyju ho po čaji. Ten hrnek vedle dřezu je písemný příslib, že se k tomu postupně blížím.",
    "Hledej něco s výhledem na snídani. Památky si pak můžeme prohlédnout na pohlednicích u recepce.",
    "Pusť náš oblíbený seriál. Můžeme začít jinou epizodou, ať má večer trochu napětí.",
  ],
};

export default byk;
