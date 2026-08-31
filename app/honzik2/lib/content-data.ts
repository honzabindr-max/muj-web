export type SliderBand = 'healthy' | 'edge' | 'shadow';

export type SliderData = {
  id: string;
  label: string;
  healthy: string;
  edge: string;
  shadow: string;
};

export const SLIDERS: SliderData[] = [
  {
    id: 'originalita',
    label: 'Originalita',
    healthy: 'Vidím řešení, které ostatní přehlédnou.',
    edge: 'Otevírám další a další varianty.',
    shadow: 'Roztříštěnost. Nic nedostane plnou pozornost.',
  },
  {
    id: 'iniciativa',
    label: 'Iniciativa',
    healthy: 'Umím věc rozhýbat.',
    edge: 'Začínám dřív, než mám jasno.',
    shadow: 'Impulzivita. Energie předbíhá úsudek.',
  },
  {
    id: 'vize',
    label: 'Velká vize',
    healthy: 'Vidím potenciál a větší horizont.',
    edge: 'Každá možnost začíná vypadat zásadně.',
    shadow: 'Deset budoucností soupeří o jeden život.',
  },
  {
    id: 'analyza',
    label: 'Analýza',
    healthy: 'Umím jít pod povrch a vidět systém.',
    edge: 'Hledám ještě jeden argument.',
    shadow: 'Přemýšlení už nezlepšuje rozhodnutí. Jen ho odkládá.',
  },
  {
    id: 'citlivost',
    label: 'Citlivost',
    healthy: 'Vnímám lidi, atmosféru a vztah do hloubky.',
    edge: 'Nesouhlas nebo napětí si beru příliš dovnitř.',
    shadow: 'Přetížení, stažení nebo pozdě nastavené hranice.',
  },
  {
    id: 'svoboda',
    label: 'Svoboda',
    healthy: 'Potřebuju autonomii, abych fungoval naplno.',
    edge: 'Struktura začíná působit jako omezení.',
    shadow: 'Odmítám i strukturu, která by mi ve skutečnosti pomohla.',
  },
  {
    id: 'novost',
    label: 'Novost',
    healthy: 'Nové věci mě nabíjejí kreativitou.',
    edge: 'Nové začíná být přitažlivější než důležité.',
    shadow: 'Další start se stává únikem od dokončení.',
  },
];

export function sliderBand(value: number): SliderBand {
  if (value < 40) return 'healthy';
  if (value < 70) return 'edge';
  return 'shadow';
}

export type VoiceData = {
  id: string;
  sign: string;
  motto: string;
  gift: string;
  whenTooMuch: string;
};

export const VOICES: VoiceData[] = [
  {
    id: 'vodnar',
    sign: 'Vodnářská hlava',
    motto: 'Pochopím systém.',
    gift: 'Originalita, spojování souvislostí, hledání cesty, kterou ostatní ještě nevidí.',
    whenTooMuch: 'Možností je tolik, že samotný výběr začne být problém.',
  },
  {
    id: 'beran',
    sign: 'Beraní start',
    motto: 'Tak pojďme.',
    gift: 'Iniciativa, rychlost, odvaha, schopnost rozhýbat stojící věci.',
    whenTooMuch: 'Impuls má náskok před reflexí.',
  },
  {
    id: 'ryby',
    sign: 'Rybí srdce',
    motto: 'Cítím to víc, než je vidět.',
    gift: 'Empatie, intuice, romantika, hluboké vztahové prožívání.',
    whenTooMuch: 'Atmosféra a vztahové napětí snadno spotřebují příliš mnoho kapacity.',
  },
  {
    id: 'strelec',
    sign: 'Střelecký horizont',
    motto: 'Kam až se s tím dá dojít?',
    gift: 'Expanze, optimismus, dobrodružství a velké cíle.',
    whenTooMuch: 'Potenciál začnu vidět téměř všude.',
  },
];

