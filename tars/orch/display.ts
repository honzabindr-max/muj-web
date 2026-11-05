// Zjištění 5. 11. 2026: GPT kontrola v prohlížeči (chatgpt-web) v noci 11× selhala na výběru modelu, protože Mac měl
// uspaný displej a okno Chrome TARS-agent se nekreslilo. Krok GPT v prohlížeči se proto spustí jen při probuzeném
// displeji; jinak zakázka čeká ve WAITING_REVIEW s důvodem „displej spí“ a Chrome se vůbec neotevře.
//
// Sonda je jen čtení a bez sudo: `osascript -l JavaScript` zavolá CoreGraphics `CGDisplayIsAsleep(CGMainDisplayID())`.
// (Na Apple Silicon `IODisplayWrangler` nemá `CurrentPowerState` a `pmset -g powerstate IODisplayWrangler` selhává.)
// Fail-closed: mimo macOS, chyba, timeout, nečitelný výstup nebo hlavní displej 0 = „displej spí“ (pokus se neprovede).
import { execFileSync } from "node:child_process";

export interface DisplayState {
  awake: boolean;
  /** Krátký důvod pro záznam (bez hodnot z prostředí). */
  reason: string;
}

export type DisplayProbe = () => DisplayState;

export const DISPLAY_JXA =
  "ObjC.import('CoreGraphics'); var d = $.CGMainDisplayID(); JSON.stringify({main: d, asleep: $.CGDisplayIsAsleep(d)})";

export interface DisplayProbeEnv {
  platform?: NodeJS.Platform;
  /** Spustí příkaz a vrátí stdout (výchozí execFileSync s timeoutem 5 s). */
  run?: (cmd: string, args: string[]) => string;
}

/** Výstup sondy → stav. Probuzený je jen `{"main": >0, "asleep": 0|false}`. */
export function parseDisplayProbe(out: string): DisplayState {
  let j: unknown;
  try {
    j = JSON.parse(out.trim());
  } catch {
    return { awake: false, reason: "sonda displeje: nečitelný výstup" };
  }
  const o = j as { main?: unknown; asleep?: unknown };
  if (typeof o?.main !== "number" || !(o.main > 0))
    return { awake: false, reason: "sonda displeje: hlavní displej nenalezen" };
  if (o.asleep === 0 || o.asleep === false)
    return { awake: true, reason: "displej vzhůru" };
  if (o.asleep === 1 || o.asleep === true)
    return { awake: false, reason: "displej spí" };
  return { awake: false, reason: "sonda displeje: nečitelný stav" };
}

export function probeDisplay(env: DisplayProbeEnv = {}): DisplayState {
  const platform = env.platform ?? process.platform;
  if (platform !== "darwin")
    return { awake: false, reason: "sonda displeje: není macOS" };
  const run =
    env.run ??
    ((cmd: string, args: string[]) =>
      execFileSync(cmd, args, {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      }));
  let out: string;
  try {
    out = run("/usr/bin/osascript", ["-l", "JavaScript", "-e", DISPLAY_JXA]);
  } catch {
    return { awake: false, reason: "sonda displeje: osascript selhal" };
  }
  return parseDisplayProbe(out);
}
