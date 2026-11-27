// AstroRoast.ai: původní české texty varianty Codex pro znamení Ryby.
// RawSign: h 3, c 2 a v 2 na každé z pěti úrovní (index 0 = úroveň 1).
// t: vztahy, prace, zivot, pratele, narozeniny; každé téma má 5 úrovní po přesně 4 větách.
// s: 6 dvojic [popisek, krátká hodnota]. d: 24 dnešních jednovětek bez předpovědí.
// q: 6 odpovědí v pořadí COUPLE_SITUATIONS v codex/shared.ts.
// Stupňování: pohlazení → šťouchnutí → sarkasmus → ostrá nadsázka → kosmická absurdita.
// Věty oslovují čtenáře bez určení rodu; párové odpovědi jsou přímá řeč znamení.
// Terčem jsou pouze rybí stereotypy: snění, empatie, romantizování a rozostřené hranice.

import type { RawSign } from "../../types";

const ryby: RawSign = {
  h: [
    [
      "I z čekání na tramvaj umíš udělat hezkou scénu.",
      "Všímáš si drobností. I té smutné židle v rohu.",
      "Máš pochopení pro všechno. I pro křivý rohlík.",
    ],
    [
      "Na obyčejné „ahoj“ si bereš literární rozbor.",
      "Než řekneš ano, zjistíš, jakou má odpověď atmosféru.",
      "I nákupní seznam si u tebe zaslouží hudební doprovod.",
    ],
    [
      "Fakta uznáváš. Jako jednu z méně poetických možností.",
      "Tvoje intuice má vždycky pravdu. Stačí přepsat otázku.",
      "Realitu přijímáš v úředních hodinách. Ty zatím neurčuješ.",
    ],
    [
      "Z jedné čárky ve zprávě vyrábíš třídílnou vztahovou katastrofu.",
      "Zadání má jednu větu. Ty k němu dodáváš mlhu a zakázané pokračování.",
      "Máš tak rozmazané hranice, že ti přes ně chodí i tapeta.",
    ],
    [
      "Zasníš se tak důkladně, že vesmír musí restartovat přítomnost.",
      "Tvůj podtext má vlastní galaxii. Původní zpráva v ní nemá občanství.",
      "Na Neptunu po tobě chtějí jednu jasnou větu. Už stavíš náhradní vesmír.",
    ],
  ],
  c: [
    [
      "Umíš dát obyčejnému dni hezký detail. Třeba jméno mraku, který zrovna doprovází tvůj nákup.",
      "Dovedeš naslouchat i tichu. Jen mu občas nabídneš, jestli si nechce přisednout.",
    ],
    [
      "Když řekneš „to nějak cítím“, máš hotový závěr. Ještě by se hodilo zjistit, čeho se týká.",
      "K obyčejné vzpomínce si přidáš hezčí světlo. Skutečnost má u tebe drobné kosmetické úpravy.",
    ],
    [
      "Podtext si dohledáš i ve větě „Zavřeno“. Je dobře, že se otevírací doba umí tak hluboce svěřit.",
      "Rozhoduješ se podle pocitu. Výsledky posuzuješ podle jiného pocitu. Kontrola kvality je tedy nezávislá.",
    ],
    [
      "Pleteš si intuici s vlastní tvorbou tak důsledně, že by se tvoje tušení mělo prodávat v oddělení beletrie.",
      "Z jedné nepovedené domněnky postavíš tak obří kulisy, že se pravda musí ptát vrátnice, kudy dovnitř.",
    ],
    [
      "Vesmíru posíláš tolik nevyřčených přání, že má Mléčná dráha přílohu „A co tím Ryby vlastně myslí“.",
      "Sníš v takovém rozlišení, že kvůli tobě černá díra zavádí pořadníky na místo pro další představu.",
    ],
  ],
  v: [
    [
      "Nech si tu představivost. I obyčejné pondělí s tebou dostane hezkou vedlejší roli.",
      "S tvým citem pro drobnosti si i poslední kousek skládačky připadá vítaně.",
    ],
    [
      "Klidně čti mezi řádky. Jen občas mrkni i na řádek.",
      "Důvěřuj pocitu. Čas odjezdu si ale nech potvrdit jízdním řádem.",
    ],
    [
      "Svým dojmům věříš bez důkazů. Od důkazů naopak vyžaduješ přesvědčivější atmosféru.",
      "Máš otevřeno všem možnostem. Jedna z nich by časem mohla být i odpověď.",
    ],
    [
      "Z běžné situace děláš festival pocitů. A pak si stěžuješ, že se v programu nedá vyznat.",
      "Máš talent číst myšlenky. Zatím výhradně ty, které druhým přiděluješ.",
    ],
    [
      "Za tvůj přínos mlžení ti galaktický úřad přiděluje vlastní souhvězdí. Souřadnice si máš vycítit.",
      "Tvoje „nevím, ale cítím“ už má planetární soustavu. Jasná odpověď v ní obíhá jako nepotvrzená hypotéza.",
    ],
  ],
  t: {
    vztahy: [
      [ // úroveň 1
        "Pamatuješ si oblíbenou písničku druhého člověka. A pro jistotu i tu, která k ní hezky navazuje.",
        "Umíš udělat z procházky malé rande. I když vede jen k vracení knih.",
        "Ve vztahu si všímáš maličkostí. Třeba že společné ticho nepotřebuje opravit.",
        "Dáváš najevo náklonnost drobnostmi. Z lístku „nezapomeň klíče“ umíš udělat milý vzkaz.",
      ],
      [ // úroveň 2
        "Než odpovíš na srdíčko, hledáš písničku, která vystihne správný odstín odpovědi.",
        "K romantické večeři vybíráš svíčku tak pečlivě, jako by měla vést rozhovor.",
        "Při plánování rande řešíš hlavně atmosféru. Adresu bereš jako drobný technický dovětek.",
        "Na otázku „co chceš?“ řekneš „něco hezkého“. I při výběru společného prostěradla.",
      ],
      [ // úroveň 3
        "Odpověď „dobře“ zkoumáš ze všech stran. Čtyři písmena, a tolik odborné práce.",
        "Vztahovou domluvu nahrazuješ náznakem. Překlad zajišťuje druhá strana, záruku neposkytuješ.",
        "Zamiluješ se do možností. Přítomná osoba se o případné aktualizaci dozví průběžně.",
        "Své „nic se neděje“ opatříš tak výrazným tichem, že by si zasloužilo vlastní titulky.",
      ],
      [ // úroveň 4
        "Na rande nepoznáváš člověka. Obsazuješ roli ve filmu, ke kterému už máš hotové tři rodinné ságy.",
        "Z jedné tečky za zprávou stavíš rozchodové drama. Interpunkce by proti tobě měla mít právní zastoupení.",
        "Své potřeby balíš do tolika náznaků, že jejich rozbalení vydá na celou výroční dovolenou.",
        "Ve vztahu čekáš čtení myšlenek. Přitom i vlastní přání zveřejňuješ jako ukázku z dosud nenapsané knihy.",
      ],
      [ // úroveň 5
        "Venuši žádáš o překlad jednoho srdíčka. Po šesti mezihvězdných komisích ti odpoví: „Asi srdíčko.“",
        "Ke každé možné lásce tvoříš paralelní vesmír. Multivesmír už po tobě chce aspoň seznam postav.",
        "O tom, co ti ve vztahu chybí, vyšleš tak jemný náznak, že ho zachytí až dalekohled na opačném konci vesmíru.",
        "Kvůli tvému rozboru věty „tak zatím“ svoláváš galaktickou radu. Slovo „zatím“ mezitím opouští jazyk.",
      ],
    ],
    prace: [
      [ // úroveň 1
        "Do práce přinášíš nápady, které by tabulku nenapadly. Tabulka děkuje, trochu se nudí.",
        "Všímáš si nálady při poradě. A umíš říct něco vlídného dřív, než přijde sedmý graf.",
        "U obyčejného úkolu najdeš hezčí řešení. I složka „ostatní“ s tebou dostane trochu péče.",
        "Dovedeš si představit výsledek, který ještě neexistuje. Občas mu rovnou vybereš i příjemné pozadí.",
      ],
      [ // úroveň 2
        "Do pracovních poznámek si kreslíš vlnky. Úkol pod nimi dostává velmi příjemné pobřeží.",
        "Před odesláním zprávy třikrát měníš pozdrav, aby se úkol necítil moc úředně.",
        "Na poradě hledáš společnou řeč. Občas ji najdeš tak daleko od tématu, že potřebuješ cestu zpátky.",
        "Pro soubor hledáš výstižný název. „Návrh“ ti připadá málo procítěné.",
      ],
      [ // úroveň 3
        "Na termín se díváš jako na tvůrčí omezení. Zadání bohužel tento žánr neuvádí.",
        "Nápad máš dokonale promyšlený. Soubor je prázdný, aby představě nic nepřekáželo.",
        "Z porady si odnášíš celkový pocit. Zápis konkrétních úkolů necháváš méně citlivým médiím.",
        "Pracovní postup volíš intuitivně. Opakovatelnost výsledku by zbytečně kazila překvapení.",
      ],
      [ // úroveň 4
        "Na otázku „kde je výsledek?“ předkládáš atmosféru. Zakládáš tím nové odvětví neviditelných dodávek.",
        "Termíny rozpouštíš v pocitech tak úspěšně, že by se tvůj kalendář měl prodávat v tubě jako vodovky.",
        "K zadání přidáš tolik vlastních významů, že původní úkol potřebuje jmenovku, aby ho vůbec někdo poznal.",
        "Místo dokončení úkolu si představuješ potlesk. Na předávání prázdné přílohy dost odvážná dramaturgie.",
      ],
      [ // úroveň 5
        "V hlavě dokončuješ projekt pro Neptun. Galaktickému úřadu odevzdáváš pocit z přílohy, která existuje pouze při úplňku.",
        "Svým pracovním tempem nutíš Saturn přidat třináctý měsíc. Vyhradíš si ho na hledání správné nálady.",
        "Na poradě galaxií popisuješ vizi tak dlouho, že z pracovního návrhu vzniká nové souhvězdí. Příloha pořád nikde.",
        "Termín posouváš za horizont černé díry. Konečně máš fyzikální důkaz, že na výsledek zatím nikdo nedohlédne.",
      ],
    ],
    zivot: [
      [ // úroveň 1
        "Na obyčejné cestě najdeš pěkný detail. A někdy kvůli němu dobrovolně mineš správnou odbočku.",
        "Dokážeš si užít chvíli bez programu. I prázdné místo v diáři u tebe působí útulně.",
        "Ke každé drobnosti si vymyslíš příběh. Hrnek od snídaně tak má pestřejší dopoledne.",
        "Umíš se zastavit u hezkého výhledu. Nákupní taška si zatím taky trochu odpočine.",
      ],
      [ // úroveň 2
        "Jdeš pro jednu věc a vracíš se s nápadem na přestavbu pokoje. Ta věc se zatím řeší.",
        "Při úklidu najdeš starou vstupenku a na chvíli přepneš z domácnosti do vzpomínkového kina.",
        "U budíku hledáš tón, který respektuje tvou ranní atmosféru. Vstávání zatím čeká na hudbu.",
        "Seznam úkolů začínáš hezkým nadpisem. I povinnosti přece chtějí příjemný první dojem.",
      ],
      [ // úroveň 3
        "Čas vnímáš jako plynulý. Jízdní řád o téhle dohodě zatím neví.",
        "Doma máš systém podle pocitu. Zajímavé, že klíče tak často volí jiný pocit než ty.",
        "Praktická rozhodnutí odkládáš, dokud nepřijde znamení. Rozsvícené „vstupte“ se zřejmě nepočítá.",
        "Každodennost si překládáš do poezie. „Vynést koš“ má teď čtyři sloky a žádný pohyb.",
      ],
      [ // úroveň 4
        "Tak dlouho hledáš hlubší smysl obyčejného úkolu, až by si i výměna žárovky zasloužila vlastní trilogii.",
        "Zákaznickou podporu reality zahlcuješ dotazy, jestli by se dnešek nedal vyměnit za tu hezčí verzi z tvé hlavy.",
        "Před každým rozhodnutím čekáš na správný pocit. I tvoje odkládání už má pocit, že ho odkládáš.",
        "Ke ztraceným klíčům si vymyslíš tak dojemnou minulost, že je nakonec hledáš v knihovně mezi romány.",
      ],
      [ // úroveň 5
        "Do černé díry schováváš běžné povinnosti. Pak jí posíláš svíčku a dotaz, jestli toho na ni není moc.",
        "Svou odbočku do snění protahuješ přes sedm galaxií. Navigaci nastavuješ na „někde, kde se nemusí nic řešit“.",
        "Své náladě přizpůsobuješ časoprostor. Kvůli vynesení koše teď galaxie čeká na vhodné století.",
        "Galaktickému úřadu hlásíš ztrátu kontaktu s realitou. Jako poslední známou polohu uvádíš „někde mezi slokami“.",
      ],
    ],
    pratele: [
      [ // úroveň 1
        "Umíš nechat druhého domluvit. Dokonce i když příběh začíná popisem všech cestou potkaných psů.",
        "Pro společné chvíle máš cit. I z posezení na lavičce uděláš malou tradici.",
        "V partě si všímáš, kdo se ještě nedostává ke slovu. A nabídneš prostor bez slavnostního vyhlašování.",
        "Pamatuješ si drobné radosti druhých. Přepošleš obrázek jejich oblíbeného místa, i když zrovna slavíš jen úterý.",
      ],
      [ // úroveň 2
        "Na společné fotce řešíš hlavně náladu okamžiku. To, že fotíš sloup, je drobná vedlejší zápletka.",
        "Do skupinové domluvy přidáš srdíčko. Datum tím nepotvrdíš, ale je to od tebe velmi milé srdíčko.",
        "Na „máš chvilku?“ odpovíš ano. Teprve pak se podíváš, kolik těch chvilek už někde slibuješ.",
        "Na setkání přineseš drobnost s příběhem. Samotné předání se tím trochu protáhne.",
      ],
      [ // úroveň 3
        "V partě znáš náladu každého. Místo srazu si necháváš jako závěrečné překvapení.",
        "S každým souhlasíš tak citlivě, že ve skupinové hádce podporuješ všechny čtyři protichůdné návrhy.",
        "Na dotaz „dorazíš?“ pošleš fotku oblohy. Jako odpověď neurčité, jako předpověď účasti přesné.",
        "Své „ozvu se“ myslíš hluboce. Problém spočívá jen v přenosu z hloubky na povrch.",
      ],
      [ // úroveň 4
        "Na domluvený sraz přinášíš tolik vysvětlení svého zpoždění, že by se z nich dala pořádat samostatná přednáška.",
        "Přikyvuješ všem stranám tak ochotně, že by si tě hádka mohla pronajmout jako otočné jeviště.",
        "Cizí nálady přebíráš tak důkladně, že by se tvoje vlastní měla při návratu prokazovat občankou.",
        "Za partu si domyslíš tolik nevyřčených pocitů, že máte společné drama i ve dnech, kdy si nikdo nepíše.",
      ],
      [ // úroveň 5
        "Pozvánku na sraz posíláš telepaticky přes Neptun. Pak u Mléčné dráhy reklamuješ nízkou účast.",
        "Souhlasíš se všemi obyvateli galaxie najednou. Mezihvězdnou hádku tím povyšuješ na systém vzájemně výlučných slibů.",
        "Ve skupině přebíráš tolik nálad, že kolem tebe krouží nové emoční měsíce. Vlastní názor hledáš dalekohledem.",
        "Kamarádskou tečku ve zprávě rozebíráš před radou planet. Z obyčejného pokecu tak vyrábíš mezihvězdnou konferenci.",
      ],
    ],
    narozeniny: [
      [ // úroveň 1
        "Na přáníčku oceníš osobní vzkaz. I obyčejné „užij si den“ si u tebe užije chvilku na výstavce.",
        "Umíš dát oslavě příjemnou náladu. I papírový talířek s tebou chvíli působí slavnostně.",
        "Z narozenin si schováváš hezké drobnosti. Třeba stužku, která má podle tebe výborný příběh.",
        "Na oslavě si najdeš chvíli pro každé přání. Dort sice čeká, ale aspoň má čas zazářit.",
      ],
      [ // úroveň 2
        "Svíčku sfoukneš až ve chvíli, kdy k přání vybereš správnou představu. Vosk má zatím vlastní program.",
        "K rozbalování dárku si dopřeješ takovou náladu, že i mašle dostane několik minut uznání.",
        "Na narozeninové fotce hledáš kouzlo okamžiku. Ostření se do tvého tvůrčího záměru nevejde.",
        "Při výběru oslavy uvedeš tři místa a pět pocitů. Hosté si zatím vezmou pohodlné boty.",
      ],
      [ // úroveň 3
        "Chceš oslavu bez velkých očekávání. Jen aby všichni sami přesně vycítili, jaká očekávání máš.",
        "Na otázku, co si přeješ, řekneš „nic“. Následný rozbor tohoto slova už vedeš soukromě.",
        "Balicí papír schováváš kvůli vzpomínkám. Skladovací prostor se dojemně přizpůsobuje.",
        "Přání pronášíš v duchu. Pokyny k jeho splnění ovšem očekáváš v hlavách ostatních.",
      ],
      [ // úroveň 4
        "Od dárku chceš, aby dokazoval hluboké porozumění. I obyčejný hrnek u tebe skládá zkoušku ze společné minulosti.",
        "Narozeninovou náladu režíruješ tak důkladně, že i konfety musejí před pádem pochopit svou motivaci.",
        "K přání si vymyslíš tolik skrytých podmínek, že sfouknutím svíček zahajuješ výběrové řízení na zázrak.",
        "Dárkovou mašli povýšíš na nenahraditelnou památku. Skříň tak měníš v muzeum věcí, které jen něco držely pohromadě.",
      ],
      [ // úroveň 5
        "Přeješ si, aby ti celý vesmír rozuměl beze slov. Neptunu proto vracíš narozeninové přání za nedostatek podtextu.",
        "Na dort si objednáváš svíčky ze souhvězdí. Pak odkládáš sfouknutí, dokud galaxie nepochopí symboliku plamene.",
        "Každé přáníčko archivuješ v jiné galaxii. K narozeninám si tím naděluješ mezihvězdný sklad sentimentu.",
        "Od dárku čekáš tak přesný zásah do vlastních snů, že vesmír musí k mašli přibalit čtečku paralelních realit.",
      ],
    ],
  },
  s: [
    ["Významů jednoho srdíčka", "28"],
    ["Dostupnost v realitě", "12 %"],
    ["Odpovědí ukrytých v náznaku", "9 z 10"],
    ["Vedlejších dějů při nákupu", "7"],
    ["Hodnocení atmosféry", "10 z 10"],
    ["Myšlenek na cestě k pointě", "43"],
  ],
  d: [
    "Dnes máš pro své plány pochopení. I pro ty, které si zatím jen hledají vhodnou náladu.",
    "Dnes čteš mezi řádky tak pečlivě, že si samotný text připadá přehlíženě.",
    "Dnes dáváš všednosti hezčí hudební doprovod. Vynášení koše se tím ovšem nepromění v hotový úkol.",
    "Dnes si ke slovu „možná“ přidáváš drobnou naději, velký příběh a nevhodně rozsáhlé pokračování.",
    "Dnes máš otevřeno všem pocitům. Rozhodnutí prosíš, ať použije vedlejší vchod.",
    "Dnes si z obyčejné odmlky vyrábíš prostor pro vlastní seriál. První řadu píšeš bez konzultace s obsazením.",
    "Dnes přemýšlíš, jakou náladu má tvůj úkol. Úkol by ocenil spíš čas zahájení.",
    "Dnes si dej pochvalu za představivost. Výbor pro návrat do reality vyhlašuješ, až se mu bude chtít.",
    "Dnes překládáš „uvidíme“ jako citlivou formu plánování. Kalendář má jiný slovník.",
    "Dnes si dovol obyčejné ano nebo ne. Přídavnou mlhu můžeš dodat jako přílohu.",
    "Dnes si držíš hranice. Pro jistotu jim nepůjčuj ploutve.",
    "Dnes dáváš intuici hlavní slovo. Faktům vyhrazuješ krátké dotazy po představení.",
    "Dnes hledáš hlubší význam i v prázdném řádku. Gratuluješ mu k úspornému vyjádření pocitů.",
    "Dnes máš nápad tak krásný, že se ti ho nechce kazit realizací.",
    "Dnes žiješ přítomností. Jen její výběr necháváš na vlastní představivosti.",
    "Dnes počítáš hezké chvíle. I tu, kterou si teprve pečlivě domýšlíš.",
    "Dnes má tvoje nálada pět kapitol. Na běžnou otázku odkazuješ do dodatků.",
    "Dnes si v hlavě přehráváš rozhovory. Vlastnímu obsazení už raději neposkytuješ prostor pro improvizaci.",
    "Dnes považuješ termín za návrh. S vlastní představivostí se na tom jednomyslně shoduješ.",
    "Dnes chceš všem vyjít vstříc. Nejdřív si ale urči, kterým směrem vlastně plaveš.",
    "Dnes čteš vlastní dojmy jako úřední zprávu. Razítko si přikresluješ podle nálady.",
    "Dnes dáváš význam drobnostem. Zbytek seznamu úkolů tím získává velmi důstojnou odmlku.",
    "Dnes měříš čas podle písniček. Minutku na těstoviny si raději nech v původním žánru.",
    "Dnes si nech prostor pro snění. Jen si ho nezaměň s volným místem pro všechny cizí plány.",
  ],
  q: [
    "Někam s malými lampičkami. Jídlo vybereme podle názvu, který nejlíp vystihuje náš večer. Brambory taky mají příběh.",
    "Najdeme lavičku s výhledem a vymyslíme si k ní společnou minulost. Piknik bez náročné logistiky, zato se scénářem.",
    "Pošleme srdíčko. Je stručné, ale nechává prostor pro čtrnáct vzájemně neslučitelných výkladů. To je vstřícné.",
    "Já myju, ty utíráš. Jen prosím nepřerušuj písničku, při které těm hrnkům konečně rozumím.",
    "Někam k majáku. Ty zařídíš cestu, já zjistím, jaký příběh nás tam údajně celou dobu čeká.",
    "Něco s otevřeným koncem. Ty vybereš film, já pak vysvětlím, co znamená závěsná lampa ve třetí scéně.",
  ],
};

export default ryby;
