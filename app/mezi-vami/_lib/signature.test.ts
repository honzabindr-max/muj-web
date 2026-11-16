import { describe, expect, it } from "vitest";
import { signature } from "./signature";

describe("signature — podpis dvojice (geometrie z artboardů V)", () => {
  it("hero 375×190: cesty a uzly přesně jako na plátně V-01", () => {
    const g = signature(375, 190);
    expect(g.pathA.startsWith("M -10.0 58.1 L -7.0 55.0 L -4.0 53.3")).toBe(true);
    expect(g.pathB.startsWith("M -10.0 140.3 L -7.0 143.3")).toBe(true);
    expect(g.nodes.map((n) => n.x.toFixed(1))).toEqual([
      "67.9", "115.7", "163.6", "211.4", "259.3", "307.1", "355.0",
    ]);
    expect(g.nodes.every((n) => n.y === 95)).toBe(true);
  });
  it("sdílení 335×110 (V-01) a karta 360×140 (V-02)", () => {
    expect(signature(335, 110).pathA.startsWith("M -10.0 36.7 L -7.0 33.6")).toBe(true);
    expect(signature(360, 140).pathA.startsWith("M -10.0 44.0 L -7.0 41.1")).toBe(true);
    expect(signature(360, 140).nodes[6].x.toFixed(1)).toBe("340.0");
  });
  it("sedm uzlů, typy zleva: ☌ △ △ □ ⚹ □ ☌, jen první je silný", () => {
    const g = signature(375, 190);
    expect(g.nodes.map((n) => n.typ)).toEqual([
      "conj", "trine", "trine", "square", "sextile", "square", "conj",
    ]);
    expect(g.nodes.filter((n) => n.strong)).toHaveLength(1);
  });
});
