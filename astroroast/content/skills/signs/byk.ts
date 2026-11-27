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
      "Býk je spolehlivý jako nedělní oběd. Víš, kdy bude, a nikdo se nehádá.",
      "Býk ví, co chce. Většinou je to oběd a klid.",
      "Býk je pevný bod ve vesmíru. Co slíbí, to přijde, i kdyby se kvůli tomu muselo vstát.",
    ],
    [
      "Změna je pro Býka slovo, které se píše kurzívou a čte se opatrně.",
      "Býk se nehne, dokud není jídlo na stole nebo důvod, který je lepší než gauč.",
      "Tvoje rutina je tak pevná, že se podle ní seřizují sousedovy hodiny.",
    ],
    [
      "Býk není tvrdohlavý. Má jen pravdu dřív, než ostatní začnou mluvit.",
      "Tvoje „ještě o tom popřemýšlím“ znamená „ne“ s měsíčním zpožděním.",
      "Oblíbená židle, oblíbená restaurace, oblíbený názor. Poslední se brání nejurputněji.",
    ],
    [
      "Kdyby tvrdohlavost byla sport, Býk by zlato odmítl. Stupně vítězů jsou přece jiné místo.",
      "Doma máš pořádek tak pevný, že se nábytek bojí posunout sám od sebe.",
      "Býk odmítne i pozvánku na vlastní oslavu, pokud se kvůli ní změní místo.",
    ],
    [
      "Venuše tě prohlásila za nehybnou památku. Magistrát už plánuje kolem tebe parkoviště.",
      "Vesmír se tě pokusil posunout o metr. Stálo to tři supernovy a revizi plánu.",
      "Tvoje židle je v katastru zapsaná jako přírodní památka. Změna vlastníka se neplánuje.",
    ],
  ],
  c: [
    [
      "Umíš si užívat život. Hvězdy to obdivují a tajně ti závidí tu polévku.",
      "S tebou je klid. Jako s dobrou dekou, jen s názory.",
    ],
    [
      "Rozhoduješ pomalu a jistě. Hlavně pomalu a ideálně až po obědě.",
      "Jídlo je pro tebe jazyk lásky. A taky plán na zbytek dne.",
    ],
    [
      "Změny ti vadí jako přesolená polévka: nic dramatického, ale celý den se k tomu vracíš.",
      "Tvrdíš, že tvrdohlavost není tvoje silná stránka. Pak to hájíš dvě hodiny.",
    ],
    [
      "Jsi jediný člověk, který dokáže stát na místě a do telefonu říkat „už jsem na cestě“.",
      "Svoje názory miluješ. Ještě víc miluješ pocit, že je nikdo nevyvrátí.",
    ],
    [
      "Pozice: pevně zakořeněno. Vesmír se kolem tebe musel přeskupit.",
      "Vesmír se tě pokusil přeprogramovat. Server vrátil chybu: „Aktualizaci odmítá. Tvrdí, že mu to tak vyhovuje.“",
    ],
  ],
  v: [
    [
      "Verdikt: skála, která umí uvařit polévku.",
      "Hvězdy radí: dopřej si dezert. Principy se dají odložit na pondělí.",
    ],
    [
      "Rada hvězd: občas ochutnej něco nového. Nemusí to být zítra, stačí do příštího roku.",
      "Verdikt: spolehlivost na pohodlném gauči. Dobrá kombinace, jen se špatně stěhuje.",
    ],
    [
      "Verdikt: vydržíš všechno kromě změny restaurace.",
      "Rada: zkus jednou začít větu slovem „ano“. Země se nezachvěje, ověřeno.",
    ],
    [
      "Verdikt: pevná půda. Škoda, že po ní nikdo nesmí chodit jinudy než ty.",
      "Rada hvězd: pohyb se dá zkusit bez závazků. Třeba o jednu zastávku dál.",
    ],
    [
      "Verdikt vesmíru: odmítnuto. Žádost o změnu byla zamítnuta ještě před odesláním.",
      "Rozsudek: trvalý nárok na gauč a veto proti překvapením.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce jsi bezpečný přístav: kdo u tebe zakotví, ráno najde snídani a večer klid.",
        "Milovat umíš pomalu a pořádně. Po půl roce se partner cítí jako nejoblíbenější místo na světě.",
        "Tvoje romantika voní po večeři: svíčky, dobré jídlo a pocit, že tohle je přesně ono. Dezert je samozřejmost.",
        "Když si Býk někoho vybere, je to na dlouho. Částečně proto, že hledat dalšího by znamenalo pohyb.",
      ],
      [ // úroveň 2
        "Ve vztahu miluješ rituály: stejná kavárna, stejná židle, stejný vtip. Partner ho zná, ale kývá z pocitu domova.",
        "Překvapení pro partnera chystáš měsíc a prozradíš ho po třech dnech, protože by jinak opravdu překvapilo.",
        "Rande v nové restauraci je pro tebe expedice do džungle s jídelním lístkem. Mapu si prohlížíš zvenku.",
        "Romantický víkend: gauč, jídlo, další jídlo a pohled, který říká „tohle je láska“.",
      ],
      [ // úroveň 3
        "Tvoje „ještě o tom popřemýšlím“ u otázky na společné bydlení trvá déle než samotné bydlení.",
        "Na tanečním parketu jsi spíš socha: stojíš, kýváš se a čekáš, až skončí písnička.",
        "Romantika podle Býka: stejná restaurace jako loni, stejný stůl a radost, že se nic nezměnilo. Partner kývá a hledá jídelní lístek.",
        "O dovolené rozhodneš jednoduše: „Jedeme tam, kde jsme byli.“ Diskuse skončila dřív, než začala.",
      ],
      [ // úroveň 4
        "Vztah s tebou je smlouva na dobu neurčitou: lehko se podepisuje, těžko mění a výpověď nikdo nepodal, protože by to znamenalo pohyb.",
        "Hádku vedeš jako pevnost: nikam nejdeš, nikoho nepouštíš a v klidu si mezitím vaříš.",
        "Žárlíš pomalu a důkladně jako svíčková: nikdo to nepozná, dokud není hotovo.",
        "Partner navrhne změnu plánu. Klidně odpovíš „teď to nepůjde“ a tím je téma zavřené do roku 2029.",
      ],
      [ // úroveň 5
        "Venuše ti poslala dotazník o vztahu. Na všech čtyřicet otázek stojí „beze změn“. Úřad zkoumá, jestli to není vtip.",
        "Tvoje láska vydrží i do zhasnutí Slunce, ale jen pokud se to oznámí aspoň tři roky předem.",
        "Když partner navrhne změnu, seismografy na Venuši zaznamenají zachvění. To je tvůj povzdech.",
        "Ve vztahu jsi jako černá díra, jen mírumilovnější: nikoho nepustíš, ale aspoň ho nakrmíš.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci se o tebe tým opře jako o skálu. Plánuješ pomalu, ale dojedeš přesně to, co bylo domluveno.",
        "V práci máš systém: pevná pauza, pevný oběd a pevné přesvědčení, že k výkonu patří obojí.",
        "Kolegové vědí, že co slíbíš, to splníš. Možná ne dnes, ale přesně a bez překvapení.",
        "Pracovní trpělivost máš legendární: dotáhneš to i ve chvíli, kdy ostatní už zavřeli notebooky a šli domů.",
      ],
      [ // úroveň 2
        "Změna systému v práci? První reakce je dlouhý nádech a otázka, jestli to musí být zrovna teď.",
        "Pracovní postup máš vyladěný tak, že se nehne ani při požáru. A když, tak podle evakuačního plánu.",
        "Na poradě mluvíš málo, ale když už, všichni se dívají. Většinou proto, že se s tím nedá nesouhlasit.",
        "Když se v kanceláři přesouvají stoly, střežíš si židli. Noví kolegové se k ní přiblíží teprve po zaučení.",
      ],
      [ // úroveň 3
        "Změny v práci přijímáš s elegancí zdi: pevně a s pocitem, že se dá jít kolem.",
        "Pracovní tempo máš zachované v původním stavu: pomalu, jistě a s jednou pauzou navíc, protože je to tradice.",
        "Nové nápady vítáš: otevřeš e-mail, přečteš nadpis a zavřeš. Vítání je to upřímné.",
        "„Zítra to dokončím“ se u tebe zázračně mění na „po obědě“ a pak na „příští týden“.",
      ],
      [ // úroveň 4
        "Projekt, který si Býk vezme, se dokončí. Projekt, který mu někdo v půlce přidá, se změní v týdenní konflikt.",
        "Na nové úkoly reaguješ jako buldozer na louce: pomalu, nezastavitelně a bez ohledu na rostoucí kytku.",
        "Tvoje pracovní rutina je tak pevná, že i kdyby kancelář zmizela, přišla by ve stejnou hodinu a sedla si na stejné místo.",
        "Když šéf oznámí „budeme se muset přizpůsobit“, ztuhneš. Za tři dny z toho vznikne e-mail se slovem „zvážíme“.",
      ],
      [ // úroveň 5
        "Při stěhování kanceláře na Měsíc zůstane Býk na staré židli v prázdné budově. Tvrdí, že kancelář je pořád tady.",
        "Změna v práci u tebe vyvolá takový odpor, že se Newtonův zákon setrvačnosti přihlásí o autorská práva.",
        "Marketing oznámí „agilní přístup“. Vesmírem proběhne vlna odporu až k Betelgeuse.",
        "Tempo tvé práce změřila NASA a vydala doporučení: neříkat slovo „rychle“ v okruhu tří světelných let.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Život umíš užívat jako málokdo: pomalu, s chutí a s jistotou, že dobré věci stojí za čas.",
        "Umíš vytvořit klid. Stačí vejít do místnosti a ostatním se začne chtít sednout a dát si něco dobrého.",
        "Víš, co tě těší: dobré jídlo, měkká deka a nikam nespěchat. Vesmír to schvaluje a mírně závidí.",
        "Každý den si umíš zařídit malou oázu: hrnek, polštář a žádný budík.",
      ],
      [ // úroveň 2
        "Ideální víkend má tři body: jídlo, pohodlí a jídlo. Pořadí se občas střídá.",
        "Objížďka na cestě do práce je pro tebe malá expedice. Po příjezdu si dáš svačinu jako po výstupu.",
        "Rutina je tvoje druhé jméno. První jméno je „nech mě dojíst“.",
        "Nový obchod otevřeš s opatrností: první týden sleduješ zvenku, druhý si prohlížíš výlohu a třetí vstoupíš.",
      ],
      [ // úroveň 3
        "Říkáš, že změny vítáš. Ta věta ti projde už dvacet let a nikdo ji nezpochybnil.",
        "Nový nábytek? Skvělý nápad. Za dva roky, až se na něj psychicky připravíš, se klidně objedná.",
        "Klid plánuješ s vojenskou přesností: dvě pauzy, jedno jídlo navíc a rezerva na změnu. Nezmění se.",
        "Tvůj život je jako dobrá polévka: sytý a pomalu se zahřívá. Jenže přisypat nové koření se řeší týden.",
      ],
      [ // úroveň 4
        "Změna v tvém životě je vzácný jev, jako sníh v červenci. Všichni ji vidí, nikdo tomu nevěří a večer je pryč.",
        "Tvoje komfortní zóna má vlastní PSČ, parkovací místo a plot pro případ, že by se chtěla posunout o dům dál.",
        "Ráno si přeješ jedinou věc: aby se nic nezměnilo. Odpoledne taky. Večer máš pocit, že přání vyšlo.",
        "Životní motto máš vyšité na polštáři: „Tohle už známe, tak to dáme znovu.“",
      ],
      [ // úroveň 5
        "Tvůj životní styl vešel do astronomických tabulek jako „beze změny od doby bronzové“. Archeologové žádají stipendium.",
        "Tvůj gauč má vlastní gravitační pole. Komety se mu vyhýbají, aby mezi polštáři neuvízly na dobu neurčitou.",
        "Vesmír se rozpíná miliardy let. Tebe nehne ani pozvánka. Fyzici zvažují, jestli nejsi přírodní konstanta.",
        "Při Velkém třesku se Býk prý jako první zeptal, kde je jídlo. Od té doby tam sedí.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "U tebe najdou přátelé klid, dobré jídlo a pocit, že nikam nemusí. Tvůj domov je jejich druhý domov.",
        "Přátelství s tebou drží celý život. Pokud se v něm nic nezmění. A nic se nezmění.",
        "Když si Býk vybere přítele, věří mu. Prověřování trvá tři roky, ale pak je jistota.",
        "Večeře u tebe patří mezi nejlepší zážitky: dlouhá, sytá a hřejivá. Odchod je pak jednání s gravitací.",
      ],
      [ // úroveň 2
        "Na výlet se skupinou vyrazíš, když je jasný jídelníček. Mapu otevřeš až po obědě.",
        "Kamarádi už vědí, že novou restauraci s tebou nevyzkouší. Skončíte u té staré.",
        "Pozvánku potvrzuješ třetí den. Čekáš, aby měla váhu.",
        "Když kamarádi plánují spontánní výlet, ptáš se: „Kdy a kde je oběd?“ Odpověď rozhodne o účasti.",
      ],
      [ // úroveň 3
        "Kamarádi vědí, že jediná spontánní věc u tebe je dezert po večeři.",
        "Skupinový chat oceňuje tvou spolehlivost. „Zítra“ ti na odpověď vždycky vychází na pozítří.",
        "Kamarádi spoléhají na tvou stálost. Chtít se nechat překvapit musí u někoho jiného.",
        "Říkáš, že jsi flexibilní. Kamarádi pokyvují. Pak je pozveš ke svému stolu u svého okna.",
      ],
      [ // úroveň 4
        "S Býkem se dá domluvit na jediném: na tom, co chce Býk. Zbytek je zdvořilá diskuse s předem daným koncem.",
        "Kamarádi tě zvou slovy „čas, místo a pokud chceš“. Tvoje „nechci“ chodí v převleku: „Uvidíme.“",
        "Parta si na tebe zvykla jako na starý stůl: hodí se, drží a nikdo se neodváží ho stěhovat.",
        "Spontánní výlet s tebou: tři argumenty proti, jeden kompromis a žádný výlet.",
      ],
      [ // úroveň 5
        "Kamarádi se pokusí přesunout tvůj oblíbený stůl. Vznikne gravitační anomálie a dva z nich zůstanou na oběžné dráze.",
        "Kamarádi nahlásili NASA signál z hlubokého vesmíru: „Pojďme někam jinam.“ NASA potvrdila, že signál nepřichází od tebe.",
        "Parta tě vede jako pevný bod sluneční soustavy: planety krouží kolem, ty stojíš. Ostatním to slouží jako orientace.",
        "Parta má plán B, C a D pro případ, že odmítneš. Plán E zní: „Pojedeme k tobě.“ A ten přijmeš okamžitě.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš pohodově: dobré jídlo, blízcí lidé a dort, který si zasloužíš už od rána.",
        "Nejlepší dárek je pro tebe klid, dobrá večeře a přání od lidí, kteří vědí, co tě těší. To nikdy nezklame.",
        "Oslava u tebe je vždy příjemná: pohodlí, dobré jídlo a nikdo se necítí rušen.",
        "Svíčky sfoukneš v klidu. Přání už máš na letošek vybrané: ať se nic zásadního nemění.",
      ],
      [ // úroveň 2
        "Narozeninový dort objednáváš každý rok stejný. Cukrář už ví, co chceš, ještě než zavoláš.",
        "Překvapivá oslava u tebe končí překvapením pro ostatní: oslavenec už sedí a objednává.",
        "Dárky ti stačí jednoduché: něco dobrého k jídlu, něco měkkého k sezení a žádný zvuk navíc.",
        "Narozeniny slavíš na stejném místě jako loni. A předloni. Majitel ti už připravuje stůl s cedulkou.",
      ],
      [ // úroveň 3
        "Říkáš, že oslava nemusí být velká. Pak třikrát doplníš menu a dvakrát prodloužíš večer.",
        "Nejlepší překvapení je podle tebe to, které je ohlášené týden dopředu, s pozvánkou a potvrzeným menu.",
        "Narozeninové přání máš každý rok stejné: ať se nic nemění. Vesmír ho plní spolehlivě. Je to nejlehčí přání v celé knize přání.",
        "K narozeninám dáváš dárky praktické: ponožky, polštář, hrnek. Na otázku „nechceš něco víc?“ odpovídá ticho.",
      ],
      [ // úroveň 4
        "Překvapení pro Býka nefunguje: do tří minut zná hosty, menu i čas a ještě si zamluví místo u stolu.",
        "Tvoje narozeniny trvají tak dlouho, jak trvá dort. U dobrého dortu to bývá týden.",
        "Dárek, který se ti nelíbí, ochotně schováš. Ten, který se ti líbí, držíš celý večer v ruce a nikomu ho nepůjčíš.",
        "Narozeniny slavíš „po staru“. Hosté už vědí, že nová hudba, nové jídlo ani nové místo neexistují.",
      ],
      [ // úroveň 5
        "Tvoje narozeniny jsou pevný bod ve vesmíru. Astronomové podle nich seřizují hodinky a Venuše posílá přání v tradiční podobě.",
        "Svíčky na tvém dortu se plánují stejně pečlivě jako oběžné dráhy. Kdyby se jedna posunula, vesmír žádá omluvu.",
        "Když ti někdo naplánuje nečekanou oslavu, vesmír zaznamená poruchu: Mléčná dráha zadrží dech a čeká, co z toho bude.",
        "Dárek od vesmíru je každý rok stejný: další rok se stejným gaučem. Žádost o změnu se vyřizuje do tisíce let.",
      ],
    ],
  },
  s: [
    ["Míst na gauči, odkud se nehýbáš", "1"],
    ["Změn za poslední rok", "0,5"],
    ["Nových restaurací za rok", "0,3"],
    ["Ústupků při hádce", "2 %"],
    ["Slov „ještě chvilku“ denně", "14"],
    ["Odolnosti vůči novinkám", "98 %"],
  ],
  d: [
    "Dnes tě čeká vydatný oběd a pevné rozhodnutí. Jisté je jen to první.",
    "Dnes tě někdo požádá o změnu plánu. Hvězdy doporučují odpovědět do příštího čtvrtka.",
    "Dnešní horoskop: zůstaň tam, kde jsi. Jídlo tam určitě bude.",
    "Dnes ti v restauraci omylem přinesou něco nového. Sníš to a příště si objednáš to staré.",
    "Dnes ti Venuše přeje klid, polštář a jedno spokojené povzdechnutí.",
    "Dnes se rozhodneš něco změnit. Zítra se rozhodneš to vrátit.",
    "Dnešní konstelace: gauč v trigonu s lednicí. Zbytek vesmíru je okrajový.",
    "Dnes tvoje tvrdohlavost naroste o 4 % oproti včerejšku. Hvězdy nabízejí pochopení, ne slevu.",
    "Dnes vyhraješ debatu tak, že druhý odejde na oběd.",
    "Dnes ti vesmír pošle malé překvapení. Třikrát ho prohlédneš a necháš ležet v obalu.",
    "Dnes se tvůj plán nehne. Svět se mu přizpůsobí.",
    "Dnešní tip: oblíbenou restauraci nemusíš nikomu zdůvodňovat. Stačí kývnout a vejít.",
    "Dnes dostaneš nabídku vyzkoušet něco nového. Odpovíš: „Dobrý nápad. Na jaře.“",
    "Dnes ti někdo přestaví hrnek na polici o pět centimetrů. Poznáš to hned z druhého pokoje.",
    "Dnes půjdeš kolem nové kavárny. Prohlédneš si ji. Pak půjdeš do té staré.",
    "Dnes někdo zvýší hlas. Ty ho zvyšovat nemusíš. Stačí pomalu kývnout a nehnout se.",
    "Dnes ti bude připadat, že svět zrychluje. Hvězdy to potvrzují a doporučují zůstat v klidu.",
    "Dnes si u oběda zvolíš „to samé co vždycky“. Servírka ho přinese dřív, než dořekneš.",
    "Dnes ti někdo navrhne spontánní výlet. Slovo „spontánní“ si necháš vysvětlit dvakrát.",
    "Dnes se v tobě střetnou dvě touhy: zůstat doma a zůstat doma. Vítězí druhá, o fous.",
    "Dnes tě unaví věci, které se ani nestaly. Gauč tomu rozumí.",
    "Dnes dostaneš jasné ano. Okamžitě k němu přidáš deset doplňujících otázek a tři podmínky.",
    "Dnes ti někdo řekne, že je čas na změnu. Odpovíš: „Je. Ale ne dnes.“",
    "Dnes ti Venuše pošle dobrou zprávu. Přijmeš ji po obědě, v klidu a s dezertem.",
  ],
  q: [
    "Tam, kde jsme byli minule. A předminule. Číšník už nosí menu, jen aby měl co dělat.",
    "Víkend? Gauč, jídlo, seriál. A když zbyde chvilka, tak gauč.",
    "Odpovím zítra. Ráno. Po snídani. Možná po obědě. Nespěchej.",
    "Umyju ho. Za chvíli. Jen dojím a rozmyslím, jestli to opravdu musí být dnes.",
    "Tam, kde je dobré jídlo a stejná postel jako doma. Takže domů.",
    "Co jsme viděli minule. Zápletku znám, ale právě proto je to uklidňující.",
  ],
};

export default byk;
