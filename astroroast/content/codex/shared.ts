// AstroRoast.ai: společné texty varianty Codex, původní české pointy pro všechna znamení.
// Obsah se skládá s texty jednotlivých znamení; datový tvar odpovídá druhé variantě.

import type { Topic } from "../../types";
import type { CouplePairContent, ElementPairKey, Five } from "../types";

/** Závěrečné věty podle tématu a úrovně: vždy čtyři, použitelné pro kterékoli znamení. */
export const KICKERS: Record<Topic, Five<string[]>> = {
  vztahy: [
    [
      "Umíš i obyčejnému úterý dodat jiskru. Občas stačí, že navrhneš společně něco uvařit.",
      "Máš vlastní způsob, jak říct „záleží mi na tobě“. Občas k němu přibal i titulky.",
      "Do vztahu přinášíš něco, co nejde naplánovat: sebe. To je docela hezké překvapení.",
      "Vedle tebe mají i drobnosti význam. Ano, i ta poslední sušenka je malý milostný příběh.",
    ],
    [
      "Říkáš „vyber něco ty“ a pak dodáš tři podmínky. Romantika na míru.",
      "Na rande umíš vytvořit atmosféru. Jen jí pak nenápadně určíš, jaká přesně má být.",
      "Chceš vztah bez zbytečných her. Kromě hádání, co přesně znamená tvoje „hmm“.",
      "Umíš udělat první krok. Pak ještě nenápadně ukážeš, kam má vést ten druhý.",
    ],
    [
      "Nasloucháš druhému názoru. Je slušné nechat ho zaznít před tím správným.",
      "Ve vztahu chceš naprostou upřímnost. V podobě, kterou si předem schválíš.",
      "Kompromis uznáš, jakmile se dostatečně podobá tvému původnímu návrhu. Do té doby jde o nedorozumění.",
      "Říkáš „to je v pohodě“ tak přesvědčivě, že se na to všichni radši ještě jednou zeptají.",
    ],
    [
      "I výběr společné pizzy s tebou potřebuje ústavu. A ty už píšeš dodatek o ananasu.",
      "Ve vztahu zabereš tolik prostoru, že i tvoje „nic“ má vlastní pokoj.",
      "Chceš vztah jako z filmu. Zatím si nárokuješ režii, střih i právo zakázat druhému improvizaci.",
      "Ustoupíš o krok a čekáš potlesk. Vztah s tebou má slavnostní předávání kompromisů.",
    ],
    [
      "Na rande si bereš vlastní gravitaci. Venuše kolem tebe krouží a čeká, až ji pustíš ke slovu.",
      "K tvému „mně je to jedno“ musí mezihvězdný úřad přiložit sedmnáct povinných podmínek a mapu výjimek.",
      "Tvůj ideální vztah potřebuje dva vesmíry: v jednom máš pravdu, ve druhém ti ji právě dávají.",
      "Kvůli tvým nárokům na romantiku staví galaxie druhou Mléčnou dráhu. Ta první prý nemá správnou atmosféru.",
    ],
  ],
  prace: [
    [
      "Umíš do práce přinést vlastní nápad. A pak ho propašovat i do zadání.",
      "Díky tobě mají i běžné úkoly osobitost. Sešívačka zatím zůstává neutrální.",
      "Když se do něčeho pustíš, dodáš tomu jiskru. Porada konečně obsahuje i něco živého.",
      "Máš cit pro to, co jde udělat lépe. Tvůj seznam nápadů už si zaslouží hezkou složku.",
    ],
    [
      "Na krátkou poradu si připravíš jen pár poznámek. Jejich obsah má vlastní obsah.",
      "Označíš si úkol barevně. Už zbývá jen ta drobnost mezi zvýrazněním a dokončením.",
      "Pracuješ samostatně. Hlavně na vlastní verzi toho, co znamená „stručně“.",
      "Při slově „hotové“ máš ještě jeden nápad. Zajímavé, že nikdy při slově „začínáme“.",
    ],
    [
      "Na poradě hledáš řešení. Nejlépe takové, které si všichni zapamatují jako tvoje.",
      "Zvládáš rozjet víc věcí najednou. Dokončení zřejmě patří do jiné pracovní skupiny.",
      "Termín respektuješ. Jako zajímavý názor kalendáře.",
      "Pracuješ na výsledku. Dnes konkrétně na názvu složky, ve které jednou bude.",
    ],
    [
      "K zadání „udělej tečku“ přineseš tři prezentace o budoucnosti interpunkce. Tečka chybí.",
      "Na „jednu drobnou poznámku“ si bereš řečnický pult. Tvůj podpis pod zápisem má pak vlastní titulní stranu.",
      "Vylepšuješ postup tak dlouho, až se i tlačítko „uložit“ ptá, jestli už to myslíš vážně.",
      "Z úkolu na pět minut uděláš projekt s logem. A první úkol projektu je zjistit, proč nemáš čas.",
    ],
    [
      "Na tvoji „drobnou úpravu“ potřebuje Saturn druhý prstenec. První zaplníš připomínkami k názvu.",
      "Tvůj úkol obíhá Slunce už tak dlouho, že má vlastní roční období. Dokončení pořád hlásí jaro příští rok.",
      "Svoláš poradu napříč galaxiemi. Než se všichni připojí, přejmenuješ vesmír na „vesmír_finální_opravdu“.",
      "Založíš mezihvězdné oddělení pro schvalování teček. Velký třesk zatím čeká na tvoje vyjádření.",
    ],
  ],
  zivot: [
    [
      "Umíš si najít vlastní cestu. I když jdeš jen pro pečivo, je z toho malý výlet.",
      "Dáváš obyčejným dnům vlastní barvu. Kalendář ti za to potají závidí.",
      "Máš svoje tempo a dělá ti dobře. Jen výtah má občas jiný názor.",
      "Dokážeš se nadchnout pro maličkosti. Třeba pro sešit, do kterého konečně začneš psát.",
    ],
    [
      "Jdeš si pro jednu věc. Cestou si vytvoříš další čtyři možnosti, proč tam vlastně jdeš.",
      "Chceš žít přítomností. Jen si ji nejdřív potřebuješ trochu přeorganizovat.",
      "Umíš si poradit. Občas si tu radu i poslechni, ať to není jen hezká tradice.",
      "Na nový začátek máš všechno. Teď ještě vybrat pondělí, které si ho zaslouží.",
    ],
    [
      "Všechno máš pod kontrolou. Kontrola se zatím vztahuje na barvu seznamu.",
      "Žiješ podle vlastních pravidel. Jejich změny poznáš podle toho, co se ti právě hodí.",
      "Z každé zkušenosti si něco odneseš. Nejčastěji důvod, proč to příště udělat úplně stejně.",
      "Na jednoduché věci máš vlastní postup. Zřejmě aby neměly nespravedlivou výhodu.",
    ],
    [
      "Chceš otočit život o sto osmdesát stupňů. Zatím zvládáš jen otáčet stránku v dalším plánovači.",
      "I ceduli „tudy“ dokážeš proměnit v životní křižovatku. Navigace u tebe potřebuje přestávku na rozmyšlenou.",
      "Uděláš z maličkosti takovou událost, že i výměna žárovky potřebuje slavnostní program.",
      "Vlastní pravidla obcházíš tak důkladně, že tvoje zkratka vyžaduje stan a mapu pohoří.",
    ],
    [
      "Tvoje „od pondělí“ překračuje časoprostor. Galaxie kvůli němu zavádí osmý den: Příště.",
      "Rozhoduješ se tak dlouho, že kolem tvých možností vznikají nové planety. Všechny čekají na výběr názvu.",
      "V černé díře hledáš smysl života. Do pěti minut jí navrhneš lepší systém pohlcování a svoláš poradu.",
      "Kvůli tvé výjimce z vlastních pravidel musí vesmír přepsat gravitaci. Jablka zatím visí a čekají na razítko.",
    ],
  ],
  pratele: [
    [
      "Umíš z obyčejného setkání udělat dobrou vzpomínku. I bez programu na tři stránky.",
      "S tebou mají společné historky vlastní barvu. Občas ji při vyprávění ještě trochu přidáš.",
      "Do party přinášíš něco svého. Na společné fotce to obvykle poznáš jako první.",
      "Dovedeš podržet dobrou náladu. Hlavně když ti nikdo nesedí na oblíbeném místě.",
    ],
    [
      "Na srazu vyprávíš jen jednu historku. Má ovšem šest vedlejších dějů a přestávku.",
      "Ve skupinové zprávě chceš jen upřesnit čas. Za chvíli se hlasuje o názvu celé akce.",
      "Říkáš „hlavně v klidu“ a už posíláš druhou zprávu, jak přesně má ten klid vypadat.",
      "Na společnou fotku se tváříš nenuceně. Pátý pokus už skoro vypadá náhodně.",
    ],
    [
      "Dáváš prostor ostatním. Hlavně na doplňující otázky ke svému příběhu.",
      "Na setkání jdeš bez očekávání. Seznam věcí, které mají být jinak, vznikne až na místě.",
      "Říkáš „nechci do toho mluvit“. Následujících dvanáct minut je zřejmě jen zvuková ilustrace.",
      "Ve skupině respektuješ většinu. Pokaždé, když se s tebou shodne.",
    ],
    [
      "S tebou je domluva úniková hra. Všechny indicie znějí „mně je to jedno“ a dveře se otevírají jen podle tebe.",
      "Z pozvání na procházku uděláš volební kampaň. Zbývá přesvědčit lavičky, aby podpořily tvoji trasu.",
      "I když jen přikyvuješ, zvládneš si přivlastnit hlavní děj. V tvé historce mají kamarádi roli kulis.",
      "Svoje „stručně“ natáhneš na celovečerní zážitek. Kamarádi už si na tvoje hlasové zprávy nosí svačinu.",
    ],
    [
      "Na tvoje „už jdu“ čeká celá galaxie. Světlo má náskok třináct miliard let a stejně dorazí dřív.",
      "Při domluvě srazu otevřeš tolik možností, že skupina dostane vlastní multivesmír. Ani v jednom není jasné kde.",
      "Vyprávíš historku tak dlouho, že kolem hlasové zprávy vznikne planetární soustava. Pointa je zatím za Neptunem.",
      "Na společném výletě naviguješ i souhvězdí. Velký vůz už otáčí, protože tvoje zkratka prý vede přes jinou galaxii.",
    ],
  ],
  narozeniny: [
    [
      "Dnes máš dobrý důvod nechat se trochu rozmazlovat. K druhému kousku dortu důvod nepotřebuješ.",
      "Máš svůj den. A lidi, kteří ho chtějí slavit s tebou. Svíčky jsou jen příjemné osvětlení.",
      "Umíš dát oslavě vlastní kouzlo. Někdy stačí, že se u dortu sejdou tvoje oblíbené tváře.",
      "Dnes můžeš zazářit přesně po svém. Papírová korunka je nepovinná, ale sluší té příležitosti.",
    ],
    [
      "Tvrdíš, že nic nechceš. Seznam nenápadných nápověd už má záložky.",
      "Dort si přeješ jako překvapení. Jen předem upřesníš chuť, barvu a přesný druh překvapení.",
      "Oslavu chceš malou. Jen s dortem, výzdobou a přiměřeným množstvím pozornosti. Hodně přiměřeným.",
      "Necháváš ostatní vybrat hudbu. První skladbu jim pro jistotu rovnou napovíš.",
    ],
    [
      "Slavíš úplně nenápadně. Jen tři příspěvky, odpočet a připomínka pro případ, že by nenápadnost zabrala.",
      "Při rozbalování dárku oceňuješ hlavně nápad. Zvlášť když odpovídá odkazu, který posíláš od září.",
      "Oslavu necháváš volně plynout. Podle harmonogramu, který mají všichni v telefonu.",
      "Dnes o sobě necháš mluvit ostatní. Máš přece narozeniny, tak ať se taky trochu zapojí.",
    ],
    [
      "Narozeniny roztáhneš na celý týden. I dort už má napsanou žádost o střídání.",
      "Při sfoukávání si přeješ další pozornost. Svíčky zhasnou a ty si objednáš přídavek.",
      "Z malé oslavy uděláš festival vlastní důležitosti. Chybí už jen stánek se suvenýry tvého příchodu.",
      "Než dovolíš nakrojit dort, zorganizuješ tolik focení, že má poleva vlastní profesní portfolio.",
    ],
    [
      "Na narozeniny požaduješ vlastní souhvězdí. Stávající se prý z tvého úhlu nedají pořádně vyfotit.",
      "Slavíš tak velkolepě, že Slunce obíhá kolem dortu. Konečně podle tebe funguje vesmír správně.",
      "Necháš si z prstenců Saturnu vyrobit slavnostní čepičku. Pak reklamuješ velikost: ještě se pod ni musí vejít tvoje přání.",
      "Mezigalaktický úřad kvůli tvé oslavě přidává měsíc do kalendáře. Ty se ptáš, proč jen jeden.",
    ],
  ],
};

