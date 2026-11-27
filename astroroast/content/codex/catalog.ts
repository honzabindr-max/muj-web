// AstroRoast.ai: ručně psaný katalog hotových vtipů tohoto modelu (originální obsah, žádný LLM za běhu).
// Každé znamení má 5 sérií po 2 vtipech. Id: "{sign}-{series}-{n}".

import type { CatalogJoke, SignId } from "../../types";
import { buildCatalog } from "../build";

type Series = CatalogJoke["series"];

export const SERIES_LABELS: Record<Series, string> = {
  "sejde-se": "Sejde se deset…",
  dovolena: "Dovolená podle hvězd",
  zprava: "Tvoje zpráva pod lupou",
  "rika-vs-mysli": "Překlad z tvého jazyka",
  "one-liner": "Jedna věta stačí",
};

export const RAW_CATALOG: Record<SignId, Record<Series, string[]>> = {
  beran: {
    "sejde-se": [
      "Sejde se deset Beranů u dveří s nápisem „Táhnout“. Ty zatlačíš. Přece ti cedule nebude určovat směr.",
      "Sejde se deset Beranů na kurzu keramiky. Ty chceš vědět, kdo má zatím nejrychlejší vázu.",
    ],
    dovolena: [
      "Na dovolené se s mořem dohodneš na klidu. Pak mu začneš vracet vlny.",
      "Na dovolené si vybereš únikovou hru. Dveřím oznámíš, že na vyjednávání nemáš čas.",
    ],
    zprava: [
      "Na „Máš chvilku?“ odpovíš „Jdu na to.“ Zatím netušíš, na co. Kontext si tě může doběhnout.",
      "Na „Ještě to promyslíme“ odepíšeš fotkou rozdělané věci. Myšlenka má co dělat, aby udržela tempo.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Dáme si cvičné kolo.“ Myslí tím: Když vyhraju, počítá se.",
      "Řekne: „Počkám, až domluvíš.“ Myslí tím: Ale tuhle větu už vyhodnocuju jako zdržování.",
    ],
    "one-liner": [
      "Tvoje trpělivost se vejde do přesýpacích hodin. Bez písku.",
      "U tebe má tlačítko „Přeskočit úvod“ taky úvod, který chceš přeskočit.",
    ],
  },

  byk: {
    "sejde-se": [
      "Sejde se deset Býků v otáčivé restauraci. Ty podáš stížnost: jídlo výborné, ale proč se musí pořád něco měnit?",
      "Sejde se deset Býků u kulatého stolu. Ty chceš ten roh, kde sedíš vždycky.",
    ],
    dovolena: [
      "Na dovolené kontroluješ počet hvězdiček hotelu podle toho, jestli se máslo maže, nebo doluje.",
      "Na výletě chceš ochutnat místní kulturu. Ideálně s pečivem, dokud je teplá.",
    ],
    zprava: [
      "Na návrh změny odpovíš hlasovou zprávou. Je v ní sedm vteřin ticha a zavření krabičky se sušenkami.",
      "Na „Přijdeš?“ pošleš dvě otázky: „Kam si sednu?“ a „Co se podává?“ Teprve pak řešíš datum.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Mně stačí něco obyčejného.“ Myslí tím: Máslo, křupavá kůrka a pokoj od lidí, co říkají, že je to jen chleba.",
      "Řekne: „Tohle místo má atmosféru.“ Myslí tím: Zvedat se odsud by zničilo celé kouzlo.",
    ],
    "one-liner": [
      "Na změnu názoru potřebuješ tři pracovní dny. Pak žádost zamítneš.",
      "Tvůj plán vystoupit z pohodlí končí výběrem pohodlných bot.",
    ],
  },

  blizenci: {
    "sejde-se": [
      "Sejde se deset Blíženců u automatu na lístky. Ty s ním navážeš kontakt. Za chvíli víš, co si myslí o pokladně.",
      "Sejde se deset Blíženců na burze knih. Ty vyměníš názor už ve frontě.",
    ],
    dovolena: [
      "Na dovolené se učíš místní jazyk. Po třech slovech už v něm šíříš neověřené novinky.",
      "Z dovolené vezeš suvenýr pro každou svou zálibu. Celník se ptá, jestli dovážíš malé obchodní centrum.",
    ],
    zprava: [
      "Na „Jak se máš?“ pošleš anketu. Výsledky se mění i během hlasování.",
      "Napíšeš „Stručně:“ a telefon nabídne vložit obsah s kapitolami.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Držme se tématu.“ Myslí tím: Toho, které mě napadne v příštích třech vteřinách.",
      "Řekne: „Tohle je můj konečný názor.“ Myslí tím: Na dobu určitou, bez výpovědní lhůty.",
    ],
    "one-liner": [
      "Máš dar rozproudit konverzaci i v oznámení „Na tuto zprávu neodpovídejte“.",
      "Než si ujasníš, co chceš říct, má to vedlejší zápletku a vlastní besedu.",
    ],
  },

  rak: {
    "sejde-se": [
      "Sejde se deset Raků na focení. Ty ještě před prvním snímkem řešíš, jak vám tahle chvíle jednou bude chybět.",
      "Sejde se deset Raků v novém bytě. Ty přineseš koláč i sousedům, kteří se sem teprve nastěhují.",
    ],
    dovolena: [
      "Na dovolené voláš domů, jestli se tam mají hezky. Ptáš se i květináče.",
      "V hotelové knize hostů najdeš zápis z roku 1998. Teď se ti stýská i po rodině, kterou vůbec neznáš.",
    ],
    zprava: [
      "Na „Díky“ odpovíš „Není zač ❤️“. Pak kontroluješ, jestli to srdce nepůsobí příliš odtažitě.",
      "Na „Co si vzít s sebou?“ odpovíš seznamem na stěhování. Akce je od šesti do osmi.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Stav se jen na chvilku.“ Myslí tím: Povlečení už ladí s tvojí oblíbenou barvou.",
      "Řekne: „To je jen taková drobnost.“ Myslí tím: Koláč, krabička na koláč a záložní koláč, kdyby se první cestou cítil osaměle.",
    ],
    "one-liner": [
      "Ke každé vzpomínce máš původní obal a doklad o tom, jak ti u ní bylo.",
      "Když někdo řekne „jako doma“, už mu hledáš náhradní klíče.",
    ],
  },

  lev: {
    "sejde-se": [
      "Sejde se deset Lvů v planetáriu. Ty žádáš opravit projekci. Tvoje souhvězdí je nějak moc vzadu.",
      "Sejde se deset Lvů před zrcadlem. Ty navrhneš skupinovou fotku. Ostatní ti překážejí v záběru.",
    ],
    dovolena: [
      "Na dovolené hodnotíš ozvěnu: vrací ti slova, ale nadšení zní dost nuceně.",
      "V hotelu žádáš pokoj s balkonem. Potřebuješ místo na ranní pozdrav poddanstvu.",
    ],
    zprava: [
      "Na „Kdo jde?“ odpovíš „Dorazím.“ Tím podle tebe končí sčítání a začíná propagace akce.",
      "Na pochvalu odepíšeš „Ale prosím tě.“ Pak si ověříš, jestli se zpráva dá připnout.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Klidně se posaď dozadu.“ Myslí tím: Ať máš na mě lepší výhled.",
      "Řekne: „Nemusíš nic chystat.“ Myslí tím: Překvapení přece nemám organizovat osobně.",
    ],
    "one-liner": [
      "I při schovce zjišťuješ, jestli tě hledají dost nadšeně.",
      "Tvoje skromnost má vlastní osvětlení a dva přídavky.",
    ],
  },

  panna: {
    "sejde-se": [
      "Sejde se deset Panen na vernisáži. Ty narovnáš abstrakci.",
      "Sejde se deset Panen u skládanky. Ty nejdřív reklamuješ, že dílky nejsou očíslované.",
    ],
    dovolena: [
      "Na dovolené přepočítáš schody k vyhlídce. Cedule uvádí 200, máš 201. Výhled už dneska nezachrání nic.",
      "Na pláži shrabeš písek do roviny. Vlnám necháš ceduli s provozní dobou.",
    ],
    zprava: [
      "Na „Mám dotaz“ odpovíš „V jakém formátu?“ Pořádek musí být už na vstupu.",
      "Na „Kdy se sejdeme?“ pošleš tabulku. Má i sloupec pro důvod, proč se nesetkat.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Je to skoro dokonalé.“ Myslí tím: Takže pořád existuje důvod zrušit odpolední program.",
      "Řekne: „Tohle ber jen jako doporučení.“ Myslí tím: Odchylky prosím zdůvodni písemně.",
    ],
    "one-liner": [
      "Máš i seznam věcí, které se nemají zbytečně sepisovat.",
      "U tebe i chaos musí dodržet odsazení.",
    ],
  },

  vahy: {
    "sejde-se": [
      "Sejde se deset Vah u otáčivých dveří. Ty v nich najdeš ideální kompromis: jít ven a zůstat uvnitř.",
      "Sejde se deset Vah při losování. Ty chceš vyslechnout i stanovisko klobouku.",
    ],
    dovolena: [
      "Na dovolené si vyfotíš západ slunce. Pak se omluvíš východu, že ho trochu zanedbáváš.",
      "V hotelu necháš cedulku „Nerušit“ otočenou bokem, aby si úklid nepřipadal odmítnutě.",
    ],
    zprava: [
      "Na „Ano, nebo ne?“ odpovíš „Hezky položená otázka.“",
      "Odepíšeš „Souhlasím s oběma“. Píšeš si přitom jen s jednou osobou.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Nechci se do toho plést.“ Myslí tím: Ale obě strany ode mě právě dostávají vlastní návrh smíru.",
      "Řekne: „Tohle je moje poslední otázka.“ Myslí tím: Kdyby byly poslední dvě, která z nich by se ti líbila víc?",
    ],
    "one-liner": [
      "Tvoje „asi ano“ už má za sebou tři kola připomínek.",
      "Umíš najít společnou řeč i mezi dvěma odstíny béžové, které spolu nemluví.",
    ],
  },

  stir: {
    "sejde-se": [
      "Sejde se deset Štírů u skartovačky. Ty přineseš i obal od svačiny, protože obsahoval informace.",
      "Sejde se deset Štírů na dni otevřených dveří. Ty zkontroluješ, kdo to povolil.",
    ],
    dovolena: [
      "Na dovolené si vezmeš pokoj s tajným vchodem. Hotel o něm zatím neví.",
      "Průvodce ukazuje skryté památky. Na dovolené ho vezmeš stranou: takhle to utajení moc dlouho nevydrží.",
    ],
    zprava: [
      "Na „Co děláš?“ odpovíš „Kdo se ptá?“ Máš tu osobu uloženou patnáct let.",
      "Pošleš tři tečky. Ne jako nedokončenou větu. Jako upoutávku na informaci, ke které nikdo nemá oprávnění.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Klidně se ptej.“ Myslí tím: Každá otázka mi o tobě něco řekne.",
      "Řekne: „Nemám co skrývat.“ Myslí tím: Ale pro jistotu k tomu nemáš přístup.",
    ],
    "one-liner": [
      "I tvůj nákupní seznam má veřejnou a utajenou verzi.",
      "Tvůj smajlík má podtext, přílohu a doložku o mlčenlivosti.",
    ],
  },

  strelec: {
    "sejde-se": [
      "Sejde se deset Střelců na nádraží. Ty vysvětluješ, že slovo „odjezd“ stačí a ta města za ním jsou jen návrhy.",
      "Sejde se deset Střelců na kurzu diplomacie. Ty začneš slovy „Tak si přestaňme něco nalhávat.“",
    ],
    dovolena: [
      "Na dovolené se zeptáš, kam ta cesta vede. Odpověď „Nikdo neví“ považuješ za pětihvězdičkovou recenzi.",
      "Z dovolené pošleš „Jsem kousek od hotelu“. Zamlčíš, že kousek měříš podle měřítka zeměkoule.",
    ],
    zprava: [
      "Na „Jdeš na procházku?“ odpovíš „Potřebujeme pas?“",
      "Na „Kde jsi?“ pošleš polohu. Než se načte, je z ní historický dokument.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Nechci do toho mluvit.“ Myslí tím: Ale pravda už má obuté boty.",
      "Řekne: „Zpáteční cestu nějak vyřešíme.“ Myslí tím: Slovo „zpáteční“ mi trochu kazí atmosféru.",
    ],
    "one-liner": [
      "Tvoje zóna pohodlí má kolečka a právě projela hranicí.",
      "Vyprávíš zážitky tak dlouho, až i pointa prosí o zpáteční jízdenku.",
    ],
  },

  kozoroh: {
    "sejde-se": [
      "Sejde se deset Kozorohů na pískovišti. Ty už zjišťuješ, kdy bude kolaudace.",
      "Sejde se deset Kozorohů na kurzu improvizace. Ty žádáš scénář do středy.",
    ],
    dovolena: [
      "Na dovolené vystoupáš k památce. Ceduli „Vrchol“ bereš jako pochvalu, ale čekáš ještě písemné hodnocení.",
      "V hotelu nechceš budíček. Chceš ranní přehled toho, co už stihlo ostatních devět pater.",
    ],
    zprava: [
      "Na „Chybíš mi“ odpovíš „Kdy přesně a v jakém rozsahu?“",
      "Na „Co večer?“ odpovíš třemi volnými termíny. Dva jsou na příští čtvrtletí.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Pojďme to oslavit.“ Myslí tím: Na splněný cíl navážeme větším cílem. To je přece odměna.",
      "Řekne: „Nemusíme se nikam hnát.“ Myslí tím: Stačí udržet náskok podle harmonogramu.",
    ],
    "one-liner": [
      "I tvoje spontánnost čeká na schválení nadřízené spontánnosti.",
      "U tebe i padající hvězda musí nahlásit, co tím pádem sleduje.",
    ],
  },

  vodnar: {
    "sejde-se": [
      "Sejde se deset Vodnářů v půjčovně kol. Ty navrhneš, jestli se nedá půjčit koncept pohybu.",
      "Sejde se deset Vodnářů u kulatého stolu. Ty sedíš mimo kruh, aby se to nezvrhlo v tradici.",
    ],
    dovolena: [
      "Na dovolené se vyhneš doporučením. Pak napíšeš návod, jak se jim mají vyhýbat všichni ostatní.",
      "Na hotelový dotazník napíšeš: „Postel dobrá, koncept spaní zastaralý.“",
    ],
    zprava: [
      "Na „Kde se sejdeme?“ pošleš souřadnice. Ve čtyřech rozměrech.",
      "Na „Máš nabíječku?“ odpovíš návrhem společnosti, která už nabíječky nepotřebuje. Telefon se mezitím vypne.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Zkusme to jednoduše.“ Myslí tím: Zrušíme dosavadní pojetí jednoduchosti.",
      "Řekne: „Nechci měnit téma.“ Myslí tím: Chci změnit pravidla, podle kterých tu vůbec vznikají témata.",
    ],
    "one-liner": [
      "Když všichni plavou proti proudu, požádáš o jinou řeku.",
      "Tlačítko „Jiné“ ti připadá podezřele omezující.",
    ],
  },

  ryby: {
    "sejde-se": [
      "Sejde se deset Ryb v obchodě s hodinami. Ty se zeptáš, jestli nemají čas, který tolik netlačí.",
      "Sejde se deset Ryb u úschovny. Ty chceš odložit náladu ze včerejšího filmu.",
    ],
    dovolena: [
      "Na dovolené ti písnička z kavárny změní celý den. Rezervaci trajektu to bohužel nezajímá.",
      "V hotelu si vybereš pokoj podle toho, jaký příběh má světlo na zácloně. Recepce to marně hledá v nabídce.",
    ],
    zprava: [
      "Na „Jsi tady?“ odpovíš „Tak napůl“. Poloha přesnější než většina map.",
      "Na „V kolik?“ pošleš fotku oblohy. Má správnou náladu, jen jí chybí minutová ručička.",
    ],
    "rika-vs-mysli": [
      "Řekne: „Dávám pozor.“ Myslí tím: Jen se ta věta mezitím proměnila v loď a teď potřebuje přístav.",
      "Řekne: „Už jdu.“ Myslí tím: Ještě musím ukončit rozhovor s představou, jaké by to bylo nikam nejít.",
    ],
    "one-liner": [
      "Tvoje myšlenky mají tajnou chodbu, o které diář neví.",
      "Umíš se zasnít tak důkladně, že i oblak musí počkat, až na něj přijde řada.",
    ],
  },
};

export const CATALOG: CatalogJoke[] = buildCatalog(RAW_CATALOG as Record<SignId, Record<Series, string[]>>);
