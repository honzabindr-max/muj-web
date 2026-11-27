// AstroRoast.ai: původní české texty modelu Codex pro Blížence.
//
// Tvar (RawSign, viz content/types.ts). Index 0 = úroveň 1 u všeho, co je Five<...>:
//   h  Five<string[]>   headlines: 3 na úroveň
//   c  Five<string[]>   core lines (výchozí věta o znamení): 2 na úroveň
//   v  Five<string[]>   verdikty: 2 na úroveň
//   t  Record<Topic, Five<string[]>>
//                       témata PO ÚROVNÍCH: pro každé téma (vztahy, prace, zivot, pratele, narozeniny)
//                       pět úrovní, přesně 4 věty v každé. Engine vybere 2 z t[téma][úroveň-1].
//   s  [label, value][] falešné statistiky znamení: 6 kusů
//   d  string[]         denní jednovětky: přesně 24 kusů, vždy o dnešku, bez předpovědí událostí
//   q  string[]         odpovědi v páru, pořadí viz COUPLE_SITUATIONS v shared.ts: 6 kusů
//
// Pravidla autora:
// - Žádné šablony se skloňováním: každá věta je hotová (nebo předsklonovaná), takže engine jen vybírá a skládá.
// - Věty roastu jsou ve 2. osobě jednotného čísla; q jsou přímé repliky do párového dialogu.
//   O čtenáři píšeme bez rodově označených tvarů (-l/-la), aby text seděl komukoli.
// - Střílíme do stereotypu znamení, nikdy do těla, zdraví, peněz, vyznání, orientace, smrti ani skutečných osob.
// - Úroveň 5 je absurdní a kosmická, nikdy krutá.
//
// Skladba roastu (viz engine/roast.ts):
//   headline = h[úroveň]
//   lines    = c[úroveň] + 2x t[téma][úroveň] + kicker (shared.ts, podle tématu a úrovně; u kamaráda FRIEND_KICKERS)
//   stats    = 1 generická podle tématu + 1-2 ze s
//   verdict  = v[úroveň]
//
// Stupně: 1 pohlazení, 2 šťouchnutí, 3 sarkasmus, 4 přímý výsměch stereotypu, 5 kosmická absurdita.
// Limity: titulky 90 znaků, věty 160, verdikty 120, denní věty 140.

import type { RawSign } from "../../types";

