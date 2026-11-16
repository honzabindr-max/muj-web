// Dosazení oslovení do textů se značkami {A1}…{B7} (sdílené klientem i serverem).

export type NameForms = { a: string[]; b: string[] };

/** Tvary pro chybějící oslovení (pád 1–7). */
export const FALLBACK_FORMS: NameForms = {
  a: ["první osoba", "první osoby", "první osobě", "první osobu", "první osobo", "první osobě", "první osobou"],
  b: ["druhá osoba", "druhé osoby", "druhé osobě", "druhou osobu", "druhá osobo", "druhé osobě", "druhou osobou"],
};

const PH = /\{([AB])([1-7])\}/g;

/** Nahradí značky tvary jmen; na začátku věty velké písmeno. */
export function fillNames(s: string, forms: NameForms): string {
  return s.replace(PH, (_m, who: string, pad: string, offset: number, all: string) => {
    const w = forms[who === "A" ? "a" : "b"][Number(pad) - 1] ?? "";
    const before = all.slice(0, offset).trimEnd();
    const sentenceStart = before === "" || /[.!?:„“"–&]$/.test(before);
    return sentenceStart ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
}

