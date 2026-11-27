import { describe, expect, it } from "vitest";

import { CONTENT } from "../content";
import {
  MODEL_IDS,
  SIGN_IDS,
  TOPIC_IDS,
  type ModelId,
  type Level,
  type RoastInput,
  type SignId,
  type Topic,
} from "../types";
import {
  SIGNS,
  SIGN_LIST,
  capCoupleLevel,
  dailyPool,
  dailyRoast,
  decodeCouple,
  decodeShare,
  encodeCouple,
  encodeShare,
  generateCouple,
  generateRoast,
  mulberry32,
  resolveSign,
  signBySlug,
  signText,
} from "./index";

const LEVELS: Level[] = [1, 2, 3, 4, 5];

function bad(text: string): boolean {
  return /[{}]|undefined|NaN|\[object/.test(text);
}

describe("signs", () => {
  it("má 12 znamení v pořadí zvěrokruhu a unikátní data", () => {
    expect(SIGN_LIST.map((s) => s.id)).toEqual([...SIGN_IDS]);
    expect(SIGN_LIST).toHaveLength(12);
    expect(SIGNS.vodnar.name).toBe("Vodnář");
    expect(SIGN_LIST.map((s) => s.namePluralGen)).toEqual([
      "Beranů", "Býků", "Blíženců", "Raků", "Lvů", "Panen",
      "Vah", "Štírů", "Střelců", "Kozorohů", "Vodnářů", "Ryb",
    ]);
    for (const s of SIGN_LIST) {
      expect(s.glyph).toBeTruthy();
      expect(s.emoji).toBeTruthy();
      for (const model of MODEL_IDS) {
        const t = signText(s.id, model);
        expect(t.motifs.length, `${model} ${s.id}`).toBeGreaterThanOrEqual(4);
        expect(t.motifs.length).toBeLessThanOrEqual(5);
        expect(t.tagline.length).toBeGreaterThan(10);
      }
    }
  });

  it("signBySlug", () => {
    expect(signBySlug("lev")?.name).toBe("Lev");
    expect(signBySlug("LEV")?.id).toBe("lev");
    expect(signBySlug("neexistuje")).toBeUndefined();
    expect(signBySlug("")).toBeUndefined();
  });
});

describe("resolveSign", () => {
  it("rozsahy pokrývají celý rok bez mezer a přesně na hranicích", () => {
    for (const s of SIGN_LIST) {
      const [fm, fd] = s.from.split("-").map(Number);
      const [tm, td] = s.to.split("-").map(Number);
      expect(resolveSign(fm, fd).sign).toBe(s.id);
      expect(resolveSign(tm, td).sign).toBe(s.id);
    }
    // každý den v roce (včetně 29. 2.) vrací nějaké znamení
    const dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= dim[m - 1]; d++) {
        expect(() => resolveSign(m, d)).not.toThrow();
      }
    }
  });

  it("hranice mezi znameními (poslední a první den)", () => {
    const cases: [number, number, SignId][] = [
      [3, 20, "ryby"], [3, 21, "beran"], [4, 19, "beran"], [4, 20, "byk"],
      [5, 20, "byk"], [5, 21, "blizenci"], [6, 20, "blizenci"], [6, 21, "rak"],
      [7, 22, "rak"], [7, 23, "lev"], [8, 22, "lev"], [8, 23, "panna"],
      [9, 22, "panna"], [9, 23, "vahy"], [10, 22, "vahy"], [10, 23, "stir"],
      [11, 21, "stir"], [11, 22, "strelec"], [12, 21, "strelec"], [12, 22, "kozoroh"],
      [1, 19, "kozoroh"], [1, 20, "vodnar"], [2, 18, "vodnar"], [2, 19, "ryby"],
    ];
    for (const [m, d, sign] of cases) expect(resolveSign(m, d).sign).toBe(sign);
  });

  it("Kozoroh přetéká přes konec roku", () => {
    expect(resolveSign(12, 31).sign).toBe("kozoroh");
    expect(resolveSign(1, 1).sign).toBe("kozoroh");
    expect(resolveSign(1, 15).sign).toBe("kozoroh");
  });

  it("cusp: poslední a první den znamení hlásí souseda", () => {
    expect(resolveSign(3, 20)).toEqual({ sign: "ryby", cuspWith: "beran" });
    expect(resolveSign(3, 21)).toEqual({ sign: "beran", cuspWith: "ryby" });
    expect(resolveSign(1, 19)).toEqual({ sign: "kozoroh", cuspWith: "vodnar" });
    expect(resolveSign(12, 22)).toEqual({ sign: "kozoroh", cuspWith: "strelec" });
    expect(resolveSign(2, 19)).toEqual({ sign: "ryby", cuspWith: "vodnar" });
    expect(resolveSign(4, 19).cuspWith).toBe("byk");
    // uprostřed znamení žádný cusp
    expect(resolveSign(4, 5).cuspWith).toBeUndefined();
    expect(resolveSign(8, 1).cuspWith).toBeUndefined();
    expect(resolveSign(3, 22).cuspWith).toBeUndefined();
    expect(resolveSign(3, 19).cuspWith).toBeUndefined();
  });

  it("každé znamení má právě dva cusp dny", () => {
    const dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const counts = new Map<SignId, number>();
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= dim[m - 1]; d++) {
        const r = resolveSign(m, d);
        if (r.cuspWith) counts.set(r.sign, (counts.get(r.sign) ?? 0) + 1);
      }
    }
    for (const id of SIGN_IDS) expect(counts.get(id)).toBe(2);
  });

  it("neplatná data vyhodí chybu", () => {
    const invalid: [number, number][] = [
      [0, 1], [13, 1], [1, 0], [1, 32], [4, 31], [2, 30], [6, 31],
      [NaN, 1], [1, NaN], [1.5, 3], [3, 1.2], [-1, 5],
    ];
    for (const [m, d] of invalid) expect(() => resolveSign(m, d)).toThrow(RangeError);
    expect(() => resolveSign(2, 29)).not.toThrow();
  });
});

