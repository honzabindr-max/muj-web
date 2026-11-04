// Fail-closed nastavení v .claude/settings.json (Radar 2026-11-03 #4).
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "..", "..", "..");
// TARS_SETTINGS_FILE: jen pro ověření navrženého souboru mimo repo; výchozí je soubor v repu.
const SETTINGS =
  process.env.TARS_SETTINGS_FILE ?? path.join(REPO, ".claude", "settings.json");

type Hook = {
  type: string;
  command: string;
  timeout?: number;
  onFailure?: string;
};
type Settings = {
  permissions: Record<string, unknown>;
  hooks: Record<string, Array<{ matcher?: string; hooks: Hook[] }>>;
};

const settings = JSON.parse(readFileSync(SETTINGS, "utf8")) as Settings;

function preHook(name: string): Hook {
  const hook = settings.hooks.PreToolUse.flatMap((m) => m.hooks).find((h) =>
    h.command.includes(name),
  );
  if (!hook) throw new Error(`hook ${name} chybí v settings.json`);
  return hook;
}

describe("settings.json: fail-closed a hranice zápisu", () => {
  it("je platný JSON s permissions.blockWritesOutsideWorkingDirectories = true", () => {
    expect(settings.permissions.blockWritesOutsideWorkingDirectories).toBe(
      true,
    );
  });

  it.each(["bash-preflight.sh", "notion-owner-decision.py"])(
    "%s má onFailure: block a konečný timeout",
    (name) => {
      const h = preHook(name);
      expect(h.onFailure).toBe("block");
      expect(h.timeout).toBeGreaterThan(0);
      expect(h.timeout).toBeLessThanOrEqual(60);
    },
  );
});