const blizenci: RawSign = {
  h: [
    [
      "Umíš rozmluvit i výtah. A ještě ti poděkuje za příjemnou cestu.",
      "S tebou má i obyčejné ahoj zajímavé pokračování.",
      "Máš dar spojovat lidi. Občas i ty, kteří se jen ptají na cestu.",
    ],
    [
      "Říkáš „jen stručně“. Roztomilý název pro seriál.",
      "Máš tolik zájmů, že i tvé koníčky žádají o pořadník.",
      "Změníš názor a ten předchozí ještě mává z předsíně.",
    ],
    [
      "Držíš slovo. Jen pokaždé jiné.",
      "Zvládáš obě strany debaty. Výsledek tedy překáží především tobě.",
      "Tvé „to je poslední odbočka“ má překvapivě mnoho pokračování.",
    ],
    [
      "Rozjedeš tolik témat, že se tvé pointy hledají přes rozhlas.",
      "Tvůj pevný názor se při průvanu skládá do tašky.",
      "Tvé „jen k věci“ potřebuje mapu, přestup a tři omluvenky.",
    ],
    [
      "Mluvíš tak dlouho, že má tvá věta vlastní dobu oběhu.",
      "Přesvědčíš černou díru, ať svítí. Na konci věty už prosazuješ tmu.",
      "Měníš téma tak rychle, že ti vesmír vydává zpáteční jízdenky v časových smyčkách.",
    ],
  ],
  c: [
    [
      "Umíš najít zajímavost i v čekání na zelenou. S tebou je to malý poznávací zájezd.",
      "Ptáš se tak dobře, že se lidé rozpovídají. Jen občas potřebuješ pro další otázku semafor.",
    ],
    [
      "Ke každému vyprávění přidáš malou odbočku. Pak v ní zabydlíš celé odpoledne.",
      "Zkusíš nový koníček s velkým nadšením. Tvůj včerejší koníček ti zatím drží místo.",
    ],
    [
      "Na jednoduchou otázku odpovíš ze všech úhlů. Ten s odpovědí si necháváš na neurčito.",
      "Ve tvém podání má každý názor platnost do vydání dalšího názoru. Obvykle tři věty.",
    ],
    [
      "Otevřeš téma, odbočíš a necháš ostatní uprostřed věty. Takhle vznikají kruhové objezdy bez výjezdu.",
      "Tvé argumenty mají otočné dveře. Jedním dechem vítáš názor i jeho pravý opak a ještě jim věšíš kabáty.",
    ],
    [
      "Zahltíš mezihvězdný úřad tolika dodatky, že ti přidělí vlastní galaxii. Obratem se ptáš, jestli není i v jiné barvě.",
      "Svým „mimochodem“ rozštěpíš časoprostor. V každém novém vesmíru vysvětluješ, že k pointě už opravdu míříš.",
    ],
  ],
  v: [
    [
      "S tebou má nuda krátkou pracovní dobu.",
      "Umíš udělat z maličkosti příběh. Klidně si ho dopřej i s tečkou.",
    ],
    [
      "Ke tvému „mimochodem“ by se hodila malá mapa.",
      "Máš skvělý postřeh. Teď zkus postřehnout i konec vlastní věty.",
    ],
    [
      "Máš jasno. V tuto konkrétní vteřinu.",
      "K věci se dostaneš. Jakmile se dohodneš, ke které.",
    ],
    [
      "Tvá stručnost potřebuje vlastní obsah a záložky.",
      "Máš poslední slovo tak často, že to první stále čeká na závěr.",
    ],
    [
      "Konec tvé věty hledá vesmírný dalekohled. Zatím posíláš jen další souřadnice.",
      "Na tvé „ještě něco“ si Saturn rezervuje další prstenec.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Umíš rozesmát i obyčejnou cestu na nákup. U regálu s těstovinami už máte vlastní slovník.",
        "Na schůzku nosíš dobrou náladu a otázky, na které se nedá odpovědět jen kývnutím.",
        "Všímáš si drobných zajímavostí a dělíš se o ně. Z procházky máš výlet i bez batohu.",
        "Ve dvou umíš vytvářet malé společné vtipy. Někdy potřebuješ sešitek, aby se všechny vešly.",
      ],
      [ // úroveň 2
        "Napíšeš „myslím na tebe“ a přidáš zajímavost o mostech. Romantiku máš zkrátka s naučnou stezkou.",
        "Při výběru filmu nabídneš tolik možností, že si mezitím můžete pustit pokračování večera.",
        "Vymyslíš překvapení ve dvou variantách. Třetí tě napadne cestou pro tu první.",
        "Chceš si povídat před spaním. Jen ještě řešíš, jestli má vesmír okraj a kdo ho uklízí.",
      ],
      [ // úroveň 3
        "Při větě „musíme si promluvit“ vidíš příležitost doplnit včerejší odbočku. Pěkné pořadí priorit.",
        "Ve vztahu si potrpíš na otevřenost. Zejména u otázek, které už měly být uzavřené.",
        "Na otázku „platí to?“ nabídneš tři výklady slovesa platit. Domluva tím získá akademickou úroveň.",
        "Na romantickou zprávu odpovíš pohotově. Na její jedinou otázku někdy v příštím vydání.",
      ],
      [ // úroveň 4
        "Na „kam to spolu směřujeme?“ odpovíš takovou odbočkou, že i navigace požaduje vztahovou pauzu.",
        "Z obyčejného „ano“ uděláš seriál plný zvratů. Protějšek chce domluvit večeři, ty obsazuješ druhou řadu.",
        "Při domlouvání schůzky přepisuješ plán tak často, že pozvánku už můžete rovnou prodávat jako křížovku.",
        "Z párového rozhovoru uděláš panelovou debatu, obsadíš všechny židle a pak se divíš, že druhá strana mlčí.",
      ],
      [ // úroveň 5
        "Na schůzce otevřeš tolik témat, že Venuše zavádí řízení letového provozu mezi předkrmem a dezertem.",
        "Vztahové „my dva“ rozvedeš do tolika variant, že mezihvězdná matrika vyžaduje přílohu o velikosti Jupiteru.",
        "Při romantické procházce odbočíš z tématu do jiné galaxie. Navigaci nastavíš na „tam, kde jsme to začali řešit“.",
        "Svým dodatkem ke slibu spustíš další velký třesk. Nový vesmír dostáváš s poznámkou „tentokrát stručně“.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "Umíš propojit nápady z různých oborů. Porada s tebou občas připomíná příjemně chytrý výlet.",
        "Na novém úkolu najdeš něco zajímavého. I obyčejnou tabulku tak umíš představit se zaujetím.",
        "Dovedeš se zeptat tak, že se složitá věc vyjasní. Občas tím rozmluvíš i návod k tiskárně.",
        "Do týmu přinášíš lehkost a dobré nápady. Jen se ti jich do jedné poznámky trochu tlačí víc.",
      ],
      [ // úroveň 2
        "K hotovému návrhu připíšeš „ještě jedna možnost“. Ať se ten dokument necítí tak uzavřeně.",
        "Začneš si dělat zápis z porady a vedle něj seznam dalších nápadů. Zápis jim zatím drží sešit.",
        "Na pracovní zprávu odpovíš obratem. S vysvětlením, které se cestou nadchne pro jiný úkol.",
        "Vybereš projektu název dřív než složku. Pak vymyslíš lepší název i pro tu složku.",
      ],
      [ // úroveň 3
        "Na poradě zvládneš představit návrh i všechny námitky. Kolegové tak mohou pohodlně zůstat pouhými svědky.",
        "Výstup máš zatím v podobě zajímavé diskuse. Termín odevzdání zjevně oceňuješ jako námět.",
        "K úkolu dodáš sedm alternativ. Tu variantu s dokončením ponecháváš konkurenci.",
        "V zápisu používáš „shodujeme se“. Tím myslíš krátkou pauzu mezi dvěma vlastními námitkami.",
      ],
      [ // úroveň 4
        "Dokážeš z porady o zkrácení porad udělat celodenní konferenci. Přestávku vyplníš doplňující otázkou.",
        "Tvé rozdělané projekty už tvoří obec. Starostu nemají, protože právě navrhuješ jiné zastupitelstvo.",
        "Na úkol s jedním řádkem zadání vytvoříš prezentaci o tom, proč by se měl jmenovat jinak. Úkol zatím slaví výročí.",
        "Rozjedeš tolik pracovních vláken, že z nich utkáš koberec. Vlastně jen návrh koberce. S přílohou o jiných podlahách.",
      ],
      [ // úroveň 5
        "Rozšíříš program porady za hranice Mléčné dráhy. Galaktický úřad ti přidělí novou dimenzi jen na bod „různé“.",
        "Při odevzdání úkolu přiložíš tolik variant, že si Saturn musí půjčit další prstence na šanony.",
        "Rozjedeš tolik projektů, že je třídíš do souhvězdí podle rozpracovanosti. Velký vůz pořád čeká na kola.",
        "Rozpravu o termínu natáhneš přes tři oběhy Neptunu. Pořád ji vedeš jako rychlé ranní sladění.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Máš dar najít něco nového i na známé cestě. Domů si nosíš příběhy, nejen pečivo.",
        "Z obyčejného dne umíš udělat malou výpravu. Stačí ti otázka „a proč vlastně?“.",
        "Nadchneš se pro nové věci s lehkostí. Tvé zápisníky proto mívají pestrou první stránku.",
        "Díváš se na svět z víc stran. I obyčejná lavička ti tak nabízí zajímavý rozhled.",
      ],
      [ // úroveň 2
        "Jdeš si něco vyhledat a vracíš se s teorií o poštovních holubech. Původní otázka ti zatím hlídá židli.",
        "Koupíš si sešit na jeden koníček. Než dojdeš domů, má už čtyři oddělení.",
        "Při úklidu objevíš zajímavý článek. Prach teď dostává vzdělávací přestávku.",
        "Na volné odpoledne máš pět nápadů. Každému pošleš alespoň nezávazný pozdrav.",
      ],
      [ // úroveň 3
        "Každému koníčku věnuješ plnou pozornost. Jeho celých osm minut.",
        "Tvé životní priority mají jasné pořadí. Řadíš je podle toho, která právě pípne.",
        "O každém tématu víš něco. Ideální kvalifikace pro změnu tématu před druhou otázkou.",
        "Plány si necháváš otevřené. Stejně jako návody, rozečtené knihy a třicet devět dalších věcí.",
      ],
      [ // úroveň 4
        "Tvůj seznam zájmů má vlastní rejstřík. Rejstřík má pokračování. Jediný koníček bez výbavy je dokončování.",
        "Otevřeš tolik možností, že tvůj den vypadá jako chodba ve skladu dveří. Zvenčí je pořád zavřeno.",
        "Z otázky „kde mám klíče?“ uděláš přednášku o vzniku zámků. Přínos pro vědu obrovský, venku pořád nejsi.",
        "Vyrážíš za novou zálibou pokaždé s takovou slávou, že tvé staré koníčky už prodávají lístky na rozlučková turné.",
      ],
      [ // úroveň 5
        "Otevřeš tolik možností, že ti mezihvězdní úředníci odmítají vydat další ráno bez stavebního povolení.",
        "Svým přehodnocováním vytvoříš druhou osu času. Používáš ji hlavně k hledání koníčku z té první.",
        "Přeskakuješ mezi zájmy tak rychle, že tvou stopu na obloze značí souhvězdí Nedokončeného návodu.",
        "Odbočíš od úklidu k původu vesmíru a pošleš velkému třesku připomínky. Ponožky zatím žádají vlastní planetu.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Umíš představit lidi tak, že za chvíli mají společné téma. Občas úplně jiné, než čekáš.",
        "Na setkání přineseš zajímavou historku i dobrou otázku. Nuda si s tebou nedává sraz.",
        "Dovedeš navázat i po dlouhé odmlce. Rozhovor s tebou má příjemně schované pokračování.",
        "Rozproudíš debatu i nad čajem. Konvice k tomu naštěstí nepotřebuje vlastní názor.",
      ],
      [ // úroveň 2
        "Pošleš „jen jednu drobnost“ v pěti zprávách. Každé dáš vlastní dramatický úvod.",
        "Když vyprávíš historku, představíš i všechny vedlejší postavy. Hlavní děj ti zatím drží místo u stolu.",
        "Domluvíš výlet a pro jistotu přihodíš dvě varianty. Kamarádi už si balí i slovo „možná“.",
        "Zeptáš se, jak se daří, a hned přidáš tři další otázky. S tebou se dá stihnout celá tisková konference.",
      ],
      [ // úroveň 3
        "Při skupinové domluvě potvrzuješ každou variantu. Konsenzus si zjevně představuješ jako sbírku.",
        "Kamarádům vyprávíš stručnou příhodu. Význam slova „stručně“ zatím smluvně neošetřujete.",
        "Na otázku „v kolik?“ pošleš zajímavý odkaz. Přesnost má u tebe kulturní vložku.",
        "Nasloucháš pečlivě. Vlastní příběh k tomu máš připravený ještě před poslední větou.",
      ],
      [ // úroveň 4
        "Po tvém „krátce se stavím“ potřebují kamarádi čaj, druhou konvici a nájemní smlouvu pro všechny odbočky.",
        "Z domluvy s pěti lidmi vytvoříš patnáct skupin. V každé pošleš, že je potřeba sjednotit komunikaci.",
        "Když konečně pustíš ostatní ke slovu, uvedeš to jako přestávku ve vlastním programu.",
        "Historku prokládáš tolika dodatky, že se hosté na jejím začátku už nepoznají s hosty na konci.",
      ],
      [ // úroveň 5
        "Založíš skupinu pro každý názor a ucpeš tím Mléčnou dráhu. Merkur doručuje zprávy přes zahrádkářské kolonie na Plutu.",
        "Na setkání se rozpovídáš tak, že Saturn půjčuje prstence na pořadová čísla tvých odboček.",
        "Svou hlasovou zprávou vyplníš černou díru. Teď z ní místo světla uniká „a ještě jedna věc“.",
        "Pošleš pozvánku na klidné posezení a přiložíš mapu poboček napříč multivesmírem. Stále čekáš na jedno společné „platí“.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Na narozeninách umíš propojovat hosty. I svíčky by si s tebou měly o čem povídat.",
        "Každé přání proměníš v milý rozhovor. Poděkování u tebe nemá podobu úřední účtenky.",
        "Umíš oslavě dodat jiskru i bez velkého programu. Jednu historku ovšem pro jistotu nosíš s sebou.",
        "Těšíš se na překvapení a umíš to dát najevo. Dárkový papír s tebou dostává vlastní potlesk.",
      ],
      [ // úroveň 2
        "Přeješ si překvapení. Pro jistotu k němu připojíš sedm námětů a možnost průběžných změn.",
        "Na pozvánku napíšeš „podrobnosti brzy“. Považuješ to za první díl slavnostního napětí.",
        "Při vymýšlení programu nadchneš všechny pro tři různá témata. Dort si zatím necháváš neutrální.",
        "U svíček si přeješ něco nového. Než zhasnou, pro jistotu přidáš i náhradní přání.",
      ],
      [ // úroveň 3
        "Narozeninový seznam přání průběžně aktualizuješ. Hostům tak poskytuješ cenný přehled dárků, které už nechceš.",
        "Slavíš jednou ročně. Upřesňování místa oslavy si ovšem dopřáváš častěji.",
        "U dortu proneseš „jen krátké díky“. Svíčky oceňují, že alespoň ony mají jasný konec programu.",
        "Dárky máš nejraději podle aktuálních zájmů. Účastníkům oslavy tím dáváš krásný náskok několika minut.",
      ],
      [ // úroveň 4
        "Přepíšeš narozeninový program tolikrát, že hosté tisknou pozvánku na gumě. Ať se konečně přizpůsobí.",
        "K přání u svíček přidáš tolik dovětků, že z dortu děláš zápis z ustavující schůze.",
        "Z poděkování za dárek uděláš přednášku o zálibě, která tě přestává bavit během úvodu.",
        "Začneš vyprávět, jak oslava vznikla, a u prvního dárku už potřebuješ rodokmen rekvizit a přestávku na občerstvení.",
      ],
      [ // úroveň 5
        "Změníš místo oslavy tolikrát, že pozvánky doručuje červí díra. I ta před vstupem žádá potvrzení adresy.",
        "U svíček rozvineš přání do dalších vesmírů. Galaktická podatelna ti přidělí souhvězdí jen na dodatky.",
        "Objednáš si dort s aktuálními zájmy. Cukrárna kvůli tomu staví orbitální pás na výměnu marcipánových dekorací.",
        "Na narozeninovou řeč si rezervuješ jeden světelný rok. Hvězdy ti délku opraví na vzdálenost; odbočku vítáš.",
      ],
    ],
  },
  s: [
    ["Odboček na jednu pointu", "11"],
    ["Platnost pevného názoru", "8 s"],
    ["Zájmů v jedné větě", "7"],
    ["Použití slova „mimochodem“", "63×"],
    ["Koníčků s druhou lekcí", "1 z 9"],
    ["Rozhovorů na jedno ahoj", "4"],
  ],
  d: [
    "Dnes máš jasno. Jen k němu průběžně připojuješ nesouhlasné stanovisko.",
    "Dnes začínáš větu s cílem. V půlce jí nabídneš zajímavější trasu.",
    "Dnes má tvé „mimochodem“ delší obsah než hlavní program.",
    "Dnes si kladeš dobré otázky. Každá se před odpovědí stihne skamarádit s dalšími třemi.",
    "Dnes sbíráš nové zájmy. Starým zatím rozesíláš nezávazné pozdravy.",
    "Dnes zvládáš názor i protinázor. Diskusi se sebou vedeš pro jistotu na neutrální půdě.",
    "Dnes bereš tečku jako výborné místo pro reklamní upoutávku na další větu.",
    "Dnes máš plán na celý den. Jen zatím nevíš, ve kterém ze čtyř sešitů bydlí.",
    "Dnes při hledání návodu studuješ historii papíru. Police oceňuje tvůj důraz na souvislosti.",
    "Dnes dáváš zvědavosti volný průběh. Má vlastní klíče a domů chodí jen pro další otázku.",
    "Dnes si vystačíš s jednou odpovědí. Pokud je v ní prostor pro všech šest možností.",
    "Dnes vyprávíš příhodu tak důkladně, že i vedlejší postavy mají nárok na vlastní díl.",
    "Dnes tvé koníčky pořádají seznamovací večírek. Většina se zná jen od vidění.",
    "Dnes otevíráš knihu na chvíli. První odstavec už tě posílá hledat další tři knihy.",
    "Dnes prověřuješ obě strany mince. Hrana tě ale zaujme nejvíc.",
    "Dnes máš tolik doplňujících otázek, že otazníky berou posily ze závorek.",
    "Dnes trváš na svém. Nové stanovisko ještě nemáš učesané pro veřejnost.",
    "Dnes vedeš rozhovor jako poznávací zájezd. Konečnou zastávku držíš v tajnosti i před sebou.",
    "Dnes zkracuješ zprávy. Úvodní čtyři odstavce proto posíláš zvlášť.",
    "Dnes si necháváš zadní vrátka. Mají tři vchody a informační stánek.",
    "Dnes doplňuješ jedinou drobnost. V obsahu zabírá kapitoly osm až dvanáct.",
    "Dnes se držíš tématu. Chvílemi dokonce toho, které je na programu.",
    "Dnes tvá poznámka pod čarou žádá vlastní čáru. A pak ještě trochu prostoru nahoře.",
    "Dnes máš poslední slovo. V poznámkách k němu už připravuješ pokračování.",
  ],
  q: [
    "Ty vyber podnik, já k němu najdu zajímavost. A pak jiný podnik. V nejhorším si dáme předkrm z argumentů.",
    "V sobotu výlet, v neděli klid. Nebo obráceně. Napíšu nám dvě verze víkendu, ať má kalendář co číst.",
    "Odpověď na tvou otázku mám. Jen ji posílám v šesti dílech. Ten s odpovědí poznáš podle překvapivě krátké délky.",
    "Já myju, ty utíráš. A u toho ti vysvětlím, proč mají hrnky ucha. Nádobí konečně dostane i kulturní program.",
    "Vybereme si podle mapy. Jen ji neotáčej, na druhé straně jsou další možnosti a já nám pak zarezervuju atlas.",
    "Pustíme film. Jen se podíváme na pár ukázek. Jestli nás zastihnou titulky večera, zítra navážeme rovnou výběrem.",
  ],
};

export default blizenci;