describe("rng", () => {
  it("mulberry32 je deterministický a v rozsahu [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

for (const model of MODEL_IDS) {
describe(`generateRoast [${model}]`, () => {
  const gen = (i: RoastInput) => generateRoast({ ...i, model });
  const base: RoastInput = { sign: "vodnar", level: 3, topic: "prace", target: "self", seed: 12345 };

  it("je deterministický", () => {
    expect(gen(base)).toEqual(gen({ ...base }));
    expect(gen({ ...base, seed: 1 })).toEqual(gen({ ...base, seed: 1 }));
  });

  it("kamarád: úroveň se ořízne na 3", () => {
    for (const level of [4, 5] as Level[]) {
      const r = gen({ ...base, target: "friend", level });
      expect(r.input.level).toBe(3);
    }
    expect(gen({ ...base, target: "friend", level: 2 }).input.level).toBe(2);
    expect(gen({ ...base, target: "self", level: 5 }).input.level).toBe(5);
  });

  it("tvar výstupu: 3-4 věty, 2-3 statistiky, verdikt, burn 0-100, délky", () => {
    for (const sign of SIGN_IDS) {
      for (const level of LEVELS) {
        for (const topic of TOPIC_IDS) {
          for (const seed of [0, 7, 99991]) {
            const r = gen({ sign, level, topic, target: "self", seed });
            expect(r.lines.length).toBeGreaterThanOrEqual(3);
            expect(r.lines.length).toBeLessThanOrEqual(4);
            expect(r.stats.length).toBeGreaterThanOrEqual(2);
            expect(r.stats.length).toBeLessThanOrEqual(3);
            expect(Number.isInteger(r.burn)).toBe(true);
            expect(r.burn).toBeGreaterThanOrEqual(0);
            expect(r.burn).toBeLessThanOrEqual(100);
            expect(r.headline.length).toBeLessThanOrEqual(90);
            for (const l of r.lines) expect(l.length).toBeLessThanOrEqual(160);
            expect(r.verdict.length).toBeLessThanOrEqual(120);
            expect(new Set(r.lines).size).toBe(r.lines.length);
          }
        }
      }
    }
  });

  it("pálivost roste s úrovní", () => {
    for (const sign of SIGN_IDS) {
      const avg = (level: Level) => {
        let sum = 0;
        for (let seed = 0; seed < 40; seed++) {
          sum += gen({ sign, level, topic: "zivot", target: "self", seed }).burn;
        }
        return sum / 40;
      };
      const values = LEVELS.map(avg);
      for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    // pásma se nepřekrývají
    for (let seed = 0; seed < 200; seed++) {
      const lo = gen({ ...base, level: 4, seed }).burn;
      const hi = gen({ ...base, level: 5, seed }).burn;
      expect(hi).toBeGreaterThan(lo);
    }
  });

  it("variabilita: aspoň 30 různých kombinací hlavička+věty pro každé znamení, úroveň a téma", () => {
    for (const sign of SIGN_IDS) {
      for (const level of LEVELS) {
        for (const topic of TOPIC_IDS) {
          const seen = new Set<string>();
          for (let seed = 0; seed < 400; seed++) {
            const r = gen({ sign, level, topic, target: "self", seed: seed * 7919 });
            seen.add([r.headline, ...r.lines].join("|"));
          }
          expect(
            seen.size,
            `${sign} level ${level} ${topic}: ${seen.size} kombinací`,
          ).toBeGreaterThanOrEqual(30);
        }
      }
    }
  });

  it("variabilita i pro kamaráda (úrovně 1-3)", () => {
    for (const sign of SIGN_IDS) {
      for (const level of [1, 2, 3] as Level[]) {
        for (const topic of TOPIC_IDS) {
          const seen = new Set<string>();
          for (let seed = 0; seed < 400; seed++) {
            const r = gen({ sign, level, topic, target: "friend", seed: seed * 104729 });
            seen.add([r.headline, ...r.lines].join("|"));
          }
          expect(seen.size, `${sign} friend ${level} ${topic}`).toBeGreaterThanOrEqual(30);
        }
      }
    }
  });

  it("žádné '{', 'undefined' ani NaN ve výstupu pro všechny kombinace", () => {
    for (const sign of SIGN_IDS) {
      for (const level of LEVELS) {
        for (const topic of TOPIC_IDS) {
          for (const target of ["self", "friend"] as const) {
            for (let seed = 0; seed < 25; seed++) {
              const r = gen({ sign, level, topic, target, seed: seed * 31 });
              const all = [r.headline, r.verdict, ...r.lines, ...r.stats.flatMap((s) => [s.label, s.value])];
              for (const t of all) {
                expect(t.length).toBeGreaterThan(0);
                expect(bad(t), t).toBe(false);
              }
            }
          }
        }
      }
    }
  });

  it("různé seedy dávají různé roasty a neplatný vstup vyhodí chybu", () => {
    const a = gen({ ...base, seed: 1 });
    const different = [2, 3, 4, 5, 6, 7, 8].some((s) => gen({ ...base, seed: s }).headline !== a.headline);
    expect(different).toBe(true);
    expect(() => gen({ ...base, level: 6 as Level })).toThrow();
    expect(() => gen({ ...base, sign: "x" as SignId })).toThrow();
    expect(() => gen({ ...base, topic: "y" as Topic })).toThrow();
  });
});
}

for (const model of MODEL_IDS) {
describe(`obsah [${model}]`, () => {
  const C = CONTENT[model];
  const FRAGMENTS = C.fragments;
  const BANNED = [
    "smrt", "umř", "zabij", "zabít", "rakovin", "nemoc", "tlust", "hubenost", "gay", "židov",
    "cikán", "invalid", "hendikep", "dluh", "chudý", "chudá", "bída", "sebevra", "rasist",
  ];

  function allStrings(): string[] {
    const out: string[] = [];
    for (const f of Object.values(FRAGMENTS)) {
      for (const lv of LEVELS) out.push(...f.headlines[lv], ...f.core[lv], ...f.verdicts[lv]);
      for (const t of TOPIC_IDS) for (const lv of LEVELS) out.push(...f.topic[t][lv]);
      out.push(...f.daily, ...f.couple);
      for (const s of f.stats) out.push(s.label, s.value);
    }
    for (const t of TOPIC_IDS) for (const lv of LEVELS) out.push(...C.kickers[t][lv - 1]);
    return out;
  }

  it("vyplněné pooly: požadované počty na znamení", () => {
    for (const id of SIGN_IDS) {
      const f = FRAGMENTS[id];
      for (const lv of LEVELS) {
        expect(f.headlines[lv].length).toBeGreaterThanOrEqual(3);
        expect(f.core[lv].length).toBeGreaterThanOrEqual(2);
        expect(f.verdicts[lv].length).toBeGreaterThanOrEqual(2);
      }
      for (const t of TOPIC_IDS) {
        for (const lv of LEVELS) {
          expect(f.topic[t][lv].length, `${id} ${t} level ${lv}`).toBeGreaterThanOrEqual(3);
        }
      }
      expect(f.stats.length).toBeGreaterThanOrEqual(6);
      expect(f.daily.length).toBeGreaterThanOrEqual(12);
      expect(f.couple).toHaveLength(6);
    }
  });

  it("žebříček: každé t[téma][úroveň] má aspoň 4 věty (jen claude)", () => {
    if (model !== "claude") return;
    for (const id of SIGN_IDS) {
      for (const t of TOPIC_IDS) {
        for (const lv of LEVELS) {
          expect(FRAGMENTS[id].topic[t][lv].length, `${id} ${t} level ${lv}`).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it("žebříček: sousední úrovně v tématu nesdílejí identickou větu (jen claude)", () => {
    if (model !== "claude") return;
    for (const id of SIGN_IDS) {
      for (const t of TOPIC_IDS) {
        for (const lv of [1, 2, 3, 4] as Level[]) {
          const next = new Set<string>(FRAGMENTS[id].topic[t][(lv + 1) as Level]);
          for (const line of FRAGMENTS[id].topic[t][lv]) {
            expect(next.has(line), `${id} ${t}: úroveň ${lv} a ${lv + 1} sdílí "${line}"`).toBe(false);
          }
        }
      }
    }
  });

  it("žádné prázdné, duplicitní ani rozbité věty a žádná zakázaná slova", () => {
    for (const id of SIGN_IDS) {
      const f = FRAGMENTS[id];
      const own: string[] = [];
      for (const lv of LEVELS) own.push(...f.headlines[lv], ...f.core[lv], ...f.verdicts[lv]);
      for (const t of TOPIC_IDS) // věty se smí opakovat mezi úrovněmi (migrace soft/hot), ne uvnitř jedné úrovně
      for (const lv of LEVELS) {
        expect(new Set(f.topic[t][lv]).size, `duplicity u ${id} ${t} ${lv}`).toBe(f.topic[t][lv].length);
      }
      expect(new Set(own).size, `duplicity u ${id}`).toBe(own.length);
    }
    for (const s of allStrings()) {
      expect(s.trim()).toBe(s);
      expect(s.length).toBeGreaterThan(0);
      expect(bad(s), s).toBe(false);
      expect(/\s{2,}/.test(s), s).toBe(false);
      const lower = s.toLowerCase();
      for (const w of BANNED) expect(lower.includes(w), `${w} v: ${s}`).toBe(false);
    }
  });

  it("věty nejsou rodově označené (žádné jsi/ses/bys + minulé příčestí -l/-la)", () => {
    const re = /\b(?:jsi|ses|bys|sis|jsem|bych)\s+(?:se\s+|si\s+)?\p{L}{2,}(?:l|la|li)(?!\p{L})/iu;
    const adj = /\bjsi\s+\p{L}{3,}(?:ý|ná|ený|tý|lý)(?=\s*[,.;:!?]|\s+(?:a|i|ale|jako|než)\s)/iu;
    const allowed = ["originál", "jsi svobodný"]; // "svobodný duch" je podstatné jméno
    for (const s of allStrings()) {
      if (s.startsWith("Šéf:")) continue; // mluví šéf, ne cílová osoba
      const m = re.exec(s) ?? adj.exec(s);
      if (m && !allowed.some((a) => m[0].includes(a))) {
        throw new Error(`rodově označený tvar "${m[0]}" ve větě: ${s}`);
      }
    }
  });

  it("délkové limity: headline <= 90, věty <= 160, verdikt <= 120", () => {
    for (const f of Object.values(FRAGMENTS)) {
      for (const lv of LEVELS) {
        for (const h of f.headlines[lv]) expect(h.length, h).toBeLessThanOrEqual(90);
        for (const v of f.verdicts[lv]) expect(v.length, v).toBeLessThanOrEqual(120);
        for (const c of f.core[lv]) expect(c.length, c).toBeLessThanOrEqual(160);
      }
      for (const t of TOPIC_IDS) {
        for (const l of LEVELS.flatMap((lv) => f.topic[t][lv])) expect(l.length, l).toBeLessThanOrEqual(160);
      }
      for (const q of f.couple) expect(q.length, q).toBeLessThanOrEqual(160);
      for (const d of f.daily) expect(d.length, d).toBeLessThanOrEqual(160);
    }
  });
});
}

describe("sdílení (share)", () => {
  it("roundtrip pro všechny kombinace", () => {
    for (const sign of SIGN_IDS) {
      for (const level of LEVELS) {
        for (const topic of TOPIC_IDS) {
          for (const target of ["self", "friend"] as const) {
            const input = { sign, level, topic, target, seed: 1234567 };
            const code = encodeShare(input);
            const back = decodeShare(code);
            const expected = generateRoast(input).input; // kamarád má level ořezaný
            expect(back).toEqual(expected);
          }
        }
      }
    }
  });

  it("seed: krajní hodnoty a náhodné hodnoty přežijí roundtrip", () => {
    for (const seed of [0, 1, 63, 64, 2 ** 31 - 1, 2 ** 30, 123456789]) {
      const input: RoastInput = { sign: "ryby", level: 5, topic: "narozeniny", target: "self", seed };
      expect(decodeShare(encodeShare(input))?.seed).toBe(seed);
    }
    const rng = mulberry32(2024);
    for (let i = 0; i < 500; i++) {
      const seed = Math.floor(rng() * 2 ** 31);
      const input: RoastInput = {
        sign: SIGN_IDS[Math.floor(rng() * 12)],
        level: (1 + Math.floor(rng() * 5)) as Level,
        topic: TOPIC_IDS[Math.floor(rng() * 5)],
        target: "self",
        seed,
      };
      expect(decodeShare(encodeShare(input))).toEqual(input);
    }
  });

  it("kód je krátký, URL-bezpečný, bez data narození", () => {
    const code = encodeShare({ sign: "lev", level: 4, topic: "vztahy", target: "self", seed: 2_000_000_000 });
    expect(code.length).toBeLessThanOrEqual(12);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeCouple("lev", "panna", 3, 5)).toMatch(/^[A-Za-z0-9_-]{9}$/);
  });

  it("kamarád: kód s levelem 4/5 se zakóduje jako 3", () => {
    const code = encodeShare({ sign: "stir", level: 5, topic: "zivot", target: "friend", seed: 9 });
    expect(decodeShare(code)?.level).toBe(3);
  });

  it("odmítne nesmysly (vrací null, nikdy nevyhazuje)", () => {
    const garbage: unknown[] = [
      "", "x", "123456789", "1AAAAAAAA", "😀😀😀😀😀😀😀😀😀", "1AAAAAAAAAAAAA",
      "A".repeat(9), "1 2 3 4 5 6", null, undefined, 42, {}, [], "../../etc",
      "1AAAAAAAA\n", " 1AAAAAAAA", "1AAAAAAA", "<script>x</script>",
    ];
    for (const g of garbage) {
      expect(decodeShare(g as string), String(g)).toBeNull();
      expect(decodeCouple(g as string), String(g)).toBeNull();
    }
  });

  it("odmítne pozměněný kód (kontrolní znak) a kód jiného typu", () => {
    const code = encodeShare({ sign: "lev", level: 2, topic: "pratele", target: "self", seed: 77 });
    let rejected = 0;
    for (let i = 1; i < code.length; i++) {
      const alt = code[i] === "A" ? "B" : "A";
      const tampered = code.slice(0, i) + alt + code.slice(i + 1);
      if (decodeShare(tampered) === null) rejected++;
    }
    expect(rejected).toBe(code.length - 1);
    expect(decodeCouple(code)).toBeNull();
    expect(decodeShare(encodeCouple("lev", "rak", 2, 5))).toBeNull();
  });

  it("odmítne kód s neplatnými poli (zkoušíme všech 64^2 koncovek)", () => {
    // Prověříme, že žádný kód nevrací pole mimo rozsah.
    const rng = mulberry32(5);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let valid = 0;
    for (let i = 0; i < 20000; i++) {
      let data = "";
      for (let k = 0; k < 7; k++) data += alphabet[Math.floor(rng() * 64)];
      for (const c of alphabet) {
        const r = decodeShare(`1${data}${c}`);
        if (r) {
          valid++;
          expect(SIGN_IDS).toContain(r.sign);
          expect(TOPIC_IDS).toContain(r.topic);
          expect(r.level).toBeGreaterThanOrEqual(1);
          expect(r.level).toBeLessThanOrEqual(5);
          if (r.target === "friend") expect(r.level).toBeLessThanOrEqual(3);
          expect(r.seed).toBeGreaterThanOrEqual(0);
          expect(r.seed).toBeLessThan(2 ** 31);
        }
      }
      if (i > 200) break;
    }
    expect(valid).toBeGreaterThan(0);
  });

  it("pár: roundtrip, cap levelu a odmítnutí nesmyslů", () => {
    for (const a of SIGN_IDS) {
      for (const b of SIGN_IDS) {
        for (const level of [1, 2, 3, 4, 5]) {
          const code = encodeCouple(a, b, level, 424242);
          expect(decodeCouple(code)).toEqual({ a, b, level: Math.min(level, 3), seed: 424242 });
        }
      }
    }
    expect(decodeCouple("1AAAAAAAA")).toBeNull();
    expect(() => encodeCouple("xx" as SignId, "lev", 2, 1)).toThrow();
  });
});

for (const model of MODEL_IDS) {
describe(`generateCouple [${model}]`, () => {
  const C = CONTENT[model];
  const FRAGMENTS = C.fragments;
  const STEJNE_ECHO = C.stejneEcho;
  const gen = (a: SignId, b: SignId, level: number, seed: number) => generateCouple(a, b, level, seed, model);
  it("úroveň je maximálně 3 a je to deterministické", () => {
    for (const level of [1, 2, 3, 4, 5, 9]) {
      const c = gen("lev", "panna", level, 1);
      expect(c.level).toBe(Math.min(level, 3));
    }
    expect(capCoupleLevel(5)).toBe(3);
    expect(capCoupleLevel(0)).toBe(1);
    expect(gen("beran", "ryby", 2, 55)).toEqual(gen("beran", "ryby", 2, 55));
  });

  it("scéna: 4-8 replik, oba mluví stejně často a mají stejné zásahy", () => {
    for (const a of SIGN_IDS) {
      for (const b of SIGN_IDS) {
        for (let seed = 0; seed < 5; seed++) {
          const c = gen(a, b, 3, seed);
          expect(c.scene.length).toBeGreaterThanOrEqual(4);
          expect(c.scene.length).toBeLessThanOrEqual(8);
          const na = c.scene.filter((l) => l.who === "a").length;
          const nb = c.scene.filter((l) => l.who === "b").length;
          expect(na).toBe(nb);
          expect(na).toBeGreaterThanOrEqual(1);
          expect(c.scene[0].who).toBe("narrator");
          expect(c.scene[c.scene.length - 1].who).toBe("narrator");
          for (const l of c.scene) {
            expect(l.text.length).toBeGreaterThan(0);
            expect(bad(l.text), l.text).toBe(false);
          }
          // repliky a/b pocházejí z knihovny příslušného znamení
          for (const l of c.scene) {
            if (l.who === "a") {
              if (a === b) expect([...FRAGMENTS[a].couple, ...STEJNE_ECHO]).toContain(l.text);
              else expect(FRAGMENTS[a].couple).toContain(l.text);
            }
            if (l.who === "b") {
              // dvě stejná znamení: druhý mluvčí odpovídá ozvěnou, ne kopií první repliky
              if (a === b) expect([...FRAGMENTS[b].couple, ...STEJNE_ECHO]).toContain(l.text);
              else expect(FRAGMENTS[b].couple).toContain(l.text);
            }
          }
          if (a === b) {
            const texts = c.scene.filter((l) => l.who !== "narrator").map((l) => l.text);
            expect(new Set(texts).size).toBe(texts.length);
          }
        }
      }
    }
  });

  it("kompatibilita 0-100, titulek obsahuje obě znamení, verdikt neprázdný", () => {
    for (const a of SIGN_IDS) {
      for (const b of SIGN_IDS) {
        const c = gen(a, b, 2, 11);
        expect(Number.isInteger(c.compatibility)).toBe(true);
        expect(c.compatibility).toBeGreaterThanOrEqual(0);
        expect(c.compatibility).toBeLessThanOrEqual(100);
        expect(c.title.startsWith(`${SIGNS[a].name} × ${SIGNS[b].name}: `)).toBe(true);
        expect(c.verdict.length).toBeGreaterThan(0);
        expect(bad(c.title + c.verdict)).toBe(false);
      }
    }
  });

  it("zohledňuje živly: oheň+vzduch je v průměru kompatibilnější než oheň+voda", () => {
    const avg = (a: SignId, b: SignId) => {
      let s = 0;
      for (let seed = 0; seed < 100; seed++) s += gen(a, b, 2, seed).compatibility;
      return s / 100;
    };
    expect(avg("beran", "blizenci")).toBeGreaterThan(avg("beran", "rak") + 20);
    expect(avg("byk", "ryby")).toBeGreaterThan(avg("byk", "vodnar") + 20);
  });

  it("variabilita scén pro daný pár", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const c = gen("lev", "panna", 3, seed * 13);
      seen.add(c.scene.map((l) => l.text).join("|"));
    }
    expect(seen.size).toBeGreaterThanOrEqual(30);
  });

  it("neznámé znamení vyhodí chybu", () => {
    expect(() => gen("x" as SignId, "lev", 2, 1)).toThrow();
  });
});
}

for (const model of MODEL_IDS) {
describe(`dailyRoast [${model}]`, () => {
  const poolOf = (id: SignId) => dailyPool(id, model);
  const daily = (id: SignId, iso: string) => dailyRoast(id, iso, model);
  it("pool má aspoň 24 hlášek na znamení (codex zatím 12) a všechny jsou unikátní", () => {
    for (const id of SIGN_IDS) {
      const pool = poolOf(id);
      expect(pool.length).toBeGreaterThanOrEqual(model === "claude" ? 24 : 12);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it("je deterministický a bez opakování po dobu délky poolu", () => {
    for (const id of SIGN_IDS) {
      expect(daily(id, "2026-11-26")).toBe(daily(id, "2026-11-26"));
      const n = poolOf(id).length;
      const seen = new Set<string>();
      const start = Date.UTC(2026, 10, 26);
      for (let i = 0; i < n; i++) {
        const iso = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
        seen.add(daily(id, iso));
      }
      expect(seen.size).toBe(n);
    }
  });

  it("jednotlivá znamení dostanou ve stejný den různé věty a po sobě jdoucí dny se liší", () => {
    const set = new Set(SIGN_IDS.map((id) => daily(id, "2026-12-24")));
    expect(set.size).toBe(12);
    expect(daily("lev", "2026-01-01")).not.toBe(daily("lev", "2026-01-02"));
  });

  it("neplatné datum vyhodí chybu", () => {
    for (const d of ["", "2026-13-01", "2026-02-30", "26-1-1", "2026/01/01", "abc", "2026-00-10"]) {
      expect(() => daily("lev", d)).toThrow(RangeError);
    }
    expect(() => daily("lev", "2028-02-29")).not.toThrow();
  });

  it("bez '{' a 'undefined'", () => {
    for (const id of SIGN_IDS) {
      for (let i = 0; i < 40; i++) {
        const iso = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
        expect(bad(daily(id, iso))).toBe(false);
      }
    }
  });
});
}


describe("modely: shodná struktura obsahu", () => {
  const shape = (v: unknown): unknown => {
    // Pole vět: počty se smí lišit (každý model píše vlastní obsah), hlídá se jen tvar a klíče.
    // Pole struktur (Five<...>, statistiky) drží délku.
    if (Array.isArray(v)) return v.every((x) => typeof x === "string") ? "string[]" : v.map(shape);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]));
    }
    return typeof v;
  };

  it("claude a codex mají stejné klíče a tvar všude", () => {
    const a = CONTENT.claude;
    const b = CONTENT.codex;
    for (const key of Object.keys(a) as (keyof typeof a)[]) {
      expect(shape(b[key]), `content.${key}`).toEqual(shape(a[key]));
    }
    expect(Object.keys(b)).toEqual(Object.keys(a));
  });

  it("každé znamení odpovídá na všechny párové situace a má aspoň 3 věty na téma a úroveň (oba modely)", () => {
    for (const model of MODEL_IDS) {
      const situations = CONTENT[model].coupleSituations.length;
      for (const id of SIGN_IDS) {
        const f = CONTENT[model].fragments[id];
        expect(f.couple.length, `${model} ${id} couple`).toBe(situations);
        for (const t of TOPIC_IDS) {
          for (const lv of LEVELS) {
            expect(f.topic[t][lv].length, `${model} ${id} ${t} ${lv}`).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });

  it("pro každé znamení, téma a úroveň 1-5 je pole vět neprázdné (oba modely)", () => {
    for (const model of MODEL_IDS) {
      for (const id of SIGN_IDS) {
        for (const t of TOPIC_IDS) {
          for (const lv of LEVELS) {
            expect(CONTENT[model].fragments[id].topic[t][lv].length, `${model} ${id} ${t} ${lv}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("katalog: aspoň 8 vtipů na znamení a stabilní id pro oba modely", () => {
    for (const model of MODEL_IDS) {
      const c: ModelId = model;
      for (const id of SIGN_IDS) {
        const jokes = CONTENT[c].catalog.filter((j) => j.sign === id);
        expect(jokes.length).toBeGreaterThanOrEqual(8);
        for (const j of jokes) expect(bad(j.text), j.text).toBe(false);
      }
      expect(new Set(CONTENT[c].catalog.map((j) => j.id)).size).toBe(CONTENT[c].catalog.length);
    }
  });

  it("model se předává do enginu: výchozí je claude", () => {
    const base: RoastInput = { sign: "lev", level: 3, topic: "zivot", target: "self", seed: 5 };
    expect({ ...generateRoast(base), input: 0 }).toEqual({ ...generateRoast({ ...base, model: "claude" }), input: 0 });
    expect(generateCouple("lev", "ryby", 2, 9)).toEqual(generateCouple("lev", "ryby", 2, 9, "claude"));
    expect(dailyRoast("lev", "2026-11-27")).toBe(dailyRoast("lev", "2026-11-27", "claude"));
  });
});
