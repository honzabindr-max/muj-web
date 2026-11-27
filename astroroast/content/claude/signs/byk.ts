// AstroRoast.ai: knihovna humoru, znamení byk. Ručně psané originální české fragmenty.
//
// Tvar (RawSign, viz content/types.ts). Index 0 = úroveň 1 u všeho, co je Five<...>:
//   h  Five<string[]>   headlines: 3 na úroveň
//   c  Five<string[]>   core lines (výchozí věta o znamení): 2 na úroveň
//   v  Five<string[]>   verdikty: 2 na úroveň
//   t  Record<Topic, Five<string[]>>
//                       témata PO ÚROVNÍCH (4 věty na téma a úroveň, schodiště 1 pohlazení … 5 kosmická poprava): pro každé téma (vztahy, prace, zivot, pratele, narozeniny)
//                       pět polí vět (index 0 = úroveň 1), přesně 4 věty v každém. Engine vybere 2 z t[téma][úroveň-1].
//   s  [label, value][] falešné statistiky znamení: 6 kusů
//   d  string[]         denní jednovětky: 24 kusů (každá o „dnes“, tón úrovně 2-3)
//   q  string[]         odpovědi v páru, pořadí viz COUPLE_SITUATIONS v shared.ts: 6 kusů
//
// Pravidla autora:
// - Žádné šablony se skloňováním: každá věta je hotová (nebo předsklonovaná), takže engine jen vybírá a skládá.
// - Všechny věty v 2. osobě čísla jednotného. Vyhýbáme se rodově označeným tvarům (-l/-la), aby věty
//   seděly komukoli, včetně kamaráda, kterému se roast posílá.
// - Střílíme do stereotypu znamení, nikdy do těla, zdraví, peněz, vyznání, orientace, smrti ani skutečných osob.
// - Úroveň 5 je absurdní a kosmická, nikdy krutá.
//
// Skladba roastu (viz engine/roast.ts):
//   headline = h[úroveň]
//   lines    = c[úroveň] + 2x t[téma][úroveň] + kicker (shared.ts, podle tématu a úrovně; u kamaráda FRIEND_KICKERS)
//   stats    = 1 generická podle tématu + 1-2 ze s
//   verdict  = v[úroveň]
//
import type { RawSign } from "../../types";

