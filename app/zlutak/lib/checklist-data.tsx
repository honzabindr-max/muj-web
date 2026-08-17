import type { ReactNode } from 'react';
import { ObfuscatedEmail } from '../components/ObfuscatedEmail';

export type ChecklistItemData = {
  id: string;
  label: ReactNode;
  defaultChecked?: boolean;
};

export type ChecklistSectionData = {
  slug: string;
  items: ChecklistItemData[];
};

function section(slug: string, labels: Array<ReactNode | [ReactNode, true]>): ChecklistSectionData {
  return {
    slug,
    items: labels.map((entry, index) => {
      const isTuple = Array.isArray(entry);
      return {
        id: `${slug}-${index}`,
        label: isTuple ? entry[0] : entry,
        defaultChecked: isTuple ? true : false,
      };
    }),
  };
}

export const SEC_VOZIDLA = section('vozidla', [
  'Ford S-Max',
  'Skútr Maxon',
  'Střešní box Thule',
]);

export const SEC_NABYTEK = section('nabytek', [
  'Rohová sedací souprava',
  'Dřevěná dvoulůžková postel s úložnými zásuvkami a matrací',
  'Dřevěná patrová postel',
  'Dřevěný rám postele s matrací',
  'Třídveřová šatní skříň se zrcadlem (u kluků)',
  'Velká šatní skříň s posuvnými zrcadlovými dveřmi (ložnice)',
  '2× černý herní pracovní stůl s policemi a zásuvkami',
  'Světlý rohový počítačový stůl s nástavbou (prostřední pokoj)',
  'Otevřený policový regál na knihy a dekorace (prostřední pokoj)',
  'Vysoká zásuvková komoda (prostřední pokoj)',
  'Nízký stolek / policový díl (prostřední pokoj)',
  'Noční stolek se dvěma zásuvkami pod malým akváriem',
  'Komoda se čtyřmi zásuvkami pod akváriem (obývák)',
  'Vysoký výklopný botník',
  '2× kancelářská / herní židle + 1× starší herní židle',
  '4× čalouněná jídelní židle',
  'Dřevěné úložné regály (prostřední pokoj)',
]);

export const SEC_SPOTREBICE = section('spotrebice', [
  'Sušička Whirlpool, 8 kg',
  'Pračka Bosch Serie 4, 7 kg',
  'Starý mrazák ve sklepě',
  'Mikrovlnná trouba',
  'Multifunkční hrnec Philips',
  'Sušička ovoce Concept SO1026',
  'Odšťavňovač Concept',
  'Čistička vzduchu Xiaomi',
  'Stojanový ventilátor s vodní nádržkou',
  'Televize a černý stropní / nástěnný držák',
  'Korg digitální klávesy a kabely',
  'Kytarová aparatura / zesilovače a kabely',
  'Černá elektrická kytara, baskytara, mandolína, ukulele, španělka',
  'Nafukovací vířivka Intex',
]);

export const SEC_ZVIRATA = section('zvirata', [
  [
    <>
      <strong>Grace — australský ovčák:</strong> adoptuje ji syn.
    </>,
    true,
  ],
  <>
    <strong>Devina — moje kočka:</strong> rozhodnout, kde bude dál bydlet.
  </>,
  <>
    <strong>Rybičky v ložnici — tlamovci:</strong> rozhodnout, kdo je převezme a kdo zajistí
    přestěhování akvária.
  </>,
]);

export const SEC_AKVARIA = section('akvaria', [
  'Malé osvětlené akvárium (Kristy)',
  'Střední akvárium s filtrem (Kristy)',
  'Velké akvárium s vybavením a stojanem (ložnice)',
  'Velké prázdné terárium',
  'Menší chovatelská klec (dá se vyhodit)',
  'Přepravka pro zvíře',
  'Zásoby a vybavení pro zvířata',
]);

export const SEC_ZAHRADA = section('zahrada', [
  <strong key="0">Rozložený dřevěný zahradní domek</strong>,
  'Dřevěná psí bouda',
  'Velký zahradní stůl a 4 kovové židle',
  'Květináče na bylinky na terase',
  'Polohovací zahradní křeslo (dá se vyhodit)',
  'Zahradní gril Tepro',
  'Benzínový křovinořez McCulloch',
  'Zahradní nářadí, květináče, barvy a dílenské potřeby',
]);

export const SEC_OSTATNI = section('ostatni', [
  'Hliníkový skládací žebřík (vrátit taťkovi)',
  'Stojan na projektor',
  'Beerpong',
  'Sportovní vybavení — brusle zimní a kolečkové, snowboard + boty, nějaké lyže',
  'Pneumatiky 4× — Čupa',
  '2× vysoký plastový úložný koš / box',
  'Obsah sklepa a skladů: bedny, nádobí, nářadí a drobné vybavení, pytle s oblečením k protřídění a vyhození',
]);

export const SEC_OVERIT = section('overit-pronajimatelka', [
  'Určit, zda zůstávají 4× stropní světlo a závěsná dekorativní světla',
  'Určit, zda zůstává držák televize; po případné demontáži opravit kotvení',
  'Doplnit nebo opravit chybějící ovládací díl vanové baterie',
  'U každého akvária a rozměrné věci potvrdit, kdo zajistí odvoz',
]);

