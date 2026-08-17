import type { Metadata } from 'next';
import { ChecklistProvider } from './components/ChecklistProvider';
import { Checklist } from './components/Checklist';
import { Callout } from './components/Callout';
import { ResponsiveTable } from './components/ResponsiveTable';
import { DeadlineStatus } from './components/DeadlineStatus';
import { CopyButton } from './components/CopyButton';
import { StickyBar } from './components/StickyBar';
import {
  SEC_VOZIDLA,
  SEC_NABYTEK,
  SEC_SPOTREBICE,
  SEC_ZVIRATA,
  SEC_AKVARIA,
  SEC_ZAHRADA,
  SEC_OSTATNI,
  SEC_OVERIT,
  SEC_POSLEDNI_NAJEM,
  SEC_CO_UDELAT_TED,
  SEC_DOKLADY,
  SEC_DOHODA_OBSAH,
  SEC_HARM_DO_25_8,
  SEC_HARM_ZARI,
  SEC_HARM_PREDANI,
  SEC_HARM_PO_PREDANI,
} from './lib/checklist-data';
import './zlutak.css';

export const metadata: Metadata = {
  title: 'Ukončení nájmu Bystrcká — plán do 6. 10. 2026',
  description: 'Soukromý plán a checklist k ukončení nájmu Bystrcká.',
  robots: { index: false, follow: false },
};

const OZNAMENI_SUBJECT = 'Oznámení o neprodloužení nájemní smlouvy – Bystrcká č. ev. 201';
const OZNAMENI_BODY = `Dobrý den, paní Žemlová,

v souladu s článkem III nájemní smlouvy Vám tímto oznamuji, že nemám zájem nájemní vztah dále prodlužovat. Za předpokladu, že aktuální sjednaná doba nájmu končí dne 6. 10. 2026, nájem tímto dnem skončí uplynutím sjednané doby.

Prosím o písemné potvrzení přijetí tohoto oznámení a o domluvu termínu předání předmětu nájmu, sepsání předávacího protokolu, odečtů médií, předání klíčů a vypořádání jistoty.

S pozdravem

Jan Bindr`;
const OZNAMENI_FULL_TEXT = `Předmět: ${OZNAMENI_SUBJECT}\n\n${OZNAMENI_BODY}`;

