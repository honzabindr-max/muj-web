import { describe, expect, it } from "vitest";

import { getAllListings, getArchivedListings, getListingById } from "../data/listings";

describe("archiv (sam-02, sam-11) odděleně od aktivního katalogu", () => {
  it("výchozí aktivní katalog má 13 bytů a neobsahuje sam-02 ani sam-11", () => {
    const active = getAllListings();
    expect(active).toHaveLength(13);
    expect(active.some((l) => l.id === "sam-02")).toBe(false);
    expect(active.some((l) => l.id === "sam-11")).toBe(false);
  });

  it("archiv obsahuje přesně sam-02 a sam-11, celkem 2 byty", () => {
    const archived = getArchivedListings();
    expect(archived).toHaveLength(2);
    expect(archived.map((l) => l.id)).toEqual(["sam-02", "sam-11"]);
  });

  it("sam-02 je stará Opálkova 68 m²", () => {
    const sam02 = getArchivedListings().find((l) => l.id === "sam-02")!;
    expect(sam02.street).toBe("Opálkova");
    expect(sam02.area_m2).toBe(68);
  });

  it("sam-15 je nová Opálkova 62 m² a je aktivní, ne archivovaná", () => {
    const sam15 = getListingById("sam-15")!;
    expect(sam15.street).toBe("Opálkova");
    expect(sam15.area_m2).toBe(62);
    expect(getArchivedListings().some((l) => l.id === "sam-15")).toBe(false);
  });

  it("sam-02 a sam-15 se nikdy nesloučí (různá ID, různá plocha, různý zdroj)", () => {
    const sam02 = getArchivedListings().find((l) => l.id === "sam-02")!;
    const sam15 = getListingById("sam-15")!;
    expect(sam02.id).not.toBe(sam15.id);
    expect(sam02.area_m2).not.toBe(sam15.area_m2);
    expect(sam02.source_url).not.toBe(sam15.source_url);
  });

  it("každý archivovaný byt má důvod a čas archivace", () => {
    for (const listing of getArchivedListings()) {
      expect(listing.archive_status.length).toBeGreaterThan(0);
      expect(listing.archived_at.length).toBeGreaterThan(0);
    }
  });

  it("getListingById nevrací archivované byty (jen aktivní katalog)", () => {
    expect(getListingById("sam-02")).toBeUndefined();
    expect(getListingById("sam-11")).toBeUndefined();
  });
});
