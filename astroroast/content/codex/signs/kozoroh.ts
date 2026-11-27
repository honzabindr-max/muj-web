// AstroRoast.ai: původní české texty varianty Codex pro Kozoroha.
// Tvar RawSign; index 0 = úroveň 1, postupně pohlazení až kosmická nadsázka.
// h: 3 titulky na úroveň; c: 2 hlavní věty na úroveň; v: 2 verdikty na úroveň.
// t: 5 témat (vztahy, prace, zivot, pratele, narozeniny), každé má 5 úrovní po přesně 4 větách.
// s: 6 falešných statistik [popisek, hodnota]; d: 24 denních vět bez skutečných předpovědí.
// q: 6 párových odpovědí v pořadí COUPLE_SITUATIONS v ../shared.ts.
// Hotové věty bez zástupných značek a rodově označených tvarů o čtenáři.
// Humor míří jen na stereotyp znamení; úroveň 5 je absurdní, nikdy krutá.

import type { RawSign } from "../../types";

const kozoroh: RawSign = {
  h: [
    [
      "Držíš slovo. I když by se ti víc hodilo přesunout ho na čtvrtek.",
      "Umíš dojít daleko. Svačinu pro jistotu plánuješ taky.",
      "Máš pevný směr a v kapse nejspíš i náhradní kompas.",
    ],
    [
      "Umíš vypnout. Jen si předem rozepíšeš postup.",
      "I malou radost si pro jistotu uložíš do záložek.",
      "Máš plán na všechno. Včetně chvíle, kdy ho někdo pochválí.",
    ],
    [
      "Máš všechno pod kontrolou. Zábava se zatím nevyjádřila.",
      "Volný čas si zasloužíš. Zbývá schválit, jestli už dost.",
      "Nasloucháš každému názoru. Některé rovnou zakládáš mezi omyly.",
    ],
    [
      "I na skluzavce hledáš možnost kariérního postupu.",
      "Z výletu do přírody uděláš výběrové řízení na nejlepší šišku.",
      "Vypěstuješ bonsaj a vyčteš jí nedostatek ambicí.",
    ],
    [
      "Saturnu vracíš prstence: chybí jim měřítko úspěchu.",
      "I za hranicí vesmíru hledáš vyšší pozici.",
      "Černé díře vysvětluješ, že pohlcovat všechno není strategie.",
    ],
  ],
  c: [
    [
      "Umíš proměnit velké sliby v malé, poctivé kroky. I ten první má u tebe pohodlné boty.",
      "Dáváš věcem pevný základ. Kdyby šlo stavět z důvěry, už vybíráš hezkou střechu.",
    ],
    [
      "Všechno bereš zodpovědně. I u hry Člověče, nezlob se si nejdřív ověříš, kdo ručí za kostku.",
      "Máš smysl pro humor. Jen občas pointu doplníš doporučením pro příště.",
    ],
    [
      "Úspěch umíš ocenit. Přibližně šest vteřin, než ho přejmenuješ na nový minimální standard.",
      "Tvá skromnost je obdivuhodná. O svých výsledcích mluvíš jen tehdy, když o nich zrovna nemluví nikdo jiný.",
    ],
    [
      "Na vrcholu hory si nestoupneš kvůli výhledu. Potřebuješ všem dole upřesnit, kdo je teď výš.",
      "I z pytlíku bonbonů uděláš oddělení s vedoucím. A pak se divíš, že se medvídci drží při zemi.",
    ],
    [
      "Vesmír se rozpíná a ty už mu píšeš, že růst bez jasných cílů je jen nafukování prostoru.",
      "Při setkání s mimozemskou civilizací jí nejdřív nabídneš spolupráci a pak se zeptáš, komu se tu hlásí výsledky.",
    ],
  ],
  v: [
    [
      "Máš výdrž i laskavost. Klidně si pochvalu nech jen tak, bez dalšího úkolu.",
      "Umíš věci dotáhnout. Dnes si za to můžeš připsat i jednu obyčejnou radost.",
    ],
    [
      "Pauzu si klidně dej. Nemusíš ji nejdřív vyhrát ve výběrovém řízení.",
      "Umíš se radovat. Zkus k tomu jednou nepřikládat důkaz o zásluhách.",
    ],
    [
      "Zvládáš toho hodně. Zvlášť vysvětlování, proč ostatní zvládají málo.",
      "Máš nadhled. Zrovna z něj kontroluješ, jestli ostatní plní zadání.",
    ],
    [
      "I potlesk bereš jako průběžnou zprávu o výkonu. Lidi tleskají, ty měříš prodlevy.",
      "Užij si vrchol. Výtah tu má tlačítko dolů, které důsledně ignoruješ.",
    ],
    [
      "Saturnu škrtáš prstence. Na tak malou planetu má podle tebe zbytečně moc vedoucích kruhů.",
      "Ani nekonečno ti nestačí. Na konec vesmíru lepíš ceduli „prostor pro zlepšení“.",
    ],
  ],
  t: {
    vztahy: [
      [
        "Lásku umíš ukázat drobností, kterou si pamatuješ. Třeba jaký čaj patří do oblíbeného hrnku.",
        "Umíš být oporou bez velkých proslovů. Zato víš, kde je deka, když se ochladí.",
        "Společné plány bereš vážně. I výlet pro zmrzlinu má díky tobě příjemně jistý cíl.",
        "Dáváš pozor na to, co má druhý člověk rád. Někde mezi úkoly máš nejspíš i „udělat radost“.",
      ],
      [
        "Před prvním rande zjišťuješ otevírací dobu, trasu i náhradní trasu. Chemii zatím necháváš bez dozoru.",
        "Na otázku „myslíš na mě?“ umíš odpovědět přesně. Máš na to pravidelné upozornění.",
        "Společný večer umíš hezky připravit. Jen tu romantickou chvíli zkus nahlásit trochu méně služebně.",
        "Vyznání lásky bereš vážně. Když řekneš „počítám s tebou“, už hledáš místo na druhý hrnek.",
      ],
      [
        "Na větu „chybíš mi“ odpovíš návrhem dostupných termínů. Je hezké, že se city dají rezervovat.",
        "Umíš naslouchat tomu, co vztahu schází. Hned vysvětlíš, proč to není v letošních prioritách.",
        "Když ti někdo řekne, že láska není soutěž, zajímá tě, kdo tedy průběžně vyhrává.",
        "O společné budoucnosti mluvíš otevřeně. Připomínky k ní přijímáš do pátku, změny nejsou zaručeny.",
      ],
      [
        "Na rande se ptáš, kde se druhý člověk vidí za pět let. Pak ukážeš na židli vedle sebe a řekneš „tady máš zadání“.",
        "Z romantického pikniku uděláš rozbor drobků. I mravenci od tebe odcházejí s přiděleným úsekem deky.",
        "Na polibek v dešti navrhneš střechu, harmonogram a závěrečnou kontrolu romantiky. Zůstane ti suchý zápis.",
        "I společnému plyšákovi vyčítáš, že se ve vztahu nikam neposouvá. Už mu píšeš plán osobního rozvoje.",
      ],
      [
        "Venuši vracíš návrh romantiky s poznámkou „málo konkrétní“. Teď k tobě posílá souhvězdí ve formátu přílohy.",
        "I spřízněnou duši z jiné galaxie necháš vyplnit vstupní formulář. U kolonky „navždy“ požaduješ přesné datum.",
        "Na rande pod hvězdami se ptáš, které z nich mají oprávnění svítit na vaše společné cíle.",
        "Kvůli výročí posouváš oběžnou dráhu Země. Slunce má výhrady, ale ty už rozesíláš pozvánky.",
      ],
    ],
    prace: [
      [
        "Umíš dát nápadu konkrétní podobu. Díky tobě má i odvážný začátek první rozumný krok.",
        "Dotahuješ drobnosti, které ostatním utečou. I poslední příloha má u tebe své místo na slunci.",
        "Když něco slíbíš na středu, dá se s tou středou počítat. Kalendář se vedle tebe cítí užitečně.",
        "Umíš zachovat klid, když se zadání změní. Tužku máš pro jistotu ořezanou z obou stran.",
      ],
      [
        "Na poradě se hlásíš s krátkou poznámkou. Má tři body a jeden nenápadný podvýbor.",
        "Když ti někdo pochválí práci, poděkuješ a zeptáš se, jestli to může poslat i písemně.",
        "Při slově „povýšení“ zbystříš tak rychle, že na schodišti automaticky bereš dva schody najednou.",
        "I složku „různé“ máš rozdělenou podle závažnosti. Náhoda u tebe dostane aspoň pořadové číslo.",
      ],
      [
        "V týmu oceňuješ samostatnost. Hlavně když samostatně všichni dojdou k tomu, co chceš ty.",
        "Umíš delegovat. Zadání pustíš z ruky, pravomoc k rozhodování zatím zůstává v bezpečí u tebe.",
        "Zpětnou vazbu vítáš. Tu pochvalnou si uložíš, tu ostatní opravíš.",
        "Na poradě chceš slyšet i jiné řešení. Je přece fér dát mu možnost neobstát vedle tvého.",
      ],
      [
        "I pracovní židli motivuješ k vyšší pozici. Už se dotýká stropu a pořád od tebe slyší, že má rezervy.",
        "Po skončení porady rozešleš úkoly i pokojovým kytkám. Fíkus má do pátku dodat tři nové listy.",
        "Na větu „dobrá práce“ odpovíš „a co dál?“. I razítko HOTOVO u tebe razítkuje jen na zkušební dobu.",
        "Z firemního výletu uděláš výkonnostní prověrku. I provaz při přetahování musí obhájit, proč táhne jen jedním směrem.",
      ],
      [
        "Galaxii rozděluješ na oddělení. Mléčná dráha od tebe dostává výtku za neurčitý popis pracovní náplně.",
        "Černé díře posíláš hodnocení: „Výborný příjem, žádné výstupy.“ Už jí sestavuješ nápravný plán.",
        "Světlu zadáváš zrychlení o deset procent. Fyzikální zákony si u tebe musí požádat o výjimku.",
        "Z oběžnic děláš podřízené. Pluto ti posílá žádost o návrat a ty požaduješ doložit předchozí planetární praxi.",
      ],
    ],
    zivot: [
      [
        "Umíš si jít za svým krok po kroku. Po cestě ještě nezapomeneš zalít kytku.",
        "Máš trpělivost i na věci, které rostou pomalu. Jen rajčatům občas připomeneš jejich potenciál.",
        "Dáváš svým dnům pevný rytmus. I obyčejná neděle má díky tobě kam odložit klíče.",
        "Umíš se postarat o to podstatné. Radost z maličkostí máš pro jistotu taky na seznamu.",
      ],
      [
        "I nákupní seznam si píšeš podle trasy obchodem. Pro rohlíky vedeš překvapivě přesnou expedici.",
        "Na procházce počítáš kroky. Čistě pro radost, kterou si večer porovnáš s minulým týdnem.",
        "Když máš půl hodiny volna, první minuty věnuješ výběru nejvhodnějšího způsobu, jak je využít.",
        "I u stavebnice čteš návod dopředu. Chceš vědět, jestli ten domek má nějakou perspektivu.",
      ],
      [
        "Žiješ přítomností. Jen si ji neustále přesouváš na dobu, až doděláš všechno ostatní.",
        "Umíš si užít maličkosti. Pokud jsou součástí něčeho podstatně většího, co se dá vykázat.",
        "Za odměnu si pořídíš nový diář. Teď máš konečně kam napsat, že potřebuješ méně povinností.",
        "Máš krásný výhled do budoucnosti. Na současnost z něj bohužel není moc vidět.",
      ],
      [
        "I pískový hrad stavíš s cílem ovládnout pobřeží. Bábovičky používáš jako organizační strukturu.",
        "Na lavičku si sedáš a už hodnotíš její nevyužitý potenciál. Chceš, aby kromě sezení začala nést výsledky.",
        "Na konci duhy nehledáš poklad. Zajímá tě, kdo vede druhý konec a jestli se ta pozice neuvolní.",
        "I vlastnímu stínu vytýkáš, že tě jen následuje. Ať konečně jednou ukáže trochu iniciativy.",
      ],
      [
        "Na konci časoprostoru požaduješ prodloužení. Tak málo místa na osobní růst přece nemůže nikdo myslet vážně.",
        "Prázdnotě mezi galaxiemi přiděluješ úkol. Podle tebe se nemůže jen tak celé věky tvářit, že má volno.",
        "I z paralelních vesmírů si necháváš posílat výsledky. Všechny tvoje verze mají být do pondělí lepší než ty ostatní.",
        "Velkému třesku vracíš vesmír k přepracování. Po tolika miliardách let už chceš lepší systém ukládání planet.",
      ],
    ],
    pratele: [
      [
        "Umíš si všimnout, co přátelům usnadní den. Někdy je tvé „mám s sebou nabíječku“ skoro vyznání.",
        "Držíš domluvený čas i místo. Přátelé díky tobě vědí, že „někdy zajdeme ven“ může mít i datum.",
        "Umíš podpořit cizí nápad konkrétním krokem. K obdivnému „to zní dobře“ přidáš i volnou sobotu.",
        "Pamatuješ si drobná přání přátel. Tvůj seznam poznámek je vlastně docela něžné čtení.",
      ],
      [
        "Do skupiny píšeš „jen organizačně“ tak často, že už to můžeš používat místo pozdravu.",
        "Na společný výlet bereš náhradní mapu. Pro případ, že by se ostatní rozhodli užít si bloudění.",
        "Na deskovou hru přineseš přehled pravidel. A čistě náhodou i tabulku předchozích výsledků.",
        "Při otázce „kdo vezme deku?“ už máš přehled kapacit. Přátelé přitom chtějí jen sedět na trávě.",
      ],
      [
        "Přátele podporuješ v jejich snech. Nejdřív jim vysvětlíš, kde je v nich chyba.",
        "Na srazu umíš dát prostor všem. Jakmile každý stručně sdělí, čeho od minula dosáhl.",
        "Za úspěch přátel se umíš upřímně radovat. Jen si pro pořádek ověříš, jestli je menší než tvůj.",
        "Umíš přátele ocenit takové, jací jsou. V příloze pak posíláš, jací by ještě mohli být.",
      ],
      [
        "Do skupiny přátel zavádíš výroční hodnocení. I smajlík musí doložit, čím přispívá k atmosféře.",
        "Na pikniku přiděluješ funkce i ubrouskům. Jeden na odpočinek zatím čeká na schválení vyšší vrstvy.",
        "Sotva přátelé řeknou „pojďme si hrát“, už držíš nástěnku s postupovou tabulkou a pravidly odvolání.",
        "I táboráku vyčteš, že jen hoří na místě. Chceš vidět plán, jak se do příštího srazu posune.",
      ],
      [
        "Na setkání přátel svoláváš i souhvězdí. Velkému vozu přiděluješ odvoz a Malému vysvětlíš, že má růstový potenciál.",
        "Přátelům z vedlejší galaxie vracíš pozdrav. Na dva světelné roky letu by měl obsahovat konkrétnější přínos.",
        "Na společný výlet měníš sklon zemské osy. Přátelům tvrdíš, že přizpůsobit se skupině přece může každý.",
        "I padající hvězdě ze skupiny pošleš dotaz, jestli má na ten odchod schválení. Přání počká na zápis.",
      ],
    ],
    narozeniny: [
      [
        "Na narozeniny si přeješ něco, co vydrží. Hezká vzpomínka splňuje tvoje požadavky i bez záručního listu.",
        "Umíš hostům připravit příjemný večer. Každý má místo a dort se pro jistotu vejde na stůl.",
        "Další rok vítáš s novým cílem. Dnes si k němu klidně dovol i druhý kousek dortu.",
        "Dárky umíš ocenit za pozornost, kterou v nich vidíš. Úhledně převázaný provázek má jen malý náskok.",
      ],
      [
        "Při přání nad dortem myslíš konkrétně. Svíčka pro jistotu slyší i termín splnění.",
        "Na seznam přání píšeš diář. Překvapení pořád vítáš, jen ať má správný počet stránek.",
        "Před oslavou se ptáš, kdo kdy dorazí. Přirozeně tě zajímá, jak se ta radost časově poskládá.",
        "Na dortu chceš nápis „Všechno nejlepší“. U formulace „to stačí“ máš už ze zvyku výhrady.",
      ],
      [
        "Na otázku „co si přeješ?“ odpovíš „nic velkého“. V příloze posíláš technické parametry.",
        "Ohlédneš se za rokem a sepíšeš výsledky. Vzpomínky bez měřitelného přínosu se do přehledu nedostanou.",
        "Na vlastní oslavě sleduješ čas. Někdo přece musí ověřit, že si všichni užívají podle plánu.",
        "Přání „ať se ti splní sny“ bereš jako neurčité zadání. Prosíš o seznam a pořadí důležitosti.",
      ],
      [
        "Dortu vyčteš nízké ambice. Se třemi patry už by podle tebe dávno mohl mířit na věžák.",
        "Na vlastní narozeniny přineseš dortu pracovní hodnocení. Svíčky svítí naplno, ale ty chceš vidět růst.",
        "I gratulaci opravíš z „hodně úspěchů“ na „nejvíc úspěchů“. Další rok přece nezačneš bez vedoucí pozice.",
        "Z narozeninové oslavy uděláš výroční sjezd své výjimečnosti. Hosté při krájení dortu schvalují další pětiletku.",
      ],
      [
        "Na narozeninový dort si skládáš planety podle velikosti. Jupiter vracíš do trouby, protože pořád nenaplnil očekávání.",
        "Při sfoukávání svíček ztlumíš celé souhvězdí. Na přání „víc“ už galaktický úřad nechce vystavovat povolení.",
        "Svůj věk měříš oběhy Saturnu, a přesto požaduješ od Slunce každoroční gratulaci. I kosmos má dodržovat závazky.",
        "K narozeninám si přeješ další rozměr vesmíru. Do těch stávajících se ti už nevejde plán na příští rok.",
      ],
    ],
  },
  s: [
    ["Schvalovací kola pro jednu pauzu", "7"],
    ["Radost bez uvedení důvodu", "2 %"],
    ["Schody počítané jako kariérní postup", "96 %"],
    ["Připomínky k vlastním připomínkám", "14"],
    ["Cíle na jeden splněný cíl", "3"],
    ["Povolené improvizace za rok", "1"],
  ],
  d: [
    "Dnes můžeš nechat jednu věc jen tak být. Není potřeba zakládat komisi, která vybere kterou.",
    "Dnes máš povoleno mít radost z maličkosti. I když se nevejde do přehledu úspěchů.",
    "Dnes si zkus odškrtnout „nic“. Uvidíš, jakou práci dá neudělat z toho další úkol.",
    "Dnes si dej pauzu bez časovače. Stále se počítá, i když ji nebudeš moct doložit.",
    "Dnes má tvůj seznam úkolů delší seznam přání než ty.",
    "Dnes můžeš pochvalu přijmout bez otázky, jestli obsahuje i návrhy na zlepšení.",
    "Dnes obdivuj výhled bez hledání vyššího bodu. Vrchol nemusíš hned překonat.",
    "Dnes si všimni, že i eskalátor umí zařídit postup vzhůru bez tvého vedení.",
    "Dnes máš nárok jen tak sedět. Židle za tebou nepřijde s dotazem, co tím sleduješ.",
    "Dnes otevři okno a nech to bez strategického názvu. Čerstvý vzduch je taky dostatečný výsledek.",
    "Dnes nech čaj chvíli louhovat. Nemusíš mu mezitím přidělovat další odpovědnost.",
    "Dnes si zkus napsat přání bez termínu. Papír se s tím nějak vyrovná.",
    "Dnes máš všechno pod kontrolou. Aspoň podle oddělení, které vedeš a samo sebe hodnotí.",
    "Dnes si můžeš pustit písničku jen proto, že tě těší. Nemusí rozvíjet žádnou z tvých schopností.",
    "Dnes zkus projít kolem schodiště bez úvahy, jestli se dá ten postup urychlit.",
    "Dnes nemusíš být napřed. I hodiny, které předbíhají, se nakonec musí seřídit.",
    "Dnes má tvůj vnitřní hlas k radosti jen jednu poznámku: co z toho bude za rok?",
    "Dnes můžeš nechat koláč vychladnout. Nemusíš mu připomínat, že v teplém stavu dosahuje lepších výsledků.",
    "Dnes ti k procházce stačí cesta. Přínosy a výstupy si nech na cestu do kanceláře.",
    "Dnes zkus ocenit květinu za květ. Připomínky k dlouhodobému růstu si nech v šuplíku.",
    "Dnes můžeš říct „to je hezké“ a skončit tečkou. Slovo „ale“ si poradí i bez tebe.",
    "Dnes si nemusíš zasloužit západ slunce. Svítí i bez pravidelného hlášení tvých výsledků.",
    "Dnes si zkus vybrat něco podle chuti. Vítězný návrh nemusí obhajovat komise.",
    "Dnes máš volno od dokazování, že umíš využít každou volnou chvíli. Ano, i tuhle.",
  ],
  q: [
    "Tam, kde mají tři stálá jídla. Na večeři hledám jistotu, dobrodružství si můžeme objednat v podobě jiné přílohy.",
    "Pojďme na výlet. Vrchol vyberu já, zbytek bude spontánní. Pokud dodržíme trasu.",
    "Napíšu „ozvu se za chvíli“. Pak se ozvu přesně za chvíli. Někdo musí téhle větě vrátit význam.",
    "Umyju to. Ale ten hrnek, co se celou dobu tváří jako dekorace, mi tentokrát neunikne.",
    "Vyberme hory. Odpočineme si a zároveň se konečně někam viditelně posuneme.",
    "Pusťme něco, kde se na konci všechno vyřeší. Otevřené konce už mám ve složce k dořešení.",
  ],
};

export default kozoroh;
