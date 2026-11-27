// AstroRoast.ai: původní české texty varianty Codex pro znamení Střelce.
// RawSign: h 3, c 2 a v 2 na každé z pěti úrovní (index 0 = úroveň 1).
// t: vztahy, prace, zivot, pratele, narozeniny; každé téma má 5 úrovní po přesně 4 větách.
// s: 6 falešných statistik [label, value]. d: 24 denních vět bez skutečných předpovědí.
// q: 6 párových odpovědí v pořadí COUPLE_SITUATIONS z codex/shared.ts.
// Ostrost: pohlazení → šťouchnutí → sarkasmus → přímá nadsázka → kosmická absurdita.
// Terčem jsou výhradně stereotypy znamení; oslovení je rodově neutrální.

import type { RawSign } from "../../types";

const strelec: RawSign = {
  h: [
    [
      "Umíš z obyčejné procházky udělat malou premiéru světa.",
      "Vidíš možnosti i tam, kde ostatní vidí jen konečnou.",
      "Máš tolik nadšení, že i mapa se s tebou těší ven.",
    ],
    [
      "Na chvíli vyrazíš ven. Pro jistotu si bereš pas.",
      "S upřímností neotálíš. S dodatkem „to znělo jinak“ taky ne.",
      "Ke každému plánu přidáš odbočku. A odbočce další odbočku.",
    ],
    [
      "Závazky bereš vážně. Proto se k nim raději nepřibližuješ.",
      "Věříš, že všechno má řešení. Detaily přenecháváš lidem na místě.",
      "Říkáš věci na rovinu. Ohledy zřejmě jedou oklikou.",
    ],
    [
      "I cestu s odpadky podáváš jako expedici, ze které se nedá nic slíbit.",
      "Svou upřímností zkazíš překvapení ještě před jeho vymyšlením.",
      "Naslibuješ hory doly. Pak pošleš ostatním mapu, ať si pro ně dojdou.",
    ],
    [
      "Utíkáš před závazky tak rychle, že jim vesmír přiděluje vlastní komety.",
      "Žádáš o delší vesmír. Ten současný prý nenabízí dost odboček.",
      "Vysvětluješ černé díře, že tě jen omezuje v rozletu.",
    ],
  ],
  c: [
    [
      "Umíš připomenout, že za zatáčkou může být něco pěkného. Třeba další zatáčka.",
      "Zvědavostí zvedneš náladu celé výpravě. I když výprava míří jen pro pečivo.",
    ],
    [
      "Začínáš větou „mám nápad“ a končíš otázkou, jestli má každý pevné boty.",
      "Na otázku „máš chvilku?“ odpovídáš výkladem o tom, jak je čas relativní.",
    ],
    [
      "Slibuješ jen to, co je možné. Za možné považuješ všechno, dokud se nezeptáme kdy.",
      "Pleteš si upřímnost s povinností odvysílat každou myšlenku. Veřejnost děkuje za nepřetržitý provoz.",
    ],
    [
      "Na každou zodpovědnost lepíš ceduli „nuda“ a tváříš se, že tím přestává existovat.",
      "Tvoje „to nějak dáme“ je plán s jedinou přílohou: seznamem lidí, kteří to mají dát za tebe.",
    ],
    [
      "Předbíháš vlastní sliby o tři galaxie. Mezihvězdná pošta je teď vede jako zásilky bez doručovací adresy.",
      "Svým „všechno je možné“ nutíš fyzikální zákony každé ráno podepisovat formulář, že jsou pouze doporučení.",
    ],
  ],
  v: [
    [
      "Máš talent rozsvítit možnosti. Jen občas rozsviť i nad mapou.",
      "Umíš přidat světu barvy. I šedé úterý má s tebou výletní verzi.",
    ],
    [
      "Na cestu životem máš nadšení i svačinu. Cíl se prý koupí cestou.",
      "Umíš nadchnout každého. Teď ještě přibal čas návratu.",
    ],
    [
      "Držíš slovo. Bohužel jen „možná“.",
      "Máš jasno v tom, že se uvidí. Na tom trváš naprosto pevně.",
    ],
    [
      "Se svými sliby zacházíš jako s letáky: rozdáš je všem a úklid necháš ostatním.",
      "Vydáváš útěk od povinností za objevnou cestu. I koš na prádlo chce cestopis.",
    ],
    [
      "Na konci vesmíru reklamuješ ceduli „konec“. Chceš mluvit s někým, kdo má větší pravomoci.",
      "Vesmíru vracíš nekonečno. Na prodloužený víkend prý sotva stačí.",
    ],
  ],
  t: {
    vztahy: [
      [
        "Umíš ze společné cesty pro rohlíky udělat malé rande. Pekárna má najednou kouzlo neznámé země.",
        "Dáváš ve vztahu prostor vlastnímu světu toho druhého. A hned tě zajímá, co tam roste.",
        "Nosíš do lásky chuť zkoušet nové věci. I domácí večeři zvládneš zahájit slavnostním „tak kam dnes?“",
        "Dokážeš odlehčit první rande jedním vtipem. Otázku na oblíbenou horu si schováváš až jako druhou.",
      ],
      [
        "Za romantiku považuješ i společné bloudění. Máš pro něj něžný název: poznávání okolí.",
        "Na otázku „kam to spolu směřuje?“ vytáhneš mapu. Roztomilé, ale tentokrát jde o jiný směr.",
        "Chceš ve vztahu svobodu. Hlavně při rozhodování, která z těch tří stezek je vlastně ta kratší.",
        "Při výběru místa na rande kontroluješ jídelní lístek i vzdálenost k nejbližšímu nádraží.",
      ],
      [
        "Budoucnost vztahu vidíš růžově. Zvlášť tu část, ve které se ještě nevybírá společná skříň.",
        "Na vážnou otázku odpovídáš „žijme přítomností“. Je působivé, jak tím získáš další týden.",
        "Ve vztahu nabízíš úplnou otevřenost. S výjimkou kalendáře, který se nehodí předčasně uzavírat.",
        "Když přijde řeč na společné bydlení, zajímáš se o okolí. Zejména o výpadovky.",
      ],
      [
        "Chceš lásku bez hranic, protože přes každou hranici se ti lépe vyhýbá otázce „co bude dál?“",
        "Ze vztahu děláš zájezd s překvapením. Překvapení je, jestli se příště vůbec přihlásíš.",
        "Při debatě o závazku vytahuješ tolik filozofie, že i výběr společného ručníku končí obhajobou svobodné vůle.",
        "Slibuješ společnou cestu životem, ale chováš se, jako by druhá osoba měla jen přidržet kufr.",
      ],
      [
        "Při slově „napořád“ přepínáš na jinou galaxii. Venuši teď dlužíš vysvětlení i přeposílací adresu.",
        "Na společnou budoucnost žádáš výjimku z času. Vesmírný úřad ti místo razítka podává kalendář.",
        "Necháváš si ve vztahu tolik prostoru, že se mezi dvě vaše schůzky vejde vznik nové sluneční soustavy.",
        "Chceš romantiku bez gravitace. Saturn ti k výročí posílá prstenec a ty se ptáš na podmínky vrácení.",
      ],
    ],
    prace: [
      [
        "Umíš dodat odvahu i nápadu, který zatím nemá název. Pracovní název „to dáme“ mu docela sluší.",
        "Na poradě připomeneš, že existuje víc cest. Občas je to přesně ta poznámka, která otevře okno.",
        "Dokážeš ostatní nadchnout pro nový úkol. I složka s podklady s tebou působí jako začátek výpravy.",
        "Vidíš příležitost tam, kde zatím stojí otazník. A umíš mu nakreslit docela hezký výhled.",
      ],
      [
        "K úkolu přistupuješ s nadhledem. Zadání z té výšky vypadá trochu drobně.",
        "Když se ptáš na možnost práce odkudkoli, slovo „odkudkoli“ si podtrhneš dvakrát.",
        "Na poradě nabídneš nový směr. Teď ještě počkej, než ostatní dopíšou název toho původního.",
        "Říkáš „to máme za chvilku“. Optimismus už máš připravený, teď otevři i přílohu.",
      ],
      [
        "Představuješ velkolepou vizi. Dokončený úkol by vedle ní působil skoro přízemně.",
        "Termín vnímáš jako orientační bod. Orientuješ se podle něj hlavně na to, kdy začít vysvětlovat.",
        "Každý problém řešíš novým nápadem. Starý problém oceňuje, že teď má společnost.",
        "Na dotaz „jak to pokračuje?“ odpovídáš směrem, kterým by se to jednou mohlo ubírat. Děkujeme za zeměpis.",
      ],
      [
        "Rozdáváš velké vize jako konfety. Kolegové pak z podlahy sbírají jednotlivé termíny.",
        "Místo hotového úkolu přineseš přednášku o potenciálu. I prázdná složka má s tebou tiskovou konferenci.",
        "Slibuješ nemožné a provedení svěříš ostatním. Vlastní přínos označuješ jako „dodávání energie“.",
        "Z pěti minut porady uděláš cestopis. Jediná neprozkoumaná oblast zůstává stav tvého úkolu.",
      ],
      [
        "Slíbíš dokončení před velkým třeskem. Úřad pro časové paradoxy ti vrací výkaz s poznámkou „opět jen vize“.",
        "Přesuneš termín za horizont událostí. Černá díra ti ho obratem vrací: i ona má nějakou kapacitu.",
        "Na poradě rozpínáš zadání rychleji než vesmír. Galaxie si kvůli tvému dodatku „ještě drobnost“ berou dovolenou.",
        "Mezigalaktické komisi předkládáš plán bez jediného kroku. Nechávají tě slavnostně přestřihnout pásku u prázdna.",
      ],
    ],
    zivot: [
      [
        "Máš radost z objevování. I jiná ulička cestou domů ti umí udělat malý svátek.",
        "Umíš si všimnout otevřených dveří. Občas se za nimi schovává jen komora, ale tušíš správně, že je co zkoumat.",
        "Bereš změnu jako pozvánku. A svět s tebou díky tomu působí o trochu přístupněji.",
        "Dokážeš hledat hezkou stránku i v objížďce. Aspoň si rozšíříš sbírku oblíbených zatáček.",
      ],
      [
        "Jdeš pro jednu věc a cestou objevíš tři nové zájmy. Ta jedna věc si zatím počká na další výpravu.",
        "Vybereš si přímou cestu. Pak ji obohatíš o tolik zastávek, že dostane vlastní jízdní řád.",
        "Doma odpočíváš prohlížením map. V podstatě sedíš, takže podmínku klidu splňuješ.",
        "I k návodu přistupuješ svobodně. Nejprve zjistíš, jestli by se výrobek nedal použít zajímavěji.",
      ],
      [
        "Dlouhodobý plán máš: nechceš se omezovat dlouhodobým plánem. Konzistence se počítá.",
        "Měníš směr pokaždé, když narazíš na rutinu. Tvůj osobní rozvoj má elegantní tvar kruhu.",
        "Domácí povinnosti bereš s filozofickým odstupem. Z nádobí už nejde poznat, kterou školu zastáváš.",
        "Ke všemu přistupuješ jako k příležitosti něco se naučit. Kromě situací, které se ti opakují každý týden.",
      ],
      [
        "Z každého úkolu uděláš otázku po smyslu života. Kvůli tvému koši na prádlo už zasedá filozofický kongres.",
        "Máš čtyřicet životních směrů a žádný nevede k vybalení tašky. Ta mezitím získává status kulturní památky.",
        "Svobodu si pleteš s tím, že každá tvoje rozdělaná věc automaticky připadne nejbližšímu okolí.",
        "Tváříš se, že žiješ mimo zajeté koleje. Přitom jen pravidelně objíždíš stejnou povinnost.",
      ],
      [
        "Na otázku po smyslu života rozjedeš takový výklad, že vesmír mezitím zavře a uklízečka ti vysává pod židlí.",
        "Vyrazíš hledat vlastní podstatu. Galaktický navigační úřad tě žádá, ať se aspoň jeden konec hledání přestane pohybovat.",
        "Prohlásíš rutinu za nesvobodu. Teď musí Země každý oběh kolem Slunce vydávat za zcela nový zážitek.",
        "I nekonečno označíš za příliš předvídatelné. Matematika ti musí vymýšlet vedlejší vchody.",
      ],
    ],
    pratele: [
      [
        "Umíš partě připomenout, že za známým rohem je další ulice. A že se tam dá jít i bez velké přípravy.",
        "Nadchneš se pro nápady přátel tak rychle, že i nesmělý návrh dostane vlastní fanfáru.",
        "Dokážeš z obyčejného posezení vytáhnout historku, kterou si budete připomínat ještě v úterý.",
        "Zajímá tě, co přátelé objevují. I zprávu o nové pekárně přijmeš s nadšením hodným expedice.",
      ],
      [
        "Na sraz přineseš svačinu a návrh změnit místo. Svačina je jediná část, kterou všichni čekají.",
        "Posíláš partě tip na lehkou procházku. Převýšení se ti zdá jako zbytečně technický detail.",
        "Když přátelé chtějí radu, nabídneš nový úhel pohledu. Někdy je z něj vidět hlavně nejbližší nádraží.",
        "Vyprávíš historku s takovou chutí, že si před pointou stihnete prohlédnout i celé okolí děje.",
      ],
      [
        "Na společný plán kývneš bez váhání. Je příjemné, že kontrolou kalendáře nekazíš okamžik.",
        "Přátelům říkáš přesně, co si myslíš. Na to, jestli se ptají, máš překvapivě volný názor.",
        "Při organizaci výletu zastáváš důležitou roli: ujišťuješ lidi, kteří všechno řeší, že to bude skvělé.",
        "Odpovídáš partě „určitě někdy“. Pěkné, jak v jedné zprávě spojuješ jistotu s naprostou neurčitostí.",
      ],
      [
        "Pod heslem „jen malá procházka“ taháš partu přes tři okresy. Tvoje kilometry by měly mít vlastní reklamační oddělení.",
        "Z každé cizí historky uděláš přestupní stanici na tu svoji. V debatě provozuješ čistě vnitrostátní dopravu.",
        "Vydáváš nevyžádané rady za dar upřímnosti. Přátelé už hledají účtenku, aby ti ten dar mohli vrátit.",
        "Na společném výletě držíš hlavně morálku. Batohy, trasu a rezervace drží někdo jiný, protože ty přece přinášíš nadhled.",
      ],
      [
        "Slibuješ partě krátký výlet. Po třetí galaxii rozdáváš dotazník, jestli se má přidat ještě jeden Saturn.",
        "Na skupinový sraz kývneš ve všech časových osách. Multivesmír teď svolává poradu o tom, kde tě vlastně rezervovat.",
        "Vydáváš nevyžádané pravdy rychleji než pulzar signály. Přátelé si na tebe objednávají orbitální tlumič komentářů.",
        "Kamarádskou výpomoc přislíbíš celé Mléčné dráze. Při stěhování první planety se zrovna věnuješ širším souvislostem.",
      ],
    ],
    narozeniny: [
      [
        "Umíš oslavit další rok jako otevření nové trasy. Dort je v tomhle itineráři moc příjemná zastávka.",
        "Nejvíc tě potěší dárek, se kterým se dá něco zažít. I obyčejný drak tak má šanci na velkou premiéru.",
        "Přeješ si další rok plný objevů. A umíš do toho počítat i novou příchuť dortu.",
        "Na oslavě dokážeš nadchnout hosty pro společný nápad. Pro začátek třeba pro druhý kousek.",
      ],
      [
        "Na narozeninový seznam přání napíšeš „překvapte mě“. A nenápadně přiložíš mapu.",
        "Chceš jen malou oslavu. Počtem hostů ano, vzdáleností od domova už tolik ne.",
        "Při rozbalování dárku nejdřív zjišťuješ, jestli se s tím dá někam vyrazit. U puzzle to chce trochu fantazie.",
        "Ke každému narozeninovému přání připojíš „a hlavně zážitky“. Svíčky už tuší, že se povezou.",
      ],
      [
        "Věk bereš jako pouhé číslo. S časem začátku oslavy nakládáš stejně důsledně.",
        "Letos chceš hlavně něco nečekaného. Přesnou adresu oslavy tak hosté nepotřebují znát ani letos.",
        "Přeješ si rok bez omezení. Zejména bez té nepříjemné části mezi nápadem a jeho uskutečněním.",
        "Na oslavě vysvětluješ, že cíl není důležitý, podstatná je cesta. Dort se tím ovšem nedoručí.",
      ],
      [
        "Na narozeniny chceš spontánní výpravu, kterou ti má někdo tři měsíce pečlivě organizovat. Svoboda musí mít servis.",
        "Oslavu plánuješ tak neurčitě, že hostům nestačí pozvánka. Potřebují pátrací mapu a večer bez dalších závazků.",
        "Dostaneš společný zážitek a hned navrhneš lepší místo, jiný termín a novou trasu. I balicí papír chce odejít.",
        "Z narozeninové řeči uděláš přednášku o svobodě. Hostům zbývá jediná: nenápadně si dojít pro dort.",
      ],
      [
        "Pozveš hosty na malou oslavu u Jupitera. Sluneční soustava kvůli tvému „je to kousek“ zakládá úřad pro měření kousků.",
        "Přeješ si zážitek, který ještě nikdo nemá. Galaxie ti balí neobjevenou planetu a ty reklamuješ chybějící výlety do okolí.",
        "Sfoukneš hvězdné svíčky a přeješ si víc možností. Vesmír ti nad dortem otevírá další rozměr a prosí tě o konečné zadání.",
        "Trváš na oslavě bez hranic. Mezihvězdná správa ti kvůli dortu bourá okraj vesmíru a ty se ptáš, co je za ním.",
      ],
    ],
  },
  s: [
    ["Odboček na přímé trase", "14"],
    ["Podíl „to nějak vyjde“ v plánu", "98 %"],
    ["Myšlenek s povolením ke zveřejnění", "1 z 8"],
    ["Výletů rozjetých při plánování výletu", "6"],
    ["Minut do první životní filozofie", "2"],
    ["Návodů dočtených před začátkem", "0"],
  ],
  d: [
    "Dnes máš pro rutinu cestovatelský tip: zkus k ní přijít z jiné strany chodby.",
    "Dneska si dej malý cíl. Třeba nepřidat mu cestou tři vedlejší cíle.",
    "Dnes si do plánu napiš „nechat se překvapit“. Aspoň jedna položka tak odpovídá skutečnému postupu.",
    "Dneska máš volné pole působnosti. Nemusíš hned hledat, co je za plotem.",
    "Dnes si před „to zvládneme“ přečti i zadání. Nadšení snese chvilku bez dozoru.",
    "Dneska zkus odpovědět na „kdy?“ bez použití slov „někdy“ a „uvidíme“. Pěkný výlet mimo vlastní slovník.",
    "Dnes počítej odbočky místo kroků. Konečně měření, ve kterém vynikne tvoje trasa pro pečivo.",
    "Dneska smíš mít poslední slovo. Zkus „platí“ a dovol mu nějakou dobu platit.",
    "Dnes máš i doma neprobádané území: poslední stránku návodu.",
    "Dneska nech optimismus pracovat v praxi. Přidej k němu jeden konkrétní čas.",
    "Dnes si dej výpravu k rozdělanému úkolu. Cíl je blízko, místní zvyklosti zatím neznáš.",
    "Dneska si u „řeknu ti to upřímně“ můžeš vyzkoušet, jak působivé umí být pokračování až po otázce.",
    "Dnes nemusíš hledat širší souvislosti. Úplně stačí hledat druhou botu před odchodem.",
    "Dneska máš vnitřní kompas nastavený na „a co tamhle?“. Mapu kvůli tomu zatím nepřekresluj.",
    "Dnes si dej odbočku od odboček. Přímá cesta je pro tebe koneckonců nový zážitek.",
    "Dneska se zkus nadchnout pro dokončení. Začátky už mají tvou podporu celkem jistou.",
    "Dnes můžeš cestovat i prstem po mapě. Jen u toho neodsouvej hrnek do sousedního státu.",
    "Dneska u „na minutku“ nastav minutku. Filozofii času si nech na dobu po zazvonění.",
    "Dnes má tvoje „proč ne?“ k dispozici i kolegu „jak přesně?“. Zkus je konečně seznámit.",
    "Dneska si připiš do itineráře návrat. Pěkně tím překvapíš vlastní kalendář.",
    "Dnes se můžeš těšit z obyčejné zastávky. Nemusíš k ní vymýšlet navazující expedici.",
    "Dneska ber upřímnost jako pohlednici. Není potřeba posílat úplně každou, kterou máš.",
    "Dnes dej svému velkému plánu malý začátek. Jeden splněný bod je víc než sedm vykřičníků.",
    "Dneska můžeš zůstat chvíli na místě. I mapa si zaslouží odpoledne bez přesčasů.",
  ],
  q: [
    "Zkusme něco, co ani jeden neumíme vyslovit. Ukážeme na totéž a budeme tomu říkat společná vize.",
    "Pojďme se někam ztratit. Ty vezmeš mapu, já nadšení; u první odbočky zjistíme, co má větší vliv.",
    "Napišme „určitě dorazíme“. Já dodám nadšení, ty datum, ať ta zpráva obsahuje i nějaký údaj.",
    "Já myju, ty utíráš. A na cestu od dřezu ke skříňce mi prosím nedovol plánovat zastávky.",
    "Co někam bez plánu? Ty si tajně stáhneš mapu, já budu nahlas obdivovat, jak nám všechno náhodou vychází.",
    "Pusťme cestopis. Ty vybereš díl, já budu tvrdit, že tam musíme, a gauč nás oba udrží při zemi.",
  ],
};

export default strelec;
