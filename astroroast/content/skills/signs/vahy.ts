// AstroRoast.ai: knihovna humoru, znamení vahy. Ručně psané originální české fragmenty.
//
// Tvar (RawSign, viz content/types.ts). Index 0 = úroveň 1 u všeho, co je Five<...>:
//   h  Five<string[]>   headlines: 3 na úroveň
//   c  Five<string[]>   core lines (výchozí věta o znamení): 2 na úroveň
//   v  Five<string[]>   verdikty: 2 na úroveň
//   t  Record<Topic, Five<string[]>>
//                       témata PO ÚROVNÍCH: pro každé téma (vztahy, prace, zivot, pratele, narozeniny)
//                       pět polí vět (index 0 = úroveň 1), přesně 4 věty v každém (100 vět na znamení).
//                       Engine vybere 2 z t[téma][úroveň-1].
//   s  [label, value][] falešné statistiky znamení: 6 kusů
//   d  string[]         denní jednovětky: 24 kusů (+ headlines úrovní 2-3 = pool >= 30)
//   q  string[]         odpovědi v páru, pořadí viz COUPLE_SITUATIONS v shared.ts: 6 kusů
//
// Žebřík úrovní (platí pro h, c, v i každou větu v t):
//   1 Pohlazení       vřelý lichotivý kompliment s drobným mrknutím na konci, bez žihadla
//   2 Šťouchnutí      přátelské popichování, každodenní pozorování s lehkým zvratem
//   3 Sarkasmus       suchá ironie, kompliment se ukáže jako kritika, jasná pointa
//   4 Roast           přímý popel na stereotyp, přehánění, ostrá srovnání, konkrétní směšné situace
//   5 Kosmická poprava absurdní kosmická eskalace (planety, černé díry, NASA, galaxie, mezihvězdná byrokracie)
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

import type { RawSign } from "../../types";

