export type SliderData = {
  id: string;
  label: string;
  useful: string;
  overstretched: string;
};

export const SLIDERS: SliderData[] = [
  {
    id: 'originalita',
    label: 'Originalita',
    useful: 'Nové pohledy, které jinde nikdo nevidí.',
    overstretched: 'Roztříštěnost — příliš mnoho směrů najednou.',
  },
  {
    id: 'iniciativa',
    label: 'Iniciativa',
    useful: 'Rychlý start, schopnost rozhýbat věci.',
    overstretched: 'Impulzivita — start dřív, než je jasný cíl.',
  },
  {
    id: 'empatie',
    label: 'Empatie',
    useful: 'Hluboké vztahové a emoční vnímání.',
    overstretched: 'Slabší hranice — přebírání cizí atmosféry za svou.',
  },
  {
    id: 'vize',
    label: 'Velká vize',
    useful: 'Ambice, schopnost vidět velký potenciál.',
    overstretched: 'Příliš mnoho otevřených směrů naráz.',
  },
  {
    id: 'novost',
    label: 'Novost',
    useful: 'Kreativita a energie z něčeho nového.',
    overstretched: 'Odchod od věci ve chvíli, kdy přestane být nová.',
  },
  {
    id: 'rychlost',
    label: 'Rychlost',
    useful: 'Schopnost rozhýbat zaseknutou situaci.',
    overstretched: 'Netrpělivost — odpor k čekání.',
  },
];

export type VoiceData = {
  id: string;
  sign: string;
  line: string;
  strength: string;
  risk: string;
};

export const VOICES: VoiceData[] = [
  {
    id: 'vodnar',
    sign: 'Vodnář',
    line: 'Pochopím systém.',
    strength: 'Schopnost vidět systém a nové možnosti.',
    risk: 'Příliš mnoho možností, abstrakce a přemýšlení, které nikam nevede.',
  },
  {
    id: 'beran',
    sign: 'Beran',
    line: 'Začnu.',
    strength: 'Schopnost rozhýbat věci, která jinak stojí na místě.',
    risk: 'Impulzivita, netrpělivost a frustrace, když se musí čekat.',
  },
  {
    id: 'ryby',
    sign: 'Ryby',
    line: 'Cítím hloubku.',
    strength: 'Schopnost hlubokého vztahového a emočního prožitku.',
    risk: 'Idealizace, přebírání atmosféry a pozdní nastavování hranic.',
  },
  {
    id: 'strelec',
    sign: 'Střelec',
    line: 'Kam až to můžeme dostat?',
    strength: 'Schopnost vidět velký potenciál.',
    risk: 'Vidět ten potenciál příliš často a na příliš mnoha místech naráz.',
  },
];

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
  { title: 'Situace / spouštěč', question: 'Co se stalo?' },
  { title: 'Automatická reakce', question: 'Co udělám bez vědomého rozhodnutí?' },
  {
    title: 'Skutečná potřeba',
    question: 'Co se tím snažím získat? Nebo čemu se snažím vyhnout?',
  },
  { title: 'Pracovní hypotéza', question: 'Proč tento mechanismus vzniká?' },
  { title: 'Malý experiment', question: 'Jaká jednoduchá změna by mohla pomoct?' },
  { title: 'Pozorování', question: 'Co se skutečně změnilo?' },
  { title: 'Verdikt', question: 'Ponechat. Upravit. Nebo zahodit.' },
  {
    title: 'Osobní mechanismus',
    question: 'Úspěšný experiment se stává součástí osobního operačního systému.',
  },
];