/** Přátelské závěry pro příjemce karty: čtyři na každou ze tří povolených úrovní. */
export const FRIEND_KICKERS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Dostáváš malou hvězdnou poštu. Kdyby šla obálka obejmout, vypadá přesně takhle.",
    "Máš tu pozdrav s drobným pošťouchnutím. Taková kamarádská pětka od vesmíru.",
    "Svoje zvláštnosti si nech. Právě díky nim máš v partě nezaměnitelné místo.",
    "Dnes máš potvrzeno, že na tebe někdo myslí. A že u toho vybírá hvězdnou výzdobu.",
  ],
  2: [
    "Zkus se tvářit překvapeně. Hvězdám to udělá radost, ve skupině už tuhle pointu znají.",
    "Na kamarádskou popichovačku můžeš odpovědět stejnou kartou. Jen vyber správné znamení, ať hvězdy nepomlouvají vedle.",
    "Máš tu drobné rýpnutí na dálku. Aspoň ti u toho nikdo neujídá hranolky.",
    "Tuhle kartu si můžeš schovat mezi milé zprávy. Hned vedle toho „tohle jsi přesně ty“.",
  ],
  3: [
    "S hvězdami můžeš nesouhlasit. Ve skupině tím pouze zahájíš sběr příkladů.",
    "Ke kartě dostáváš právo na odpověď. Tvrzení „já to tak nemám“ ovšem není protiargument, ale tradiční úvod.",
    "Teď můžeš vysvětlit, proč to na tebe nesedí. Kamarádi si na tvoje vysvětlování raději udělají pohodlí.",
    "Na obranu máš celé souhvězdí. Na opačné straně ovšem sedí někdo, kdo tě zná i mimo horoskop.",
  ],
};