const vahy: RawSign = {
  h: [
    [
      "Váhy: vkus, takt a stůl, u kterého se cítí dobře úplně každý.",
      "Dvě stejně dobré možnosti? Ty v nich vidíš dvě krásné možnosti, ne problém.",
      "S tebou je u stolu vždycky pohoda. Jen se objednává trochu později.",
    ],
    [
      "„Je mi to jedno“ znamená u tebe: hádej, ale hádej správně.",
      "Tvoje oblíbená odpověď je „a co chceš ty?“. Druhá je „a co ty?“.",
      "Vidíš obě strany sporu. Proto nejsi nikdy ani na jedné.",
    ],
    [
      "Tabulka pro a proti má osm sloupců a žádný závěr.",
      "Řekneš „klidně“ a myslíš „vyber to správně, ale ať je to můj nápad“.",
      "Pro každý problém máš šest řešení. Mezitím ho vyřeší někdo jiný.",
    ],
    [
      "Jídelní lístek čteš jako kupní smlouvu. A stejně si dáš to, co sousední stůl.",
      "Hádku vyhraješ v hlavě za deset minut. Nahlas ji nikdy nezačneš.",
      "Jedno tvoje „možná“ ukončilo tři hádky. Čtvrtou vyvolalo.",
    ],
    [
      "Venuše čeká na tvou odpověď od minulé galaxie. Poslala už druhou připomínku.",
      "Vesmír se rozpíná, protože na otázku „kudy ven?“ někdo odpověděl „jak chcete“.",
      "Kosmická váha ukazuje nulu. Technik tvrdí, že přesně měří tvoje rozhodnutí.",
    ],
  ],
  c: [
    [
      "Do místnosti přijdeš a nálada se vyrovná jako obraz na zdi. Pak ještě zkontroluješ, jestli visí rovně.",
      "Máš oko pro detail: ponožky sladíš s tapetou a dárek s člověkem. Jen restauraci vybíráš hodinu.",
    ],
    [
      "Na otázku „kam půjdeme jíst?“ máš odpověď „kamkoli“. Pak zamítneš první tři návrhy.",
      "Rozhodneš se „do večera“. Večer z toho je „do zítřka“ a zítra „uvidíme“.",
    ],
    [
      "V debatě dáš za pravdu oběma stranám. Obě odcházejí spokojené a nikdo neví, o čem se vlastně hádaly.",
      "Konflikt vyřešíš úsměvem a změnou tématu. Pro tebe je vyřešený. Druhá strana o tom ještě neví.",
    ],
    [
      "Rozhodnutí odkládáš s láskou k řemeslu: složka, připomínka a záloha pro případ, že se vyřeší samo.",
      "Slovo „ne“ máš vyzkoušené jen doma před zrcadlem. Venku z něj vyjde „no, uvidíme, asi, kdyby to šlo“.",
    ],
    [
      "Vesmír chtěl jedno „ano“, nebo „ne“. Tvoje „obojí, ale jinak“ prochází posudkem třetí galaxie.",
      "Vesmírný kalendář má sloupec „Váhy: rozhodnuto“. Od velkého třesku je prázdný.",
    ],
  ],
  v: [
    [
      "Verdikt: vkus pro věci i pro lidi. Jen si dnes konečně vyber, co si dáš.",
      "Hvězdy radí: vyber první věc, která tě napadne, a neohlížej se. Obě by ti padly.",
    ],
    [
      "Rada hvězd: řekni nahlas, co chceš. Třeba jen že vanilkovou, ne tu druhou.",
      "Verdikt: lidé tě mají rádi, protože jim nikdy nic nezkazíš. Ani rozhodnutí.",
    ],
    [
      "Verdikt: souhlasit se všemi není postoj. Je to recepce hotelu.",
      "Rada: sepiš pro a proti. A pak vybírej podle toho, který sloupec má hezčí písmo.",
    ],
    [
      "Verdikt: diplomacie jako v OSN. Všichni mluví, všichni jsou spokojení a nikdo nic nepodepíše.",
      "Rada hvězd: řekni „ne“ a nic k němu nepřidávej. Ani omluvu, ani dort.",
    ],
    [
      "Verdikt vesmíru: hlasování je nerozhodné. Tvůj hlas se započítal na obě strany a vyrušil.",
      "Rozsudek: do konce týdne vyber jednu ze dvou věcí. Vesmír počká, ale poklepává přitom prstem o černou díru.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Umíš poslouchat tak pozorně, že se partner cítí jako jediný člověk v kavárně. Že mezitím vybíráš dezert, nepozná.",
        "Partnerovi nosíš květiny, které se hodí k jeho nábytku i k jeho náladě. Pozornost k detailu je tvůj jazyk lásky.",
        "Hádku změkčíš tak, že skončí smíchem a společným výběrem večeře. Pravda, ten výběr trvá hodinu.",
        "Rande s tebou vypadá jako z filmu: světlo, hudba a židle posunutá o dva centimetry doleva, aby to ladilo.",
      ],
      [ // úroveň 2
        "„Co si dáme k večeři?“ – „Cokoli.“ A pak jemně vyvrátíš každý návrh, který partner řekne. Cokoli je u tebe dost přesné.",
        "Plánování rande ti zabere víc času než samotné rande. Hlavně rozhodování mezi dvěma stejně milými restauracemi.",
        "Když řekneš „je mi to jedno“, partner už ví, že ti to jedno není. Jen zkouší hádat, co vlastně chceš.",
        "Na pozvání na víkend říkáš „zní to zajímavě“. Je to asi šedesát procent ano, třicet procent ne a deset procent „uvidím“.",
      ],
      [ // úroveň 3
        "„Jak chceš“ říkáš tak ledovým hlasem, že partner chvíli pochybuje, co vlastně chce.",
        "V hádce dáš za pravdu oběma. Každý se cítí vítězem a nikdo si nepamatuje, o co šlo. Ani kdo uklidí.",
        "Na „miluješ mě?“ odpovíš „samozřejmě“ za čtyři vteřiny. Partner ty vteřiny počítá.",
        "„Nevadí mi to“ od tebe doputuje k partnerovi za tři dny. V podobě ticha u večeře.",
      ],
      [ // úroveň 4
        "Rozejít se s tebou trvá jako vybrat tapetu. Než se rozhodneš, vyjdou dvě nové kolekce.",
        "Na otázku, co si dáš, uděláš dva výrazy: „všechno“ a „nic“. Číšník mezitím obslouží vedlejší stůl dvakrát.",
        "Partner se ptá, kdy se zítra uvidíte. „Pak se uvidí“ trvá od středy do soboty. Na sobotu pak máš „možná“.",
        "V hádce napíšeš odstavec, smažeš ho, napíšeš druhý a pošleš „nic“. Pak přihodíš srdíčko, jako by se nic nestalo.",
      ],
      [ // úroveň 5
        "Venuše vyhlásila referendum o tvém vztahu: tři pro, tři proti, jeden pulsar se zdržel. Opakuje se od srpna.",
        "Kupid ti nabídl tři šípy. Vybíráš od roku 2019. Kupid mezitím přešel k jiné zakázce, ale šípy ti nechal na stole.",
        "Dva satelity se do sebe zamilovaly a čtyři roky obíhají, protože žádný nechce být první, kdo se zeptá. Učily se od tebe.",
        "Planety tvého vztahu ti poslaly oběžník: vyber si, kolem koho kroužíš. Odpověď „kolem obou“ fyzika nepřipouští, ale zkoušíš to.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci umíš zklidnit kohokoli a každému dát za pravdu tak, že se nikdo necítí odbytý. Tým by se bez tebe rozpadl na tři malé týmy.",
        "Máš cit pro prezentace: barvy ladí, písmo sedí a obsah drží. Kolegové ti závidí hlavně třetí snímek.",
        "Vyjednávání je tvůj živel. U jednoho stolu s tebou se i cizí lidé usmívají a odcházejí s dohodou.",
        "V kanceláři vytvoříš atmosféru, ve které se dobře pracuje. Květina na stole je vlastně tvoje zásluha.",
      ],
      [ // úroveň 2
        "Na poradě slyšíš oba názory a oba ti dávají smysl. Do zápisu jde věta „zvážíme obě strany“.",
        "E-mail s rozhodnutím píšeš tak jemně, že kolegové občas nepoznají, jestli jim něco zakazuješ, nebo nabízíš.",
        "Při výběru dodavatele sepíšeš pro a proti, pošleš to třem lidem a čekáš. Čekání skončí dalším e-mailem.",
        "Do práce nosíš dvě kávy, protože se ráno nerozhodneš. Tým to už bere jako součást interiéru.",
      ],
      [ // úroveň 3
        "Termín? „Zhruba tenhle týden.“ V kalendáři je u toho kolonka „možná“, která se od pondělí nepohnula.",
        "Na poradě řekneš „je to na vás“. Tím je to na všech, a když je to na všech, nikdo za nic nemůže.",
        "Kolegovi řekneš, že jeho nápad je „zajímavý“. Zajímavý jako pozvánka na akci, na kterou nikdo nepůjde.",
        "Rozhodnutí odkládáš tak profesionálně, že na to máš složku. Jmenuje se „Pro jistotu“ a je největší na celém disku.",
      ],
      [ // úroveň 4
        "„Jaký je tvůj názor?“ – „To záleží.“ Na čem, nezjistí nikdo. Hlavně zůstanou otevřené dveře.",
        "Výběr písma do prezentace ti trvá dva dny. Pak ji odešleš ve třech písmech, ať je to pestré.",
        "Na schůzce o rozpočtu hlasuješ pro, proti a zdržuješ se. Zápis vypadá jako rovnice o třech neznámých.",
        "Tým vyjednává se zákazníkem. Ty vyjednáváš s týmem, jestli se do vyjednávání vůbec zapojíš.",
      ],
      [ // úroveň 5
        "Porada vesmírné rady trvá už tři galaxie. Důvod: Váhy se nemohou rozhodnout, jestli přijít včas, nebo elegantně.",
        "Slunce chtělo rozhodnutí o stavu soustavy. Dostalo „pošlu dva návrhy a třetí do kontroly“. Čeká už čtyři a půl miliardy let.",
        "NASA se zeptala, kam letět. Odpověď: „Obě možnosti jsou skvělé.“ Raketa stojí na rampě a posádce mezitím vyrostly děti.",
        "Černá díra navrhla fúzi. Odpověď: „Dáme to do příštího kvartálu.“ Kvartál ji mezitím pohltil.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Svět se kolem tebe zkrášluje. Kam přijdeš, tam se zvedne nálada, vyladí se barvy a židle stojí tak, jak mají.",
        "Vidíš krásu v maličkostech: hrnek, světlo, ponožky ve správném odstínu. Ostatní se díky tobě zpomalí a podívají se taky.",
        "Dárek umíš vybrat tak, že sedne každému. Lidé tomu říkají vkus a ty „no, to se tak povedlo“.",
        "Máš rovnováhu mezi prací a pauzou, ticho a hudbou. Jediné, co se u tebe kymácí, je výběr mezi kávou a čajem.",
      ],
      [ // úroveň 2
        "V obchodě si vyzkoušíš sedm kousků, odnášíš dva a třetí se druhý den vrátíš koupit. Prodavačka už má pro tebe pozdrav.",
        "Večeři vybíráš jako diplomatickou misi: konzultace, kompromis a nakonec pizza jako vždycky.",
        "„Čaj, nebo kávu?“ – „A co máte?“ Seznam je dlouhý a ty mu věnuješ plnou pozornost.",
        "Máš dvanáct oblíbených restaurací a při každém výběru pochybnost, která z nich vyhraje. Restaurace si už zvykly.",
      ],
      [ // úroveň 3
        "„Zítra se rozhodnu“ znamená, že zítra rozhodneš, kdy se budeš rozhodovat.",
        "Říkáš, že děláš kompromisy. Zatím je ale vždycky dělali ostatní a ty jim za to děkuješ.",
        "Když tě donutí vybrat, vyberou za tebe. Pak se tváříš překvapeně a vydechneš úlevou.",
        "Máš dva druhy názoru: vnitřní a pro okolí. Dobře spolu vycházejí, dokud se nepotkají u stolu.",
      ],
      [ // úroveň 4
        "Na „co chceš dělat?“ odpovíš „a co ty?“. Pak ještě jednou. Pak kývneš, že jsi pro cokoli, a říkáš tomu svoboda.",
        "Tvoje tři oblíbená slova: „vlastně“, „ale“ a „to je těžké“. Ve větě se objevují obvykle v tomhle pořadí.",
        "Máš vybrat jednu ze dvou věcí, a tak si vyrobíš třetí. Je horší, ale aspoň ji nikdo nemůže srovnat s tou druhou.",
        "Máš výborný vkus. Chybí k němu jediná věc: nákup. Vkus ve výloze, účtenka nikde.",
      ],
      [ // úroveň 5
        "Vesmírná komise žádá stanovisko. Odpověď „pro, ale taky proti“ ji přiměla objednat druhý vesmír na srovnání.",
        "Země se tě zeptala, jestli tu chceš zůstat. Odpověď se očekává po další době ledové. Zatím máš „jo, ale“.",
        "Kosmická váha se zlomila na dvě poloviny a ty se hádají, která je správná. Ty rozumíš oběma, takže nerozhoduješ.",
        "Merkur a Venuše hlasovaly o společné dráze. Výsledek 1:1. Rozhodnout měl tvůj hlas, ale ten se zdržel i zdržení.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Mezi přáteli jsi lepidlo: kdo se zlobí, ten se dohodne, kdo se nudí, ten se zasměje. Partu držíš pohromadě a nikdo neví jak.",
        "Vyslechneš každého stejně pozorně. I když příběh slyšíš po čtvrté, odcházejí všichni lehčí.",
        "Dárky od tebe vypadají, jako by o ně požádal sám obdarovaný. Stačilo jen poslouchat, když o tom mluvil.",
        "Díky tobě se lidé potkávají. Jeden se přidá k druhému a oba pak tvrdí, že to byl jejich nápad. Tobě to nevadí.",
      ],
      [ // úroveň 2
        "Parta řeší, kam půjde. Ptáš se všech. Pak všichni čekají, až se zeptáš i sebe.",
        "Skupinový chat s tebou má dvě fronty: ti, kdo píšou, a ti, kdo čekají, až se rozhodneš.",
        "Pomáháš kamarádovi vybrat bundu. Dva dny, pět obchodů, a každá je nakonec „super, ale…“.",
        "Při proslovu na oslavě hledáš slova tak dlouho, že ostatním vystydne káva. Ale je to krásný proslov.",
      ],
      [ // úroveň 3
        "S tebou se plánuje snadno: nikdy neřekneš „ne“. Jen taky nikdy „ano“.",
        "Když ti kamarád řekne něco nepříjemného, zjemníš to. Pak mu doporučíš někoho, kdo to řekne líp.",
        "„Jdeš s námi?“ – „Uvidíme.“ V překladu: ještě rozhoduju, jestli se budu rozhodovat.",
        "Každému řekneš, co chce slyšet. Když se dva kamarádi sejdou, zjistí, že jim bylo řečeno opak.",
      ],
      [ // úroveň 4
        "Hlasování o restauraci trvá déle než samotná večeře. Hlasuje se i o tom, kdo bude hlasovat.",
        "„Budeš na srazu?“ – „Možná.“ Potvrdíš příští týden. Sraz už proběhl a všichni jsou doma.",
        "Kamarádi tě mají rádi jako předpověď počasí: každý den jiná a stejně ji všichni čtou.",
        "Když se přátelé hádají, jsi neutrální jako Švýcarsko. A stejně nikdo neví, co si ve skutečnosti myslíš.",
      ],
      [ // úroveň 5
        "Galaxie svolala parlament přátelství. Hlasování o tobě skončilo remízou, protože tvoje „asi“ nebylo uznáno ani jako ano, ani jako ne.",
        "Přátelé poslali sondu zjistit, kam půjdete na večeři. Po třech letech se vrátila s jednou větou: „Možná.“ Je to dnes historický dokument.",
        "Přátelé ti pojmenovali souhvězdí Dvě Možnosti. Skládá se ze dvou hvězd, které se nikdy nespojí, protože nikdo nechce být první.",
        "Mléčná dráha tě pozvala na akci. Tvoje „uvidíme“ ještě letí a doletí zhruba kolem roku 30 000.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš s vkusem: svíčky, tlumené světlo a dobrá hudba. Hosté odcházejí s pocitem, že měli nejhezčí večer týdne.",
        "Dárek umíš vybrat tak, že obdarovaný má pocit, že ho někdo opravdu zná. A často to tak je.",
        "Tvoje oslavy mají harmonii: dobrý dort, dobrá hudba a nikdo nesedí v rohu sám.",
        "Pozvánky píšeš tak, že přijdou i ti, kdo původně nechtěli. Mají pocit, že by byla škoda chybět.",
      ],
      [ // úroveň 2
        "Při výběru dárku si vybereš tři. Pak se rozhodneš pro čtvrtý. Nakonec pro ten první.",
        "Narozeninový dort je pro tebe dilema: čokoláda, nebo ovoce? Skončí to jako půlka a půlka.",
        "„Co chceš k narozeninám?“ – „Něco hezkého.“ Následuje dvacet minut upřesňování.",
        "Pozvánky rozešleš včas. Jen datum se mezitím dvakrát posune, protože nevíš, jestli sobota, nebo neděle.",
      ],
      [ // úroveň 3
        "Řekneš „nic nechci“ a pak se na každý dárek díváš pohledem „zajímavé, ale není to ono“.",
        "„Kam půjdeme?“ – „Je mi to jedno.“ A pak zamítneš tři podniky z estetických důvodů.",
        "Slavit můžeš kdykoli. Nejlépe v den, kdy se k tomu rozhodneš. Což je zatím nikdy.",
        "Při proslovu nevíš, jestli děkovat, nebo vtipkovat. Uděláš obojí a nastane ticho.",
      ],
      [ // úroveň 4
        "Oslava má dvě data, dva rozpočty a dva dorty. Hosté nevědí, kdy přijít. Ty se ptáš, jestli by to nešlo ještě jinak.",
        "Při výběru dortu strávíš víc času než ostatní výběrem bytu. Dort nakonec vyhraje, protože je sladký.",
        "Kamarádi ti kupují poukaz. Dárek by znamenal, že se musejí zamyslet, co chceš, a to nevíš ani ty.",
        "Máš sfouknout svíčky, ale přání je tak neurčité, že vesmír posílá doplňující otázky.",
      ],
      [ // úroveň 5
        "Vesmír se snaží doručit tvoje narozeninové přání. Má dvě verze po dvanácti variantách. Doručí se po sloučení v roce 4000.",
        "Při sfouknutí svíček se Mléčná dráha na chvíli zastavila a čekala, jestli začneš zleva, nebo zprava.",
        "NASA vypočítala, že se tvoje oslava koná ve dvou časových pásmech najednou. Žádné z nich zatím nepotvrdila.",
        "Kosmický dort má dvě poloviny. Obě jsou pistáciové i čokoládové. O sloučení se rozhodne v příštím tisíciletí.",
      ],
    ],
  },
  s: [
    ["Rozhodnutí hotových do termínu", "3 %"],
    ["Kusů oblečení vyzkoušených před odchodem", "7"],
    ["Pravdivost věty „je mi to jedno“", "0 %"],
    ["Minut výběru filmu před spaním", "40"],
    ["Dnešních vyhnutých konfliktů", "6"],
    ["Pravděpodobnost, že řekneš „ne“", "8 %"],
  ],
  d: [
    "Dnes budeš muset vybrat mezi dvěma věcmi. Vesmír ti dává týden. Nebo dva.",
    "Venuše dnes radí: buď elegantní. A když to nejde, aspoň buď ve stejné barvě jako zbytek místnosti.",
    "Dnes tě čeká důležité rozhodnutí. Pošleš ho na poradu třem kamarádům a pak ještě dvěma. Pátý bude proti.",
    "Dnešní konstelace: dvě možnosti, dvě strany a jedna váha, která ukazuje na střed.",
    "Někdo ti dnes řekne „je to na tobě“. Tvoje odpověď dorazí příští týden a bude znít „asi“.",
    "Dnes se rozhodneš. Zítra se rozhodneš, jestli to rozhodnutí platí.",
    "Dnešní tip: začni malým rozhodnutím. Třeba čajem. Hvězdy už dvacet minut porovnávají druhy.",
    "Konfliktu se dnes vyhneš tak elegantně, že se o tři dny později omluvíš za něco, co se nestalo.",
    "Z dvou možností dnes vybereš jednu. Pak se zeptáš, jestli by nešly zkombinovat.",
    "Dnes se pokusíš říct zdvořile „ne“. Zní to jako „to je zajímavé, dám vám vědět“. Dotyčnému to stačí.",
    "Dnes strávíš dvě hodiny nad výběrem lampy. Koupíš žárovku.",
    "Dnes řekneš „rozhodnu se hned“. Hvězdy se podívají na hodiny a odejdou na kávu.",
    "Oběd si dnes objednáš po dvaceti minutách váhání. Číšník stihne dvakrát přehodnotit svou kariéru.",
    "Dnes řekneš „ne“. Bude 14:07. Hvězdy to zapíšou jako historickou událost a pošlou pamětní medaili.",
    "Dnes v Lidlu porovnáš dva úplně stejné jogurty a pro jistotu napíšeš třem lidem. Rozhodne čtvrtý pocit.",
    "Dostaneš dvě barvy na výběr a vybereš třetí. Hvězdy tomu říkají kreativita, prodavač zdržení.",
    "Dnes zjistíš, že „asi“ je skvělá strategie. Asi.",
    "Dnes sestavíš seznam písniček na cestu. Příprava: 45 minut. Přehrávání: 12.",
    "Dnes uvidíš krásný západ slunce. Nad fotkou strávíš víc času než nad samotným západem.",
    "Na otázku po názoru dnes odpovíš „to záleží“. Posluchač už dvacet minut čeká, na čem.",
    "Dnes si koupíš dvě verze téhož, obě vrátíš a koupíš třetí. Prodavačka tě začne zdravit jménem.",
    "Dnes sladíš ponožky s náladou. Nálada se do oběda změní. Ponožky zůstanou.",
    "Dnes tě čeká hlasování pro, nebo proti. Zvedneš ruku tak vlažně, že se to počítá jako mávnutí.",
    "Na zprávu dnes odpovíš do minuty. Okolí se zeptá, jestli se nic nestalo.",
  ],
  q: [
    "Je mi to jedno. Vyber ty. Jen ne ten podnik, ve kterém jsme byli včera. A ne ten od mostu. A ne… radši nic neříkej.",
    "O víkendu bychom mohli všechno. Navrhuju tři varianty. Čtvrtou vymyslíme v sobotu ráno, až uvidíme, jak je venku.",
    "Odpovím. Jen musím vymyslet odpověď, která nikoho neurazí. Dej mi dvacet minut. Spíš týden.",
    "Já umyju, ty utíráš. Nebo naopak? Nebo to necháme na zítra? Jak chceš. Ne, jak chceš ty.",
    "Tam, kde je hezky. Mám tři návrhy. Ale když chceš čtvrtý, bude určitě hezčí než moje tři.",
    "Cokoli. Hlavně ne horor. Nebo jo, ale ne moc. A ne komedii, ta je pak naivní. Co vybereš ty?",
  ],
};

export default vahy;
