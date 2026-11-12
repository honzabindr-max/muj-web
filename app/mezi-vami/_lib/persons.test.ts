import { describe, expect, it } from "vitest";
import placesFile from "../_data/places.json";
import {
  defaultPersons,
  emptyPerson,
  formatDate,
  formatTimeSummary,
  formatTimeValue,
  isPersonComplete,
  normalizeTime,
  parseDateInput,
  personErrors,
  summaryOf,
  validateDate,
  validatePlace,
  validateTime,
  type Person,
} from "./persons";
import { buildIndex, searchPlaces } from "./places";

const TODAY = new Date(2026, 10, 12); // 12. 11. 2026

describe("parseDateInput — vložení celého data", () => {
  it("14. 5. 1990", () =>
    expect(parseDateInput("14. 5. 1990")).toEqual({
      den: "14",
      mesic: "05",
      rok: "1990",
    }));
  it("14.05.1990", () =>
    expect(parseDateInput("14.05.1990")).toEqual({
      den: "14",
      mesic: "05",
      rok: "1990",
    }));
  it("1990-05-14", () =>
    expect(parseDateInput("1990-05-14")).toEqual({
      den: "14",
      mesic: "05",
      rok: "1990",
    }));
  it("14/5/1990 a 14-5-1990", () => {
    expect(parseDateInput("14/5/1990")).toEqual({
      den: "14",
      mesic: "05",
      rok: "1990",
    });
    expect(parseDateInput("14-5-1990")).toEqual({
      den: "14",
      mesic: "05",
      rok: "1990",
    });
  });
  it("pevné mezery a okolní bílé znaky", () => {
    expect(parseDateInput("  14. 5. 1990 ")).toEqual({
      den: "14",
      mesic: "05",
      rok: "1990",
    });
  });
  it("neparsovatelný text → null", () => {
    expect(parseDateInput("1")).toBeNull();
    expect(parseDateInput("14.5.90")).toBeNull();
    expect(parseDateInput("abc")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });
});

describe("validateDate", () => {
  const ok = { den: "14", mesic: "05", rok: "1990" };
  it("platné datum", () => expect(validateDate(ok, TODAY)).toBeNull());
  it("neúplné", () => {
    expect(validateDate({ den: "", mesic: "05", rok: "1990" }, TODAY)).toBe(
      "incomplete",
    );
    expect(validateDate({ den: "14", mesic: "05", rok: "199" }, TODAY)).toBe(
      "incomplete",
    );
  });
  it("neexistující den/měsíc", () => {
    expect(validateDate({ den: "31", mesic: "02", rok: "1990" }, TODAY)).toBe(
      "invalid",
    );
    expect(validateDate({ den: "31", mesic: "04", rok: "1990" }, TODAY)).toBe(
      "invalid",
    );
    expect(validateDate({ den: "10", mesic: "13", rok: "1990" }, TODAY)).toBe(
      "invalid",
    );
    expect(validateDate({ den: "00", mesic: "01", rok: "1990" }, TODAY)).toBe(
      "invalid",
    );
  });
  it("přestupné roky", () => {
    expect(
      validateDate({ den: "29", mesic: "02", rok: "2000" }, TODAY),
    ).toBeNull();
    expect(validateDate({ den: "29", mesic: "02", rok: "1900" }, TODAY)).toBe(
      "invalid",
    );
    expect(validateDate({ den: "29", mesic: "02", rok: "2001" }, TODAY)).toBe(
      "invalid",
    );
  });
  it("ne v budoucnosti; dnešek ještě platí", () => {
    expect(validateDate({ den: "13", mesic: "11", rok: "2026" }, TODAY)).toBe(
      "future",
    );
    expect(
      validateDate({ den: "12", mesic: "11", rok: "2026" }, TODAY),
    ).toBeNull();
    expect(validateDate({ den: "01", mesic: "01", rok: "2999" }, TODAY)).toBe(
      "future",
    );
  });
  it("příliš starý rok", () =>
    expect(validateDate({ den: "01", mesic: "01", rok: "1899" }, TODAY)).toBe(
      "range",
    ));
  it("formát bez úvodních nul", () =>
    expect(formatDate(ok)).toBe("14. 5. 1990"));
});

describe("čas", () => {
  it("normalizace", () => {
    expect(normalizeTime("14:30")).toBe("14:30");
    expect(normalizeTime("1430")).toBe("14:30");
    expect(normalizeTime("7:05")).toBe("07:05");
    expect(normalizeTime("07.05")).toBe("07:05");
    expect(normalizeTime("0:00")).toBe("00:00");
  });
  it("neplatné", () => {
    expect(normalizeTime("24:00")).toBeNull();
    expect(normalizeTime("12:60")).toBeNull();
    expect(normalizeTime("12:5")).toBeNull();
    expect(normalizeTime("abc")).toBeNull();
    expect(validateTime("")).toBe("incomplete");
    expect(validateTime("25:00")).toBe("invalid");
    expect(validateTime("23:59")).toBeNull();
  });
});

describe("místo — jen ze seznamu", () => {
  const brno = { name: "Brno", okres: "Brno-město", cc: "CZ" as const };
  it("prázdné / napsané bez výběru / vybrané", () => {
    expect(validatePlace({ placeText: "", place: null })).toBe("incomplete");
    expect(validatePlace({ placeText: "Brn", place: null })).toBe(
      "not-from-list",
    );
    expect(validatePlace({ placeText: "Brn", place: brno })).toBe(
      "not-from-list",
    );
    expect(validatePlace({ placeText: "Brno", place: brno })).toBeNull();
  });
});

describe("osoba jako celek", () => {
  const base: Person = {
    ...emptyPerson("exact"),
    den: "14",
    mesic: "05",
    rok: "1990",
    placeText: "Brno",
    place: { name: "Brno", okres: "Brno-město", cc: "CZ" },
    cas: "14:30",
  };
  it("výchozí osoby nejsou kompletní", () => {
    const d = defaultPersons();
    expect(isPersonComplete(d.a, TODAY)).toBe(false);
    expect(isPersonComplete(d.b, TODAY)).toBe(false);
    expect(d.a.mode).toBe("exact");
    expect(d.b.mode).toBe("unknown");
  });
  it("přesný čas: vyžaduje platné HH:MM", () => {
    expect(isPersonComplete(base, TODAY)).toBe(true);
    expect(isPersonComplete({ ...base, cas: "" }, TODAY)).toBe(false);
    expect(personErrors({ ...base, cas: "99:99" }, TODAY).time).toBe("invalid");
  });
  it("přibližný čas: čas + rozmezí, nebo část dne bez času", () => {
    expect(
      isPersonComplete({ ...base, mode: "approx", approx: "60" }, TODAY),
    ).toBe(true);
    expect(
      isPersonComplete(
        { ...base, mode: "approx", approx: "60", cas: "" },
        TODAY,
      ),
    ).toBe(false);
    expect(
      isPersonComplete(
        { ...base, mode: "approx", approx: "part", cas: "" },
        TODAY,
      ),
    ).toBe(true);
  });
  it("nevím: bez pole času", () => {
    expect(isPersonComplete({ ...base, mode: "unknown", cas: "" }, TODAY)).toBe(
      true,
    );
  });
  it("nevybrané místo blokuje", () => {
    expect(isPersonComplete({ ...base, place: null }, TODAY)).toBe(false);
  });
  it("shrnutí zadaných údajů", () => {
    expect(summaryOf(base, TODAY)).toEqual({
      datum: "14. 5. 1990",
      misto: "Brno",
      cas: "14:30",
      casSummary: "čas 14:30",
    });
    expect(summaryOf({ ...base, mode: "unknown" }, TODAY)?.casSummary).toBe(
      "čas neznámý",
    );
    expect(
      summaryOf(
        { ...base, mode: "approx", approx: "part", part: "vecer" },
        TODAY,
      )?.cas,
    ).toBe("Večer 18:00–23:59");
    expect(formatTimeValue({ ...base, mode: "approx", approx: "120" })).toBe(
      "14:30 · ±2 h",
    );
    expect(formatTimeSummary({ ...base, mode: "unknown" })).toBe("čas neznámý");
    expect(summaryOf({ ...base, place: null }, TODAY)).toBeNull();
  });
});

describe("hledání míst (číselník ČR + SR)", () => {
  const index = buildIndex(
    placesFile as unknown as Parameters<typeof buildIndex>[0],
  );
  const names = (q: string) => searchPlaces(index, q).map((p) => p.name);

  it("číselník obsahuje všechny obce ČR a obce SR", () => {
    const cz = index.filter((p) => p.cc === "CZ").length;
    const sk = index.filter((p) => p.cc === "SK").length;
    expect(cz).toBeGreaterThanOrEqual(6200);
    expect(sk).toBeGreaterThanOrEqual(2900);
  });
  it("každá položka má okres", () => {
    expect(index.every((p) => p.okres.length > 0)).toBe(true);
  });
  it("přesná shoda je první, u položky je okres", () => {
    const r = searchPlaces(index, "Brno");
    expect(r[0].name).toBe("Brno");
    expect(r[0].okres).toBe("Brno-město");
  });
  it("bez ohledu na diakritiku a velikost písmen", () => {
    expect(names("plzen")).toContain("Plzeň");
    expect(names("ZILINA")).toContain("Žilina");
    expect(names("hradec kralove")).toContain("Hradec Králové");
    expect(names("Ceske Budejovice")).toContain("České Budějovice");
  });
  it("najde obce SR s okresem", () => {
    const z = searchPlaces(index, "Žilina").find((p) => p.cc === "SK");
    expect(z?.okres).toBe("Žilina");
  });
  it("stejnojmenné obce se liší okresem", () => {
    const r = searchPlaces(index, "Lhota", 20).filter(
      (p) => p.name === "Lhota",
    );
    expect(new Set(r.map((p) => p.okres)).size).toBeGreaterThan(1);
  });
  it("začátek názvu před slovem uprostřed, limit výsledků", () => {
    const r = searchPlaces(index, "nov", 8);
    expect(r.length).toBeLessThanOrEqual(8);
    expect(r[0].key.startsWith("nov")).toBe(true);
  });
  it("prázdný dotaz a nesmysl", () => {
    expect(searchPlaces(index, "")).toEqual([]);
    expect(searchPlaces(index, "qqqqqzzzz")).toEqual([]);
  });
});