export const SEC_POSLEDNI_NAJEM = section('posledni-najem', [
  <>
    Do písemné dohody uvést, že nájem končí <strong>6. 10. 2026</strong> a nájemné za říjen
    činí pouze poměrnou část <strong>4 839 Kč</strong>.
  </>,
  <>
    Poslední nájem zaplatit nejpozději <strong>25. 9. 2026</strong>. Smlouva stanoví platbu
    předem do 25. dne měsíce předcházejícího měsíci, za který se platí.
  </>,
  'Do dohody uvést, že po zaplacení této částky a předání nemovitosti nevzniká další nájemné.',
  <>
    Potvrdit, že jistota <strong>26 000 Kč</strong> není nájemné a má být po případném
    započtení dluhů vrácena do jednoho měsíce od předání.
  </>,
]);

export const SEC_CO_UDELAT_TED = section('co-udelat-ted', [
  <>
    <strong>Písemně potvrdit konec nájmu 6. 10. 2026.</strong> Písemné dodatky nevznikly;
    pokračování dokládají telefonické dohody, užívání domu a přijímané platby.
  </>,
  <>
    <strong>Nejpozději 25. 8. 2026 odeslat písemné oznámení o neprodloužení.</strong> Ideálně
    nečekat a poslat ho hned.
  </>,
  <>
    Oznámení poslat e-mailem na <ObfuscatedEmail /> a
    současně doporučeným dopisem s dodejkou na adresu pronajímatelky uvedenou ve smlouvě.
  </>,
  'Požádat o krátké písemné potvrzení přijetí a potvrzení, že nájem skončí uplynutím doby dne 6. 10. 2026.',
  'Domluvit přesný termín předání, předávací protokol a způsob vrácení jistoty.',
  'Do předání vyřešit energie, jímku, zahradu, úklid, drobné opravy, odečty a všechny klíče.',
]);

export const SEC_DOKLADY = section('doklady', [
  'Faktury za všechna čerpadla, vestavnou lednici, troubu a další větší opravy.',
  'Bankovní výpisy ukazující snížené nájemné v příslušném měsíci.',
  'SMS, e-maily, historii hovorů a případná následná potvrzení.',
  'Vytvořit tabulku: datum, oprava, faktura, částka, měsíc zápočtu a dostupný důkaz souhlasu.',
  'Do dohody o skončení vložit uznání všech dosavadních zápočtů a potvrzení, že pronajímatelka neeviduje dluh na nájemném.',
]);

export const SEC_DOHODA_OBSAH = section('co-musi-byt-v-dohode', [
  <>
    Nájem končí dohodou dne <strong>6. 10. 2026</strong>.
  </>,
  'Nedojde k dalšímu automatickému ani smluvnímu prodloužení.',
  <>
    Nájemné za <strong>1.–6. 10. 2026 činí 4 839 Kč</strong> a je posledním nájemným.
  </>,
  'Po zaplacení posledního nájemného a předání nevzniká další nájemné.',
  'Pronajímatelka uznává všechny dosavadní zápočty faktur za opravy.',
  'Ke dni předání není evidován žádný dluh na nájemném ani službách, kromě přesně vyjmenovaných budoucích vyúčtování.',
  'Termín předání, stavy měřidel, počet klíčů a stav nemovitosti budou zachyceny v protokolu.',
  <>
    Jistota <strong>26 000 Kč</strong> bude vrácena po odečtení jen konkrétně doložených
    pohledávek; dohoda upraví také úrok z jistoty.
  </>,
  'Po splnění dohody nemají strany další nároky, kromě výslovně označeného pozdějšího vyúčtování.',
]);

export const SEC_HARM_DO_25_8 = section('harmonogram-do-25-8', [
  'Shromáždit důkazy ústních prodloužení a plateb; písemný dodatek neexistuje.',
  'Odeslat a prokazatelně doručit oznámení.',
  'Získat potvrzení data skončení.',
]);

export const SEC_HARM_ZARI = section('harmonogram-zari', [
  'Domluvit datum a čas předání.',
  'Sepsat seznam vybavení, klíčů a závad.',
  'Naplánovat úklid, zahradu, jímku a drobné opravy.',
  'Domluvit postup s dodavatelem elektřiny.',
]);

export const SEC_HARM_PREDANI = section('harmonogram-predani', [
  'Pořídit fotografie a video všech místností, zahrady a vybavení.',
  'Zapsat konečný stav elektroměru a další relevantní odečty; vyfotit měřidla.',
  'Sepsat a oboustranně podepsat předávací protokol.',
  'Předat všechny klíče a zapsat jejich počet.',
  'Uvést datum předání, stav bez dalších nároků / přesný seznam výhrad a účet pro vrácení jistoty.',
]);

export const SEC_HARM_PO_PREDANI = section('harmonogram-po-predani', [
  <>
    Hlídací termín pro vrácení jistoty: <strong>do jednoho měsíce od skutečného předání</strong>.
  </>,
  'Uchovat smlouvu, dodatky, oznámení, doklady o doručení, protokol, fotografie a závěrečná vyúčtování.',
]);

export const ALL_CHECKLIST_SECTIONS: ChecklistSectionData[] = [
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
];

export const ALL_CHECKLIST_IDS: string[] = ALL_CHECKLIST_SECTIONS.flatMap((s) =>
  s.items.map((item) => item.id),
);

export const DEFAULT_CHECKLIST_STATE: Record<string, boolean> = Object.fromEntries(
  ALL_CHECKLIST_SECTIONS.flatMap((s) => s.items.map((item) => [item.id, !!item.defaultChecked])),
);

export const TOTAL_CHECKLIST_ITEMS = ALL_CHECKLIST_IDS.length;
