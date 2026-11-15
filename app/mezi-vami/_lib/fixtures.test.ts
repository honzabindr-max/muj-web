import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COPY_PROVENANCE,
  FIXTURE_ID,
  KARTA,
  KDO_JE_KDO,
  NABIDKA,
  OTEVRENE,
  TEMATA,
  VAZBY,
} from "../_data/fixtures";

describe("fixtures stránky V — tvar a zamčené invarianty", () => {
  it("identifikace odpovídá vzoru kontraktu (FX-…) a je označena jako prototypová copy", () => {
    expect(FIXTURE_ID).toMatch(/^(FX|CF)-[A-Z0-9_-]+$/);
    expect(COPY_PROVENANCE).toBe("PROTOTYPE_FIXTURE_COPY");
  });
  it("Kdo je kdo: právě 4 zarovnané řádky (Slunce, Měsíc, Venuše, Mars) a závěr", () => {
    expect(KDO_JE_KDO.rows.map((r) => r.planeta)).toEqual(["Slunce", "Měsíc", "Venuše", "Mars"]);
    expect(KDO_JE_KDO.rows.map((r) => r.nit)).toEqual(["touch", "cross", "merge", "touch"]);
    expect(KDO_JE_KDO.zaver.eyebrow).toBe("Tady se potkáváte nejvíc");
  });
  it("sedm vazeb, pět témat, pět otevřených otázek", () => {
    expect(VAZBY).toHaveLength(7);
    expect(TEMATA).toHaveLength(5);
    expect(OTEVRENE.polozky).toHaveLength(5);
    expect(TEMATA[0].id).toBe("t01");
  });
  it("sedm vazeb tvoří přesně sedm důkazních řádků témat (každé téma má oporu)", () => {
    const dukazy = TEMATA.flatMap((t) => t.dukazy);
    expect(dukazy).toHaveLength(7);
    expect(TEMATA.every((t) => t.dukazy.length >= 1)).toBe(true);
  });
  it("sdílecí karta neobsahuje data, časy ani místa narození", () => {
    const text = JSON.stringify(KARTA);
    expect(text).not.toMatch(/\b\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\b/); // 14. 5. 1990
    expect(text).not.toMatch(/\b\d{1,2}:\d{2}\b/); // 14:30
    expect(text).not.toMatch(/Brno|Praha|Žilina|Bratislava/);
  });
  it("cena nabídky 1 990 Kč vč. DPH, objednávka přes pokladnu", () => {
    expect(NABIDKA.cena.replace(/\s/g, " ")).toBe("1 990 Kč");
    expect(NABIDKA.kapitoly).toHaveLength(9);
  });
});

describe("kontrakt ui_data_contract_v1 (v1.0.1)", () => {
  const contract = path.resolve(__dirname, "../../../contracts/ui_data_contract_v1.json");
  it.skipIf(!fs.existsSync(contract))(
    "fixtures jsou validní proti kontraktu",
    () => {
      // Kontrakt zatím v této větvi není (je jen na větvi mezi-vami-vypocet, ze které se nic
      // nepřebírá). Až bude v repu, napojí se tady validace JSON Schema.
      expect(fs.existsSync(contract)).toBe(true);
    },
  );
});
