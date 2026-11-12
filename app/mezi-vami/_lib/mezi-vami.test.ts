import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatCzk, nbsp } from "./nbsp";
import { optionSlug, resolveProps, type PropsMeta } from "./dc";

const NB = " ";

describe("nbsp — česká typografie", () => {
  it("jednopísmenné předložky a spojky dostanou pevnou mezeru", () => {
    expect(nbsp("Jdeme k moři a v noci spíme")).toBe(
      `Jdeme k${NB}moři a${NB}v${NB}noci spíme`,
    );
  });
  it("číslo + jednotka, tisíce, datum", () => {
    expect(nbsp("do 48 hodin")).toBe(`do 48${NB}hodin`);
    expect(nbsp("platí 30 dní")).toBe(`platí 30${NB}dní`);
    expect(nbsp("1 990 Kč")).toBe(`1${NB}990${NB}Kč`);
    expect(nbsp("14. 5. 1990")).toBe(`14.${NB}5.${NB}1990`);
  });
  it("je idempotentní", () => {
    const once = nbsp("v 1 990 Kč do 48 hodin");
    expect(nbsp(once)).toBe(once);
  });
  it("cena přes Intl nese pevné mezery", () => {
    expect(formatCzk(1990)).toMatch(/^1\s990\sKč$/);
    expect(formatCzk(1990)).not.toContain(" ");
  });
});

describe("resolveProps — ?stav= / ?vzorek=", () => {
  const meta: PropsMeta = {
    vzorek: {
      editor: "enum",
      options: [
        "S0 — vzorek není",
        "S1 — provizorní ukázka",
        "S2 — schválený vzorek",
      ],
    },
    stav: { editor: "enum", options: ["Čeká na potvrzení", "Zrušeno"] },
    podpora: { editor: "boolean", default: true },
  };
  it("výchozí = první hodnota", () => {
    expect(resolveProps(meta, {})).toEqual({
      vzorek: "S0 — vzorek není",
      stav: "Čeká na potvrzení",
      podpora: true,
    });
  });
  it("rozpozná slug i kód", () => {
    expect(
      resolveProps(meta, { vzorek: "s2", stav: "zruseno", podpora: "0" }),
    ).toEqual({
      vzorek: "S2 — schválený vzorek",
      stav: "Zrušeno",
      podpora: false,
    });
  });
  it("neznámá hodnota → výchozí", () => {
    expect(resolveProps(meta, { vzorek: "x" }).vzorek).toBe("S0 — vzorek není");
  });
  it("slug", () => {
    expect(optionSlug("Čeká na potvrzení")).toBe("ceka-na-potvrzeni");
    expect(optionSlug("S1 — provizorní ukázka")).toBe("s1");
  });
});

describe("generované komponenty — pravidla designu", () => {
  const dir = path.join(__dirname, "..", "_dc");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"));
  const src = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");

  it("existují komponenty ze všech artboardů", () => {
    expect(files.length).toBeGreaterThanOrEqual(22);
  });
  it("žádná váha 300 (Jost i EB Garamond jen 400/500)", () => {
    for (const f of files) expect(src(f), f).not.toMatch(/fontWeight: "300"/);
  });
  it("žádné SVG filtry na tůních a žádné Google Fonts", () => {
    for (const f of files) {
      expect(src(f), f).not.toMatch(/googleapis/);
    }
  });
  it("křivky mají non-scaling-stroke", () => {
    const withCurve = files.filter((f) => src(f).includes("<LightCurve"));
    expect(withCurve.length).toBeGreaterThan(0);
    for (const f of withCurve)
      expect(src(f), f).toMatch(/vectorEffect="non-scaling-stroke"/);
  });
  it("prefers-reduced-motion vypíná pohyb", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "..", "mezi-vami.css"),
      "utf8",
    );
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*animation: none !important/,
    );
  });
});
