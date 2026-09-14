import type { Combo } from "./types";

/**
 * Geografické balíčky „Co lze přirozeně spojit" — SOURCE_PACK část 9, ř. 113–127.
 * Hlavička SP:113 explicitně: „geografické balíčky, NE dny."
 * 12 balíčků, žádný není přidělený ke konkrétnímu datu pobytu.
 */
export const COMBOS: Combo[] = [
  {
    id: "K01",
    title:
      "Roda / Apollónův chrám / Roda Loop nebo pobřežní procházka / Acharavi / Almyros",
    placeIds: [
      "roda-beach",
      "apollon-chram-roda",
      "roda-loop",
      "roda-acharavi-walk",
      "acharavi-beach",
      "almyros-beach",
    ],
    sp: "SP:114",
  },
  {
    id: "K02",
    title: "Agios Spiridon / Antinioti / Kalamaki / jezdecká aktivita",
    placeIds: ["agios-spiridon-beach", "antinioti-lagoon", "kalamaki-apraos"],
    sp: "SP:115",
  },
  {
    id: "K03",
    title: "Sidari / Canal d'Amour / Cape Drastis / Loggas",
    placeIds: [
      "canal-damour",
      "sidari-beach",
      "cape-drastis",
      "loggas-sunset-beach",
    ],
    sp: "SP:116",
  },
  {
    id: "K04",
    title: "Afionas / Porto Timoni / Agios Georgios Pagon",
    placeIds: ["porto-timoni", "afionas", "agios-georgios-pagon"],
    sp: "SP:117",
  },
  {
    id: "K05",
    title: "Paleokastritsa / Liapades / Rovinia / Angelokastro nebo Lakones",
    placeIds: [
      "paleokastritsa",
      "liapades",
      "rovinia-beach",
      "angelokastro",
      "lakones-viewpoint",
    ],
    sp: "SP:118",
  },
  {
    id: "K06",
    title: "Kassiopi / Avlaki / Kerasia / Kouloura / Kalami / Agni",
    placeIds: [
      "kassiopi-beach",
      "kassiopi",
      "avlaki-beach",
      "kerasia-beach",
      "kouloura",
      "kalami",
      "agni-bay",
    ],
    sp: "SP:119",
  },
  {
    id: "K07",
    title: "Nissaki / Kaminaki / Barbati / Ipsos",
    placeIds: ["nissaki-beach", "kaminaki", "barbati-beach", "ipsos"],
    sp: "SP:120",
  },
  {
    id: "K08",
    title: "Old Perithia / Pantokrator / Agios Spiridon nebo Kalamaki",
    placeIds: [
      "old-perithia",
      "mount-pantokrator",
      "agios-spiridon-beach",
      "kalamaki-apraos",
    ],
    sp: "SP:121",
  },
  {
    id: "K09",
    title: "Myrtiotissa / Pelekas / Agios Gordios",
    placeIds: ["myrtiotissa-beach", "pelekas-kaisers-throne", "agios-gordios"],
    sp: "SP:122",
  },
  {
    id: "K10",
    title: "Chalikounas / Lake Korission / Issos",
    placeIds: ["chalikounas-beach", "lake-korission", "issos-beach"],
    sp: "SP:123",
  },
  {
    id: "K11",
    title: "Marathias / Boukari / Petriti",
    placeIds: ["marathias-beach", "boukari", "petriti"],
    sp: "SP:124",
  },
  {
    id: "K12",
    title: "Corfu Town / festival / pevnost / večerní gastronomie",
    placeIds: ["corfu-town"],
    sp: "SP:125",
  },
];
