/**
 * Strojově čitelný zrcadlový obraz Build Specification v1.0 §6 (Acceptance
 * Test Ownership Matrix). Zdroj pravdy je Notion (uzamčený dokument) —
 * tento soubor slouží k automatické CI kontrole ("CI musí mít manifest
 * AT-01..AT-72 → BUILD owner a failnout, pokud je číslo chybějící,
 * duplicitně vlastněné nebo test file neexistuje po dokončení jeho owner
 * bloku", §6). Aktualizovat spolu s docs/h2/BUILD-STATUS.md, ne samostatně.
 */
export const TOTAL_AT_COUNT = 72;

export const AT_OWNERSHIP: Readonly<Record<string, readonly string[]>> = {
  "BUILD-01": [],
  "BUILD-02": [],
  "BUILD-03": ["AT-41", "AT-42"],
  "BUILD-03A": ["AT-64"],
  "BUILD-04": ["AT-01", "AT-02", "AT-48", "AT-61"],
  "BUILD-05": ["AT-03", "AT-06", "AT-07", "AT-54", "AT-67", "AT-71"],
  "BUILD-06": ["AT-04", "AT-05"],
  "BUILD-07": ["AT-33", "AT-34", "AT-35", "AT-36", "AT-63"],
  "BUILD-08": [],
  "BUILD-09": ["AT-21", "AT-22", "AT-23", "AT-24", "AT-25", "AT-58", "AT-66"],
  "BUILD-10": ["AT-09", "AT-50", "AT-62"],
  "BUILD-11": ["AT-10"],
  "BUILD-12": ["AT-08", "AT-27", "AT-28", "AT-30", "AT-31", "AT-32", "AT-51"],
  "BUILD-13": [],
  "BUILD-14": ["AT-11", "AT-12", "AT-13"],
  "BUILD-15": ["AT-14", "AT-15", "AT-16", "AT-45", "AT-60"],
  "BUILD-16": ["AT-17", "AT-18", "AT-19", "AT-20"],
  "BUILD-17": ["AT-29"],
  "BUILD-18": [],
  "BUILD-19": ["AT-26", "AT-65"],
  "BUILD-20": ["AT-37", "AT-68", "AT-69"],
  "BUILD-21": ["AT-38", "AT-39", "AT-46", "AT-56", "AT-57"],
  "BUILD-22": ["AT-40"],
  "BUILD-23": ["AT-43", "AT-44", "AT-47", "AT-55", "AT-72"],
  "BUILD-24": ["AT-53"],
  "BUILD-25": ["AT-59"],
  "BUILD-26": ["AT-49"],
  "BUILD-27": ["AT-70"],
  "BUILD-28": ["AT-52"],
};

/**
 * Bloky, jejichž stav v docs/h2/BUILD-STATUS.md je AT GREEN nebo výš —
 * aktualizovat v STEJNÉM commitu, kdy se blok stane AT GREEN (stejné
 * pravidlo jako pro BUILD-STATUS.md). Používá se k ověření, že vlastněné
 * AT mají skutečně existující test pokrytí, ne jen záznam v matici.
 */
export const COMPLETED_BUILD_BLOCKS: readonly string[] = [
  "BUILD-01",
  "BUILD-02",
  "BUILD-03",
  "BUILD-03A",
  "BUILD-04",
  "BUILD-05",
  "BUILD-06",
  "BUILD-07",
  "BUILD-08",
  "BUILD-09",
  "BUILD-10",
];
