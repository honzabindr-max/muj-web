// Česká typografie: pevné mezery (U+00A0), aby se na konci řádku nezanechaly
// jednopísmenné předložky a spojky, číslo bez jednotky ani část data.
// Používá se na veškerý zákaznický text při renderu (i dynamický).

const NB = " ";

// v, k, s, z, o, u, a, i (+ velká písmena) na začátku slova → mezera za nimi je pevná
const ONE_LETTER = /(?<=^|[\s („"“‚'–—])([vkszouai])[ ](?=\S)/gi;

// číslo + jednotka: 1 990 Kč, 48 hodin, 30 dní, 5 min
const NUMBER_UNIT =
  /(\d)[ ](?=(?:Kč|CZK|€|%|min|h|hod\S*|dní|dnů|dny|den|let|roky?|rok|měsíc\S*|kB|MB|px)(?![\p{L}\d]))/gu;

// tisíce: 1 990
const THOUSANDS = /(\d)[ ](?=\d{3}(?!\d))/g;

// datum: 14. 5. 1990
const DATE = /(\d{1,2}\.)[ ](?=\d{1,2}\.|\d{4}(?!\d))/g;

// před pomlčkou (jen když před ní není další mezera)
const BEFORE_DASH = /(?<=\S)[ ](?=[–—](?:[  ]|$))/g;

export function nbsp(text: string): string {
  if (!text || text.indexOf(" ") === -1) return text;
  return text
    .replace(ONE_LETTER, `$1${NB}`)
    .replace(NUMBER_UNIT, `$1${NB}`)
    .replace(THOUSANDS, `$1${NB}`)
    .replace(DATE, `$1${NB}`)
    .replace(BEFORE_DASH, NB);
}

/** Pro dynamické hodnoty z renderVals: řetězce projdou nbsp, ostatní beze změny. */
export function nb<T>(value: T): T | string {
  return typeof value === "string" ? nbsp(value) : value;
}

/** Cena v Kč se správnými pevnými mezerami. */
export function formatCzk(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(amount);
}