const byk: RawSign = {
  h: [
    [
      "Býk: spolehlivý jako dobrá polévka a stejně hřejivý.",
      "Býk ví, co chce. Většinou je to oběd a klid.",
      "Jsi pevný bod ve vesmíru. Hvězdy se o tebe občas opřou.",
    ],
    [
      "Změna je pro Býka slovo, které se píše kurzívou a čte se opatrně.",
      "Býk se nehne, dokud není jídlo na stole nebo důvod, který je lepší než gauč.",
      "Tvoje rutina je tak pevná, že kalendář kontroluje tebe.",
    ],
    [
      "Býk není tvrdohlavý. Jen má pravdu dřív, než ostatní vůbec začnou mluvit.",
      "Tvoje „ještě o tom popřemýšlím“ znamená „ne“ s měsíčním zpožděním.",
      "Máš oblíbenou židli, oblíbenou restauraci a oblíbený názor. Pořadí není náhodné.",
    ],
    [
      "Kdyby tvrdohlavost byla sport, získáš zlato. Na stupně vítězů se ale odmítneš postavit.",
      "Doma máš tak pevné pořádky, že se nábytek bojí přesunout sám od sebe.",
      "Býk odmítne i pozvánku na vlastní oslavu, pokud se kvůli ní změní místo.",
    ],
    [
      "Venuše tě prohlásila za „nehybnou památku“. Magistrát už plánuje kolem tebe parkoviště.",
      "Vesmír se pokusil tě posunout o jeden metr. Zabralo to tři supernovy a nový plán.",
      "Tvůj gauč už má vlastní gravitaci. Planety se kolem něj stáčejí a odmítají přistát.",
    ],
  ],
  c: [
    [
      "Umíš si užívat život. Hvězdy to obdivují a tajně ti závidí tu polévku.",
      "S tebou je klid. Jako s dobrou dekou, jen s názory.",
    ],
    [
      "Rozhodnutí děláš pomalu a jistě. Hlavně pomalu. A hlavně se jim nechceš vystavovat.",
      "Jídlo je pro tebe jazyk lásky. A taky plán na zbytek dne.",
    ],
    [
      "Změny ti vadí jako špatná kvalita kávy: nic dramatického, ale celý den z toho máš pachuť.",
      "Tvrdíš, že tvrdohlavost není tvoje silná stránka. Tvoje obočí se k tomu nepřipojilo.",
    ],
    [
      "Jsi jediný člověk, který dokáže stát na místě a přitom říkat „já jsem už na cestě“.",
      "Víc než názory miluješ jen jednu věc: nenechat si je vyvrátit.",
    ],
    [
      "Pozice: pevně zakořeněno. Výsledek: planeta se kolem tebe musela přeskupit.",
      "Vesmír tě chtěl přeprogramovat. Server vrátil chybu: „Odmítá aktualizaci. Tvrdí, že mu to tak vyhovuje.“",
    ],
  ],
  v: [
    [
      "Verdikt: pevný jako skála, hřejivý jako polévka.",
      "Hvězdy radí: dopřej si. Večer už stejně čeká v plánu.",
    ],
    [
      "Rada hvězd: občas ochutnej něco nového. Nemusí to být hned zítra, stačí do příštího roku.",
      "Verdikt: spolehlivý a pohodlný. Dobrá kombinace, kdyby nebyla na jednom místě.",
    ],
    [
      "Verdikt: vydržíš všechno, kromě změny restaurace.",
      "Rada: příště zkus začít větu slovem „ano“ a uvidíš, jestli se země otřese.",
    ],
    [
      "Verdikt: jsi pevná půda. Škoda, že se po ní nikdo nemůže hýbat.",
      "Rada hvězd: pohyb se dá vyzkoušet bez závazků. Poslechni si to od někoho, kdo se pohybuje.",
    ],
    [
      "Verdikt vesmíru: odmítnuto. Žádost o změnu byla zamítnuta ještě před odesláním.",
      "Rozsudek: trvalý nárok na gauč a veto proti překvapením.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce jsi stabilní přístav: kdo u tebe zakotví, ví, že ráno bude snídaně a večer úsměv.",
        "Umíš milovat pomalu a pořádně. Partner se po půl roce cítí jako nejoblíbenější místo na světě.",
        "Tvoje romantika voní po večeři. Svíčky, dobré jídlo a pocit, že tohle je přesně ono. Dezert je samozřejmost.",
        "Když si Býk někoho vybere, je to na dlouho. Trochu i proto, že hledat dalšího by vyžadovalo pohyb.",
      ],
      [ // úroveň 2
        "Ve vztahu miluješ rituály: stejná kavárna, stejná židle, stejný vtip. Partner ho zná, ale kývá z pocitu domova.",
        "Překvapení plánuješ měsíce dopředu a pak ho prozradíš, protože by jinak mohlo být překvapivé.",
        "Rande v nové restauraci je pro tebe dobrodružství. Přicházíš s pocitem, že tě čeká výprava do džungle s jídelním lístkem.",
        "Romantický víkend vypadá takhle: gauč, jídlo, další jídlo a pohled, který říká „tohle je láska“.",
      ],
      [ // úroveň 3
        "Tvoje „ještě o tom popřemýšlím“ u otázky na společné bydlení trvá déle než samotné bydlení.",
        "Ve vztahu tě jistota drží pevně na místě. Tanec na rande ti tedy hodnotíme jako „statická výstava“.",
        "Romantika podle Býka: stejná restaurace jako loni, stejný stůl a nadšení, že se nic nezměnilo. Partner kývá a hledá menu.",
        "O společné dovolené rozhodneš jednoduše: „Jedeme tam, kde jsme byli.“ Diskuze skončila, ještě než začala.",
      ],
      [ // úroveň 4
        "Vztah s tebou je smlouva na dobu neurčitou: lehko se podepisuje, těžko se mění a výpověď nikdo nepodal, protože by to znamenalo pohyb.",
        "Hádku vedeš jako pevnost: nikam nejdeš, nikoho nepouštíš, a když se válčí, klidně si v pevnosti něco uvaříš.",
        "Žárlíš pomalu a důkladně jako guláš: nikdo to nepozná, dokud není hotovo.",
        "Partner navrhne změnu plánu. Zareaguješ klidně, výrazem „teď to nepůjde“ a následným dvouletým mlčením.",
      ],
      [ // úroveň 5
        "Venuše ti poslala vztahový dotazník. Odpovědi: „beze změn“ pro všech čtyřicet otázek. Úřad zkoumá, jestli nejde o vtip.",
        "Tvoje láska je tak stálá, že přežije i zánik Slunce. Jen s drobnou podmínkou: ať se zánik oznámí aspoň tři roky dopředu.",
        "Když partner navrhne změnu, seismografy na Venuši zaznamenají nepatrné zachvění. To je ten tvůj povzdech.",
        "Ve vztahu jsi jako černá díra, jen mírumilovnější: nikoho nepustíš, ale aspoň ho nakrmíš.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci se o tebe tým opře jako o skálu. Plánuješ pomalu, ale dojedeš to přesně tak, jak je domluveno.",
        "Na práci máš krásný systém: pevná pauza, pevný oběd a pevné přesvědčení, že k produktivitě patří obojí.",
        "Kolegové vědí, že co slíbíš, to splníš. Možná ne dnes, ale s hlubokou ctí a bez zbytečných omylů.",
        "Tvoje pracovní trpělivost je legendární: dotáhneš to i ve chvíli, kdy ostatní už zavřeli sešit a šli domů.",
      ],
      [ // úroveň 2
        "Změna systému v práci? Tvoje první reakce je dlouhý nádech a otázka, jestli to musí být zrovna teď.",
        "Svůj pracovní postup máš vyladěný tak, že se nehne ani při požáru. A když ano, tak podle plánu evakuace.",
        "Na poradě mluvíš málo, ale když už, tak se všichni dívají. Většinou proto, že se s tím nedá nesouhlasit.",
        "Když se v práci mění tým, držíš si oblíbenou židli. Noví lidé se přidají, až si zvyknou na tvůj klid.",
      ],
      [ // úroveň 3
        "Změny v práci přijímáš s elegancí zdi: pevně a se zjevným pocitem, že se dá jít kolem.",
        "Máš pracovní tempo přísně zachované. Metoda: pomalu, jistě a s jednou pauzou navíc, protože je to tradice.",
        "Nové nápady v práci vítáš. Otevřeš e-mail, přečteš nadpis a zavřeš. Vítání je to upřímné.",
        "Tvoje „zítra to dokončím“ má zajímavou vlastnost: zítra se vždycky promění v „po obědě“ a pak v „příští týden“.",
      ],
      [ // úroveň 4
        "Projekt, který si Býk vezme, se dokončí. Projekt, který mu někdo v půlce přidá, se promění v samostatný týdenní konflikt.",
        "Na nové úkoly reaguješ jako buldozer na louce: pomalu, nezastavitelně a bez ohledu na to, že tam rostla kytka.",
        "Tvoje pracovní rutina je tak pevná, že i když kancelář zmizí, rutina přijde ve stejnou hodinu a posadí se na stejné místo.",
        "Když šéf zavolá, že je třeba změna, odpovíš tichým pohledem do dálky. Za tři dny z toho vznikne e-mail se slovem „zvážíme“.",
      ],
      [ // úroveň 5
        "Při stěhování kanceláře na Měsíc zůstane Býk na staré židli v prázdné budově. Tvrdí, že kancelář je pořád tady.",
        "Změna v práci vyvolá u tebe takový odpor, že se Newtonův zákon setrvačnosti přihlásil o autorská práva.",
        "Marketing oznámí „agilní přístup“. Tvoje obočí se zvlní a vesmírem proběhne vlna odporu až k Betelgeuse.",
        "Tvoje pracovní tempo změřila NASA a vydala doporučení: nepoužívat slovo „rychle“ v okruhu tří světelných let.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Život umíš užívat jako málokdo: pomalu, s chutí a s jistotou, že dobré věci stojí za čas.",
        "Máš dar vytvářet klid. Stačí, že vejdeš do místnosti, a ostatním se začne chtít sednout, nadechnout a dát si něco dobrého.",
        "Víš, co tě těší: dobré jídlo, měkká deka a nikam nespěchat. Vesmír to schvaluje a mírně závidí.",
        "Každý den si umíš vytvořit malou oázu. Hrnek, polštář a hlavně žádný zvuk budíku.",
      ],
      [ // úroveň 2
        "Tvůj ideální víkend má tři body: jídlo, pohodlí a jídlo. Pořadí se čas od času střídá.",
        "Změna obvyklé trasy do práce je pro tebe malé dobrodružství. Nervy si žádají hodinu na zotavení.",
        "Rutina je tvoje druhé jméno. První jméno je „nech mě, prosím, dojíst“.",
        "Nový obchod otevřeš s opatrností: nejdřív sleduješ z dálky, pak si prohlédneš výlohu a třetí týden vstoupíš.",
      ],
      [ // úroveň 3
        "Říkáš, že změny vítáš. Dobrá zpráva: ta věta ti prochází už dvacet let a nikdo ji nezpochybnil.",
        "Nový nábytek? Skvělý nápad. Až se na něj za dva roky psychicky připravíš, bude možná v akci.",
        "Klid plánuješ s vojenskou přesností: dvě pauzy, jedno jídlo navíc a rezerva na to, že se něco změní. Nezmění.",
        "Tvůj život je jako dobrá polévka: sytý a pomalu se zahřívá. Jen když se přisype nové koření, řeší se to týden.",
      ],
      [ // úroveň 4
        "Pohyb v tvém životě je vzácný jev, jako úplněk v poledne. Jen s tím rozdílem, že se po něm nikdo nedívá nahoru.",
        "Tvoje komfortní zóna má vlastní poštovní směrovací číslo, parkovací místo a zálohu pro případ, že by se chtělo posunout o dům dál.",
        "Ráno si přeješ jedinou věc: aby se nic neměnilo. Odpoledne taky. Večer máš pocit, že přání vyšlo.",
        "Tvoje životní motto je jasné: „Tohle už známe, tak to dáme znovu.“",
      ],
      [ // úroveň 5
        "Tvůj životní styl vešel do astronomických tabulek jako „beze změny od doby bronzové“. Archeologové žádají o stipendium.",
        "Gauč má vlastní gravitační pole. Komety se mu vyhýbají, aby neuvízly mezi polštáři na dobu neurčitou.",
        "Vesmír se rozpíná miliardy let. Ty se nehneš ani na pozvánku. Fyzici zvažují, jestli nejsi spíš přírodní konstanta.",
        "Při Velkém třesku byl Býk údajně první, koho zajímalo, kde je jídlo. Od té doby tam sedí.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Přátelé u tebe najdou to nejlepší: klid, dobré jídlo a pocit, že nikam nemusí. Tvůj domov je jejich druhý domov.",
        "Přátelství s tebou drží na celý život. Pokud se v něm nic nezmění. A nic se nezmění.",
        "Když si Býk přítele vybere, věří mu. Prověření trvá tři roky, ale pak máš jistotu.",
        "Večeře u tebe patří mezi nejlepší zážitky: dlouhá, sytá a hřejivá. Odchod je pak otázkou dohody s gravitací.",
      ],
      [ // úroveň 2
        "Se skupinou vyrazíš na výlet jen tehdy, když je jasný jídelníček. Na mapu se podíváš až po obědě.",
        "Přátelé už vědí, že novou restauraci s tebou nevyzkouší. Vždycky skončíte u té staré.",
        "Pozvánku na akci potvrzuješ třetí den. Čekáš, aby měla váhu.",
        "Když přátelé plánují spontánní výlet, zeptáš se: „Kdy a kde je oběd?“ Odpověď rozhodne o účasti.",
      ],
      [ // úroveň 3
        "Tvoji přátelé vědí, že jediná spontánní věc u tebe je dezert po večeři.",
        "Skupinový chat ti oceňuje trvalou spolehlivost. Odpověď „zítra“ přijde vždycky přesně dva dny po otázce.",
        "Kamarádi spoléhají na tvou stálost. Chtít se nechat překvapit musejí u někoho jiného.",
        "Říkáš, že jsi flexibilní. Přátelé pokyvují. Pak je pozveš k tvému stolu u tvého okna.",
      ],
      [ // úroveň 4
        "S Býkem se dá domluvit na jediném: na tom, co chce Býk. Zbytek je zdvořilá diskuze s předem daným koncem.",
        "Přátelé tě zvou tak, že napíšou čas, místo a „pokud chceš“. Tvoje „nechci“ chodí v převleku: „Uvidíme.“",
        "Tvoje parta si na tebe zvykla jako na starý stůl: hodí se, drží, ale nikdo si netroufne ho přestěhovat.",
        "Spontánní výlet s tebou? Dostaneš tři argumenty proti, jeden kompromis a žádný výlet.",
      ],
      [ // úroveň 5
        "Tvoji přátelé se pokusí přesunout tvůj oblíbený stůl. Vznikne gravitační anomálie a dva z nich zůstanou na oběžné dráze.",
        "Přátelé nahlásili NASA signál z hlubokého vesmíru: „Pojďte někam jinam.“ NASA potvrdila, že signál nepřichází od tebe.",
        "Kamarádi tě vedou jako pevný bod sluneční soustavy: planety se točí kolem, ty zůstaneš. A oni to berou jako službu.",
        "Tvoje parta má plán B, C a D pro případ, že odmítneš. Plán E zní: „Pojedeme k tobě.“ A ten přijmeš okamžitě.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš pohodově: dobré jídlo, blízcí lidé a dort, který si zasloužíš už od rána.",
        "Tvůj nejlepší dárek je klid, dobrá večeře a přání od lidí, kteří vědí, co tě těší. A to nikdy nezklame.",
        "Oslava u tebe je vždy dokonalá: pohodlí, dobré jídlo a nikdo se necítí rušen.",
        "Svíčky sfoukneš v klidu. Přání už máš pro tento rok vybrané: ať se nic zásadního nemění.",
      ],
      [ // úroveň 2
        "Narozeninový dort máš objednaný stejně každý rok. Pekař už ví, co chceš, ještě než zavoláš.",
        "Překvapivá oslava u tebe skončí překvapením pro ostatní: oslavenec už sedí a objednává.",
        "Dárky ti stačí jednoduché: něco dobrého k jídlu, něco měkkého k sezení a žádné zvuky navíc.",
        "Narozeniny slavíš na stejném místě jako loni. A předloni. Majitel ti už připravuje stůl s cedulkou.",
      ],
      [ // úroveň 3
        "Říkáš, že oslava nemusí být velká. Pak třikrát doplníš menu a dvakrát prodloužíš večer.",
        "Nejlepší překvapení pro tebe je to, které je ohlášené týden dopředu, se zaslanou pozvánkou a potvrzeným menu.",
        "Tvoje přání k narozeninám: ať se nic nemění. Vesmír ti ho splní jako vždy. Je to nejsnazší přání v celé knize přání.",
        "K narozeninám dáváš dárky praktické: ponožky, polštář, hrnek. Odpovědí na „nechceš něco víc?“ je ztichlé zamyšlení.",
      ],
      [ // úroveň 4
        "Překvapení pro Býka nefunguje: do tří minut zná hosty, menu i čas a ještě si stihne zamluvit místo u stolu.",
        "Tvoje narozeniny trvají tak dlouho, jak trvá dort. Což u tebe může být týden, pokud je dobrý.",
        "Dárek, který se ti nelíbí, ochotně schováš. Dárek, který se ti líbí, držíš celý večer v rukou a nikomu ho nepůjčíš.",
        "Narozeniny slavíš ve stylu „po staru“. Hosté už vědí, že nová hudba, nová jídla ani nová místa neexistují.",
      ],
      [ // úroveň 5
        "Tvoje narozeniny jsou pevný bod ve vesmíru. Astronomové si podle nich seřizují hodinky a Venuše posílá přání v tradiční podobě.",
        "Svíčky na tvém dortu se plánují stejně pečlivě jako oběžné dráhy. Kdyby se jedna posunula, vesmír žádá omluvu.",
        "Když ti někdo naplánuje nečekanou oslavu, vesmír zaznamená poruchu: Mléčná dráha zadrží dech a čeká, co z toho bude.",
        "Dárek od vesmíru je každý rok stejný: další rok se stejným gaučem. Žádost o změnu se přijímá do jednoho tisíce let.",
      ],
    ],
  },
  s: [
    ["Míst na gauči, odkud se nehýbáš", "1"],
    ["Změn za poslední rok", "0,5"],
    ["Nových jídel, která zkusíš", "7"],
    ["Ústupků při hádce", "2 %"],
    ["Slov „ještě chvilku“ denně", "14"],
    ["Odolnosti vůči novinkám", "98 %"],
  ],
  d: [
    "Dnes tě čeká vydatný oběd a pevné rozhodnutí. Jistý je jen ten oběd.",
    "Dnes tě někdo požádá o změnu plánu. Hvězdy doporučují rozhodnout se do příštího čtvrtka.",
    "Dnešní horoskop: zůstaň tam, kde jsi. Jistě tam bude i jídlo.",
    "Dnes ti někdo popletl objednávku. Tvoje obočí to řeší za tebe.",
    "Dnes ti Venuše přeje klid, polštář a jedno spokojené povzdechnutí.",
    "Dnes se rozhodneš něco změnit. Zítra se rozhodneš to vrátit.",
    "Dnešní konstelace: gauč v trigonu s lednicí. Zbytek vesmíru je okrajový.",
    "Dnes tvoje tvrdohlavost naroste o 4 % oproti včerejšku. Hvězdy nabízejí pochopení, ne slevu.",
    "Dnes se ti poštěstí vyhrát debatu tím, že dotyčný odejde jíst.",
    "Dnes ti pošle vesmír malé překvapení. Zkontroluješ ho třikrát a pak ho nezkusíš.",
    "Dnes se tvůj plán nehne. Svět se přizpůsobí kolem něj.",
    "Dnešní tip: oblíbenou restauraci nemusíš zdůvodňovat. Stačí kývnout a vstoupit.",
    "Dneska dostaneš nabídku vyzkoušet něco nového. Odpovíš: „Dobrý nápad. Na jaře.“",
    "Dnes si pro jistotu zkontroluješ, že se věci vrátily na svá místa. Nevrátily. Přeskládáš je.",
    "Dnes projdeš kolem nové kavárny. Zahlédneš ji. Pak půjdeš do té staré.",
    "Dneska někdo zvedne hlas. Ty ho zvednout nemusíš. Stačí pomalu kývnout a nehnout se.",
    "Dnes budeš mít pocit, že svět zrychluje. Hvězdy to potvrzují a doporučují zůstat v klidu.",
    "Dnes se u oběda rozhodneš pro „to samé co vždycky“. Servírka ti to přinese dřív, než si objednáš.",
    "Dneska ti někdo navrhne spontánní výlet. Slovo „spontánní“ si necháš vysvětlit dvakrát.",
    "Dnes se v tobě sváří dvě touhy: zůstat doma a zůstat doma. Vítězí ta druhá, jen těsně.",
    "Dnes tě unaví věci, které se ani nestaly. Gauč tomu rozumí.",
    "Dneska dostaneš jasné ano. Okamžitě k němu připojíš deset doplňujících otázek a tři podmínky.",
    "Dnes ti někdo řekne, že je čas na změnu. Odpovíš: „Je. Ale ne dnes.“",
    "Dnes ti Venuše pošle dobrou zprávu. Ty ji přijmeš po obědě, v klidu a s dezertem.",
  ],
  q: [
    "Tam, kde jsme byli minule. A kde jsme byli předminule. Máš vlastní stůl.",
    "Víkend? Gauč, jídlo, seriál. A pokud bude chvilka navíc, tak taky gauč.",
    "Odpovím zítra. Ráno. Po snídani. Možná po obědě. Nespěchej.",
    "Umyju ho. Za chvíli. Jen se dojím a rozmyslím, jestli to opravdu musí být dnes.",
    "Tam, kde je dobré jídlo a stejná postel jako doma. Takže domů.",
    "To, co jsme viděli minule. Zápletku znám, ale přijde mi to uklidňující.",
  ],
};

export default byk;
