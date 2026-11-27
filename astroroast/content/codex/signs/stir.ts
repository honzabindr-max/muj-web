// AstroRoast.ai: původní české texty varianty Codex pro znamení Štíra.
// Tvar RawSign; index 0 = úroveň 1, index 4 = úroveň 5.
// h: 3 titulky na úroveň; c: 2 hlavní věty na úroveň; v: 2 verdikty na úroveň.
// t: 5 témat, v každém 5 úrovní a přesně 4 věty na úroveň (celkem 100).
// s: 6 dvojic [popisek, hodnota]; d: 24 denních vět bez předpovědí událostí.
// q: 6 párových odpovědí v pořadí COUPLE_SITUATIONS ze shared.ts.
// Stupňování: pohlazení → šťouchnutí → sarkasmus → ostrá nadsázka → kosmická absurdita.
// Humor míří výhradně na stereotyp znamení; oslovení neprozrazuje rod čtenáře.

import type { RawSign } from "../../types";

const stir: RawSign = {
  h: [
    [
      "Věnuješ pozornost i maličkostem. Žádná čárka u tebe není navíc.",
      "Důvěru bereš vážně. I obyčejný slib u tebe dostane pevnou vazbu.",
      "Umíš jít do hloubky. Jen si občas nech místo i na brouzdání.",
    ],
    [
      "I tečka ve zprávě má u tebe motiv.",
      "Na otázku „jak se máš?“ si necháváš právo nevypovídat.",
      "Čteš mezi řádky i v nákupním seznamu.",
    ],
    [
      "Dáváš lidem druhou šanci. První zůstává ve spise.",
      "Své „nic“ vysvětluješ ve třech neveřejných přílohách.",
      "Důvěřuješ bez výhrad. Výhrady vedeš zvlášť.",
    ],
    [
      "Z jedné tečky ve zprávě postavíš vyšetřovací seriál o osmi řadách.",
      "Obyčejné „aha“ u tebe potřebuje stavební povolení na všechen ten podtext.",
      "Své mlčení dávkuješ, jako by za něj byly televizní ceny.",
    ],
    [
      "Kvůli tvému „hm“ musí Pluto zřídit ministerstvo nevyslovených připomínek.",
      "Čteš mezi souhvězdími. Galaxie už píšou bez mezer.",
      "Velký třesk u tebe pořád čeká na vysvětlení tónu.",
    ],
  ],
  c: [
    [
      "Umíš opravdu naslouchat. U tebe se i věta na okraj cítí jako hlavní téma.",
      "Co ti dává smysl, tomu věnuješ celou pozornost. Polovičaté nadšení zkrátka nemáš v nabídce.",
    ],
    [
      "Tvá zvědavost má slušné vychování. Nejdřív řekneš „jen se ptám“, pak přijde sedm doplňujících otázek.",
      "O sobě prozrazuješ drobnosti postupně. Zatím máme potvrzené znamení a používání češtiny.",
    ],
    [
      "Přijímáš věci tak, jak jsou. Potom prověříš, proč se tak tváří.",
      "Odpouštíš a zapomínáš. Druhá část má u tebe zjevně dobrovolnou účast.",
    ],
    [
      "Z každého nedorozumění uděláš trilogii. I překlep u tebe dostane vlastní minulost a pochybnou motivaci.",
      "Tvé „nechme to být“ je slavnostní otevření muzea, ve kterém budeš tu věc vystavovat dalších dvacet let.",
    ],
    [
      "Ptáš se černé díry, co tím tichem naznačuje. Pro jistotu si k sobě předvoláš i prostor mezi galaxiemi.",
      "Kvůli tvé potřebě jít do hloubky už vesmír přidává druhé dno. První ti připadá podezřele snadno dostupné.",
    ],
  ],
  v: [
    [
      "Máš cit pro hloubku. Občas si užij i hezkou věc bez poznámek pod čarou.",
      "Tvé pozornosti nic neunikne. Ani malá radost si nemusí brát pořadové číslo.",
    ],
    [
      "Zkus někdy přijmout „dobře“ bez doplňující otázky. Může to být celý obsah sdělení.",
      "Tvé soukromí má kouzlo. Nemusíš ale utajovat i oblíbenou přílohu.",
    ],
    [
      "Necháváš minulost za sebou. Evidentně v přívěsném vozíku.",
      "Komunikuješ jasně. Překladový slovník je bohužel pouze pro tvou potřebu.",
    ],
    [
      "Zkus někdy zavřít případ dřív, než mu pořídíš slavnostní znělku.",
      "Děláš z komára detektivku a pak vyslýcháš titulky za to, že se rozcházejí s knihou.",
    ],
    [
      "Vrať vesmíru jednu záhadu. Už ti kvůli dalším otázkám docházejí rozměry.",
      "Tvému mlčení přiděluje vesmír vlastní souhvězdí. I tam si necháváš poslední hvězdu pro sebe.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1: pohlazení
        "Pamatuješ si drobnosti, které dělají radost. I oblíbený čaj má u tebe hlavní roli.",
        "Umíš dát společnému večeru hloubku. A občas k ní úplně stačí deka a dobrá otázka.",
        "Když ti na někom záleží, věnuješ pozornost i větě „jen tak mimochodem“. Hezké věci u tebe nepropadnou.",
        "Důvěru buduješ poctivě. Má u tebe pevné základy a malinko tajemný vchod.",
      ],
      [ // úroveň 2: šťouchnutí
        "Na rande se ptáš na oblíbený film. Doplňující otázkou nenápadně zjišťuješ celou životní filozofii.",
        "Na zprávu „dobrou noc“ chceš odpovědět hezky. Nejdřív ale zvažuješ význam chybějícího srdíčka.",
        "Necháváš si něco pro sebe. Třeba pocity, plány a odpověď na otázku, co si dáš k večeři.",
        "Překvapení máš v oblibě. Nejlépe s malou nápovědou a úplným vysvětlením v příloze.",
      ],
      [ // úroveň 3: sarkasmus
        "Ctíš otevřenou komunikaci. Otevřeš téma, zbytek si má druhá strana domyslet.",
        "Nepotřebuješ ujišťování. Stačí ti jedno, které přesně odpoví na všech čtrnáct nevyřčených otázek.",
        "Žádáš jen upřímnost. Když ji dostaneš, pro jistotu si vyžádáš ještě upřímnost o té upřímnosti.",
        "Na větu „to nic neznamená“ přikyvuješ. Právě tím získává hlavní význam.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Z romantického večera uděláš tiskovou konferenci. Svíčky máš jen proto, aby nikdo nemohl utéct do tmy bez otázky.",
        "Když řekneš „promluvme si“, i gauč si začne shánět alibi.",
        "Slovo „jo“ rozebereš tak důkladně, že na konci potřebuje dovolenou i jeho druhé písmeno.",
        "Svému „je mi to jedno“ přidáš takový podtext, že se vám do obýváku nevejde stůl.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Z jedné nezodpovězené zprávy zřídíš meziplanetární komisi. Merkur musí vysvětlit, proč je poslem a nic nedoručuje.",
        "Na rande si vyžádáš mapu vnitřního vesmíru. Pak reklamuješ galaxii, která nemá vyznačený citový vchod.",
        "Mezi vámi to jiskří. Ty ale předvoláváš Slunce, protože chceš znát původ každého fotonu.",
        "K větě „mám tě moc“ žádáš kosmickou měrnou jednotku. Nekonečno ti zní jako vyhýbavá odpověď.",
      ],
    ],
    prace: [
      [ // úroveň 1: pohlazení
        "Dovedeš se ponořit do úkolu a najít podstatu. I poznámka pod čarou se dočká pozornosti.",
        "Držíš slovo i směr. Pracovní plán u tebe není jen hezká dekorace na pondělí.",
        "Ptáš se přesně a nasloucháš pozorně. Díky tobě dostane i drobný nápad šanci vyrůst.",
        "Umíš pracovat v klidu. Výsledek pak mluví za tebe, což se tvému soukromí docela hodí.",
      ],
      [ // úroveň 2: šťouchnutí
        "Na poradě si zapisuješ i to, co nezazní. Zápis máš stručný, poznámky méně.",
        "Ke složce „veřejné“ přistupuješ obezřetně. Tak velkorysý název si přece žádá otázky.",
        "Zadání čteš dvakrát. Potřetí už hledáš, co tím vším asi chce říct věta „hezký den“.",
        "Když se tě někdo zeptá, na čem pracuješ, prozradíš obor. S podrobnostmi zatím počkáš.",
      ],
      [ // úroveň 3: sarkasmus
        "Vítáš zpětnou vazbu. Přesné znění si uchováváš pro případ, že by nadšení časem polevilo.",
        "Pracuješ se všemi dostupnými informacemi. Kromě těch svých, ty dostupné nejsou.",
        "Nezpochybňuješ rozhodnutí. Jen chceš znát původ, motivaci a důvod použití slova „prostě“.",
        "Úkol označíš jako uzavřený. Debata o tom, kdo tehdy co řekl, samozřejmě pokračuje.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Z připomínky k tabulce uděláš firemní ságu. Buňka B7 už chce vlastní šatnu a smlouvu na další řadu.",
        "Tvůj zápis z porady má víc podezřelých než úkolů. Kávovar žádá, ať ho do toho netaháš.",
        "Tak dlouho hledáš skrytý záměr zadání, až musí obyčejný nadpis přijít s advokátem.",
        "I prázdný dokument u tebe prochází výslechem. Tolik bílého místa? To nemůže být náhoda.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Prověřuješ pracovní záměr Slunce. „Prostě svítím“ ti bez tří příloh a razítka z Merkuru nestačí.",
        "Kvůli tvému utajení projektu obíhá porada černou díru. Pozvánku posíláš až za horizont událostí.",
        "Zakládáš na Měsíci oddělení pro čtení mezi řádky. První úkol: vysvětlit podezřelé mezery mezi hvězdami.",
        "Dáváš vesmíru připomínku k rozložení galaxií. Nápravu chceš do pátku, odůvodnění ještě před vznikem času.",
      ],
    ],
    zivot: [
      [ // úroveň 1: pohlazení
        "Umíš se nadchnout do hloubky. I nový koníček u tebe dostane vlastní záložku a trochu slavnostní atmosféry.",
        "Dáváš přednost opravdovým věcem. Hezký den u tebe nemusí být hlasitý, aby stál za to.",
        "Umíš si chránit chvíle pro sebe. Tvůj klid má zkrátka vlastní zvonek.",
        "Všímáš si souvislostí. Obyčejná procházka díky tobě získá pár hezkých odboček.",
      ],
      [ // úroveň 2: šťouchnutí
        "Z návodu k poličce čteš hlavně mezi řádky. Šroubek C se podle tebe chová podezřele.",
        "Volný den si necháváš pro sebe. Pro jistotu o něm neví ani tvůj kalendář.",
        "Když aplikace nabízí „přeskočit podrobnosti“, přidáš si ji na seznam věcí k prozkoumání.",
        "I k ceduli „tudy“ máš doplňující otázku: proč nás tak moc chtějí právě tudy?",
      ],
      [ // úroveň 3: sarkasmus
        "Bereš život s nadhledem. Detailní rozbor všeho pod ním tím ovšem nerušíš.",
        "O náhody se neopíráš. Tolik pečlivě načasovaných shod si přece zaslouží pozornost.",
        "Soukromí máš vyřešené. Na otázku „co nového?“ už ani neprozrazuješ, jestli něco je.",
        "Pouštíš věci z hlavy. Do pečlivě pojmenovaných složek, aby se ti dobře hledaly.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Dokážeš rozebrat obyčejnou neděli tak důkladně, že pondělí odmítá převzít směnu bez právní pomoci.",
        "Při hledání hlubšího smyslu vykopáváš i dlažbu. Cedule „čerstvě položeno“ je pro tebe další stopa.",
        "Soukromí si střežíš tak důsledně, že i tvůj deník čerpá informace z nepotvrzených zdrojů.",
        "V každé maličkosti hledáš druhé dno. I prázdnou krabici kvůli tobě přepadá tvůrčí krize.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Hledáš smysl vesmíru tak důkladně, že ti galaxie posílají životopisy a vysvětlení svých mezer v historii.",
        "Utajuješ své plány i před časoprostorem. Budoucnost k tobě proto chodí jen s předběžným souhlasem.",
        "Na otázku, co je za černou dírou, odpovídáš: „A kdo se ptá?“ Hvězdárny kvůli tobě zavádějí ověření totožnosti.",
        "Pochybuješ o Velkém třesku. Tak náhlý začátek bez předchozí domluvy ti připadá jako jasné krytí hlubší zápletky.",
      ],
    ],
    pratele: [
      [ // úroveň 1: pohlazení
        "Umíš podržet přátelství i bez velkých proslovů. Někdy ti stačí zpráva a dobře zvolená sušenka.",
        "Když ti někdo něco svěří, držíš to pro sebe. Ani tvoje vlastní ozvěna od tebe nedostane podrobnosti.",
        "Vybíráš si blízkost, která má hloubku. U společného stolu pak nepotřebuješ jmenovky.",
        "Pamatuješ si, na čem přátelům záleží. I drobnou radost dokážeš doručit na správné místo.",
      ],
      [ // úroveň 2: šťouchnutí
        "Do společné skupiny pošleš „zajímavé“. Pak necháš kamarády hádat, jestli je to pochvala, nebo začátek tématu.",
        "Kamarádské „musíme se vidět“ bereš vážně. Vlastně už máš připravenou i otázku, co přesně znamená „musíme“.",
        "Přátelům nasloucháš pozorně. I vedlejší postava z jejich vyprávění u tebe dostane složku.",
        "Na společném výletě objevíš nejlepší zkratku. Kde ji bereš, zůstává součástí tvé osobní záhady.",
      ],
      [ // úroveň 3: sarkasmus
        "Necháváš přátele žít po svém. Vysvětlení jednotlivých kroků si vyžádáš při příštím setkání.",
        "Na společné fotce se označit necháš. Souřadnice svého rozpoložení dál nesdílíš.",
        "V partě nepotřebuješ poslední slovo. Stačí ti takové „hm“, po kterém už nikdo žádné další nenajde.",
        "Dáváš přátelům prostor. Způsob, jakým ho využívají, zatím jen nezávazně vyhodnocuješ.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Pamatuješ si každou drobnost tak dokonale, že u tebe parta schvaluje historky před zveřejněním už i v přítomném čase.",
        "Když do skupiny napíšeš „tak nic“, společná konverzace si najme vyjednávací tým.",
        "Z obyčejného „nemůžu v sobotu“ upleteš zápletku, za kterou by se nestyděla ani knihovna detektivek.",
        "Na společnou hru přineseš takovou intenzitu, že se i figurky z Člověče, nezlob se dožadují změny názvu.",
      ],
      [ // úroveň 5: kosmická absurdita
        "Do blízkého kruhu pustíš i Saturn. Prstence ale musí nechat v šatně, dokud nevysvětlí ty další okruhy známých.",
        "Zakládáš mezihvězdnou skupinu přátel. Polárka má pozvánku podmíněnou vysvětlením, proč se pořád drží stranou.",
        "Z obyčejného setkání uděláš galaktický summit. Mléčná dráha kvůli tobě předkládá seznam všech svých kontaktů.",
        "Své tajemství svěříš černé díře. Pak ji necháš podepsat, že ho nepustí ani do paralelního vesmíru.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1: pohlazení
        "Na oslavě oceníš osobní přání. Když má vlastní myšlenku, ani nemusí mít třpytky.",
        "Umíš si užít oslavu v dobré společnosti. I malý dort pak dostane velkou chvíli.",
        "Dárku si všímáš i kvůli tomu, co o vás dvou říká. Mašle má u tebe vedlejší, ale hezkou roli.",
        "Narozeninové přání si necháváš pro sebe. I radost přece může mít malou soukromou přihrádku.",
      ],
      [ // úroveň 2: šťouchnutí
        "U překvapení tipuješ obsah ještě před rozbalením. Mašle ti připadá jako dost výmluvná nápověda.",
        "Na otázku, co si přeješ, odpovíš „nic zvláštního“. Tím seznam možností zúžíš přesně o nic.",
        "Přání „ať se ti všechno splní“ čteš pozorně. Tak velké slovo přece chce drobné upřesnění.",
        "Před sfouknutím svíček chvíli mlčíš. Dopřáváš přání trochu slavnostního utajení.",
      ],
      [ // úroveň 3: sarkasmus
        "Nečekáš, že si všichni vzpomenou. Přesný přehled o tom, kdo si vzpomíná, vedeš zcela nezávisle.",
        "Dárky nesoudíš podle obalu. Posuzuješ ho samostatně, jako další výpověď o záměru.",
        "Na vlastní oslavu nekladeš žádné podmínky. Jen velmi konkrétní představu, kterou nikomu neřekneš.",
        "U přání „zůstaň tak, jak jsi“ zvažuješ, které části přesně si zaslouží takovou ochranu.",
      ],
      [ // úroveň 4: ostrá nadsázka
        "Rozbalíš dárek tak důkladně, že i lepicí páska musí vysvětlit své vazby na mašli.",
        "Své přání střežíš tak dramaticky, že i svíčky musí po sfouknutí podepsat mlčenlivost.",
        "Na oslavě vyhodnocuješ načasování přání tak pečlivě, že konfety padají v obavách z procesní chyby.",
        "Z věty „hlavně si to užij“ uděláš téma večera. Proč hlavně? A co se děje v těch vedlejších částech?",
      ],
      [ // úroveň 5: kosmická absurdita
        "Sfoukáváš svíčky a Slunce ti posílá dotaz, jestli se má taky ztlumit. Odpověď dáváš do režimu přísně tajné.",
        "Přeješ si něco tak tajného, že padající hvězda musí před vyslechnutím složit meziplanetární zkoušku mlčenlivosti.",
        "Zkoumáš původ dárku až k Velkému třesku. Balicí papír mezitím žádá o azyl v sousední galaxii.",
        "Na oslavu pozveš vesmír a pátráš, kdo prozrazuje tvé přání. Mléčná dráha kvůli tobě podezírá vlastní ozvěnu.",
      ],
    ],
  },
  s: [
    ["Otázek po větě „jen se ptám“", "17"],
    ["Podtextů v jedné tečce", "38"],
    ["Veřejná část tvých plánů", "2 %"],
    ["Povolení k otázce „co nového?“", "3"],
    ["Druhá dna běžné krabice", "8"],
    ["Záhad vyřešených slovem „náhoda“", "0 z 9"],
  ],
  d: [
    "Dnes máš pro každou tečku doplňující otázku. Interpunkce u tebe nemá lehkou směnu.",
    "Dnes čteš mezi řádky tak pozorně, že ti samotná písmena připadají jako zbytečná kamufláž.",
    "Dnes si dopřáváš klid. Jeho přesné umístění znáš pouze ty.",
    "Dnes má tvé „hm“ vlastní podkapitoly. Obsah poskytuješ výhradně na vyžádání.",
    "Dnes můžeš vzít větu doslova. Zkus ten dobrodružný pocit, že slova znamenají právě to, co říkají.",
    "Dnes věnuješ maličkostem velkou pozornost. I zapomenutá čárka u tebe dostává prostor k vyjádření.",
    "Dnes tvé soukromí chrání i to, co nevíš. Pro jistotu o tom nemluvíš.",
    "Dnes máš intenzitu nastavenou naplno. I výběr přílohy u tebe dostává závěrečné titulky.",
    "Dnes si necháváš něco pro sebe. Vesmír za dostatečnou nápovědu považuje už slovo „něco“.",
    "Dnes máš při hledání souvislostí takový záběr, že podezíráš i tlačítko „zpět“ ze skrytého záměru.",
    "Dnes dokážeš naslouchat tak pozorně, že i věta na okraj dostává pohodlné místo uprostřed.",
    "Dnes nemusíš každé záhadě dávat pokračování. I krabice s nápisem „krabice“ může mít svou pravdu.",
    "Dnes své plány necháváš dozrát v soukromí. Kalendáři sděluješ jen to, že má být připravený.",
    "Dnes umíš ocenit drobné gesto. I obyčejné „myslím na tebe“ má u tebe čestné místo.",
    "Dnes pouštíš nepodstatné věci dál. Jen jim ještě vystavuješ předávací protokol.",
    "Dnes v sobě držíš tolik podtextu, že si i závorky žádají přestávku.",
    "Dnes si můžeš užít něco hezkého bez pátrání po důvodu. Radost nepotřebuje průkaz původu.",
    "Dnes jdeš ve všem do hloubky. I mělký talíř u tebe přehodnocuje své možnosti.",
    "Dnes máš na tajemství čas. Na vysvětlování, proč je tajemství tajemstvím, už méně.",
    "Dnes tvé „v pohodě“ obsahuje tolik významů, že potřebuje vlastní rejstřík.",
    "Dnes věnuješ plnou pozornost tomu, na čem záleží. Jen mezi to možná nepočítej délku jedné mezery.",
    "Dnes kladeš otázky s takovým citem pro detail, že i otazník žádá o zpřesnění zadání.",
    "Dnes chráníš tajemství jako poklad. Nákupní seznam ale klidně nech na lednici.",
    "Dnes můžeš nechat jednu věc bez výkladu. Vesmír ti za tak odvážný pokus nepíše ani poznámku pod čarou.",
  ],
  q: [
    "Za mě někam s dobrým jídlem a trochou soukromí. Když jídelní lístek říká „tajemství šéfa“, mám doplňující otázky.",
    "Navrhuju výlet bez dalších lidí. Přesný plán prozradím cestou, ať máme tajemství i společný program.",
    "Nejdřív si ujasněme tón té zprávy. Odpověď zvládnu jednou větou, rozbor té tečky zabere zbytek večera.",
    "Vezmu si nádobí. Jen mě zajímá, jak se hrnek dostává vedle prázdné myčky. Čistě kvůli pochopení příběhu.",
    "Někam, kde nás nikdo nezná. A kde se název „Tajemná zátoka“ dá ověřit i jinak než fotkou lehátka.",
    "Za mě detektivku. Společně hledáme vysvětlení a já zpochybňuju i to, proč je úvodní znělka tak veselá.",
  ],
};

export default stir;