export const VOICE_FORMULA_REFLEX = ['Pochopím', 'Začnu', 'Zvětším', 'Udělám to jinak'];
export const VOICE_FORMULA_BALANCE = ['Vyberu', 'Omezím', 'Dotáhnu', 'Znovu vyhodnotím'];

export type AreaData = {
  id: string;
  title: string;
  questions: string[];
};

export type DomainData = {
  id: string;
  title: string;
  areas: AreaData[];
};

export const DOMAINS: DomainData[] = [
  {
    id: 'kdo-jsem',
    title: 'Kdo jsem a kam jdu',
    areas: [
      {
        id: '01',
        title: 'Identita, hodnoty a směr',
        questions: [
          'Kdo jsem dnes?',
          'Kým už nechci být?',
          'Co je opravdu moje?',
          'Jaké hodnoty chci vědomě chránit?',
          'Podle čeho budu hodnotit dobrý život?',
          'Co je další životní etapa?',
        ],
      },
      {
        id: '08',
        title: 'Ambice, růst a velké cíle',
        questions: [
          'Jakou roli hraje velikost cíle v motivaci?',
          'Kdy ambice pomáhá?',
          'Kdy vytváří permanentní nespokojenost?',
          'Jak kombinovat růst a spokojenost?',
        ],
      },
      {
        id: '23',
        title: 'Smysl a dobrý život',
        questions: [
          'Co pro mě znamená dobře prožitý život?',
          'Co bych dělal, kdybych už nemusel nic dokazovat?',
          'Jaký vztah chci mít k úspěchu?',
          'Co má zůstat po mně?',
        ],
      },
      {
        id: '24',
        title: 'Krize, změna, ztráta a restart',
        questions: [
          'Jak reaguji při zásadní změně?',
          'Co mi pomáhá znovu se postavit?',
          'Co si z krize odnáším?',
          'Jak poznat, kdy opravovat staré a kdy vytvořit nové?',
        ],
      },
    ],
  },
  {
    id: 'hlava',
    title: 'Hlava a energie',
    areas: [
      {
        id: '02',
        title: 'Energie a osobní kapacita',
        questions: [
          'Co mě dobíjí?',
          'Co mě vybíjí?',
          'Jak poznám pokles kapacity?',
          'Jaký vztah má moje energie k novosti, lidem, práci a pohybu?',
          'Jak vypadá optimální rytmus?',
        ],
      },
      {
        id: '03',
        title: 'Pozornost a mentální zahlcení',
        questions: [
          'Co mi bere pozornost?',
          'Kolik otevřených směrů dokážu skutečně držet?',
          'Jaký vztah mám k notifikacím, informacím a novým podnětům?',
          'Jak vytvořit podmínky pro hlubokou práci?',
        ],
      },
      {
        id: '04',
        title: 'Motivace, start a momentum',
        questions: [
          'Co mě spouští?',
          'Proč některé věci začnu okamžitě?',
          'Jakou roli hraje novost?',
          'Co se děje po skončení prvního nadšení?',
        ],
      },
      {
        id: '05',
        title: 'Výběr a overthinking',
        questions: [
          'Jak vybírám mezi více dobrými možnostmi?',
          'Proč je těžké některé dveře zavřít?',
          'Kdy další analýza zlepšuje rozhodnutí a kdy je jen odkladem volby?',
          'Jaká rozhodnutí mají být rychlá a která pomalá?',
        ],
      },
      {
        id: '07',
        title: 'Kreativita, nápady a novost',
        questions: [
          'Odkud přicházejí nejlepší nápady?',
          'Jak je zachytit bez okamžité realizace?',
          'Jak oddělit nápad od projektu?',
          'Kolik novosti potřebuji?',
        ],
      },
      {
        id: '21',
        title: 'Učení a informační dieta',
        questions: [
          'Kolik informací skutečně potřebuji?',
          'Kdy učení pomáhá?',
          'Kdy se stává únikem od realizace?',
          'Jak převádět znalosti do praxe?',
        ],
      },
    ],
  },
  {
    id: 'prace',
    title: 'Práce a peníze',
    areas: [
      {
        id: '09',
        title: 'Práce, podnikání a role',
        questions: [
          'V čem jsem přirozeně nejlepší?',
          'Co mám dělat osobně?',
          'Co má dělat systém?',
          'Co mají dělat jiní lidé?',
          'Jaký typ práce mě dlouhodobě živí energií?',
        ],
      },
      {
        id: '10',
        title: 'Leadership a spolupráce',
        questions: [
          'Jak reaguji na kontrolu?',
          'Jak dávám lidem svobodu?',
          'Jak deleguji?',
          'Jak přijímám nesouhlas?',
          'Jak vedu lidi v období tlaku?',
        ],
      },
      {
        id: '11',
        title: 'Peníze, riziko a bezpečí',
        questions: [
          'Jak přemýšlím o riziku?',
          'Jakou roli hraje optimismus?',
          'Jak odlišit potenciál od pravděpodobnosti?',
          'Jakou míru finanční bezpečnosti skutečně potřebuji?',
        ],
      },
    ],
  },
  {
    id: 'vnitrni-stav',
    title: 'Vnitřní stav',
    areas: [
      {
        id: '06',
        title: 'Dotahování a disciplína',
        questions: [
          'Co způsobuje pokles zájmu?',
          'Co dokončuji snadno a co ne?',
          'Jaké části projektu mě přirozeně baví a jaké ne?',
          'Jak navrhnout systém dokončování?',
        ],
      },
      {
        id: '12',
        title: 'Emoce a jejich regulace',
        questions: [
          'Jak rychle vzniká emoční reakce?',
          'Co dělám při frustraci? Co při zranění?',
          'Jak dlouho trvá návrat?',
          'Jaké emoce nejčastěji skrývám pod jinými reakcemi?',
        ],
      },
      {
        id: '13',
        title: 'Stres, přetížení a únik',
        questions: [
          'Jak vypadá první stadium přetížení?',
          'Co dělám při dlouhodobém stresu? K čemu utíkám?',
          'Jaké jsou moje časné varovné signály?',
          'Jaký má být recovery protokol?',
        ],
      },
    ],
  },
  {
    id: 'lide',
    title: 'Lidé',
    areas: [
      {
        id: '14',
        title: 'Hranice a konflikt',
        questions: [
          'Kdy neřeknu „ne" včas?',
          'Co způsobuje odkládání konfliktu?',
          'Jaký konflikt je zdravý?',
          'Jak vyjádřit hranici dříve a jednodušeji?',
        ],
      },
      {
        id: '15',
        title: 'Komunikace a kritika',
        questions: [
          'Jak reaguji na kritiku?',
          'Kdy se začnu obhajovat?',
          'Kdy analyzuji místo jednoduchého sdělení?',
          'Jak říkat nepříjemné věci včas?',
        ],
      },
      {
        id: '16',
        title: 'Partnerství, láska a intimita',
        questions: [
          'Co vytváří blízkost? Co vytváří vzdálení?',
          'Co potřebuji pro pocit svobody? Co pro pocit spojení?',
          'Jak zachovat novost a bezpečí zároveň?',
          'Jak konflikty ovlivňují intimitu?',
        ],
      },
      {
        id: '17',
        title: 'Rodina a blízcí lidé',
        questions: [
          'Jakou roli chci vědomě zastávat?',
          'Kde pomáhám a kde přebírám odpovědnost za jiné?',
          'Jak podporovat samostatnost?',
          'Jaké vztahy chci budovat dlouhodobě?',
        ],
      },
      {
        id: '18',
        title: 'Sociální život a samota',
        questions: [
          'Kolik lidí potřebuji?',
          'Jaký druh společnosti mě nabíjí?',
          'Kdy potřebuji samotu?',
          'Jak rozlišit regeneraci o samotě od stažení?',
        ],
      },
    ],
  },
  {
    id: 'telo',
    title: 'Tělo a prostředí',
    areas: [
      {
        id: '19',
        title: 'Tělo, spánek a regenerace',
        questions: [
          'Jak souvisí psychický stav s tělem?',
          'Jaký pohyb mi vyhovuje? Jaký spánek potřebuji?',
          'Co je skutečná regenerace?',
          'Jaké signály těla ignoruji?',
        ],
      },
      {
        id: '20',
        title: 'Prostředí a domov',
        questions: [
          'Jak prostředí ovlivňuje soustředění?',
          'Potřebuji pořádek nebo kreativní chaos?',
          'Co mě vizuálně přetěžuje?',
          'Jak má vypadat prostředí pro práci a odpočinek?',
        ],
      },
      {
        id: '22',
        title: 'Dobrodružství a hra',
        questions: [
          'Jak důležitá je novost pro pocit živosti?',
          'Jak často potřebuji dobrodružství?',
          'Jak zachovat hravost?',
          'Jak odlišit zdravou změnu od útěku?',
        ],
      },
    ],
  },
];