/** Záměrně smyšlená měřítka: čtyři dvojice popisku a hodnoty pro každé téma. */
export const TOPIC_STATS: Record<Topic, { label: string; value: string }[]> = {
  vztahy: [
    { label: "Dodatky k větě „vyber ty“", value: "7 podmínek" },
    { label: "Významů jednoho „hmm“", value: "nejméně 12" },
    { label: "Podíl tvého návrhu v kompromisu", value: "97 %" },
    { label: "Délka debaty o večeři", value: "2 chody napřed" },
  ],
  prace: [
    { label: "Rozsah drobné připomínky", value: "18 příloh" },
    { label: "Verzí s názvem „finální“", value: "26 a přibývají" },
    { label: "Porad nutných ke zrušení porady", value: "5 navazujících" },
    { label: "Podíl práce na názvu projektu", value: "89 %" },
  ],
  zivot: [
    { label: "Odboček na vlastní zkratce", value: "14 zastávek" },
    { label: "Odklad nového začátku", value: "o 8 pondělků" },
    { label: "Pravidel pro spontánní den", value: "23 výjimek" },
    { label: "Váha drobného rozhodnutí", value: "1 státní svátek" },
  ],
  pratele: [
    { label: "Vedlejších dějů jedné historky", value: "6 odboček" },
    { label: "Hlasování před krátkou procházkou", value: "16 kol" },
    { label: "Stopáž stručné hlasové zprávy", value: "42 minut" },
    { label: "Pokusů o nenucenou fotku", value: "8 přirozených" },
  ],
  narozeniny: [
    { label: "Zkušebních záběrů dortu", value: "31 před krájením" },
    { label: "Délka narozeninového dne", value: "168 hodin" },
    { label: "Nenápadných odkazů na dárek", value: "19 náhodných" },
    { label: "Požadovaný jas pozornosti", value: "2 Slunce" },
  ],
};

