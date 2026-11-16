import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import {
  COPY_PROVENANCE,
  FIXTURE_ID,
  KARTA,
  KDO_JE_KDO,
  NABIDKA,
  PAIR,
  ZDROJ_ANALYZY,
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

const CONTRACT_PATH = path.resolve(__dirname, "../../../contracts/ui_data_contract_v1.json");
const CONTRACT_SHA256 = "35d6215d036e3c1c9dbbdd6ae188b548f935243f8e85831db310e40f04b30bc8";

describe("kontrakt ui_data_contract_v1 (v1.0.1)", () => {
  const raw = fs.readFileSync(CONTRACT_PATH);
  const contract = JSON.parse(raw.toString("utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  ajv.addSchema(contract);
  const ref = (def: string) => {
    const v = ajv.getSchema(`${contract.$id}#/$defs/${def}`);
    if (!v) throw new Error(`chybí definice ${def}`);
    return v;
  };
  const check = (def: string, data: unknown) => {
    const v = ref(def);
    expect(v(data), JSON.stringify(v.errors)).toBe(true);
  };

  it("soubor kontraktu je přesně ten schválený (SHA-256)", () => {
    expect(createHash("sha256").update(raw).digest("hex")).toBe(CONTRACT_SHA256);
    expect(contract.properties.contract_version.const).toBe("1.0.1");
  });

  // Fixtures nenesou identifikátory, sloty ani rozpočty znaků; ty doplňuje jen tento test
  // (syntetické, ve tvaru kontraktu). Validují se TEXTY a vazby, které fixtures zobrazují.
  const budget = { headline_max_chars: 120, body_max_chars: 1200, overflow_policy: "REWRITE_OR_RECOMPOSE", provisional: true };
  const slots = [
    ["R1", "CORE_SIGNATURE"],
    ["R2", "PARADOX"],
    ["R3", "SUPPORTIVE_PATTERN"],
    ["R4", "SALIENT_NEUTRAL_PATTERN"],
    ["R5", "OBSERVATIONAL_APPLICATION"],
  ] as const;
  const insights = TEMATA.map((t, i) => ({
    insight_id: `FX-INS-${t.id}`,
    slot: slots[i][0],
    slot_realisation: slots[i][1],
    headline: t.nadpis,
    body: t.text,
    evidence_anchors: t.dukazy.map((d, k) => ({
      anchor_id: `FX-ANC-${t.id}-${k}`,
      supports_insight_id: `FX-INS-${t.id}`,
      analysis_revision_ref: "FX-REV-DEMO01",
      customer_label: d.text,
    })),
    content_budget: budget,
  }));

  it("téma 01 je R1Insight, témata 02–05 jsou OptionalInsight (headline, body, opory)", () => {
    check("R1Insight", insights[0]);
    insights.slice(1).forEach((x) => check("OptionalInsight", x));
  });

  it("limitace času (COPY-14a/14b) odpovídá Limitation", () => {
    check("Limitation", { code: "TIME_APPROXIMATE_PERSON_A", customer_text: PAIR.timeNote });
    check("Limitation", { code: "TIMED_LAYERS_UNAVAILABLE", customer_text: NABIDKA.timeNote });
  });

  it("devět kapitol nabídky odpovídá ScopeSection v pevném pořadí OfferViewModel", () => {
    const order: string[] = contract.$defs.OfferViewModel.properties.scope_sections.prefixItems.map(
      (p: { allOf: { properties?: { section_id?: { const: string } } }[] }) =>
        p.allOf[1].properties!.section_id!.const,
    );
    expect(order).toHaveLength(9);
    NABIDKA.kapitoly.forEach((label, i) =>
      check("ScopeSection", { section_id: order[i], display_label: label }),
    );
  });

  it("zobrazená cena odpovídá PriceConfig", () => {
    check("PriceConfig", {
      amount_minor_units: 199000,
      currency: "CZK",
      display: NABIDKA.cena,
      is_config: true,
      vat_included: true,
      one_time_purchase: true,
      confirmation_status: "P1_WORKING_DISPLAY_PRICE",
    });
  });

  it("negativní kontrola: validátor skutečně odmítá (limitace přes 400 znaků)", () => {
    expect(ref("Limitation")({ code: "TIMED_LAYERS_UNAVAILABLE", customer_text: "x".repeat(401) })).toBe(false);
  });

  it("B-P0 (ZDROJ_ANALYZY) nemá v kontraktu pole; jen hlídáme, že jde o 4 odstavce", () => {
    expect(ZDROJ_ANALYZY.odstavce).toHaveLength(4);
    expect(JSON.stringify(contract)).not.toMatch(/Z čeho analýza vychází/);
  });
});