export type StepData = {
  title: string;
  question: string;
};

export const STEPS: StepData[] = [
  { title: 'Konkrétní situace', question: 'Co se opravdu stalo?' },
  {
    title: 'Automatická reakce',
    question: 'Co jsem udělal dřív, než jsem začal situaci vysvětlovat?',
  },
  { title: 'Potřeba', question: 'Co jsem se snažil získat nebo chránit?' },
  { title: 'Alternativy', question: 'Jaká další vysvětlení připadají v úvahu?' },
  { title: 'Vzorec', question: 'Opakuje se to i jinde, nebo jde o jednorázovou situaci?' },
  { title: 'Malý experiment', question: 'Jaká nejmenší změna může něco ukázat?' },
  { title: 'Realita', question: 'Co se po 14–30 dnech skutečně změnilo?' },
  { title: 'Verdikt', question: 'Ponechat. Upravit. Nebo zahodit.' },
];

export type GuardrailData = {
  id: string;
  title: string;
  body: string;
};

export const GUARDRAILS: GuardrailData[] = [
  {
    id: '01',
    title: 'Realita > teorie',
    body: 'Hezké vysvětlení, které nesedí životu, se zahazuje.',
  },
  {
    id: '02',
    title: 'Jedna změna najednou',
    body: 'Maximálně jeden až dva významné experimenty současně.',
  },
  {
    id: '03',
    title: 'Mechanismus > motivace',
    body: 'Nespoléhat každý den na vůli, pokud lze správné rozhodnutí navrhnout předem.',
  },
  {
    id: '04',
    title: 'Jednoduchost > sofistikovanost',
    body: 'Pokud správa systému stojí víc energie než problém, který řeší, systém končí.',
  },
  {
    id: '05',
    title: 'Experiment > identita',
    body: 'Ne „jsem takový". Ale „v těchto podmínkách mám tendenci dělat tohle — pojďme to otestovat".',
  },
  {
    id: '06',
    title: 'Recovery > dokonalost',
    body: 'Cílem není nikdy neselhat. Cílem je poznat to dřív a umět se rychle vrátit.',
  },
];

export type FlowStepData = {
  label: string;
  body: string;
};

export const ARCHITECTURE_FLOW: FlowStepData[] = [
  { label: 'Hypotéza', body: 'Možné vysvětlení.' },
  { label: 'Pozorování', body: 'Konkrétní příklady.' },
  { label: 'Vzorec', body: 'Opakuje se napříč situacemi.' },
  { label: 'Experiment', body: 'Zkusím malou změnu.' },
  { label: 'Mechanismus', body: 'Vím, co mi pomáhá.' },
  { label: 'Living OS', body: 'Teprve teď se z toho stává můj default.' },
];
