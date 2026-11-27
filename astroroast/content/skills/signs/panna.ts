// AstroRoast.ai: knihovna humoru, znamení panna. Varianta "skills" (Sonnet 5.5 s psacími skilly).
//
// Tvar (RawSign, viz content/types.ts). Index 0 = úroveň 1 u všeho, co je Five<...>:
//   h  headlines: 3 na úroveň
//   c  core lines: 2 na úroveň
//   v  verdikty: 2 na úroveň
//   t  témata po úrovních: 4 věty na téma a úroveň (schodiště 1 pohlazení … 5 kosmická poprava)
//   s  falešné statistiky znamení: 6 kusů
//   d  denní jednovětky: 24 kusů
//   q  odpovědi v páru: 6 kusů
//
// Pravidla autora: 2. osoba jednotného čísla, žádné rodově označené tvary o čtenáři (-l/-la),
// střílíme jen do stereotypu znamení, úroveň 5 je absurdní a kosmická, nikdy krutá.

import type { RawSign } from "../../types";

const panna: RawSign = {
  h: [
    [
      "Panna ví, kde co je. U cizích věcí to ví taky, ale diskrétně.",
      "Panna má v tašce kapesníky, náplast i nabíječku. Pro všechny, kdo to zapomněli.",
      "Máš dar pořádku. I vesmír by ti rád svěřil klíče od svého skladu a štítkovač.",
    ],
    [
      "Panna má v seznamu úkolů bod „udělat seznam“. Je splněný. Má podbody.",
      "Tvůj kalendář má barevný klíč. Čtyři barvy znáš ty, pátá je pro případ, že se něco změní.",
      "Perfekcionismus u tebe není vada. Je to metodika s přílohami a verzováním.",
    ],
    [
      "Panna nechodí pozdě. Chodí o osm minut dřív a pak čeká, až přijdou ostatní s omluvou.",
      "Tvůj stůl je tak úhledný, že se k němu kolegové bojí přiblížit s hrnkem.",
      "Seznam úkolů má bod „zkontrolovat seznam úkolů“. Odškrtnout ho nejde, pořád roste.",
    ],
    [
      "Perfekcionismus je tvoje druhé jméno. První je „ještě to jen trochu doladím“.",
      "Tvoje zpětná vazba má číslované body a poděkování na konci. To poděkování děsí nejvíc.",
      "Panna nikoho nekritizuje. Jen mírně upravuje svět, dokud nemá správné okraje.",
    ],
    [
      "Vesmír byl vrácen autorovi k přepracování. Hlavní připomínka: chybí rejstřík.",
      "Hvězdy se bojí poslat ti zprávu s překlepem. Proto od velkého třesku nepošlou nic.",
      "Vesmír zkusil zavést chaos. Chaos byl zalaminován, očíslován a založen pod „Různé“.",
    ],
  ],
  c: [
    [
      "Věci dotahuješ do konce a nedáš na sobě znát, že to je výkon. Tvoje spolehlivost je vzácná jako mapa, která sedí s terénem.",
      "Žádný detail ti neunikne, a proto se kolem tebe všechno lepí na své místo. Včetně lidí, kteří o to nežádali.",
    ],
    [
      "Když něco spravíš, hned se ptáš, co by šlo vylepšit. Končíš až ve chvíli, kdy ti někdo přestane odpovídat.",
      "Když věci nesedí, cuká ti oko. Když sedí, cuká druhé, protože už se něco určitě chystá.",
    ],
    [
      "Perfekcionismus tě chrání před chybami. Bohužel i před odesláním.",
      "Řekneš „je to jen drobnost“ a pak o ní tři hodiny mluvíš, s tabulkou.",
    ],
    [
      "Chybu najdeš i v dokonalé věci. Pak se zdvořile omluvíš a pokračuješ v hledání.",
      "Tvoje „jen jedna drobnost“ obvykle znamená, že se bude přepisovat celý dokument, včetně titulní strany.",
    ],
    [
      "Vesmír vznikl bez korektury. Panna to dodnes tvrdí a má seznam chyb s odkazy na čísla stran.",
      "Černé díry si předem vyplňují formuláře a nechávají je ve složce „k vaší kontrole“. Prý je to zdvořilejší.",
    ],
  ],
  v: [
    [
      "Verdikt: tvoje pečlivost je dar. Jen občas odlož lupu a podívej se na celý obraz.",
      "Hvězdy radí: dopřej si dvě minuty bez seznamu. Klidně s dobrou tužkou, ale bez poznámek.",
    ],
    [
      "Rada hvězd: nech jednu věc nedokonalou. Malou, nenápadnou. Třeba tu, kterou nikdo neuvidí.",
      "Verdikt: spolehlivost jako švýcarské hodinky. Jen s o něco hlasitějším tikáním.",
    ],
    [
      "Verdikt: svět je lepší, když ho udržuješ v pořádku. A ještě lepší, když z toho nevedeš deník.",
      "Rada: příště neopravuj cizí text nahlas. Opravuj ho potichu a aspoň jednou ho nech být.",
    ],
    [
      "Verdikt: perfekce tě baví. Ostatní se bojí, že jim budeš něco opravovat. Mají pravdu.",
      "Rada hvězd: hotovo je lepší než dokonalé. Zkus to jednou, na malé věci, s dozorem.",
    ],
    [
      "Verdikt vesmíru: pořádek uznán, perfekcionismus založen pod číslem 1 003. Odvolání abecedně.",
      "Rozsudek: povinná jedna chyba denně. Dobrovolná, ale pod dohledem a s razítkem.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Pamatuješ si, co má partner rád: čaj, značku ponožek i den, kdy se vám poprvé stalo něco směšného. Je to dojemné a dobře archivované.",
        "Pozornost k detailům je tvoje řeč lásky: partner nikdy nezmokne, protože v kabátu najde deštník.",
        "Staráš se tak jemně, že si toho partner všimne až ve chvíli, kdy mu něco chybí. A ty už to držíš v ruce.",
        "Tvoje romantika se pozná podle toho, že snídaně je teplá, ubrus rovný a svíčka hoří přesně uprostřed stolu.",
      ],
      [ // úroveň 2
        "Překvapení pro partnera plánuješ tak důkladně, že má časový plán, přílohy a záložní variantu pro déšť.",
        "Partnerovi občas při hádce opravíš větu. Z lásky, aby ji příště řekl stylisticky čistě.",
        "Při společném balení kufru tě partner sleduje s obdivem. Bez tebe by zabalil dva svetry a hotovo.",
        "Společné bydlení má jedno pravidlo: hrnky stojí uchem doprava. Partner se ho učí s úctou a s malým strachem.",
      ],
      [ // úroveň 3
        "Řekneš „nic se neděje“ a pak partnerovi přehraješ jeho minulý čtvrtek ve třech bodech s přílohami.",
        "Rande plánuješ jako audit. Partner dostane rozpis, trasu a otázku, jestli má nějaké připomínky.",
        "Tvoje „jen ti to říkám, ať víš“ funguje jako revize dokumentu: sedm bodů k opravě a jedno poděkování.",
        "Partnerovu lásku poznáš podle toho, jak složí ručníky. Složí-li je špatně, zachováš klid a mlčíš. Ručník to ví.",
      ],
      [ // úroveň 4
        "Na rande přijdeš o osm minut dřív, protože stůl, světlo i vzdálenost židlí je třeba zkontrolovat. Partner přijde na zkoušku.",
        "Partnerovi chyby nevytýkáš. Vedeš o nich jen čistý, přehledný a průběžně aktualizovaný soubor.",
        "Hádka s tebou probíhá takto: bod 1, bod 2, bod 3, příloha. V příloze je snímek obrazovky z roku 2022.",
        "Vyznání lásky máš promyšlené: tři verze, jedna záložní a jedna pro případ, že se partner zeptá na zdůvodnění.",
      ],
      [ // úroveň 5
        "Merkur s Venuší zkusily rande. Panna jim doručila kritiku na třech stranách A4 a rozešly se kvůli písmu.",
        "NASA žádá o radu, jak uspořádat vztahy mezi planetami. Odpověď Panny má 47 stran a opravuje názvy planet.",
        "Kupidův šíp byl vrácen k přepracování. Důvod: neodpovídá specifikaci a chybí mu záruční list.",
        "Vesmírná manželská poradna tě odmítla. Prý u tebe není co řešit, jen opravovat zápisy z minulých sezení.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci se na tebe spoléhají. Co řekneš, platí. Co uděláš, je hotové a ještě pěkně popsané.",
        "Máš nadání pro systém: tvoje složky si rozumí a úkoly samy vědí, kdy se mají splnit.",
        "Kolegové za tebou chodí s chaosem a odcházejí s plánem. Dar, který se dá jen pochválit.",
        "Tvoje e-maily jsou jasné, stručné a bez překlepů. Čtenář po nich ví, co má dělat, a trochu se stydí za ty své.",
      ],
      [ // úroveň 2
        "Na poradě máš body sepsané dřív, než přijde první kolega. Pořadí je pro tebe svaté, odbočky jsou hosté bez rezervace.",
        "Klávesové zkratky ovládáš tak rychle, že kolegové mají pocit, že počítač pracuje sám a ty se jen díváš.",
        "Barevné štítky na složkách mají svůj klíč. Kolegové se k němu snaží dopracovat, ale zatím se zastavili u modré.",
        "Kolegové se tě ptají na pomoc s dokumentem. Ty ho už stejně opravuješ, jen se ptáš, jestli to opravdu musí být takhle.",
      ],
      [ // úroveň 3
        "Při kontrole dokumentu hledáš chybu jako detektiv. A když ji nenajdeš, hledáš chybu v detektivovi.",
        "Řekneš „jen jedna drobnost“ a dokument pak projde třetím kolem revizí.",
        "Termín splníš s předstihem. Pak odevzdáš o den později, protože se našla tečka navíc.",
        "Delegovat umíš. Hlavně úkoly, které pak za ostatní předěláš, aby byly správně.",
      ],
      [ // úroveň 4
        "Tvoje oblíbená pochvala je „tohle je skoro v pořádku“. V týmu to platí za Nobelovu cenu.",
        "V týmu jsi jako kontrolní seznam s pulsem: když ho nikdo nepotřebuje, hlásí se sám.",
        "Tvoje „ještě to musím doladit“ pozná celá kancelář podle toho, jak všem klesnou ramena.",
        "Když ti někdo pošle dokument v nevhodném písmu, neřekneš nic. Jen se ti zvedne obočí a uloží se do paměti.",
      ],
      [ // úroveň 5
        "Saturn žádal o prodloužení termínu. Panna ho zamítla s poznámkou: „Prstence nejsou zarovnané.“",
        "Porada vesmíru začala včas. Skončila, až Panna opravila zápis z minulé schůzky, z předminulé a z té před ní.",
        "Vesmír byl vrácen k přepracování. Zásadní připomínky: mlhoviny, hustota hvězd a chybějící legenda.",
        "Panna prošla Mléčnou dráhu s červenou pastelkou. NASA žádala o kopii. Vráceno s poznámkou, že 80 % je „nejasné“.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Tvůj život je jako dobře vyžehlená košile: čistý, svěží a ostatním se vedle něj chce narovnat ramena.",
        "Umíš vnést klid do chaosu. Stačí se objevit v místnosti a pár věcí se samo srovná.",
        "Den začínáš plánem a končíš odškrtnutým seznamem. Je to uspokojivé sledovat, i zvenčí.",
        "Zbytečný nepořádek ti vadí, ale unesou ho tvoje nervy, když je jen na chvíli. Do chvíle, než se otočíš.",
      ],
      [ // úroveň 2
        "Kávu pijete u tebe ve dvanáct, ve tři a v pět. Odchylky se hlásí jako mimořádná událost.",
        "Na dovolenou si bereš seznam, který má vlastní kontrolní seznam. Ten druhý hlídá, jestli první není zapomenutý doma.",
        "Lednici máš uspořádanou podle logiky, kterou zná jen ona a ty. Návštěva si bere vodu a je to správně.",
        "Zásuvka na příbory je dokonalá. Když ji někdo otevře, ztichne a mimoděk narovná záda.",
      ],
      [ // úroveň 3
        "Spontánnost máš naplánovanou na čtvrtek od 18:00. Pokud se nedostaví, přeplánuješ ji na pátek.",
        "Říkáš, že pořádek tě netrápí. Pak v hostech vzbudíš pocit, že mají špinavé boty, i když jsou v ponožkách.",
        "Odpočinek máš v kalendáři a hlídá ho budík. Když zazvoní, jdeš odpočívat. Rychle, než se něco pokazí.",
        "Sebereflexe ti jde skvěle: chybu najdeš i u sebe. Jen ji pak chceš opravit hned a nahlas.",
      ],
      [ // úroveň 4
        "Tvůj život má víc seznamů než zážitků. Seznam zážitků je ovšem vzorně uspořádaný.",
        "Když ti někdo řekne „uvolni se“, vyrobíš plán uvolnění. S časem, cílem a mírou nedokonalosti.",
        "Tvoje představa dobrodružství: koupit lepší pořadač. Odvážné, stylové, a ještě se vejde do batohu.",
        "Nad nezarovnaným rohem ubrusu strávíš víc času než nad celým víkendem na horách. Ubrus vyhrává.",
      ],
      [ // úroveň 5
        "Vesmír začal chaosem. Panna zakázala jeho rozpínání, dokud nedoloží, že jsou označené zóny.",
        "Černá díra vyhodila do prostoru svůj nepořádek. Panna ho vytřídila do tří barev a poslala zpět doporučeně.",
        "Kvůli tobě zavedli v Mléčné dráze povinné zarovnání hvězd. Orionův pás odmítl a přesunul se do vedlejší soustavy.",
        "Slunce svítí v rozporu s plánem. Panna mu poslala e-mail s upozorněním na chybějící odrážku a tři tečky navíc.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přátelům jsi oporou: pamatuješ narozeniny, oblíbené jídlo i to, kdo nesnáší koriandr. Chodící poznámkový blok s láskou.",
        "Když kamarád potřebuje poradit, máš po ruce strukturu: tři možnosti, výhody, nevýhody. A kávu.",
        "Parta s tebou nikdy nezabloudí. Máš mapu, náhradní trasu a nabíječku pro všechny.",
        "Přátelé ti občas řeknou „já to zvládnu“. Ty to s nimi zvládneš taky, jen s plánem a s předstihem.",
      ],
      [ // úroveň 2
        "Ve skupinovém chatu opravíš překlep. Pak se omluvíš. Pak opravíš omluvu.",
        "Při výletě se ujmeš organizace. Ostatní to oceňují, dokud nezjistí, že mají k obědu přidělenou hodinu.",
        "Když se parta rozhoduje, kam jít, máš už tři varianty s hodnocením. Zbytek skupiny chce hlavně sednout.",
        "Do kalendáře přátel si píšeš připomínky. Z lásky. Jen jim ještě nikdo neřekl, že kalendář je sdílený.",
      ],
      [ // úroveň 3
        "Kamarádům říkáš pravdu vždycky. Hlavně o jejich plánech, životopisech, písmu a skladbě batohu.",
        "Při stěhování se ujmeš krabic. Pak štítků. Pak rozdělení pokojů. Stěhováci jdou domů.",
        "Tvoje „jen dobře míním“ je velké razítko. Vejde se pod něj cokoli, od poznámky o ponožkách po kritiku kariéry.",
        "Pozvánku na oslavu potvrdíš ihned. Pak se zeptáš na dress code, parkování, program a seznam hostů.",
      ],
      [ // úroveň 4
        "Kamarádi ti říkají Wikipedie, protože vždycky víš. A protože ti chybí tlačítko „přeskočit“.",
        "Na srazu přátel jsi jako revizor: nic neřekneš, ale všichni se najednou narovnají a sundají lokty ze stolu.",
        "Kamarád ti ukáže novou věc, kterou si koupil. Ty najdeš pět vad dřív, než stihne říct, jak ho to těší.",
        "Když se přátelé dohadují o místě, rozhoduješ ty. Ne proto, že chceš, ale protože máš tabulku a oni už nemají sílu.",
      ],
      [ // úroveň 5
        "Kamarádi ti poslali pozvánku na večeři. Vrátila se ti ve 14 verzích. Večeře se kvůli opravám odložila o rok.",
        "Při kosmickém pikniku se Orion zeptal, kde sedět. Odpověď: podle schématu, které čeká na schválení do příštího roku.",
        "Přátelé tě pozvou do Andromedy. Galaxie je předem upozorněna na pořadí příborů a pro jistotu se uklidí.",
        "Skupinový chat Mléčné dráhy má čtyři miliardy členů. Panna opravuje překlepy od prvního dne. Zbývá jí pár světelných let.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny plánuješ s láskou: dort bez chyb, hosté usazení, dárky podle seznamu přání. Radost mají všichni.",
        "Na narozeniny kamarádů myslíš s předstihem. Připomínka v kalendáři, nápad na dárek a záložní nápad pro jistotu.",
        "Dárek od tebe je praktický, hezky zabalený a s lístečkem, jak ho používat. Dojemné a bez návodu by to nešlo.",
        "Oslava u tebe má program, který zná každý host. Je to bezpečné, příjemné a všichni se přitom skvěle baví.",
      ],
      [ // úroveň 2
        "Narozeninový dort kontroluješ jako inspektor: rovnoměrné řezy, stejně velké kousky, žádná křivá svíčka.",
        "Pozvánky na oslavu rozešleš měsíc předem. Včetně času příchodu, času odchodu a odkazu na mapu.",
        "Při balení dárku srovnáváš papír na milimetr. Příjemce rozbaluje opatrně, jako by otevíral pamětní předmět.",
        "Svíčky na dortu zapaluješ v pořadí. Fotky půjdou do složky podle data, jmen a nálady hostů.",
      ],
      [ // úroveň 3
        "V přání, které dostaneš, najdeš nejdřív překlep. Až potom dojetí. Dojetí je skoro vždycky druhé.",
        "Říkáš, že oslavu nepotřebuješ. Pak víš, kdo přijde, co sní a kde bude sedět.",
        "Dárek, který ti není po chuti, přijmeš s úsměvem a uložíš do složky „příležitosti“. Ta složka už má pět let.",
        "Na narozeninové překvapení reaguješ tak, že se zeptáš, kdo to plánoval, a nabídneš zpětnou vazbu.",
      ],
      [ // úroveň 4
        "Oslava u tebe má scénář, plán B a záložní plán B. Hosté jsou skvěle připraveni na překvapení.",
        "Dárek opatříš štítkem s datem, jménem a hmotností. Příjemce zjistí, že dostal dar s číslem šarže.",
        "Svíčku sfoukneš až po kontrole, jestli je rozmístění na dortu rovnoměrné. Hosté mezitím čekají s telefony.",
        "Narozeninové přání píšeš čtyřikrát a pak pošleš to první. Ale s opravenou čárkou.",
      ],
      [ // úroveň 5
        "Narozeniny vesmíru se konají jednou za 13,8 miliardy let. Panna žádá o změnu data. Pozvánka byla vrácena pro nesprávné zarovnání.",
        "Merkur chystal oslavu. Panna přinesla harmonogram, pozvánku, vizitku a čtyři svíčky v pořadí. Merkur zrušil narozeniny.",
        "Mléčná dráha slaví narozeniny ohňostrojem. Panna sbírá zbytky. Ohňostroj byl dodatečně uznán jako „skoro v pořádku“.",
        "Kosmický dort byl rozdělen na deset miliard stejných dílů. Každý host ho dostane, až se vyřeší pořadí v abecedě.",
      ],
    ],
  },
  s: [
    ["Seznamů úkolů", "37"],
    ["Barevných záložek", "114"],
    ["Štítků na jedné polici", "86"],
    ["Cizích překlepů opraveno dnes", "5"],
    ["Pravděpodobnost, že je to „jen drobnost“", "0 %"],
    ["Spontánních rozhodnutí letos", "1 (naplánované)"],
  ],
  d: [
    "Dnes najdeš chybu, kterou nikdo jiný nevidí. Nahlásíš ji. Hvězdy to vítají a pár kolegů ne.",
    "Dnes se ti povede všechno podle plánu. Bude tě to znervózňovat.",
    "Dnešní konstelace: stůl v dokonalém pořádku, mysl ve čtyřech tabulkách.",
    "Dnes ti někdo pošle e-mail s překlepem. Rozhodneš se nevšímat si. Vydržíš čtyři minuty.",
    "Merkur ti dnes radí: zavři tabulku. Aspoň na dobu oběda.",
    "Dnes ti někdo řekne, že je to dostatečně dobré. Počítej s časem na zotavení.",
    "Dnes budeš mít volný čas a nebudeš vědět, co s ním. Hvězdy doporučují sepsat plán, jak ho trávit.",
    "Dnes narazíš na kolegu, který nepoužívá styly. Vesmír se zachvěje a ty taky.",
    "Dnešní tip: zavři oči a nech v pokoji dvacet vteřin nepořádek. Dýchej.",
    "Dnes nestihneš všechno. Hvězdy ti to odpustí. Ty si to nějakou dobu odpouštět nebudeš.",
    "Dnes se změní plán. Hvězdy ti dávají půl hodiny na vstřebání a jeden nový seznam.",
    "Dnes uvaříš dokonalou kávu. Hvězdy to zapsaly do archivu a zalaminovaly.",
    "Dnes zjistíš, že složka „Různé“ obsahuje dvanáct podsložek. Hvězdy tě nesoudí, jen tiše povzdechnou.",
    "Dnes ti někdo řekne „tak nějak“. Zachováš klid, ale oko už cuká.",
    "Dnes si přerovnáš ikony v telefonu. Hvězdy tvrdí, že to není odkládání, ale revize.",
    "Dnes vypiješ kávu ještě horkou. Hvězdy to oslavují jako malý zázrak.",
    "Dnes uvidíš cizí odrážku odsazenou o milimetr. Nic neřekneš. Ale hvězdy slyší, jak ti uvnitř hučí hlava.",
    "Dnes se k tobě někdo posadí a zeptá se: „Můžu rovnou?“ Odpovíš úsměvem s poznámkou pod čarou.",
    "Dnes ti dojde, že víš o dvaceti drobnostech, kterých si nikdo nevšiml. Zapíšeš je. Pro jistotu.",
    "Dnes zkusíš improvizovat. Vydržíš dvě minuty, pak vytáhneš seznam.",
    "Dnes zjistíš, že někdo použil tvůj hrnek. Hvězdy doporučují klid a čistou houbičku.",
    "Dnes se ukáže, že chyba v dokumentu nebyla tvoje. Dvě hodiny se budeš cítit podivně svobodně.",
    "Dnes ti někdo pošle fotku uklizeného stolu. Jsou na ní tři věci mimo zarovnání. Budeš hodnotit do večera.",
    "Dnes při výběru ponožek pochopíš, že pořadí v zásuvce je vlastně životní filozofie. Hvězdy to odmítají komentovat.",
  ],
  q: [
    "Mám tabulku restaurací s hodnocením. Vychází podnik s rezervací na 19:00. Je 18:57.",
    "Víkend je rozplánovaný po hodinách. Včetně rezervy na spontánnost v neděli od 15:00 do 15:20.",
    "Odpověď je hotová a čtyřikrát přečtená. Odešlu ji v 19:46, protože tak působím uvážlivě.",
    "Umyju to. Nejdřív ti ale vysvětlím správný postup: sklenice vlevo, hrnky vzadu, houbička podle barvy.",
    "Mám itinerář, rezervace, náhradní plán a nabíječku pro oba. Stačí si sbalit batoh.",
    "Něco dokumentárního, ať se můžeme poučit. A pak napíšu poznámky, ať si to pamatujeme.",
  ],
};

export default panna;
