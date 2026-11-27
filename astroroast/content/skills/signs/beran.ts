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
      "Beran přijde na oslavu první. Hostitel je ještě v županu.",
      "Beran se rozhoduje za jízdy. Překvapivě často trefí cíl.",
    ],
    [
      "Slovo „počkej“ Beran bere jako nezávazný návrh.",
      "Beran vyrazí z domu dřív, než se rozhodne kam. Navigace se přizpůsobí.",
      "V obchodě bere Beran první, co vidí. Říká tomu nákupní strategie.",
    ],
    [
      "Čtrnáct rozdělaných projektů a pevná víra, že ten patnáctý už dotáhneš.",
      "Beran dokončí všechno. Teda všechno, co se dá stihnout do úterý.",
      "Trpělivost máš jako signál v tunelu: pár vteřin to drží a pak je ticho.",
    ],
    [
      "Beran návod nečte. Poznáš to podle skříně, která stojí šikmo a drží z vděčnosti.",
      "Tvoje „hned to udělám“ je nejdéle platný slib ve sluneční soustavě. Platí od března.",
      "Beran je důkaz, že rychlost bez cíle se dá prodávat jako osobnost.",
    ],
    [
      "Mars podal výpověď. Prý s tebou nestíhá ani on.",
      "Vesmír tě vede jako zařízení „jen pod dohledem“. Dohled už třetí týden čerpá dovolenou.",
      "Netrpělivost máš tak velkou, že se čas ve frontě ani nepostavil. Šel domů.",
    ],
  ],
  c: [
    [
      "Rozjedeš každou párty, i když se nikdo neptal, jestli už je párty.",
      "Kdyby nadšení svítilo, Beran by měl vlastní elektrárnu a sousedi by si stěžovali na světelný smog.",
    ],
    [
      "Nadšení pro nový koníček ti vydrží do chvíle, kdy přijde balík z Alzy. Pak už jen leží.",
      "Sedět klidně pět minut? Tvoje nohy o tom jednají s vedením.",
    ],
    [
      "Rozhoduješ se za tři vteřiny a hájíš to tři hodiny. Poměr ti vyhovuje, ostatním míň.",
      "Pomalí lidé tě dráždí. Dorazí ale na správné nástupiště, protože čtou tabuli odjezdů.",
    ],
    [
      "„Kompromis“ bereš jako urážku a „poslouchej“ jako návrh k zamyšlení, ke kterému se vrátíš někdy po svátcích.",
      "Tvoje diplomatické schopnosti končí tam, kde začíná tvůj hlas.",
    ],
    [
      "Za tebou zůstává stopa zdemolovaných plánů, nedodělaných polic a jeden Mars, který žádá o přeložení.",
      "Kdyby byl vesmír firma, tvoje impulzivnost by měla vlastní oddělení. Říká se mu „opravy“.",
    ],
  ],
  v: [
    [
      "Verdikt: motor světa. Jen občas bez brzdové kapaliny.",
      "Hvězdy radí: nadechni se, než odpovíš. Stačí jeden nádech, nikdo si nevšimne.",
    ],
    [
      "Rada hvězd: zpomal o deset procent. Okolí si nevšimne, jen si vydechne.",
      "Než vyrazíš, zjisti, kde to vlastně je.",
    ],
    [
      "Verdikt: bez tebe by se nic nezačalo. S tebou by se nic nedokončilo.",
      "Rada: sepiš dokončené věci. Zabere to půl řádku.",
    ],
    [
      "Verdikt: spoušť s nadšeným výrazem. Úklid zůstane na ostatních.",
      "Rada hvězd: počkej na výsledek aspoň jednou. Třeba na semaforu.",
    ],
    [
      "Verdikt vesmíru: zpomal. Tvoje odpověď přišla dřív než otázka.",
      "Rozsudek: první odstavec návodu je od teď povinný. Druhý se projedná.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "V lásce máš odvahu za dva. Řekneš nahlas, co cítíš, a druhý aspoň ví, na čem je.",
        "S tebou je i obyčejné úterý rande: jedna zpráva, jeden nápad a večer se jede na zmrzlinu.",
        "Když se ti někdo líbí, usmíváš se na pokladně v Lidlu a nevíš proč.",
        "S tebou partner nikdy nezažije nudu. Klid si objedná až na důchod.",
      ],
      [ // úroveň 2
        "Vyznání lásky máš hotové dřív, než znáš příjmení.",
        "V lásce jsi sprinter. Start dokonalý, až v polovině někdo upozorní, že vztah je maraton.",
        "Na rande dorazíš o dvacet minut dřív a čekáš s kyticí. Vypadá to romanticky, dokud nezačneš psát „kde jsi?“",
        "Nenápadnost je pro tebe cizí slovo. O tvých citech ví dotyčný, jeho kolegové a paní z pekařství.",
      ],
      [ // úroveň 3
        "Tvoje „nikam nespěchám“ znamená, že na třetím rande padne dovolená v Chorvatsku a jméno psa.",
        "Trpělivost ve vztahu máš vzornou. Přesně pět minut poté, co ti někdo neodpoví na zprávu.",
        "Romantický výlet s Beranem začíná slovem „překvapení“ a končí hádkou o navigaci.",
        "Hádku ukončuješ větou „Mám pravdu.“ Vztah ti za to děkuje tichem, které se dá krájet.",
      ],
      [ // úroveň 4
        "Tvoje vztahy mají dva režimy: „zbožňuju tě“ a „proč nic neříkáš“. Mezi nimi není ani zastávka.",
        "Hádku chceš hlavně vyhrát. Povede se to a ticho po výhře si vychutnáš celý večer.",
        "Partnerovi dáváš pět minut na rozmyšlenou. Tvoje pětiminutovka trvá dvanáct vteřin a pak se ozve „tak co?“.",
        "Rande s Beranem je jako jízda na letních gumách v zimě: rychle, hlasitě a konec se hledá v příkopu.",
      ],
      [ // úroveň 5
        "Vyznání lásky od tebe letí tak rychle, že ho NASA zachytí dřív než adresát. Teď se ptá, jestli to platí.",
        "Při tvém prvním rande Mars tleskal. Při druhém žádal o přeložení na Neptun.",
        "V hádce fungujete jako černá díra: všechno pohltíš, nic nevrátíš a nakonec tvrdíš, že to bylo nutné.",
        "Svatbu plánuješ na třetí schůzku. Galaktický matrikář kvůli tobě otevřel zvláštní okénko a nestíhá.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "V práci rozjedeš i projekt, který ostatní ještě nestihli pojmenovat.",
        "Na poradě máš nápad dřív, než kolegové dočtou zadání. Tiší lidé z toho mají mírný stres, ale fandí.",
        "Když přijde zadání „to nejde“, rozsvítí se ti oči. Pro Berana je termín pozvánka na závod.",
        "Zkusíš věci, na které ostatní chtějí tři porady a razítko. Ty je zkusíš dřív, než začne první porada.",
      ],
      [ // úroveň 2
        "V práci máš energii za čtyři. Bohužel na první čtvrt hodiny úkolu.",
        "Porada s tebou: nápad, nadšení, kolega se nadechne k otázce a ty už máš hotový prototyp.",
        "Termíny miluješ. Hlavně ty, co se blíží. Vzdálené bereš jako legendu.",
        "Na e-maily odpovídáš tak rychle, že přílohu zapomínáš jen ve dvou případech ze tří.",
      ],
      [ // úroveň 3
        "„Bude to hotové za chvilku“ je u tebe jednotka času. Kolegové ji počítají v týdnech.",
        "Na sdíleném disku máš složku „Rozděláno“ a složku „Hotovo“. Ta druhá je prázdná z principu.",
        "Pracuješ tak rychle, že chyby vznikají dřív, než je kolegové stihnou najít.",
        "Úkoly dokončuješ na „90 procent hotovo“. Zbylých deset procent řeší tým, který ještě neví, že ho řeší.",
      ],
      [ // úroveň 4
        "Do práce chodíš jako na olympiádu. Ostatní si v poledne dají polévku, ty už počtvrté měníš prioritu.",
        "Ve schránce máš 312 nepřečtených e-mailů a pocit, že všechno stíháš. Obojí je omyl.",
        "Tvoje projekty mají jedinou pevnou fázi: nadšený začátek. Střed a konec jsou fámy od kolegů z jiných oddělení.",
        "Šéf poprosí o „pár minut klidu“. Ty to bereš jako zadání, stihneš za tři minuty čtyři věci a dvě z nich si nikdo neobjednal.",
      ],
      [ // úroveň 5
        "Tvoje termíny se blíží tak rychle, že je NASA vede jako kometu. Nikdo neví, jestli to stihneš ani jestli to byl projekt.",
        "Když řekneš „za chvilku“, gravitační vlny to zachytí. Einstein zkontroluje, co se stalo s relativitou.",
        "Na tvou poradu ještě nikdo nepozval, a ona už skončila. Zápis přišel z budoucnosti a obsahuje tři nové úkoly.",
        "Tvoje nasazení je v kanceláři tak velké, že tiskárna žádá o azyl na Marsu. Mars odmítl, má vlastní problémy s tebou.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Žiješ naplno: každé ráno je pro tebe startovní čára, ne budík. Hvězdy tleskají a trochu zadýchaně sledují.",
        "Z obyčejné cesty do obchodu umíš udělat výpravu. Domů se vracíš s příběhem a půlkou věcí z nákupního seznamu.",
        "Když ostatní váhají, ty jsi na půl cesty. A cíl bývá nakonec lepší, než se čekalo.",
        "Do dne vstupuješ s energií, o které ostatní píšou motivační citáty. Ty ji prostě máš a divíš se, že došla káva.",
      ],
      [ // úroveň 2
        "Život bereš jako závod. Jen ti pořád zapomínají říct, kde je cíl.",
        "Ráno máš tři plány. Večer se držíš jednoho a ten není tvůj.",
        "Den ti začíná v rychlém pruhu a končí otázkou, kam zmizely klíče.",
        "Čekání na zelenou bereš jako cizí názor. Vyslechneš ho, ale s podrážděním.",
      ],
      [ // úroveň 3
        "„Vyřeším to hned“ se u tebe obvykle vyřeší samo. Za tři týdny, bez tvé účasti.",
        "Plánuješ rychle a důkladně. Když se ty dvě věci pohádají, vyhraje ta rychlá.",
        "Klidný víkend podle tebe: v sobotu výlet, v neděli úklid po výletu, v pondělí odpočinek od klidného víkendu.",
        "Tvrdíš, že umíš odpočívat. Vydržíš to na gauči pět minut a pak jdeš přestavět předsíň.",
      ],
      [ // úroveň 4
        "Na tvoje životní rozhodnutí by patřila cedule: „Pozor, vyskočí z ničeho.“",
        "Většinu věcí řešíš tak, že nejdřív kopneš a pak se ptáš, co to bylo. Stůl to ví.",
        "Odpočinek máš nastavený na dvacet vteřin. Pak ti zavolá další nápad a ty zase mizíš.",
        "Tvůj život je akční film: rychlý, hlasitý a nikdo včetně tebe neví, kdo je vlastně záporák.",
      ],
      [ // úroveň 5
        "Meteorologové tě vedou jako přírodní jev: bez varování, bez evakuace a vždy dřív než předpověď.",
        "Za týden uletíš víc světelných let než Voyager za rok. Cíl pořád není stanoven.",
        "Tvoje tempo je tak vysoké, že tě černé díry sledují s respektem. Nasávají pomaleji, než se ty ráno obouváš.",
        "Slunce ještě nevyšlo a ty už ho předjíždíš. Kdyby se vesmír řídil tvým rozvrhem, Velký třesk by přišel o týden dřív a bez pozvánek.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Kamarádi tě milují hlavně ve chvíli, kdy nikdo nic neplánuje a ty už zamlouváš stůl.",
        "S tebou se nepromarní víkend: stačí do skupiny napsat jedno slovo a všichni hledají batoh.",
        "Přátelé s tebou zažijí za měsíc víc než jinde za rok. A ty historky se hned hodí na svatbě.",
        "Když kamarád potřebuje postrčit, jsi tam dřív, než si to stihne přiznat.",
      ],
      [ // úroveň 2
        "Ve čtvrtek večer napíšeš: „Zítra jedeme na hory.“ A ono se to opravdu stane.",
        "Když se někdo zeptá, kdo to zařídí, ty už máš půlku hotovou. Ta půlka je špatně.",
        "Ve skupině píšeš nejvíc zpráv. Ostatní to mají ztlumené, ale pořád tě čtou.",
        "Kavárna je vybraná před deseti minutami. Ostatní ještě dojídají předchozí. Říkáš tomu efektivita.",
      ],
      [ // úroveň 3
        "Vždycky jsi první na místě, první u dortu a první, kdo odchází, protože „to je přece vyřešené“.",
        "Tvoje oblíbená věta ve skupině: „Tak se rozhodněte!“ Rozhodnutí už padlo, jen to skupina ještě neví.",
        "Skupinový chat má tři vlákna a ty jsi v každém první. Někdy dřív než zpráva, na kterou odpovídáš.",
        "Dohodnout se s tebou je snadné: stačí souhlasit. Jiný názor vydrží na stole zhruba do konce tvé věty.",
      ],
      [ // úroveň 4
        "Skupinový chat kamarádů se jmenuje „Berane, zpomal“. Je ztlumený. Pro jistotu.",
        "Se stolní hrou s tebou končí všechno stejně: vítězství, spor o pravidla a nová hra, kde už pravidla nejsou.",
        "Když parta řekne „ještě chvilku počkáme“, ty už stojíš u dveří s klíči v ruce a výrazem, který by se dal vystavit.",
        "Výlet s tebou má jasný harmonogram: nadšení, rozbitý plán, dobrodružství a pak všichni tvrdí, že to byl záměr.",
      ],
      [ // úroveň 5
        "Přátelé tě mají v telefonu pod jménem „Stav ohrožení“. Mezigalaktická linka 112 už má pro tebe vlastní číslo.",
        "Tvoje „zítra jedeme“ doletělo do Oortova oblaku. Komety zrušily plány a přihlásily se na výlet.",
        "Parta tě vyšle sehnat stůl. Vrátíš se s vlastní restaurací, třemi smlouvami a pokřiveným časoprostorem.",
        "Kamarádi tě berou jako gravitační střed party. Planety se stáčejí tvým směrem, ať chtějí, nebo ne.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Narozeniny slavíš jako olympiádu: s nadšením, hlukem a nevyřešeným sporem o pravidla.",
        "Svíčky na dortu sfoukneš takovou silou, že se předem omlouvají.",
        "Oslava začíná dřív, než dorazí první host. Dekorace stojí, balonky nadávají a ty se usmíváš.",
        "K narozeninám si přeješ, ať je to den, o kterém se bude vyprávět. Hvězdy fandí s konfetami.",
      ],
      [ // úroveň 2
        "Přání dostaneš od všech a poděkuješ do tří dnů. Hvězdy počítají s tolerancí.",
        "Narozeninový plán: ráno nadšení, odpoledne nadšení, večer nadšení. Mezi tím krátká pauza na dort.",
        "Dárek pro kamaráda vybereš za dvě minuty a pak dva měsíce čekáš na jeho narozeniny. Tuhle soutěž v trpělivosti prohráváš.",
        "Svíčky zhasínáš dřív, než dozpívá poslední host. Přání se prý splní rychleji.",
      ],
      [ // úroveň 3
        "Tvoje oslava „v malém kruhu“ má osmnáct hostů, dva reproduktory a sousedku s připomínkami. Kruh je evidentně velký.",
        "Říkáš, že od narozenin nic nečekáš. Seznam o sedmi bodech máš v poznámkách hned pod nápadem číslo čtyři.",
        "Dárky rozbaluješ tak rychle, že papír ještě letí, když už se ptáš: „A to je všechno?“",
        "Program oslavy plánuješ na minuty. Po první hodině už ho nikdo nepamatuje, včetně tebe.",
      ],
      [ // úroveň 4
        "Tvoje „malá oslava“ končí tak, že sousedi znají text písničky líp než ty.",
        "Nedočkavost tě prozradí: dárek, který chceš dát, předáš o týden dřív. Všem.",
        "Slavíš tak dlouho, že kalendář musí přidat další sloupec. Tomu se to nelíbí.",
        "Na tvé oslavě se hosté střídají: první utíkají v deset, poslední v pondělí. Všichni mají stejně vyčerpaný výraz.",
      ],
      [ // úroveň 5
        "Tvoje narozeniny jsou tak velké, že je NASA plánuje do kalendáře jako zatmění. Doporučuje ochranné brýle a mlčení.",
        "Když sfoukneš svíčky, vznikne tlaková vlna, kterou zachytí tři observatoře. Dvě žádají o kopii dortu.",
        "Mars ti každý rok posílá přání: „Hodně štěstí. A nechoď blíž.“ Jupiter si ponechává svoje a schoval se.",
        "Za každý rok, který slavíš, zřizuje vesmír oddělení stížností. Už má čtyři úředníky a razítko na pět různých odpovědí.",
      ],
    ],
  },
  s: [
    ["Doběhnutých projektů", "3 %"],
    ["Čekání ve frontě bez nadávání", "11 s"],
    ["Nápadů před snídaní", "7"],
    ["Návodů přečtených celých", "0"],
    ["Kompromisů dnes", "0"],
    ["Troubení na zelenou, která ještě nesvítí", "9 denně"],
  ],
  d: [
    "Dnes ti někdo řekne „počkej“. Vydržíš čtyři vteřiny. Nový osobní rekord.",
    "Dnes začneš tři věci a dokončíš jednu. Ta jedna bude oběd.",
    "Dnes dopiješ kávu dřív, než naběhne počítač. Zbytek dne se tomu tempu bude jen snažit přiblížit.",
    "Dnes budeš mít pravdu. Jen ve špatném pořadí a hlasitěji, než je zdvořilé.",
    "Dnes ti bude připadat, že všichni jedou pomalu. Zkus se podívat na tachometr.",
    "Dnes dorazíš první. Na místě bude zamčeno, ale princip je princip.",
    "Dnešní tip: dočti e-mail do konce. Otázka v poslední větě stojí za to.",
    "Dnes tě čeká dilema: rychle, nebo hned. Hvězdy tipují obojí zároveň.",
    "Dnes se ti povede něco, co nikdo nečekal. Hlavně ne ty.",
    "Dnes v poledne zjistíš, že snídaně i oběd se zatím nekonaly. Mars je hrdý.",
    "Dnes zkusíš čekat na výtah. Po osmi vteřinách se rozhodneš, že schody jsou vlastně sport.",
    "Dnes si řekneš, že už nic nového nezačneš. Platí to, dokud nepotkáš reklamu na kurz.",
    "Dnes sestavíš nábytek bez návodu. Zbude ti šroubek. Fakt jen jeden.",
    "Dnes ti někdo poradí „klid“. Zareaguješ klidně, jen o půl oktávy výš.",
    "Dnes budeš stíhat věci, které ještě ani nezačaly. Hvězdy žasnou, jen ne moc nahlas.",
    "Dnes se zeptáš, jestli už jsme tam. A to ani nejedeš v autě.",
    "Dnes rozhodneš za tři vteřiny a překvapivě to vyjde. Další tři vteřiny budeš hledat podvod.",
    "Dnes si vybereš nejkratší frontu. Zpomalí se hned, jak se do ní postavíš. Vesmír si to užívá.",
    "Dnes přijde skvělý nápad ve 14:03. Ve 14:04 bude hotový a ve 14:05 zapomenutý.",
    "Dnes ti bude připadat, že týden má málo dní. Hvězdy vzaly na vědomí a odložily to na pondělí.",
    "Dnes si dáš krátkou pauzu. Vydrží dvanáct vteřin a skončí slovy „tak jo, a teď“.",
    "Dnes odškrtneš pět bodů ze seznamu. Seznam si mezitím přidá šest nových.",
    "Dnes tě zdrží červená. Budeš na ni mluvit. Nezabere to.",
    "Dnes zmáčkneš tlačítko u přechodu pětkrát. Zelená se bude tvářit, že to bylo jen jedno stisknutí.",
  ],
  q: [
    "Stůl je zamluvený. Mnou. Před pěti minutami. Jdeme.",
    "Sobota: kolo, hory, skok z čehokoli. Spaní je v neděli. Možná.",
    "Odpověď už letí. Otázku dočtu cestou. Překlepy jsou součástí stylu.",
    "Kdo umyje první, vyhrává. Startuju. Ty už prohráváš.",
    "Kamkoli, co odjíždí dnes večer. Za deset minut máš sbaleno.",
    "Něco s výbuchy. První půlhodinu přeskočíme, tam se jen mluví.",
  ],
};

export default beran;
