// AstroRoast.ai: knihovna humoru, znamení lev. Varianta "skills" (Sonnet 5.5 s psacími skilly).
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

const lev: RawSign = {
  h: [
    [
      "Lev vejde do místnosti a lustry se samy narovnají.",
      "Lev rozdává úsměvy, pozornost a poslední kousek dortu. Svůj si vzal dřív, ale s láskou.",
      "Umíš rozsvítit celou místnost. Hvězdy jen prosí, ať to není ve tři ráno.",
    ],
    [
      "Lev není domýšlivý. Jen vstupuje do místnosti tak, aby ho stihli všichni vidět.",
      "Tvoje vstupy do místnosti mají vlastní znělku. Ostatní ji neslyší, ale poznají ji.",
      "Pozornost je tvoje oblíbené jídlo. Přídavek si bereš, než ostatní dojedí první porci.",
    ],
    [
      "Lev miluje, když se o něm mluví. Když se nemluví, vyvolá o tom diskusi.",
      "Sebevědomí máš na dva jeřáby. Skromnost čeká v rohu, protože ji nikdo nepředstavil.",
      "Nafotíš dvacet selfie, odešleš to jedenácté. Je stejné jako první, ale jedenácté má váhu.",
    ],
    [
      "Lev se nikdy neptá „co si o tom myslíš?“. Ptá se „jak jsem v tom vypadal?“.",
      "Jsi jako Slunce: bez tebe by byla tma, ale v poledne se na tebe nedá dívat.",
      "Pokora u tebe znamená, že ostatním dovolíš stát v záběru. Na okraji, ale ve výřezu.",
    ],
    [
      "Slunce prý žádá o výpověď. Důvod: nemůže zářit, když uprostřed stojí někdo a mává.",
      "Nový nejjasnější objekt na obloze? Astronomové zjistili, že je to Lev při focení.",
      "Lev uspořádal vlastní supernovu. Přišlo málo hostů, tak ji o týden později zopakoval.",
    ],
  ],
  c: [
    [
      "Umíš zazářit tak, aby se vedle tebe hřálo i ostatním. To je vzácný druh charismatu.",
      "Máš velkorysost, smích a špetku dramatu. V davu tě najdou i bez brýlí.",
    ],
    [
      "Nejlíp sedíš uprostřed. V autě, na pohovce i na fotce. Jinak vypadá celý den nakřivo.",
      "Chválu bereš jako host u švédských stolů: slušně, nahlas a znovu.",
    ],
    [
      "Skromnost je tvoje silná stránka. Mluvíš o ní osm minut denně, vždy s příkladem z vlastního života.",
      "Když tě někdo pochválí, přikývneš. Když nepochválí, počkáš, až si to rozmyslí. Počkáš hlasitě.",
    ],
    [
      "Publikum nepotřebuješ. Jen ho pro jistotu nosíš s sebou, jako náhradní nabíječku.",
      "Tvoje představa o skromnosti: zlatá medaile s nápisem „Nejskromnější z přítomných“.",
    ],
    [
      "Planety se při tvém příchodu řadí do špalíru. Ne z úcty. Jen se bojí, že hned zazní proslov.",
      "Galaxie ti uspořádala přijetí. Skončilo dřív, protože hlavní host přednesl úvodní slovo k vlastní osobě.",
    ],
  ],
  v: [
    [
      "Verdikt: tam, kde svítíš ty, je teplo. Jen občas přibal slunečník pro ostatní.",
      "Hvězdy radí: svítit je skvělé. Občas přepni na baterku, ať se ostatní taky vidí.",
    ],
    [
      "Rada hvězd: dnes zkus nejdřív poslouchat. Je to jako stát v pozadí, ale s pocitem hrdinství.",
      "Verdikt: velkorysost, hlasitost a nepostradatelnost. Aspoň jednu z nich zkus dnes vypnout.",
    ],
    [
      "Verdikt: svět ti leží u nohou. Jen se zdá, že čeká, až dokončíš větu.",
      "Rada: po vtipu nech pět vteřin ticha. Uvidíš, kdo se opravdu směje.",
    ],
    [
      "Verdikt: hlavní role potvrzena. Ostatní o ní zatím nedostali scénář ani pozvánku.",
      "Rada hvězd: nech ostatním aspoň vedlejší role. Zvládnou je a ještě ti zatleskají.",
    ],
    [
      "Verdikt vesmíru: pozornost zasloužená, délka proslovu nikoli.",
      "Rozsudek: jeden večer v hledišti, poslední řada, výhled na sloup, bez mikrofonu.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Ve vztahu svítíš jako Slunce: hřeješ, rozdáváš a všichni se vyhřívají. Jen partner si pro jistotu nosí sluneční brýle.",
        "Překvapení, která plánuješ, jsou tak velkolepá, že partner má radost už z pozvánky. A trochu trému z příjezdu.",
        "Lásku dáváš najevo tak, že to ví celý dům. A sousedé. A kus ulice.",
        "S tebou je každé výročí svátek. Kalendář si ho zapisuje sám, pro jistotu červeně.",
      ],
      [ // úroveň 2
        "Na rande vybereš restauraci s dobrým světlem. Pro atmosféru, samozřejmě. Že je to světlo i na tvoje fotky, je shoda okolností.",
        "Partner tě nechává vést. Mohl by se ptát, ale už ví, že odpověď bude „já, samozřejmě“.",
        "Dárek pro partnera vybíráš s láskou a tichou nadějí, že ten příští dostaneš ve stejně velké krabici.",
        "Vyznání lásky zní u tebe jako úvodní scéna filmu. Partner pozorně čeká, jestli bude druhé dějství i pro něj.",
      ],
      [ // úroveň 3
        "Říkáš partnerovi, že je tvoje všechno. Hlavně ve chvílích, kdy potřebuješ někoho, kdo vydrží tleskat nejdéle.",
        "Ve vztahu je místo pro dva. Ty se v něm roztahuješ tak velkoryse, že partner dostal roli s jednou větou: „Výborně.“",
        "„Nemusíš mi nic kupovat.“ Říkáš to tónem, jakým se ve filmech říká „bomba vybuchne ve tři“.",
        "Tvoje „já nežárlím“ má jednu zvláštnost: předchází mu dvacet minut o tom, kdo se na partnera včera díval.",
      ],
      [ // úroveň 4
        "Tvoje oblíbená otázka na rande: „A co ty si myslíš… o mně?“",
        "Kritiku partnera bereš jako recenzi inscenace: autor se pochopitelně mýlí, ale aspoň píše o tobě.",
        "Hádka s tebou má tři dějství. V posledním přijde omluva, kterou musí přednést někdo jiný.",
        "Na společné fotce z rande máš dvacet pokusů. Partner na ní vypadá jako stativ, který ti drží světlo.",
      ],
      [ // úroveň 5
        "Venuše vypověděla spolupráci. Prý má v soustavě příliš silnou konkurenci na hlavní roli ve vztazích.",
        "Když partner řekne „miluju tě“, ozve se Slunce: „Počkat, tohle je moje scéna.“ Případ řeší kosmická rada.",
        "Milenecké konstelace byly přejmenovány na „Lev a jeho pozadí“. Partner je ta slabě svítící hvězdička vpravo dole.",
        "Při tvém vyznání lásky se rozzáří pulsar. Astronomové zjistili, že jsi to ty, jak s úsměvem čekáš na potlesk.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci zapálíš celý tým. Nápady sypeš jako jiskry a najednou se ostatním chce ráno vstávat.",
        "Vést umíš přirozeně: lidé tě následují, i když zrovna nikam nejdeš. Kolegové tomu říkají charisma, ty tomu říkáš čtvrtek.",
        "Při prezentaci držíš sál v napětí. Kdyby měla porada tleskat, tleskala by přesně včas.",
        "Tvoje pochvaly mají kouzlo: kdo je dostane, pracuje další týden s úsměvem. Tebe to těší taky, což je fér.",
      ],
      [ // úroveň 2
        "Na poradě se ujímáš slova dřív, než zazní otázka. Kolegové tomu říkají „Lev už ví“.",
        "Po schůzce se kolegů ptáš, jak to z tebe vyznělo. Čekáš odpověď „skvěle“ a zpravidla ji dostaneš.",
        "Při týmovém obědě mluvíš nejvíc a nejlíp. Aspoň to tvrdí ten, kdo se ke slovu dostal jednou.",
        "Nástěnku s pochvalami čteš pro jistotu: jestli se tam někde neztratilo tvoje jméno.",
      ],
      [ // úroveň 3
        "Delegovat umíš skvěle: všechny úkoly zadáš ostatním a všechny zásluhy si nenápadně necháš.",
        "Slovo „tým“ používáš často. Hlavně těsně před slovy „díky mně“.",
        "Do životopisu píšeš „vedu“, „inspiruji“ a „tvořím vize“. Že to byla porada s kávou, nikdo nepozná.",
        "Kritiku v práci bereš jako nabídku k diskusi. K tvé diskusi, ve které zazní hlavně tvoje verze.",
      ],
      [ // úroveň 4
        "Ve firmě jsi jako maskot: všichni tě znají, nosíš barvu a nikdo přesně neví, co děláš.",
        "Každou prezentaci začínáš slovem „já“ a končíš větou „děkuji, že jste mi věnovali pozornost“.",
        "Nepracuješ pro tým. Tým pracuje pro tebe. V zápisu to nikdo neuvede, ale všichni to vědí.",
        "Tvůj e-mail s „krátkou otázkou“ má sedm odstavců. Pět z nich je o tvé roli v projektu.",
      ],
      [ // úroveň 5
        "Merkur zrušil schůzku s tebou. Důvod: nevydrží čekat, až se proslov dostane k bodu 2 z 94.",
        "V kosmickém rejstříku tě vedou jako „Hlavní zdroj světla a hluku“. Obě kolonky jsou vyplněny na plný výkon.",
        "Tvoji prezentaci vyslali na Voyager. Mimozemšťané odpověděli jediným slovem: „Další snímek ne.“",
        "Galaktická rada ti nabídla vedení Slunce. Slunce se odvolalo, odvolání ale přerušil tvůj úvodní proslov.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Žiješ ve velkém stylu. I obyčejný čtvrtek vypadá u tebe jako malá premiéra s dobrým osvětlením.",
        "Umíš z všedního dne udělat svátek. Lidé se rádi přidají, protože se u tebe dobře baví.",
        "Dobrá nálada ti naskočí dřív než ranní káva. Okolí je za to vděčné a trochu zaskočené.",
        "Kolem tebe se lidé usmívají sami od sebe. Kdo by se nechtěl hřát na slunci.",
      ],
      [ // úroveň 2
        "Když vejdeš do obchodu, prodavačka se instinktivně narovná. Nevíš proč, ale líbí se ti to.",
        "Svoje plány představuješ úvodním slovem a potleskem. Otázky jsou vítány, odpovídáš na ně dalším plánem.",
        "Cestou na zastávku si pouštíš hudbu z úvodních titulků. Tramvaj pak přijede jako zpožděný režisér.",
        "Zrcadlo ti kývne, když ho míjíš. Nebo si to aspoň myslíš. Tak či tak, den začíná skvěle.",
      ],
      [ // úroveň 3
        "Skromnost ti není cizí. Znáš ji z doslechu a z vlastních příspěvků o ní.",
        "Říkáš, že pozornost nepotřebuješ. Tónem, který slyší tři sta lidí, a v hlavní roli.",
        "Život ti všechno vrátí. Hlavně potlesk, který si na zálohu dáváš sám.",
        "Říkáš, že se slávou nenecháš unášet. Pak ráno natočíš tři příběhy o tom, jak se neunášíš.",
      ],
      [ // úroveň 4
        "Tvoje oblíbená slova: „mimochodem“, „já“ a „tohle bylo moje“.",
        "Kdyby měl tvůj život titulky, každá minuta by začínala „Představujeme hlavní hvězdu“.",
        "Potřebuješ publikum tak moc, že když se nikdo nedívá, aspoň o tom natočíš dokument.",
        "Na komplimenty máš paměť lepší než cloud. Kritika se tam nikdy nenahraje, chybí jí oprávnění.",
      ],
      [ // úroveň 5
        "Slunce navrhlo střídat se ve funkci středu soustavy. Odpověď: „Počkejte, zapíšu si to jako urážku.“",
        "Astronomové pozorují supernovu. Je to tvoje ranní pózování před zrcadlem. Je vidět až z Andromedy.",
        "Černá díra pohltila světlo. Tvůj komentář: „Konečně někdo, kdo mi nekonkuruje.“ Černá díra se urazila.",
        "Při tvém narození prý kometa zpomalila. Vesmír dodnes neví, jestli se tě bála, nebo chtěla autogram.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Pro přátele jsi domov: s tebou se jede na výlet, do divadla a v nouzi i na návštěvu bez ohlášení.",
        "Tvojí zásluhou se parta schází častěji. Bez tebe by se plánovalo do příštího jara.",
        "Tvůj smích rozjede každou hodinu. I tu, ve které se parta chystala domů.",
        "Když má kamarád problém, nabídneš radu, objetí i večeři. Nikdo od tebe neodchází s prázdnýma rukama.",
      ],
      [ // úroveň 2
        "Ve skupinovém chatu píšeš nejvíc. Ostatní to berou jako veřejnou službu. Tobě to připadá jako koncert.",
        "Na rozloučenou pronášíš proslov, který je o něco delší než samotná oslava.",
        "Při výběru restaurace prohlásíš, že ti je to jedno. Pak vybereš nejvýznamnější podnik ve městě, se stolem uprostřed.",
        "Přátelé tě milují. Jen si občas všimnou, že se téma konverzace nezvykle často stáčí k tobě. Ale mile.",
      ],
      [ // úroveň 3
        "Pozvat tě na oslavu je pocta. Pozvat tě na cizí oslavu je riziko, že se z ní stane tvoje.",
        "Do cizích rozhovorů vstupuješ s lehkostí a neodcházíš, dokud se téma nestočí k tobě.",
        "Kamarádovi popřeješ k úspěchu. Pak se zeptáš, jestli už viděl tvoje fotky z včerejška.",
        "Skupinová fotka je pro tebe závod. Vyhráváš ho pokaždé: stojíš uprostřed a zůstaneš tam o půl minuty déle.",
      ],
      [ // úroveň 4
        "Přátelé ti vždycky řeknou, že to bylo skvělé. Vědí totiž, co by se stalo, kdyby ne.",
        "Když se ti kamarád svěří, poradíš mu. Pak následuje příběh, kdy se stejná věc stala tobě. A dopadla líp.",
        "Tvoje oblíbené téma při setkání s přáteli: ty. Druhé oblíbené: jak ti všichni závidí.",
        "Při gratulaci kamarádovi je tvoje část nejdelší. Oslavenec se stane hostem na tvém vystoupení.",
      ],
      [ // úroveň 5
        "Parta kamarádů se přesunula do vedlejší galaxie. Důvod: v té tvé je moc světla a málo místa pro ostatní.",
        "Satelit sleduje tvoje večeře s přáteli. Zaznamenal, že 94 % času zabírá slovo „já“. Zbytek je „díky“.",
        "Kamarádi ti postavili pomník na vedlejší planetě. Nápis: „Tady už se nikdo nedostal ke slovu.“",
        "Mléčná dráha pořádá sraz přátel. Ty pořádáš vlastní, větší, ve stejnou dobu. S dortem.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš s radostí a všichni se přidají. Je to jako když se rozsvítí lustr, jen s dortem.",
        "Umíš udělat z cizích narozenin skvělou párty. Kamarádi se k ní po letech vracejí v myšlenkách.",
        "Dárek vybíráš s láskou, takže každý ví, že na něm záleží. A že krabice byla velká.",
        "Na tvých oslavách je hudba, světýlka a hosté, kteří se smějí ještě doma.",
      ],
      [ // úroveň 2
        "Narozeniny začínáš slavit týden předem. Aby se nikdo nemohl vymluvit, že nevěděl.",
        "Přání dostáváš celé dopoledne a každému odpovídáš zvlášť, osobně, s emotikonem. Je to docela pracovní den.",
        "Dort musí být tak velký, aby ho viděl i soused. Jíst se začne až po proslovu.",
        "Společná fotka se opakuje, dokud nesedí světlo. Dort mezitím aspoň stihne vychladnout.",
      ],
      [ // úroveň 3
        "Narozeniny jsou jediný den, kdy skromnost bere dovolenou. Zbytek roku bere jen krátké pauzy.",
        "Přání od ostatních čteš nahlas. Pro jistotu, kdyby někdo přehlédl, jak velká je tvoje popularita.",
        "Řekneš: „Nic nechci, hlavně mě nepřekvapujte.“ Pak týden každému naznačuješ barvu, velikost a značku.",
        "Na narozeniny pozveš deset lidí. Přijde třicet, protože se to rozneslo tvými příspěvky.",
      ],
      [ // úroveň 4
        "Oslava se koná u tebe, v tvůj čas a podle tvého scénáře. Hosté jsou statisté s dobrým jídlem.",
        "Přání, která dostaneš, počítáš. Když jich je málo, napravíš to dalším příspěvkem.",
        "Při sfouknutí svíček čekáš ticho, potlesk a ideálně kameramana z televize.",
        "Dárky hodnotíš podle velikosti krabice. Malá krabice u tebe vyvolá výraz, kterým by se dala zastavit pošta.",
      ],
      [ // úroveň 5
        "NASA každé jaro vyhlašuje stav pohotovosti: blíží se tvoje narozeniny. Oběžné dráhy se předem uvolňují pro ohňostroj.",
        "Při sfouknutí svíček prý zhasla polovina souhvězdí. Slunce reklamovalo, že tohle je jeho exkluzivní práce.",
        "Kosmické úřady zavedly kalendář: 364 dní roku a jedny narozeniny Lva. Ty poslední trvají tři týdny.",
        "Tvůj dort má tolik svíček, že družice hlásí požár na Zemi. Hasiči přijedou a ty od nich vyžaduješ potlesk.",
      ],
    ],
  },
  s: [
    ["Selfie před vybráním toho jediného", "20"],
    ["Úspěšnost fotek „bez filtru“", "0 %"],
    ["Rozhovorů, které se stočí k tobě", "97 %"],
    ["Pravdivost věty „to byla ironie“", "4 %"],
    ["Příspěvků o skromnosti", "12"],
    ["Potlesku, který ti stačí", "∞"],
  ],
  d: [
    "Dnes tě někdo pochválí. Přijmeš to jako samozřejmost a hned se zeptáš na další kolo.",
    "Slunce ti dnes posílá paprsek. Ostatní planety dostanou jen odraz.",
    "Dnes ti někdo skočí do řeči. Hvězdy svolávají mimořádné zasedání.",
    "Dnešní konstelace: ty uprostřed, ostatní kolem. Kalendář si to bere osobně.",
    "Dnes ti pozornosti přijde málo. Hvězdy doporučují přidat si vlastní.",
    "Dnes ti někdo vynese chválu. Odpovíš „já vím“. A bude to skoro pravda.",
    "Dnes pošleš selfie z nejlepšího úhlu. Hvězdy už všechny tvoje úhly zdokumentovaly.",
    "Dnes tě čeká důležité setkání. Hvězdy doufají, že tam bude i někdo jiný než ty.",
    "Dnešní tip: nech někoho jiného doříct větu do konce. Je to nové a překvapivě zajímavé.",
    "Dnes budeš mít skvělou náladu a zbytek světa se podle toho zařídí. Nebo aspoň přikývne.",
    "Dnes ti dojde, že máš pravdu. Poprvé od včerejška. Slavíš s úsměvem.",
    "Dnešní varování: kdyby ti připadalo, že kolem nikdo není, podívej se do zrcadla. Publikum je tam.",
    "Dnes u kávy řekneš, že skromnost je tvoje silná stránka. Pak o tom budeš mluvit čtvrt hodiny.",
    "Dnes zkusíš sednout do poslední řady. Vydržíš to do první přestávky a pak se přesadíš dopředu.",
    "Dnes někdo vysloví tvoje jméno ve vedlejší místnosti. Přijdeš zjistit, co přesně se o tobě říkalo.",
    "Dnes narazíš na zrcadlo na neobvyklém místě. Hvězdy neručí, kolik času u něj strávíš.",
    "Dnes dostaneš kompliment bez vynucování. Zapiš si to červeně, je to vzácný jev.",
    "Dnes napíšeš zprávu, ve které se slovo „já“ objeví jen čtyřikrát. Osobní rekord a důvod k oslavě.",
    "Dnes se tě někdo zeptá, jak se máš. Odpověď bude mít úvod, rozvinutí a pointu.",
    "Dnes si u dveří uděláš pauzu před vstupem. Ne z nervozity. Ať se všichni stihnou otočit.",
    "Dnes vyfotíš oběd. Pak se rozhodneš, že hlavní motiv bude stejně tvůj obličej. Jídlo se nezlobí.",
    "Dnes se na poradě rozhodne spousta věcí bez tebe. Slunce ti pošle povzbuzení, ale jen jednovětné.",
    "Dnes dostane pochvalu někdo jiný. Dýchej zhluboka. Potlesk potrvá jen tři minuty.",
    "Dnes zaplatíš kávu. Do oběda o tom bude vědět celé oddělení a dvě sousední budovy.",
  ],
  q: [
    "Rezervace je na moje jméno. Nejlepší stůl, nejlepší výhled, nejlepší společnost. Mluvím o sobě.",
    "Víkend? Pořádám oslavu. Vstup máš zdarma. Hlavní hvězda je už zajištěna.",
    "Odpověď bude skvělá. Čekej. Ještě ji ladím, aby seděla k úvodním titulkům.",
    "Já nádobí nemyju, já řídím projekt. Ale když se najde dobrovolník, dostane potlesk.",
    "Tam, kde mě pozná personál. A kde u vchodu visí moje fotka.",
    "Něco, kde je hlavní hrdina charismatický, odvážný a trochu mi podobný. Podle toho vybírám.",
  ],
};

export default lev;
