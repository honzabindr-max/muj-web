import { describe, expect, it } from "vitest";

import { getListingById } from "../data/listings";
import { petCategory } from "../data/pets";

describe("pes — čtyři stavy (zadání bod 2.1)", () => {
  it("sam-06 je 'po dohodě' (jediný byt se zmínkou o zvířatech)", () => {
    expect(petCategory(getListingById("sam-06")!)).toBe("po_dohode");
  });

  it("ostatních 10 bytů je 'neuvedeno, ověřit'", () => {
    for (const id of ["sam-01", "sam-02", "sam-03", "sam-04", "sam-05", "sam-07", "sam-08", "sam-09", "sam-10", "sam-11"]) {
      expect(petCategory(getListingById(id)!)).toBe("neuvedeno");
    }
  });

  it("žádný byt dnes není 'výslovně schválen'", () => {
    for (const id of ["sam-01", "sam-02", "sam-03", "sam-04", "sam-05", "sam-06", "sam-07", "sam-08", "sam-09", "sam-10", "sam-11"]) {
      expect(petCategory(getListingById(id)!)).not.toBe("schvaleno");
    }
  });

  it("výslovné schválení konkrétního psa přepíše kategorii na 'schvaleno'", () => {
    const sam06 = getListingById("sam-06")!;
    expect(petCategory({ ...sam06, australian_shepherd_explicitly_approved: true })).toBe("schvaleno");
  });
});