// ---------------------------------------------------------------------------
// Dvojice: společné situace, střety živlů a závěrečné poznámky.
// ---------------------------------------------------------------------------

/** Šest situací v pevném významovém pořadí, odpovědi mají stejný index v RawSign.q. */
export const COUPLE_SITUATIONS: string[] = [
  "Blíží se večeře. Kam si dnes zajdeme?",
  "Máme před sebou víkend. Co podnikneme?",
  "Na telefonu přistává zpráva. Co odepíšeme?",
  "Ve dřezu přibývá nádobí. Kdo se pustí do mytí?",
  "Je čas naplánovat dovolenou. Kam vyrazíme?",
  "Usadíme se na gauči. Na co se dnes podíváme?",
];

export const COUPLE_PAIRS: Record<ElementPairKey, CouplePairContent> = {
  "ohen-ohen": {
    intros: [
      "Oheň potkává oheň. Obě strany mají úvodní slovo a závěrečný potlesk už taky rozdělený. Sobě.",
      "Dva ohně se chtějí dohodnout v klidu. Začíná soutěž, kdo ten klid vyhlásí hlasitěji.",
    ],
    titles: ["Dvojí hlavní role", "Potlesk na přetahovanou"],
    verdicts: [
      "Jiskru máte. Teď ještě občas střídat, kdo smí zapálit téma hovoru.",
      "Poslední slovo si chcete nechat pro sebe. Aspoň máte důvod v rozhovoru pokračovat.",
    ],
  },
  "ohen-zeme": {
    intros: [
      "Oheň hlásí „jdeme“. Země přikládá seznam podmínek. Obě strany to nazývají pomocí při rozjezdu.",
      "Oheň už slaví výsledek, země ještě kontroluje postup. Společně zvládnou předběhnout i zdržet tutéž věc.",
    ],
    titles: ["Nadšení s přílohou", "Hurá, ale dle návodu"],
    verdicts: [
      "Z nadšení děláte plán a z plánu závod. Jen cíl se vás pořád ptá, jestli už je schválený.",
      "Máte dvě vlastní tempa. Společný krok zatím vypadá jako rozjezd s ruční brzdou.",
    ],
  },
  "ohen-vzduch": {
    intros: [
      "Oheň chce začít okamžitě, vzduch přidává další nápad. Společně už otevírají třetí věc, než dokončí název první.",
      "Vzduch řekne „co kdyby“ a oheň rovnou stříhá slavnostní pásku. Návod se k nim teprve snaží dostat.",
    ],
    titles: ["Nápad bez přistání", "Hurá do dalšího hurá"],
    verdicts: [
      "Inspirace mezi vámi létá skvěle. Dokončený úkol zatím zůstává teoretickou možností.",
      "Míříte vysoko. Začněte třeba tečkou za jedním společným nápadem.",
    ],
  },
  "ohen-voda": {
    intros: [
      "Oheň říká věci naplno, voda hledá, co je mezi řádky. Obě strany se diví, proč ta druhá čte jiný příběh.",
      "Oheň zvyšuje hlasitost, voda přidává význam. Z výběru večeře vzniká dramatizace o třech dějstvích.",
    ],
    titles: ["Večeře s podtextem", "Jiskra má připomínky"],
    verdicts: [
      "Máte dost jisker i hloubky. K obyčejnému „ano“ ale občas připojte návod na čtení.",
      "Toužíte po velkém porozumění. Zatím máte dvě různé vysílací frekvence a obě naplno.",
    ],
  },
  "zeme-zeme": {
    intros: [
      "Dvě země se shodnou, že změna není nutná. Pak hodinu ladí přesné znění té shody.",
      "Země se zemí mají pevné základy. Každá ovšem pod svým názorem, takže společný plán potřebuje dva vchody.",
    ],
    titles: ["Dvě nehybná stanoviska", "Spontánnost po schválení"],
    verdicts: [
      "Na vás je spoleh. Zvlášť když jde o setrvání u vlastního návrhu.",
      "Budoucnost máte promyšlenou. Teď jí ještě dovolit, aby se trochu lišila od zápisu.",
    ],
  },
  "zeme-vzduch": {
    intros: [
      "Země chce konkrétní krok, vzduch přináší širší souvislosti. Obě strany právě komplikují cestu do obchodu.",
      "Země sepíše tři body. Vzduch ke každému doplní pět možností. Obě strany tvrdí, že to chtějí zjednodušit.",
    ],
    titles: ["Seznam dostává křídla", "Nápad v pořadači"],
    verdicts: [
      "Nápad umíte uzemnit i rozvětvit. Vybrat jednu větev už ovšem v zadání nebylo.",
      "K řešení míříte společně: po schodech a přes úvahu o létání. Sejdete se, až se shodnete, kde je nahoře.",
    ],
  },
  "zeme-voda": {
    intros: [
      "Země nabídne deku, voda se ptá, co tím myslí. Pak voda nabídne druhou a země začne řešit, kam ji uložit.",
      "Země hlídá pohodlí, voda atmosféru. Než si spolu sednou, má gauč pravidla používání i vlastní náladu.",
    ],
    titles: ["Deka s podmínkami", "Pohodlí se projednává"],
    verdicts: [
      "Pečujete o každý detail i jeho pocity. Občas si dovolte nechat polštář prostě ležet.",
      "Domov umíte vytvořit dokonale. Včetně společného seznamu důvodů, proč z něj nikam nechodit.",
    ],
  },
  "vzduch-vzduch": {
    intros: [
      "Dva vzduchy začnou u večeře a skončí u budoucnosti měst. Otázka, co si dát, pořád čeká na zařazení do debaty.",
      "Vzduch se vzduchem mají na všechno nový pohled. Na původní otázku už bohužel nikdo nevidí.",
    ],
    titles: ["Dohoda v průvanu", "Dvě čárky bez tečky"],
    verdicts: [
      "Rozhovor vám běží skvěle. Jen dohoda pořád nemá vybrané místo, kde by přistála.",
      "Pořád máte co dodat. Vaše společná věta proto dosud nevstoupila do závěrečné fáze.",
    ],
  },
  "vzduch-voda": {
    intros: [
      "Vzduch rozebírá, proč vzniká nálada. Voda zkoumá, jaký pocit má z toho rozboru. Obě strany právě přidávají další téma.",
      "Vzduch chce pojmenovat problém, voda zachytit jeho odstín. Obě strany nakonec ladí název pro pocit z názvu.",
    ],
    titles: ["Podtext pod čarou", "Nálada má osnovu"],
    verdicts: [
      "Hledáte, co je za tím. Z obou stran. Původní věta už si mezitím může jít po svém.",
      "Dokážete probrat pocit z rozhovoru o pocitech. K samotné věci se vrátíte v další řadě.",
    ],
  },
  "voda-voda": {
    intros: [
      "Dvě vody si všechno vyčtou z tónu. I když nikdo nemluví. Zvlášť tehdy.",
      "Voda s vodou říkají „nic se neděje“. Každá čeká, že právě tahle věta druhé straně vysvětlí úplně všechno.",
    ],
    titles: ["Ticho s obsahem", "Dvě tečky, celý román"],
    verdicts: [
      "Zachytíte každou náladu. Teď ještě zjistit, jestli vůbec někomu z vás patří.",
      "Máte pro sebe hluboké pochopení. Škoda, že každá strana pro jinou verzi rozhovoru.",
    ],
  },
  stejne: {
    intros: [
      "Stejné znamení na obou stranách. Každá strana teď konečně slyší, jak zní její úplně rozumný požadavek.",
      "Obě strany vědí, jak se má postupovat. Překvapení přichází ve chvíli, kdy stejný nárok uplatní i ta druhá.",
      "Dvě stejná znamení si rozumí bez vysvětlování. Získaný čas věnují vysvětlování, proč má pravdu zrovna jejich verze.",
    ],
    titles: ["Souhlasím, ale po svém", "Vlastní názor v ozvěně"],
    verdicts: [
      "Přejete si pochopení bez podmínek. A přikládáte k němu dvě totožné sady podmínek.",
      "Na všem se shodnete, dokud se nerozhoduje, čí nápad ta shoda vlastně je.",
    ],
  },
};

