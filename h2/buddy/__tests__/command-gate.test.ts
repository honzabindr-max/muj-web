import { describe, expect, it } from "vitest";

import { runCommandGate } from "../command-gate";

/**
 * Command Gate (BUILD-10 plán, DEC-007 bod 3-5) — čistá funkce, žádná DB.
 * Re-detekce musí přesně souhlasit s `detectFastPathControlCommand()`
 * (I7.7: exact match, ne fuzzy) — běžná věta obsahující "stop" uprostřed
 * se NESMÍ detekovat jako command.
 */
describe("runCommandGate()", () => {
  it("přesný /stop → isControlCommand true, potvrzovací text", () => {
    const result = runCommandGate("/stop");
    expect(result.isControlCommand).toBe(true);
    if (result.isControlCommand) {
      expect(result.command).toBe("STOP");
      expect(result.confirmationText.length).toBeGreaterThan(0);
    }
  });

  it("case-insensitive + trim, pořád exact match", () => {
    const result = runCommandGate("  /PAUSE  ");
    expect(result.isControlCommand).toBe(true);
    if (result.isControlCommand) expect(result.command).toBe("PAUSE");
  });

  it("/resume → RESUME", () => {
    const result = runCommandGate("/resume");
    expect(result.isControlCommand).toBe(true);
    if (result.isControlCommand) expect(result.command).toBe("RESUME");
  });

  it("běžná věta obsahující slovo 'stop' uprostřed se NESMÍ detekovat jako command (I7.6/I7.7)", () => {
    const result = runCommandGate("nevím, mám s tím přestat, stop tomu chci dát až zítra");
    expect(result.isControlCommand).toBe(false);
  });

  it("holé 'stop' bez lomítka se nedetekuje ve fast path Gate (mimo scope, viz command-gate.ts komentář)", () => {
    const result = runCommandGate("stop");
    expect(result.isControlCommand).toBe(false);
  });

  it("/ignore se nedetekuje (potřebuje cíl, mimo scope DEC-007 fast path)", () => {
    const result = runCommandGate("/ignore");
    expect(result.isControlCommand).toBe(false);
  });
});
