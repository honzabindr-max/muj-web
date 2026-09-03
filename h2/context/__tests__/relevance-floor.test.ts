import { describe, expect, it } from "vitest";

import { passesRelevanceFloor } from "../relevance-floor";
import type { ResolvedEntity } from "../resolve-entities";

describe("passesRelevanceFloor() (§7.3)", () => {
  it("AT-21: čistá emoční zpráva bez project entity → nesouvisející candidate se nenačte", () => {
    const noEntities: ResolvedEntity[] = [];
    const unrelatedProjectCandidate = { matchLabel: "Renovace bytu" };

    expect(passesRelevanceFloor(unrelatedProjectCandidate, noEntities, "BUDDY_RESPONSE")).toBe(false);
  });

  it("candidate bez matchLabel, bez requiredForAction, bez hypotézy → floor odmítne (žádný důvod pro zařazení)", () => {
    expect(passesRelevanceFloor({}, [], "BUDDY_RESPONSE")).toBe(false);
  });

  it("AT-22: emoční zpráva explicitně zmiňuje experiment → relevantní experiment context je dostupný", () => {
    const resolved: ResolvedEntity[] = [{ refType: "EXPERIMENT", label: "Ranní běhání" }];
    const experimentCandidate = { matchLabel: "Ranní běhání" };

    expect(passesRelevanceFloor(experimentCandidate, resolved, "BUDDY_RESPONSE")).toBe(true);
  });

  it("entity match je case-insensitive", () => {
    const resolved: ResolvedEntity[] = [{ refType: "EXPERIMENT", label: "Ranní běhání" }];
    expect(passesRelevanceFloor({ matchLabel: "RANNÍ BĚHÁNÍ" }, resolved, "BUDDY_RESPONSE")).toBe(true);
  });

  it("AT-23: hypotéza se bez explicitního deep-dive/review nedostane do běžného runtime", () => {
    const hypothesisCandidate = { isHypothesis: true };

    expect(passesRelevanceFloor(hypothesisCandidate, [], "BUDDY_RESPONSE")).toBe(false);
    expect(passesRelevanceFloor(hypothesisCandidate, [], "BUDDY_DEEP_DIVE")).toBe(true);
  });

  it("hypotéza s matchLabel na resolved entity pořád vyžaduje deep-dive (isHypothesis má přednost)", () => {
    const resolved: ResolvedEntity[] = [{ refType: "EXPERIMENT", label: "Ranní běhání" }];
    const candidate = { isHypothesis: true, matchLabel: "Ranní běhání" };

    expect(passesRelevanceFloor(candidate, resolved, "BUDDY_RESPONSE")).toBe(false);
    expect(passesRelevanceFloor(candidate, resolved, "BUDDY_DEEP_DIVE")).toBe(true);
  });

  it("condition 2: requiredForAction propustí bez ohledu na entity/purpose", () => {
    expect(passesRelevanceFloor({ requiredForAction: true }, [], "BUDDY_RESPONSE")).toBe(true);
  });
});
