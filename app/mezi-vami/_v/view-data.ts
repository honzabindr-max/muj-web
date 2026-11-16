// Tvar dat stránky V a ukázková data (sdílené klientem i serverem).

import {
  KARTA,
  KDO_JE_KDO,
  NABIDKA,
  OTEVRENE,
  PAIR,
  TEMATA,
  VAZBY,
  type Tema,
  type NitTyp,
  type NoteTon,
  type VazbaTyp,
} from "../_data/fixtures";

type Row = {
  glyph: string;
  otazka: string;
  planeta: string;
  a: { text: string; znameni: string };
  b: { text: string; znameni: string };
  nit: NitTyp;
  ton: NoteTon;
  verdikt: string;
  veta: string;
};

export type DnaView = {
  pair: {
    a: string;
    b: string;
    title: string;
    nodesLabel: string;
    timeNote: string;
    mainTheme: { title: string; line: string };
  };
  kdoJeKdo: {
    eyebrow: string;
    title: string;
    lead: string;
    rows: Row[];
    zaver: { eyebrow: string; veta: string; astro: string; proto: string; odkaz: string; poznamka: string };
  };
  temata: Tema[];
  otevrene: typeof OTEVRENE;
  nabidka: typeof NABIDKA;
  karta: Omit<typeof KARTA, "tema" | "veta"> & { tema: string; veta: string };
  vazby: { typ: VazbaTyp; strong: boolean }[];
  /** id výpočtu; null = ukázka */
  id: string | null;
};

export const FIXTURE_VIEW: DnaView = {
  pair: PAIR as unknown as DnaView["pair"],
  kdoJeKdo: KDO_JE_KDO as unknown as DnaView["kdoJeKdo"],
  temata: TEMATA,
  otevrene: OTEVRENE as DnaView["otevrene"],
  nabidka: NABIDKA as DnaView["nabidka"],
  karta: KARTA as DnaView["karta"],
  vazby: VAZBY,
  id: null,
};

