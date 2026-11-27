// AstroRoast.ai: knihovna humoru, znamení beran. Ručně psané originální české fragmenty.
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

const beran: RawSign = {
  h: [
    [
      "Beran: nadšení s nohama. Návod si přečte, až bude hotovo.",
      "Energie ti nechybí. Hvězdy jen řeší, kam ji uložit.",
      "Beran startuje první. V dnešní době je to vlastně hrdinství.",
    ],
    [
      "Slovo „počkej“ je pro Berana jen nezávazný návrh.",
      "Začínáš rychleji, než stihneš říct, co vlastně začínáš.",
      "Beran má na všechno plán. Většinou ho dopisuje za jízdy.",
    ],
    [
      "Máš 14 rozdělaných projektů a pevnou víru, že tenhle bude ten dokončený.",
      "Beran dokončí všechno. Teda všechno, co se dá stihnout do úterý.",
      "Tvoje trpělivost je jako slevová akce: teoreticky platí, prakticky ji nikdo nezažil.",
    ],
    [
      "Beran nedočte návod. Podle stavu nábytku je to znát.",
      "Tvoje „hned to udělám“ je nejdelší slib ve sluneční soustavě.",
      "Beran je důkaz, že rychlost bez cíle se dá prodávat jako osobnost.",
    ],
    [
      "Mars podal výpověď. Prý s tebou nestíhá ani on.",
      "Vesmír tě zařadil mezi věci „spouštět jen pod dozorem“. Dozor si vzal dovolenou.",
      "Tvoje netrpělivost je tak velká, že čas se do fronty ani nepostavil a šel domů.",
    ],
  ],
  c: [
    [
      "Jsi ten člověk, který rozjede každou párty, i když se nikdo neptal, jestli už je párty.",
      "Kdyby nadšení svítilo, Beran by měl vlastní elektrárnu.",
    ],
    [
      "Nadšení ti vydrží první hodinu. Pak přijde další nápad a ten starý dostane padáka.",
      "Sedět klidně pět minut? Tvoje nohy o tom jednají s vedením.",
    ],
    [
      "Tvoje rozhodnutí jsou rychlá, hlasitá a občas i správná. Hvězdy bohužel počítají jen ta třetí.",
      "Pomalé lidi nesnášíš. Většina z nich ale cíl našla, protože si přečetla značku.",
    ],
    [
      "Slovo „kompromis“ bereš jako urážku. Slovo „poslouchej“ jako návrh na zamyšlení.",
      "Tvoje diplomatické schopnosti končí tam, kde začíná tvůj hlas.",
    ],
    [
      "Za tebou stojí řada zdemolovaných plánů, nedodělaných polic a jeden Mars, který žádá o dovolenou.",
      "Kdyby byl vesmír firma, tvoje impulzivnost by byla samostatná položka v rozpočtu na opravy.",
    ],
  ],
  v: [
    [
      "Verdikt: motor světa. Jen občas bez brzdové kapaliny.",
      "Hvězdy radí: dýchej. A hlavně dýchej rychle, ať se to stihne.",
    ],
    [
      "Rada hvězd: zpomal o deset procent. Nikdo si nevšimne, ale okolí vydechne.",
      "Než vyrazíš, najdi aspoň jednu cestu zpátky.",
    ],
    [
      "Verdikt: bez tebe by se nic nezačalo. S tebou by se nic nedokončilo.",
      "Rada: sepiš dokončené věci. Zabere to půl řádku.",
    ],
    [
      "Verdikt: jsi živá spoušť s nadšeným úsměvem.",
      "Rada hvězd: občas počkej na výsledek. Třeba na světelné křižovatce.",
    ],
    [
      "Verdikt vesmíru: zpomal. Tvoje odpověď přišla dřív než otázka.",
      "Rozsudek: trvalá povinnost dočíst aspoň první odstavec návodu.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce máš odvahu za dva. Svoje city řekneš nahlas a bez mapy, což je krásné a trochu dobrodružné.",
        "Rande s tebou je malá dovolená: nikdo neví kam, ale všichni se smějí. A květiny jsou už v ceně.",
        "Tvoje nadšení pro druhého je nakažlivé. Partner se po týdnu cítí jako hlavní hrdina filmu, který se ještě natáčí.",
        "Umíš rozjet i obyčejný čtvrtek: jedna zpráva, jeden úsměv a najednou se plánuje společná budoucnost. Fakt rychle.",
      ],
      [ // úroveň 2
        "V lásce jsi sprinter: start perfektní, a pak se zjistí, že vztah je spíš maraton. Hvězdy ti podávají vodu.",
        "Rande plánuješ jako bojovou operaci, jen s menším počtem raket a víc květin.",
        "Svoje city vyznáš dřív, než stihneš zjistit, jak se jmenuje ta restaurace.",
        "Když se ti někdo líbí, nenápadnost je pro tebe cizí slovo. Dotyčný to ví dřív než ty.",
      ],
      [ // úroveň 3
        "Tvoje „nikam nespěchám“ v lásce znamená, že už na třetím rande padla zmínka o společné dovolené. A o psovi.",
        "Trpělivost ve vztahu máš vzornou. Přesně pět minut poté, co ti někdo neodpoví na zprávu.",
        "Romantika podle Berana: kytice, nadšení, plán. A když se partner ptá, kam jedete, odpověď zní „překvapení“. Protože netušíš.",
        "Hádku ukončíš jednou větou: „Mám pravdu.“ Vztah ti za to děkuje tichem, které se dá krájet.",
      ],
      [ // úroveň 4
        "Tvoje vztahy mají dva režimy: „Zbožňuju tě“ a „Proč nic neříkáš“. Mezi nimi není ani pauza.",
        "Vyhrát hádku je pro tebe důležitější než ji dotáhnout do konce. Většinou dosáhneš obojího a zůstaneš s výhrou o samotě.",
        "Randíš jako jízda na letních gumách v zimě: hlasitě, rychle a s hrozícím koncem v příkopu.",
        "Partnerovi dáváš pět minut na rozmyšlenou. Tvoje pětiminutovka trvá dvanáct sekund a pak se ozve „tak co?“.",
      ],
      [ // úroveň 5
        "Vyznání lásky letí tak rychle, že ho NASA zaznamenala dřív, než ti to došlo. Teď se ptá, jestli to platí.",
        "Při tvém prvním rande Mars tleskal. Při druhém žádal o přeložení na Neptun.",
        "Když se pohádáš, jsi jako černá díra: všechno pohltíš, nic nevrátíš a pak se tváříš, že to bylo nutné.",
        "Zasnoubení plánuješ na třetí schůzku. Mezigalaktický úřad pro vztahy kvůli tomu otevřel zvláštní okénko a nabízí rozumné termíny.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci rozjedeš i projekt, který ostatní ještě nestihli pojmenovat. Káva je bonus, ne podmínka.",
        "Na poradě máš nápad dřív, než se kolegové dočtou zadání. Je to dar. A tiché kolegy to trochu stresuje.",
        "Když se zadá něco nemožného, svítí ti oči. Pro Berana je termín jen vřelé pozvání na závod.",
        "Máš odvahu zkusit věci, na které si ostatní vyžádají tři porady a jedno schválení. Ty stihneš zkusit dvě.",
      ],
      [ // úroveň 2
        "V práci máš energii za čtyři. Bohužel jen na prvních patnáct minut zadání.",
        "Porada s tebou probíhá takhle: nápad, nadšení, kolega zvedne obočí a ty už stavíš prototyp.",
        "Deadliny miluješ. Hlavně ty, co se blíží. Ty vzdálené bereš jako legendu.",
        "Na e-maily odpovídáš tak rychle, že přílohu zapomínáš jen ve dvou případech ze tří.",
      ],
      [ // úroveň 3
        "Tvoje „bude to hotové za chvilku“ je důvod, proč kolegové počítají chvilku v týdnech.",
        "Dokončené úkoly máš v práci pečlivě uložené ve složce „Slavné začátky“.",
        "Pracuješ tak rychle, že chyby vznikají dřív, než je kolegové stihnou udělat sami.",
        "Úkoly dokončuješ na „90 procent hotovo“. Zbylých deset procent řeší tým, který ještě neví, že ho řeší.",
      ],
      [ // úroveň 4
        "Do práce chodíš jako do závodu. Kolegové z toho mají únavu a ty medaili, kterou si vyvěsíš na zeď.",
        "V e-mailu čeká 312 nepřečtených zpráv a ty máš pocit, že všechno stihneš. Obojí je omyl.",
        "Tvoje projekty mají jedinou pevnou fázi: nadšený začátek. Střed a konec jsou fámy od kolegů z jiných oddělení.",
        "Když šéf požádá o „pár minut klidu“, vezmeš to jako výzvu a stihneš za tři minuty čtyři věci. Dvě si nikdo neobjednal.",
      ],
      [ // úroveň 5
        "Tvoje deadliny jsou tak blízko, že je NASA zapsala jako kometu. Nelze předvídat, jestli to stihneš, ani jestli to byl projekt.",
        "Až řekneš „za chvilku“, gravitační vlny to zachytí a Einstein se jde podívat, co to pokazilo v teorii relativity.",
        "Tvoje porada by na Jupiteru trvala o den kratší. Nikdo neví jak, ale přesně to sedí k tvému „ještě minutku, hned jsem tam“.",
        "Tvoje nasazení je v kanceláři tak velké, že tiskárna žádá o azyl na Marsu. Mars odmítl, má vlastní problémy s tebou.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Žiješ naplno: každé ráno je pro tebe startovní čára, ne budík. Hvězdy tleskají a trochu zadýchaně sledují.",
        "Máš dar dělat z obyčejných dnů malá dobrodružství. Stačí, že vyrazíš do obchodu.",
        "Když ostatní váhají, ty už jsi na půl cesty. A cíl bývá nakonec lepší, než se čekalo.",
        "Do každého dne vstupuješ s energií, o které ostatní píšou motivační citáty. Ty tak jen žiješ a pak se divíš, že ti zbyla káva.",
      ],
      [ // úroveň 2
        "Život bereš jako závod, jen ti pořád zapomínají říct, kdy je cíl.",
        "Ráno máš tři plány. Večer víš o jednom a ten není tvůj.",
        "Den ti začíná v rychlostním pruhu a končí otázkou, kam zmizely klíče.",
        "Čekání na zelenou vnímáš jako cizí názor. Poslechneš, ale s mírným podrážděním.",
      ],
      [ // úroveň 3
        "Tvoje „vyřeším to hned“ se obvykle vyřeší samo. Za tři týdny, bez tvé účasti.",
        "Plánuješ rychle a důkladně. Jen mezi rychlostí a důkladností vybereš vždycky tu první.",
        "Klidný víkend v tvém podání: sobota výlet, neděle úklid po výletu, pondělí únava z klidného víkendu.",
        "Tvrdíš, že umíš odpočívat. Přesně jako ten, kdo pět minut leží na gauči a pak jde přestavět předsíň.",
      ],
      [ // úroveň 4
        "Na tvoje životní rozhodnutí by patřila cedule: „Pozor, vyskočí z ničeho.“",
        "Většinu věcí řešíš tak, že nejdřív kopneš a pak se ptáš, co to bylo. Stůl to ví.",
        "Odpočinek máš nastavený na dvacet sekund. Pak ti zavolá další nápad a ty zase mizíš.",
        "Tvůj život je akční film bez titulků: hlasitý, rychlý a nikdo kromě tebe nechápe, o co jde.",
      ],
      [ // úroveň 5
        "Meteorologové tě vedou jako přírodní jev: bez varování, bez evakuace a s jistotou, že přijdeš dřív než předpověď.",
        "Za týden uletíš víc světelných let než Voyager za rok. Cíl ale pořád není stanoven.",
        "Tvoje tempo je tak vysoké, že tě černé díry sledují s respektem. Nasávají pomaleji, než se ty ráno obouváš.",
        "Slunce vychází a ty ho už předháníš. Kdyby se vesmír řídil tvým rozvrhem, Velký třesk by přišel o týden dřív a bez pozvánek.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Kamarádi tě milují. Zvlášť v okamžiku, kdy nikdo nemá chuť nic plánovat a ty už zamlouváš stůl.",
        "S tebou se nikdy nepromarní víkend: stačí napsat do skupiny jedno slovo a už se balí batohy.",
        "Přátelé s tebou zažijí víc než za půl roku bez tebe. A bonus: příběhy jsou hned k použití.",
        "Když někdo z přátel potřebuje postrčit, přijdeš první. Někdy dřív, než ho vůbec napadlo, že potřebuje.",
      ],
      [ // úroveň 2
        "Jsi ten typ, který ve čtvrtek večer napíše: „Zítra jedeme na hory.“ A ono se to stane.",
        "Když se někdo zeptá, kdo to zařídí, ty už máš půlku hotovou. A ta půlka je špatně.",
        "Ve skupinovém chatu píšeš nejvíc zpráv. Ostatní si už ztlumili zvuk, ale dál tě vřele čtou.",
        "Kavárna je vybraná před deseti minutami. Přátelé ještě dojídají předchozí. Ty tomu říkáš efektivita.",
      ],
      [ // úroveň 3
        "Skvělý společník: vždycky první na místě, první u dortu a první, kdo odchází, protože „to už bylo stejně vyřešené“.",
        "Tvoje oblíbená věta ve skupině: „Tak se rozhodněte!“ Rozhodnutí už samozřejmě padlo, jen o něm skupina ještě neví.",
        "Přátelé oceňují tvou upřímnost. Hlavně těch pár vteřin, než dokončíš větu.",
        "Dohodnout se s tebou je snadné: stačí souhlasit. Jiný názor vydrží na stole zhruba do příští věty.",
      ],
      [ // úroveň 4
        "Tvoji přátelé mají skupinový chat „Berane, zpomal“. Je ztlumený. Pro jistotu.",
        "Se stolní hrou s tebou končí všechno stejně: výhra, sporná pravidla a nová hra, kde pravidla už nejsou.",
        "Když přátelé řeknou „ještě chvíli počkáme“, ty už stojíš u dveří a děláš ten výraz.",
        "Výlet s tebou má jasný harmonogram: nadšení, rozbitý plán, dobrodružství a pak všichni tvrdí, že to byl záměr.",
      ],
      [ // úroveň 5
        "Přátelé tě mají v telefonu pod jménem „Stav ohrožení“. Na mezigalaktické úrovni už máš vlastní číslo tísňové linky.",
        "Tvoje „zítra jedeme“ doletělo až do Oortova oblaku. Komety zrušily plány a přihlásily se na výlet.",
        "Parta tě vyšle na misi „sehnat stůl“. Vrátíš se s vlastní restaurací, třemi jednáními a rozházeným časoprostorem.",
        "Kamarádi tě vedou jako gravitační střed party. Zbytek planet se stáčí tvým směrem, ať chce, nebo ne.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš jako olympiádu: s nadšením, hlukem a nevyřešenými spory o pravidlech.",
        "Dort sfoukneš takovou silou, že se svíčky předem omlouvají.",
        "Tvoje oslava začíná dřív, než přijde první host. Dekorace stojí, balonky nadávají a ty se usmíváš.",
        "K narozeninám si přeješ jedno: ať je to den, který stojí za příběh. Hvězdy tomu fandí s konfetami.",
      ],
      [ // úroveň 2
        "Přání dostaneš od všech. Poděkuješ do tří dnů. Hvězdy počítají s tolerancí.",
        "Narozeninový plán máš jasný: ráno nadšení, odpoledne nadšení, večer nadšení. Mezi tím krátká pauza na dort.",
        "Dárek pro kamaráda vybereš za dvě minuty a pak čekáš dva měsíce na jeho narozeniny. Soutěž v trpělivosti prohráváš.",
        "Svíčky na dortu zhasínáš dřív, než dozpívá poslední host. Přání se prý splní rychleji.",
      ],
      [ // úroveň 3
        "Tvoje oslava „v malém kruhu“ má osmnáct hostů, dva reproduktory a sousedku s připomínkami. Kruh je očividně hodně velký.",
        "Říkáš, že od narozenin nic neočekáváš. Seznam sedmi bodů máš v poznámkách hned pod nápadem číslo čtyři.",
        "Tvoje dárky jsou dokonalé: vždycky rychlé, vždycky velké a vždycky s přesvědčením, že se musí rozbalit hned.",
        "Narozeninový program plánuješ vojensky přesně. Zbylý rok mu to trvá, než se dostane z tvé hlavy do kalendáře.",
      ],
      [ // úroveň 4
        "Tvoje „malá oslava“ končí tak, že sousedi znají text písně líp než ty.",
        "Nedočkavost tě prozradí: dárek, který chceš dát, předáš o týden dřív. Všem.",
        "Slavíš tak dlouho, že kalendář musí otevřít další sloupec. A ten se mu nelíbí.",
        "Na tvé oslavě se hosté střídají: první utíkají v deset, poslední v pondělí. Všichni mají stejně vyčerpaný výraz.",
      ],
      [ // úroveň 5
        "Tvoje narozeniny jsou tak velké, že je NASA plánuje do kalendáře jako zatmění. Doporučuje ochranné brýle a mlčení.",
        "Když sfoukneš svíčky, vzniká tlaková vlna, kterou zachytí tři observatoře. Dvě z nich žádají kopii dortu.",
        "Mars ti každý rok posílá přání: „Hodně štěstí. A prosím, nechoď blíž.“ Jupiter si nechává to svoje, ale schoval se.",
        "Za každý rok, který slavíš, dostane vesmír novou sekci stížností. Už má vlastní oddělení a čtyři nešťastné úředníky.",
      ],
    ],
  },
  s: [
    ["Doběhnutých projektů", "3 %"],
    ["Čekání ve frontě bez nadávání", "11 s"],
    ["Nápadů před snídaní", "7"],
    ["Pokusů o „zvládnu to rychleji“", "100 %"],
    ["Kompromisů dnes", "0"],
    ["Reakcí na pomalý internet", "9 denně"],
  ],
  d: [
    "Dnes tě bude něco zdržovat. Reaguj klidně. Hvězdy se dívají s popcornem.",
    "Dnes ti někdo řekne „počkej“. Vydržíš čtyři sekundy. Nový osobní rekord.",
    "Dnes začneš tři věci a dokončíš jednu. Ta jedna bude oběd.",
    "Dnes dopiješ kávu rychleji, než přijde první e-mail. Zbytek dne je zrcadlový obraz.",
    "Dnes budeš mít pravdu. Jen v nesprávném pořadí a hlasitěji, než je zdrávo.",
    "Dnes se ti bude zdát, že všichni jedou pomalu. Zkus nakouknout do zrcátka.",
    "Dnes ti Mars posílá energii. Hvězdy ji zadržují, aby se hodila i příští týden.",
    "Dnešní tip: zkus nejdřív dočíst větu. Pak ji můžeš rozdělat.",
    "Dnes tě čeká dilema: rychle, nebo hned. Hvězdy tipují obojí současně.",
    "Dnes se ti povede něco, co nikdo nečekal. Hlavně ty ne.",
    "Dnes v poledne zjistíš, že snídaně i oběd se zatím neuskutečnily. Mars je hrdý.",
    "Dnešní varování: pomalou frontu zvýšeným hlasem neurychlíš. Hvězdy to už zkoušely.",
    "Dnes zkusíš čekat na výtah. Po osmi sekundách se rozhodneš, že schody jsou vlastně sport.",
    "Dneska si řekneš, že dnes už nic nového nezačneš. Platí to do prvního odstavce.",
    "Dnes sestavíš nábytek bez návodu. Zbude ti šroubek. Fakt jen jeden.",
    "Dneska dorazíš první. Na místě bude zamčeno, ale je to princip, ne logistika.",
    "Dnes ti někdo řekne „klid“. Klid se dnes bohužel nenašel, tak ho dostaneš aspoň v hlase.",
    "Dnes budeš stíhat věci, které ještě ani nezačaly. Hvězdy žasnou, jen ne moc nahlas.",
    "Dneska se zeptáš, jestli už jsme tam. A to ani nejedeš v autě.",
    "Dnes rozhodneš za tři vteřiny a překvapivě to vyjde. Další tři vteřiny budeš hledat podvod.",
    "Dnes si vybereš nejkratší frontu. Zpomalí se hned, jak se do ní postavíš. Vesmír to dělá rád.",
    "Dneska přijde skvělý nápad ve 14:03. Ve 14:04 bude hotový a ve 14:05 zapomenutý.",
    "Dnes se ti bude zdát, že týden má málo dní. Hvězdy navrhují přesun do soustavy s osmidenním kalendářem.",
    "Dnes si dáš krátkou pauzu. Vydrží dvanáct sekund a skončí slovy „tak jo, a teď“.",
  ],
  q: [
    "Stůl je zamluvený. Mnou. Před pěti minutami. Jdeme.",
    "Sobotní plán: kolo, hory, skok z čehokoli. Spaní je v neděli. Možná.",
    "Odpověď letí dřív, než dočtu otázku. Překlepy jsou součástí stylu.",
    "Kdo ho umyje první, vyhrává. Startuju. Ty už prohráváš.",
    "Kamkoli, co odjíždí dnes večer. Sbal se za deset minut.",
    "Něco s výbuchy. Úvod přeskočíme, ten nikdo nepotřebuje.",
  ],
};

export default beran;
