// AstroRoast.ai: Lev, původní české texty varianty Codex.
// RawSign: index 0 = úroveň 1; pět úrovní od pohlazení po kosmickou nadsázku.
// h: 3 titulky na úroveň; c: 2 hlavní věty na úroveň; v: 2 verdikty na úroveň.
// t: témata vztahy, prace, zivot, pratele, narozeniny; každé má 5 úrovní po přesně 4 větách.
// s: 6 falešných statistik [popisek, krátká hodnota]; d: 24 denních vět bez skutečných předpovědí.
// q: 6 párových replik v pořadí COUPLE_SITUATIONS z shared.ts.
// Věty oslovují ve druhé osobě bez určení rodu; párové repliky mluví za znamení.
// Terčem je pouze stereotyp Lva: velkorysost, okázalost a chuť být středem pozornosti.

import type { RawSign } from "../../types";

const lev: RawSign = {
  h: [
    [
      "Umíš zvednout náladu. I obyčejný pozdrav má u tebe slavnostní verzi.",
      "Rozdáváš povzbuzení tak štědře, že u tebe má i drobný úspěch slavnostní den.",
      "Díky tobě má každý den trochu slavnostnější osvětlení.",
    ],
    [
      "Přicházíš nenápadně. Jen ještě počkáš, až si toho všichni všimnou.",
      "Ke každému „není zač“ si v duchu přidáš drobnou děkovačku.",
      "Na skupinovou fotku si stoupneš tam, kde podle tebe začíná skupina.",
    ],
    [
      "Pozornost si nevynucuješ. Pouze hlídáš její správné rozdělení směrem k sobě.",
      "Cizí úspěch oslavíš. Zvlášť když se do něj podaří vepsat tvoji zásluhu.",
      "Při slově „skromnost“ počkáš na podrobnější vysvětlení, co z toho máš.",
    ],
    [
      "V rozhovoru zabereš tolik místa, že druhému zbude jen tlačítko souhlasu.",
      "Chceš spontánní obdiv. Scénář rozešleš včas.",
      "Z obyčejného příchodu uděláš událost, po které i dveře potřebují přestávku.",
    ],
    [
      "Černé díře posíláš reklamaci: všechno přitahuje a ani tě nezmíní.",
      "Na úřadě pro galaxie chceš kolonku „ostatní“ přejmenovat na „moje publikum“.",
      "Na tvůj slavnostní příchod už má i časoprostor natažený koberec.",
    ],
  ],
  c: [
    [
      "Umíš druhé povzbudit tak, že si troufnou na víc. Malou děkovnou řeč si klidně necháš líbit.",
      "Když někomu věnuješ pozornost, dáváš jí plnou náruč. Včetně drobného slavnostního uvedení.",
    ],
    [
      "Pochvalu přijímáš s lehkostí. Jen ji ještě chvíli podržíš ve vzduchu, aby ji slyšel celý stůl.",
      "I při obyčejném vyprávění poznáš, kde má být dramatická pauza. Obvykle před tvým jménem.",
    ],
    [
      "O sobě mluvíš pouze tehdy, když je to k tématu. Téma průběžně upravuješ.",
      "Prostor dáváš všem stejně. Každý má právo říct, co se mu na tobě líbí.",
    ],
    [
      "Obyčejné „dobře“ od tebe odchází s požadavkem na přepracování. Chybí mu ovace a nejméně tři vykřičníky.",
      "Na každou svou maličkost pořádáš premiéru. I zavření šuplíku u tebe čeká na schválení červeného koberce.",
    ],
    [
      "Kolem svého „mimochodem“ stavíš soustavu planet. Na nejvzdálenější se pořád čeká, až dokončíš větu.",
      "Žádáš mezihvězdný úřad o výhradní právo zářit. Hvězdám zatím dovoluješ svítit jen po označení tvého autorství.",
    ],
  ],
  v: [
    [
      "Máš dar udělat z povzbuzení malou slavnost. Stužku si můžeš nechat.",
      "Dáváš věcem jiskru. Občas k ní přidáš i uvítací fanfáru.",
    ],
    [
      "S pochvalou se spokojíš. Jakmile dostane dostatečně slavnostní úvod.",
      "Umíš být nenápadně výrazně v popředí.",
    ],
    [
      "Názory přijímáš svobodně. Obdiv má zrychlené odbavení.",
      "O skromnost se poctivě dělíš. Všechna zbývající místa přenecháš ostatním.",
    ],
    [
      "I z tlačítka „přeskočit úvod“ dokážeš udělat žádost o přídavek.",
      "Chceš mít poslední slovo, jeho reprízu a potlesk za výslovnost.",
    ],
    [
      "Svou skromnost eviduješ jako souhvězdí. Viditelné ze všech vesmírů.",
      "Za tvou nenápadnost uděluje galaxie cenu. Předáváš si ji z oběžné dráhy.",
    ],
  ],
  t: {
    vztahy: [
      [
        "Umíš dát najevo náklonnost i drobností. Jen tu drobnost občas doručíš se slavnostní mašlí.",
        "Ve dvou umíš oslavit i povedenou snídani. Obyčejný toust u tebe konečně něčeho dosáhne.",
        "Když na někom záleží, umíš se za něj postavit. A případný potlesk poctivě rozdělíš.",
        "Dokážeš říct hezkou věc tak, že zní jako věnování v knize. I když jde jen o výběr čaje.",
      ],
      [
        "Společný večer plánuješ pro dva. Jen úvodní přivítání s tebou zabere o trochu víc času.",
        "Na rande ti stačí dobrá společnost. Pochvalu bereš jako milý předkrm.",
        "Při společné fotce řešíš, aby vynikla vaše láska. A aby ji moc nezakryl druhý člověk.",
        "Po romantickém gestu se nenápadně zeptáš, která jeho část byla nejromantičtější.",
      ],
      [
        "Ve vztahu uznáváš rovnocennost. Jeden vyjadřuje obdiv a ty dbáš na jeho přijetí.",
        "Zájem o druhou stranu projevuješ otázkou, jak se jí s tebou žije. Výsledky očekáváš pochvalné.",
        "Zpětnou vazbu ve vztahu vítáš. Formulář obsahuje kolonky „skvělé“ a „rozvést, proč skvělé“.",
        "Romantiku si představuješ jako překvapení. Přesný postup včetně vhodné reakce máš v poznámkách.",
      ],
      [
        "Z výročí uděláš přehlídku svých zásluh. Druhá strana má čest držet transparent.",
        "Při hádce chceš prostor pro oba názory: svůj původní a svůj ještě důraznější.",
        "Ke slovům „miluju tě“ vyžaduješ rozšířenou verzi s komentářem ke každé tvé přednosti.",
        "Ve vztahu režíruješ i mlčení. Druhá strana má předepsáno, jak obdivně má při něm působit.",
      ],
      [
        "Na výročí si necháváš přistavit Saturn. Prstence přepásáš stuhou „Za společné chvíle se mnou“.",
        "Žádáš Venuši o potvrzení, že láska hory přenáší. Tu svoji chceš přesunout, aby nezacláněla tvé korunovaci.",
        "Do společné domácnosti přidáváš černou díru na nedostatečně nadšené reakce. I její ozvěnu posíláš na zkoušku.",
        "Svému milostnému příběhu rezervuješ souhvězdí. Druhé straně v něm přidělíš čestné místo v seznamu poděkování.",
      ],
    ],
    prace: [
      [
        "Umíš nadchnout tým pro nový nápad. I poznámkový blok si při tom připadá jako začátek něčeho velkého.",
        "Za dobrou práci umíš pochválit nahlas. Občas tak nahlas, že si přijde pro uznání i vedlejší oddělení.",
        "Dodáš prezentaci odvahu a švih. Odrážky u tebe konečně dostanou důstojné uvedení.",
        "Při společném úspěchu umíš poděkovat všem. Závěrečnou fanfáru si zatím obstaráš v duchu.",
      ],
      [
        "Odevzdáš úkol a chvilku zůstaneš poblíž. Třeba se bude ještě slavnostně přebírat.",
        "Na poradě máš krátký příspěvek. Délku potlesku už necháváš na týmu.",
        "Do pracovního podpisu přidáš jen to podstatné. Zbytek zásluh se nevejde pod čáru.",
        "Při sdílení výsledku nenápadně zvětšíš své jméno. Ať ho tým nemusí hledat.",
      ],
      [
        "Týmovou práci poznáš podle toho, že ti za ni děkuje víc lidí.",
        "Připomínky k prezentaci přijímáš do posledního snímku. Ten s tvými zásluhami je už uzavřený.",
        "Poradu zakončíš otázkou, jestli má někdo něco k dodání. Shrnutí tvého přínosu se počítá.",
        "Na úkolu ti záleží od začátku do konce. Zejména na části, kde se uvádí, kdo za ním stojí.",
      ],
      [
        "Tým ti pomůže s úkolem a ty mu za odměnu dovolíš sledovat, jak za něj přebíráš ovace.",
        "Z běžného pracovního hlášení uděláš vlastní medailonek. Termín dodání zmíníš jako drobnou zajímavost z natáčení.",
        "Za odepsání „beru na vědomí“ očekáváš firemní plaketu. Za otevření přílohy už hledáš místo ve vitríně.",
        "Na poradu přineseš tolik vlastní důležitosti, že pro program musí firma pronajmout vedlejší zasedačku.",
      ],
      [
        "Na pracovní výkaz potřebuješ další galaxii. V té první zabírá všechny sloupce tvoje „osobní přispění“.",
        "Mezihvězdnému týmu rozdáš úkoly: Merkur píše, Saturn počítá a ty přidáváš své jméno na vesmír.",
        "Do hodnocení žádáš kolonku „přesah do dalších dimenzí“. Běžné „splňuje očekávání“ ti ponižuje časoprostor.",
        "Za svůj pracovní přínos si vyžádáš planetu. Po převzetí reklamuješ nedostatek míst, odkud je vidět tvoje jméno.",
      ],
    ],
    zivot: [
      [
        "Umíš si udělat hezký den i bez zvláštního důvodu. Nový hrnek u tebe dostane malé slavnostní odhalení.",
        "Běžným věcem dodáváš šmrnc. I poznámka na lednici od tebe vypadá jako pozvánka.",
        "Dovedeš se nadchnout pro maličkost a nadšení šířit dál. Třeba kvůli poličce, která už konečně drží.",
        "Umíš si vychutnat povedený okamžik. Jen mu občas dopřeješ ještě jednu čestnou reprízu.",
      ],
      [
        "Při cestě pro pečivo vybíráš správnou náladu pro svůj příchod. Rohlíky mají štěstí, že jsi dnes tady.",
        "I oznámení „jdu ven“ podáš tak, že se sluší nabídnout doprovodný program.",
        "Vlastní příspěvek si přečteš ještě jednou. Je příjemné narazit na někoho s tak dobrým postřehem.",
        "Když se otevřou automatické dveře, na okamžik to přijmeš osobně. Hezké přivítání, děkuješ.",
      ],
      [
        "Když tě dveře do výtahu nenechají dokončit nástup, považuješ to za nedostatek vychování.",
        "Den bez zmínky o sobě považuješ za organizační nedostatek. Nápravu zvládneš jednou větou.",
        "Vlastní příběh vyprávíš objektivně. Všechno, co není o tobě, vyhodnotíš jako odbočku.",
        "Pauzu od pozornosti dodržuješ poctivě. Pak o ní zveřejníš podrobné shrnutí.",
      ],
      [
        "Při příchodu domů čekáš uvítání tak velkolepé, že rohožka začne litovat nápisu „Vítej“.",
        "Z vynesení tříděného odpadu uděláš tři dějství. Plast odejde dřív, než se dostaneš k zásluhám.",
        "I vlastní ozvěnu přerušuješ, protože ti skáče do závěrečné pointy.",
        "Žádáš tolik uznání za běžné úkony, že i uložení souboru čeká, jestli po něm nebude tisková konference.",
      ],
      [
        "Na světelný rok podáš stížnost: tvoje sláva podle tebe potřebuje rychlejší doručování.",
        "Z obyčejného vstupu do kuchyně uděláš galaktickou událost. Mléčná dráha kvůli tobě stojí v řadě na akreditaci.",
        "Zrcadlo si pověsíš za horizont událostí. I v nedostupné části vesmíru chceš mít zajištěnou pozornost.",
        "Na černé díře zkoušíš dramatickou pauzu. Prostor se ohne, čas se zastaví a ty čekáš, jestli už je to dost o tobě.",
      ],
    ],
    pratele: [
      [
        "Umíš partě dodat odvahu něco podniknout. I obyčejná procházka díky tobě dostane slavnostní start.",
        "Úspěch přátel umíš oslavit naplno. Kytici předáš i bez toho, aby ti někdo předem zajistil pódium.",
        "Když se někdo drží stranou, umíš ho přizvat do hovoru. A předat slovo s pořádnou fanfárou.",
        "Dokážeš přátelům připomenout, v čem jsou dobří. Tvoje pochvala se do malé zprávy skoro nevejde.",
      ],
      [
        "Ve skupinové konverzaci přidáš fotku i k obyčejnému „dorazím“. Ať má ta informace důstojný doprovod.",
        "Při vyprávění přátel trpělivě čekáš na mezeru. Máš do ní připravenou maličkost o sobě.",
        "Výlet s partou plánuješ demokraticky. Na titulní fotku už máš ovšem docela jasnou představu.",
        "Když tě parta pochválí, ze slušnosti neodmítneš podrobnosti.",
      ],
      [
        "Přátelům dáváš prostor vyprávět. Výborně se při tom sbírá materiál pro tvoje „to já jednou“.",
        "Když parta řekne „pojďme změnit téma“, přesuneš se od svých úspěchů ke svým plánům.",
        "Společné vzpomínky udržuješ čerstvé. Pravidelně připomínáš ty, kde vynikáš.",
        "V partě prosazuješ rovnost. Každý dostane stejnou příležitost vyjádřit ti uznání.",
      ],
      [
        "Z kamarádského posezení uděláš přehlídku svých historek. Ostatním rozdáš čestná místa mezi tvými souvětími.",
        "Zatímco parta plánuje sraz, ty už máš připravený proslov o tom, jak je hezké, že se všichni sešli kvůli tobě.",
        "Do skupiny pošleš „co je nového?“ a hned tři stránky přílohy, aby nikdo nemusel měnit téma směrem od tebe.",
        "Když tě přátelé na fotce označí, zvažuješ, jestli jejich přítomnost není zbytečně velký vodoznak.",
      ],
      [
        "Partě založíš souhvězdí. Sobě přidělíš všechna jasná místa, ostatním čestnou funkci tmavého pozadí.",
        "Na společnou fotku přisuneš Mléčnou dráhu. Pak ji ořízneš, protože vedle tebe zbytečně odvádí pozornost.",
        "Založíš meziplanetární skupinu přátel a všem vypneš posílání zpráv. Saturn smí výjimečně připojit potlesk.",
        "Přátelské „někdy zas“ vezmeš jako objednávku turné po galaxiích. Každé civilizaci pošleš seznam svých přídavků.",
      ],
    ],
    narozeniny: [
      [
        "Umíš oslavit další rok tak, že si večer užijí i hosté. Dortu přidělíš důstojné slavnostní místo.",
        "Na narozeninách máš dar propojit lidi. Jen jim při příchodu trochu obřadně ukážeš, kam s přáním.",
        "Každé přání umíš přijmout s vděkem. To obzvlášť hezké si necháš přečíst ještě jednou.",
        "O radost se umíš rozdělit velkým kusem dortu. Úvodní slovo si pro jistotu podržíš.",
      ],
      [
        "Narozeniny připomeneš s předstihem. Je příjemné dopřát okolí čas na promyšlený obdiv.",
        "Ke svíčkám přidáš malou pauzu, aby se všichni stihli nachystat na tvůj okamžik.",
        "Přání si schováš na památku. Oceníš, když památka obsahuje pár konkrétních superlativů.",
        "Oslavu necháváš volně plynout. Jen část s tebou u dortu má pevný začátek a dvě opakování.",
      ],
      [
        "Přání k narozeninám nehodnotíš. Jen si všímáš, kdo si s tvými přednostmi dal práci.",
        "Na oslavě chceš hlavně pohodu. Konkrétní podobu tvého ústředního okamžiku ale pohoda neurčuje.",
        "Dort rozděluješ spravedlivě. Každý dostane dílek a příležitost říct o tobě pár slov.",
        "Oslavu bereš jako setkání blízkých. Seznam blízkých průběžně upřesňuješ podle času doručeného přání.",
      ],
      [
        "Na narozeniny chceš jen maličkost: aby si kalendář ostatních na týden změnil název na tvé jméno.",
        "O narozeninách očekáváš takový obdiv, že i přání na dortu musí předložit zdůvodnění, proč je tak stručné.",
        "Z přání „všechno nejlepší“ uděláš reklamaci. Prý tam zbývá dost místa na konkrétní zásluhy.",
        "Po oslavě rozešleš poděkování hostům. Má podobu osnovy, ve kterých místech mohl jejich obdiv příště lépe gradovat.",
      ],
      [
        "K narozeninám chceš zatmění Slunce. Aspoň na chvíli podle tebe nebude nic odvádět pozornost od dortu.",
        "Na galaktický úřad neseš návrh, aby se věk vesmíru odteď počítal podle tvých oslav. Před tebou prý nebylo co slavit.",
        "Na dort si objednáš svíčky z hvězd. Pak reklamuješ souhvězdí, protože přání nevypsalo tvoje přednosti dost čitelně.",
        "Kvůli narozeninám necháš časoprostor složit do harmoniky. Takhle se ti mezi dvě oslavy vejde jen nezbytné poděkování.",
      ],
    ],
  },
  s: [
    ["Pauza na zasloužený obdiv", "8 s"],
    ["Přirozených středů skupinové fotky", "1"],
    ["Obyčejných příchodů bez premiéry", "2 %"],
    ["Přídavků k větě „to nic nebylo“", "7"],
    ["Vykřičníků ve tvé ideální pochvale", "12"],
    ["Témat hovoru s odbočkou k tobě", "9 z 9"],
  ],
  d: [
    "Dnes máš pro skromnost vyhrazený čas. Mezi uvedením programu a první děkovačkou.",
    "Dneska bereš automatické otevření dveří jako zaslouženou úctu. Konečně zařízení s vychováním.",
    "Dnes ti k dobré náladě stačí maličkost. Třeba nenápadné „mimochodem, bez tebe by to nešlo“.",
    "Dneska do skupiny píšeš „jen krátce“. Ke své krátkosti přidáváš i slavnostní úvod.",
    "Dnes máš při slově „pochvala“ výborný postřeh. U slova „drobná“ už navrhuješ větší rozsah.",
    "Dneska i poslední tečce ve své zprávě dopřáváš prostor na potlesk.",
    "Dnes si zkoušíš nenápadný příchod. Zatím ti při něm překáží potřeba všechny přivítat u sebe.",
    "Dneska o sobě mluvíš jen v souvislostech. Souvislost máš pro jistotu připravenou ke každému tématu.",
    "Dnes bereš nabídku „můžeš si přidat“ jako výzvu k další historce. Šlo o brambory.",
    "Dneska dáváš ostatním prostor zazářit. Z místa, odkud tě pořád dobře vidí.",
    "Dnes máš v poznámkách slovo „spontánně“. Pod ním podrobný program včetně vhodných reakcí.",
    "Dneska na otázku „jak se máš?“ nabízíš i slavnostní rozšířenou verzi. Bez vyžádání.",
    "Dnes povyšuješ malý úspěch na významnou událost. I správně zavřená dóza má nárok na uznání.",
    "Dneska přijímáš komplimenty v běžném režimu. Potvrzení přijetí ale obsahuje žádost o upřesnění.",
    "Dnes chceš sdílet radost. Hlavně tu část, kde tě za ni ostatní chválí.",
    "Dneska v hledání středu skupinové fotky postupuješ intuitivně. Prostě začneš od sebe.",
    "Dnes přidáváš do hovoru drobnost o sobě. Po třetím dějství už drobnost vyžaduje přestávku.",
    "Dneska bereš tlačítko „to se mi líbí“ jako stručný první návrh. Odůvodnění patří do komentářů.",
    "Dnes si doma děláš příjemné osvětlení. I nenápadnost má u tebe nárok na vlastní reflektor.",
    "Dneska si vlastní hlasovou zprávu pouštíš znovu. Tak poutavému vyprávění se přece neskáče do řeči.",
    "Dnes na zprávu „dorazíš?“ odpovídáš, jako by se právě otevíral slavnostní večer.",
    "Dneska zkoušíš dělat věci jen pro sebe. O průběhu pro jistotu informuješ všechny.",
    "Dnes máš s vesmírem jasno: hvězdy jsou pěkné, ale s označením autorství se pořád mají co učit.",
    "Dneska si dáváš pauzu od pozornosti. Oznamuješ ji včas, ať u toho nikdo nechybí.",
  ],
  q: [
    "Někam, kde jídlo přinesou pod poklopem. Líbí se mi, když i brambory pochopí důležitost nástupu.",
    "Uspořádáme malou slavnost bez zvláštního důvodu. Já tam přece budu, důvod se nějak najde.",
    "Odepíšu „děkuju“ a nechám chvilku pauzu. Třeba ještě píšou konkrétně, co na mně oceňují.",
    "Já myju. Jen mi neodnášej talíře, dokud si nevšimneš, jak hezky se lesknou.",
    "Někam se slavnostním uvítáním. Potřebuju vědět, že můj příjezd někdo bere stejně vážně jako já.",
    "Pustíme si něco bez dlouhého úvodu. Ten si obstarám při vysvětlování, proč je můj výběr výborný.",
  ],
};

export default lev;
