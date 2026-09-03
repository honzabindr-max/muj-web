import { describe, expect, it } from "vitest";

import { detectFastPathControlCommand } from "../control-fast-path";

describe("detectFastPathControlCommand() (DEC-007, §8.1 exact-match)", () => {
  it("rozpozná /stop, /pause, /resume — trimované, case-insensitive", () => {
    expect(detectFastPathControlCommand("/stop")).toBe("STOP");
    expect(detectFastPathControlCommand("  /PAUSE  ")).toBe("PAUSE");
    expect(detectFastPathControlCommand("/Resume")).toBe("RESUME");
  });

  it("I7.6: holá věta obsahující slovo 'stop' se NEDETEKUJE — jen přesná celá zpráva", () => {
    expect(detectFastPathControlCommand("prosím stop otravování")).toBeNull();
    expect(detectFastPathControlCommand("/stop prosím")).toBeNull();
    expect(detectFastPathControlCommand("stop")).toBeNull();
  });

  it("IGNORE do fast path nepatří (potřebuje cíl — jen Command Gate stage)", () => {
    expect(detectFastPathControlCommand("/ignore")).toBeNull();
  });

  it("prázdný/nesouvisející text → null", () => {
    expect(detectFastPathControlCommand("")).toBeNull();
    expect(detectFastPathControlCommand("ahoj, jak se máš?")).toBeNull();
  });
});