export default function ZlutakPage() {
  return (
    <ChecklistProvider>
      <div className="z-page">
        <StickyBar />
        <main className="z-content">
          <header className="z-hero">
            <h1>🏠 Ukončení nájmu Bystrcká — plán do 6. 10. 2026</h1>
          </header>

          <section aria-labelledby="seznam-veci">
            <h2 id="seznam-veci">Seznam věcí k vyřešení</h2>
            <Callout variant="blue" icon="📦">
              <p>
                <strong>Checklist vznikl z 54 fotografií; zjevné duplicity jsou sloučené.</strong>{' '}
                Zaškrtnout, až je věc odvezena, prodána, darována, zlikvidována nebo je písemně
                dohodnuto, že zůstává.
              </p>
            </Callout>

            <h3 id="vozidla">Vozidla a přeprava</h3>
            <Checklist section={SEC_VOZIDLA} />

            <h3 id="nabytek">Velký nábytek</h3>
            <Checklist section={SEC_NABYTEK} />

            <h3 id="spotrebice">Spotřebiče a elektronika</h3>
            <Checklist section={SEC_SPOTREBICE} />

            <h3 id="zvirata">Zvířata k dořešení</h3>
            <Checklist section={SEC_ZVIRATA} />

            <h3 id="akvaria">Akvária a chovatelské vybavení</h3>
            <Checklist section={SEC_AKVARIA} />

            <h3 id="zahrada">Zahrada, dílna a venkovní vybavení</h3>
            <Checklist section={SEC_ZAHRADA} />

            <h3 id="ostatni">Ostatní věci</h3>
            <Checklist section={SEC_OSTATNI} />

            <h3 id="overit-pronajimatelka">Ověřit s pronajímatelkou / opravit před předáním</h3>
            <Checklist section={SEC_OVERIT} />
          </section>

          <section aria-labelledby="financni-souhrn">
            <h2 id="financni-souhrn">Finanční souhrn nájmu</h2>
            <Callout variant="green" icon="💰">
              <p>
                <strong>
                  Odhad celkového nájemného za období 7. 10. 2018–6. 10. 2026: 2 283 581 Kč.
                </strong>{' '}
                Výpočet předpokládá původní sazbu 22 000 Kč měsíčně a ústně dohodnuté zvýšení na
                25 000 Kč od 1. 1. 2022. Nezahrnuje vratnou jistotu, elektřinu ani jiné náklady.
              </p>
            </Callout>

            <ResponsiveTable
              head={['Období', 'Výpočet', 'Částka']}
              rows={[
                ['7.–31. 10. 2018', 'Poměrná část uvedená přímo ve smlouvě', '17 742 Kč'],
                ['11/2018–12/2021', '38 měsíců × 22 000 Kč', '836 000 Kč'],
                ['1/2022–9/2026', '57 měsíců × 25 000 Kč', '1 425 000 Kč'],
                ['1.–6. 10. 2026', '25 000 Kč ÷ 31 dní × 6 dní, zaokrouhleno', '4 839 Kč'],
                [
                  <strong key="celkem">Celkem</strong>,
                  '',
                  <strong key="castka">2 283 581 Kč</strong>,
                ],
              ]}
            />

            <h3 id="posledni-najem">Poslední nájem při skončení 6. 10. 2026</h3>
            <Checklist section={SEC_POSLEDNI_NAJEM} />

            <Callout variant="yellow" icon="⚠️">
              <p>
                <strong>Poměrné říjnové nájemné musí být součástí dohody.</strong> Bez výslovného
                ujednání by mohla pronajímatelka požadovat celou říjnovou platbu 25 000 Kč. Pokud
                bude sjednáno jiné datum skončení, je nutné přepočítat poslední platbu podle
                tohoto data.
              </p>
            </Callout>

            <Callout variant="red" icon="🚨">
              <p>
                <strong>
                  Kritický termín: nejpozději 25. 8. 2026 prokazatelně oznámit pronajímatelce, že
                  nájem nechci prodloužit a skončí 6. 10. 2026.
                </strong>
              </p>
              <p>
                <DeadlineStatus /> Termín vychází z ujednání „nejpozději 6 týdnů před koncem doby
                nájmu&quot; a z předpokladu, že se původní roční nájem opakovaně prodlužoval vždy
                o rok.
              </p>
            </Callout>
          </section>

          <section aria-labelledby="co-udelat-ted">
            <h2 id="co-udelat-ted">Co udělat teď</h2>
            <Checklist section={SEC_CO_UDELAT_TED} />
          </section>

          <section aria-labelledby="vzor-oznameni">
            <h2 id="vzor-oznameni">Vzor oznámení</h2>
            <blockquote className="z-quote">
              <p>
                <strong>Předmět: {OZNAMENI_SUBJECT}</strong>
              </p>
              <p>Dobrý den, paní Žemlová,</p>
              <p>
                v souladu s článkem III nájemní smlouvy Vám tímto oznamuji, že nemám zájem nájemní
                vztah dále prodlužovat. Za předpokladu, že aktuální sjednaná doba nájmu končí dne
                6. 10. 2026, nájem tímto dnem skončí uplynutím sjednané doby.
              </p>
              <p>
                Prosím o písemné potvrzení přijetí tohoto oznámení a o domluvu termínu předání
                předmětu nájmu, sepsání předávacího protokolu, odečtů médií, předání klíčů a
                vypořádání jistoty.
              </p>
              <p>S pozdravem</p>
              <p>Jan Bindr</p>
            </blockquote>
            <CopyButton text={OZNAMENI_FULL_TEXT} label="Kopírovat text oznámení" />

            <Callout variant="yellow" icon="💡">
              <p>
                <strong>
                  Nepoužívat jen formulaci „výpověď&quot;, pokud cílem je neprodloužit nájem na
                  dobu určitou.
                </strong>{' '}
                Přesnější je oznámit, že nájem nebude prodloužen a skončí uplynutím sjednané doby.
                Tříměsíční výpovědní doba uvedená ve smlouvě je jiný způsob ukončení a může
                vyvolat spor o datum skončení.
              </p>
            </Callout>
          </section>

          <section aria-labelledby="smlouva">
            <h2 id="smlouva">Co říká přiložená smlouva</h2>
            <ResponsiveTable
              head={['Oblast', 'Ujednání', 'Praktický dopad']}
              rows={[
                [
                  'Doba nájmu',
                  'Původně 7. 10. 2018 až 6. 10. 2019; možnost opakovaného prodlužování.',
                  'Písemné dodatky nevznikly; nejpravděpodobnější konec 6. 10. 2026 je nutné nyní potvrdit písemnou dohodou.',
                ],
                [
                  'Oznámení',
                  'Strany se mají informovat nejpozději 6 týdnů před koncem, zda chtějí prodloužit, nebo ukončit.',
                  'Při konci 6. 10. 2026 vychází termín na 25. 8. 2026.',
                ],
                [
                  'Skončení',
                  'Uplynutím doby, dohodou nebo výpovědí; uvedena tříměsíční výpovědní doba.',
                  'Pro plánované neprodloužení je nejčistší skončení uplynutím doby.',
                ],
                [
                  'Předání',
                  'Má být sepsán protokol o stavu, vybavení, odečtech médií a počtu klíčů.',
                  'Protokol připravit předem a při předání pořídit fotky.',
                ],
                [
                  'Jistota',
                  '26 000 Kč; pronajímatel ji má vrátit do jednoho měsíce od předání, po započtení případných dluhů.',
                  'Do protokolu uvést účet pro vrácení a požadovat vyčíslení každé srážky.',
                ],
                [
                  'Energie a služby',
                  'Elektřinu hradí nájemce přímo poskytovateli; nájemce zajišťuje vyvážení jímky.',
                  'Nahlásit konečný odečet, ukončit nebo převést odběr a uschovat potvrzení.',
                ],
                [
                  'Stav nemovitosti',
                  'Nájemce zajišťuje běžnou údržbu, drobné opravy a péči o zahradu; odpovídá za zaviněné škody.',
                  'Opravit drobnosti, uklidit a zdokumentovat stav před předáním.',
                ],
                [
                  'Prohlídky',
                  'V posledních 3 měsících má nájemce po předchozím oznámení umožnit nezbytné prohlídky zájemcům.',
                  'Domlouvat konkrétní termíny a být u prohlídek přítomen.',
                ],
              ]}
            />
          </section>

          <section aria-labelledby="harmonogram">
            <h2 id="harmonogram">Harmonogram</h2>

            <h3 id="harmonogram-do-25-8">Do 25. 8. 2026</h3>
            <Checklist section={SEC_HARM_DO_25_8} />

            <h3 id="harmonogram-zari">Září 2026</h3>
            <Checklist section={SEC_HARM_ZARI} />

            <h3 id="harmonogram-predani">Při předání, nejpozději 6. 10. 2026</h3>
            <Checklist section={SEC_HARM_PREDANI} />

            <h3 id="harmonogram-po-predani">Po předání</h3>
            <Checklist section={SEC_HARM_PO_PREDANI} />
          </section>

          <section aria-labelledby="pravni-rozbor">
            <h2 id="pravni-rozbor">Právní rozbor podle skutečného průběhu nájmu</h2>

            <Callout variant="blue" icon="⚖️">
              <p>
                <strong>Pracovní závěr k 17. 8. 2026:</strong> Nájem s vysokou pravděpodobností
                pokračoval platně i bez písemných dodatků. Nejslabším místem není samotná
                existence nájmu, ale dokazování přesného obsahu telefonických dohod — zejména
                zvýšení nájemného na 25 000 Kč, jednotlivých prodloužení a zápočtů oprav.
              </p>
            </Callout>

            <h3 id="skutecny-prubeh">Skutečný průběh</h3>
            <ul className="z-plain-list">
              <li>
                Jediným podepsaným dokumentem je původní smlouva ze dne{' '}
                <strong>6. 10. 2018</strong>, původně na období <strong>7. 10. 2018–6. 10. 2019</strong>.
              </li>
              <li>Další prodloužení byla potvrzována pouze telefonicky; písemné dodatky nebyly uzavírány.</li>
              <li>
                Pronajímatelka po skončení původní doby dál přijímala nájemné a řešila s nájemcem
                provoz a opravy.
              </li>
              <li>
                Od <strong>1. 1. 2022</strong> přijímala ústně dohodnuté nájemné{' '}
                <strong>25 000 Kč měsíčně</strong>.
              </li>
              <li>
                U větších oprav a výměn se strany telefonicky dohodly, že nájemce zašle fakturu a
                částku odečte z nájemného.
              </li>
            </ul>

            <h3 id="platnost-ustnich">Platnost ústních prodloužení</h3>
            <ul className="z-plain-list">
              <li>
                U nájmu sloužícího k bydlení zákon chrání nájemce: pronajímatel nemůže vůči němu
                namítat neplatnost jen kvůli chybějící písemné formě.
              </li>
              <li>
                Dlouhodobé užívání domu, placení a přijímání nájemného a společné řešení oprav
                jsou významnými důkazy pokračujícího nájemního vztahu.
              </li>
              <li>
                Nezávisle na telefonátech může být relevantní <strong>§ 2285 občanského
                zákoníku</strong>: pokud nájemce pokračuje v užívání alespoň tři měsíce po
                původním konci a pronajímatel jej písemně nevyzve k odchodu, nájem se obnovuje na
                původní dobu, nejvýše na dva roky.
              </li>
              <li>
                Protože původní doba činila jeden rok, je dobře obhajitelné každoroční obnovení do{' '}
                <strong>6. října</strong> dalšího roku. Nejpravděpodobnější aktuální konec je tedy{' '}
                <strong>6. 10. 2026</strong>.
              </li>
              <li>
                Ujednání o číslovaných písemných dodatcích zvyšuje důkazní riziko, ale po letech
                přijímání plnění samo o sobě neznamená, že by majitelka mohla pokračující vztah
                jednoduše popřít.
              </li>
            </ul>

            <h3 id="rekreacni-stavba">Rekreační stavba používaná k bydlení</h3>
            <ul className="z-plain-list">
              <li>
                Nemovitost je evidována jako stavba pro rodinnou rekreaci, ale smlouva ji výslovně
                přenechává <strong>za účelem bydlení</strong>.
              </li>
              <li>
                Podle § 2236 nemůže být nájemci na újmu, že prostor není podle veřejnoprávních
                předpisů označen jako byt. Rozhodný je sjednaný účel.
              </li>
              <li>Případný stavebněprávní problém vlastníka proto automaticky neruší ochranu nájemce.</li>
            </ul>

            <h3 id="kontrola-smlouvy">Kontrola původní smlouvy podle současného práva</h3>
            <ResponsiveTable
              head={['Ujednání', 'Právní hodnocení', 'Praktický dopad']}
              rows={[
                [
                  'Úroky z jistoty jsou vyloučeny',
                  'Pravděpodobně neúčinné. § 2254 přiznává nájemci právo na úroky z jistoty.',
                  'Při vrácení jistoty 26 000 Kč lze uplatnit také úrok.',
                ],
                [
                  'Obecná tříměsíční výpovědní doba',
                  'Nedává pronajímatelce právo vypovědět nájem bez zákonného důvodu.',
                  'Výpověď pronajímatelky musí být písemná, odůvodněná a opřená o zákon.',
                ],
                [
                  'Souhlas s dalšími osobami',
                  'Nelze jím plošně zakázat návštěvy, partnera nebo běžné členy domácnosti.',
                  'Zvýšení počtu osob se oznamuje; zákonná práva nájemce mají přednost.',
                ],
                [
                  'Klíč u pronajímatelky',
                  'Není souhlasem k libovolnému vstupu.',
                  'Vstup má být předem domluven, bez oznámení jen při skutečné naléhavosti.',
                ],
                [
                  'Běžná údržba a drobné opravy',
                  'V zásadě odpovídá zákonu, ale rozsah omezuje nařízení vlády.',
                  'Od roku 2026 činí cenový limit 1 500 Kč za opravu a roční limit 150 Kč/m².',
                ],
              ]}
            />

            <h3 id="vetsi-opravy">Větší opravy a zápočty proti nájemnému</h3>
            <ul className="z-plain-list">
              <li>
                Čerpadla studny, vestavná lednice a vestavná trouba zpravidla nejsou drobnými
                opravami nájemce, pokud škodu nezpůsobil.
              </li>
              <li>
                Vestavné spotřebiče, které byly součástí vybavení, a zařízení zajišťující přívod
                vody má zpravidla udržovat pronajímatelka.
              </li>
              <li>
                Opakovaná praxe „telefonický souhlas → faktura → odečet z nájemného → přijetí
                snížené platby bez námitek&quot; je významným důkazem dohody.
              </li>
              <li>
                Jednostranný zápočet bez dohody by byl rizikový; zde riziko snižuje předchozí
                souhlas a dlouhodobé přijímání těchto plateb.
              </li>
            </ul>

            <h4>Doklady k uchování</h4>
            <Checklist section={SEC_DOKLADY} />

            <h3 id="zvysene-najemne">Ústně zvýšené nájemné 25 000 Kč</h3>
            <ul className="z-plain-list">
              <li>
                Dlouhodobé přijímání 25 000 Kč od 1. 1. 2022 silně podporuje existenci dohody o
                nové výši nájemného.
              </li>
              <li>
                Na původní listině však zůstává 22 000 Kč; pro úřad nebo případný spor je proto
                nutné skutečných 25 000 Kč doložit bankovními výpisy a ideálně písemným
                potvrzením pronajímatelky.
              </li>
            </ul>

            <h3 id="davka-bydleni">Dávka na bydlení a zdanění nájemného</h3>
            <Callout variant="yellow" icon="🏛️">
              <p>
                <strong>
                  Daňová povinnost pronajímatelky a nárok nájemce na podporu bydlení jsou oddělené
                  otázky.
                </strong>{' '}
                Zdanění příjmu majitelkou není zákonnou podmínkou nároku nájemce.
              </p>
            </Callout>
            <ul className="z-plain-list">
              <li>
                Příjem z pronájmu je zpravidla příjmem pronajímatelky podle § 9 zákona o daních z
                příjmů. Může uplatnit skutečné výdaje nebo 30% výdajový paušál.
              </li>
              <li>
                Nájemce pro podporu dokládá právní titul, příjmy domácnosti a skutečné náklady na
                bydlení; nedokládá, zda majitelka svůj příjem zdanila.
              </li>
              <li>
                Od 1. 10. 2025 nahradila nové žádosti o původní příspěvek na bydlení{' '}
                <strong>dávka státní sociální pomoci</strong>. Její složka na bydlení může být
                přiznána také při bydlení ve stavbě pro individuální nebo rodinnou rekreaci, jsou-li
                splněny ostatní podmínky.
              </li>
              <li>
                Tvrzení, že by majitelka kvůli přiznání příjmu musela automaticky zvýšit nájem,
                není zákonná podmínka dávky; bylo by to její ekonomické rozhodnutí.
              </li>
              <li>
                Z jejího výroku nelze bez dalších podkladů definitivně uzavřít daňový delikt.
                Případné nepřiznání příjmu je ale odpovědností pronajímatelky, nikoli nájemce.
              </li>
              <li>
                Nepodepisovat nepravdivá potvrzení, nevytvářet zpětně fiktivní dodatky a neuvádět
                úřadu jinou částku, než byla skutečně placena.
              </li>
            </ul>

            <h3 id="co-musi-byt-v-dohode">Co musí být v písemné dohodě o skončení</h3>
            <Checklist section={SEC_DOHODA_OBSAH} />

            <Callout variant="red" icon="🚨">
              <p>
                <strong>Ukončení už nepotvrzovat pouze telefonicky.</strong> Kvůli ústním
                prodloužením, zvýšení nájmu a zápočtům oprav má být konečné vypořádání podepsáno
                oběma stranami.
              </p>
            </Callout>

            <h3 id="pravni-zdroje">Právní zdroje</h3>
            <ul className="z-plain-list">
              <li>
                MMR – nájemní smlouva →{' '}
                <a
                  href="https://www.mmr.gov.cz/cs/microsites/bydleni-pro-zivot/vas-pruvodce-najemnimi-vztahy/najemni-smlouva"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  mmr.gov.cz
                </a>
              </li>
              <li>
                MMR – skončení nájmu →{' '}
                <a
                  href="https://www.mmr.gov.cz/cs/microsites/bydleni-pro-zivot/vas-pruvodce-najemnimi-vztahy/skonceni-najmu"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  mmr.gov.cz
                </a>
              </li>
              <li>
                MMR – právní možnosti bydlení a rozhodný účel nájmu →{' '}
                <a
                  href="https://mmr.gov.cz/getmedia/5deb6030-9d00-4205-9111-363e018068e8/INFORMACE-K-PRAVNIM-MOZNOSTEM-UBYTOVANI-UPRCHLIKU_2.pdf.aspx?ext=.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  mmr.gov.cz
                </a>
              </li>
              <li>
                MMR – limity drobných oprav od roku 2026 →{' '}
                <a
                  href="https://www.mmr.gov.cz/cs/ostatni/web/novinky/vlada-schvalila-pravidla-pro-vypocet-nakladoveho-n"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  mmr.gov.cz
                </a>
              </li>
              <li>
                Finanční správa – příjmy pronajímatele →{' '}
                <a
                  href="https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/fyzicke-osoby/pronajimatel"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  financnisprava.gov.cz
                </a>
              </li>
              <li>
                MPSV – dávka státní sociální pomoci →{' '}
                <a href="https://mpsv.gov.cz/davka-statni-socialni-pomoci" target="_blank" rel="noopener noreferrer">
                  mpsv.gov.cz
                </a>
              </li>
              <li>
                Ústavní soud – právo na úroky z jistoty →{' '}
                <a
                  href="https://www.zakonyprolidi.cz/judikat/uscr/iv-us-2254-22-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  zakonyprolidi.cz
                </a>
              </li>
            </ul>

            <Callout variant="gray" icon="ℹ️">
              <p>
                Tato část je praktickým rozborem smlouvy a popsaného průběhu, nikoli individuálním
                právním zastoupením. Při odmítnutí písemné dohody, sporu o zápočty nebo kauci je
                vhodná kontrola advokátem ještě před poslední platbou a předáním.
              </p>
            </Callout>
          </section>

          <section aria-labelledby="dulezite-upozorneni">
            <h2 id="dulezite-upozorneni">Důležité právní upozornění</h2>
            <p>
              Smlouva odkazuje na § 2230 občanského zákoníku. U nájmu domu k bydlení může být
              relevantní také zvláštní úprava § 2285: pokud nájemce po skončení dál alespoň tři
              měsíce užívá dům a pronajímatel ho nevyzve k opuštění, může se nájem za určitých
              podmínek obnovit; zákon zároveň připouští jiné ujednání stran. Prakticky proto
              nestačí jen oznámení — předmět nájmu je třeba skutečně včas vyklidit a předat.
            </p>
            <p>
              Tato stránka je praktické shrnutí přiložené smlouvy, nikoli individuální právní
              stanovisko. Pokud chybí poslední dodatek, existuje spor o datum prodloužení nebo
              pronajímatelka odmítne skončení potvrdit, je vhodná rychlá kontrola advokátem.
            </p>
          </section>

          <section aria-labelledby="podklady-zdroje">
            <h2 id="podklady-zdroje">Podklady a zdroje</h2>
            <ul className="z-plain-list">
              <li>Přiložená nájemní smlouva, 3 strany, podepsaná 6. 10. 2018.</li>
              <li>
                § 2230 občanského zákoníku – obnovení nájmu →{' '}
                <a
                  href="https://www.kurzy.cz/zakony/89-2012-obcansky-zakonik/paragraf-2230/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kurzy.cz
                </a>
              </li>
              <li>
                § 2285 občanského zákoníku – obnovení nájmu bytu nebo domu →{' '}
                <a
                  href="https://www.kurzy.cz/zakony/89-2012-obcansky-zakonik/paragraf-2285/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kurzy.cz
                </a>
              </li>
              <li>Zpracováno 17. 8. 2026.</li>
            </ul>
          </section>
        </main>
      </div>
    </ChecklistProvider>
  );
}
