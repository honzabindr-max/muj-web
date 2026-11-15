import { describe, expect, it } from "vitest";
import placesFile from "../_data/places.json";
import {
  JAK_JSME,
  KARTA,
  KDO_JE_KDO,
  NABIDKA,
  OTEVRENE,
  PAIR,
  SDILENI,
  TEMATA,
} from "../_data/fixtures";
import { nbsp } from "./nbsp";
import { buildIndex, searchPlaces } from "./places";

const NB = "\u00a0";

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("COPY-07/08 — pevné mezery", () => {
  it("„vč. DPH“ se nedělí", () => {
    expect(nbsp("1 990 Kč vč. DPH")).toBe(`1${NB}990${NB}Kč vč.${NB}DPH`);
  });
  it("žádný řetězec fixtures nenechává jednopísmennou předložku na konci řádku", () => {
    const orphan = /(?:^|[\s(„"])[vkszouaiVKSZOUAI] (?=\S)/;
    const all = strings([PAIR, KDO_JE_KDO, TEMATA, SDILENI, JAK_JSME, OTEVRENE, NABIDKA, KARTA]);
    expect(all.filter((t) => orphan.test(t))).toEqual([]);
    expect(all.filter((t) => /vč\. DPH/.test(t))).toEqual([]);
  });
});

describe("COPY-04/05/06 — nabídka na výsledku podle v3.2", () => {
  it("označení ceny a lhůta doručení", () => {
    expect(NABIDKA.cenaLabel).toBe("Pracovní cena prototypu");
    const v = NABIDKA.vyhody.join(" ").replace(/\s/g, " ");
    expect(v).toContain("nejpozději do 48 hodin od potvrzené platby");
    expect(v).toContain("platí 30 dní");
  });
  it("devět částí = display labely CT-1", () => {
    expect(NABIDKA.kapitoly.map((k) => k.replace(/\s/g, " "))).toEqual([
      "Nejdřív to nejdůležitější",
      "Jak každý z vás funguje ve vztahu",
      "Pět vztahů uvnitř jednoho",
      "Láska, přitažlivost a intimita",
      "Emoce, komunikace a konflikt",
      "Blízkost, svoboda a každodenní fungování",
      "Co v sobě probouzíte a co vztah drží pohromadě",
      "Na doma",
      "Pod kapotou",
    ]);
  });
  it("štítek vzorku S1 / S2 podle matice SMP-M", () => {
    expect(NABIDKA.stitekS1.replace(/\s/g, " ")).toBe(
      "Provizorní ukázka — nejde o finální podobu zákaznického reportu.",
    );
    expect(NABIDKA.stitekS2).toBe("Vzorový report");
  });
});

describe("UX-03 — našeptávač míst", () => {
  const idx = buildIndex(placesFile as unknown as Parameters<typeof buildIndex>[0]);
  it("„Brn“ → Brno je první", () => {
    expect(searchPlaces(idx, "Brn")[0].name).toBe("Brno");
  });
  it("přesná shoda a velká města mají přednost", () => {
    expect(searchPlaces(idx, "Brno")[0].name).toBe("Brno");
    expect(searchPlaces(idx, "Kosice")[0]).toMatchObject({ name: "Košice", cc: "SK" });
    expect(searchPlaces(idx, "Pra")[0].name).toBe("Praha");
    expect(searchPlaces(idx, "Bratisl")[0].name).toBe("Bratislava");
  });
});