/** Společná poslední replika: čtyři varianty pro každou úroveň páru. */
export const COUPLE_OUTROS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Máte vlastní společný rytmus. Občas je to duet dvou různých písniček, ale poslouchá se hezky.",
    "Přinášíte do vztahu dvě osobitosti. A nejhezčí je, že na ně pořád máte společný stůl.",
    "Umíte se potkat i mezi dvěma názory. Třeba u posledního kousku dortu. Rozdělit napůl, prosím.",
    "Máte si co říct. I když se vaše věty rozběhnou různými směry, často se potkají u stejné pointy.",
  ],
  2: [
    "Shodnete se, že je čas na kompromis. Teď ještě shodně určit, kdo s ním začne.",
    "Máte to hezky rozdělené: střídáte se v navrhování i v čekání, až se druhá strana přizpůsobí.",
    "Na společnou cestu máte dva názory. Aspoň je co probírat, než vůbec vyjdete.",
    "Chcete totéž: trochu pochopení a poslední kousek dortu. Zatím se řeší hlavně ten dort.",
  ],
  3: [
    "Dáváte si navzájem prostor. Přesně tolik, kolik zabere souhlas s vaším návrhem.",
    "Máte ukázkovou vzájemnou podporu. Každá strana pevně podpírá svůj původní názor.",
    "Debata končí shodou: vaše nejlepší rady platí výhradně pro protější stranu.",
    "Právě dokazujete, že k nekonečné debatě stačí dva lidé, jedna drobnost a oboustranný smysl pro vlastní pravdu.",
  ],
};

/** Krátké reakce druhého hlasu, když mají obě strany stejné znamení. */
export const STEJNE_ECHO: string[] = [
  "To je i moje verze. Jen u ní počítám s trochu větším prostorem pro sebe.",
  "Souhlasím. Teď se ještě shodnout, že ten nápad pochází ode mě.",
  "Ano. Když to ale slyším od tebe, mám najednou pár připomínek.",
  "Doplním jedinou věc: přesně totéž, trochu důrazněji.",
  "Beru. A proč to zní tak zvláštně, když to jednou neříkám já?",
  "Konečně rozumný návrh. Teď ještě rozhodnout, kdo z nás ho smí upravit.",
];
